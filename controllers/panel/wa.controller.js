import { readGroupsJson, stopSession, updateGroupsJson } from "../../bot/bot.js"
import WAGroup from "../../models/wa_group.js"
import { getIO } from "../../socket.js"

export const getWaGroup = async (req, res) => {
    try {
        const { field_id } = req.body

        const waGroup = await WAGroup.findAll({
            where: {
                field_id
            }
        })

        res.json(waGroup)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const getGroups = async (req, res) => {
    try {
        const { field_id } = req.body

        const data = readGroupsJson(field_id)

        res.json(data)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const refreshGroups = async (req, res) => {
    try {
        const { field_id } = req.body

        const data = await updateGroupsJson(field_id, getIO())

        res.json(data)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const disconnectWa = async (req, res) => {
    try {
        const { field_id } = req.body

        await stopSession(field_id)
        res.json({ message: 'WhatsApp session disconnected' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}