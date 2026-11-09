/**
 * Sanitizes WhatsApp JID by stripping multi-device indexes (e.g. 12345:1@s.whatsapp.net -> 12345@s.whatsapp.net)
 */
function sanitizeJid(jid) {
    if (!jid || typeof jid !== 'string') return null;
    const cleanNumber = jid.split('@')[0].split(':')[0];
    const domain = jid.endsWith('@g.us') ? '@g.us' : '@s.whatsapp.net';
    return `${cleanNumber}${domain}`;
}

async function dpCommand(sock, chatId, message, userMessage = '') {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo;
        const mentioned = quoted?.mentionedJid || message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        
        // Extract raw arguments after .dp
        const rawArgs = (userMessage || '').replace(/^\.?dp\s*/i, '').trim();

        let target = null;
        let isGroupTarget = false;

        // 1. Check for group DP request
        if (rawArgs.toLowerCase() === 'group' || rawArgs.toLowerCase() === 'gc' || rawArgs.toLowerCase() === 'gp') {
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '❌ This command can only show group DP inside a group chat!' }, { quoted: message });
            }
            target = chatId;
            isGroupTarget = true;
        }
        // 2. Check for @mentions
        else if (mentioned && mentioned.length > 0) {
            target = sanitizeJid(mentioned[0]);
        }
        // 3. Check for quoted message sender
        else if (quoted?.participant) {
            target = sanitizeJid(quoted.participant);
        }
        // 4. Check for direct phone number argument (e.g. .dp 919876543210 or .dp +91...)
        else if (rawArgs.replace(/[^0-9]/g, '').length >= 7) {
            const num = rawArgs.replace(/[^0-9]/g, '');
            target = `${num}@s.whatsapp.net`;
        }
        // 5. In 1-on-1 DM chat with no arguments, fetch other participant
        else if (chatId.endsWith('@s.whatsapp.net') && !message.key.fromMe) {
            target = sanitizeJid(chatId);
        }
        // 6. Otherwise in a group with no arguments or in self-chat, default to sender's own DP
        else {
            const sender = message.key.participant || message.key.remoteJid;
            target = sanitizeJid(sender);
        }

        if (!target) {
            return sock.sendMessage(chatId, {
                text: '❌ *Usage:*\n• `.dp` (Your own DP)\n• `.dp @user` (Mention a user)\n• `.dp <number>` (e.g. `.dp 919876543210`)\n• `.dp group` (Show group icon)\n• Reply to any message with `.dp`'
            }, { quoted: message });
        }

        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch {}

        // Try high-resolution 'image' first, then fallback to 'preview'
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(target, 'image');
        } catch (_) {
            try {
                ppUrl = await sock.profilePictureUrl(target, 'preview');
            } catch (_) {}
        }

        if (!ppUrl) {
            const display = isGroupTarget ? 'this group' : `@${target.split('@')[0]}`;
            return sock.sendMessage(chatId, {
                text: `❌ Profile picture is not available or hidden by privacy settings for ${display}.`,
                mentions: isGroupTarget ? [] : [target]
            }, { quoted: message });
        }

        // Attempt downloading image buffer for robust delivery using native fetch
        let imageBuffer = null;
        try {
            const res = await fetch(ppUrl, { signal: AbortSignal.timeout(8000) });
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                imageBuffer = Buffer.from(arrayBuffer);
            }
        } catch (_) {
            // Buffer download failed, will fallback to URL
        }

        const username = target.split('@')[0];
        const caption = isGroupTarget
            ? `📸 *GROUP ICON*\n🏷️ *Group ID:* \`${target}\``
            : `📸 *USER PROFILE PICTURE*\n👤 *User:* @${username}\n🆔 *JID:* \`${target}\``;

        const payload = imageBuffer
            ? { image: imageBuffer, caption, mentions: isGroupTarget ? [] : [target] }
            : { image: { url: ppUrl }, caption, mentions: isGroupTarget ? [] : [target] };

        return await sock.sendMessage(chatId, payload, { quoted: message });

    } catch (error) {
        console.error('❌ Error in dpCommand:', error);
        return sock.sendMessage(chatId, {
            text: '❌ Could not retrieve profile picture. Please verify the target user/number and try again.'
        }, { quoted: message });
    }
}

module.exports = dpCommand;
