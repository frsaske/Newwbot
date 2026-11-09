const fs = require('fs');
const path = require('path');

// Human-like voice mappings
const VOICE_PRESETS = {
    '1': { name: 'Jessie (TikTok Viral Female 👧)', provider: 'tiktok', voice: 'en_us_001', fallbackLang: 'en-us' },
    '2': { name: 'Deep Narrator (Storyteller Male 🎙️)', provider: 'tiktok', voice: 'en_male_narration', fallbackLang: 'en-us' },
    '3': { name: 'Joey (Smooth Natural Male 👨)', provider: 'tiktok', voice: 'en_us_006', fallbackLang: 'en-us' },
    '4': { name: 'Emotional Female (Warm & Expressive 👱‍♀️)', provider: 'tiktok', voice: 'en_female_emotional', fallbackLang: 'en-us' },
    '5': { name: 'Professor (Radio Announcer 📻)', provider: 'tiktok', voice: 'en_us_007', fallbackLang: 'en-us' },
    '6': { name: 'Energetic Male (Youthful & Friendly 👦)', provider: 'tiktok', voice: 'en_us_010', fallbackLang: 'en-us' },
    '7': { name: 'Hindi / Desi Voice (Indian Hindi 🇮🇳)', provider: 'google', lang: 'hi' },
    '8': { name: 'British English (UK Accent 🇬🇧)', provider: 'google', lang: 'en-uk' },
    '9': { name: 'Indian English (Desi Accent 🇮🇳)', provider: 'google', lang: 'en-in' }
};

// Aliases for friendly voice selection
const VOICE_ALIASES = {
    'female': '1',
    'girl': '1',
    'narrator': '2',
    'deep': '2',
    'story': '2',
    'male': '3',
    'man': '3',
    'emotional': '4',
    'warm': '4',
    'announcer': '5',
    'radio': '5',
    'boy': '6',
    'young': '6',
    'hindi': '7',
    'desi': '7',
    'indian': '9',
    'uk': '8',
    'british': '8'
};

async function getTikTokAudio(text, voice) {
    const res = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`TikTok TTS responded with status: ${res.status}`);
    const data = await res.json();
    if (!data || !data.data) throw new Error(data?.error || 'Empty audio returned from TikTok TTS');
    return Buffer.from(data.data, 'base64');
}

async function getGoogleTTSAudio(text, lang = 'en') {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Google TTS responded with status: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

function getVoiceHelpMenu() {
    return `╭───「 🎙️ *TEXT TO SPEECH (HUMAN VOICES)* 」───╮
│
│ ✦ *.tts <text>*  ➔ Voice 1 (Default Human Female 👧)
│ ✦ *.tts1 <text>* ➔ Voice 1 (Jessie - TikTok Viral 👧)
│ ✦ *.tts2 <text>* ➔ Voice 2 (Deep Narrator - Movie/Story 🎙️)
│ ✦ *.tts3 <text>* ➔ Voice 3 (Joey - Smooth Male 👨)
│ ✦ *.tts4 <text>* ➔ Voice 4 (Emotional Female - Warm 👱‍♀️)
│ ✦ *.tts5 <text>* ➔ Voice 5 (Professor - Radio Host 📻)
│ ✦ *.tts6 <text>* ➔ Voice 6 (Energetic Young Male 👦)
│ ✦ *.tts7 <text>* ➔ Voice 7 (Hindi / Desi Voice 🇮🇳)
│ ✦ *.tts8 <text>* ➔ Voice 8 (British English 🇬🇧)
│ ✦ *.tts9 <text>* ➔ Voice 9 (Indian English 🇮🇳)
│
│ 💡 *Pro Tip:* Reply to any message with *.tts* or *.tts1-9*
│ 📌 *Example:* \`.tts1 Welcome to the group everyone!\`
│ 📌 *Example:* \`.tts7 Namaste kaise ho aap sab?\`
╰──────────────────────────────┈⊷`;
}

async function ttsCommand(sock, chatId, userMessageOrText, message) {
    try {
        const raw = (userMessageOrText || '').trim();

        // Check if user asked for list / help
        if (raw === '.tts' || raw === '.ttsvoices' || raw === '.tts list' || raw === '.tts help' || raw === '.ttsmenu') {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText = quoted?.conversation || 
                               quoted?.extendedTextMessage?.text || 
                               quoted?.imageMessage?.caption || 
                               quoted?.videoMessage?.caption;
            if (!quotedText) {
                return sock.sendMessage(chatId, { text: getVoiceHelpMenu() }, { quoted: message });
            }
        }

        // Determine voice ID and text
        let voiceId = '1';
        let text = '';

        // Match .tts1 to .tts9 or .tts <voice> <text> or .tts <text>
        const matchVoiceNum = raw.match(/^\.tts([1-9])(?:\s+([\s\S]*))?$/i);
        if (matchVoiceNum) {
            voiceId = matchVoiceNum[1];
            text = (matchVoiceNum[2] || '').trim();
        } else if (raw.toLowerCase().startsWith('.tts')) {
            const afterCmd = raw.replace(/^\.tts\s*/i, '').trim();
            const firstWord = afterCmd.split(/\s+/)[0]?.toLowerCase();
            if (VOICE_PRESETS[firstWord]) {
                voiceId = firstWord;
                text = afterCmd.slice(firstWord.length).trim();
            } else if (VOICE_ALIASES[firstWord]) {
                voiceId = VOICE_ALIASES[firstWord];
                text = afterCmd.slice(firstWord.length).trim();
            } else {
                text = afterCmd;
            }
        } else {
            text = raw;
        }

        // If no text provided, check quoted message
        if (!text) {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            text = quoted?.conversation || 
                   quoted?.extendedTextMessage?.text || 
                   quoted?.imageMessage?.caption || 
                   quoted?.videoMessage?.caption || 
                   '';
        }

        if (!text) {
            return sock.sendMessage(chatId, { text: getVoiceHelpMenu() }, { quoted: message });
        }

        // Indicate recording presence
        try {
            await sock.sendPresenceUpdate('recording', chatId);
        } catch {}

        const preset = VOICE_PRESETS[voiceId] || VOICE_PRESETS['1'];
        let audioBuffer = null;

        // Try selected provider with automatic fallback
        if (preset.provider === 'tiktok') {
            try {
                audioBuffer = await getTikTokAudio(text, preset.voice);
            } catch (err) {
                console.warn(`[TTS] TikTok voice ${preset.voice} failed, falling back to Google TTS:`, err.message);
                audioBuffer = await getGoogleTTSAudio(text, preset.fallbackLang || 'en');
            }
        } else {
            audioBuffer = await getGoogleTTSAudio(text, preset.lang || 'en');
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Failed to generate audio buffer');
        }

        // Send audio message directly to chat
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mp4',
            ptt: false
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in ttsCommand:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Error generating TTS audio. Please try again with shorter text or a different voice.\n\n${getVoiceHelpMenu()}`
        }, { quoted: message });
    }
}

module.exports = ttsCommand;
