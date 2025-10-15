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

export const createWaGroup = async (req, res) => {
    try {
        const { field_id, target, type, group_name } = req.body

        const group = await WAGroup.create({
            field_id,
            target,
            type,
            group_name
        })

        res.json(group)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const deleteWaGroup = async (req, res) => {
    try {
        const { id } = req.body

        await WAGroup.destroy({
            where: {
                id
            }
        })

        res.json({ message: 'Group deleted' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message })
    }
}

export const updateWaGroup = async (req, res) => {
    try {
        const { id, target, type, group_name } = req.body

        const group = await WAGroup.findByPk(id)
        if (!group) {
            return res.status(404).json({ message: 'Group not found' })
        }

        group.target = target
        group.type = type
        group.group_name = group_name
        await group.save()

        res.json(group)
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

export const getQRCode = async (req, res) => {
	try {
		const { field_id } = req.body
		const result = await forceGetQr(field_id, getIO())
		res.json({ success: true, ...result })
	} catch (err) {
		res.status(400).json({ success: false, message: err.message })
	}
}