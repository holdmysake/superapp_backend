import moment from "moment-timezone"
import defineUserDataModel from "../../models/pressure.model.js"
import Trunkline from "../../models/trunkline.model.js"
import Spot from "../../models/spot.model.js"
import { Op } from "sequelize"

export const getOffDevice = async (req, res) => {
    try {
        const { field_id } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const now = moment.tz('Asia/Jakarta')
        const startOfDay = now.clone().startOf('day')
        const endOfDay = now.clone().endOf('day')

        // Step 1: Ambil semua trunkline dari field
        const trunklines = await Trunkline.findAll({
            where: { field_id },
            attributes: ['tline_id']
        })
        const tlineIds = trunklines.map(t => t.tline_id)

        // Step 2: Ambil semua spot dari trunkline
        const spots = await Spot.findAll({
            where: { tline_id: tlineIds },
            attributes: ['spot_id']
        })
        const spotIds = spots.map(s => s.spot_id)

        if (spotIds.length === 0) {
            return res.status(404).json({ message: 'No spot found for this field' })
        }

        // Step 3: Ambil semua data hari ini
        const todayPressures = await Pressure.findAll({
            where: {
                spot_id: spotIds,
                timestamp: {
                    [Op.gte]: startOfDay.toDate(),
                    [Op.lte]: endOfDay.toDate()
                }
            },
            attributes: ['spot_id', 'timestamp'],
            order: [['spot_id', 'ASC'], ['timestamp', 'ASC']]
        })

        // Kelompokkan per spot
        const grouped = new Map()
        for (const entry of todayPressures) {
            const id = entry.spot_id
            const ts = moment.tz(entry.timestamp, 'Asia/Jakarta')
            if (!grouped.has(id)) grouped.set(id, [])
            grouped.get(id).push(ts)
        }

        const results = []

        for (const spot_id of spotIds) {
            const timestamps = grouped.get(spot_id) || []
            const offPeriods = []
            let lastSeen = null

            if (timestamps.length === 0) {
                // Ambil data terakhir jika tidak ada data hari ini
                const lastData = await Pressure.findOne({
                    where: { spot_id },
                    attributes: ['timestamp'],
                    order: [['timestamp', 'DESC']]
                })

                if (!lastData) {
                    results.push({
                        spot_id,
                        status: 'no-data-ever',
                        message: 'No data found for this spot at all'
                    })
                    continue
                }

                const lastSeenMoment = moment.tz(lastData.timestamp, 'Asia/Jakarta')
                results.push({
                    spot_id,
                    status: 'off',
                    lastSeen: lastSeenMoment.format("YYYY-MM-DD HH:mm:ss"),
                    message: 'No data today',
                    offSince: lastSeenMoment.format("YYYY-MM-DD HH:mm:ss")
                })
                continue
            }

            // Periksa gap antar timestamp
            for (let i = 1; i < timestamps.length; i++) {
                const diff = timestamps[i].diff(timestamps[i - 1], 'minutes')
                if (diff > 5) {
                    offPeriods.push({
                        from: timestamps[i - 1].toISOString(),
                        to: timestamps[i].toISOString(),
                        durationMinutes: diff
                    })
                }
            }

            const lastTimestamp = timestamps[timestamps.length - 1]
            lastSeen = lastTimestamp

            const gapSinceLast = now.diff(lastTimestamp, 'minutes')

            console.log({
                spot_id,
                lastTimestamp: lastTimestamp.toISOString(),
                now: now.toISOString(),
                gapSinceLast
            })

            if (gapSinceLast > 5) {
                offPeriods.push({
                    from: lastTimestamp.toISOString(),
                    // to: now.toISOString(),
                    to: "now",
                    durationMinutes: gapSinceLast,
                    stillOff: true
                })
            }

            let status = 'on'
            let offSince = null

            if (offPeriods.length > 0) {
                const lastOff = offPeriods.find(p => p.stillOff)
                if (lastOff) {
                    status = 'off'
                    offSince = lastOff.from
                } else {
                    status = 'had-off'
                }
            }

            results.push({
                spot_id,
                status,
                lastSeen: lastSeen.format("YYYY-MM-DD HH:mm:ss"),
                offPeriods: offPeriods.map(p => ({
                    from: moment.tz(p.from, 'Asia/Jakarta').format("YYYY-MM-DD HH:mm:ss"),
                    to: moment.tz(p.to, 'Asia/Jakarta').format("YYYY-MM-DD HH:mm:ss"),
                    durationMinutes: p.durationMinutes,
                    ...(p.stillOff && { stillOff: true })
                }))
            })
        }

        console.log({
            field_id,
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString(),
            now: now.toISOString()
        })

        res.json(results)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}