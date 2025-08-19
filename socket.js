import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*'
        }
    })

    io.on("connection", (socket) => {
        console.log(`New client connected: ${socket.id}`)

        socket.on("joinField", (field_id) => {
            socket.join(`field_${field_id}`)
            console.log(`Client ${socket.id} joined room field_${field_id}`)
        })
    
        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`)
        })
    })

    return io
}

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized. Call initSocket first.")
    }

    return io
}