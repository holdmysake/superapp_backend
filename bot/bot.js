import fs from 'fs'
import path from 'path'
import pkg from '@whiskeysockets/baileys'
import { models } from '../models/index.js'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

const LOG = process.env.LOG_SOCKET !== '0'
const QR_TTL_MS = 30_000
const WATCHDOG_INTERVAL_MS = 10_000

const sessions = new Map()

const authDir = (field_id) => path.join(process.cwd(), 'baileys_auth', String(field_id))
const roomOf = (field_id) => `field_${field_id}`

function hashStr(s) {
	let h = 0
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
	return h >>> 0
}
function log(...args) { if (LOG) console.log(...args) }

function emitToField(io, field_id, event, payload) {
	const room = roomOf(field_id)
	log(`[WA][emit] room=${room} field_id=${field_id} event=${event} :: ${event === 'qr'
		? (typeof payload === 'string' ? `len=${payload.length}` : `len=${(payload?.qr||'').length}`)
		: JSON.stringify(payload)}`)
	io.to(room).emit(event, payload)
}

function formatMsisdn(id) {
	let no_wa = id?.split(':')[0] || null
	if (no_wa?.startsWith('62')) no_wa = '0' + no_wa.slice(2)
	return no_wa
}

function emitStatus(io, field_id) {
	const s = sessions.get(field_id)
	if (!s) return
	emitToField(io, field_id, 'status', {
		field_id,
		...(s.lastStatus || { connected: false, no_wa: null })
	})
}

// ===== hapus isi folder auth/<field_id> tanpa menghapus foldernya =====
function clearAuthDirContents(dir) {
	try {
		if (!fs.existsSync(dir)) return
		const entries = fs.readdirSync(dir, { withFileTypes: true })
		for (const ent of entries) {
			const p = path.join(dir, ent.name)
			if (ent.isDirectory()) {
				// hapus rekursif isi subdir, lalu hapus subdir
				fs.rmSync(p, { recursive: true, force: true })
			} else {
				fs.rmSync(p, { force: true })
			}
		}
	} catch (e) {
		log('[WA][auth-clear][error]', e?.message || e)
	}
}

function scheduleQrExpiry(field_id, io) {
	const s = sessions.get(field_id)
	if (!s) return
	clearTimeout(s.qrTimer)
	s.qrTimer = setTimeout(() => {
		if (!s.lastStatus?.connected) {
			log(`[WA][qr-expired] field_id=${field_id} ttl=${QR_TTL_MS}ms`)
			restartSession(field_id, io)
		}
	}, QR_TTL_MS)
}

function emitQrIfChanged(io, field_id, nextQr) {
	const s = sessions.get(field_id)
	if (!s) return
	const nextHash = hashStr(nextQr)
	if (s.qrHash === nextHash) {
		return
	}
	s.lastQR = nextQr
	s.qrHash = nextHash
	s.qrAt = Date.now()
	scheduleQrExpiry(field_id, io)
	emitToField(io, field_id, 'qr', { field_id, qr: nextQr })
}

async function restartSession(field_id, io) {
	const s = sessions.get(field_id)
	if (!s) return
	try { s.sock?.end?.() } catch {}
	try { s.sock?.ws?.close?.() } catch {}
	clearTimeout(s.qrTimer)
	clearInterval(s.watchdog)
	sessions.delete(field_id)
	await ensureSession(field_id, io)
}

