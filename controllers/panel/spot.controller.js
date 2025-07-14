import defineUserDataModel from '../../models/pressure.model.js'
import Field from '../../models/field.model.js'
import Spot from '../../models/spot.model.js'
import Trunkline from '../../models/trunkline.model.js'
import jwt from 'jsonwebtoken'
import User from '../../models/user.model.js'
import PredValue from '../../models/pred_value.model.js'
import { Op } from 'sequelize'

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
        const field = await Field.findAll()

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
            id_pred, tline_id, spot_id, is_linear, tline_length, drop_value, normal_value, on_value, off_value,
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
                is_linear,
                tline_length,
                drop_value,
                normal_value,
                on_value,
                off_value
            })
        } else {
            if (spot_id) {
                pred = await PredValue.create({
                    tline_id,
                    spot_id,
                    is_linear,
                    tline_length,
                    drop_value,
                    normal_value,
                    on_value,
                    off_value
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
            }
        }

        if (!isSA) {
            queryOptions.where = { field_id: user.field_id }
        }

        const spots = await Field.findAll(queryOptions)

        res.json(spots)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const createSpot = async (req, res) => {
    try {
        const { tline_id, spot_id, spot_name, sort: requestedSort, is_seen, is_battery, x_axis, y_axis } = req.body

        const newSpot = await Spot.create({
            tline_id,
            spot_id,
            spot_name,
            sort: requestedSort,
            is_seen,
            is_battery,
            x_axis,
            y_axis
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
            x_axis,
            y_axis
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
            x_axis,
            y_axis
        })

        res.json({ message: 'Spot berhasil diperbarui dan sort diresequence', spot })
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

        const user = await User.findOne({
            where: {
                user_id: decoded.user_id
            }
        })

        const isSA = user.role === 'superadmin'
        const where = isSA ? {} : { field_id: user.field_id }

        const spots = await Spot.findAll({
            where,
            include: {
                model: Trunkline,
                as: 'trunklines',
                include: {
                    model: PredValue,
                    as: 'pred_value'
                }
            }
        })

        res.json(spots)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}