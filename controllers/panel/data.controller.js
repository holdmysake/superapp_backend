import { Parser } from 'json2csv'
import ExcelJS from 'exceljs'
import archiver from 'archiver'
import { Op, QueryTypes } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"
import Spot from '../../models/spot.model.js'
import fastcsv from 'fast-csv'
import sequelize from '../../config/db.js'

export const getDataBySpot = async (req, res) => {
    try {
        const { field_id, spot_id, timestamp } = req.body

        const pressureTableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(pressureTableName)

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD', 'Asia/Jakarta')
                            .startOf('day')
        const endOfDay   = moment(startOfDay)
                            .add(1, 'day')

        const data = await Pressure.findAll({
            where: {
                spot_id,
                timestamp: {
                    [Op.gte]: startOfDay,
                    [Op.lt]: endOfDay
                }
            },
            order: [['timestamp', 'ASC']]
        })

        res.json(data)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getAllSpots = async (req, res) => {
    try {
        const { field_id } = req.body

        const spots = await Field.findOne({
            where: {
                field_id
            },
            include: {
                model: Trunkline,
                as: 'trunklines',
                include: [
                    {
                        model: PredValue,
                        as: 'pred_value',
                        include: {
                            model: Spot,
                            as: 'spot',
                            attributes: ['spot_id', 'spot_name']
                        }
                    },
                    {
                        model: Spot,
                        where: {
                            is_seen: true
                        },
                        as: 'spots',
                        separate: true,
                        order: [['sort', 'ASC']]
                    }
                ]
            }
        })

        res.json(spots)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const downloadDataCSV = async (req, res) => {
    try {
        const { field_id, tline_id, timestamp } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
        const endOfDay = moment(startOfDay).add(1, 'day')

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

        if (pressureData.length === 0) {
            return res.status(404).json({ message: 'Data not found' })
        }

        const dataMap = new Map()
        const spotSet = new Set()

        for (const entry of pressureData) {
            const ts = moment(entry.timestamp)
            const time = ts.format('HH-mm-ss')
            const date = ts.format('YYYY-MM-DD')
            const key = `${time}|${date}`

            if (!dataMap.has(key)) {
                dataMap.set(key, { date, time })
            }

            const row = dataMap.get(key)
            row[entry.spot_id] = entry.psi

            spotSet.add(entry.spot_id)
        }

        const sortedSpotIds = Array.from(spotSet).sort((a, b) => a - b)
        const headers = ['date', 'time', ...sortedSpotIds]
        const rows = Array.from(dataMap.values())

        const datePart = moment(timestamp).format('DD_MM_YYYY')
        const baseFileName = `pressure_${tline_id}_${datePart}`

        const parser = new Parser({ fields: headers })
        const csv = parser.parse(rows)

        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Pressure Data')
        worksheet.columns = headers.map(h => ({ header: h, key: h }))
        rows.forEach(row => worksheet.addRow(row))
        const excelBuffer = await workbook.xlsx.writeBuffer()

        const zipName = `${baseFileName}.zip`
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename=${zipName}`)

        const archive = archiver('zip')
        archive.pipe(res)

        archive.append(csv, { name: `${baseFileName}.csv` })
        archive.append(excelBuffer, { name: `${baseFileName}.xlsx` })

        await archive.finalize()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const downloadDataCSVMulti = async (req, res) => {
    try {
        const { field_id, tline_id = [], timestamp } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        let startOfDay, endOfDay
        if (Array.isArray(timestamp) && timestamp.length === 2) {
			startOfDay = moment.tz(timestamp[0], 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
			endOfDay = moment.tz(timestamp[1], 'YYYY-MM-DD', 'Asia/Jakarta').endOf('day')
		} else {
			startOfDay = moment.tz(timestamp, 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
			endOfDay = moment(startOfDay).add(1, 'day')
		}

        const tlineArray = Array.isArray(tline_id) ? tline_id : [tline_id]

        const spots = await Spot.findAll({
            where: { tline_id: tlineArray },
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

        if (pressureData.length === 0) {
            return res.status(404).json({ message: 'Data not found' })
        }

        const dataMap = new Map()
        const spotSet = new Set()

        for (const entry of pressureData) {
            const ts = moment(entry.timestamp)
            const time = ts.format('HH-mm-ss')
            const date = ts.format('YYYY-MM-DD')
            const key = `${time}|${date}`

            if (!dataMap.has(key)) {
                dataMap.set(key, { date, time })
            }

            const row = dataMap.get(key)
            row[entry.spot_id] = entry.psi

            spotSet.add(entry.spot_id)
        }

        const sortedSpotIds = Array.from(spotSet).sort((a, b) => a - b)
        const headers = ['date', 'time', ...sortedSpotIds]
        const rows = Array.from(dataMap.values())

        const dateStart = moment(startOfDay).format('DD_MM_YYYY')
        const dateEnd = moment(endOfDay).format('DD_MM_YYYY')
        const baseFileName = `pressure_${field_id}_${dateStart}_to_${dateEnd}`

        const parser = new Parser({ fields: headers })
        const csv = parser.parse(rows)

        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Pressure Data')
        worksheet.columns = headers.map(h => ({ header: h, key: h }))
        rows.forEach(row => worksheet.addRow(row))
        const excelBuffer = await workbook.xlsx.writeBuffer()

        const zipName = `${baseFileName}.zip`
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename=${zipName}`)

        const archive = archiver('zip')
        archive.pipe(res)

        archive.append(csv, { name: `${baseFileName}.csv` })
        archive.append(excelBuffer, { name: `${baseFileName}.xlsx` })

        await archive.finalize()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const downloadDataCSVMultiFaster = async (req, res) => {
    try {
        const { field_id, tline_id = [], timestamp } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        let startOfDay, endOfDay
        if (Array.isArray(timestamp) && timestamp.length === 2) {
			startOfDay = moment.tz(timestamp[0], 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
			endOfDay = moment.tz(timestamp[1], 'YYYY-MM-DD', 'Asia/Jakarta').endOf('day')
		} else {
			startOfDay = moment.tz(timestamp, 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
			endOfDay = moment(startOfDay).add(1, 'day')
		}

        const tlineArray = Array.isArray(tline_id) ? tline_id : [tline_id]

        const spots = await Spot.findAll({
            where: { tline_id: tlineArray },
            attributes: ['spot_id']
        })
        const spotIds = spots.map(s => s.spot_id)

        const query = `
            SELECT spot_id, timestamp, psi
            FROM ${tableName}
            WHERE spot_id IN(:spotIds)
                AND timestamp BETWEEN :start AND :end
            ORDER BY timestamp ASC
        `
        const pressureData = await sequelize.query(query, {
            replacements: {
                spotIds,
                start: startOfDay.format('YYYY-MM-DD HH:mm:ss'),
                end: endOfDay.format('YYYY-MM-DD HH:mm:ss')
            },
            type: QueryTypes.SELECT,
            raw: true,
            logging: false
        })

        if (pressureData.length === 0) {
            return res.status(404).json({ message: 'Data not found' })
        }

        const dataMap = new Map()
        const spotSet = new Set()

        for (const entry of pressureData) {
            const ts = moment(entry.timestamp)
            const time = ts.format('HH-mm-ss')
            const date = ts.format('YYYY-MM-DD')
            const key = `${time}|${date}`

            if (!dataMap.has(key)) {
                dataMap.set(key, { date, time })
            }

            const row = dataMap.get(key)
            row[entry.spot_id] = entry.psi

            spotSet.add(entry.spot_id)
        }

        const sortedSpotIds = Array.from(spotSet).sort((a, b) => a - b)
        const headers = ['date', 'time', ...sortedSpotIds]
        const rows = Array.from(dataMap.values())

        const dateStart = moment(startOfDay).format('DD_MM_YYYY')
        const dateEnd = moment(endOfDay).format('DD_MM_YYYY')
        const baseFileName = `pressure_${field_id}_${dateStart}_to_${dateEnd}`

        const parser = new Parser({ fields: headers })
        const csv = parser.parse(rows)

        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Pressure Data')
        worksheet.columns = headers.map(h => ({ header: h, key: h }))
        rows.forEach(row => worksheet.addRow(row))
        const excelBuffer = await workbook.xlsx.writeBuffer()

        const zipName = `${baseFileName}.zip`
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename=${zipName}`)

        const archive = archiver('zip')
        archive.pipe(res)

        archive.append(csv, { name: `${baseFileName}.csv` })
        archive.append(excelBuffer, { name: `${baseFileName}.xlsx` })

        await archive.finalize()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const downloadDataCSVStream = async (req, res) => {
    try {
        const { field_id, tline_id = [], timestamp } = req.body
        const tableName = `pressure_${field_id}`

        let startOfDay, endOfDay
        if (Array.isArray(timestamp) && timestamp.length === 2) {
            startOfDay = moment.tz(timestamp[0], "YYYY-MM-DD", "Asia/Jakarta").startOf("day")
            endOfDay   = moment.tz(timestamp[1], "YYYY-MM-DD", "Asia/Jakarta").endOf("day")
        } else {
            startOfDay = moment.tz(timestamp, "YYYY-MM-DD", "Asia/Jakarta").startOf("day")
            endOfDay   = moment(startOfDay).endOf("day")
        }

        const tlineArray = Array.isArray(tline_id) ? tline_id : [tline_id]

        // ambil spot_id
        const spots = await Spot.findAll({
            where: { tline_id: tlineArray },
            attributes: ["spot_id"]
        })
        const spotIds = spots.map(s => s.spot_id)

        if (spotIds.length === 0) {
            return res.status(404).json({ message: "No spots found" })
        }

        const query = `
            SELECT spot_id, timestamp, psi
            FROM ${tableName}
            WHERE spot_id IN(:spotIds)
                AND timestamp BETWEEN :start AND :end
            ORDER BY timestamp ASC
        `

        const dateStart = startOfDay.format("DD_MM_YYYY")
        const dateEnd   = endOfDay.format("DD_MM_YYYY")
        const baseName  = `pressure_${field_id}_${dateStart}_to_${dateEnd}`

        res.setHeader("Content-Type", "application/zip")
        res.setHeader("Content-Disposition", `attachment; filename=${baseName}.zip`)

        const archive = archiver("zip")
        archive.pipe(res)

        // bikin stream CSV
        const csvStream = fastcsv.format({ headers: true })
        archive.append(csvStream, { name: `${baseName}.csv` })

        // query data
        const result = await sequelize.query(query, {
            replacements: {
                spotIds,
                start: startOfDay.format("YYYY-MM-DD HH:mm:ss"),
                end: endOfDay.format("YYYY-MM-DD HH:mm:ss")
            },
            type: QueryTypes.SELECT,
            raw: true,
            logging: false
        })

        for (const row of result) {
            const ts = moment(row.timestamp)
            csvStream.write({
                date: ts.format("YYYY-MM-DD"),
                time: ts.format("HH:mm:ss"),
                spot_id: row.spot_id,
                psi: row.psi
            })
        }

        csvStream.end()
        await archive.finalize()
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}