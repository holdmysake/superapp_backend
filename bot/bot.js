import fs from 'fs'
import pkg from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg

let lastQR = null
let lastStatus = { connected: false }
let sockInstance = null

export async function startBot(io) {
    console.log('Starting bot...')
    const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Bot FLIP", "Chrome", "1.0.0"]
    })

    sockInstance = sock

    sock.ev.on('creds.update', saveCreds)

    io.on('connection', (socket) => {
        console.log('Frontend connected via socket')
        if (lastQR) socket.emit('qr', lastQR)
        socket.emit('status', lastStatus)
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            lastQR = qr
            io.emit('qr', qr)
        }

        if (connection === 'open') {
            let no_wa = sock.user?.id?.split(':')[0] || null
            if (no_wa?.startsWith('62')) {
                no_wa = '0' + no_wa.slice(2)
            }
            lastStatus = { connected: true, no_wa }
            io.emit('status', lastStatus)
            lastQR = null
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode

            if (reason === DisconnectReason.loggedOut) {
                fs.rmSync('./baileys_auth', { recursive: true, force: true })
                console.log('Session dihapus, siap QR baru')
            }

            lastStatus = { connected: false, no_wa: null }
            io.emit('status', lastStatus)
            startBot(io)
        }
    })

    return sock
}

export async function disconnectBot() {
    if (sockInstance) {
        await sockInstance.logout()
        sockInstance = null
        console.log('WhatsApp bot disconnected')
    } else {
        console.log('Tidak ada instance WA yang aktif')
    }
}