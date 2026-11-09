const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
        }
    }
};

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ 
        enabled: false, 
        reactOn: false 
    }, null, 2));
}

// Function to check if auto status is enabled
function isAutoStatusEnabled() {
    try {
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.enabled) return true;
    } catch (_) {}

    // Check if autoseen is enabled in autoFeatures.json
    try {
        const afPath = path.join(__dirname, '../data/autoFeatures.json');
        if (fs.existsSync(afPath)) {
            const af = JSON.parse(fs.readFileSync(afPath, 'utf8'));
            if (af.autoseen) return true;
        }
    } catch (_) {}

    return false;
}

// Function to check if status reactions are enabled
function isStatusReactionEnabled() {
    try {
        if (!fs.existsSync(configPath)) return false;
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.reactOn) return true;
    } catch (_) {}

    // Check if autoreact is active globally
    try {
        const reactions = require('../lib/reactions');
        if (reactions.isAutoReactionEnabled && reactions.isAutoReactionEnabled()) {
            return true;
        }
    } catch (_) {}

    return false;
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = msg.key.fromMe || (await isOwnerOrSudo(senderId, sock, chatId));
        
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Permission Denied*\nThis command can only be used by the bot owner or sudo!',
                ...channelInfo
            }, { quoted: msg });
            return;
        }

        // Read current config
        let config = { enabled: false, reactOn: false };
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) {}

        // If no arguments, show current status
        if (!args || args.length === 0) {
            const status = isAutoStatusEnabled() ? 'ON 🟢' : 'OFF 🔴';
            const reactStatus = isStatusReactionEnabled() ? 'ON 🟢' : 'OFF 🔴';
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ 📱 *AUTO-STATUS SETTINGS*
┃
┣━━〔 📋 ᴄᴜʀʀᴇɴᴛ ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ 👁️ *Auto View Status* : [ ${status} ]
┃ 💫 *Status Reactions*  : [ ${reactStatus} ]
┃
┣━━〔 💡 ᴄᴏᴍᴍᴀɴᴅꜱ 〕━━┫
┃ ✦ *.autostatus on*        ➔ Enable auto-view
┃ ✦ *.autostatus off*       ➔ Disable auto-view
┃ ✦ *.autostatus react on*  ➔ Enable reactions
┃ ✦ *.autostatus react off* ➔ Disable reactions
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(chatId, { text: card, ...channelInfo }, { quoted: msg });
            return;
        }

        // Handle on/off commands
        const command = args[0].toLowerCase();
        
        if (command === 'on' || command === 'enable') {
            config.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '✅ *Auto Status View Enabled!*\nThe bot will now automatically view all contact status updates.',
                ...channelInfo
            }, { quoted: msg });
        } else if (command === 'off' || command === 'disable') {
            config.enabled = false;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(chatId, { 
                text: '🛑 *Auto Status View Disabled!*\nThe bot will no longer automatically view statuses.',
                ...channelInfo
            }, { quoted: msg });
        } else if (command === 'react') {
            const reactCommand = args[1]?.toLowerCase();
            if (reactCommand === 'on' || reactCommand === 'enable') {
                config.reactOn = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '💫 *Status Reactions Enabled!*\nThe bot will now react with emojis to all status updates.',
                    ...channelInfo
                }, { quoted: msg });
            } else if (reactCommand === 'off' || reactCommand === 'disable') {
                config.reactOn = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await sock.sendMessage(chatId, { 
                    text: '🛑 *Status Reactions Disabled!*\nThe bot will no longer react to status updates.',
                    ...channelInfo
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'Usage: *.autostatus react on/off*',
                    ...channelInfo
                }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(chatId, { 
                text: 'Usage:\n• *.autostatus on/off*\n• *.autostatus react on/off*',
                ...channelInfo
            }, { quoted: msg });
        }

    } catch (error) {
        console.error('[autostatus] Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error: ' + error.message,
            ...channelInfo
        }, { quoted: msg });
    }
}

// Function to react to status using relayMessage
async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled() || !statusKey?.id) {
            return;
        }

        let emoji = '💚';
        try {
            const reactions = require('../lib/reactions');
            if (typeof reactions.getRandomEmoji === 'function') {
                emoji = reactions.getRandomEmoji();
            }
        } catch (_) {}

        const participant = statusKey.participant || statusKey.remoteJid;

        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: participant,
                        fromMe: false
                    },
                    text: emoji
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid || 'status@broadcast', participant]
            }
        );
    } catch (_) {
        // Silently catch ephemeral/rate-limit reaction issues
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        if (!sock || !isAutoStatusEnabled()) {
            return;
        }

        // Add minor debounce to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));

        // Handle status from messages.upsert
        if (status.messages && status.messages.length > 0) {
            for (const msg of status.messages) {
                if (msg?.key && msg.key.remoteJid === 'status@broadcast') {
                    try {
                        const statusKey = {
                            remoteJid: 'status@broadcast',
                            id: msg.key.id,
                            participant: msg.key.participant || msg.key.remoteJid
                        };
                        await sock.readMessages([statusKey]);
                        await reactToStatus(sock, msg.key);
                    } catch (_) {}
                }
            }
            return;
        }

        // Handle direct status key
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            try {
                const statusKey = {
                    remoteJid: 'status@broadcast',
                    id: status.key.id,
                    participant: status.key.participant || status.key.remoteJid
                };
                await sock.readMessages([statusKey]);
                await reactToStatus(sock, status.key);
            } catch (_) {}
            return;
        }

        // Handle status in reactions
        if (status.reaction && status.reaction.key?.remoteJid === 'status@broadcast') {
            try {
                const statusKey = {
                    remoteJid: 'status@broadcast',
                    id: status.reaction.key.id,
                    participant: status.reaction.key.participant || status.reaction.key.remoteJid
                };
                await sock.readMessages([statusKey]);
                await reactToStatus(sock, status.reaction.key);
            } catch (_) {}
            return;
        }

    } catch (error) {
        // Silently handle
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled
};
