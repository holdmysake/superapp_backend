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
        await sendWaText("jbi", getIO(), { to: '0895414264902', text: message })
        await sendWaText("jbi", getIO(), { to: '0895414264902', text: message })

        getIO().to(`field_jbi`).emit("notif", message)
    } catch (err) {
        console.error("Failed to send WA message:", err.message)
    }
}

const spot_data = {
    bjg: {
        high: 110,
        drop_high: 2.5
    },
    bjg2: {
        high: 80,
        drop_high: 2.5
    },
    bjg4: {
        high: 25,
        drop_high: 5.5,
        low: 20,
        drop_low: 8.0
    },
    kas: {
        high: 130,
        drop_high: 5,
        low: 20,
        drop_low: 30
    },
    kas3: {
        high: 80,
        drop_high: 3.8,
        low: 10,
        drop_low: 50
    },
    kas4: {
        high: 50,
        drop_high: 3
    },
    sgl: {
        high: 100,
        drop_high: 7,
        low: 50,
        drop_low: 30
    },
    ktt: {
        high: 150,
        drop_high: 2,
        low: 15,
        drop_low: 30
    }
}

const checkDrop = async (field_id, spot_id, psi) => {
    if (field_id !== 'jbi') return

    // 1. Tentukan ambang batas penurunan berdasarkan spot_id dan nilai psi saat ini
    const config = spot_data[spot_id]
    if (!config) return

    let threshold = null
    let status = null
    if (config.high !== undefined && psi > config.high) {
        threshold = config.drop_high
        status = 'on'
    } else if (config.low !== undefined && psi < config.low) {
        threshold = config.drop_low
        status = 'off'
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

        // await predictNotif(field_id, spot_id, status)
    }
}

const predictNotif = async (field_id, spot_id, status) => {
    const tableName = `pressure_${field_id}`
    const Pressure = defineUserDataModel(tableName)

    const config = spot_data[spot_id]
    if (!config) return

    if (status === 'on') {
        const normalData = await Pressure.findAll({
            where: {
                spot_id,
                psi: {
                    [Op.gt]: config.high
                }
            },
            limit: 10,
            order: [["timestamp", "DESC"]]
        })

        const sum = normalData.reduce((acc, curr) => acc + curr.psi, 0)
        const avg = sum / normalData.length
            

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