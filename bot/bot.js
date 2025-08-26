// services/whatsapp.manager.js
import fs from 'fs'
import path from 'path'
import pkg from '@whiskeysockets/baileys'

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

// ==============================
// Session store per field_id
// ==============================
const sessions = new Map() // field_id -> { sock, lastQR, lastStatus, ready }

// Helpers
const authDir = (field_id) => path.join(process.cwd(), 'baileys_auth', String(field_id))
const roomOf = (field_id) => `field_${field_id}`

function formatMsisdn(id) {
	// e.g. "6281234567890:1@s.whatsapp.net" -> "081234567890"
	let no_wa = id?.split(':')[0] || null
	if (no_wa?.startsWith('62')) {
		no_wa = '0' + no_wa.slice(2)
	}
	return no_wa
}

function emitStatus(io, field_id) {
	const s = sessions.get(field_id)
	if (!s) return
	io.to(roomOf(field_id)).emit('status', {
		field_id,
		...(s.lastStatus || { connected: false, no_wa: null })
	})
	// Only send QR when disconnected AND we have a QR
	if (!s.lastStatus?.connected && s.lastQR) {
		io.to(roomOf(field_id)).emit('qr', s.lastQR)
	}
}

async function ensureSession(field_id, io) {
	let s = sessions.get(field_id)
	if (s?.sock) {
		return s
	}

	// Create auth folder per field
	const dir = authDir(field_id)
	fs.mkdirSync(dir, { recursive: true })

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

	s.sock.ev.on('creds.update', saveCreds)

	// Connection updates
	s.sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update

		// QR handling
		if (qr) {
			s.lastQR = qr
			// Only emit QR if currently not connected
			if (!s.lastStatus?.connected) {
				io.to(roomOf(field_id)).emit('qr', qr)
			}
		}

		// OPEN
		if (connection === 'open') {
			const no_wa = formatMsisdn(s.sock.user?.id)
			s.lastStatus = { connected: true, no_wa }
			s.lastQR = null
			s.ready = true
			io.to(roomOf(field_id)).emit('status', { field_id, ...s.lastStatus })
		}

		// CLOSE
		if (connection === 'close') {
			const code =
				lastDisconnect?.error?.output?.statusCode ??
				lastDisconnect?.error?.data?.disconnectReason

			// Reset status first
			s.lastStatus = { connected: false, no_wa: null }
			io.to(roomOf(field_id)).emit('status', { field_id, ...s.lastStatus })

			// If logged out, wipe auth to allow fresh QR next time
			if (code === DisconnectReason.loggedOut) {
				try {
					fs.rmSync(dir, { recursive: true, force: true })
				} catch {}
			}
			// Baileys has its own retry logic; we simply keep the session object.
		}
	})

	return s
}

// =====================================
// Public: bind socket handlers (status)
// =====================================
export function initWhatsAppSocket(io) {
	io.on('connection', (socket) => {
		// Client is expected to join its field room first using existing "joinField"
		// Then it can request status for that field_id.

		// Ask/Check status (and start session if needed)
		socket.on('wa:status', async ({ field_id }) => {
			if (!field_id) return
			await ensureSession(field_id, io)
			emitStatus(io, field_id)
		})

		// Optional: force-refresh current status/qr without re-creating session
		socket.on('wa:status:refresh', ({ field_id }) => {
			if (!field_id) return
			emitStatus(io, field_id)
		})
	})
}

// =====================================
// Optional helpers for future use
// =====================================
export async function stopSession(field_id) {
	const s = sessions.get(field_id)
	if (!s?.sock) return
	try {
		await s.sock.logout()
	} catch {}
	sessions.delete(field_id)
}

export function getSessionStatus(field_id) {
	const s = sessions.get(field_id)
	return s?.lastStatus ?? { connected: false, no_wa: null }
}
