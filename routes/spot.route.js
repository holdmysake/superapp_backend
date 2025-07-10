import express from 'express'
import {
    storeField,
    updateField,
    getField,
    deleteField,
    storeTline,
    deleteTline,
    getAllSpots,
    createSpot,
    updateSpot,
    deleteSpot,
    updateTrunkline
} from '../controllers/panel/spot.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../middlewares/user.middleware.js'

const router = express.Router()

router.post('/storeField', verifyTokenSA, storeField)
router.post('/updateField', verifyTokenSA, updateField)
router.post('/getField', verifyTokenSA, getField)
router.post('/deleteField', verifyTokenSA, deleteField)
router.post('/storeTline', verifyTokenAdmin, storeTline)
router.post('/deleteTline', verifyTokenAdmin, deleteTline)
router.post('/getAllSpots', verifyTokenAdmin, getAllSpots)
router.post('/createSpot', verifyTokenAdmin, createSpot)
router.post('/updateSpot', verifyTokenAdmin, updateSpot)
router.post('/deleteSpot', verifyTokenAdmin, deleteSpot)
router.post('/updateTrunkline', verifyTokenAdmin, updateTrunkline)

export default router