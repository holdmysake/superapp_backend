import { Op } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"

export const downloadDataCSV = async (req, res) => {
    try {
        const { field_id, spot_id, timestamp } = req.body

        const tableName = `pressure_${field_id}`
        const Pressure = defineUserDataModel(tableName)

        const startOfDay = moment.tz(timestamp, 'YYYY-MM-DD')
                            .startOf('day')
                            .toDate()
        const endOfDay   = moment(startOfDay)
                            .add(1, 'day')
                            .toDate()

        const pressureData = await Pressure.findAll({
            where: {
                spot_id,
                timestamp: {
                    [Op.gte]: startOfDay,
                    [Op.lt]: endOfDay
                }
            },
            attributes: ['timestamp','psi'],
            order: [['timestamp','ASC']]
        })

        res.json(pressureData)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}