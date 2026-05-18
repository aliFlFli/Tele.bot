require('dotenv').config();

const { Telegraf } = require('telegraf');
const express = require('express');
const moment = require('moment-timezone');
require('moment/locale/fa');

const jalaali = require('jalaali-js');
const fs = require('fs');
const os = require('os');

// =====================================================
// CONFIG
// =====================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);

const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);

const app = express();

const DATA_FILE = './database.json';

// =====================================================
// DATABASE
// =====================================================

let db = {
  channels: [],
  stats: {
    updates: 0,
    started: Date.now()
  }
};

try {

  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );
  }

} catch {

  console.log('NEW DATABASE');

}

function saveDB() {

  try {

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2)
    );

  } catch (e) {

    console.log('DB ERROR', e.message);

  }

}

// =====================================================
// FONTS
// =====================================================

const fonts = {

  bold: {
    0:'𝟬',1:'𝟭',2:'𝟮',3:'𝟯',4:'𝟰',
    5:'𝟱',6:'𝟲',7:'𝟳',8:'𝟴',9:'𝟵'
  },

  mono: {
    0:'𝟶',1:'𝟷',2:'𝟸',3:'𝟹',4:'𝟺',
    5:'𝟻',6:'𝟼',7:'𝟽',8:'𝟾',9:'𝟿'
  },

  circle: {
    0:'⓪',1:'①',2:'②',3:'③',4:'④',
    5:'⑤',6:'⑥',7:'⑦',8:'⑧',9:'⑨'
  }

};

function applyFont(text, font='bold') {

  const map = fonts[font] || fonts.bold;

  return text.replace(/\d/g, d => map[d]);

}

// =====================================================
// THEMES
// =====================================================

const themes = [

  {
    name:'cyber',
    emoji:['⚡','☢','✦','⟁'],
    deco:'⌬',
    font:'bold'
  },

  {
    name:'matrix',
    emoji:['🟢','💚','📟','🧪'],
    deco:'⫸',
    font:'mono'
  },

  {
    name:'military',
    emoji:['🪖','🎖','⚔','☣'],
    deco:'⫷',
    font:'bold'
  },

  {
    name:'minimal',
    emoji:['◐','◓','◑','◒'],
    deco:'✧',
    font:'mono'
  },

  {
    name:'space',
    emoji:['🛰','🌌','🚀','🛸'],
    deco:'✦',
    font:'circle'
  }

];

// =====================================================
// HELPERS
// =====================================================

function getTheme(channel) {

  if (channel.theme) {

    const found = themes.find(
      t => t.name === channel.theme
    );

    if (found) return found;

  }

  const m = new Date().getMinutes();

  return themes[m % themes.length];

}

function getFrame(arr) {

  return arr[
    Math.floor(Date.now()/1000) % arr.length
  ];

}

function getTime(font='bold') {

  return applyFont(
    moment()
      .tz('Asia/Tehran')
      .format('HH:mm'),
    font
  );

}

function getDate(font='bold') {

  const j = jalaali.toJalaali(new Date());

  return applyFont(
    `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`,
    font
  );

}

function buildTitle(channel) {

  const t = getTheme(channel);

  const icon = getFrame(t.emoji);

  return `${icon} ${t.deco} ${channel.prefix || ''} ${getTime(t.font)}`.trim();

}

function buildBio(channel) {

  const t = getTheme(channel);

  const icon = getFrame(t.emoji);

  return `
╭──⌈ ${t.deco} CLOCK OS ${t.deco} ⌋──╮

${icon} Time : ${getTime(t.font)}
📅 Date : ${getDate(t.font)}
🌍 Zone : Asia/Tehran

🎭 Theme : ${t.name}
⚙ Runtime : Railway
📡 Status : ONLINE

⚡ Updates : ${db.stats.updates}

╰──────────────╯
`.trim();

}

function isOwner(id) {

  return id === OWNER_ID;

}

function delay(ms) {

  return new Promise(r => setTimeout(r, ms));

}

// =====================================================
// EXPRESS DASHBOARD
// =====================================================

app.get('/', (req, res) => {

  res.send(`
  <html>
  <head>
    <title>CLOCK OS</title>

    <style>

      body{
        background:#0f0f0f;
        color:white;
        font-family:sans-serif;
        padding:30px;
      }

      .card{
        background:#1a1a1a;
        padding:20px;
        margin:10px 0;
        border-radius:15px;
      }

      .on{
        color:#00ff88;
      }

      .off{
        color:red;
      }

    </style>

  </head>

  <body>

    <h1>⚡ CLOCK OS</h1>

    <div class="card">
      <h3>Channels : ${db.channels.length}</h3>
      <h3>Updates : ${db.stats.updates}</h3>
      <h3>Uptime : ${Math.floor(process.uptime())}s</h3>
      <h3>RAM : ${(os.totalmem()/1024/1024/1024).toFixed(1)} GB</h3>
    </div>

    ${
      db.channels.map(c => `

      <div class="card">

        <h2>${c.prefix}</h2>

        <p>ID : ${c.chatId}</p>

        <p class="${c.enabled ? 'on':'off'}">
          ${c.enabled ? 'ONLINE':'OFFLINE'}
        </p>

        <p>Theme : ${c.theme || 'auto'}</p>

      </div>

      `).join('')
    }

  </body>
  </html>
  `);

});

app.listen(PORT, () => {

  console.log('WEB ONLINE', PORT);

});

