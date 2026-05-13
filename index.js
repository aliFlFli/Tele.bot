require('dotenv').config();

const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');
require('moment/locale/fa');
const jalaali = require('jalaali-js');
const fs = require('fs');

// ===================== CONFIG =====================

const bot = new Telegraf(process.env.BOT_TOKEN);

const OWNER_ID = Number(process.env.OWNER_ID);

const UPDATE_INTERVAL = 60000; // 1 minute
const DATA_FILE = './channels.json';

// ===================== DATABASE =====================

let db = { channels: [] };

if (fs.existsSync(DATA_FILE)) {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ===================== FONTS =====================

const fancyMap = {
  '0': '𝟬',
  '1': '𝟭',
  '2': '𝟮',
  '3': '𝟯',
  '4': '𝟰',
  '5': '𝟱',
  '6': '𝟲',
  '7': '𝟳',
  '8': '𝟴',
  '9': '𝟵'
};

function fancyText(text) {
  return text.replace(/\d/g, d => fancyMap[d]);
}

// ===================== TIME =====================

function tehranTime() {
  return moment()
    .tz('Asia/Tehran')
    .format('HH:mm');
}

function jalaliDate() {
  const now = new Date();

  const j = jalaali.toJalaali(now);

  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

function clockEmoji() {
  const hour = Number(moment().tz('Asia/Tehran').format('h'));

  const emojis = {
    1: '🕐',
    2: '🕑',
    3: '🕒',
    4: '🕓',
    5: '🕔',
    6: '🕕',
    7: '🕖',
    8: '🕗',
    9: '🕘',
    10: '🕙',
    11: '🕚',
    12: '🕛'
  };

  return emojis[hour];
}

// ===================== BUILDERS =====================

function buildTitle(prefix = '') {
  const time = fancyText(tehranTime());

  return `${clockEmoji()} ${prefix} ${time}`.trim();
}

function buildBio() {
  return `
🟢 LIVE CLOCK

🕒 ${tehranTime()}
📅 ${jalaliDate()}
🌍 Asia/Tehran

Powered By Clock Bot ⚡
`.trim();
}

// ===================== OWNER CHECK =====================

function isOwner(id) {
  return id === OWNER_ID;
}

// ===================== START =====================

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

// ===================== HELP =====================

bot.command('help', (ctx) => {

  if (!isOwner(ctx.from.id)) return;

  ctx.reply(`
📌 Examples:

/add -1001234567890 KoreaMix •
/remove -1001234567890
/on -1001234567890
/off -1001234567890

Example Title:
🕒 KoreaMix • 𝟮𝟭:𝟰𝟱
`.trim());

});

// ===================== ADD CHANNEL =====================

bot.command('add', (ctx) => {

  if (!isOwner(ctx.from.id)) return;

  const parts = ctx.message.text.split(' ');

  const chatId = Number(parts[1]);

  const prefix = parts.slice(2).join(' ') || '';

  if (!chatId) {
    return ctx.reply('❌ Usage:\n/add -100xxxxxxxxxx PREFIX');
  }

  const exists = db.channels.find(c => c.chatId === chatId);

  if (exists) {
    return ctx.reply('⚠️ Channel already exists');
  }

  db.channels.push({
    chatId,
    prefix,
    enabled: true,
    lastTitle: ''
  });

  saveDB();

  ctx.reply('✅ Channel Added');

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

  if (db.channels.length === 0) {
    return ctx.reply('Empty');
  }

  const text = db.channels.map(c => `
ID: ${c.chatId}
Prefix: ${c.prefix}
Status: ${c.enabled ? '🟢 ON' : '🔴 OFF'}
`).join('\n');

  ctx.reply(text);

});

// ===================== ON =====================

bot.command('on', (ctx) => {

  if (!isOwner(ctx.from.id)) return;

  const chatId = Number(ctx.message.text.split(' ')[1]);

  const ch = db.channels.find(c => c.chatId === chatId);

  if (!ch) return ctx.reply('Not Found');

  ch.enabled = true;

  saveDB();

  ctx.reply('🟢 Enabled');

});

// ===================== OFF =====================

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

// ===================== START CLOCK =====================

bot.command('startclock', (ctx) => {

  if (!isOwner(ctx.from.id)) return;

  db.channels.forEach(c => c.enabled = true);

  saveDB();

  ctx.reply('⏱ Clock Started');

});

// ===================== STOP CLOCK =====================

bot.command('stopclock', (ctx) => {

  if (!isOwner(ctx.from.id)) return;

  db.channels.forEach(c => c.enabled = false);

  saveDB();

  ctx.reply('⛔ Clock Stopped');

});

// ===================== DELETE SYSTEM MESSAGES =====================

bot.on('message', async (ctx, next) => {

  try {

    if (
      ctx.message.new_chat_title ||
      ctx.message.group_chat_created ||
      ctx.message.supergroup_chat_created
    ) {

      await ctx.deleteMessage();

    }

  } catch (err) {}

  return next();

});

// ===================== CLOCK LOOP =====================

async function updateChannels() {

  for (const channel of db.channels) {

    if (!channel.enabled) continue;

    try {

      const newTitle = buildTitle(channel.prefix);

      // avoid unnecessary updates
      if (channel.lastTitle === newTitle) {
        continue;
      }

      await bot.telegram.setChatTitle(
        channel.chatId,
        newTitle
      );

      await bot.telegram.setChatDescription(
        channel.chatId,
        buildBio()
      );

      channel.lastTitle = newTitle;

      saveDB();

      console.log(`✅ Updated ${channel.chatId}`);

    } catch (err) {

      console.log(
        `❌ ${channel.chatId}`,
        err.description || err.message
      );

    }

    // anti flood
    await new Promise(r => setTimeout(r, 2500));

  }

}

// ===================== AUTO LOOP =====================

setInterval(updateChannels, UPDATE_INTERVAL);

updateChannels();

// ===================== LAUNCH =====================

bot.launch();

console.log('🚀 Clock Bot Started');

// ===================== STOP SAFE =====================

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
