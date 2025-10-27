import defineUserDataModel from '../../models/pressure.model.js'
import Field from '../../models/field.model.js'
import Spot from '../../models/spot.model.js'
import Trunkline from '../../models/trunkline.model.js'
import jwt from 'jsonwebtoken'
import User from '../../models/user.model.js'
import PredValue from '../../models/pred_value.model.js'
import { Op, where } from 'sequelize'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { DOMParser } from "xmldom"
import togeojson from '@mapbox/togeojson'
import axios from 'axios'
import https from "https"
import ExcelJS from "exceljs"
import archiver from "archiver"

const JWT_SECRET = process.env.JWT_SECRET

export const storeField = async (req, res) => {
    try {
        const { field_id, field_name } = req.body

        const field = await Field.create({
            field_id,
            field_name
        })

        const tableName = `pressure_${field_id}`
        const UserData = defineUserDataModel(tableName)
        await UserData.sync({ force: false })

        res.json({ field })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateField = async (req, res) => {
    try {
        const { id, field_id, field_name } = req.body

        const field = await Field.findByPk(id)

        await field.update({
            field_id,
            field_name
        })

        res.json({ message: 'Field berhasil diperbarui!' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getField = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await User.findOne({
            where: {
                user_id: decoded.user_id
            }
        })
        const isSA = user.role === 'superadmin'
        let field

        if (isSA) {
            field = await Field.findAll()
        } else {
            field = await Field.findAll({
                where: {
                    field_id: user.field_id
                }
            })
        }        

        res.json({ field })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const deleteField = async (req, res) => {
    try {
        const { field_id } = req.body

        await Field.destroy({
            where: {
                field_id
            }
        })

        const tableName = `pressure_${field_id}`
        const UserData = defineUserDataModel(tableName)

        await UserData.drop()

        res.json({ message: 'Berhasil hapus field' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getTline = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await User.findOne({
            where: {
                user_id: decoded.user_id
            }
        })

        const isSA = user.role === 'superadmin'

        const queryOptions = {
            include: {
                model: Trunkline,
                as: 'trunklines',
                attributes: ['tline_id', 'tline_name']
            }
        }

        if (!isSA) {
            queryOptions.where = { field_id: user.field_id }
        }

        const tlines = await Field.findAll(queryOptions)

        res.json(tlines)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const storeTline = async (req, res) => {
    try {
        const { field_id, tline_id, tline_name } = req.body

        const trunkline = await Trunkline.create({
            field_id,
            tline_id,
            tline_name
        })

        res.json({ message: 'Trunkline berhasil disimpan', trunkline })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const updateTrunkline = async (req, res) => {
    try {
        const { 
            id_pred, tline_id, spot_id, shut_pred, is_linear, tline_length, on_value, off_value, rate_const, pu,
            id_tline, tline_name
        } = req.body

        let pred = await PredValue.findByPk(id_pred)
        const tline = await Trunkline.findByPk(id_tline)

        await tline.update({
            tline_id,
            tline_name
        })

        if (pred) {
            pred = await pred.update({
                tline_id,
                spot_id,
                shut_pred,
                is_linear,
                tline_length,
                on_value,
                off_value,
                rate_const,
                pu
            })
        } else {
            if (spot_id) {
                pred = await PredValue.create({
                    tline_id,
                    spot_id,
                    shut_pred,
                    is_linear,
                    tline_length,
                    on_value,
                    off_value,
                    rate_const,
                    pu
                })
            }
        }

        const spot = await Spot.findOne({ where: { spot_id } })

        res.json({ message: 'Prediksi nilai berhasil diperbarui', spot })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateFilePy = async (req, res) => {
    try {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, path.resolve('data/pred/single'))
            },
            filename: (req, file, cb) => {
                const tlineId = path.parse(file.originalname).name
                cb(null, `${tlineId}.sav`)
            }
        })

        const upload = multer({ storage }).single('model_file')

        upload(req, res, async (error) => {
            if (error) {
                console.error(error)
                res.status(500).json({ message: error.message })
            }
        })

        res.json({
            message: "Model file berhasil diupload / diperbarui",
            file: `${req.body.tline_id}.sav`
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateFilePyMulti = async (req, res) => {
    try {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, path.resolve('data/pred/multi'))
            },
            filename: (req, file, cb) => {
                const tlineId = path.parse(file.originalname).name
                cb(null, `${tlineId}.sav`)
            }
        })

        const upload = multer({ storage }).single('model_file')

        upload(req, res, async (error) => {
            if (error) {
                console.error(error)
                res.status(500).json({ message: error.message })
            }
        })

        res.json({
            message: "Model file berhasil diupload / diperbarui",
            file: `${req.body.tline_id}.sav`
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateFileKmz = async (req, res) => {
	try {
		const upload = multer({ dest: path.resolve("uploads/") }).single("file")

		await new Promise((resolve, reject) => {
			upload(req, res, (err) => {
				if (err) return reject(err)
				resolve(null)
			})
		})

		const { tline_id } = req.body
		if (!tline_id) return res.status(400).json({ message: "tline_id wajib diisi" })
		if (!req.file) return res.status(400).json({ message: "File wajib diupload (field name: 'file')" })

		const filePath = req.file.path
		const ext = path.extname(req.file.originalname).toLowerCase()

		let kmlContent = ""

		if (ext === ".kmz") {
			const zip = new AdmZip(filePath)
			const kmlEntry = zip.getEntries().find(e => e.entryName && e.entryName.endsWith(".kml"))
			if (!kmlEntry) {
				try { fs.unlinkSync(filePath) } catch (_) {}
				return res.status(400).json({ message: "KML tidak ditemukan dalam KMZ" })
			}
			kmlContent = kmlEntry.getData().toString("utf8")
		} else if (ext === ".kml") {
			kmlContent = fs.readFileSync(filePath, "utf8")
		} else {
			try { fs.unlinkSync(filePath) } catch (_) {}
			return res.status(400).json({ message: "File harus KMZ atau KML" })
		}

		const kmlDom = new DOMParser().parseFromString(kmlContent, "text/xml")
		const geojson = togeojson.kml(kmlDom)

		let coords = []
		geojson.features.forEach(f => {
			if (f.geometry && f.geometry.type === "LineString" && Array.isArray(f.geometry.coordinates)) {
				coords.push(...f.geometry.coordinates)
			}
		})

		const seen = new Set()
		const cleaned = []
		for (const c of coords) {
			if (!Array.isArray(c) || c.length < 2) continue
			const lon = Number(c[0])
			const lat = Number(c[1])
			if (Number.isNaN(lon) || Number.isNaN(lat)) continue
			const key = `${lon},${lat}`
			if (seen.has(key)) continue
			seen.add(key)
			cleaned.push([lon, lat])
		}

		const outDir = path.resolve("data/maps")
		if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

		const outputPath = path.join(outDir, `${tline_id}.json`)
		fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2))

		try { fs.unlinkSync(filePath) } catch (_) {}

        await getElevationData(cleaned, tline_id)

		return res.json({
			message: "File map berhasil diupload & diproses",
			file: `${tline_id}.json`,
			totalCoords: cleaned.length
		})
	} catch (error) {
		console.error("updateFileMap error:", error)
		return res.status(500).json({ message: error?.message ?? "Unknown error" })
	}
}

const getElevationData = async (data, tline_id) => {
    try {
		const locations = data.map(d => ({
			latitude: d[1],
			longitude: d[0]
		}))

		const agent = new https.Agent({
			rejectUnauthorized: false,
			keepAlive: true
		})

		const res = await axios.post(
			"https://api.open-elevation.com/api/v1/lookup",
			{ locations },
			{
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json"
				},
				timeout: 15000,
				httpsAgent: agent
			}
		)

		const elevations = res.data.results.map(r => r.elevation)

		const cleaned = data.map((coord, i) => [
			coord[0],
			coord[1],
			elevations[i] ?? null
		])

		const outDir = path.resolve("data/maps")
		if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

		const outputPath = path.join(outDir, `${tline_id}.json`)
		fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2))

		console.log(`✅ Elevation data saved: ${outputPath}`)
	} catch (error) {
        console.error(error)
    }
}

export const getKMZFile = async (req, res) => {
	try {
		const { tline_id } = req.body
		if (!tline_id) return res.status(400).json({ message: "tline_id wajib diisi" })

		const filePath = path.resolve(`data/maps/${tline_id}.json`)
		if (!fs.existsSync(filePath))
			return res.status(404).json({ message: "File data tidak ditemukan" })

		const data = JSON.parse(fs.readFileSync(filePath, "utf8"))

		const workbook = new ExcelJS.Workbook()
		const sheet = workbook.addWorksheet("Elevation Data")
		sheet.columns = [
			{ header: "Latitude", key: "lat", width: 15 },
			{ header: "Longitude", key: "lon", width: 15 },
			{ header: "Altitude (m)", key: "alt", width: 15 }
		]

		data.forEach(([lon, lat, elev]) => {
			sheet.addRow({ lat, lon, alt: elev })
		})

		const excelBuffer = await workbook.xlsx.writeBuffer()

		const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
	<name>${tline_id}</name>
	<Placemark>
		<name>${tline_id}</name>
		<LineString>
			<coordinates>
				${data.map(d => `${d[0]},${d[1]}`).join(" ")}
			</coordinates>
		</LineString>
	</Placemark>
</Document>
</kml>`

		const zipName = `${tline_id}.zip`
		res.setHeader("Content-Type", "application/zip")
		res.setHeader("Content-Disposition", `attachment; filename=${zipName}`)

		const archive = archiver("zip", { zlib: { level: 9 } })
		archive.pipe(res)

		archive.append(fs.createReadStream(filePath), { name: `${tline_id}.json` })

		archive.append(excelBuffer, { name: `${tline_id}.xlsx` })

		archive.append(kmlContent, { name: `${tline_id}.kml` })

		await archive.finalize()
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: error.message })
	}
}

export const deleteTline = async (req, res) => {
    try {
        const { tline_id } = req.body

        await Trunkline.destroy({ where: { tline_id } })

        res.json({ message: 'Trunkline berhasil dihapus' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getAllSpots = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await User.findOne({
            where: {
                user_id: decoded.user_id
            }
        })

        const isSA = user.role === 'superadmin'

        const queryOptions = {
            include: {
                model: Trunkline,
                as: 'trunklines',
                order: [['id', 'DESC']],
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
                        as: 'spots',
                        separate: true,
                        order: [['sort', 'ASC']]
                    }
                ]
            },
            order: [
                [{ model: Trunkline, as: 'trunklines' }, 'id', 'ASC']
            ]
        }

        if (!isSA) {
            queryOptions.where = { field_id: user.field_id }
        }

        const fields = await Field.findAll(queryOptions)

        const result = fields.map(field => {
            const f = field.toJSON()
            f.trunklines = f.trunklines.map(tline => {
                const modelFilePath = path.resolve(`data/pred/single/${tline.tline_id}.sav`)
                const modelMultiFilePath = path.resolve(`data/pred/multi/${tline.tline_id}.sav`)
                const geojsonFilePath = path.resolve(`data/maps/${tline.tline_id}.json`)

                if (tline.pred_value) {
                    tline.pred_value.model_file = fs.existsSync(modelFilePath)
                        ? `${tline.tline_id}.sav`
                        : null

                    tline.pred_value.model_multi_file = fs.existsSync(modelMultiFilePath)
                        ? `${tline.tline_id}.sav`
                        : null

                    tline.pred_value.geojson = fs.existsSync(geojsonFilePath)
                        ? `${tline.tline_id}.json`
                        : null
                }

                return tline || null
            })
            return f
        })

        res.json(result)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getAllSpotsPredict = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]

        const decoded = jwt.verify(token, JWT_SECRET)

        const user = await User.findOne({
            where: {
                user_id: decoded.user_id
            }
        })

        const isSA = user.role === 'superadmin'

        const queryOptions = {
            include: {
                model: Trunkline,
                as: 'trunklines',
                order: [['id', 'DESC']],
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
                        as: 'spots',
                        separate: true,
                        where: { is_seen: true },
                        order: [['sort', 'ASC']]
                    }
                ]
            },
            order: [
                [{ model: Trunkline, as: 'trunklines' }, 'id', 'ASC']
            ]
        }

        if (!isSA) {
            queryOptions.where = { field_id: user.field_id }
        }

        const fields = await Field.findAll(queryOptions)

        const result = fields.map(field => {
            const f = field.toJSON()
            f.trunklines = f.trunklines.map(tline => {
                const modelFilePath = path.resolve(`data/pred/single/${tline.tline_id}.sav`)
                const modelMultiFilePath = path.resolve(`data/pred/multi/${tline.tline_id}.sav`)
                const geojsonFilePath = path.resolve(`data/maps/${tline.tline_id}.json`)

                if (tline.pred_value) {
                    tline.pred_value.model_file = fs.existsSync(modelFilePath)
                        ? `${tline.tline_id}.sav`
                        : null

                    tline.pred_value.model_multi_file = fs.existsSync(modelMultiFilePath)
                        ? `${tline.tline_id}.sav`
                        : null

                    tline.pred_value.geojson = fs.existsSync(geojsonFilePath)
                        ? `${tline.tline_id}.json`
                        : null
                }

                return tline || null
            })
            return f
        })

        res.json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const createSpot = async (req, res) => {
    try {
        const { tline_id, spot_id, spot_name, sort: requestedSort, is_seen, is_battery, y_max, y_interval, safe_mark, normal_value, drop_value } = req.body

        const newSpot = await Spot.create({
            tline_id,
            spot_id,
            spot_name,
            sort: requestedSort,
            is_seen,
            is_battery,
            y_max,
            y_interval,
            safe_mark,
            normal_value,
            drop_value
        })

        const prefix  = Math.floor(requestedSort / 100)
        const desired = requestedSort % 100

        const minSort = prefix * 100 + 1
        const maxSort = prefix * 100 + 99

        let siblings = await Spot.findAll({
            where: {
                sort: { [Op.between]: [minSort, maxSort] }
            },
            order: [['sort', 'ASC']]
        })

        siblings = siblings.filter(s => s.spot_id !== newSpot.spot_id)

        const insertAt = Math.min(Math.max(desired - 1, 0), siblings.length)
        siblings.splice(insertAt, 0, newSpot)

        for (let i = 0; i < siblings.length; i++) {
            const s        = siblings[i]
            const correct = prefix * 100 + (i + 1)

            if (s.sort !== correct) {
                await Spot.update(
                    { sort: correct },
                    { where: { spot_id: s.spot_id } }
                )
            }
        }

        res.json({ 
            message: 'Spot berhasil dibuat & sort diresequence', 
            spot: newSpot
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const updateSpot = async (req, res) => {
    try {
        const {
            spot_id,
            new_spot_id,
            spot_name,
            sort: requestedSort,
            is_seen,
            is_battery,
            y_max,
            y_interval,
            safe_mark,
            normal_value,
            drop_value
        } = req.body

        const target = await Spot.findOne({ where: { spot_id } })

        const prefix    = Math.floor(requestedSort / 100)
        const desired   = requestedSort % 100

        const minSort   = prefix * 100 + 1
        const maxSort   = prefix * 100 + 99
        let siblings    = await Spot.findAll({
            where: {
                sort: { [Op.between]: [minSort, maxSort] }
            },
            order: [['sort', 'ASC']]
        })

        siblings = siblings.filter(s => s.spot_id !== spot_id)

        const insertAt = Math.min(Math.max(desired - 1, 0), siblings.length)
        siblings.splice(insertAt, 0, target)

        for (let i = 0; i < siblings.length; i++) {
            const s      = siblings[i]
            const newSort = prefix * 100 + (i + 1)

            if (s.sort !== newSort) {
                await Spot.update(
                    { sort: newSort },
                    { where: { spot_id: s.spot_id } }
                )
            }
        }

        const spot = await target.update({
            spot_id:   new_spot_id || spot_id,
            spot_name,
            is_seen,
            is_battery,
            y_max,
            y_interval,
            safe_mark,
            normal_value,
            drop_value
        })

        res.json({ message: 'Spot berhasil diperbarui dan sort diresequence', spot })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateSort = async (req, res) => {
    try {
        const { spot_id, sort: requestedSort } = req.body

        const target = await Spot.findOne({ where: { spot_id } })

        const prefix  = Math.floor(requestedSort / 100)
        const desired = requestedSort % 100

        const minSort = prefix * 100 + 1
        const maxSort = prefix * 100 + 99

        let siblings = await Spot.findAll({
            where: {
                sort: { [Op.between]: [minSort, maxSort] }
            },
            order: [['sort', 'ASC']]
        })
        siblings = siblings.filter(s => s.spot_id !== spot_id)

        const insertAt = Math.min(Math.max(desired - 1, 0), siblings.length)
        siblings.splice(insertAt, 0, target)

        for (let i = 0; i < siblings.length; i++) {
            const s      = siblings[i]
            const newSort = prefix * 100 + (i + 1)

            if (s.sort !== newSort) {
                await Spot.update(
                    { sort: newSort },
                    { where: { spot_id: s.spot_id } }
                )
            }
        }

        const finalSort = prefix * 100 + (insertAt + 1)
        await target.update({ sort: finalSort })

        return res.json({ message: 'Sort berhasil diperbarui dan diresequence' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const deleteSpot = async (req, res) => {
    try {
        const { spot_id } = req.body

        const target = await Spot.findOne({ where: { spot_id } })

        const deletedSort = target.sort
        const prefix      = Math.floor(deletedSort / 100)

        await Spot.destroy({ where: { spot_id } })

        const upperBound = (prefix + 1) * 100

        await Spot.decrement(
            { sort: 1 },
            {
                where: {
                    sort: {
                        [Op.gt]: deletedSort,
                        [Op.lt]: upperBound
                    }
                }
            }
        )

        res.json({ message: 'Spot berhasil dihapus dan sort diresequence berdasarkan prefix' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getSpotsByField = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET)
        const user = await User.findOne({ where: { user_id: decoded.user_id } })
        const isSA = user.role === 'superadmin'

        const spots = await Spot.findAll({
            attributes: ['spot_id', 'spot_name', 'sort'],
            include: [{
                model: Trunkline,
                as: 'trunkline',
                attributes: ['tline_id', 'tline_name', 'field_id'],
                include: [{
                    model: Field,
                    as: 'field',
                    attributes: ['id', 'field_id', 'field_name']
                }]
            }],
            where: isSA
                ? {}
                : { '$trunkline.field_id$': user.field_id },
            order: [['sort', 'ASC']]
        })

        const grouped = {}
        for (const spot of spots) {
            const fld = spot.trunkline.field
            if (!grouped[fld.field_id]) {
                grouped[fld.field_id] = {
                    id: fld.id,
                    field_id: fld.field_id,
                    field_name: fld.field_name,
                    spots: []
                }
            }
            grouped[fld.field_id].spots.push({
                spot_id: spot.spot_id,
                spot_name: spot.spot_name,
                sort: spot.sort,
                tline_id: spot.trunkline.tline_id,
                tline_name: spot.trunkline.tline_name
            })
        }

        const result = Object.values(grouped)
        return res.json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.message })
    }
}