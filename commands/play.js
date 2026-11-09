const { getYtAudio, cleanQuery } = require('../lib/youtube');

async function playCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = cleanQuery(rawText);

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Usage:* `.play <song name or YouTube link>`\nExample: `.play Believer Imagine Dragons`'
            }, { quoted: message });
        }

        // Send progress message
        await sock.sendMessage(chatId, {
            text: `🎵 *Searching & loading music player:* _${query}_\n⏳ Please wait a moment...`
        }, { quoted: message });

        const audio = await getYtAudio(query);

        // Rich WhatsApp Music Player Card
        const externalAdReply = {
            title: audio.title || 'Now Playing',
            body: `${audio.author || 'Artist'} • ${audio.duration || 'HQ Audio'}`,
            mediaType: 2, // Audio/Music player format
            thumbnailUrl: audio.thumbnail || undefined,
            sourceUrl: audio.url || 'https://youtube.com',
            mediaUrl: audio.url || 'https://youtube.com',
            renderLargerThumbnail: true,
            showAdAttribution: true
        };

        // Send audio with integrated player card
        await sock.sendMessage(chatId, {
            audio: audio.buffer,
            mimetype: 'audio/mpeg',
            fileName: audio.filename || `${audio.title}.mp3`,
            ptt: false,
            contextInfo: { externalAdReply }
        }, { quoted: message });

    } catch (error) {
        console.error('Error in play command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Play Failed:* ${error?.message || 'Could not fetch song. Please try another title.'}`
        }, { quoted: message });
    }
}

module.exports = playCommand;