import express from 'express'
import {
    getTimestamp,
    store,
    storeBulk,
    storeMany
} from '../../controllers/device/pressure.controller.js'

const router = express.Router()

router.get('/getTimestamp', getTimestamp)
router.post('/store', store)
router.post('/storeBulk', storeBulk)
router.post('/storeMany', storeMany)

export default router