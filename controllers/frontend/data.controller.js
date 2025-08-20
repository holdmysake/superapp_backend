import { Op, where } from "sequelize"
import defineUserDataModel from "../../models/pressure.model.js"
import moment from "moment-timezone"
import Spot from "../../models/spot.model.js"
import Trunkline from "../../models/trunkline.model.js"

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

        const spots = await Field.findAll({
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
                        as: 'spots',
                        separate: true,
                        order: [['sort', 'ASC']]
                    }
                ]
            }
        }
        )

        res.json(spots)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}