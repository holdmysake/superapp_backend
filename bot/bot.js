import fs from 'fs'
import pkg from '@whiskeysockets/baileys'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

const sessions = new Map()

const room = (field_id) => `wa_${field_id}`

export function wireWaNamespace(io) {
	const nsp = io.of('/wa')

	nsp.on('connection', (socket) => {
		console.log('[wa] frontend connected', socket.id)

		socket.on('joinField', (field_id) => {
			socket.join(room(field_id))
			const s = sessions.get(field_id)
			if (s?.lastQR) socket.emit('qr', { field_id, qr: s.lastQR })
			socket.emit('status', { field_id, ...(s?.lastStatus || { connected: false, no_wa: null }) })
		})

		socket.on('start', async (field_id) => {
			await startBot(io, field_id)
			socket.emit('started', { field_id })
		})

		socket.on('stop', async (field_id) => {
			await stopBot(field_id)
			socket.emit('stopped', { field_id })
		})

		socket.on('getStatus', (field_id) => {
			const s = sessions.get(field_id)
			socket.emit('status', { field_id, ...(s?.lastStatus || { connected: false, no_wa: null }) })
			if (s?.lastQR) socket.emit('qr', { field_id, qr: s.lastQR })
		})
	})
}

export async function startBot(io, field_id) {
	if (!field_id) throw new Error('field_id required')

	const existing = sessions.get(field_id)
	if (existing?.sock) return existing.sock

	const authDir = `./baileys_auth/${field_id}`
	fs.mkdirSync(authDir, { recursive: true })

	const { state, saveCreds } = await useMultiFileAuthState(authDir)
	const sock = makeWASocket({
		auth: state,
		printQRInTerminal: false,
		browser: ['Flip-Bot', 'Chrome', '1.0.0']
	})

	const ctx = {
		sock,
		saveCreds,
		lastQR: null,
		lastStatus: { connected: false, no_wa: null }
	}
	sessions.set(field_id, ctx)

	sock.ev.on('creds.update', saveCreds)

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update

		if (qr) {
			ctx.lastQR = qr
			io.of('/wa').to(room(field_id)).emit('qr', { field_id, qr })
		}

		if (connection === 'open') {
			let no_wa = sock.user?.id?.split(':')[0] || null
			if (no_wa?.startsWith('62')) no_wa = '0' + no_wa.slice(2) // 62xxxx -> 0xxxx
			ctx.lastStatus = { connected: true, no_wa }
			ctx.lastQR = null
			io.of('/wa').to(room(field_id)).emit('status', { field_id, ...ctx.lastStatus })
		} else if (connection === 'close') {
			const statusCode = lastDisconnect?.error?.output?.statusCode
			const loggedOut = statusCode === DisconnectReason.loggedOut

			if (loggedOut) {
				try { fs.rmSync(authDir, { recursive: true, force: true }) } catch {}
				console.log(`[wa:${field_id}] session removed, new QR on next start`)
			}

			ctx.lastStatus = { connected: false, no_wa: null }
			io.of('/wa').to(room(field_id)).emit('status', { field_id, ...ctx.lastStatus })

			if (!loggedOut) {
				setTimeout(() => startBot(io, field_id).catch(console.error), 1000)
			}
		}
	})

	return sock
}

export async function stopBot(field_id) {
	const ctx = sessions.get(field_id)
	if (!ctx?.sock) return
	try { await ctx.sock.logout() } catch {}
	sessions.delete(field_id)
}

export function getBot(field_id) {
	return sessions.get(field_id)?.sock || null
}

export function getStatus(field_id) {
	const s = sessions.get(field_id)
	return s?.lastStatus || { connected: false, no_wa: null }
}

export function listBots() {
	return Array.from(sessions.keys())
}

export async function sendText(field_id, to, text) {
	const sock = getBot(field_id)
	if (!sock) throw new Error(`Bot for field_id=${field_id} not started`)
	const jid = to.endsWith('@s.whatsapp.net')
		? to
		: (to.replace(/^0/, '62') + '@s.whatsapp.net')
	return sock.sendMessage(jid, { text })
}