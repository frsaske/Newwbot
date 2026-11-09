const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

function loadMessageCounts() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (_) {}
    return {};
}

function saveMessageCounts(messageCounts) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
    } catch (_) {}
}

function incrementMessageCount(groupId, userId) {
    if (!groupId || !userId) return;
    const messageCounts = loadMessageCounts();

    if (!messageCounts[groupId] || typeof messageCounts[groupId] !== 'object') {
        messageCounts[groupId] = {};
    }

    const cleanUser = userId.split('@')[0].split(':')[0] + '@s.whatsapp.net';

    if (!messageCounts[groupId][cleanUser]) {
        messageCounts[groupId][cleanUser] = 0;
    }

    messageCounts[groupId][cleanUser] += 1;

    saveMessageCounts(messageCounts);
}

async function topMembers(sock, chatId, isGroup, message) {
    if (!isGroup) {
        return sock.sendMessage(chatId, { text: '❌ This command is only available in group chats!' }, { quoted: message });
    }

    const messageCounts = loadMessageCounts();
    const groupCounts = messageCounts[chatId] || {};

    // Filter out non-user keys such as isPublic
    const validEntries = Object.entries(groupCounts).filter(([key, val]) => typeof val === 'number' && key.includes('@'));

    const sortedMembers = validEntries
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    if (sortedMembers.length === 0) {
        return sock.sendMessage(chatId, { 
            text: '📊 *No message activity recorded in this group yet!*\nSend some messages to start the leaderboard!' 
        }, { quoted: message });
    }

    const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️'];
    let text = `╭━━━〔 🏆 *GROUP LEADERBOARD* 〕━━━╮\n┃\n`;
    sortedMembers.forEach(([userId, count], index) => {
        const medal = medals[index] || '🎖️';
        const phone = userId.split('@')[0];
        text += `┃ ${medal} *${index + 1}.* @${phone} ➔ *${count}* msgs\n`;
    });
    text += `┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    const mentions = sortedMembers.map(([userId]) => userId);
    return sock.sendMessage(chatId, { text, mentions }, { quoted: message });
}

module.exports = { incrementMessageCount, topMembers };
