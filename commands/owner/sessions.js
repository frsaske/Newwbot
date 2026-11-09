const isOwnerOrSudo = require('../../lib/isOwner');
module.exports = async function sessionsCommand(sock, chatId, message) {
  const sender = message.key.participant || message.key.remoteJid;
  if (!message.key.fromMe && !(await isOwnerOrSudo(sender, sock, chatId))) return sock.sendMessage(chatId, { text: '❌ Owner only command.' }, { quoted: message });
  const lines = [...(global.activeSockets || new Map())].map(([name, s]) => `${name} | 📱 ${s.user?.id?.split(':')[0]?.split('@')[0] || 'unknown'} | connected`);
  return sock.sendMessage(chatId, { text: lines.length ? `*Active sessions*\n\n${lines.join('\n')}` : 'No active sessions.' }, { quoted: message });
};
