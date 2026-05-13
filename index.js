require('dotenv').config();

const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');
require('moment/locale/fa');
const jalaali = require('jalaali-js');
const fs = require('fs');

// ===================== CONFIG =====================

const bot = new Telegraf(process.env.BOT_TOKEN);

const OWNER_ID = Number(process.env.OWNER_ID);

const UPDATE_INTERVAL = 60000;
const DATA_FILE = './channels.json';

// ===================== DATABASE =====================

let db = { channels: [] };

if (fs.existsSync(DATA_FILE)) {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ===================== FANCY NUMBER FONT =====================

const fancyMap = {
  '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
  '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
};

function fancyText(text) {
  return text.replace(/\d/g, d => fancyMap[d] || d);
}

// ===================== FANCY ENGLISH FONT =====================

const fontMap = {
  a:'𝗮', b:'𝗯', c:'𝗰', d:'𝗱', e:'𝗲', f:'𝗳', g:'𝗴', h:'𝗵',
  i:'𝗶', j:'𝗷', k:'𝗸', l:'𝗹', m:'𝗺', n:'𝗻', o:'𝗼', p:'𝗽',
  q:'𝗾', r:'𝗿', s:'𝘀', t:'𝘁', u:'𝘂', v:'𝘃', w:'𝘄', x:'𝘅',
  y:'𝘆', z:'𝘇'
};

function fancyEnglish(text) {
  return text.replace(/[a-z]/gi, c => {
    const lower = c.toLowerCase();
    return fontMap[lower] || c;
  });
}

// ===================== TIME =====================

function tehranTime() {
  return moment().tz('Asia/Tehran').format('HH:mm');
}

function tehranTimeFancy() {
  return fancyText(tehranTime());
}

function jalaliDate() {
  const now = new Date();
  const j = jalaali.toJalaali(now);
  const year = String(j.jy);
  const month = String(j.jm).padStart(2, '0');
  const day = String(j.jd).padStart(2, '0');
  return fancyText(`\( {year}/ \){month}/${day}`);
}

// ===================== CLOCK EMOJI =====================

function clockEmoji() {
  const hour = Number(moment().tz('Asia/Tehran').format('h'));
  const emojis = {
    1: '🕐', 2: '🕑', 3: '🕒', 4: '🕓', 5: '🕔', 6: '🕕',
    7: '🕖', 8: '🕗', 9: '🕘', 10: '🕙', 11: '🕚', 12: '🕛'
  };
  return emojis[hour] || '🕒';
}

// ===================== BUILD TITLE =====================

function buildTitle(prefix = '') {
  return `${clockEmoji()} ${prefix} ${tehranTimeFancy()}`.trim();
}

// ===================== BUILD BIO (اصلاح شده) =====================

function buildBio() {
  const timeLine = `🕒 Time : ${tehranTimeFancy()}`;
  const dateLine = `📅 Date : ${jalaliDate()}`;
  const zoneLine = `🌍 Zone : ${fancyEnglish('Asia/Tehran')}`;

  const maxWidth = 32; // بهترین عرض برای وسط چین شدن

  const centeredTime = centerText(timeLine, maxWidth);
  const centeredDate = centerText(dateLine, maxWidth);
  const centeredZone = centerText(zoneLine, maxWidth);

  return `
╭──⌈ ⏰ ${fancyEnglish('LIVE CLOCK')} ⌋──╮

${centeredTime}
${centeredDate}
${centeredZone}

╰─────⚡─────╯
`.trim();
}

// تابع وسط چین کردن
function centerText(text, width) {
  const padding = Math.max(0, width - text.length);
  const leftPad = Math.floor(padding / 2);
  return ' '.repeat(leftPad) + text;
}

// ===================== DELETE SERVICE MESSAGE =====================

bot.on('channel_post', async (ctx) => {
  if (ctx.channelPost?.new_chat_title) {
    try {
      await ctx.deleteMessage();
    } catch (err) {
      if (!err.description?.includes('not found')) {
        console.log('Delete Error:', err.description || err.message);
      }
    }
  }
});

// ===================== OWNER CHECK =====================

function isOwner(id) {
  return id === OWNER_ID;
}

// ===================== COMMANDS =====================

bot.start((ctx) => {
  if (!isOwner(ctx.from.id)) return;
  ctx.reply(`
✅ Clock Bot Online

Commands:
/add CHAT_ID PREFIX
/remove CHAT_ID
/list
/on CHAT_ID
/off CHAT_ID
/setprefix CHAT_ID TEXT
/startclock
/stopclock
/help
`.trim());
});

bot.command('help', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  ctx.reply(`
📌 Example:

/add -1001234567890 Iran •

Result:
🕒 Iran • 𝟭𝟰:𝟰𝟱
`.trim());
});

// ===================== ADD =====================

bot.command('add', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const chatId = Number(parts[1]);
  const prefix = parts.slice(2).join(' ') || '';

  if (!chatId) return ctx.reply('❌ Usage:\n/add -100xxxxxxxxxx PREFIX');

  if (db.channels.find(c => c.chatId === chatId)) {
    return ctx.reply('⚠️ Already Exists');
  }

  db.channels.push({ chatId, prefix, enabled: true, lastTitle: '' });
  saveDB();
  ctx.reply('✅ Added');
});

// ===================== REMOVE =====================

bot.command('remove', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  db.channels = db.channels.filter(c => c.chatId !== chatId);
  saveDB();
  ctx.reply('🗑 Removed');
});

// ===================== LIST =====================

bot.command('list', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  if (!db.channels.length) return ctx.reply('Empty');

  const text = db.channels.map(c => `
ID : ${c.chatId}
Prefix : ${c.prefix || 'None'}
Status : ${c.enabled ? '🟢 ON' : '🔴 OFF'}
`.trim()).join('\n\n');
  ctx.reply(text);
});

// ===================== ON / OFF =====================

bot.command('on', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.enabled = true;
  saveDB();
  ctx.reply('🟢 Enabled');
});

bot.command('off', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.enabled = false;
  saveDB();
  ctx.reply('🔴 Disabled');
});

// ===================== SET PREFIX =====================

bot.command('setprefix', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const chatId = Number(parts[1]);
  const prefix = parts.slice(2).join(' ');
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.prefix = prefix;
  saveDB();
  ctx.reply('✅ Prefix Updated');
});

// ===================== START / STOP CLOCK =====================

bot.command('startclock', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  db.channels.forEach(c => c.enabled = true);
  saveDB();
  ctx.reply('⏱ Clock Started');
});

bot.command('stopclock', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  db.channels.forEach(c => c.enabled = false);
  saveDB();
  ctx.reply('⛔ Clock Stopped');
});

// ===================== CLOCK LOOP =====================

async function updateChannels() {
  for (const channel of db.channels) {
    if (!channel.enabled) continue;

    try {
      const newTitle = buildTitle(channel.prefix);

      if (channel.lastTitle === newTitle) continue;

      await bot.telegram.setChatTitle(channel.chatId, newTitle);
      await bot.telegram.setChatDescription(channel.chatId, buildBio());

      channel.lastTitle = newTitle;
      saveDB();

      console.log(`✅ Updated ${channel.chatId}`);
    } catch (err) {
      console.log(`❌ ${channel.chatId} |`, err.description || err.message);
    }

    await new Promise(r => setTimeout(r, 2500));
  }
}

// ===================== AUTO LOOP =====================

setInterval(updateChannels, UPDATE_INTERVAL);
updateChannels();

// ===================== LAUNCH =====================

bot.launch({
  allowedUpdates: ['message', 'channel_post']
}).then(() => console.log('🚀 Clock Bot Started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
