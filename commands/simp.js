const { handleSimp } = require('./misc');

async function simpCommand(sock, chatId, messageOrQuoted, mentionedJid, sender) {
    // When invoked with full message object: simpCommand(sock, chatId, message)
    if (messageOrQuoted?.key) {
        return handleSimp(sock, chatId, messageOrQuoted);
    }
    // When invoked with (sock, chatId, quotedMsg, mentionedJid, senderId)
    const synthesizedMessage = {
        key: {
            remoteJid: chatId,
            participant: sender || chatId
        },
        message: {
            extendedTextMessage: {
                contextInfo: {
                    quotedMessage: messageOrQuoted,
                    mentionedJid: mentionedJid || [],
                    participant: messageOrQuoted?.sender || (mentionedJid && mentionedJid[0]) || sender
                }
            }
        }
    };
    return handleSimp(sock, chatId, synthesizedMessage);
}

module.exports = { simpCommand };