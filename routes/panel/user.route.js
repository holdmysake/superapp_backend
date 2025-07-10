import express from 'express'
import {
    login,
    createUser,
    updateUser,
    updatePwBySA,
    deleteUser,
    getUsers,
    getRole
} from '../../controllers/panel/user.controller.js'
import {
    verifyTokenSA,
    verifyTokenAdmin,
    verifyTokenUser
} from '../../middlewares/user.middleware.js'

const router = express.Router()

router.post('/login', login)
router.post('/createUser', verifyTokenAdmin, createUser)
router.post('/updateUser', verifyTokenAdmin, updateUser)
router.post('/updatePwBySA', verifyTokenSA, updatePwBySA)
router.post('/deleteUser', verifyTokenAdmin, deleteUser)
router.post('/getUsers', verifyTokenAdmin, getUsers)
router.post('/getRole', verifyTokenAdmin, getRole)

export default router