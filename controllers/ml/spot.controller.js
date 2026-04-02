import Spot from "../../models/spot.model.js"

export const getSpot = async (req, res) => {
    try {
        const { spot_id } = req.body

        const spot = await Spot.findOne({
            where: { spot_id }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}