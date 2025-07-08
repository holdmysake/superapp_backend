import express from 'express'
import sequelize from './config/db.js'
import spotRoute from './routes/spot.route.js'
import pressRoute from './routes/pressure.route.js'
import userRoute from './routes/user.route.js'
import cors from 'cors'
import { models } from './models/index.js'
import defineAssociations from './models/association.js'

defineAssociations(models)

const app = express()

app.use(express.json())
app.use(cors())

app.use('/api', spotRoute)
app.use('/api', pressRoute)
app.use('/api', userRoute)

sequelize.sync({ force: false })
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database error:', err))


app.listen(3000, () => {
    console.log('Server running on http://localhost:3000')
})