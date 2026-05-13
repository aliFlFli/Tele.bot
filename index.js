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

// ===================== FANCY FONT =====================
const fancyMap = {
  '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
  '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
};

function fancyText(text) {
  return text.replace(/\d/g, d => fancyMap[d]);
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
  const dateStr = `\( {j.jy}/ \){String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  return fancyText(dateStr);   // ← فونت اعداد تاریخ
}

function clockEmoji() {
  const hour = Number(moment().tz('Asia/Tehran').format('h'));
  const emojis = {
    1: '🕐', 2: '🕑', 3: '🕒', 4: '🕓', 5: '🕔', 6: '🕕',
    7: '🕖', 8: '🕗', 9: '🕘', 10: '🕙', 11: '🕚', 12: '🕛'
  };
  return emojis[hour] || '🕒';
}

// ===================== BUILD TITLE & BIO =====================
function buildTitle(prefix = '') {
  return `${clockEmoji()} ${prefix} ${tehranTimeFancy()}`.trim();
}

function buildBio() {
  return `
🟢 LIVE CLOCK

🕒 ${tehranTimeFancy()}
📅 ${jalaliDate()}
🌍 Asia/Tehran

Powered By Clock Bot ⚡
`.trim();
}

// ===================== DELETE SERVICE MESSAGE =====================
bot.on('channel_post', async (ctx) => {
  if (ctx.channelPost?.new_chat_title) {
    try {
      await ctx.deleteMessage();
      console.log(`🗑 Deleted service message | ${ctx.chat.id}`);
    } catch (err) {
      if (!err.description?.includes('not found')) {
        console.log('Delete error:', err.description || err.message);
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
  ctx.reply(`📌 مثال:\n/add -1001234567890 Iran •`);
});

bot.command('add', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const chatId = Number(parts[1]);
  const prefix = parts.slice(2).join(' ') || '';

  if (!chatId) return ctx.reply('❌ /add -100xxxxxxxxxx PREFIX');

  if (db.channels.find(c => c.chatId === chatId)) return ctx.reply('⚠️ Already Exists');

  db.channels.push({ chatId, prefix, enabled: true, lastTitle: '' });
  saveDB();
  ctx.reply('✅ Added');
});

bot.command('remove', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  db.channels = db.channels.filter(c => c.chatId !== chatId);
  saveDB();
  ctx.reply('🗑 Removed');
});

bot.command('list', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  if (!db.channels.length) return ctx.reply('Empty');

  const text = db.channels.map(c => `
ID: ${c.chatId}
Prefix: ${c.prefix || 'بدون'}
Status: ${c.enabled ? '🟢 ON' : '🔴 OFF'}
  `.trim()).join('\n\n');
  ctx.reply(text);
});

bot.command('on', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.enabled = true; saveDB(); ctx.reply('🟢 Enabled');
});

bot.command('off', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const chatId = Number(ctx.message.text.split(' ')[1]);
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.enabled = false; saveDB(); ctx.reply('🔴 Disabled');
});

bot.command('setprefix', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const chatId = Number(parts[1]);
  const prefix = parts.slice(2).join(' ');
  const ch = db.channels.find(c => c.chatId === chatId);
  if (!ch) return ctx.reply('Not Found');
  ch.prefix = prefix; saveDB(); ctx.reply('✅ Updated');
});

bot.command('startclock', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  db.channels.forEach(c => c.enabled = true);
  saveDB(); ctx.reply('⏱ Started');
});

bot.command('stopclock', (ctx) => {
  if (!isOwner(ctx.from.id)) return;
  db.channels.forEach(c => c.enabled = false);
  saveDB(); ctx.reply('⛔ Stopped');
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
bot.launch().then(() => console.log('🚀 Clock Bot Started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
