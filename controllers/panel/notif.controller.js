import moment from "moment-timezone"
import defineUserDataModel from "../../models/pressure.model.js"
import Trunkline from "../../models/trunkline.model.js"
import Spot from "../../models/spot.model.js"
import PredValue from "../../models/pred_value.model.js"
import SpotStatus from "../../models/spot_status.js"

export async function runDeviceHeartbeatScan({ field_id, gapMinutes = 5 }) {
    const now = moment.tz('Asia/Jakarta')

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
    if (spotIds.length === 0) return []

    const Pressure = defineUserDataModel(`pressure_${field_id}`)

    const results = []

    for (const spot_id of spotIds) {
        const lastData = await Pressure.findOne({
            where: { spot_id },
            attributes: ['timestamp'],
            order: [['timestamp', 'DESC']]
        })

        let desired = 'off'
        let eventTs = now.toDate()
        let lastSeenStr = null
        let gapMin = null

        if (lastData) {
            const lastSeen = moment.tz(lastData.timestamp, 'Asia/Jakarta')
            lastSeenStr = lastSeen.format('YYYY-MM-DD HH:mm:ss')
            gapMin = now.diff(lastSeen, 'minutes')

            if (gapMin > gapMinutes) {
                desired = 'off'
                eventTs = lastSeen.clone().add(gapMinutes, 'minutes').toDate()
            } else {
                desired = 'on'
                eventTs = lastSeen.toDate()
            }
        }

        const lastState = await SpotStatus.findOne({
            where: { spot_id, type: 'device' },
            order: [['timestamp', 'DESC']]
        })

        if (!lastState || lastState.status !== desired) {
            await SpotStatus.create({
                spot_id,
                type: 'device',
                status: desired,
                timestamp: eventTs
            })
        }

        results.push({
            spot_id,
            status: desired,
            lastSeen: lastSeenStr,
            gapMinutes: gapMin
        })
    }

    return results
}

export const onoffNotif = async (data) => {
	try {
		const pred = await PredValue.findOne({ where: { spot_id: data.spot_id } })
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
			return await SpotStatus.create({
				spot_id: data.spot_id,
				type: 'pump',
				status: desired,
				timestamp: data.timestamp
			})
		}

		return null
	} catch (err) {
		console.error('onoffNotif error:', err)
		return null
	}
}