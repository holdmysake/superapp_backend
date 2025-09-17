import express from 'express'
import {
    downloadDataCSV,
    downloadDataCSVMulti,
    downloadDataCSVMultiFaster,
    downloadDataCSVStream,
    getDataBySpot
} from '../../controllers/panel/data.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/downloadDataCSV', verifyTokenAdmin, downloadDataCSV)
router.post('/downloadDataCSVMulti', verifyTokenAdmin, downloadDataCSVMulti)
router.post('/downloadDataCSVMultiFaster', verifyTokenAdmin, downloadDataCSVMultiFaster)
router.post('/downloadDataCSVStream', verifyTokenAdmin, downloadDataCSVStream)
router.post('/getDataBySpot', verifyTokenAdmin, getDataBySpot)

export default router