// =====================================================
// BOT COMMANDS
// =====================================================

bot.start(ctx => {

  if (!isOwner(ctx.from.id)) return;

  ctx.reply(`
⚡ CLOCK OS V2

/add -100id name
/remove id
/list
/on id
/off id

/theme id cyber
/themes

/stats
/ping
/runtime
  `.trim());

});

// =====================================================
// PING
// =====================================================

bot.command('ping', ctx => {

  if (!isOwner(ctx.from.id)) return;

  ctx.reply('🏓 ONLINE');

});

// =====================================================
// STATS
// =====================================================

bot.command('stats', ctx => {

  if (!isOwner(ctx.from.id)) return;

  ctx.reply(`
📡 CHANNELS : ${db.channels.length}

⚡ UPDATES : ${db.stats.updates}

🕒 UPTIME : ${Math.floor(process.uptime())}s

💾 RAM : ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
  `.trim());

});

// =====================================================
// THEMES
// =====================================================

bot.command('themes', ctx => {

  if (!isOwner(ctx.from.id)) return;

  ctx.reply(
    themes.map(t => `🎭 ${t.name}`).join('\n')
  );

});

// =====================================================
// ADD
// =====================================================

bot.command('add', ctx => {

  if (!isOwner(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');

  const chatId = Number(args[1]);

  if (!chatId) {
    return ctx.reply('❌ invalid');
  }

  const prefix = args.slice(2).join(' ');

  const exists = db.channels.find(
    c => c.chatId === chatId
  );

  if (exists) {
    return ctx.reply('⚠ already exists');
  }

  db.channels.push({

    chatId,
    prefix,

    enabled:true,

    theme:'auto',

    last:''

  });

  saveDB();

  ctx.reply('✅ added');

});

// =====================================================
// REMOVE
// =====================================================

bot.command('remove', ctx => {

  if (!isOwner(ctx.from.id)) return;

  const id = Number(
    ctx.message.text.split(' ')[1]
  );

  db.channels = db.channels.filter(
    c => c.chatId !== id
  );

  saveDB();

  ctx.reply('🗑 removed');

});

// =====================================================
// LIST
// =====================================================

bot.command('list', ctx => {

  if (!isOwner(ctx.from.id)) return;

  if (!db.channels.length) {
    return ctx.reply('empty');
  }

  ctx.reply(

    db.channels.map(c => `

🛰 ${c.chatId}

🏷 ${c.prefix}

🎭 ${c.theme}

${c.enabled ? '🟢 ON':'🔴 OFF'}

    `).join('\n')
  );

});

// =====================================================
// ON/OFF
// =====================================================

bot.command('on', ctx => {

  const id = Number(
    ctx.message.text.split(' ')[1]
  );

  const c = db.channels.find(
    x => x.chatId === id
  );

  if (!c) return;

  c.enabled = true;

  saveDB();

  ctx.reply('🟢 enabled');

});

bot.command('off', ctx => {

  const id = Number(
    ctx.message.text.split(' ')[1]
  );

  const c = db.channels.find(
    x => x.chatId === id
  );

  if (!c) return;

  c.enabled = false;

  saveDB();

  ctx.reply('🔴 disabled');

});

// =====================================================
// THEME
// =====================================================

bot.command('theme', ctx => {

  if (!isOwner(ctx.from.id)) return;

  const args = ctx.message.text.split(' ');

  const id = Number(args[1]);

  const theme = args[2];

  const c = db.channels.find(
    x => x.chatId === id
  );

  if (!c) {
    return ctx.reply('❌ channel not found');
  }

  if (
    theme !== 'auto' &&
    !themes.find(t => t.name === theme)
  ) {
    return ctx.reply('❌ invalid theme');
  }

  c.theme = theme;

  saveDB();

  ctx.reply('🎭 theme updated');

});

// =====================================================
// DELETE SERVICE MSG
// =====================================================

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

// =====================================================
// UPDATE ENGINE
// =====================================================

let running = false;

async function tick() {

  if (running) return;

  running = true;

  try {

    for (const c of db.channels) {

      if (!c.enabled) continue;

      try {

        const title = buildTitle(c);

        if (title === c.last) {
          continue;
        }

        const bio = buildBio(c);

        await bot.telegram.setChatTitle(
          c.chatId,
          title
        );

        await delay(2000);

        await bot.telegram.setChatDescription(
          c.chatId,
          bio
        );

        c.last = title;

        db.stats.updates++;

        console.log(
          'UPDATED',
          c.chatId,
          title
        );

      } catch (e) {

        const msg =

          e.description ||
          e.response?.description ||
          e.message;

        console.log('ERROR', msg);

        if (
          msg &&
          msg.toLowerCase().includes(
            'too many requests'
          )
        ) {

          console.log('FLOOD WAIT');

          await delay(15000);

        }

      }

      await delay(4000);

    }

    saveDB();

  } finally {

    running = false;

  }

}

setInterval(tick, 60000);

tick();

// =====================================================
// ERRORS
// =====================================================

process.on('unhandledRejection', err => {

  console.log('UNHANDLED', err);

});

process.on('uncaughtException', err => {

  console.log('CRASH', err);

});

// =====================================================
// START
// =====================================================

bot.launch();

console.log('🚀 CLOCK OS V2 ONLINE');

// =====================================================
// EXIT
// =====================================================

process.once('SIGINT', () => {

  bot.stop('SIGINT');

});

process.once('SIGTERM', () => {

  bot.stop('SIGTERM');

});