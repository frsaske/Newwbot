const isOwnerOrSudo = require('../../lib/isOwner');
module.exports = async function makeownerCommand(sock, chatId, message, number) {
  const sender = message.key.participant || message.key.remoteJid;
  if (!message.key.fromMe && !(await isOwnerOrSudo(sender, sock, chatId))) return sock.sendMessage(chatId, { text: '❌ Owner only command.' }, { quoted: message });
  const clean = String(number || '').replace(/\D/g, '');
  if (!clean) return sock.sendMessage(chatId, { text: 'Usage: /makeowner <number>' }, { quoted: message });
  const owners = global.loadOwners();
  if (!owners.includes(clean)) { owners.push(clean); global.saveOwners(owners); }
  return sock.sendMessage(chatId, { text: `✅ ${clean} is now an owner.` }, { quoted: message });
};
