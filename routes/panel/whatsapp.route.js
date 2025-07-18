import express from 'express'
import { 
    scanQR,
    scanQRCodeField
} from '../../controllers/panel/whatsapp.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/bot/scan', verifyTokenAdmin, scanQR)
router.post('/bot/scanQR', verifyTokenAdmin, scanQRCodeField)

export default router