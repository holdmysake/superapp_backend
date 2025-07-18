import waBot from '../../bot/wa.bot.js'

export const scanQRCodeField = async (req, res) => {
    try {
        const { field_id } = req.body
        if (!field_id) return res.status(400).send('field_id wajib diisi!')

        const token = req.headers.authorization?.split(' ')[1]

        const qr = await waBot.getQRCodeForField(field_id, token)

        if (!qr) {
            return res.status(400).json({
                status: 'already_connected',
                message: 'Field sudah login'
            })
        }

        res.status(200).json({
            status: 'qr_required',
            qr: qr
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: `Gagal generate QR: ${err.message}` })
    }
}