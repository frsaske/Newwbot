/**
 * ꜱᴀꜱᴜᴋᴇX - A WhatsApp Bot
 * Copyright (c) 2024 ꜰʀsᴀsᴋᴇ
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings')
global.botStartTime = Math.floor(Date.now() / 1000);
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { installFooter } = require('./lib/footer')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds

// HTTP Server for container environment health check & status on port 3000
const http = require('http');
const { handleHttpRequest } = require('./lib/webDashboard');
const server = http.createServer((req, res) => {
    handleHttpRequest(req, res);
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Bot HTTP service running on port ${PORT}`);
});

let phoneNumber = "911234567890"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "ꜱᴀꜱᴜᴋᴇX"
global.themeemoji = "•"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}



const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (fs.existsSync('./session') && !fs.existsSync(path.join(SESSIONS_DIR, 'session1'))) {
    fs.renameSync('./session', path.join(SESSIONS_DIR, 'session1'));
    console.log('📦 Migrated ./session to sessions/session1');
}
global.activeSockets = global.activeSockets || new Map();
global.pendingStarts = global.pendingStarts || new Set();
global.conflictTracker = global.conflictTracker || new Map();
global.reconnectTimers = global.reconnectTimers || new Map();

global.loadOwners = () => {
    try { return JSON.parse(fs.readFileSync('./data/owners.json', 'utf8')); }
    catch (_) { return [settings.ownerNumber]; }
};
global.saveOwners = (owners) => fs.writeFileSync('./data/owners.json', JSON.stringify([...new Set(owners.map(String))], null, 2));

async function startXeonBotInc(sessionName = 'session1') {
    global.startXeonBotInc = startXeonBotInc;
    if (global.pendingStarts.has(sessionName)) {
        console.log(chalk.yellow(`⏳ [${sessionName}] Connection already starting, skipping duplicate start.`));
        return;
    }
    global.pendingStarts.add(sessionName);

    try {
        // Clean up any existing socket for this session before creating a new one
        if (global.activeSockets.has(sessionName)) {
            const oldSocket = global.activeSockets.get(sessionName);
            try {
                oldSocket.ev.removeAllListeners();
                oldSocket.end(undefined);
                if (oldSocket.ws) {
                    oldSocket.ws.close();
                }
            } catch (_) {}
            global.activeSockets.delete(sessionName);
        }

        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(path.join('./sessions', sessionName))
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        XeonBotInc.sessionName = sessionName
        installFooter(XeonBotInc)
        global.activeSockets.set(sessionName, XeonBotInc)

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: XeonBotInc.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            // Clear message retry cache to prevent memory bloat
            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.'
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Handle pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let phoneNumber
        if (!!global.phoneNumber) {
            phoneNumber = global.phoneNumber
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 6281376552730 (without + or spaces) : `)))
        }

        // Clean the phone number - remove any non-digit characters
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

        // Validate the phone number using awesome-phonenumber
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phoneNumber).isValid()) {
            console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, etc.) without + or spaces.'));
            process.exit(1);
        }

        setTimeout(async () => {
            try {
                let code = await XeonBotInc.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
            } catch (error) {
                console.error('Error requesting pairing code:', error)
                console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
            }
        }, 3000)
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        
        if (qr) {
            console.log(chalk.yellow(`📱 [${sessionName}] QR Code generated. Please scan with WhatsApp.`))
        }
        
        if (connection === 'connecting') {
            console.log(chalk.yellow(`🔄 [${sessionName}] Connecting to WhatsApp...`))
        }
        
        if (connection == "open") {
            global.conflictTracker.delete(sessionName);
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`✅ [${sessionName}] Connected | 📱 ${XeonBotInc.user?.id?.split(':')[0]?.split('@')[0] || 'unknown'}`))

            await delay(1000)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'KNIGHT BOT'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: ꜰʀsᴀsᴋᴇ`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: frsaske`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: ꜰʀsᴀsᴋᴇ`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const closeError = lastDisconnect?.error;
            const errorMsg = String(closeError?.message || closeError || '');
            const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
            const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440 || errorMsg.toLowerCase().includes('conflict');
            
            console.log(chalk.red(`Connection closed due to ${errorMsg}, status=${statusCode || 'unknown'}`));
            if (closeError?.stack) console.error(chalk.gray(closeError.stack.split('\n').slice(0, 4).join('\n')));

            // Clean up socket reference
            if (global.activeSockets.get(sessionName) === XeonBotInc) {
                global.activeSockets.delete(sessionName);
            }
            
            if (isLoggedOut) {
                try {
                    rmSync(path.join('./sessions', sessionName), { recursive: true, force: true });
                    console.log(chalk.yellow(`[${sessionName}] Session folder deleted. Please re-authenticate.`));
                } catch (error) {
                    console.error('Error deleting session:', error);
                }
                console.log(chalk.red(`[${sessionName}] Session logged out. Please re-authenticate.`));
                return;
            }

            // Clear any existing reconnect timer for this session
            if (global.reconnectTimers.has(sessionName)) {
                clearTimeout(global.reconnectTimers.get(sessionName));
                global.reconnectTimers.delete(sessionName);
            }
            
            if (isReplaced) {
                const count = (global.conflictTracker.get(sessionName) || 0) + 1;
                global.conflictTracker.set(sessionName, count);
                if (count >= 2) {
                    console.log(chalk.yellow(`⚠️ [${sessionName}] Stream conflict repeated (${count}x). WhatsApp active on another device or client. Paused auto-reconnect to avoid conflict loops.`));
                    return;
                }
                console.log(chalk.yellow(`⚠️ [${sessionName}] Stream conflict (status 440). Waiting 15s before single retry (${count}/2)...`));
                const timer = setTimeout(() => {
                    global.reconnectTimers.delete(sessionName);
                    startXeonBotInc(sessionName);
                }, 15000);
                global.reconnectTimers.set(sessionName, timer);
                return;
            }

            // For other disconnections (network drop, 515 restart required, etc.)
            global.conflictTracker.delete(sessionName);
            console.log(chalk.yellow(`[${sessionName}] Reconnecting in 5s...`));
            const timer = setTimeout(() => {
                global.reconnectTimers.delete(sessionName);
                startXeonBotInc(sessionName);
            }, 5000);
            global.reconnectTimers.set(sessionName, timer);
        }
    })

    // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

    // Anticall handler: block callers when enabled
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    // First: attempt to reject the call if supported
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                            await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                        }
                    } catch {}

                    // Notify the caller only once within a short window
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                    }
                } catch {}
                // Then: block after a short delay to ensure rejection and message are processed
                setTimeout(async () => {
                    try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                }, 800);
            }
        } catch (e) {
            // ignore
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc;
    } catch (error) {
        console.error('Error in startXeonBotInc:', error);
        if (!global.reconnectTimers.has(sessionName)) {
            const timer = setTimeout(() => {
                global.reconnectTimers.delete(sessionName);
                startXeonBotInc(sessionName);
            }, 8000);
            global.reconnectTimers.set(sessionName, timer);
        }
    } finally {
        global.pendingStarts.delete(sessionName);
    }
}


// Start the bot with error handling
// On restart, ONLY boot the primary session1. Secondary/old creds (session2-5) do not auto-connect.
const primaryCredsPath = path.join(SESSIONS_DIR, 'session1', 'creds.json');
if (fs.existsSync(primaryCredsPath)) {
    try {
        JSON.parse(fs.readFileSync(primaryCredsPath, 'utf8'));
        startXeonBotInc('session1').catch(err => {
            console.error('Fatal error starting session1:', err);
        });
    } catch (error) {
        console.error('❌ [session1] Invalid creds.json; primary session skipped.');
    }
} else {
    console.log('📁 No primary session found in sessions/session1. Pair or upload creds.json to connect.');
}
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
