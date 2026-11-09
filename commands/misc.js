const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const settings = require('../settings');

let downloadContentFromMessage;
try {
    downloadContentFromMessage = require('@whiskeysockets/baileys').downloadContentFromMessage;
} catch (_) {}

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

/**
 * Sanitizes JID to a clean user JID (e.g. 917052500819@s.whatsapp.net)
 */
function sanitizeUserJid(jid) {
    if (!jid || typeof jid !== 'string') return null;
    if (jid.endsWith('@g.us')) return null; // Never treat a group JID as a user
    const num = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!num || num.length < 5) return null;
    return `${num}@s.whatsapp.net`;
}

/**
 * Resolves the target user JID from message context, mentions, quote, or sender
 */
function resolveTargetUser(sock, message, chatId) {
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    
    // 1. Mentioned user
    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
        const jid = sanitizeUserJid(ctx.mentionedJid[0]);
        if (jid) return jid;
    }

    // 2. Quoted message author
    if (ctx?.participant) {
        const jid = sanitizeUserJid(ctx.participant);
        if (jid) return jid;
    }

    // 3. Sender of current message
    if (message.key.fromMe) {
        if (sock.user?.id) {
            const jid = sanitizeUserJid(sock.user.id);
            if (jid) return jid;
        }
        if (settings.ownerNumber) {
            return `${settings.ownerNumber}@s.whatsapp.net`;
        }
    } else {
        const sender = message.key.participant || message.key.remoteJid;
        const jid = sanitizeUserJid(sender);
        if (jid) return jid;
    }

    // 4. Default fallback
    if (chatId.endsWith('@s.whatsapp.net')) {
        return sanitizeUserJid(chatId);
    }

    return null;
}

/**
 * Retrieves buffer from quoted image, direct message image, or user profile picture
 */
async function getImageBuffer(sock, message, targetJid) {
    // 1. Quoted image
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage && typeof downloadContentFromMessage === 'function') {
        try {
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            if (chunks.length > 0) return Buffer.concat(chunks);
        } catch (_) {}
    }

    // 2. Direct image attached to current message
    if (message.message?.imageMessage && typeof downloadContentFromMessage === 'function') {
        try {
            const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            if (chunks.length > 0) return Buffer.concat(chunks);
        } catch (_) {}
    }

    // 3. Target user avatar from WhatsApp CDN
    if (targetJid) {
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (_) {
            try {
                ppUrl = await sock.profilePictureUrl(targetJid, 'preview');
            } catch (_) {}
        }

        if (ppUrl) {
            try {
                const res = await axios.get(ppUrl, {
                    responseType: 'arraybuffer',
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                if (res.data && res.data.length > 100) {
                    return Buffer.from(res.data);
                }
            } catch (_) {}
        }
    }

    // 4. Fallback generated avatar
    const letter = (targetJid || 'U').split('@')[0].charAt(0).toUpperCase() || 'U';
    const tmpFb = path.join('/tmp', `fallback_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`);
    try {
        execSync(`convert -size 512x512 gradient:"#667eea"-"#764ba2" -font "${FONT_PATH}" -pointsize 150 -fill white -gravity center -annotate +0+0 "${letter}" "${tmpFb}"`);
        return fs.readFileSync(tmpFb);
    } finally {
        try { if (fs.existsSync(tmpFb)) fs.unlinkSync(tmpFb); } catch (_) {}
    }
}

/**
 * Applies ImageMagick filter overlay on input image buffer
 */
function applyCanvasOverlay(inputBuffer, type, username = 'User') {
    const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const inPath = path.join('/tmp', `misc_in_${id}.png`);
    const outPath = path.join('/tmp', `misc_out_${id}.png`);
    const rainbowPath = path.join('/tmp', `rainbow_${id}.png`);

    fs.writeFileSync(inPath, inputBuffer);
    const safeUser = (username || 'User').replace(/[^a-zA-Z0-9_]/g, '');

    try {
        if (type === 'gay') {
            // Generate clean pride gradient and composite over image
            execSync(`convert -size 512x512 gradient:red-orange-yellow-green-blue-purple -alpha set -channel A -evaluate set 42% "${rainbowPath}"`);
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 "${rainbowPath}" -compose over -composite "${outPath}"`);
        } else if (type === 'heart') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 -fill "rgba(255,105,180,0.2)" -stroke "#ff1493" -strokewidth 12 -draw "roundrectangle 16,16 496,496 32,32" -font "${FONT_PATH}" -pointsize 26 -fill "#ff1493" -gravity south -background "rgba(0,0,0,0.8)" -splice 0x60 -annotate +0+15 "💖 IN LOVE WITH YOU 💖" "${outPath}"`);
        } else if (type === 'horny') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 -stroke "#ff3366" -strokewidth 12 -draw "roundrectangle 16,16 496,496 32,32" -font "${FONT_PATH}" -pointsize 26 -fill "#ff3366" -gravity south -background "rgba(0,0,0,0.85)" -splice 0x60 -annotate +0+15 "🔥 CERTIFIED HORNY PASS 🔥" "${outPath}"`);
        } else if (type === 'simp') {
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 -stroke "#00e5ff" -strokewidth 12 -draw "roundrectangle 16,16 496,496 32,32" -font "${FONT_PATH}" -pointsize 24 -fill "#00e5ff" -gravity south -background "rgba(0,0,0,0.85)" -splice 0x60 -annotate +0+15 "OFFICIAL SIMP CARD: @${safeUser}" "${outPath}"`);
        } else {
            // Default rounded frame
            execSync(`convert "${inPath}" -resize 512x512^ -gravity center -extent 512x512 -stroke "#ffffff" -strokewidth 10 -draw "roundrectangle 16,16 496,496 32,32" "${outPath}"`);
        }

        return fs.readFileSync(outPath);
    } finally {
        try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath); } catch (_) {}
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {}
        try { if (fs.existsSync(rainbowPath)) fs.unlinkSync(rainbowPath); } catch (_) {}
    }
}

