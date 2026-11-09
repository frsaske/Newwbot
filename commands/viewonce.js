const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// In-memory cache for incoming view-once messages (keyed by message ID)
const viewOnceCache = new Map();

function formatRevealTime(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${month} ${day}, ${hoursStr}:${minutes} ${ampm}`;
}

function unwrapViewOnce(msg) {
  if (!msg) return null;
  const source = msg?.message || msg;
  return source.viewOnceMessageV2?.message ||
    source.viewOnceMessage?.message ||
    source.viewOnceMessageV2Extension?.message ||
    source;
}

function isViewOnceContent(msg) {
  if (!msg) return false;
  const raw = msg?.message || msg;
  if (raw.viewOnceMessageV2 || raw.viewOnceMessage || raw.viewOnceMessageV2Extension) return true;
  if (raw.imageMessage?.viewOnce || raw.videoMessage?.viewOnce || raw.audioMessage?.viewOnce) return true;
  return false;
}

async function toBuffer(content, type) {
  try {
    const stream = await downloadContentFromMessage(content, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (err) {
    console.error('Error downloading media stream:', err.message);
    return null;
  }
}

// Automatically called for every incoming message to cache view-once media
async function cacheIncomingViewOnce(sock, message) {
  try {
    if (!message?.message) return;
    const msgId = message.key?.id;
    if (!msgId) return;

    if (!isViewOnceContent(message)) return;

    const unwrapped = unwrapViewOnce(message);
    if (!unwrapped) return;

    let mediaType = null;
    let mediaSource = null;

    if (unwrapped.imageMessage) {
      mediaType = 'image';
      mediaSource = unwrapped.imageMessage;
    } else if (unwrapped.videoMessage) {
      mediaType = 'video';
      mediaSource = unwrapped.videoMessage;
    } else if (unwrapped.audioMessage) {
      mediaType = 'audio';
      mediaSource = unwrapped.audioMessage;
    }

    if (!mediaType || !mediaSource) return;

    const buffer = await toBuffer(mediaSource, mediaType);
    if (!buffer) return;

    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = message.key.remoteJid.endsWith('@g.us');

    let chatName = 'DM';
    if (isGroup) {
      try {
        const meta = await sock.groupMetadata(message.key.remoteJid).catch(() => null);
        chatName = meta?.subject || 'Gc';
      } catch (_) {
        chatName = 'Gc';
      }
    }

    viewOnceCache.set(msgId, {
      id: msgId,
      mediaType,
      mediaSource,
      buffer,
      sender,
      chatName,
      isGroup,
      remoteJid: message.key.remoteJid,
      timestamp: new Date()
    });

    // Prune oldest if cache grows over 300 entries
    if (viewOnceCache.size > 300) {
      const firstKey = viewOnceCache.keys().next().value;
      viewOnceCache.delete(firstKey);
    }
  } catch (err) {
    console.error('Error in cacheIncomingViewOnce:', err.message);
  }
}

// Helper to extract view-once info from a message or its quoted context
function getViewOnceQuoted(message) {
  const context = message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo ||
    message?.message?.videoMessage?.contextInfo ||
    message?.extendedTextMessage?.contextInfo;

  const quoted = context?.quotedMessage;
  const stanzaId = context?.stanzaId;

  // Check cache first
  if (stanzaId && viewOnceCache.has(stanzaId)) {
    return { fromCache: true, cached: viewOnceCache.get(stanzaId), context };
  }

  if (!quoted) return null;

  const unwrapped = unwrapViewOnce(quoted);
  const found = ['imageMessage', 'videoMessage', 'audioMessage'].find(key => {
    return unwrapped?.[key]?.viewOnce ||
      quoted?.viewOnceMessageV2 ||
      quoted?.viewOnceMessage ||
      quoted?.viewOnceMessageV2Extension ||
      unwrapped?.[key];
  });

  if (found) {
    return {
      fromCache: false,
      key: found,
      source: unwrapped[found],
      context
    };
  }

  return null;
}

/**
 * Handles view-once extraction when owner replies to any view-once message,
 * or when owner runs .vv / .wow.
 * Sends revealed media directly to the OWNER'S DM with the styled card!
 */
async function handleOwnerViewOnceReply(sock, message, chatId, replyText = '') {
  try {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner) return false;

    const detected = getViewOnceQuoted(message);
    if (!detected) return false;

    let mediaType = '';
    let buffer = null;
    let senderJid = '';
    let chatName = 'Gc';
    let timeObj = new Date();

    if (detected.fromCache) {
      const c = detected.cached;
      mediaType = c.mediaType;
      buffer = c.buffer;
      senderJid = c.sender;
      chatName = c.isGroup ? `👥 ${c.chatName}` : '👤 DM';
      timeObj = c.timestamp;
    } else {
      mediaType = detected.key.replace('Message', '');
      buffer = await toBuffer(detected.source, mediaType);
      senderJid = detected.context?.participant || detected.context?.remoteJid || senderId;
      const isGroup = chatId.endsWith('@g.us');
      if (isGroup) {
        try {
          const meta = await sock.groupMetadata(chatId).catch(() => null);
          chatName = `👥 ${meta?.subject || 'Gc'}`;
        } catch (_) {
          chatName = '👥 Gc';
        }
      } else {
        chatName = '👤 DM';
      }
    }

    if (!buffer) return false;

    const senderPhone = (senderJid || '').split('@')[0] || 'Unknown';
    const timeStr = formatRevealTime(timeObj);
    const cmdText = (replyText || '').trim() || '🥀';

    const card = `╭━━━〔 🔓 ᴠɪᴇᴡ-ᴏɴᴄᴇ ʀᴇᴠᴇᴀʟ 〕━━━╮
┃ 👤 *From* : @${senderPhone}
┃ 📍 *Chat* : ${chatName}
┃ 🕒 *Time* : ${timeStr}
┃ ⚡ *Cmd*  : ${cmdText}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;

    if (mediaType === 'image') {
      await sock.sendMessage(ownerJid, {
        image: buffer,
        caption: card,
        mentions: [senderJid]
      });
    } else if (mediaType === 'video') {
      await sock.sendMessage(ownerJid, {
        video: buffer,
        caption: card,
        mentions: [senderJid]
      });
    } else if (mediaType === 'audio') {
      await sock.sendMessage(ownerJid, { text: card, mentions: [senderJid] });
      await sock.sendMessage(ownerJid, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        ptt: false
      });
    } else {
      await sock.sendMessage(ownerJid, {
        document: buffer,
        mimetype: 'application/octet-stream',
        fileName: `view_once_${Date.now()}`,
        caption: card,
        mentions: [senderJid]
      });
    }

    // Reaction feedback to the owner's message
    try {
      await sock.sendMessage(chatId, {
        react: { text: '🔓', key: message.key }
      });
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('Error in handleOwnerViewOnceReply:', err);
    return false;
  }
}

// Explicit command handler for .wow and .vv
async function viewOnceCommand(sock, chatId, message) {
  const senderId = message.key.participant || message.key.remoteJid;
  const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

  if (!isOwner) {
    return sock.sendMessage(chatId, {
      text: '❌ Only the bot owner can use this command.'
    }, { quoted: message });
  }

  const userText = message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '.vv';

  const handled = await handleOwnerViewOnceReply(sock, message, chatId, userText);
  if (!handled) {
    return sock.sendMessage(chatId, {
      text: '❌ Kisi view-once photo, video ya audio message ko reply karke command bhejo, wo directly aapke DM mein aa jayega!'
    }, { quoted: message });
  }
}

module.exports = viewOnceCommand;
module.exports.viewOnceCommand = viewOnceCommand;
module.exports.handleOwnerViewOnceReply = handleOwnerViewOnceReply;
module.exports.cacheIncomingViewOnce = cacheIncomingViewOnce;
module.exports.getViewOnceQuoted = getViewOnceQuoted;
