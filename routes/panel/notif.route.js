import express from 'express'
import {
    leakDetect,
    leakDetectMulti,
    // rekapOnOff,
    shareReport,
    leakCheck
} from '../../controllers/panel/notif.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/leakDetect', verifyTokenAdmin, leakDetect)
router.post('/leakDetectMulti', verifyTokenAdmin, leakDetectMulti)
// router.post('/rekapOnOff', rekapOnOff)
router.post('/shareReport', verifyTokenAdmin, shareReport)
router.post('/leakCheck', leakCheck)

export default router