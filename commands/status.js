const PhoneNumber = require('awesome-phonenumber');
const moment = require('moment-timezone');

/**
 * Country code to Flag emoji helper
 */
function getCountryFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

/**
 * Clean phone input and extract WhatsApp JID
 */
function extractTargetJid(sock, chatId, message, rawText) {
    // 1. Check if replying to someone's message
    const quoted = message.message?.extendedTextMessage?.contextInfo;
    if (quoted?.participant) {
        return quoted.participant.replace(/:\d+@/, '@');
    }

    // 2. Check if mentioning someone
    if (quoted?.mentionedJid && quoted.mentionedJid.length > 0) {
        return quoted.mentionedJid[0].replace(/:\d+@/, '@');
    }

    // 3. Extract text arguments
    const args = rawText.replace(/^\.?(?:status|about|bio|whois)\s*/i, '').trim();
    if (!args) return null;

    // Remove any non-digit characters except leading '+'
    const cleanDigits = args.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 5) return null;

    return `${cleanDigits}@s.whatsapp.net`;
}

/**
 * Command: .status <num>
 */
async function statusCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const targetJid = extractTargetJid(sock, chatId, message, rawText);

        if (!targetJid) {
            return await sock.sendMessage(chatId, {
                text: `❓ *How to use .status*\n\n` +
                      `Check any WhatsApp number's About/Bio, profile picture, and registration status.\n\n` +
                      `*Examples:*\n` +
                      `• \`.status 91 64816 84618\`\n` +
                      `• \`.status +917052500819\`\n` +
                      `• \`.status @user\` (mention someone)\n` +
                      `• Or simply reply to any user's message with \`.status\``
            }, { quoted: message });
        }

        const cleanNumber = targetJid.split('@')[0];
        const pn = new PhoneNumber(`+${cleanNumber}`);
        const intlFormatted = pn.isValid() ? pn.getNumber('international') : `+${cleanNumber}`;
        const regionCode = pn.getRegionCode() || 'Unknown';
        const flag = getCountryFlag(regionCode);

        // Inform user that lookup is running
        await sock.sendMessage(chatId, {
            text: `🔍 *Looking up WhatsApp status for:* \`${intlFormatted}\`...`
        }, { quoted: message });

        // 1. Check WhatsApp registration
        let isRegistered = true;
        let verifiedJid = targetJid;
        try {
            const onWa = await sock.onWhatsApp(targetJid);
            if (onWa && Array.isArray(onWa) && onWa.length > 0) {
                isRegistered = onWa[0].exists;
                if (onWa[0].jid) verifiedJid = onWa[0].jid;
            } else {
                isRegistered = false;
            }
        } catch (_) {}

        if (!isRegistered) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Number Not Found on WhatsApp!*\n\n` +
                      `📱 *Number:* \`${intlFormatted}\`\n` +
                      `${flag} *Region:* ${regionCode}\n` +
                      `⚠️ *Status:* This phone number is not registered on WhatsApp.`
            }, { quoted: message });
        }

        // 2. Fetch About / Status Bio
        let aboutText = '_Hidden or not set_';
        let setAtFormatted = 'Unknown';
        try {
            const statusData = await sock.fetchStatus(verifiedJid);
            if (statusData && statusData.status) {
                aboutText = statusData.status;
                if (statusData.setAt) {
                    setAtFormatted = moment(statusData.setAt).format('DD MMM YYYY, hh:mm A');
                }
            }
        } catch (fetchErr) {
            // About is private or not set
            aboutText = '_Private or not set_';
        }

        // 3. Fetch Business Profile if available
        let businessInfo = null;
        try {
            const biz = await sock.getBusinessProfile(verifiedJid);
            if (biz && (biz.description || biz.address || biz.email || biz.website)) {
                businessInfo = biz;
            }
        } catch (_) {}

        // 4. Fetch Profile Picture
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(verifiedJid, 'high');
        } catch (_) {
            try {
                ppUrl = await sock.profilePictureUrl(verifiedJid, 'preview');
            } catch (_) {}
        }

        // 5. Construct Status Info Card
        let card = `*乂  WhatsApp Profile & Status Info  乂*\n\n`;
        card += `📱 *Number:* \`${intlFormatted}\`\n`;
        card += `${flag} *Country:* ${regionCode}\n`;
        card += `🟢 *WhatsApp:* Registered Active ✅\n\n`;

        card += `📝 *About / Status Bio:*\n`;
        card += `"${aboutText}"\n`;
        if (setAtFormatted !== 'Unknown') {
            card += `🕒 *Set On:* ${setAtFormatted}\n`;
        }
        card += `\n`;

        if (businessInfo) {
            card += `🏢 *Business Account Details:*\n`;
            if (businessInfo.description) card += `• *Description:* ${businessInfo.description}\n`;
            if (businessInfo.category) card += `• *Category:* ${businessInfo.category}\n`;
            if (businessInfo.email) card += `• *Email:* ${businessInfo.email}\n`;
            if (businessInfo.website && businessInfo.website.length) {
                card += `• *Website:* ${businessInfo.website.join(', ')}\n`;
            }
            if (businessInfo.address) card += `• *Address:* ${businessInfo.address}\n`;
            card += `\n`;
        }

        card += `🔗 *Direct Chat:* https://wa.me/${cleanNumber}`;

        // Send with profile photo if available, or plain text
        if (ppUrl) {
            await sock.sendMessage(chatId, {
                image: { url: ppUrl },
                caption: card
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: card
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in statusCommand:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Status Lookup Failed:* ${error?.message || 'Operation failed'}`
        }, { quoted: message });
    }
}

module.exports = statusCommand;
