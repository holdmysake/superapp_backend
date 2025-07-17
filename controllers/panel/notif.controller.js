export const getOffDevice = async (req, res) => {
    try {

    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}