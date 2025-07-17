import moment from "moment-timezone"
import defineUserDataModel from "../../models/pressure.model.js"

export const getOffDevice = async (req, res) => {
    try {
        const { field_id } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const allData = await Pressure.findAll({
            attributes: ['spot_id', 'timestamp'],
            order: [['spot_id', 'ASC'], ['timestamp', 'ASC']]
        })

        if (allData.length === 0) {
            res.status(404).json({ message: 'No data found for this field' })
        }

        const now = moment()
        const gapThreshold = 5 * 60 * 1000

        const spotStatus = new Map()

        for (const { spot_id, timestamp } of allData) {
            const ts = moment(timestamp)

            if (!spotStatus.has(spot_id)) {
                spotStatus.set(spot_id, {
                    lastTimestamp: ts,
                    hasGap: false
                })
                continue
            }

            const status = spotStatus.get(spot_id)
            const diff = ts.diff(status)

            if (diff > gapThreshold) {
                status.hasGap = true
            }

            status.lastTimestamp = ts
            spotStatus.set(spot_id, status.lastTimestamp)
        }

        const offDevices = []

        for (const [spot_id, status] of spotStatus.entries()) {
            const diffNow = now.diff(status.lastTimestamp)

            if (diffNow > gapThreshold || status.hasGap) {
                offDevices.push({
                    spot_id,
                    lastSeen: status.lastTimestamp.format('YYYY-MM-DD hh:mm:ss'),
                    isCurrentlyOff: diffNow > gapThreshold,
                    hadDowntime: status.hasGap
                })
            }
        }

        res.json({ offDevices })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}