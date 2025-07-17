import express from 'express'
import { 
    scanQR
} from '../../controllers/panel/whatsapp.controller.js'

const router = express.Router()

router.post('/bot/scan', scanQR)

export default router