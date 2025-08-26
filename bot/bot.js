// ./bot/bot.js  (MULTI-SESSION: 1 sesi WA per field_id)
import fs from 'fs'
import pkg from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

let ioRef = null
let wired = false

// field_id -> { sock, lastQR, lastStatus, authDir }
const sessions = new Map()
const room = (field_id) => `wa_${field_id}`

function wireFrontend(io) {
	if (wired) return
	wired = true
	io.on('connection', (socket) => {
		// FE wajib kirim field_id agar dapat snapshot status/QR field tsb
		socket.on('wa:join', (field_id) => {
			socket.join(room(field_id))
			const s = sessions.get(String(field_id))
			// kirim snapshot status + QR hanya utk field tsb
			socket.emit('status', { field_id, ...(s?.lastStatus ?? { connected: false, no_wa: null }) })
			if (s?.lastQR) socket.emit('qr', { field_id, qr: s.lastQR })
		})

		// kontrol via socket (opsional)
		socket.on('wa:start', async (field_id) => { await startBot(io, field_id) })
		socket.on('wa:stop', async (field_id) => { await stopBot(field_id) })
	})
}

function emitStatus(field_id) {
	const s = sessions.get(String(field_id))
	if (!ioRef || !s) return
	ioRef.to(room(field_id)).emit('status', { field_id, ...s.lastStatus })
}

function emitQR(field_id, qr) {
	if (!ioRef) return
	ioRef.to(room(field_id)).emit('qr', { field_id, qr })
}

async function createSock(field_id) {
	const id = String(field_id)
	const authDir = `./baileys_auth/${id}`

	const { state, saveCreds } = await useMultiFileAuthState(authDir)
	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: false,
		browser: ['Bot Torque', 'Chrome', '1.0.0']
	})

	const ctx = {
		sock,
		authDir,
		lastQR: null,
		lastStatus: { connected: false, no_wa: null }
	}
	sessions.set(id, ctx)

	sock.ev.on('creds.update', saveCreds)

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update

		if (qr) {
			ctx.lastQR = qr
			emitQR(id, qr)
		}

		if (connection === 'open') {
			let no_wa = sock.user?.id?.split(':')[0] || null
			if (no_wa?.startsWith('62')) no_wa = '0' + no_wa.slice(2)
			ctx.lastStatus = { connected: true, no_wa }
			ctx.lastQR = null
			emitStatus(id)
		} else if (connection === 'close') {
			const code = lastDisconnect?.error?.output?.statusCode
			const loggedOut = code === DisconnectReason.loggedOut

			if (loggedOut) {
				try { fs.rmSync(authDir, { recursive: true, force: true }) } catch {}
				console.log(`[wa:${id}] session removed, new QR on next start`)
			}

			ctx.lastStatus = { connected: false, no_wa: null }
			emitStatus(id)

			// auto-reconnect kecuali benar2 logout
			if (!loggedOut) {
				setTimeout(() => {
					createSock(id).catch((e) => console.error(`[wa:${id}] recreate error:`, e))
				}, 1000)
			}
		}
	})

	return sock
}

export async function startBot(io, field_id) {
	ioRef = io
	wireFrontend(ioRef)
	const id = String(field_id)
	if (sessions.get(id)?.sock) return sessions.get(id).sock
	return await createSock(id)
}

export async function stopBot(field_id) {
	const id = String(field_id)
	const ctx = sessions.get(id)
	if (!ctx?.sock) return
	try { await ctx.sock.logout() } catch {}
	sessions.delete(id)
	// broadcast status disconnected utk field tsb
	if (ioRef) ioRef.to(room(id)).emit('status', { field_id: id, connected: false, no_wa: null })
}

export function getStatus(field_id) {
	const s = sessions.get(String(field_id))
	return s?.lastStatus ?? { connected: false, no_wa: null }
}
