const { getYtAudio, cleanQuery } = require('../lib/youtube');

async function songCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = cleanQuery(rawText);

        if (!query) {
            await sock.sendMessage(chatId, {
                text: '❌ *Usage:* `.song <song name or YouTube link>`\nExample: `.song Faded Alan Walker`'
            }, { quoted: message });
            return;
        }

        // Inform user that download is in progress
        await sock.sendMessage(chatId, {
            text: `🔎 *Searching & preparing music player:* _${query}_\n⏳ Please wait...`
        }, { quoted: message });

        const audio = await getYtAudio(query);

        // Rich WhatsApp Music Player Card
        const externalAdReply = {
            title: audio.title || 'Song Player',
            body: `${audio.author || 'Artist'} • ${audio.duration || 'Audio Track'}`,
            mediaType: 2,
            thumbnailUrl: audio.thumbnail || undefined,
            sourceUrl: audio.url || 'https://youtube.com',
            mediaUrl: audio.url || 'https://youtube.com',
            renderLargerThumbnail: true,
            showAdAttribution: true
        };

        // Send audio directly with player card
        await sock.sendMessage(chatId, {
            audio: audio.buffer,
            mimetype: 'audio/mpeg',
            fileName: audio.filename || `${audio.title}.mp3`,
            ptt: false,
            contextInfo: { externalAdReply }
        }, { quoted: message });

    } catch (err) {
        console.error('Song command error:', err);
        const errMsg = err?.message || 'Download failed. Please try again later.';
        await sock.sendMessage(chatId, {
            text: `❌ *Audio Download Failed:* ${errMsg}`
        }, { quoted: message });
    }
}

module.exports = songCommand;