async function ensureSession(field_id, io) {
	let s = sessions.get(field_id)
	if (s?.sock) return s

	const dir = authDir(field_id)
	fs.mkdirSync(dir, { recursive: true })
	const { state, saveCreds } = await useMultiFileAuthState(dir)

	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: false,
		browser: [`FLIP Bot ${field_id}`, 'Chrome', '1.0.0']
	})

	s = {
		sock,
		lastStatus: { connected: false, no_wa: null },
		lastQR: null,
		qrHash: null,
		qrAt: 0,
		qrTimer: null,
		watchdog: null,
	}
	sessions.set(field_id, s)

	s.sock.ev.on('creds.update', saveCreds)

	s.sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update
		log(`[WA][conn.update] field_id=${field_id} conn=${connection} hasQR=${!!qr}`)

		// QR baru dari Baileys
		if (qr && !s.lastStatus?.connected) {
			emitQrIfChanged(io, field_id, qr)
		}

		if (connection === 'open') {
			const no_wa = formatMsisdn(s.sock.user?.id)
			s.lastStatus = { connected: true, no_wa }
			s.lastQR = null
			s.qrHash = null
			s.qrAt = 0
			clearTimeout(s.qrTimer)
			emitStatus(io, field_id)
		}

		if (connection === 'close') {
			const code =
				lastDisconnect?.error?.output?.statusCode ??
				lastDisconnect?.error?.data?.disconnectReason

			// tandai disconnect
			s.lastStatus = { connected: false, no_wa: null }
			emitStatus(io, field_id)

			// hapus hanya isi folder auth/<field_id>, lalu langsung restart untuk generate QR baru
			const d = authDir(field_id)
			clearAuthDirContents(d)
			log(`[WA][disconnect] cleared auth contents field_id=${field_id} code=${code ?? 'n/a'}`)

			// kalau sebelumnya pakai rmSync(dir) saat loggedOut, ganti dengan pembersihan isi saja:
			// if (code === DisconnectReason.loggedOut) { ... } -> tidak diperlukan, kita selalu clear isi

			restartSession(field_id, io) // ini akan memicu ensureSession → Baileys kirim QR baru
		}
	})

	// Watchdog untuk QR stale
	s.watchdog = setInterval(() => {
		if (s.lastStatus.connected) return
		if (!s.qrAt) return
		const age = Date.now() - s.qrAt
		if (age > (QR_TTL_MS * 3)) {
			log(`[WA][watchdog] stale-qr age=${age}ms field_id=${field_id} → restart`)
			restartSession(field_id, io)
		}
	}, WATCHDOG_INTERVAL_MS)

	return s
}

export function initWhatsAppSocket(io) {
	io.on('connection', (socket) => {
		if (LOG) console.log(`[SOCKET] client connected id=${socket.id}`)

		socket.on('wa:status', async ({ field_id }) => {
			if (!field_id) return
			if (LOG) console.log(`[SOCKET][recv] 'wa:status' field_id=${field_id} from=${socket.id}`)
			await ensureSession(field_id, io)
			emitStatus(io, field_id)
		})

		socket.on('wa:status:refresh', ({ field_id }) => {
			if (!field_id) return
			if (LOG) console.log(`[SOCKET][recv] 'wa:status:refresh' field_id=${field_id} from=${socket.id}`)
			emitStatus(io, field_id)
		})

		socket.on('disconnect', (reason) => {
			if (LOG) console.log(`[SOCKET] client ${socket.id} disconnected reason=${reason}`)
		})
	})
}

export async function bootstrapWhatsAppSessions(io) {
	const { Field } = models
	const rows = await Field.findAll({ attributes: ['field_id', 'id'] })
	log(`[WA][bootstrap] fields=${rows.length}`)
	for (const row of rows) {
		const field_id = row.field_id ?? row.id
		if (field_id == null) continue
		await ensureSession(field_id, io)
	}
}

export async function stopSession(field_id) {
	const s = sessions.get(field_id)
	if (!s?.sock) return
	try { await s.sock.logout() } catch {}
	clearTimeout(s.qrTimer)
	clearInterval(s.watchdog)
	sessions.delete(field_id)
	log(`[WA][stop] field_id=${field_id} stopped`)
}

export function getSessionStatus(field_id) {
	const s = sessions.get(field_id)
	return s?.lastStatus ?? { connected: false, no_wa: null }
}
