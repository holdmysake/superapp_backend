import express from 'express'
import {
    getWaGroup,
    createWaGroup,
    updateWaGroup,
    deleteWaGroup,
    disconnectWa,
    getGroups,
    refreshGroups,
    getQRCode
} from '../../controllers/panel/wa.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/getWaGroup', verifyTokenAdmin, getWaGroup)
router.post('/createWaGroup', verifyTokenAdmin, createWaGroup)
router.post('/updateWaGroup', verifyTokenAdmin, updateWaGroup)
router.post('/deleteWaGroup', verifyTokenAdmin, deleteWaGroup)
router.post('/disconnectWa', verifyTokenAdmin, disconnectWa)
router.post('/getGroups', verifyTokenAdmin, getGroups)
router.post('/refreshGroups', verifyTokenAdmin, refreshGroups)
router.post('/getQRCode', getQRCode)

export default router