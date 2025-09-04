import express from 'express'
import {
    leakDetect
} from '../../controllers/panel/notif.controller.js'

const router = express.Router()

router.post('/leakDetect', leakDetect)

export default router