import { Op } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"

export const getAllData = async (req, res) => {
    try {
        const { field_id, timestamp } = req.body

        const pressureTableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(pressureTableName)

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD')
                            .startOf('day')
                            .toDate()
        const endOfDay   = moment(startOfDay)
                            .add(1, 'day')
                            .toDate()

        const press = await Pressure.findAll({
            where: {
                timestamp: {
                    [Op.gte]: startOfDay,
                    [Op.lt]: endOfDay
                }
            },
            order: [['timestamp','ASC']]
        })

        res.json(press)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getAllSpots = async (req, res) => {
    try {
        const { field_id } = req.body

        const spots = await Spot.findAll({
            where: { field_id },
            order: [['sort', 'ASC']]
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}