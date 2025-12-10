import mqtt from "mqtt"
import dotenv from "dotenv"
import { storeMQTT } from "../controllers/device/pressure.controller.js"

dotenv.config()

export const startSubscriber = () => {
    const broker = process.env.BROKER
    const topic = "fol"
    const client = mqtt.connect(broker)

    client.on("connect", () => {
        client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`Subscribed to topic: ${topic}`)
            } else {
                console.error(`Subscription error: ${err}`)
            }
        })
    })

    client.on("message", (topic, message) => {
        // const serverTime = new Date().toISOString()

        // console.log(`[${serverTime}] Topic ${topic}: ${message.toString()}`)

        storeMQTT(message.toString())
    })
}

export const startSubscriberForGPS = () => {
    const broker = process.env.BROKER
    const topic = "gps"
    const client = mqtt.connect(broker)

    client.on("connect", () => {
        client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`Subscribed to topic: ${topic}`)
            } else {
                console.error(`Subscription error: ${err}`)
            }
        })
    })

    client.on("message", (topic, message) => {
        const serverTime = new Date().toISOString()

        console.log(`[${serverTime}] Topic ${topic}: ${message.toString()}`)

        // storeMQTT(message.toString())
    })
}