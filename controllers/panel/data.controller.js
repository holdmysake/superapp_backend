import { Parser } from 'json2csv'
import { Op } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"
import Spot from '../../models/spot.model.js';

// export const downloadDataCSV = async (req, res) => {
//     try {
//         const { field_id, spot_id, timestamp } = req.body

//         const tableName = `pressure_${field_id}`
//         const Pressure = defineUserDataModel(tableName)

//         const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD')
//                             .startOf('day')
//                             .toDate()
//         const endOfDay   = moment(startOfDay)
//                             .add(1, 'day')
//                             .toDate()

//         const pressureData = await Pressure.findAll({
//             where: {
//                 spot_id,
//                 timestamp: {
//                     [Op.gte]: startOfDay,
//                     [Op.lt]: endOfDay
//                 }
//             },
//             attributes: ['timestamp','psi'],
//             order: [['timestamp','ASC']]
//         })

//         const csvData = pressureData.map(entry => {
//             const ts = moment(entry.timestamp)
//             return {
//                 date: ts.format('YYYY-MM-DD'),
//                 time: ts.format('HH-mm-ss'),
//                 psi: entry.psi
//             }
//         })

//         const fields = ['field_id', 'date', 'time', 'psi']
//         const parser = new Parser({ fields })
//         const csv = parser.parse(csvData)

//         const fileName = `pressure_${field_id}_${moment(timestamp).format('DD_MM_YYYY')}.csv`
        
//         res.header('Content-Type', 'text/csv')
//         res.attachment(fileName)
//         res.send(csv)
//     } catch (error) {
//         console.error(error)
//         res.status(500).json({ message: error.message })
//     }
// }

// export const downloadDataCSV = async (req, res) => {
//     try {
//         const { field_id, tline_id, timestamp } = req.body

//         const tableName = `pressure_${field_id}`
//         const Pressure = defineUserDataModel(tableName)

//         const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD').startOf('day').toDate()
//         const endOfDay = moment(startOfDay).add(1, 'day').toDate()

//         const spots = await Spot.findAll({
//             where: { tline_id },
//             attributes: ['spot_id']
//         })

//         const spotIds = spots.map(spot => spot.spot_id)

//         const pressureData = await Pressure.findAll({
//             where: {
//                 spot_id: spotIds,
//                 timestamp: {
//                     [Op.gte]: startOfDay,
//                     [Op.lt]: endOfDay
//                 }
//             },
//             attributes: ['spot_id', 'timestamp', 'psi'],
//             order: [['timestamp', 'ASC']]
//         })

//         const csvData = pressureData.map(entry => {
//             const ts = moment(entry.timestamp)
//             return {
//                 spot_id: entry.spot_id,
//                 date: ts.format('YYYY-MM-DD'),
//                 time: ts.format('HH-mm-ss'),
//                 psi: entry.psi
//             }
//         })

//         const fields = ['spot_id', 'date', 'time', 'psi']
//         const parser = new Parser({ fields })
//         const csv = parser.parse(csvData)

//         const fileName = `pressure_${field_id}_${moment(timestamp).format('DD_MM_YYYY')}.csv`

//         res.header('Content-Type', 'text/csv')
//         res.attachment(fileName)
//         res.send(csv)
//     } catch (error) {
//         console.error(error)
//         res.status(500).json({ message: error.message })
//     }
// }

export const downloadDataCSV = async (req, res) => {
    try {
        const { field_id, tline_id, timestamp } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD').startOf('day').toDate()
        const endOfDay = moment(startOfDay).add(1, 'day').toDate()

        const spots = await Spot.findAll({
            where: { tline_id },
            attributes: ['spot_id']
        })
        const spotIds = spots.map(s => s.spot_id)

        const pressureData = await Pressure.findAll({
            where: {
                spot_id: spotIds,
                timestamp: {
                    [Op.gte]: startOfDay,
                    [Op.lt]: endOfDay
                }
            },
            attributes: ['spot_id', 'timestamp', 'psi'],
            order: [['timestamp', 'ASC']]
        })

        const dataMap = new Map()
        const spotSet = new Set()

        for (const entry of pressureData) {
            const ts = moment(entry.timestamp)
            const time = ts.format('HH-mm-ss')
            const date = ts.format('YYYY-MM-DD')
            const key = `${time}|${date}`

            if (!dataMap.has(key)) {
                dataMap.set(key, { time, date })
            }

            const row = dataMap.get(key)
            row[entry.spot_id] = entry.psi

            spotSet.add(entry.spot_id)
        }

        const sortedSpotIds = Array.from(spotSet).sort((a, b) => a - b)
        const fields = ['date', 'time', ...sortedSpotIds.map(id => `spot_${id}`)]

        const finalRows = Array.from(dataMap.values())
        const parser = new Parser({ fields })
        const csv = parser.parse(finalRows)

        const fileName = `pressure_${tline_id}_${moment(timestamp).format('DD_MM_YYYY')}.csv`
        res.header('Content-Type', 'text/csv')
        res.attachment(fileName)
        res.send(csv)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}