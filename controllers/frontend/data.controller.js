import { Op } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"

export const getAllData = async (req, res) => {
    try {
        const { field_id, timestamp } = req.body

        const pressureTableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(pressureTableName)

        const date = new Date(timestamp)
        const nextDate = Date(timestamp).setDate(new Date(timestamp).getDate() + 1)

        const press = await Pressure.findAll({
            where: {
                timestamp: {
                    [Op.gte]: date,
                    [Op.lt]: nextDate
                }
            }
        })

        res.json(press)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}