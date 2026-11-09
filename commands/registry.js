/*
 * ꜱᴀꜱᴜᴋᴇX COMMAND REGISTRY
 * -------------------------
 */
const os = require('os');
const fs = require('fs');
const settings = require('../settings');

const sections = {
  General: {
    icon: '◈',
    commands: [
      '.menu [category]',
      '.showall',
      '.ping',
      '.alive',
      '.owner',
      '.settings',
      '.tts [1-9] <text>',
      '.ttsvoices',
      '.weather <city>',
      '.attp <text>',
      '.translate <text> <lang>',
      '.dp [@user/number/group]',
      '.pair <number>',
      '.pairqr <number>'
    ]
  },
  Admin: {
    icon: '♜',
    commands: [
      '.ban @user',
      '.unban @user',
      '.promote @user',
      '.demote @user',
      '.mute <minutes>',
      '.unmute',
      '.kick @user',
      '.warnings',
      '.warn @user',
      '.antilink',
      '.antibadword',
      '.antitag',
      '.tagall',
      '.tagnotadmin',
      '.hidetag <text>',
      '.tag <text>',
      '.welcome',
      '.goodbye',
      '.setgdesc',
      '.setgname',
      '.setgpp'
    ]
  },
  Owner: {
    icon: '♛',
    commands: [
      '.bot <on/off>',
      '.mode <public/private>',
      '.sessions',
      '.connect [reply creds]',
      '.delsession <1-5>',
      '.disconnect <sessionN>',
      '.makeowner <number>',
      '.antidelete',
      '.cleartmp',
      '.clearsession',
      '.setpp',
      '.autoreact <on/off>',
      '.autoseen <on/off>',
      '.autoonline <on/off>',
      '.autoreply <on/off>',
      '.anticall <on/off>',
      '.autotyping <on/off>',
      '.autoread <on/off>',
      '.wow ( to img )',
      '.backup'
    ]
  },
  Media: {
    icon: '✦',
    commands: [
      '.sticker [reply img/vid]',
      '.simage [reply sticker]',
      '.igs <link>',
      '.igsc <link>',
      '.meme',
      '.take <packname>'
    ]
  },
  Downloader: {
    icon: '⇩',
    commands: [
      '.play <song name>',
      '.song <song name>',
      '.video <video name>',
      '.spotify <query>',
      '.git <repo url>',
      '.instagram <url>',
      '.facebook <url>',
      '.tiktok <url>'
    ]
  },

  Misc: {
    icon: '✧',
    commands: [
      '.status <num>',
      '.email (10m tempmail)',
      '.simp @user',
      '.topmembers',
      '.gay',
      '.heart',
      '.horny'
    ]
  }
};

// Disabled commands list
const disabled = new Set([
  '.8ball', '.fact', '.news', '.groupinfo', '.infogp', '.infogrupo', '.lyrics', '.pies', '.china', '.indonesia', '.japan', '.korea', '.hijab',
  '.emojimix', '.emix', '.metallic', '.ice', '.snow', '.impressive', '.matrix', '.light', '.neon', '.devil', '.purple', '.thunder', '.leaves', '.1917', '.arena', '.hacker', '.sand', '.blackpink', '.glitch', '.fire',
  '.circle', '.lgbt', '.lolice', '.simpcard', '.its-so-stupid', '.namecard', '.oogway', '.oogway2', '.tweet', '.ytcomment', '.comrade', '.glass', '.jail', '.passed', '.triggered',
  '.compliment', '.insult', '.flirt', '.shayari', '.goodnight', '.roseday', '.character', '.wasted', '.ship', '.stupid',
  '.gpt', '.gemini', '.imagine', '.flux', '.dalle', '.sora',
  '.pmblocker', '.gdrive', '.blur', '.removebg', '.remini', '.crop',
  '.tictactoe', '.move', '.hangman', '.guess', '.trivia', '.answer', '.truth', '.dare',
  '.anime', '.waifu', '.maid', '.uniform', '.selfie', '.marin', '.raiden', '.ayaka', '.rem', '.oppai', '.genshin', '.onepiece', '.nsfw', '.nswf', '.hentai', '.ecchi', '.ero', '.milf', '.ass', '.paizuri', '.oral', '.nami', '.animu', '.animuquote'
]);

