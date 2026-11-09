const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { render } = require('./registry');

async function sendMenu(sock, chatId, message, categoryFilter = null) {
  const userName = message?.pushName || 'ꜱᴀꜱᴜᴋᴇX';
  const text = render(userName, categoryFilter);
  const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

  const payload = fs.existsSync(imagePath)
    ? { image: fs.readFileSync(imagePath), caption: text }
    : { text };

  return sock.sendMessage(chatId, payload, { quoted: message });
}

async function helpCommand(sock, chatId, message, categoryFilter = null) {
  return sendMenu(sock, chatId, message, categoryFilter);
}

async function showAllCommand(sock, chatId, message) {
  return sendMenu(sock, chatId, message, null);
}

module.exports = helpCommand;
module.exports.helpCommand = helpCommand;
module.exports.showAllCommand = showAllCommand;
