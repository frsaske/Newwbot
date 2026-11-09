const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');

/**
 * Helper to download buffer from a media message
 */
async function downloadMediaBuffer(messageContent) {
    if (!messageContent) return null;
    const stream = await downloadContentFromMessage(messageContent, 'document');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

/**
 * List all 5 session slots
 */
function getSlotsStatus() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const slots = [];
    for (let i = 1; i <= 5; i++) {
        const slotName = `session${i}`;
        const slotPath = path.join(SESSIONS_DIR, slotName);
        const credsPath = path.join(slotPath, 'creds.json');
        const exists = fs.existsSync(credsPath);
        let valid = false;
        let phone = null;

        if (exists) {
            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                valid = true;
                if (creds?.me?.id) {
                    phone = creds.me.id.split(':')[0].split('@')[0];
                }
            } catch (_) {}
        }

        const socket = global.activeSockets?.get(slotName);
        const isOnline = !!(socket && socket.user);

        slots.push({
            slot: i,
            slotName,
            exists,
            valid,
            phone,
            isOnline
        });
    }
    return slots;
}

/**
 * Handle replying to or uploading a creds.json file
 */
async function handleCredsUpload(sock, chatId, message, senderId) {
    try {
        const isOwner = require('../lib/isOwner');
        if (!isOwner(senderId)) {
            await sock.sendMessage(chatId, {
                text: '❌ *Permission Denied:* Only the bot owner can add or connect new sessions.'
            }, { quoted: message });
            return;
        }

        // Check if message itself is a document or quotes a document
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetDoc = message.message?.documentMessage || quoted?.documentMessage;

        if (!targetDoc) {
            await sock.sendMessage(chatId, {
                text: '❌ *No creds.json detected!*\nPlease reply to a valid `creds.json` document file, or send `.connect` as caption to a `creds.json` file.'
            }, { quoted: message });
            return;
        }

        const fileName = (targetDoc.fileName || '').toLowerCase();
        if (fileName && !fileName.endsWith('.json')) {
            await sock.sendMessage(chatId, {
                text: '❌ *Invalid File Type!* The attached file must be a JSON document (`creds.json`).'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: '⏳ *Downloading & validating credentials...*'
        }, { quoted: message });

        let buffer;
        try {
            buffer = await downloadMediaBuffer(targetDoc);
        } catch (dlErr) {
            console.error('Error downloading creds document:', dlErr);
            return await sock.sendMessage(chatId, {
                text: '❌ *Download Failed:* Could not download the document from WhatsApp.'
            }, { quoted: message });
        }

        if (!buffer || buffer.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Empty File:* The uploaded file contains no data.'
            }, { quoted: message });
        }

        // Parse and validate JSON
        let credsData;
        try {
            credsData = JSON.parse(buffer.toString('utf8'));
        } catch (_) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid JSON:* The file is not a valid JSON document.'
            }, { quoted: message });
        }

        if (!credsData || typeof credsData !== 'object' || (!credsData.noiseKey && !credsData.me && !credsData.account)) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid Credentials:* The JSON file does not contain valid Baileys session credentials.'
            }, { quoted: message });
        }

        // Find the first free slot out of 5
        const slots = getSlotsStatus();
        let targetSlot = null;

        for (const s of slots) {
            if (!s.exists || !s.valid) {
                targetSlot = s;
                break;
            }
        }

        if (!targetSlot) {
            return await sock.sendMessage(chatId, {
                text: `❌ *All 5 Session Slots Are Full!*\n\nSlots 1 to 5 are already occupied. To add a new session, delete an existing slot first:\n👉 \`.delsession <1-5>\`\nOr type \`.sessions\` to check status.`
            }, { quoted: message });
        }

        // Write creds.json into the target slot folder
        const slotDir = path.join(SESSIONS_DIR, targetSlot.slotName);
        fs.mkdirSync(slotDir, { recursive: true });
        fs.writeFileSync(path.join(slotDir, 'creds.json'), JSON.stringify(credsData, null, 2), 'utf8');

        const phoneInfo = credsData?.me?.id ? `+${credsData.me.id.split(':')[0].split('@')[0]}` : 'Unknown Number';

        // Connect in real time!
        if (typeof global.startXeonBotInc === 'function') {
            console.log(`🚀 [Multi-Session] Connecting ${targetSlot.slotName} in real time...`);
            // Start asynchronously
            global.startXeonBotInc(targetSlot.slotName).catch(err => {
                console.error(`Error starting ${targetSlot.slotName}:`, err);
            });
        }

        const occupiedCount = slots.filter(s => s.exists && s.valid).length + 1;

        await sock.sendMessage(chatId, {
            text: `✅ *Session Connected in Real-Time!*\n\n` +
                  `📌 *Assigned Slot:* \`${targetSlot.slotName}\` (Slot ${targetSlot.slot}/5)\n` +
                  `📱 *Phone:* ${phoneInfo}\n` +
                  `📊 *Occupied Slots:* ${occupiedCount}/5\n` +
                  `🟢 *Status:* Authenticating and running in real-time!\n\n` +
                  `_Type \`.sessions\` to see live status of all slots._`
        }, { quoted: message });

    } catch (error) {
        console.error('Error handling creds upload:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Error adding session:* ${error?.message || 'Operation failed'}`
        }, { quoted: message });
    }
}

