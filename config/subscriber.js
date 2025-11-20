import mqtt from "mqtt"
import dotenv from "dotenv"
import { storeMQTT } from "../controllers/device/pressure.controller"

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
        storeMQTT(message.toString())
    })
}