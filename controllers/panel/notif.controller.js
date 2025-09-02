import moment from "moment-timezone"
import defineUserDataModel from "../../models/pressure.model.js"
import Trunkline from "../../models/trunkline.model.js"
import Spot from "../../models/spot.model.js"
import { Op } from "sequelize"
import PredValue from "../../models/pred_value.model.js"
import SpotStatus from "../../models/spot_status.js"
import WAGroup from "../../models/wa_group.js"
import { sendWaText } from "../../bot/bot.js"
import { getIO } from "../../socket.js"
moment.locale('id')

export const checkDeviceOff = async () => {
    try {
        // const spots = await Field.findAll({
        //     include: {
        //         model: Trunkline,
        //         as: 'trunklines',
        //         include: [
        //             {
        //                 model: PredValue,
        //                 as: 'pred_value',
        //                 include: {
        //                     model: Spot,
        //                     as: 'spot',
        //                     attributes: ['spot_id', 'spot_name']
        //                 }
        //             },
        //             {
        //                 model: Spot,
        //                 as: 'spots',
        //                 separate: true,
        //                 order: [['sort', 'ASC']]
        //             }
        //         ]
        //     }
        // })

        // console.log("Checking device off...")
    } catch (error) {
        console.error(error)
    }
}

export const getOffDevice = async (req, res) => {
    try {
        const { field_id } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const now = moment.tz('Asia/Jakarta')
        const startOfDay = now.clone().startOf('day')
        const endOfDay = now.clone().endOf('day')

        const trunklines = await Trunkline.findAll({
            where: { field_id },
            attributes: ['tline_id']
        })
        const tlineIds = trunklines.map(t => t.tline_id)

        const spots = await Spot.findAll({
            where: { tline_id: tlineIds },
            attributes: ['spot_id']
        })
        const spotIds = spots.map(s => s.spot_id)

        if (spotIds.length === 0) {
            return res.status(404).json({ message: 'No spot found for this field' })
        }

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
                    to: now.toISOString(),
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

const sendNotif = async (type, message, field_id) => {
    const waGroup = await WAGroup.findAll({
        where: {
            field_id: field_id,
            type: type
        }
    })

    for (const wg of waGroup) {
        return await sendWaText(field_id, getIO(), {
            to: wg.target,
            text: message
        })
    }
}

export const onoffNotif = async (data) => {
	try {
		const pred = await PredValue.findOne({ 
            where: { 
                spot_id: data.spot_id,
                shut_pred: false
            }
        })
		if (!pred) return null

		const lastState = await SpotStatus.findOne({
			where: { 
                spot_id: data.spot_id,
                type: 'pump'
            },
			order: [['timestamp', 'DESC']]
		})

		if (lastState?.type === 'pump') {
			if (lastState.status === 'on' && Number(data.psi) >= Number(pred.on_value)) {
				return null
			}
			if (lastState.status === 'off' && Number(data.psi) <= Number(pred.off_value)) {
				return null
			}
		}

		const Pressure = defineUserDataModel(`pressure_${data.field_id}`)
		const samples = await Pressure.findAll({
			where: { spot_id: data.spot_id },
			order: [['timestamp', 'DESC']],
			limit: 5
		})
		if (samples.length < 5) return null

		const onValue = Number(pred.on_value)
		const offValue = Number(pred.off_value)

		const allOn  = samples.every(r => Number(r.psi) >= onValue)
		const allOff = samples.every(r => Number(r.psi) <= offValue)
		const desired = allOn ? 'on' : allOff ? 'off' : null
		if (!desired) return null

		if (!lastState || (lastState.type === 'pump' && lastState.status !== desired)) {
			await SpotStatus.create({
				spot_id: data.spot_id,
                field_id: data.field_id,
				type: 'pump',
				status: desired,
				timestamp: data.timestamp
			})
		}

        const spot = await Spot.findOne({
            where: {
                spot_id: data.spot_id
            },
            include: {
                model: Trunkline,
                as: 'trunkline',
                attributes: ['tline_name']
            }
        })

        const message = desired === 'on' ?
        `🟢 _${spot.trunkline.tline_name}_
      *START POMPA*` : `🔴 _${spot.trunkline.tline_name}_
      *STOP POMPA*`

        const rekap = await rekapOnOff(data)

        sendNotif('info', message, data.field_id)
        sendNotif('info', rekap, data.field_id)

		return null
	} catch (error) {
		console.error('onoffNotif error:', error)
		return error
	}
}

const rekapOnOff = async (data) => {
    try {
        const field_id = data.field_id
        const timestamp = moment(data.timestamp)
        const today = timestamp.clone().startOf('day')

        const tlines = await Trunkline.findAll({
            where: {
                field_id
            },
            attributes: ['tline_id', 'tline_name'],
            include: {
                model: PredValue,
                as: 'pred_value',
                attributes: ['spot_id'],
                include: {
                    model: Spot,
                    as: 'spot',
                    attributes: ['spot_id', 'spot_name']
                }
            }
        })

        const spotIds = tlines.flatMap(t => t.pred_value ? [t.pred_value.spot_id] : [])
        const stts = await SpotStatus.findAll({
            where: {
                spot_id: spotIds,
                type: 'pump',
                timestamp: {
                    [Op.gte]: today
                }
            },
            attributes: ['status', 'timestamp', 'spot_id']
        })

        const grouped = tlines.reduce((acc, t) => {
            if (t.pred_value && t.pred_value.spot) {
                const { spot_id } = t.pred_value.spot
                acc[spot_id] = {
                    tline_name: t.tline_name,
                    status: stts.filter(s => s.spot_id === spot_id)
                }
            }
            return acc
        }, {})

        let summary = `*Rekap On/Off Pompa*\n`
        summary += `${timestamp.format("dddd, DD MMMM YYYY")}, Jam ${timestamp.format("hh:mm")}\n`
        const summaryOn = {}
        const summaryOff = {}

        const countOn = {}
        const countOff = {}
        const durOn = {}
        const durOff = {}

        for (const [spotId, g] of Object.entries(grouped)) {
            summary += `\n*${g.tline_name}*\n`
            summaryOn[spotId] = summaryOn[spotId] || ""
            summaryOff[spotId] = summaryOff[spotId] || ""

            if (g.status.length > 0) {
                for (const [i, s] of g.status.entries()) {
                    if (i === 0 && s.status === 'off') {
                        const prev = await SpotStatus.findOne({
                            where: {
                                field_id,
                                type: 'pump',
                                spot_id: s.spot_id,
                                timestamp: { [Op.lt]: today }
                            },
                            attributes: ['status', 'timestamp', 'spot_id'],
                            order: [['timestamp', 'DESC']]
                        })
        
                        if (prev) {
                            g.status.unshift(prev)
                        }
                    }

                    if (s.status === 'on') {
                        countOn[spotId] = (countOn[spotId] || 0) + 1
                    
                        const onMoment = moment(s.timestamp)
                        const offMoment = g.status[i + 1] 
                            ? moment(g.status[i + 1].timestamp) 
                            : moment.tz('Asia/Jakarta')
                    
                        const onStr = onMoment.format("HH:mm")
                        const offStr = g.status[i + 1] ? offMoment.format("HH:mm") : "now"
                    
                        const dur = moment.duration(offMoment.diff(onMoment))
                        durOn[spotId] = (durOn[spotId] || moment.duration()).add(dur)
                    
                        summaryOn[spotId] += `(${countOn[spotId]}) On: ${onStr} - ${offStr}\n`
                    } else {
                        countOff[spotId] = (countOff[spotId] || 0) + 1
                        if (countOff[spotId] === 1) summaryOff[spotId] += "\n"

                        const offMoment = moment(s.timestamp)
                        const onMoment = g.status[i + 1] 
                            ? moment(g.status[i + 1].timestamp) 
                            : moment.tz('Asia/Jakarta')

                        const offStr = offMoment.format("HH:mm")
                        const onStr = g.status[i + 1] ? onMoment.format("HH:mm") : "now"

                        const dur = moment.duration(onMoment.diff(offMoment))
                        durOff[spotId] = (durOff[spotId] || moment.duration()).add(dur)

                        summaryOff[spotId] += `(${countOff[spotId]}) Off: ${offStr} - ${onStr}\n`
                    }
                }
            }

            summary += `On ${countOn[spotId] || 0}x, Off ${countOff[spotId] | 0}x\n`
            summary += `${summaryOn[spotId]}\nTotal On ${durOn[spotId] ? `${String(Math.floor(durOn[spotId].asHours())).padStart(2, '0')} jam ${String(durOn[spotId].minutes()).padStart(2, '0')} menit` : '00 jam 00 menit'}\n`
            summary += `${summaryOff[spotId]}\nTotal Off ${durOff[spotId] ? `${String(Math.floor(durOff[spotId].asHours())).padStart(2, '0')} jam ${String(durOff[spotId].minutes()).padStart(2, '0')} menit` : '00 jam 00 menit'}\n`
        }

        return summary
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const offDevice = async () => {
    try {

    } catch (error) {
        console.error(error)
        return error
    }
}