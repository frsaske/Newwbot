const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');
const { sections } = require('./registry');

function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

function getMode() {
    try {
        const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf8'));
        return data.isPublic !== false ? 'PUBLIC' : 'PRIVATE';
    } catch (_) {
        return 'PUBLIC';
    }
}

function generateAliveCard() {
    const uptime = formatUptime(process.uptime());
    const usedBytes = process.memoryUsage().rss;
    const totalBytes = os.totalmem();
    const usedMB = Math.round(usedBytes / (1024 * 1024));
    const totalMB = Math.round(totalBytes / (1024 * 1024));
    const totalCmdCount = Object.values(sections).reduce((acc, s) => acc + s.commands.length, 0);
    const mode = getMode();

    return `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ɪꜱ ᴀʟɪᴠᴇ ⚡ 〕━━━╮
┃
┃ 🤖 *Status*    : Operational & Online 🟢
┃ 👑 *Master*    : ${settings.botOwner || 'ꜰʀsᴀsᴋᴇ'}
┃ ⏱️ *Uptime*    : ${uptime}
┃ 💾 *RAM Usage* : ${usedMB} MB / ${totalMB} MB
┃ 🌐 *Mode*      : ${mode}
┃ 📁 *Features*  : ${totalCmdCount} Active Commands
┃ 🔖 *Version*   : v${settings.version || '0.1'}
┃
┣━━〔 ⚔️ ꜱʏꜱᴛᴇᴍ ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ ✦ _"I have long since closed my eyes..._
┃   _My only goal is in the darkness."_
┃
┃ ✦ All sub-systems running at peak performance.
┃ ✦ Type *.menu* to view command directory.
┃ ✦ Type *.ping* to test live server latency.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

async function aliveCommand(sock, chatId, message) {
    try {
        const text = generateAliveCard();
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

        const payload = fs.existsSync(imagePath)
            ? { image: fs.readFileSync(imagePath), caption: text }
            : { text };

        await sock.sendMessage(chatId, payload, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: generateAliveCard() }, { quoted: message });
    }
}

module.exports = aliveCommand;
module.exports.generateAliveCard = generateAliveCard;
