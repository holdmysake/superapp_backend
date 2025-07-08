import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token)
        return res.status(401).json({ message: 'Token tidak dikirim' })

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(403).json({ message: 'Token tidak valid' })
    }
}

export const verifyTokenSA = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user?.role === 'superadmin') {
            return next()
        } else {
            return res.status(403).json({ message: 'Akses hanya untuk superadmin' })
        }
    })
}

export const verifyTokenAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        const role = req.user?.role
        if (role === 'admin' || role === 'superadmin') {
            return next()
        } else {
            return res.status(403).json({ message: 'Akses hanya untuk admin atau superadmin' })
        }
    })
}

export const verifyTokenUser = (req, res, next) => {
    verifyToken(req, res, () => {
        const role = req.user?.role
        if (role === 'user' || role === 'admin' || role === 'superadmin') {
            return next()
        } else {
            return res.status(403).json({ message: 'Akses hanya untuk user, admin, atau superadmin' })
        }
    })
}