const allCommands = Object.values(sections)
  .flatMap(section => section.commands)
  .filter(cmd => cmd.startsWith('.'))
  .map(cmd => cmd.split(' ')[0]);

const isDisabled = command => disabled.has(command);

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds = seconds % (24 * 60 * 60);
  const hours = Math.floor(seconds / (60 * 60));
  seconds = seconds % (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning 🌅';
  if (hour >= 12 && hour < 17) return 'Good Afternoon ☀️';
  if (hour >= 17 && hour < 21) return 'Good Evening 🌆';
  return 'Good Night 🌙';
}

function getMode() {
  try {
    const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf8'));
    return data.isPublic !== false ? 'PUBLIC' : 'PRIVATE';
  } catch (_) {
    return 'PUBLIC';
  }
}

function render(userName = 'ꜱᴀꜱᴜᴋᴇX', categoryFilter = null) {
  const greeting = getTimeGreeting();
  const uptime = formatUptime(process.uptime());
  const usedRam = Math.round(process.memoryUsage().rss / (1024 * 1024));
  const totalRam = Math.round(os.totalmem() / (1024 * 1024));
  const totalCmdCount = Object.values(sections).reduce((acc, s) => acc + s.commands.length, 0);
  const mode = getMode();

  const header = `╭━━━〔 ⚡ ꜱᴀꜱᴜᴋᴇ-𝐗 ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ ⚡ 〕━━━╮
┃
┃ 👋 *${greeting},* ━━〔 ${userName} 〕━━!
┃ Welcome to *${settings.botName || 'ꜱᴀꜱᴜᴋᴇ-𝐗'}* Interactive Menu.
┃
┣━━〔 📊 ʙᴏᴛ ᴅᴀꜱʜʙᴏᴀʀᴅ 〕━━┫
┃ 👑 *Developer*  : ${settings.botOwner || 'ꜰʀsᴀsᴋᴇ'}
┃ 🤖 *Bot Name*   : ${settings.botName || 'ꜱᴀꜱᴜᴋᴇ-𝐗'}
┃ ⚙️ *Prefix*     : [ . ]
┃ ⏱️ *Uptime*     : ${uptime}
┃ 💾 *RAM Usage*  : ${usedRam} MB / ${totalRam} MB
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

  let sectionEntries = Object.entries(sections);

  if (categoryFilter) {
    const norm = categoryFilter.trim().toLowerCase();
    const aliasMap = {
      admin: 'Admin',
      media: 'Media',
      download: 'Downloader',
      downloader: 'Downloader',
      owner: 'Owner',
      general: 'General',
      misc: 'Misc'
    };
    const target = aliasMap[norm];
    if (target && sections[target]) {
      sectionEntries = [[target, sections[target]]];
    }
  }

  const renderedSections = sectionEntries.map(([name, sec]) => {
    const cmdLines = sec.commands.map(cmd => `│ ✦ ${cmd}`).join('\n');
    return `╭───「 ${sec.icon} *${name.toUpperCase()}* (${sec.commands.length}) 」───╮\n${cmdLines}\n╰──────────────────────────────┈⊷`;
  }).join('\n\n');

  const navigationTips = `╭───「 💡 *COMMAND QUICK ACCESS* 」───╮
│ 🔍 *Category Sub-Menus:*
│    • .menu admin    ➔ Group moderation
│    • .menu media    ➔ Stickers & images
│    • .menu download ➔ Audio & video download
│    • .menu owner    ➔ Bot owner privileges
│ ⚡ *Server Speed:* .ping
│ 🟢 *Online Check:* .alive
│ ⚙️ *Bot Settings:* .settings
│ 👑 *Developer:*    .owner
╰──────────────────────────────┈⊷`;

  const footer = `📢 *Official Channel:* ${settings.channelLink || 'https://whatsapp.com/channel/0029VbDsHPCId7nRSI0Fce2W'}`;

  return `${header}\n\n${renderedSections}\n\n${navigationTips}\n\n${footer}`;
}

module.exports = { sections, allCommands, disabled, isDisabled, render };
