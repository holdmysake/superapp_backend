import express from 'express'
import {
    getAllData
} from '../../controllers/frontend/data.controller.js'

const router = express.Router()

router.post('/getAllData', getAllData)

export default router