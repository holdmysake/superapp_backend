import express from 'express'
import {
    downloadDataCSV,
    downloadDataCSVMulti
} from '../../controllers/panel/data.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/downloadDataCSV', verifyTokenAdmin, downloadDataCSV)
router.post('/downloadDataCSVMulti', verifyTokenAdmin, downloadDataCSVMulti)

export default router