import express from 'express'
import {
    leakDetect,
    // rekapOnOff,
    shareReport
} from '../../controllers/panel/notif.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/leakDetect', verifyTokenAdmin, leakDetect)
// router.post('/rekapOnOff', rekapOnOff)
router.post('/shareReport', verifyTokenAdmin, shareReport)

export default router