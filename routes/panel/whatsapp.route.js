import express from 'express'
import {
    scanQRCodeField,
    checkLogin,
    logoutWA,
    pingTest,
    getWA
} from '../../controllers/panel/whatsapp.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/bot/scanQR', verifyTokenAdmin, scanQRCodeField)
router.post('/bot/checkLogin', verifyTokenAdmin, checkLogin)
router.post('/bot/logoutWA', verifyTokenAdmin, logoutWA)
router.post('/bot/pingTest', verifyTokenAdmin, pingTest)
// router.post('/bot/getWA', verifyTokenAdmin, getWA)

export default router