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
				type: 'pump',
				status: desired,
				timestamp: data.timestamp
			})
		}

        const waGroup = await WAGroup.findAll({
            where: {
                field_id: data.field_id,
                type: 'info'
            }
        })

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

        for (const wg of waGroup) {
            const message = desired === 'on' ?
            `🟢 _${spot.trunkline.tline_name}_
      *START POMPA*` : `🔴 _${spot.trunkline.tline_name}_
      *STOP POMPA*`

            return await sendWaText(data.field_id, getIO(), {
                to: wg.target,
                text: message
            })
        }

		return null
	} catch (error) {
		console.error('onoffNotif error:', error)
		return error
	}
}

export const rekapOnOff = async (req, res) => {
    try {
        const { field_id } = req.body

        const today = moment.tz('Asia/Jakarta').startOf('day')
        const rows = await SpotStatus.findAll({
            where: {
                field_id,
                type: 'pump',
                timestamp: {
                    [Op.gte]: today
                }
            }
        })

        const grouped = {}
        for (const r of rows) {
            (grouped[r.spot_id] ??= []).push(r)
        }

        const needPrev = Object.entries(grouped)
            .filter(([, items]) => items.length && items[0].status === 'off')
            .map(([spot_id]) => spot_id)

        if (needPrev.length) {
            const prevs = await Promise.all(
                needPrev.map(async (spot_id) => {
                    const prev = await SpotStatus.findOne({
                        where: {
                            field_id,
                            type: 'pump',
                            spot_id,
                            timestamp: { [Op.lt]: today }
                        },
                        order: [['timestamp', 'DESC']]
                    })
                    return { spot_id, prev }
                })
            )
            
            for (const { spot_id, prev } of prevs) {
                if (prev) grouped[spot_id].unshift(prev)
            }
        }

        const fmtHM = (d) => moment(d).tz(tz).format('HH:mm')
		const toMinutes = (ms) => ms / 60000
		const fmtDurId = (mins) => {
			const m = Math.round(mins) // pembulatan ke menit terdekat
			const h = Math.floor(m / 60)
			const mm = m % 60
			return `${String(h).padStart(2, '0')} jam ${String(mm).padStart(2, '0')} menit`
		}

        const result = Object.fromEntries(
			Object.entries(grouped).map(([spot_id, items]) => {
				items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

				const on_count = items.filter(r => r.timestamp >= todayStart && r.status === 'on').length
				const off_count = items.filter(r => r.timestamp >= todayStart && r.status === 'off').length

				let currentOnStart = null
				const intervals = []

				for (let i = 0; i < items.length; i++) {
					const ev = items[i]
					const t = new Date(ev.timestamp)

					if (ev.status === 'on') {
						if (!currentOnStart) {
							currentOnStart = t < todayStart ? todayStart : t
						}
					} else if (ev.status === 'off') {
						if (currentOnStart) {
							const end = t
							if (end > todayStart) {
								const startClamped = currentOnStart
								const endClamped = end
								const minutes = toMinutes(endClamped - startClamped)
								if (minutes > 0) {
									intervals.push({
										start: fmtHM(startClamped),
										end: fmtHM(endClamped),
										minutes: Number(minutes.toFixed(2))
									})
								}
							}
							currentOnStart = null
						}
					}
				}

				if (currentOnStart) {
					const end = now
					const minutes = toMinutes(end - currentOnStart)
					if (minutes > 0) {
						intervals.push({
							start: fmtHM(currentOnStart),
							end: fmtHM(end),
							minutes: Number(minutes.toFixed(2))
						})
					}
				}

				const totalOnMinutes = intervals.reduce((a, b) => a + b.minutes, 0)
				const totalOnLabel = fmtDurId(totalOnMinutes)

				const lines = [
					`On ${on_count}x, Off ${off_count}x`,
					...intervals.map((it, idx) =>
						`(${idx + 1}) On: ${it.start} - ${it.end}, ${it.minutes.toFixed(2)}`
					),
					`Total On ${totalOnLabel}`
				]

				return [spot_id, {
					spot_id,
					on_count,
					off_count,
					intervals,
					total_on_minutes: Number(totalOnMinutes.toFixed(2)),
					total_on_label: totalOnLabel,
					summary_lines: lines
				}]
			})
		)

        res.json(grouped)
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