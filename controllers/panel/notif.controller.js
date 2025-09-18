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
import fs from 'fs'
import path from 'path'
import { spawn } from "child_process"
import { create, all } from "mathjs"
import haversine from "haversine-distance"
import { models } from "../../models/index.js"
moment.locale('id')
const math = create(all)

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

        await sendNotif('info', message, data.field_id)
        await sendNotif('info', rekap, data.field_id)

		return null
	} catch (error) {
		console.error('onoffNotif error:', error)
		return error
	}
}

const rekapOnOff = async (data) => {
// export const rekapOnOff = async (req, res) => {
    try {
        const field_id = data.field_id
        const timestamp = moment(data.timestamp)
        // const field_id = req.body.field_id
        // const timestamp = moment(req.body.timestamp)
        const today = timestamp.clone().startOf('day')

        const tlines = await Trunkline.findAll({
            where: {
                field_id
            },
            attributes: ['tline_id', 'tline_name'],
            include: {
                model: PredValue,
                as: 'pred_value',
                attributes: ['spot_id', 'on_value', 'rate_const'],
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
                    on_value: t.pred_value.on_value,
                    rate_const: t.pred_value.rate_const,
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
        const avg = {}

        const Pressure = defineUserDataModel(`pressure_${field_id}`)

        for (const [spotId, g] of Object.entries(grouped)) {
            summary += `\n*${g.tline_name}*\n`
            summaryOn[spotId] = summaryOn[spotId] || ""
            summaryOff[spotId] = summaryOff[spotId] || ""
            avg[spotId] = avg[spotId] || 0

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
                    
                        const durMin = Math.max(0, offMoment.diff(onMoment, 'minutes'))
                        durOn[spotId] = (durOn[spotId] || 0) + durMin

                        const avgPsiRow = await Pressure.findOne({
                            where: {
                                spot_id: spotId,
                                timestamp: {
                                    [Op.gte]: onMoment.toDate(),
                                    [Op.lte]: offMoment.toDate()
                                },
                                psi: {
                                    [Op.gte]: g.on_value
                                }
                            },
                            attributes: [[Pressure.sequelize.fn('AVG', Pressure.sequelize.col('psi')), 'avg_psi']],
                            raw: true
                        })
                        const avgPsi = avgPsiRow && avgPsiRow.avg_psi !== null 
                            ? Number(avgPsiRow.avg_psi).toFixed(2) 
                            : "0.00"

                        avg[spotId] += Number(avgPsi)
                    
                        summaryOn[spotId] += `(${countOn[spotId]}) On: ${onStr} - ${offStr}, ${avgPsi}\n`
                    } else {
                        countOff[spotId] = (countOff[spotId] || 0) + 1
                        if (countOff[spotId] === 1) summaryOff[spotId] += "\n"

                        const offMoment = moment(s.timestamp)
                        const onMoment = g.status[i + 1] 
                            ? moment(g.status[i + 1].timestamp) 
                            : moment.tz('Asia/Jakarta')

                        const offStr = offMoment.format("HH:mm")
                        const onStr = g.status[i + 1] ? onMoment.format("HH:mm") : "now"

                        const durMin = Math.max(0, onMoment.diff(offMoment, 'minutes'))
                        durOff[spotId] = (durOff[spotId] || 0) + durMin

                        summaryOff[spotId] += `(${countOff[spotId]}) Off: ${offStr} - ${onStr}\n`
                    }
                }
            }

            const avgAllNum = countOn[spotId] > 0
                ? Number((avg[spotId] ?? 0) / countOn[spotId])
                : 0
            const avgAll = avgAllNum.toFixed(2)

            const durInHour = durOn[spotId] 
                ? Number((durOn[spotId] / 60).toFixed(2)) 
                : 0
            const rateConst = g.rate_const ?? 0
            const hourVolume = Number((avgAllNum * rateConst).toFixed(2))
            const totVolume = Number((avgAllNum * rateConst * durInHour).toFixed(2))

            summary += `On ${countOn[spotId] || 0}x, Off ${countOff[spotId] | 0}x\n`
            summary += `${summaryOn[spotId]}Total On ${durOn[spotId] ? fmtDuration(durOn[spotId]) : '00 jam 00 menit'}\n`
            summary += `${avgAll} Psi\n`
            summary += `${hourVolume} bph\n`
            summary += `${totVolume} bopd\n`
            summary += `${summaryOff[spotId]}Total Off ${durOff[spotId] ? fmtDuration(durOff[spotId]) : '00 jam 00 menit'}\n`
        }

        return summary
        // res.json(summary)
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

export const leakCheck = async (req, res) => {
    try {
        const { spot_id, field_id, timestamp, psi } = req.body
        const spot = await Spot.findOne({
            where: { spot_id },
            attributes: ['drop_value', 'normal_value', 'tline_id'],
        })

        if (psi < spot.drop_value || psi > spot.normal_value || !spot.drop_value) {
            return res.json({ message: 'Tidak ada kebocoran' })
        }

        const Pressure = defineUserDataModel(`pressure_${field_id}`)
        const alias = `pressures_${field_id}`

        if (!Spot.associations[alias]) {
            Pressure.belongsTo(models.Spot, {
                foreignKey: 'spot_id',
                targetKey: 'spot_id',
                as: `spot_${field_id}`
            })
            models.Spot.hasMany(Pressure, {
                foreignKey: 'spot_id',
                sourceKey: 'spot_id',
                as: alias
            })
        }

        const pred_drop = await PredValue.findOne({
            where: {
                spot_id,
                shut_pred: false
            },
            attributes: ['tline_id', 'spot_id'],
            include: {
                model: Trunkline,
                as: 'trunkline',
                attributes: ['tline_id'],
                include: [{
                    model: Spot,
                    as: 'spots',
                    attributes: ['spot_id', 'normal_value', 'drop_value'],
                    include: [{
                        model: Pressure,
                        as: `pressures_${field_id}`,
                        required: false,
                        attributes: ['psi', 'timestamp'],
                        where: {
                            timestamp: {
                                [Op.between]: [
                                    moment.tz(timestamp, 'Asia/Jakarta').subtract(2, 'minutes'),
                                    moment.tz(timestamp, 'Asia/Jakarta')
                                ]
                            }
                        },
                    }]
                }]
            },
            order: [[{ model: Trunkline, as: 'trunkline' }, { model: Spot, as: 'spots' }, 'sort', 'ASC']]
        })

        const inputs = []

        if (pred_drop && pred_drop.trunkline && pred_drop.trunkline.spots) {
            for (const spot of pred_drop.trunkline.spots) {
                if (spot[alias] && spot[alias].length > 0) {
                    const sum = spot[alias].reduce((acc, p) => acc + (p.psi || 0), 0)
                    const avg = sum / spot[alias].length
                    spot.dataValues.avg_drop = avg
                } else {
                    spot.dataValues.avg_drop = 0
                }
        
                if (
                    (spot.dataValues.avg_drop < spot.drop_value || spot.dataValues.avg_drop > spot.normal_value) && 
                    spot.dataValues.avg_drop != 0
                ) {
                    return res.json({ message: 'Terdapat penurunan pressure, namun tidak terjadi kebocoran' })
                }
        
                const pred_normal = await Pressure.findAll({
                    where: {
                        spot_id: spot.spot_id,
                        psi: { [Op.gte]: spot.normal_value }
                    },
                    attributes: ['psi', 'timestamp'],
                    order: [['timestamp', 'DESC']],
                    limit: 5,
                    raw: true
                })
        
                const sumNormal = pred_normal.reduce((acc, p) => acc + (p.psi || 0), 0)
                spot.dataValues.avg_normal = pred_normal.length > 0 ? sumNormal / pred_normal.length : 0
        
                spot.dataValues.avg_delta =
                    spot.dataValues.avg_drop === 0 || spot.dataValues.avg_normal === 0
                        ? 0
                        : spot.dataValues.avg_normal - spot.dataValues.avg_drop

                inputs.push(spot.dataValues.avg_delta)
                delete spot.dataValues[alias]
            }
        }

        const result = await leak(spot.tline_id, inputs)
        res.json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const leakDetect = async (req, res) => {
    try {
        const { tline_id, inputs, model_type } = req.body
        const result = await leak(tline_id, inputs, model_type)
        res.json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

const leak = (tline_id, inputs, model_type) => {
    return new Promise((resolve, reject) => {
        const pythonBin = process.env.PYTHON_BIN || "python"
        const scriptPath = path.resolve("./predict.py")
        const args = [scriptPath, tline_id, model_type, ...inputs.map(String)]
        const py = spawn(pythonBin, args)

        let data = ""
        py.stdout.on("data", (chunk) => {
            data += chunk.toString()
        })

        py.stderr.on("data", (err) => {
            console.error("Python error:", err.toString())
        })

        py.on("close", async () => {
            try {
                if (data.trim() === "") {
                    return resolve({ message: "No output from Python" })
                }

                const parsed = JSON.parse(data)
                const results = parsed.result
                console.log("Leak detection results:", results)

                const tlineData = await PredValue.findOne({
                    where: { tline_id },
                    attributes: ["tline_id", "tline_length", "pu"],
                    include: {
                        model: Spot,
                        as: "spot",
                        attributes: ["spot_id", "spot_name"]
                    }
                })

                const validResults = results.filter(r => r >= 0 && r <= tlineData.tline_length)

                const geojsonFilePath = path.resolve(`data/maps/${tline_id}.json`)
                let gmapsLinks = []

                if (fs.existsSync(geojsonFilePath)) {
                    const coords = JSON.parse(fs.readFileSync(geojsonFilePath, "utf8"))

                    for (const r of validResults) {
                        let leakCoord = null
                        let gmapsLink = null
                        let dist = 0

                        for (let i = 0; i < coords.length - 1; i++) {
                            const p1 = { latitude: coords[i][1], longitude: coords[i][0] }
                            const p2 = { latitude: coords[i + 1][1], longitude: coords[i + 1][0] }
                            const segLen = haversine(p1, p2) / 1000

                            if (dist + segLen >= r) {
                                const ratio = (r - dist) / segLen
                                const lon = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * ratio
                                const lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * ratio
                                leakCoord = [lon, lat]
                                gmapsLink = `https://www.google.com/maps?q=${lat},${lon}`
                                break
                            }
                            dist += segLen
                        }

                        gmapsLinks.push(gmapsLink)
                    }
                }

                const formula = tlineData.pu.replace(/\s+/g, "")
                const messages = validResults.map((r, idx) => {
                    let finalValue = null
                    try { finalValue = math.evaluate(formula, { y: r }) } catch {}
                    let msg = `Indikasi kebocoran pada titik ${r} KM dari ${tlineData.spot.spot_name}`
                    if (finalValue != null) msg += ` (KM ${finalValue} Jalan PU)`
                    return msg
                })

                return resolve({
                    messages,
                    gmaps: gmapsLinks,
                    results: validResults
                })
            } catch (err) {
                console.error("Error on close:", err)
                reject(err)
            }
        })
    })
}

export const shareReport = async (req, res) => {
    try {
        const { field_id, message } = req.body
        await sendNotif('report', message, field_id)
        res.json({ message: 'Report sent' })
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

const fmtDuration = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')} jam ${String(m).padStart(2, '0')} menit`
}