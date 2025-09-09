import express from 'express'
import {
    leakDetect,
    // rekapOnOff
} from '../../controllers/panel/notif.controller.js'

const router = express.Router()

router.post('/leakDetect', leakDetect)
// router.post('/rekapOnOff', rekapOnOff)

export default router