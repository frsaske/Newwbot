const { getYtVideo, cleanQuery } = require('../lib/youtube');

async function videoCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = cleanQuery(rawText);

        if (!query) {
            await sock.sendMessage(chatId, {
                text: '❌ *Usage:* `.video <video name or YouTube link>`\nExample: `.video Never Gonna Give You Up`'
            }, { quoted: message });
            return;
        }

        // Inform user that video search & download is in progress
        await sock.sendMessage(chatId, {
            text: `🎬 *Searching & preparing video:* _${query}_\n⏳ Please wait, processing stream...`
        }, { quoted: message });

        const video = await getYtVideo(query);

        // Send video directly as binary buffer
        await sock.sendMessage(chatId, {
            video: video.buffer,
            mimetype: 'video/mp4',
            fileName: video.filename || `${video.title}.mp4`,
            caption: `🎥 *${video.title}*\n⏱️ *Duration:* ${video.duration || 'N/A'}\n👤 *Channel:* ${video.author || 'YouTube'}`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO] Command Error:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: `❌ *Video Download Failed:* ${error?.message || 'Could not fetch video. Please try again later.'}`
        }, { quoted: message });
    }
}

module.exports = videoCommand;
