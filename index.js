import express from 'express'
import bodyParser from 'body-parser'
import sequelize from './config/db.js'
import spotRoute from './routes/panel/spot.route.js'
import pressRoute from './routes/device/pressure.route.js'
import userRoute from './routes/panel/user.route.js'
import dataRoute from './routes/frontend/data.route.js'
import dataPanelRoute from './routes/panel/data.route.js'
import notifRoute from './routes/panel/notif.route.js'
import whatsappRoute from './routes/panel/whatsapp.route.js'
import cors from 'cors'
import { models } from './models/index.js'
import defineAssociations from './models/association.js'
import dotenv from 'dotenv'
import { initSocket } from './socket.js'
import http from "http"
import { startJobs } from './cron/deviceCheck.js'
import { initWhatsAppSocket } from './bot/bot.js'

dotenv.config()

defineAssociations(models)

const app = express()

app.use(express.json())
app.use(bodyParser.text({ type: 'text/plain' }))
app.use(cors())

app.use('/api/panel/', spotRoute)
app.use('/api/panel/', userRoute)
app.use('/api/panel/', dataPanelRoute)
app.use('/api/panel/', notifRoute)
app.use('/api/panel/', whatsappRoute)
app.use('/api', pressRoute)
app.use('/api/fe/', dataRoute)

const server = http.createServer(app)
const io = initSocket(server)
initWhatsAppSocket(io)

const PORT = process.env.PORT

sequelize.sync({ force: false })
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database error:', err))

startJobs()

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})

// app.listen(PORT, () => {
//     console.log(`Server running on http://localhost:${PORT}`)
// })