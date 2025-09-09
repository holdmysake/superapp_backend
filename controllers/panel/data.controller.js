import { Parser } from 'json2csv'
import ExcelJS from 'exceljs'
import archiver from 'archiver'
import { Op } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"
import Spot from '../../models/spot.model.js';

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

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day')
        const endOfDay = moment(startOfDay).add(1, 'day')

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

        const datePart = moment(timestamp).format('DD_MM_YYYY')
        const baseFileName = `pressure_${field_id}_${datePart}`

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