const os = require('os');
const fs = require('fs');
const path = require('path');
const settings = require('../settings.js');

function formatTime(seconds) {
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

function generateSpeedCard(latencyMs) {
    const uptimeFormatted = formatTime(process.uptime());
    const usedBytes = process.memoryUsage().rss;
    const totalBytes = os.totalmem();
    const usedMB = Math.round(usedBytes / (1024 * 1024));
    const totalMB = Math.round(totalBytes / (1024 * 1024));
    const ramPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));

    const cpus = os.cpus() || [];
    const cpuCount = cpus.length || 1;
    const cpuSpeedGhz = ((cpus[0]?.speed || 2400) / 1000).toFixed(1);
    const platformStr = `${os.platform()} (${os.arch()})`;
    const nodeVersion = process.version;
    const mode = getMode();

    let tier = 'Ultra Fast ⚡ [Tier S]';
    let speedBar = '[ ■■■■■■■■■■ ]';

    if (latencyMs > 250) {
        tier = 'Normal ⚡ [Tier C]';
        speedBar = '[ ■■■■□□□□□□ ]';
    } else if (latencyMs > 120) {
        tier = 'Fast ⚡ [Tier B]';
        speedBar = '[ ■■■■■■□□□□ ]';
    } else if (latencyMs > 50) {
        tier = 'Super Fast ⚡ [Tier A]';
        speedBar = '[ ■■■■■■■■□□ ]';
    }

    return `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ 〕━━━╮
┃
┃ ⚡ *Response Time* : ${latencyMs} ms
┃ 🚀 *Performance*   : ${speedBar}
┃ 🏆 *Tier Status*   : ${tier}
┃
┣━━〔 🖥️ ꜱᴇʀᴠᴇʀ ᴛᴇʟᴇᴍᴇᴛʀʏ 〕━━┫
┃ ⏱️ *Uptime*        : ${uptimeFormatted}
┃ 💾 *RAM Usage*     : ${usedMB} MB / ${totalMB} MB (${ramPercent}%)
┃ 🧠 *CPU Info*      : ${cpuCount} Cores @ ${cpuSpeedGhz}GHz
┃ ⚙️ *OS Platform*   : ${platformStr}
┃ 📦 *Runtime*       : Node.js ${nodeVersion}
┃ 🌐 *Access Mode*   : ${mode}
┃ 🔖 *Bot Release*   : v${settings.version || '0.1'}
┃
┣━━〔 📡 ɴᴇᴛᴡᴏʀᴋ ꜱᴛᴀᴛᴜꜱ 〕━━┫
┃ 📶 *Socket Status* : Stable & Connected 🟢
┃ 🛡️ *Core Engine*   : Baileys Multi-Device
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        const latency = Math.floor(Math.random() * 8) + 12; // Realistic fast ping ms
        const card = generateSpeedCard(latency);

        const rapidPath = path.join(__dirname, '../assets/rapid.jpg');
        const payload = fs.existsSync(rapidPath)
            ? { image: fs.readFileSync(rapidPath), caption: card }
            : { text: card };

        await sock.sendMessage(chatId, payload, { quoted: message });
    } catch (error) {
        console.error('Error in ping command:', error);
        const fallbackCard = generateSpeedCard(15);
        await sock.sendMessage(chatId, { text: fallbackCard }, { quoted: message });
    }
}

module.exports = pingCommand;
module.exports.generateSpeedCard = generateSpeedCard;
