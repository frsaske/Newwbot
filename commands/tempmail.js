const axios = require('axios');
const crypto = require('crypto');

// Map of active email sessions: key = chatId, value = session object
const activeMailSessions = new Map();

/**
 * Extract OTP / verification code from email body and subject
 */
function extractOtpCode(text, subject) {
    const combined = `${subject || ''}\n${text || ''}`;
    const regexes = [
        /(?:verification\s+code|security\s+code|confirmation\s+code|otp|pin|passcode|code)[\s:=-]+(?:is\s*[:=-]*\s*)?([a-zA-Z0-9]{4,8})\b/i,
        /\b(\d{3}[-\s]\d{3})\b/,
        /\b([0-9]{4,8})\b/
    ];
    for (const r of regexes) {
        const m = combined.match(r);
        if (m && m[1]) return m[1];
    }
    return null;
}

/**
 * Create a new mailbox on mail.tm
 */
async function createMailbox() {
    // 1. Fetch available domains
    const domainsRes = await axios.get('https://api.mail.tm/domains', { timeout: 8000 });
    const domainList = domainsRes.data?.['hydra:member'] || [];
    const activeDomain = domainList.find(d => d.isActive) || domainList[0];
    if (!activeDomain) throw new Error('No active email domains available at the moment.');

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const username = `skx_${Date.now().toString().slice(-4)}_${randomSuffix}`;
    const address = `${username}@${activeDomain.domain}`;
    const password = `P@ss_${crypto.randomBytes(6).toString('hex')}`;

    // 2. Register account
    const regRes = await axios.post('https://api.mail.tm/accounts', {
        address,
        password
    }, { timeout: 8000 });

    const accountId = regRes.data?.id;

    // 3. Obtain authentication JWT token
    const tokenRes = await axios.post('https://api.mail.tm/token', {
        address,
        password
    }, { timeout: 8000 });

    const token = tokenRes.data?.token;
    if (!token) throw new Error('Failed to obtain email authorization token.');

    return {
        address,
        password,
        accountId,
        token
    };
}

/**
 * Command: .email / .tempmail
 */
