import moment from "moment-timezone"
import defineUserDataModel from "../../models/pressure.model.js"
import { Op } from "sequelize"

export const getOffDevice = async (req, res) => {
    try {
        const { field_id } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const startOfDay = moment().startOf('day').toDate()
        const endOfDay = moment().endOf('day').toDate()

        const allData = await Pressure.findAll({
            where: {
                timestamp: {
                    [Op.gte]: startOfDay,
                    [Op.lte]: endOfDay
                }
            },
            attributes: ['spot_id', 'timestamp'],
            order: [['spot_id', 'ASC'], ['timestamp', 'ASC']]
        })

        if (allData.length === 0) {
            return res.status(404).json({ message: 'No data found for this field' })
        }

        const now = moment()
        const gapThreshold = 5 * 60 * 1000 // 5 minutes in ms

        const spotStatus = new Map()

        for (const { spot_id, timestamp } of allData) {
            const ts = moment(timestamp)

            if (!spotStatus.has(spot_id)) {
                spotStatus.set(spot_id, {
                    lastTimestamp: ts,
                    downtimes: []  // array of { start, end }
                })
                continue
            }

            const status = spotStatus.get(spot_id)
            const diff = ts.diff(status.lastTimestamp)

            if (diff > gapThreshold) {
                // Ada downtime antara data sebelumnya dan sekarang
                status.downtimes.push({
                    start: status.lastTimestamp.clone(),
                    end: ts.clone(),
                    durationMs: diff
                })
            }

            status.lastTimestamp = ts
        }

        const offDevices = []

        for (const [spot_id, status] of spotStatus.entries()) {
            const diffNow = now.diff(status.lastTimestamp)

            const isCurrentlyOff = diffNow > gapThreshold
            const hadDowntime = status.downtimes.length > 0

            const lastDowntime = status.downtimes[status.downtimes.length - 1]

            const deviceInfo = {
                spot_id,
                lastSeen: status.lastTimestamp.format('YYYY-MM-DD HH:mm:ss'),
                isCurrentlyOff,
                hadDowntime
            }

            if (!isCurrentlyOff && hadDowntime) {
                deviceInfo.lastDowntime = {
                    from: lastDowntime.start.format('YYYY-MM-DD HH:mm:ss'),
                    to: lastDowntime.end.format('YYYY-MM-DD HH:mm:ss'),
                    durationMinutes: Math.round(lastDowntime.durationMs / 60000)
                }
            }

            if (isCurrentlyOff || hadDowntime) {
                offDevices.push(deviceInfo)
            }
        }

        res.json({ spotStatus: Object.fromEntries(spotStatus), offDevices })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}
