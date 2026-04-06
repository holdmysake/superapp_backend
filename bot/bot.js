import fs from 'fs'
import path from 'path'
import { models } from '../models/index.js'
import * as baileys from '@whiskeysockets/baileys'
import qrcode from "qrcode-terminal"
import { Boom } from '@hapi/boom'
import pino from 'pino'

const makeWASocket = baileys.makeWASocket || baileys.default?.makeWASocket || baileys.default?.default || baileys.default
const useMultiFileAuthState = baileys.useMultiFileAuthState || baileys.default?.useMultiFileAuthState
const DisconnectReason = baileys.DisconnectReason || baileys.default?.DisconnectReason
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion || baileys.default?.fetchLatestBaileysVersion

const LOG = process.env.LOG_SOCKET !== '0'

const sessions = new Map()
const connectingAccounts = new Set()

const authDir = (field_id) => path.join(process.cwd(), 'baileys_auth', String(field_id))
const roomOf = (field_id) => `field_${field_id}`

const groupsDir = () => path.join(process.cwd(), 'data', 'wa_groups')
const groupsFile = (field_id) => path.join(groupsDir(), `${field_id}.json`)
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }
function writeFileAtomic(fp, data) {
    ensureDir(path.dirname(fp))
    const tmp = fp + '.tmp'
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, fp)
}

function log(...args) { if (LOG) console.log(...args) }

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function emitToField(io, field_id, event, payload) {
    if (!io) return
    const room = roomOf(field_id)
    log(`[WA][emit] room=${room} field_id=${field_id} event=${event} :: ${event === 'qr'
        ? (typeof payload === 'string' ? `len=${payload.length}` : `len=${(payload?.qr || '').length}`)
        : JSON.stringify(payload)}`)
    io.to(room).emit(event, payload)
}

function formatMsisdn(id) {
    let no_wa = id?.split(':')[0] || null
    if (no_wa?.startsWith('62')) no_wa = '0' + no_wa.slice(2)
    return no_wa
}

function clearDirContents(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return
        for (const name of fs.readdirSync(dirPath)) {
            const full = path.join(dirPath, name)
            try {
                const st = fs.lstatSync(full)
                if (st.isDirectory()) fs.rmSync(full, { recursive: true, force: true })
                else fs.unlinkSync(full)
            } catch {}
        }
        log(`[WA][auth-clear] cleared contents: ${dirPath}`)
    } catch {}
}

function deleteAuthFolder(field_id) {
    const folder = authDir(field_id)
    if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true })
        console.log(`🗑️  [${field_id}] Folder session dihapus.`)
    }
}

function emitStatus(io, field_id) {
    const s = sessions.get(field_id)
    if (!s) return
    const payload = {
        field_id,
        ...(s.lastStatus || { connected: false, no_wa: null })
    }

    if (!s.lastStatus?.connected && s.lastQR) {
        payload.qr = s.lastQR
    }
    emitToField(io, field_id, 'status', payload)
}

