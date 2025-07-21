import pkg from '@whiskeysockets/baileys'
import { resolve as pathResolve, join as pathJoin } from 'path'
import { rmSync, existsSync } from 'fs'
import qrCode from 'qrcode'
import Field from '../models/field.model.js'
import WALogin from '../models/wa_login.js'
import fs from 'fs'
import moment from 'moment-timezone'

const {
    useMultiFileAuthState,
    DisconnectReason,
    makeWASocket
} = pkg

const fieldSockets = new Map()
const reconnectAttempts = new Map()

export async function startFieldBot(fieldId, withQR = false) {
    const dir = pathResolve(`./auth_field/${fieldId}`)
    ensureAuthFolderExists(dir)
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
                reconnectAttempts.delete(fieldId)
                console.log(`[WA] ✅ Field ${fieldId} connected.`)
                fieldSockets.set(fieldId, sock)
                await updateFieldConnectionStatus(fieldId, true, sock)
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
                    await new Promise(r => setTimeout(r, 1000)) // ⏳ Delay 1s
            
                    try {
                        await startFieldBot(fieldId, false)
                    } catch (err) {
                        console.warn(`[WA] ❌ Reconnect gagal: ${err.message}`)
                    }
                } else {
                    console.warn(`[WA] 🚫 Max reconnect reached untuk field ${fieldId}`)
            
                    // Bersihkan koneksi
                    fieldSockets.delete(fieldId)
                    reconnectAttempts.delete(fieldId)
            
                    // Hapus folder auth
                    if (existsSync(dir)) {
                        try {
                            rmSync(dir, { recursive: true, force: true })
                            console.log(`[FS] 🧹 Folder ${dir} dihapus.`)
                        } catch (err) {
                            console.error(`[FS] ❌ Gagal hapus folder ${dir}:`, err)
                        }
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

function ensureAuthFolderExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`[FS] 📂 Folder ${dir} dibuat.`)
    }
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
    const credsPath = pathJoin(`./auth_field/${fieldId}`, 'creds.json')
    const hasCredsFile = existsSync(credsPath)

    return !!sock?.user && hasCredsFile
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

async function updateFieldConnectionStatus(fieldId, status, sock = null) {
    const updateData = { is_login: status }

    if (status && sock && sock.user) {
        const no_wa = extractPhoneNumber(sock.user.id)
        updateData.no_wa = no_wa
    } else {
        updateData.no_wa = null
    }

    await WALogin.update(updateData, { where: { field_id: fieldId } })
    logWithTimestamp(`🗂️ Updated WALogin field ${fieldId}: ${JSON.stringify(updateData)}`)
}

function extractPhoneNumber(jid) {
    return jid?.split('@')?.[0]?.split(':')?.[0] || null
}

function logWithTimestamp(message) {
    const now = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
    console.log(`[${now}] ${message}`)
}

async function pingFieldBot(fieldId) {
    const sock = fieldSockets.get(fieldId)
    if (!sock || !sock.user || !sock.user.id) {
        logWithTimestamp(`[WA] ❌ Tidak ada koneksi aktif untuk field ${fieldId}`)
        return false
    }

    const jid = sock.user.id
    try {
        await sock.sendMessage(jid, { text: '*_PING!!!_*' })
        logWithTimestamp(`[WA] 📡 Ping dikirim ke field ${fieldId} (${jid})`)
        return true
    } catch (err) {
        logWithTimestamp(`[WA] ❌ Gagal kirim ping ke field ${fieldId}: ${err.message}`)
        return false
    }
}

export default { getQRCodeForField, disconnectField, isFieldConnected, pingFieldBot }
