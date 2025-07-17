import qrcode from 'qrcode'
import { getWhatsAppSocket } from '../../services/whatsapp.service.js'
import WALogin from '../../models/wa_login.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export const scanQR = async (req, res) => {
    try {
        const { field_id } = req.body

        const token = req.headers.authorization?.split(' ')[1]

        const decoded = jwt.verify(token, JWT_SECRET)

        const existing = await WALogin.findOne({ where: { field_id } })

        if (existing && existing.is_login === 1) {
            return res.status(400).json({ error: 'WhatsApp sudah login untuk field ini' })
        }

        if (!existing) {
            await WALogin.create({
                field_id,
                is_login: 0
            })
        } else {
            await WALogin.update(
                { is_login: 0 },
                { where: { field_id } }
            )
        }

        const sock = await getWhatsAppSocket(field_id)

        let isResponded = false

        sock.ev.on('connection.update', async (update) => {
            const { qr, connection } = update

            if (qr && !isResponded) {
                const qrBase64 = await qrcode.toDataURL(qr)
                isResponded = true
                return res.status(200).json({ qr: qrBase64 })
            }

            if (connection === 'open') {
                const jid = sock.user.id
                const no_wa = jid.split('@')[0]

                await WALogin.update(
                    {
                        is_login: 1,
                        no_wa: no_wa,
                        user_id: decoded.user_id
                    },
                    { where: { field_id } }
                )
            
                console.log(`✅ WhatsApp connected for field ${field_id} | No: ${no_wa}`)
            }
        })

        setTimeout(() => {
            if (!isResponded) {
                res.status(408).json({ error: 'QR generation timeout' })
            }
        }, 10000)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to generate QR' })
    }
}