async function ensureSession(field_id, io) {
    let s = sessions.get(field_id)
    if (s?.sock) return s

    if (connectingAccounts.has(field_id)) {
        console.log(`⏳ [${field_id}] Masih dalam proses koneksi, skip.`)
        return sessions.get(field_id) || null
    }
    connectingAccounts.add(field_id)

    const dir = authDir(field_id)
    fs.mkdirSync(dir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const { version } = await fetchLatestBaileysVersion()

    if (!fs.existsSync(path.join(dir, 'creds.json'))) {
        console.log(`[WA][${field_id}] Belum ada kredensial, QR akan dibuat`)
    }

    console.log(`🚀 [${field_id}] Menghubungkan akun...`)

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: [`FLIP Bot ${field_id}`, 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
    })

    s = {
        sock,
        lastStatus: { connected: false, no_wa: null },
        lastQR: null,
        qrHash: null,
        qrAt: 0
    }
    sessions.set(field_id, s)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        console.log(`[${field_id}] connection.update`, JSON.stringify(update, null, 2))
        const { connection, lastDisconnect, qr } = update
        log(`[WA][conn.update] field_id=${field_id} conn=${connection} hasQR=${!!qr}`)

        if (qr) {
            console.log(`\n📱 [${field_id}] Scan QR Code:\n`)
            qrcode.generate(qr, { small: true })
            s.lastQR = qr
            emitStatus(io, field_id)
        }

        if (connection === 'open') {
            connectingAccounts.delete(field_id)
            const no_wa = formatMsisdn(sock.user?.id)
            s.lastStatus = { connected: true, no_wa }
            s.lastQR = null
            s.qrHash = null
            s.qrAt = 0
            console.log(`✅ [${field_id}] Berhasil terhubung! no_wa=${no_wa}`)
            console.log(`📞 [${field_id}] WhatsApp ID: ${sock.user?.id}`)
            emitStatus(io, field_id)
        }

        if (connection === 'close') {
            connectingAccounts.delete(field_id)

            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            const err = lastDisconnect?.error
            const code =
                err?.output?.statusCode ??
                err?.data?.disconnectReason ??
                err?.status ??
                err?.code

            console.log('[WA][close]', { field_id, code, reason, message: String(err?.message || '') })

            s.lastStatus = { connected: false, no_wa: null }
            s.lastQR = null
            emitStatus(io, field_id)

            switch (reason) {
                case DisconnectReason.loggedOut:
                case DisconnectReason.connectionReplaced:
                    console.log(`❌ [${field_id}] Logged out / replaced. Menghapus session, generate QR baru...`)
                    deleteAuthFolder(field_id)
                    sessions.delete(field_id)
                    await delay(3000)
                    ensureSession(field_id, io)
                    break

                default:
                    if (
                        String(err?.message || '').includes('Stream Errored') ||
                        String(err?.message || '').includes('Connection Terminated')
                    ) {
                        console.log(`⚠️  [${field_id}] Stream error. Restart session...`)
                        sessions.delete(field_id)
                        await delay(1000)
                        ensureSession(field_id, io)
                    } else {
                        console.log(`⚠️  [${field_id}] Koneksi terputus (reason: ${reason}). Reconnect...`)
                        sessions.delete(field_id)
                        await delay(3000)
                        ensureSession(field_id, io)
                    }
                    break
            }
        }
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return

        for (const msg of messages) {
            if (msg.key.fromMe) continue

            const sender = msg.key.remoteJid
            const text = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || ''

            if (text) {
                console.log(`📩 [${field_id}] Pesan dari ${sender}: ${text}`)
            }
        }
    })

    connectingAccounts.delete(field_id)
    return s
}

export function initWhatsAppSocket(io) {
    io.on('connection', (socket) => {
        if (LOG) console.log(`[SOCKET] client connected id=${socket.id}`)

        socket.on('wa:status', async ({ field_id }) => {
            if (!field_id) return
            if (LOG) console.log(`[SOCKET][recv] 'wa:status' field_id=${field_id} from=${socket.id}`)
            await ensureSession(field_id, io)
            emitStatus(io, field_id)
        })

        socket.on('wa:qr:refresh', async ({ field_id }) => {
            if (!field_id) return
            if (LOG) console.log(`[SOCKET][recv] 'wa:qr:refresh' field_id=${field_id} from=${socket.id}`)
            await hardRefreshQr(field_id, io)
        })

        socket.on('disconnect', (reason) => {
            if (LOG) console.log(`[SOCKET] client ${socket.id} disconnected reason=${reason}`)
        })
    })
}

export async function bootstrapWhatsAppSessions(io) {
    const { Field } = models
    const rows = await Field.findAll({ attributes: ['field_id', 'id'] })

    console.log('========================================')
    console.log('       FOL WhatsApp Bot - Baileys       ')
    console.log('========================================')
    console.log(`📋 Akun terdaftar: ${rows.length}\n`)

    for (const row of rows) {
        const field_id = row.field_id ?? row.id
        if (field_id == null) continue
        console.log(`   • ${field_id}`)
    }
    console.log('')

    for (const row of rows) {
        const field_id = row.field_id ?? row.id
        if (field_id == null) continue
        await ensureSession(field_id, io)
    }
}

