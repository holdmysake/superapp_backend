import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'

const sessions = {}

export const scanQR = async (req, res) => {
    const { field_id } = req.body
    if (!field_id) return res.status(400).json({ error: 'field_id is required' })

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${field_id}`)
        const sock = makeWASocket({ auth: state })

        sessions[field_id] = sock

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update

            if (qr) {
                const qrBase64 = await qrcode.toDataURL(qr)
                return res.status(200).json({ qr: qrBase64 })
            }

            if (connection === 'open') {
                console.log(`WhatsApp connected for field ${field_id}`)
            }

            if (connection === 'close') {
                const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) scanQR(req, res)
            }
        })

        sock.ev.on('creds.update', saveCreds)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to generate QR' })
    }
}
