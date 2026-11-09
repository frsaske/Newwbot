const { isBotActive, setBotActive } = require('../lib/botState');
const isOwnerOrSudo = require('../lib/isOwner');

async function botToggleCommand(sock, chatId, message, userMessage) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

        const parts = userMessage.trim().split(/\s+/);
        const action = parts[1]?.toLowerCase();

        const currentActive = isBotActive();

        if (action === 'on' || action === 'enable' || action === 'start') {
            if (!isOwner) {
                return sock.sendMessage(chatId, {
                    text: '❌ *Permission Denied*\nOnly the bot owner or sudo can turn the bot ON!'
                }, { quoted: message });
            }

            setBotActive(true);
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱʏꜱᴛᴇᴍ 〕━━━╮
┃
┃ 🟢 *GLOBAL BOT STATUS: ONLINE*
┃
┣━━〔 📋 ᴅᴇᴛᴀɪʟꜱ 〕━━┫
┃ ⚙️ *State*    : [ ACTIVE / RUNNING ]
┃ 🌐 *Commands* : Responding to all chats
┃ 🕒 *Time*     : ${new Date().toLocaleTimeString()}
┃ 👑 *Modified* : By Master / Sudo
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
✅ *Sasuke-X Bot has been turned ON globally.*
All commands, features, and automations are now active!`;

            return sock.sendMessage(chatId, { text: card }, { quoted: message });
        }

        if (action === 'off' || action === 'disable' || action === 'stop') {
            if (!isOwner) {
                return sock.sendMessage(chatId, {
                    text: '❌ *Permission Denied*\nOnly the bot owner or sudo can turn the bot OFF!'
                }, { quoted: message });
            }

            setBotActive(false);
            const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱʏꜱᴛᴇᴍ 〕━━━╮
┃
┃ 🔴 *GLOBAL BOT STATUS: OFFLINE*
┃
┣━━〔 📋 ᴅᴇᴛᴀɪʟꜱ 〕━━┫
┃ ⚙️ *State*    : [ PAUSED / INACTIVE ]
┃ 💤 *Commands* : Completely disabled
┃ 🕒 *Time*     : ${new Date().toLocaleTimeString()}
┃ 👑 *Modified* : By Master / Sudo
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🛑 *Sasuke-X Bot has been turned OFF globally.*
The bot will remain completely silent and will NOT respond to any commands until you turn it back on with *.bot on*.`;

            return sock.sendMessage(chatId, { text: card }, { quoted: message });
        }

        // Show status if no action or status query
        const statusText = currentActive ? '🟢 [ ACTIVE / ON ]' : '🔴 [ PAUSED / OFF ]';
        const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱᴛᴀᴛᴜꜱ 〕━━━╮
┃
┃ 🤖 *Global Bot Engine*
┃ 📡 *Current Status* : ${statusText}
┃
┣━━〔 💡 ᴄᴏɴᴛʀᴏʟꜱ 〕━━┫
┃ ✦ *.bot on*  ➔ Turn bot ON globally
┃ ✦ *.bot off* ➔ Turn bot OFF globally
┃ ✦ *.bot*     ➔ Check current status
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
${currentActive ? '⚡ Bot is running normally.' : '⚠️ Bot is currently paused. Use *.bot on* to activate.'}`;

        return sock.sendMessage(chatId, { text: card }, { quoted: message });
    } catch (error) {
        console.error('[botToggleCommand] Error:', error);
        return sock.sendMessage(chatId, {
            text: '❌ An error occurred while toggling the bot status.'
        }, { quoted: message });
    }
}

module.exports = {
    botToggleCommand
};
