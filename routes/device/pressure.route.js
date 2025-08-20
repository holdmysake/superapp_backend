import express from 'express'
import {
    getTimestamp,
    store,
    storeBulk
} from '../../controllers/device/pressure.controller.js'

const router = express.Router()

router.get('/getTimestamp', getTimestamp)
router.post('/store', store)
router.post('/storeBulk', storeBulk)

router.post('/code', (req, res) => {
    try {
        const { code } = req.body
        if (!code) {
            return res.status(400).json({ error: 'code is required' })
        }

        const formatted = formatCode(code, 4)
        return res.json({ formatted })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
})

function formatCode(body, spaces = 4) {
    const spaceStr = ' '.repeat(spaces)
    let indent = 0
    let result = ''

    for (let i = 0; i < body.length; i++) {
        const char = body[i]

        if (char === '}' || char === ']') {
            indent = Math.max(0, indent - 1)
            result += '\n' + spaceStr.repeat(indent) + char
        }
        else if (char === '{' || char === '[') {
            result += char
            indent++
            result += '\n' + spaceStr.repeat(indent)
        }
        else if (char === '\n') {
            result += '\n' + spaceStr.repeat(indent)
        }
        else {
            result += char
        }
    }

    return result
}

export default router