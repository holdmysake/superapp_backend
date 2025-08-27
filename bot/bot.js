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

function clearDirContents(dirPath) {
	try {
		if (!fs.existsSync(dirPath)) return
		for (const name of fs.readdirSync(dirPath)) {
			const full = path.join(dirPath, name)
			try {
				const st = fs.lstatSync(full)
				if (st.isDirectory()) fs.rmSync(full, { recursive: true, force: true })
				else fs.unlinkSync(full)
			} catch {}
		}
		log(`[WA][auth-clear] cleared contents: ${dirPath}`)
	} catch {}
}

function emitStatus(io, field_id) {
	const s = sessions.get(field_id)
	if (!s) return
	const payload = {
		field_id,
		...(s.lastStatus || { connected: false, no_wa: null })
	}

	if (!s.lastStatus?.connected && s.lastQR) {
		payload.qr = s.lastQR
	}
	emitToField(io, field_id, 'status', payload)
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
		qrAt: 0
	}
	sessions.set(field_id, s)

	s.sock.ev.on('creds.update', saveCreds)

	s.sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update
		log(`[WA][conn.update] field_id=${field_id} conn=${connection} hasQR=${!!qr}`)

		if (qr && !s.lastStatus?.connected) {
			s.lastQR = qr
			emitStatus(io, field_id)
		}

		if (connection === 'open') {
			const no_wa = formatMsisdn(s.sock.user?.id)
			s.lastStatus = { connected: true, no_wa }
			s.lastQR = null
			s.qrHash = null
			s.qrAt = 0
			emitStatus(io, field_id)
		}

		if (connection === 'close') {
			const code =
				lastDisconnect?.error?.output?.statusCode ??
				lastDisconnect?.error?.data?.disconnectReason

			s.lastStatus = { connected: false, no_wa: null }
			emitStatus(io, field_id)

			clearDirContents(dir)

			if (code === DisconnectReason.loggedOut) {
				log(`[WA][loggedOut] field_id=${field_id} (auth contents cleared)`)
			}
		}
	})

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

		socket.on('wa:qr:refresh', async ({ field_id }) => {
			if (!field_id) return
			if (LOG) console.log(`[SOCKET][recv] 'wa:qr:refresh' field_id=${field_id} from=${socket.id}`)
			await hardRefreshQr(field_id, io)
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
	sessions.delete(field_id)
	log(`[WA][stop] field_id=${field_id} stopped`)
}

export function getSessionStatus(field_id) {
	const s = sessions.get(field_id)
	return s?.lastStatus ?? { connected: false, no_wa: null }
}

async function hardRefreshQr(field_id, io) {
	const dir = authDir(field_id)
	clearDirContents(dir)

	const s = sessions.get(field_id)
	if (s?.sock) {
		try { s.sock.end?.() } catch {}
	}
	sessions.delete(field_id)

	await ensureSession(field_id, io)
	emitStatus(io, field_id)
}