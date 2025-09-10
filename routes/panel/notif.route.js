import express from 'express'
import {
    leakDetect,
    // rekapOnOff
} from '../../controllers/panel/notif.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/leakDetect', verifyTokenAdmin, leakDetect)
// router.post('/rekapOnOff', rekapOnOff)

export default router