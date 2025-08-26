// services/whatsapp.manager.js
import fs from 'fs'
import path from 'path'
import pkg from '@whiskeysockets/baileys'
import { models } from '../models/index.js'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

// ==============================
// Session store per field_id
// ==============================
const sessions = new Map() // field_id -> { sock, lastQR, lastStatus, ready }

// ==============================
// Logging helpers
// ==============================
const LOG_SOCKET = process.env.LOG_SOCKET !== '0' // set LOG_SOCKET=0 to silence

const authDir = (field_id) => path.join(process.cwd(), 'baileys_auth', String(field_id))
const roomOf  = (field_id) => `field_${field_id}`

function roomSize(io, room) {
	try {
		return io.of('/').adapter.rooms.get(room)?.size ?? 0
	} catch {
		return 0
	}
}

function summarizePayload(event, payload) {
	try {
		if (event === 'status') {
			return `connected=${!!payload?.connected} no_wa=${payload?.no_wa ?? null}`
		}
		if (event === 'qr') {
			if (typeof payload === 'string') {
				return `qr_len=${payload.length} head=${payload.slice(0, 18)}...`
			}
			const q = payload?.qr ?? ''
			return `qr_len=${q.length} head=${String(q).slice(0, 18)}...`
		}
		// fallback
		return JSON.stringify(
			typeof payload === 'string' ? { len: payload.length, head: payload.slice(0, 18) } : payload
		).slice(0, 200)
	} catch {
		return '[unloggable]'
	}
}

function emitToField(io, field_id, event, payload) {
	const room = roomOf(field_id)
	if (LOG_SOCKET) {
		const size = roomSize(io, room)
		console.log(`[WA][emit] room=${room} field_id=${field_id} event=${event} clients=${size} :: ${synthesizeLogLine(event, payload)}`)
	}
	io.to(room).emit(event, payload)
}

function synthesizeLogLine(event, payload) {
	return summarizePayload(event, payload)
}

// ==============================
// Utils
// ==============================
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
	if (!s.lastStatus?.connected && s.lastQR) {
		emitToField(io, field_id, 'qr', s.lastQR)
	}
}

// ==============================
// WA session lifecycle
// ==============================
async function ensureSession(field_id, io) {
	let s = sessions.get(field_id)
	if (s?.sock) return s

	const dir = authDir(field_id)
	fs.mkdirSync(dir, { recursive: true })
	if (LOG_SOCKET) console.log(`[WA][session] init field_id=${field_id} authDir=${dir}`)

	const { state, saveCreds } = await useMultiFileAuthState(dir)

	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: false,
		browser: ['Bot Torque', 'Chrome', '1.0.0']
	})

	s = {
		sock,
		lastQR: null,
		lastStatus: { connected: false, no_wa: null },
		ready: false
	}
	sessions.set(field_id, s)

	s.sock.ev.on('creds.update', () => {
		if (LOG_SOCKET) console.log(`[WA][creds.update] field_id=${field_id}`)
		saveCreds()
	})

	s.sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update
		if (LOG_SOCKET) {
			console.log(
				`[WA][connection.update] field_id=${field_id} connection=${connection ?? 'n/a'} hasQR=${!!qr} errCode=${
					lastDisconnect?.error?.output?.statusCode ??
					lastDisconnect?.error?.data?.disconnectReason ??
					'none'
				}`
			)
		}

		// QR handling
		if (qr) {
			s.lastQR = qr
			if (!s.lastStatus?.connected) {
				emitToField(io, field_id, 'qr', qr)
			}
		}

		// OPEN
		if (connection === 'open') {
			const no_wa = formatMsisdn(s.sock.user?.id)
			s.lastStatus = { connected: true, no_wa }
			s.lastQR = null
			s.ready = true
			emitToField(io, field_id, 'status', { field_id, ...s.lastStatus })
		}

		// CLOSE
		if (connection === 'close') {
			const code =
				lastDisconnect?.error?.output?.statusCode ??
				lastDisconnect?.error?.data?.disconnectReason

			s.lastStatus = { connected: false, no_wa: null }
			emitToField(io, field_id, 'status', { field_id, ...s.lastStatus })

			if (code === DisconnectReason.loggedOut) {
				try {
					fs.rmSync(dir, { recursive: true, force: true })
					if (LOG_SOCKET) console.log(`[WA][session] loggedOut -> auth wiped field_id=${field_id}`)
				} catch {}
			}
		}
	})

	return s
}

// =====================================
// Public: bind socket handlers (status)
// =====================================
export function initWhatsAppSocket(io) {
	io.on('connection', (socket) => {
		if (LOG_SOCKET) console.log(`[SOCKET] client connected id=${socket.id}`)

		socket.on('wa:status', async ({ field_id }) => {
			if (!field_id) return
			if (LOG_SOCKET) console.log(`[SOCKET][recv] 'wa:status' field_id=${field_id} from=${socket.id}`)
			await ensureSession(field_id, io)
			emitStatus(io, field_id)
		})

		socket.on('wa:status:refresh', ({ field_id }) => {
			if (!field_id) return
			if (LOG_SOCKET) console.log(`[SOCKET][recv] 'wa:status:refresh' field_id=${field_id} from=${socket.id}`)
			emitStatus(io, field_id)
		})

		socket.on('disconnect', (reason) => {
			if (LOG_SOCKET) console.log(`[SOCKET] client disconnected id=${socket.id} reason=${reason}`)
		})
	})
}

// =====================================
// Boot all sessions from Field.findAll()
// =====================================
export async function bootstrapWhatsAppSessions(io) {
	const { Field } = models
	const rows = await Field.findAll({ attributes: ['field_id', 'id'] })
	if (LOG_SOCKET) console.log(`[WA][bootstrap] fields=${rows.length}`)
	for (const row of rows) {
		const field_id = row.field_id ?? row.id
		if (field_id == null) continue
		await ensureSession(field_id, io)
	}
}

// =====================================
// Optional helpers
// =====================================
export async function stopSession(field_id) {
	const s = sessions.get(field_id)
	if (!s?.sock) return
	try {
		await s.sock.logout()
		if (LOG_SOCKET) console.log(`[WA][stop] logged out field_id=${field_id}`)
	} catch {}
	sessions.delete(field_id)
}

export function getSessionStatus(field_id) {
	const s = sessions.get(field_id)
	return s?.lastStatus ?? { connected: false, no_wa: null }
}
