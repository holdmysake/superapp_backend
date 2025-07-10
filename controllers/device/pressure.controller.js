import Battery from "../../models/battery.model.js"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from 'moment-timezone'

export const getTimestamp = (req, res) => {
    res.json(moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss'))
}

export const store = async (req, res) => {
    try {
        const { field_id, spot_id, psi, batt } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss')

        const press = await Pressure.create({
            spot_id,
            psi,
            timestamp
        })

        let battery
        if (batt) {
            battery = await Battery.upsert({
                spot_id,
                batt,
                timestamp
            })
        }

        res.json({ press, battery })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const storeBulk = async (req, res) => {
    try {
        const { field_id, spot_id, press, batt } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const timestampBatt = new Date()

        const pressData = []

        for (const p of press) {
            const pressEntry = await Pressure.create({
                spot_id,
                psi: p.psi,
                timestamp: p.timestamp
            })

            pressData.push(pressEntry)
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