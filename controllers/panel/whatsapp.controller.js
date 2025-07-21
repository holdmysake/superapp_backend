import waBot from '../../bot/wa.bot.js'

export const scanQRCodeField = async (req, res) => {
    try {
        const { field_id } = req.body

        const qr = await waBot.getQRCodeForField(field_id)

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

export const checkLogin = (req, res) => {
    try {
        const { field_id } = req.body

        const isLogin = waBot.isFieldConnected(field_id)

        res.json(isLogin)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getWA = (req, res) => {
    try {
        const { field_id } = req.body

        const no_wa = waBot.getNoWA(field_id)

        res,json(no_wa)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const pingTest = async (req, res) => {
    try {
        const { field_id } = req.body

        await waBot.pingFieldBot(field_id)
        res.json({ message: 'Berhasil' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const logoutWA = async (req, res) => {
    try {
        const { field_id } = req.body

        await waBot.disconnectField(field_id)

        res.json({ message: 'Berhasil logout WhatsApp' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}