export async function stopSession(field_id) {
    const s = sessions.get(field_id)
    if (!s?.sock) return
    try { await s.sock.logout() } catch {}
    sessions.delete(field_id)
    connectingAccounts.delete(field_id)
    log(`[WA][stop] field_id=${field_id} stopped`)
}

export function getSessionStatus(field_id) {
    const s = sessions.get(field_id)
    return s?.lastStatus ?? { connected: false, no_wa: null }
}

async function hardRefreshQr(field_id, io) {
    deleteAuthFolder(field_id)

    const s = sessions.get(field_id)
    if (s?.sock) {
        try { s.sock.end?.() } catch {}
    }
    sessions.delete(field_id)
    connectingAccounts.delete(field_id)

    await ensureSession(field_id, io)
    emitStatus(io, field_id)
}

async function restartSession(field_id, io) {
    const s = sessions.get(field_id)
    if (s?.sock) {
        try { s.sock.end?.() } catch {}
    }
    sessions.delete(field_id)
    connectingAccounts.delete(field_id)
    await ensureSession(field_id, io)
}

export async function updateGroupsJson(field_id, io) {
    await ensureSession(field_id, io)
    const s = sessions.get(field_id)
    if (!s?.lastStatus?.connected) throw new Error('WhatsApp not connected')

    const participating = await s.sock.groupFetchAllParticipating()
    const groups = Object.values(participating || {})
        .map(g => ({
            jid: g.id || g.jid,
            subject: g.subject,
            size: Array.isArray(g.participants) ? g.participants.length : undefined
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject))

    const no_wa = s.lastStatus?.no_wa ?? formatMsisdn(s.sock.user?.id)

    const payload = {
        field_id,
        no_wa,
        refreshed_at: new Date().toISOString(),
        count: groups.length,
        groups
    }

    const fp = groupsFile(field_id)
    writeFileAtomic(fp, JSON.stringify(payload, null, 2))
    return { file: fp, ...payload }
}

export function readGroupsJson(field_id) {
    const fp = groupsFile(field_id)
    if (!fs.existsSync(fp)) return { field_id, refreshed_at: null, count: 0, groups: [] }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'))
    } catch {
        return { field_id, refreshed_at: null, count: 0, groups: [] }
    }
}

function normalizeJid(to) {
    if (!to) return ''
    const str = String(to).trim()

    if (/@g\.us$/.test(str) || /@s\.whatsapp\.net$/.test(str) || /@broadcast$/.test(str)) {
        return str
    }

    let digits = str.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = '62' + digits.slice(1)
    else if (!digits.startsWith('62')) digits = '62' + digits
    return `${digits}@s.whatsapp.net`
}

export async function sendWaText(field_id, io, { to, text }) {
    if (!text || !String(text).trim()) throw new Error('Text is required')
    const jid = normalizeJid(to)
    if (!jid) throw new Error('Destination (to/jid/target) is required')

    await ensureSession(field_id, io)
    const s = sessions.get(field_id)
    if (!s?.lastStatus?.connected) throw new Error('WhatsApp not connected')

    const msg = await s.sock.sendMessage(jid, { text: String(text) })
    return {
        ok: true,
        field_id,
        to: jid,
        message_id: msg?.key?.id ?? null,
        timestamp: Date.now()
    }
}

export async function forceGetQr(field_id, io) {
    await ensureSession(field_id, io)
    const s = sessions.get(field_id)
    if (!s) throw new Error('Session not found')

    if (!s.lastQR) {
        await hardRefreshQr(field_id, io)
    }

    const qr = s.lastQR
    if (!qr) throw new Error('QR belum tersedia, tunggu beberapa detik lalu coba lagi')

    return {
        field_id,
        qr,
        generated_at: new Date().toISOString(),
    }
}