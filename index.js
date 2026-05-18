require('dotenv').config();

const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');
require('moment/locale/fa');
const jalaali = require('jalaali-js');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

const DATA_FILE = './channels.json';

let isRunning = false;

// ================= DB =================
let db = { channels: [] };

try {
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
} catch {
  db = { channels: [] };
}

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log('DB SAVE ERROR', e.message);
  }
}

// ================= FONTS =================
const numMap = {
  0:'𝟬',1:'𝟭',2:'𝟮',3:'𝟯',4:'𝟰',
  5:'𝟱',6:'𝟲',7:'𝟳',8:'𝟴',9:'𝟵'
};

const fancy = t => t.replace(/\d/g, d => numMap[d]);

// ================= TIME =================
const getTime = () =>
  moment().tz('Asia/Tehran').format('HH:mm');

function jalali() {
  const j = jalaali.toJalaali(new Date());

  return fancy(
    `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`
  );
}

// ================= THEMES =================
const themes = [
  { emoji:'🕐', deco:'⌬', name:'cyber' },
  { emoji:'🕑', deco:'⟐', name:'neon' },
  { emoji:'🕒', deco:'⟁', name:'matrix' },
  { emoji:'🕓', deco:'✦', name:'clean' },
  { emoji:'🕔', deco:'✧', name:'minimal' },
  { emoji:'🕕', deco:'⫷', name:'military' },
  { emoji:'🕖', deco:'⚡', name:'electric' },
  { emoji:'🕗', deco:'☢', name:'nuclear' },
];

function getTheme() {
  const m = new Date().getMinutes();
  return themes[m % themes.length];
}

// ================= BUILD =================
function buildTitle(prefix='') {
  const t = getTheme();

  return `${t.emoji} ${t.deco} ${prefix} ${fancy(getTime())}`.trim();
}

function buildBio() {
  const t = getTheme();

  return `
╭──⌈ ${t.deco} LIVE CLOCK ${t.deco} ⌋──╮

🕒 Time : ${fancy(getTime())}
📅 Date : ${jalali()}
🌍 Zone : Asia/Tehran
🎭 Theme : ${t.name}

⚡ Railway Runtime
🤖 CLOCK OS

╰──────────────╯
`.trim();
}

// ================= OWNER =================
const isOwner = id => id === OWNER_ID;

// ================= START =================
bot.start(ctx => {
  if (!isOwner(ctx.from.id)) return;

  ctx.reply(`
⚡ CLOCK OS

/add -100ID PREFIX
/remove ID
/list
/on ID
/off ID
/ping
  `.trim());
});

// ================= PING =================
bot.command('ping', ctx => {
  if (!isOwner(ctx.from.id)) return;

  ctx.reply('🏓 online');
});

// ================= ADD =================
bot.command('add', ctx => {
  if (!isOwner(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');

  const chatId = Number(args[1]);

  if (!chatId) {
    return ctx.reply('❌ invalid id');
  }

  const prefix = args.slice(2).join(' ');

  const exists = db.channels.find(c => c.chatId === chatId);

  if (exists) {
    return ctx.reply('⚠ already exists');
  }

  db.channels.push({
    chatId,
    prefix,
    enabled: true,
    last: ''
  });

  saveDB();

  ctx.reply('✅ added');
});

// ================= REMOVE =================
bot.command('remove', ctx => {
  if (!isOwner(ctx.from.id)) return;

  const id = Number(ctx.message.text.split(' ')[1]);

  db.channels = db.channels.filter(c => c.chatId !== id);

  saveDB();

  ctx.reply('🗑 removed');
});

// ================= LIST =================
bot.command('list', ctx => {
  if (!isOwner(ctx.from.id)) return;

  if (!db.channels.length) {
    return ctx.reply('empty');
  }

  ctx.reply(
    db.channels.map(c =>
      `🛰 ${c.chatId}\n${c.prefix}\n${c.enabled ? '🟢 ON' : '🔴 OFF'}`
    ).join('\n\n')
  );
});

// ================= ON/OFF =================
bot.command('on', ctx => {
  const id = Number(ctx.message.text.split(' ')[1]);

  const c = db.channels.find(x => x.chatId === id);

  if (!c) return;

  c.enabled = true;

  saveDB();
});

bot.command('off', ctx => {
  const id = Number(ctx.message.text.split(' ')[1]);

  const c = db.channels.find(x => x.chatId === id);

  if (!c) return;

  c.enabled = false;

  saveDB();
});

// ================= DELETE SERVICE MSG =================
bot.on('channel_post', async ctx => {
  try {
    if (
      ctx.channelPost?.new_chat_title ||
      ctx.channelPost?.new_chat_photo
    ) {
      await ctx.deleteMessage();
    }
  } catch {}
});

// ================= MAIN LOOP =================
async function tick() {

  if (isRunning) return;

  isRunning = true;

  try {

    for (const c of db.channels) {

      if (!c.enabled) continue;

      try {

        const title = buildTitle(c.prefix);
        const bio = buildBio();

        if (title === c.last) continue;

        await bot.telegram.setChatTitle(
          c.chatId,
          title
        );

        await new Promise(r => setTimeout(r, 1500));

        await bot.telegram.setChatDescription(
          c.chatId,
          bio
        );

        c.last = title;

        console.log('UPDATED', c.chatId);

      } catch (e) {

        const msg =
          e.description ||
          e.response?.description ||
          e.message;

        console.log('ERROR:', msg);

        // FloodWait
        if (
          msg &&
          msg.toLowerCase().includes('too many requests')
        ) {
          console.log('⏳ flood wait...');
          await new Promise(r => setTimeout(r, 10000));
        }

      }

      await new Promise(r => setTimeout(r, 3000));
    }

    saveDB();

  } finally {
    isRunning = false;
  }
}

// ================= INTERVAL =================
setInterval(tick, 60000);

tick();

// ================= ERROR HANDLERS =================
process.on('unhandledRejection', err => {
  console.log('UNHANDLED', err);
});

process.on('uncaughtException', err => {
  console.log('CRASH', err);
});

// ================= START =================
bot.launch();

console.log('🚀 CLOCK OS RUNNING');

// ================= EXIT =================
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));