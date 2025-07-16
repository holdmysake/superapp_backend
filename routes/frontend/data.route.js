import express from 'express'
import {
    getAllData
} from '../../controllers/frontend/data.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/getAllData', verifyTokenUser, getAllData)

export default router