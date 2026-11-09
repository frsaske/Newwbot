const fs = require('fs');
const path = require('path');

// Rich variety of popular emojis for auto-reactions
const autoReactionEmojis = [
    '🔥', '✨', '⚡', '❤️', '🖤', '👑', '💯', '🥀', '🌸', '🦋', 
    '💫', '💖', '🗿', '🕊️', '👀', '🚀', '🌟', '😈', '🦁', '💎',
    '🎉', '🎯', '🧊', '🌪️', '⚔️', '🌊', '🍀', '🍓', '🍕', '🎮',
    '🎧', '👾', '🌈', '🌙', '☀️', '⭐', '🪄', '🔮', '🧸', '💡',
    '😎', '🥳', '🤩', '🤙', '🫡', '😼', '🌹', '🍷', '🥂'
];

// File paths
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const AUTO_FEATURES = path.join(__dirname, '../data/autoFeatures.json');
const AUTO_STATUS = path.join(__dirname, '../data/autoStatus.json');

// Load auto-reaction state from file
function loadAutoReactionState() {
    try {
        if (fs.existsSync(AUTO_FEATURES)) {
            const data = JSON.parse(fs.readFileSync(AUTO_FEATURES, 'utf8'));
            if (typeof data.autoreact === 'boolean') return data.autoreact;
        }
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
            if (typeof data.autoReaction === 'boolean') return data.autoReaction;
        }
    } catch (error) {
        console.error('[reactions] Error loading auto-reaction state:', error);
    }
    return false;
}

// Global active flag
let isAutoReactionEnabled = loadAutoReactionState();

function isAutoReactionActive() {
    return isAutoReactionEnabled || loadAutoReactionState();
}

// Save auto-reaction state to config files
function saveAutoReactionState(state) {
    isAutoReactionEnabled = Boolean(state);
    try {
        // Save to userGroupData
        let ugData = {};
        if (fs.existsSync(USER_GROUP_DATA)) {
            try { ugData = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8')); } catch (_) {}
        }
        ugData.autoReaction = isAutoReactionEnabled;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(ugData, null, 2));

        // Save to autoFeatures
        let afData = {};
        if (fs.existsSync(AUTO_FEATURES)) {
            try { afData = JSON.parse(fs.readFileSync(AUTO_FEATURES, 'utf8')); } catch (_) {}
        }
        afData.autoreact = isAutoReactionEnabled;
        fs.writeFileSync(AUTO_FEATURES, JSON.stringify(afData, null, 2));

        // Sync with autoStatus so status reaction is also updated
        let asData = {};
        if (fs.existsSync(AUTO_STATUS)) {
            try { asData = JSON.parse(fs.readFileSync(AUTO_STATUS, 'utf8')); } catch (_) {}
        }
        asData.reactOn = isAutoReactionEnabled;
        fs.writeFileSync(AUTO_STATUS, JSON.stringify(asData, null, 2));
    } catch (error) {
        console.error('[reactions] Error saving auto-reaction state:', error);
    }
}

function getRandomEmoji() {
    const idx = Math.floor(Math.random() * autoReactionEmojis.length);
    return autoReactionEmojis[idx];
}

// Reacts to incoming messages with a random emoji when enabled
async function handleAutoReaction(sock, message) {
    try {
        if (!isAutoReactionActive()) return;
        if (!sock || !message?.key?.id || !message?.key?.remoteJid) return;
        
        // Skip broadcast/status messages or reactions
        if (message.key.remoteJid === 'status@broadcast') return;
        if (message.message?.protocolMessage || message.message?.reactionMessage) return;

        // Skip bot's own automated replies to avoid self-reaction loops
        if (message.key.fromMe) {
            const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            if (!raw || raw.startsWith('╭━━━') || raw.startsWith('🤖') || raw.startsWith('✅') || raw.startsWith('❌')) {
                return;
            }
        }

        const emoji = getRandomEmoji();
        const reactionKey = {
            remoteJid: message.key.remoteJid,
            id: message.key.id,
            fromMe: Boolean(message.key.fromMe)
        };

        if (message.key.remoteJid.endsWith('@g.us') && message.key.participant) {
            reactionKey.participant = message.key.participant;
        }

        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: reactionKey
            }
        });
    } catch (_) {
        // Suppress rate limit or ephemeral reaction errors
    }
}

// Backward compatibility for command reactions
async function addCommandReaction(sock, message) {
    return handleAutoReaction(sock, message);
}

// Command handler for .areact / .autoreact
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Permission Denied*\nThis command is only available for the owner or sudo!',
                quoted: message
            });
            return;
        }

        const raw = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        const args = raw.trim().split(/\s+/);
        const action = args[1]?.toLowerCase();

        if (action === 'on' || action === 'enable' || action === '1') {
            saveAutoReactionState(true);
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ ✨ *AUTO-REACTION: ACTIVATED*
┃
┣━━〔 📋 ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ 🎭 *Mode*     : Global Random Reaction
┃ 🎯 *Target*   : Every Incoming Message & Status
┃ 🟢 *State*    : [ ON / ENABLED ]
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
✅ Auto-reactions have been enabled! All incoming messages will receive random reactions.`;
            await sock.sendMessage(chatId, { text: card }, { quoted: message });
        } else if (action === 'off' || action === 'disable' || action === '0') {
            saveAutoReactionState(false);
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ ✨ *AUTO-REACTION: DEACTIVATED*
┃
┣━━〔 📋 ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ 🎭 *Mode*     : Global Random Reaction
┃ 🔴 *State*    : [ OFF / DISABLED ]
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🛑 Auto-reactions have been disabled globally.`;
            await sock.sendMessage(chatId, { text: card }, { quoted: message });
        } else {
            const currentState = isAutoReactionActive() ? 'ON 🟢' : 'OFF 🔴';
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ ✨ *AUTO-REACTION SETTINGS*
┃ 📡 *Current Status* : [ ${currentState} ]
┃
┣━━〔 💡 ᴄᴏᴍᴍᴀɴᴅꜱ 〕━━┫
┃ ✦ *.autoreact on*  ➔ Enable reactions
┃ ✦ *.autoreact off* ➔ Disable reactions
┃ ✦ *.autoreact*     ➔ View status
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(chatId, { text: card }, { quoted: message });
        }
    } catch (error) {
        console.error('[reactions] Error handling areact command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error controlling auto-reactions.',
            quoted: message
        });
    }
}

module.exports = {
    handleAutoReaction,
    addCommandReaction,
    handleAreactCommand,
    isAutoReactionEnabled: isAutoReactionActive,
    setAutoReactionEnabled: (state) => {
        saveAutoReactionState(Boolean(state));
    },
    getRandomEmoji
};
