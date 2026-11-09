const fs = require('fs');
const path = require('path');
const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG = path.join(process.cwd(), 'data', 'autoFeatures.json');
const AUTO_STATUS = path.join(process.cwd(), 'data', 'autoStatus.json');
const AUTO_READ = path.join(process.cwd(), 'data', 'autoread.json');

const defaults = { autoreact: false, autoseen: false, autoonline: false, autoreply: false };

function read() { 
  try { 
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) }; 
  } catch (_) { 
    return { ...defaults }; 
  } 
}

function save(data) { 
  try {
    fs.writeFileSync(CONFIG, JSON.stringify(data, null, 2)); 
  } catch (err) {
    console.error('[autoFeatures] Error saving config:', err);
  }
}

// Sync companion files for seamless autoseen / autoread / autostatus
function syncAutoseen(enabled) {
  try {
    // 1. Sync autoStatus
    let statusCfg = { enabled: false, reactOn: false };
    if (fs.existsSync(AUTO_STATUS)) {
      try { statusCfg = JSON.parse(fs.readFileSync(AUTO_STATUS, 'utf8')); } catch (_) {}
    }
    statusCfg.enabled = enabled;
    fs.writeFileSync(AUTO_STATUS, JSON.stringify(statusCfg, null, 2));

    // 2. Sync autoread
    let readCfg = { enabled: false };
    if (fs.existsSync(AUTO_READ)) {
      try { readCfg = JSON.parse(fs.readFileSync(AUTO_READ, 'utf8')); } catch (_) {}
    }
    readCfg.enabled = enabled;
    fs.writeFileSync(AUTO_READ, JSON.stringify(readCfg, null, 2));
  } catch (err) {
    console.error('[autoFeatures] Error syncing autoseen config:', err);
  }
}

async function toggle(sock, chatId, message, feature, value) {
  const sender = message.key.participant || message.key.remoteJid;
  const isOwner = message.key.fromMe || (await isOwnerOrSudo(sender, sock, chatId));
  if (!isOwner) {
    return sock.sendMessage(chatId, { text: '❌ *Permission Denied*\nOnly the bot owner or sudo can toggle this feature!' }, { quoted: message });
  }

  const data = read();
  const normalizedValue = String(value || '').toLowerCase().trim();

  if (!['on', 'off', 'status', 'enable', 'disable', '1', '0'].includes(normalizedValue) && normalizedValue !== '') {
    return sock.sendMessage(chatId, { text: `Usage: .${feature} on/off` }, { quoted: message });
  }

  if (normalizedValue === 'status' || normalizedValue === '') {
    const curState = data[feature] ? 'ON 🟢' : 'OFF 🔴';
    const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ ⚙️ *FEATURE STATUS: ${feature.toUpperCase()}*
┃ 📡 *Current Mode* : [ ${curState} ]
┃
┣━━〔 💡 ᴄᴏᴍᴍᴀɴᴅꜱ 〕━━┫
┃ ✦ *.${feature} on*  ➔ Enable feature
┃ ✦ *.${feature} off* ➔ Disable feature
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    return sock.sendMessage(chatId, { text: card }, { quoted: message });
  }

  const turnOn = ['on', 'enable', '1'].includes(normalizedValue);
  data[feature] = turnOn;
  save(data);

  if (feature === 'autoreact') {
    try {
      const reactions = require('../lib/reactions');
      reactions.setAutoReactionEnabled(turnOn);
    } catch (_) {}
  } else if (feature === 'autoseen') {
    syncAutoseen(turnOn);
  }

  const card = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 〕━━━╮
┃
┃ ${turnOn ? '🟢' : '🔴'} *${feature.toUpperCase()}*
┃
┣━━〔 📋 ᴅᴇᴛᴀɪʟꜱ 〕━━┫
┃ ⚙️ *Setting* : ${feature}
┃ 📡 *Status*  : [ ${turnOn ? 'ACTIVATED ✅' : 'DEACTIVATED 🛑'} ]
┃ 🕒 *Time*    : ${new Date().toLocaleTimeString()}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
${feature === 'autoseen' 
    ? (turnOn ? '👁️ Auto-Seen active: incoming messages and WhatsApp statuses will be marked as seen automatically.' : '🛑 Auto-Seen disabled: messages and statuses will not be auto-viewed.')
    : (turnOn ? `✅ *${feature}* is now turned ON.` : `🛑 *${feature}* is now turned OFF.`)}`;

  return sock.sendMessage(chatId, { text: card }, { quoted: message });
}

async function handleAutoReply(sock, chatId, message, text) {
  const data = read(); 
  if (!data.autoreply || !text || message.key.fromMe) return;
  const key = process.env.GROQ_API_KEY; 
  if (!key) return;
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', { 
      model: 'llama-3.1-8b-instant', 
      messages: [{ role: 'user', content: text }], 
      max_tokens: 120 
    }, { 
      headers: { Authorization: `Bearer ${key}` } 
    });
    const answer = response.data?.choices?.[0]?.message?.content?.trim(); 
    if (answer) await sock.sendMessage(chatId, { text: answer });
  } catch (error) { 
    console.error('[autoreply]', error.message); 
  }
}

async function handlePresence(sock, message) {
  try {
    if (!sock || !message?.key?.id) return;
    const data = read(); 

    // Handle autoseen (mark message as read)
    if (data.autoseen && !message.key.fromMe) {
      try { 
        const key = {
          remoteJid: message.key.remoteJid,
          id: message.key.id,
          fromMe: false
        };
        if (message.key.remoteJid?.endsWith('@g.us') && message.key.participant) {
          key.participant = message.key.participant;
        }
        await sock.readMessages([key]); 
      } catch (_) {}
    }

    // Handle autoonline (send presence)
    if (data.autoonline && message.key.remoteJid) {
      try { 
        await sock.sendPresenceUpdate('available', message.key.remoteJid); 
      } catch (_) {}
    }
  } catch (_) {}
}

module.exports = { read, toggle, handleAutoReply, handlePresence, syncAutoseen };
