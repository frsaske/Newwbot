const fs = require('fs');
const path = require('path');
const settings = require('../settings');

async function ownerCommand(sock, chatId, message) {
    const text = `╭━━━〔 👑 ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴀꜱᴛᴇʀ 〕━━━╮
┃
┃ 👤 *Developer* : ${settings.botOwner || 'ꜰʀsᴀsᴋᴇ'}
┃ 📞 *Contact*   : +${settings.ownerNumber || '917052500819'}
┃ 🤖 *Bot Core*  : ${settings.botName || 'ꜱᴀꜱᴜᴋᴇ-𝐗'}
┃ 🔖 *Release*   : v${settings.version || '0.1'} Premium
┃ 📢 *Channel*   : ${settings.channelLink || 'https://whatsapp.com/channel/0029VbDsHPCId7nRSI0Fce2W'}
┃
┣━━〔 💬 ꜱᴜᴘᴘᴏʀᴛ & ɪɴꜰᴏ 〕━━┫
┃ ✦ Official multi-device WhatsApp automation
┃   crafted for performance, media & security.
┃ ✦ Reach out for deployment & custom commands.
┃ ✦ Direct vCard contact attached below!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${settings.botOwner || 'ꜰʀsᴀsᴋᴇ'}
TEL;waid=${settings.ownerNumber}:+${settings.ownerNumber}
END:VCARD
`.trim();

    const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
    const payload = fs.existsSync(imagePath)
        ? { image: fs.readFileSync(imagePath), caption: text }
        : { text };

    // Send owner card
    await sock.sendMessage(chatId, payload, { quoted: message });

    // Send attached vCard contact
    await sock.sendMessage(chatId, {
        contacts: {
            displayName: settings.botOwner || 'ꜰʀsᴀsᴋᴇ',
            contacts: [{ vcard }]
        }
    }, { quoted: message });
}

module.exports = ownerCommand;
