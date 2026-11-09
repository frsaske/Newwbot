const FOOTER = '\n\n━━〔 ꜱᴀꜱᴜᴋᴇX 〕━━';

function addFooter(payload, options = {}) {
  if (!payload || options.skipFooter) return payload;
  if (payload.sticker || payload.audio || payload.reaction) return payload;
  const result = { ...payload };
  if (result.contextInfo) {
    result.contextInfo = { ...result.contextInfo };
    delete result.contextInfo.forwardedNewsletterMessageInfo;
    delete result.contextInfo.forwardingScore;
    delete result.contextInfo.isForwarded;
  }
  if (typeof result.text === 'string' && result.text && !result.text.includes('━━〔')) {
    if (!/menu|commands list/i.test(result.text)) result.text += FOOTER;
  }
  if (typeof result.caption === 'string' && result.caption && !result.caption.includes('━━〔')) {
    result.caption += FOOTER;
  }
  if (result.document && typeof result.document.caption === 'string' && !result.document.caption.includes('━━〔')) {
    result.document = { ...result.document, caption: result.document.caption + FOOTER };
  }
  return result;
}

function installFooter(sock) {
  if (!sock || sock.__footerInstalled) return sock;
  const original = sock.sendMessage.bind(sock);
  sock.sendMessage = (jid, content, options) => original(jid, addFooter(content, options), options);
  sock.__footerInstalled = true;
  return sock;
}

module.exports = { FOOTER, addFooter, installFooter };
