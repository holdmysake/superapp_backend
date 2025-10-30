import express from 'express'
import {
    leakDetect,
    leakDetectMulti,
    // rekapOnOff,
    shareReport,
    leakCheck,
    uploadMLFile,
    updateMLFile,
    deleteMLFile,
    predict
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
router.post('/uploadMLFile', verifyTokenAdmin, uploadMLFile)
router.post('/updateMLFile', verifyTokenAdmin, updateMLFile)
router.post('/deleteMLFile', verifyTokenAdmin, deleteMLFile)
router.post('/predict', predict)
router.post('/leakCheck', leakCheck)

export default router