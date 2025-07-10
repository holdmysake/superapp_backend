import express from 'express'
import {
    getTimestamp,
    store,
    storeBulk
} from '../controllers/device/pressure.controller.js'

const router = express.Router()

router.get('/getTimestamp', getTimestamp)
router.post('/store', store)
router.post('/storeBulk', storeBulk)

export default router