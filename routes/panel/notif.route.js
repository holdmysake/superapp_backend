import express from 'express'
import {
    rekapOnOff
} from '../../controllers/panel/notif.controller.js'

const router = express.Router()

router.post('/rekapOnOff', rekapOnOff)

export default router