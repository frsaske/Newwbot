/**
 * WhatsApp Pairing System (.pair & .pairqr)
 * Powered by Sasuke Pairing Server on Render
 */

const PAIR_API_BASE = 'https://sasuke-paring-ssyytem.onrender.com';

/**
 * Fetches JSON from Render API with generous timeout and retries for sleeping instances
 */
async function fetchWithRetry(url, maxRetries = 4, timeoutMs = 75000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && (data.success || data.code || data.qr)) {
                    return data;
                }
            }
            // If 502/503/504 or server is spinning up, wait and retry
            if ([502, 503, 504].includes(res.status)) {
                await new Promise(r => setTimeout(r, 4000));
                continue;
            }
        } catch (err) {
            lastError = err;
            // Wait 3 seconds before next retry while Render instance wakes up
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    throw lastError || new Error('Render pairing server took too long to respond');
}

function getPairHelp() {
    return `╭━━━〔 ⚡ *WHATSAPP PAIR SYSTEM* ⚡ 〕━━━╮
┃
┃ ✦ *.pair <number>*   ➔ Get 8-digit Pairing Code
┃ ✦ *.pairqr <number>* ➔ Get QR Code to Scan
┃
┃ 📌 *Format:* International number (digits only)
┃ 📌 *Example:* \`.pair 923237045919\`
┃ 📌 *Example:* \`.pairqr 917052500819\`
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

/**
 * .pair <number> command handler
 */
async function pairCommand(sock, chatId, message, userMessage = '') {
    try {
        const raw = (userMessage || '').replace(/^\.?pair\s*/i, '').trim();
        const number = raw.replace(/[^0-9]/g, '');

        if (!number || number.length < 8 || number.length > 16) {
            return sock.sendMessage(chatId, { text: getPairHelp() }, { quoted: message });
        }

        // Notify user that request is processing (especially during Render cold starts)
        await sock.sendMessage(chatId, {
            text: `⏳ *Connecting to Sasuke Pairing Server...*\n*(Please wait, Render server may take a few seconds to wake up...)*`
        }, { quoted: message });

        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (_) {}

        const apiUrl = `${PAIR_API_BASE}/pair?number=${encodeURIComponent(number)}`;
        const result = await fetchWithRetry(apiUrl);

        const code = result.code;
        if (!code) {
            throw new Error(result.message || 'No pairing code in response');
        }

        const caption = `╭━━━〔 ⚡ *SASUKE-X PAIRING CODE* ⚡ 〕━━━╮
┃
┃ 📱 *Target Number:* +${number}
┃ 🔑 *Pairing Code:* *${code}*
┃
┃ 📋 *Tap code below to copy:*
┃ \`${code}\`
┃
┃ 💡 *Instructions:*
┃ 1. Open WhatsApp on the target phone
┃ 2. Tap 3 dots (⋮) > *Linked Devices*
┃ 3. Tap *Link a Device* > *Link with phone number instead*
┃ 4. Enter the code above to link successfully!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: caption }, { quoted: message });

    } catch (error) {
        console.error('Error in pairCommand:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Pairing Error:* Could not generate pairing code.\nServer might be busy or restarting. Please try again in 30 seconds.`
        }, { quoted: message });
    }
}

/**
 * .pairqr <number> command handler
 */
async function pairQrCommand(sock, chatId, message, userMessage = '') {
    try {
        const raw = (userMessage || '').replace(/^\.?(pairqr|pqr)\s*/i, '').trim();
        const number = raw.replace(/[^0-9]/g, '');

        if (!number || number.length < 8 || number.length > 16) {
            return sock.sendMessage(chatId, { text: getPairHelp() }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `⏳ *Generating WhatsApp Pairing QR...*\n*(Please wait, Render server is generating QR image...)*`
        }, { quoted: message });

        try {
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (_) {}

        const apiUrl = `${PAIR_API_BASE}/qr?number=${encodeURIComponent(number)}`;
        const result = await fetchWithRetry(apiUrl);

        if (!result.qr) {
            throw new Error(result.message || 'No QR image returned in response');
        }

        const base64Data = result.qr.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const caption = `╭━━━〔 📷 *SASUKE-X PAIRING QR* 〕━━━╮
┃
┃ 📱 *Target Number:* +${number}
┃
┃ 🔍 *Scan QR to Link:*
┃ 1. Open WhatsApp on target phone
┃ 2. Go to *Linked Devices* > *Link a Device*
┃ 3. Scan the QR code above!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption
        }, { quoted: message });

    } catch (error) {
        console.error('Error in pairQrCommand:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *QR Error:* Could not generate QR image.\nPlease check the number and try again in a few moments.`
        }, { quoted: message });
    }
}

module.exports = {
    pairCommand,
    pairQrCommand
};