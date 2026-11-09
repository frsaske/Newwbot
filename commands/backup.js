const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const settings = require('../settings');

/**
 * Checks if sender is strictly the bot owner
 */
function isStrictOwner(senderId, message) {
    if (message.key?.fromMe) return true;
    const cleanSender = (senderId || '').split(':')[0].split('@')[0];
    const cleanOwner = (settings.ownerNumber || '').split(':')[0].split('@')[0];
    if (cleanSender && cleanOwner && cleanSender === cleanOwner) return true;

    try {
        const configuredOwners = JSON.parse(fs.readFileSync('./data/owners.json', 'utf8'));
        if (Array.isArray(configuredOwners) && configuredOwners.map(String).includes(cleanSender)) {
            return true;
        }
    } catch (_) {}

    return false;
}

async function backupCommand(sock, chatId, message, senderId) {
    try {
        const sender = senderId || message.key?.participant || message.key?.remoteJid;
        const isOwner = isStrictOwner(sender, message);

        if (!isOwner) {
            return sock.sendMessage(chatId, {
                text: '❌ *Access Denied:* Only the bot owner can request the source code backup.'
            }, { quoted: message });
        }

        const ownerClean = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
        const ownerDmJid = `${ownerClean}@s.whatsapp.net`;
        const isGroupChat = chatId.endsWith('@g.us');

        await sock.sendMessage(chatId, {
            text: '📦 *Creating source code ZIP archive... Sending to Owner DM.*'
        }, { quoted: message });

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const zipFilename = `SasukeX-SourceCode-${Date.now()}.zip`;
        const zipPath = path.join(tempDir, zipFilename);

        const projectRoot = path.join(__dirname, '..');
        // Package pure bot files and exclude temporary/credentials/build dirs
        const cmd = `cd "${projectRoot}" && zip -r "${zipPath}" commands lib data assets index.js main.js settings.js package.json config.js setup-vps.sh start-vps.sh README.md -x "assets/tts-*" -x "data/session*" -x "data/temp*"`;
        execSync(cmd, { stdio: 'ignore', timeout: 15000 });

        if (!fs.existsSync(zipPath)) {
            throw new Error('Failed to generate ZIP archive');
        }

        const zipBuffer = fs.readFileSync(zipPath);
        const fileSizeKB = Math.round(zipBuffer.length / 1024);

        // Send ZIP directly to Owner's DM
        await sock.sendMessage(ownerDmJid, {
            document: zipBuffer,
            fileName: zipFilename,
            mimetype: 'application/zip',
            caption: `╭━━━〔 📦 *BOT SOURCE CODE BACKUP* 〕━━━╮\n┃\n┃ 👑 *Recipient:* Bot Owner\n┃ 📁 *File:* ${zipFilename}\n┃ 💾 *Size:* ${fileSizeKB} KB\n┃ 🕒 *Generated:* ${new Date().toLocaleString()}\n┃ 🔒 *Confidential:* Delivered exclusively to Owner DM\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
        });

        // If command was executed in group or a different chat, send confirmation
        if (isGroupChat) {
            await sock.sendMessage(chatId, {
                text: `✅ *Source code ZIP sent directly to Owner's DM!* (@${ownerClean})\n🔒 *File size:* ${fileSizeKB} KB`,
                mentions: [ownerDmJid]
            }, { quoted: message });
        } else if (chatId !== ownerDmJid) {
            await sock.sendMessage(chatId, {
                text: `✅ *Source code ZIP sent directly to Owner's private DM.* (@${ownerClean})`,
                mentions: [ownerDmJid]
            }, { quoted: message });
        }

        setTimeout(() => {
            try {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            } catch (_) {}
        }, 5000);

    } catch (error) {
        console.error('Error in backupCommand:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to generate source code backup. Please check logs and try again.'
        }, { quoted: message });
    }
}

module.exports = { backupCommand };
