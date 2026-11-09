async function groupInfoCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        
        let pp;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
        } catch {
            pp = 'https://i.imgur.com/2wzGhpF.jpeg';
        }

        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(p => p.admin);
        const adminLines = groupAdmins.length > 0
            ? groupAdmins.map((v, i) => `┃  ${i + 1}. @${v.id.split('@')[0]}${v.admin === 'superadmin' ? ' (Founder)' : ''}`).join('\n')
            : '┃  No admins found';
        
        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || chatId.split('-')[0] + '@s.whatsapp.net';

        const desc = (groupMetadata.desc?.toString() || 'No group description set.')
            .split('\n')
            .map(line => `┃  ${line}`)
            .slice(0, 5)
            .join('\n');

        const card = `╭━━━〔 👥 ɢʀᴏᴜᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 〕━━━╮
┃
┃ 🏷️ *Group Name*    : ${groupMetadata.subject}
┃ 🆔 *Group ID*      : ${groupMetadata.id}
┃ 👥 *Total Members* : ${participants.length}
┃ 👑 *Group Owner*   : @${owner.split('@')[0]}
┃
┣━━〔 🛡️ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ (${groupAdmins.length}) 〕━━┫
${adminLines}
┃
┣━━〔 📝 ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ 〕━━┫
${desc}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: card,
            mentions: [...groupAdmins.map(v => v.id), owner]
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in groupinfo command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to retrieve group information.' }, { quoted: msg });
    }
}

module.exports = groupInfoCommand;
