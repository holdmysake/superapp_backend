import express from 'express'
import {
    getWaGroup,
    disconnectWa,
    getGroups,
    refreshGroups
} from '../../controllers/panel/wa.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/getWaGroup', verifyTokenAdmin, getWaGroup)
router.post('/disconnectWa', verifyTokenAdmin, disconnectWa)
router.post('/getGroups', verifyTokenAdmin, getGroups)
router.post('/refreshGroups', verifyTokenAdmin, refreshGroups)

export default router