/**
 * Universal handler for Misc avatar effects (.heart, .horny, .gay, .simp)
 */
async function handleMiscEffect(sock, chatId, message, type) {
    try {
        const targetJid = resolveTargetUser(sock, message, chatId);
        const username = targetJid ? targetJid.split('@')[0] : 'User';

        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (_) {}

        const baseBuffer = await getImageBuffer(sock, message, targetJid);
        const processedBuffer = applyCanvasOverlay(baseBuffer, type, username);

        const captions = {
            heart: `💖 *Lovely Heart Filter* for @${username}`,
            horny: `🔥 *Certified Horny Pass Issued* to @${username}`,
            gay: `🌈 *Pride Rainbow Filter* for @${username}`,
            simp: `💳 *Official Simp Card Issued* to @${username}`
        };

        const caption = captions[type] || `✨ Effect for @${username}`;
        const mentions = (targetJid && targetJid.endsWith('@s.whatsapp.net')) ? [targetJid] : [];

        return await sock.sendMessage(chatId, {
            image: processedBuffer,
            caption,
            mentions
        }, { quoted: message });

    } catch (error) {
        console.error(`Error in handleMiscEffect (${type}):`, error);
        return sock.sendMessage(chatId, {
            text: `❌ Could not process the .${type} command. Please try again!`
        }, { quoted: message });
    }
}

async function handleHeart(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'heart');
}

async function handleHorny(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'horny');
}

async function handleGay(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'gay');
}

async function handleSimp(sock, chatId, message) {
    return handleMiscEffect(sock, chatId, message, 'simp');
}

async function miscCommand(sock, chatId, message, args) {
    const sub = (args && args[0] ? args[0] : '').toLowerCase();
    if (['heart', 'horny', 'gay', 'simp'].includes(sub)) {
        return handleMiscEffect(sock, chatId, message, sub);
    }
    return sock.sendMessage(chatId, {
        text: '╭━━━〔 ✧ *MISC COMMANDS* 〕━━━╮\n┃\n┃ ✦ *.heart [@user]* ➔ Lovely heart filter\n┃ ✦ *.horny [@user]* ➔ Certified horny pass\n┃ ✦ *.gay [@user]*   ➔ Rainbow pride overlay\n┃ ✦ *.simp [@user]*  ➔ Official simp card\n┃ ✦ *.topmembers*    ➔ Group leaderboard\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯'
    }, { quoted: message });
}

module.exports = {
    miscCommand,
    handleHeart,
    handleHorny,
    handleGay,
    handleSimp,
    handleMiscEffect
};