/**
 * Command: .sessions - list all 5 slots
 */
async function sessionsCommand(sock, chatId, message) {
    try {
        const slots = getSlotsStatus();
        let txt = `*乂  Multi-Session Slot Manager (Max 5)  乂*\n\n`;

        for (const s of slots) {
            let statusIcon = '⚪ [Free Slot]';
            let detail = 'Available to connect';

            if (s.exists && s.valid) {
                if (s.isOnline) {
                    statusIcon = '🟢 [Online - Active]';
                    detail = s.phone ? `+${s.phone}` : 'Connected';
                } else {
                    statusIcon = '🟡 [Saved / Inactive]';
                    detail = s.phone ? `+${s.phone} (Saved)` : 'Stored credentials';
                }
            }

            txt += `*Slot ${s.slot}:* ${statusIcon}\n`;
            txt += `   └ Details: ${detail}\n\n`;
        }

        txt += `💡 *How to Connect:* Reply to any \`creds.json\` document to auto-fill the next available slot!\n`;
        txt += `🗑️ *Delete Slot:* \`.delsession <1-5>\``;

        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error('Error in sessions command:', err);
    }
}

/**
 * Command: .delsession <1-5> - free a slot
 */
async function delSessionCommand(sock, chatId, message, slotNum) {
    try {
        const isOwner = require('../lib/isOwner');
        const senderId = message.key.participant || message.key.remoteJid;
        if (!isOwner(senderId)) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Only the bot owner can delete sessions.*'
            }, { quoted: message });
        }

        const num = parseInt(slotNum, 10);
        if (isNaN(num) || num < 1 || num > 5) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid Slot Number!* Please specify a slot between 1 and 5.\nExample: `.delsession 2`'
            }, { quoted: message });
        }

        const slotName = `session${num}`;
        const slotPath = path.join(SESSIONS_DIR, slotName);

        // Stop socket if running
        if (global.activeSockets?.has(slotName)) {
            try {
                const s = global.activeSockets.get(slotName);
                s.ev.removeAllListeners();
                s.end(undefined);
                if (s.ws) s.ws.close();
            } catch (_) {}
            global.activeSockets.delete(slotName);
        }

        if (fs.existsSync(slotPath)) {
            fs.rmSync(slotPath, { recursive: true, force: true });
            await sock.sendMessage(chatId, {
                text: `🗑️ *Slot ${num} (${slotName}) Successfully Deleted!* This slot is now available.`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: `ℹ️ *Slot ${num}* was already empty.`
            }, { quoted: message });
        }
    } catch (err) {
        console.error('Error in delsession command:', err);
        await sock.sendMessage(chatId, {
            text: `❌ *Error deleting session:* ${err?.message || 'Operation failed'}`
        }, { quoted: message });
    }
}

module.exports = {
    handleCredsUpload,
    sessionsCommand,
    delSessionCommand,
    getSlotsStatus
};
