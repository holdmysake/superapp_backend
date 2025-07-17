import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'

const sessions = {}

export const getWhatsAppSocket = async (field_id) => {
    if (sessions[field_id]) return sessions[field_id]

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${field_id}`)
    const sock = makeWASocket({ auth: state })

    sessions[field_id] = sock

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        console.log(`Field ${field_id} connection update:`, connection)

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) {
                console.log(`Reconnecting for field ${field_id}`)
                getWhatsAppSocket(field_id)
            } else {
                delete sessions[field_id]
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)
    return sock
}