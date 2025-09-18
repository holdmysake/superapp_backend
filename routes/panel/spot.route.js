import express from 'express'
import {
    storeField,
    updateField,
    getField,
    deleteField,
    getTline,
    storeTline,
    deleteTline,
    getAllSpots,
    createSpot,
    updateSpot,
    updateSort,
    deleteSpot,
    updateTrunkline,
    updateFilePy,
    updateFilePyMulti,
    getSpotsByField,
    updateFileKmz
} from '../../controllers/panel/spot.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/storeField', verifyTokenSA, storeField)
router.post('/updateField', verifyTokenSA, updateField)
router.post('/getField', verifyTokenAdmin, getField)
router.post('/deleteField', verifyTokenSA, deleteField)
router.post('/getTline', verifyTokenAdmin, getTline)
router.post('/storeTline', verifyTokenAdmin, storeTline)
router.post('/deleteTline', verifyTokenAdmin, deleteTline)
router.post('/getAllSpots', verifyTokenAdmin, getAllSpots)
router.post('/createSpot', verifyTokenAdmin, createSpot)
router.post('/updateSpot', verifyTokenAdmin, updateSpot)
router.post('/updateSort', verifyTokenAdmin, updateSort)
router.post('/deleteSpot', verifyTokenAdmin, deleteSpot)
router.post('/updateTrunkline', verifyTokenAdmin, updateTrunkline)
router.post('/updateFilePy', verifyTokenAdmin, updateFilePy)
router.post('/updateFilePyMulti', verifyTokenAdmin, updateFilePyMulti)
router.post('/getSpotsByField', verifyTokenAdmin, getSpotsByField)
router.post('/updateFileKmz', verifyTokenAdmin, updateFileKmz)

export default router