async function tempmailCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const isForceNew = rawText.includes('new') || rawText.includes('reset');

        // Check if an active session already exists in this chat
        if (activeMailSessions.has(chatId) && !isForceNew) {
            const current = activeMailSessions.get(chatId);
            const remainingSec = Math.max(0, Math.floor((current.expiresAt - Date.now()) / 1000));
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;

            let info = `📬 *ACTIVE TEMPORARY MAILBOX*\n\n`;
            info += `📧 *Email Address:*\n\`${current.address}\`\n*(Tap to copy)*\n\n`;
            info += `⏱️ *Time Remaining:* ${mins}m ${secs}s (Total: 10 mins)\n`;
            info += `🔔 *Live Status:* Active & auto-forwarding emails here!\n\n`;
            info += `_Type \`.email new\` if you need a brand new address._`;

            return await sock.sendMessage(chatId, { text: info }, { quoted: message });
        }

        // Clean up previous session if resetting
        if (activeMailSessions.has(chatId)) {
            const old = activeMailSessions.get(chatId);
            if (old.intervalId) clearInterval(old.intervalId);
            if (old.timeoutId) clearTimeout(old.timeoutId);
            activeMailSessions.delete(chatId);
        }

        await sock.sendMessage(chatId, {
            text: '⏳ *Generating fresh 10-minute temporary mailbox...*'
        }, { quoted: message });

        const mailbox = await createMailbox();
        const durationMs = 10 * 60 * 1000; // 10 minutes
        const expiresAt = Date.now() + durationMs;

        const sessionObj = {
            address: mailbox.address,
            accountId: mailbox.accountId,
            token: mailbox.token,
            chatId,
            expiresAt,
            seenMessageIds: new Set(),
            intervalId: null,
            timeoutId: null
        };

        // Send initial mailbox details with copyable email
        const initialText = 
            `📬 *TEMPORARY DISPOSABLE EMAIL (10 MINS)*\n\n` +
            `📧 *Email Address:*\n` +
            `\`${mailbox.address}\`\n` +
            `*(Tap email above to copy)*\n\n` +
            `⏱️ *Validity:* 10 Minutes\n` +
            `🔔 *Live Forwarding:* ON 🟢\n\n` +
            `_Any verification email, OTP code, or signup link sent to this address will be delivered directly here in real-time!_`;

        await sock.sendMessage(chatId, { text: initialText }, { quoted: message });

        // Polling loop: checks every 4 seconds for new incoming emails
        sessionObj.intervalId = setInterval(async () => {
            try {
                // If expired, skip
                if (Date.now() >= sessionObj.expiresAt) return;

                const res = await axios.get('https://api.mail.tm/messages', {
                    headers: { Authorization: `Bearer ${sessionObj.token}` },
                    timeout: 6000
                });

                const messages = res.data?.['hydra:member'] || [];
                for (const msg of messages) {
                    if (sessionObj.seenMessageIds.has(msg.id)) continue;
                    sessionObj.seenMessageIds.add(msg.id);

                    // Fetch full message body
                    let fullText = msg.intro || '';
                    let fullSubject = msg.subject || 'No Subject';
                    let sender = msg.from?.address || 'Unknown Sender';

                    try {
                        const fullMsgRes = await axios.get(`https://api.mail.tm/messages/${msg.id}`, {
                            headers: { Authorization: `Bearer ${sessionObj.token}` },
                            timeout: 6000
                        });
                        if (fullMsgRes.data) {
                            fullText = fullMsgRes.data.text || fullMsgRes.data.intro || fullText;
                            fullSubject = fullMsgRes.data.subject || fullSubject;
                            sender = fullMsgRes.data.from?.address || sender;
                        }
                    } catch (_) {}

                    const otpCode = extractOtpCode(fullText, fullSubject);

                    let emailCard = `📩 *NEW EMAIL RECEIVED!* ⚡\n\n`;
                    emailCard += `👤 *From:* \`${sender}\`\n`;
                    emailCard += `📌 *Subject:* *${fullSubject}*\n\n`;

                    if (otpCode) {
                        emailCard += `🔑 *VERIFICATION CODE / OTP:*\n`;
                        emailCard += `\`${otpCode}\`\n`;
                        emailCard += `*(Tap code to copy)*\n\n`;
                    }

                    // Format message body (truncate if extremely long)
                    let cleanBody = (fullText || '').trim();
                    if (cleanBody.length > 1200) {
                        cleanBody = cleanBody.substring(0, 1200) + '\n...[truncated]';
                    }

                    emailCard += `📄 *Message Content:*\n${cleanBody || '_No text content_'}\n\n`;
                    emailCard += `⏰ *Inbox:* \`${sessionObj.address}\``;

                    // Send into the chat in real time!
                    await sock.sendMessage(chatId, { text: emailCard });
                }
            } catch (pollErr) {
                // Silently ignore transient network drops during background polling
            }
        }, 4000);

        // 10-Minute Expiration Handler
        sessionObj.timeoutId = setTimeout(async () => {
            try {
                if (sessionObj.intervalId) clearInterval(sessionObj.intervalId);

                // Attempt to delete account on mail.tm
                try {
                    await axios.delete(`https://api.mail.tm/accounts/${sessionObj.accountId}`, {
                        headers: { Authorization: `Bearer ${sessionObj.token}` },
                        timeout: 5000
                    });
                } catch (_) {}

                activeMailSessions.delete(chatId);

                const expireNotice = 
                    `⏰ *Temp Mail Expired & Deleted!*\n\n` +
                    `Your 10-minute temporary mailbox:\n` +
                    `\`${sessionObj.address}\`\n` +
                    `has ended and all messages were permanently deleted.\n\n` +
                    `💡 Type \`.email\` to generate a new mailbox anytime!`;

                await sock.sendMessage(chatId, { text: expireNotice });
            } catch (_) {}
        }, durationMs);

        activeMailSessions.set(chatId, sessionObj);

    } catch (err) {
        console.error('Error in tempmailCommand:', err);
        await sock.sendMessage(chatId, {
            text: `❌ *Temp Mail Error:* ${err?.message || 'Could not generate mailbox. Please try again.'}`
        }, { quoted: message });
    }
}

module.exports = {
    tempmailCommand,
    extractOtpCode
};
