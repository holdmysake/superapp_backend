import Battery from "../../models/battery.model.js"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from 'moment-timezone'
import { getIO } from "../../socket.js"
import { onoffNotif } from "../panel/notif.controller.js"
import { Op } from 'sequelize'
import { sendWaText } from "../../bot/bot.js"

export const getTimestamp = (req, res) => {
    res.json(moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss'))
}

const getMinuteAgo = async (field_id, spot_id) => {
    const minuteAgo = moment().tz('Asia/Jakarta').subtract(1, 'minute').format('YYYY-MM-DD HH:mm:ss')

    const tableName = `pressure_${field_id}`
    const Pressure = defineUserDataModel(tableName)

    const pressureDataAvg = await Pressure.findAll({
        where: {
            spot_id,
            timestamp: {
                [Op.gte]: minuteAgo
            }
        },
        order: [["timestamp", "DESC"]]
    })

    if (!pressureDataAvg || pressureDataAvg.length === 0) {
        return 0
    }

    const sum = pressureDataAvg.reduce((acc, curr) => acc + Number(curr.psi || 0), 0)
    return sum / pressureDataAvg.length
}

const sendMessageDrop = async (message) => {
    try {
        await sendWaText("jbi", getIO(), { to: '0895401582299', text: message })
        await sendWaText("jbi", getIO(), { to: '0895401582299', text: message })

        getIO().to(`field_jbi`).emit("notif", message)
    } catch (err) {
        console.error("Failed to send WA message:", err.message)
    }
}

const checkDrop = async (field_id, spot_id, psi) => {
    if (field_id !== 'jbi') return

    // 1. Tentukan ambang batas penurunan berdasarkan spot_id dan nilai psi saat ini
    let threshold = null
    if (spot_id === 'bjg' && psi > 110) {
        threshold = 2.5
    } else if (spot_id === 'bjg2' && psi > 80) {
        threshold = 2.5
    } else if (spot_id === 'bjg4') {
        if (psi > 25) {
            threshold = 5.5
        } else if (psi < 20) {
            threshold = 8.0
        }
    } else if (spot_id === 'kas') {
        if (psi > 130) {
            threshold = 5
        } else if (psi < 20) {
            threshold = 30
        }
    } else if (spot_id === 'kas3') {
        if (psi > 80) {
            threshold = 3.8
        } else if (psi < 10) {
            threshold = 50
        }
    } else if (spot_id === 'kas4') {
        if (psi > 50) {
            threshold = 3
        }
    } else if (spot_id === 'sgl') {
        if (psi > 100) {
            threshold = 7
        } else if (psi < 50) {
            threshold = 20
        }
    } else if (spot_id === 'ktt') {
        if (psi >150) {
            threshold = 2
        } else if (psi < 15) {
            threshold = 30
        }
    }

    // Jika psi tidak memicu ambang batas apa pun, hentikan eksekusi tanpa memanggil DB
    if (threshold === null) return

    // 2. Ambil data rata-rata 1 menit sebelumnya
    const minuteAgoData = await getMinuteAgo(field_id, spot_id)
    if (!minuteAgoData) return

    // 3. Hitung persentase penurunan (pastikan hanya penurunan: rata-rata lama > psi baru)
    const percentDiff = ((minuteAgoData - psi) / minuteAgoData) * 100

    // 4. Kirim pesan jika persentase penurunan melebihi ambang batas
    if (percentDiff > threshold) {
        const message = `⚠️ *Peringatan Tekanan* ⚠️\nSpot: ${spot_id}\nField: ${field_id}\nTekanan: ${psi} PSI\nRata-rata Tekanan: ${minuteAgoData.toFixed(2)} PSI\nPerubahan (Penurunan): ${percentDiff.toFixed(2)}%`
        sendMessageDrop(message)
    }
}

export const store = async (req, res) => {
    try {
        const { field_id, spot_id, psi, batt } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')

        const press = await Pressure.create({
            spot_id,
            psi,
            timestamp
        })

        await checkDrop(field_id, spot_id, psi)

        let battery
        if (batt) {
            battery = await Battery.upsert({
                spot_id,
                batt,
                timestamp
            })
        }

        getIO().to(`field_${field_id}`).emit("pressure:new", {
            field_id,
            spot_id,
            psi,
            batt,
            timestamp
        })

        const data = {
            field_id, spot_id, psi, timestamp
        }
        const pred = await onoffNotif(data)

        res.json({ press, battery, pred })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const storeBulk = async (req, res) => {
    try {
        const { field_id, spot_id, press, batt } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const timestampBatt = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
        const now = moment().tz('Asia/Jakarta')

        const pressData = []
        let skipped = 0

        for (const p of press) {
            const ts = moment.tz(p.timestamp, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta')

            if (
                ts.isBefore(now.clone().subtract(7, 'days')) ||
                ts.isAfter(now.clone().add(1,   'hour'))
            ) {
                skipped++
                continue
            }

            const pressEntry = await Pressure.create({
                spot_id,
                psi: p.psi,
                timestamp: p.timestamp
            })

            await checkDrop(field_id, spot_id, p.psi)

            pressData.push(pressEntry)

            getIO().to(`field_${field_id}`).emit("pressure:new", {
                field_id,
                spot_id,
                psi: p.psi,
                batt: p.batt,
                timestamp: p.timestamp
            })

            const data = {
                field_id, 
                spot_id, 
                psi: p.psi, 
                timestamp: p.timestamp
            }
            await onoffNotif(data)
        }

        let battery
        if (batt) {
            battery = await Battery.upsert({
                spot_id,
                batt,
                timestampBatt
            })
        }

        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')

        res.json({ pressData, battery, timestamp })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const storeMany = async (req, res) => {
    try {
        const { data } = req.body

        if (!Array.isArray(data)) {
            return res.status(400).json({ message: "Data must be an array" })
        }

        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
        const results = []

        for (const item of data) {
            try {
                const { field_id, spot_id, psi, batt } = item

                const tableName = `pressure_${field_id}`
                const Pressure = defineUserDataModel(tableName)

                const press = await Pressure.create({
                    spot_id,
                    psi,
                    timestamp
                })

                await checkDrop(field_id, spot_id, psi)

                let battery
                if (batt) {
                    battery = await Battery.upsert({
                        spot_id,
                        batt,
                        timestamp
                    })
                }

                getIO().to(`field_${field_id}`).emit("pressure:new", {
                    field_id,
                    spot_id,
                    psi,
                    batt,
                    timestamp
                })

                const notifData = {
                    field_id, spot_id, psi, timestamp
                }
                const pred = await onoffNotif(notifData)

                results.push({ spot_id, press, battery, pred, status: 'success' })
            } catch (err) {
                console.error(`Error processing spot_id ${item.spot_id}:`, err.message)
                results.push({ spot_id: item.spot_id, status: 'error', message: err.message })
            }
        }

        res.json({ results })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const storeMQTT = async (payload) => {
    try {
        const cleaned = payload.replace(/[{}]/g, "").trim()

        const parts = cleaned.split(";").map(x => x.trim())

        const field_id = parts[0] || null
        const spot_id  = parts[1] || null
        const psi      = parts[2] || null

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')

        const press = await Pressure.create({
            spot_id,
            psi,
            timestamp
        })

        await checkDrop(field_id, spot_id, psi)

        getIO().to(`field_${field_id}`).emit("pressure:new", {
            field_id,
            spot_id,
            psi,
            batt: null,
            timestamp
        })

        // console.log('Pressure from MQTT: ', press.toJSON())
    } catch (error) {
        console.error(error)
    }
}