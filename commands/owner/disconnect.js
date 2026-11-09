const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../../lib/isOwner');
module.exports = async function disconnectCommand(sock, chatId, message, name) {
  const sender = message.key.participant || message.key.remoteJid;
  if (!message.key.fromMe && !(await isOwnerOrSudo(sender, sock, chatId))) return sock.sendMessage(chatId, { text: '❌ Owner only command.' }, { quoted: message });
  if (!/^session[1-5]$/.test(name || '')) return sock.sendMessage(chatId, { text: 'Usage: /disconnect sessionN (session1-session5)' }, { quoted: message });
  const target = global.activeSockets?.get(name);
  try { if (target) { target.ev.removeAllListeners(); target.ws?.close(); target.end?.(undefined); } } catch (_) {}
  global.activeSockets?.delete(name);
  fs.rmSync(path.join(process.cwd(), 'sessions', name), { recursive: true, force: true });
  const number = target?.user?.id?.split(':')[0]?.split('@')[0] || 'unknown';
  return sock.sendMessage(chatId, { text: `❌ ${name} disconnected | 📱 ${number}` }, { quoted: message });
};
