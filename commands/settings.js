const fs = require('fs');

function readJsonSafe(path, fallback) {
    try {
        const txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

const isOwnerOrSudo = require('../lib/isOwner');
const { isBotActive } = require('../lib/botState');

async function settingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { text: '⚠️ Only bot master/owner can use *.settings*!' }, { quoted: message });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
        const dataDir = './data';

        const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
        const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false });
        const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
        const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
        const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });
        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {}
        });
        const autoReaction = Boolean(userGroupData.autoReaction);

        const statusTag = (val) => val ? '[ ON 🟢 ]' : '[ OFF 🔴 ]';

        // Per-group features
        const groupId = isGroup ? chatId : null;
        const antilinkOn = groupId ? Boolean(userGroupData.antilink && userGroupData.antilink[groupId]) : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword && userGroupData.antibadword[groupId]) : false;
        const welcomeOn = groupId ? Boolean(userGroupData.welcome && userGroupData.welcome[groupId]) : false;
        const goodbyeOn = groupId ? Boolean(userGroupData.goodbye && userGroupData.goodbye[groupId]) : false;
        const chatbotOn = groupId ? Boolean(userGroupData.chatbot && userGroupData.chatbot[groupId]) : false;
        const antitagCfg = groupId ? (userGroupData.antitag && userGroupData.antitag[groupId]) : null;

        let groupSection = '';
        if (groupId) {
            groupSection = `
┣━━〔 👥 ɢʀᴏᴜᴘ ꜱᴇᴄᴜʀɪᴛʏ 〕━━┫
┃ 🔗 *Anti Link*     : ${antilinkOn ? `[ ON 🟢 - ${userGroupData.antilink[groupId]?.action || 'delete'} ]` : '[ OFF 🔴 ]'}
┃ 🤬 *Anti Badword*  : ${antibadwordOn ? `[ ON 🟢 - ${userGroupData.antibadword[groupId]?.action || 'delete'} ]` : '[ OFF 🔴 ]'}
┃ 🏷️ *Anti Tag*      : ${antitagCfg?.enabled ? `[ ON 🟢 - ${antitagCfg?.action || 'delete'} ]` : '[ OFF 🔴 ]'}
┃ 👋 *Welcome*       : ${statusTag(welcomeOn)}
┃ 🚪 *Goodbye*       : ${statusTag(goodbyeOn)}
┃ 💬 *Chatbot*       : ${statusTag(chatbotOn)}`;
        }

        const autoFeatures = readJsonSafe(`${dataDir}/autoFeatures.json`, { autoseen: false });
        const botActive = isBotActive();

        const card = `╭━━━〔 ⚙️ ꜱᴀꜱᴜᴋᴇ-𝐗 ꜱᴇᴛᴛɪɴɢꜱ 〕━━━╮
┃
┃ ⚡ *Global Bot*     : ${statusTag(botActive)}
┃ 🌐 *Access Mode*   : [ ${mode.isPublic ? 'PUBLIC 🟢' : 'PRIVATE 🔴'} ]
┃ 👁️ *Auto Seen*     : ${statusTag(autoFeatures.autoseen || autoStatus.enabled)}
┃ 📖 *Auto Read*     : ${statusTag(autoread.enabled)}
┃ ✍️ *Auto Typing*   : ${statusTag(autotyping.enabled)}
┃ 📵 *Anti Call*     : ${statusTag(anticall.enabled)}
┃ ✨ *Auto Reaction* : ${statusTag(autoReaction)}${groupSection}
┃
┣━━〔 💡 ᴛᴏɢɢʟᴇ ᴄᴏᴍᴍᴀɴᴅꜱ 〕━━┫
┃ ✦ .bot <on/off>
┃ ✦ .autoseen <on/off>
┃ ✦ .autoreact <on/off>
┃ ✦ .mode <public/private>
┃ ✦ .autostatus <on/off>
┃ ✦ .autoread <on/off>
┃ ✦ .autotyping <on/off>
┃ ✦ .anticall <on/off>
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: card }, { quoted: message });
    } catch (error) {
        console.error('Error in settings command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to read settings.' }, { quoted: message });
    }
}

module.exports = settingsCommand;
