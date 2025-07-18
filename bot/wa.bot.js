import pkg from '@whiskeysockets/baileys'
import { resolve as pathResolve } from 'path'
import { rmSync, existsSync } from 'fs'
import qrCode from 'qrcode'
import Field from '../models/field.model.js'
import jwt from 'jsonwebtoken'

const {
    useMultiFileAuthState,
    DisconnectReason,
    makeWASocket
} = pkg

const fieldSockets = new Map()
const reconnectAttempts = new Map()

export async function startFieldBot(fieldId, withQR = false, token) {
    const dir = pathResolve(`./auth_field/${fieldId}`)
    const { state, saveCreds } = await useMultiFileAuthState(dir)

    const field = await Field.findOne({
        where: {
            field_id: fieldId
        }
    })

    return new Promise((resolve) => {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: [`FOL Bot  ${field.field_name}`, 'Chrome', '1.0']
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr && withQR) {
                const image = await qrCode.toDataURL(qr)
                return resolve({ qr: image })
            }

            if (connection === 'open') {
                console.log(`[WA] ✅ Field ${fieldId} connected.`)
                fieldSockets.set(fieldId, sock)
                await updateFieldConnectionStatus(fieldId, true, sock, token)
                return resolve({ sock })
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode
                const shouldReconnect = code !== DisconnectReason.loggedOut
            
                console.log(`[WA] ❌ Field ${fieldId} disconnected.`)
                await updateFieldConnectionStatus(fieldId, false)
            
                const attempts = reconnectAttempts.get(fieldId) || 0
            
                if (shouldReconnect && attempts < 3) {
                    reconnectAttempts.set(fieldId, attempts + 1)
            
                    console.log(`[WA] 🔁 Reconnecting field ${fieldId} (attempt ${attempts + 1}/3)...`)
                    try {
                        await startFieldBot(fieldId, false)
                    } catch {
                        console.error(`[WA] ⚠️ Reconnect gagal untuk field ${fieldId}`)
                    }
                } else {
                    console.warn(`[WA] 🚫 Max reconnect reached untuk field ${fieldId}`)
                    fieldSockets.delete(fieldId)
                    reconnectAttempts.delete(fieldId)
            
                    const authDir = pathResolve(`./auth_field/${fieldId}`)
                    if (existsSync(authDir)) {
                        rmSync(authDir, { recursive: true, force: true })
                        console.log(`[FS] 🧹 Folder ./auth_field/${fieldId} dihapus.`)
                    }
                }
            }
        })

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0]
            const from = msg.key.remoteJid
            const text = msg.message?.conversation || ''
            console.log(`[Field ${fieldId}] ${from}: ${text}`)
        })
    })
}

export async function getQRCodeForField(fieldId) {
    const sock = fieldSockets.get(fieldId)
    if (sock?.user) return null

    console.log(`[QR] Generate QR untuk field ${fieldId}`)
    const result = await startFieldBot(fieldId, true)
    return result.qr
}

export function isFieldConnected(fieldId) {
    const sock = fieldSockets.get(fieldId)
    return !!sock?.user
}

export async function disconnectField(fieldId) {
    const sock = fieldSockets.get(fieldId)
    if (sock) {
        try {
            await sock.logout()
        } catch {}
    }

    fieldSockets.delete(fieldId)
    const dir = pathResolve(`./auth_field/${fieldId}`)
    if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
    }
    await updateFieldConnectionStatus(fieldId, false)
}

async function updateFieldConnectionStatus(fieldId, status, sock = null, token = null) {
    const updateData = { is_login: status }

    if (status && sock && sock.user) {
        updateData.no_wa = sock.user.id
        if (token) {
            const decoded = jwt.decode(token)
            updateData.user_id = decoded?.user_id || null
        }
    } else {
        updateData.no_wa = null
        updateData.user_id = null
    }

    await Field.update(updateData, { where: { fieldId } })
    console.log(`[DB] Updated field ${fieldId}:`, updateData)
}

export default { getQRCodeForField, disconnectField, isFieldConnected }
