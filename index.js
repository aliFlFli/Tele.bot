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

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found in .env');
  process.exit(1);
}
if (!OWNER_ID) {
  console.error('❌ OWNER_ID not found in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const DATA_FILE = './database.json';
let running = false;
let server = null; // برای graceful shutdown

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
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      // اطمینان از وجود فیلدها
      db = {
        channels: parsed.channels || [],
        stats: {
          updates: parsed.stats?.updates || 0,
          started: parsed.stats?.started || Date.now()
        }
      };
    }
  }
} catch (e) {
  console.log('⚠️ Database reset due to error:', e.message);
}

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log('❌ DB save error:', e.message);
  }
}

// =====================================================
// FONTS
// =====================================================

const fonts = {
  bold: {
    0: '𝟬', 1: '𝟭', 2: '𝟮', 3: '𝟯', 4: '𝟰',
    5: '𝟱', 6: '𝟲', 7: '𝟳', 8: '𝟴', 9: '𝟵'
  },
  mono: {
    0: '𝟶', 1: '𝟷', 2: '𝟸', 3: '𝟹', 4: '𝟺',
    5: '𝟻', 6: '𝟼', 7: '𝟽', 8: '𝟾', 9: '𝟿'
  },
  circle: {
    0: '⓪', 1: '①', 2: '②', 3: '③', 4: '④',
    5: '⑤', 6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨'
  }
};

function applyFont(text, font = 'bold') {
  const map = fonts[font] || fonts.bold;
  return text.replace(/\d/g, d => map[d]);
}

// =====================================================
// THEMES
// =====================================================

const themes = [
  { name: 'cyber', emoji: ['⚡', '☢', '✦', '⟁'], deco: '⌬', font: 'bold' },
  { name: 'matrix', emoji: ['🟢', '💚', '📟', '🧪'], deco: '⫸', font: 'mono' },
  { name: 'military', emoji: ['🪖', '🎖', '⚔', '☣'], deco: '⫷', font: 'bold' },
  { name: 'minimal', emoji: ['◐', '◓', '◑', '◒'], deco: '✧', font: 'mono' },
  { name: 'space', emoji: ['🛰', '🌌', '🚀', '🛸'], deco: '✦', font: 'circle' }
];

// =====================================================
// HELPERS
// =====================================================

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isOwner(id) {
  return id === OWNER_ID;
}

function getFrame(arr) {
  return arr[Math.floor(Date.now() / 1000) % arr.length];
}

function getTheme(channel) {
  if (channel.theme && channel.theme !== 'auto') {
    const found = themes.find(t => t.name === channel.theme);
    if (found) return found;
  }
  const m = new Date().getMinutes();
  return themes[m % themes.length];
}

function getTime(font = 'bold') {
  return applyFont(
    moment().tz('Asia/Tehran').format('HH:mm'),
    font
  );
}

function getDate(font = 'bold') {
  const j = jalaali.toJalaali(new Date());
  return applyFont(
    `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`,
    font
  );
}

function buildTitle(channel) {
  const t = getTheme(channel);
  const prefix = channel.prefix ? `${channel.prefix} ` : '';
  return `${getFrame(t.emoji)} ${t.deco} ${prefix}${getTime(t.font)}`.trim();
}

function buildBio(channel) {
  const t = getTheme(channel);
  return `
╭──⌈ ${t.deco} CLOCK OS ${t.deco} ⌋──╮

${getFrame(t.emoji)} Time : ${getTime(t.font)}
📅 Date : ${getDate(t.font)}
🌍 Zone : Asia/Tehran

🎭 Theme : ${t.name}
📡 Status : ONLINE
⚡ Updates : ${db.stats.updates}

╰──────────────╯
`.trim();
}

// =====================================================
// RETRY LOGIC FOR RATE LIMIT
// =====================================================
async function withRetry(fn, context, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isRateLimit = e.response?.statusCode === 429 ||
        (e.description && e.description.toLowerCase().includes('too many requests'));
      if (isRateLimit && i < maxRetries - 1) {
        const retryAfter = e.response?.parameters?.retry_after || 5;
        const wait = retryAfter * 1000 + (i * 1000);
        console.log(`⚠️ Rate limited for ${context}, retry in ${wait / 1000}s`);
        await delay(wait);
        continue;
      }
      break;
    }
  }
  throw lastError;
}

// =====================================================
// WEB SERVER
// =====================================================

app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>CLOCK OS</title>
    <style>
      body{ background:#0f0f0f; color:white; font-family:sans-serif; padding:20px; }
      .card{ background:#1b1b1b; padding:20px; border-radius:15px; margin-bottom:15px; }
      .on{ color:#00ff88; }
      .off{ color:red; }
    </style>
  </head>
  <body>
    <h1>⚡ CLOCK OS</h1>
    <div class="card">
      <h3>Channels : ${db.channels.length}</h3>
      <h3>Updates : ${db.stats.updates}</h3>
      <h3>Uptime : ${Math.floor(process.uptime())}s</h3>
      <h3>RAM : ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB</h3>
    </div>
    ${db.channels.map(c => `
      <div class="card">
        <h2>${c.prefix || '—'}</h2>
        <p>ID : ${c.chatId}</p>
        <p>Theme : ${c.theme || 'auto'}</p>
        <p class="${c.enabled ? 'on' : 'off'}">${c.enabled ? 'ONLINE' : 'OFFLINE'}</p>
      </div>
    `).join('')}
  </body>
  </html>
  `);
});

app.get('/health', (req, res) => res.send('OK'));

// =====================================================
// COMMANDS
// =====================================================

bot.start(ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  ctx.reply(`
⚡ CLOCK OS V2

/add -100id name
/remove id
/list

/on id
/off id

/themes
/theme id name

/stats
/ping
  `);
});

bot.command('ping', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  ctx.reply('🏓 ONLINE');
});

bot.command('stats', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  ctx.reply(`
📡 Channels : ${db.channels.length}
⚡ Updates : ${db.stats.updates}
🕒 Uptime : ${Math.floor(process.uptime())} sec
💾 RAM : ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
  `);
});

bot.command('themes', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  ctx.reply(themes.map(t => `🎭 ${t.name}`).join('\n'));
});

bot.command('add', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  const args = ctx.message.text.split(' ');
  const chatId = Number(args[1]);
  if (!chatId) return ctx.reply('❌ invalid id');
  const prefix = args.slice(2).join(' ');
  if (db.channels.find(c => c.chatId === chatId)) return ctx.reply('⚠ already exists');
  db.channels.push({
    chatId,
    prefix,
    enabled: true,
    theme: 'auto',
    last: ''
  });
  saveDB();
  ctx.reply('✅ added');
});

bot.command('remove', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  db.channels = db.channels.filter(c => c.chatId !== id);
  saveDB();
  ctx.reply('🗑 removed');
});

bot.command('list', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  if (!db.channels.length) return ctx.reply('empty');
  ctx.reply(db.channels.map(c => `
🛰 ${c.chatId}
🏷 ${c.prefix || '—'}
🎭 ${c.theme}
${c.enabled ? '🟢 ON' : '🔴 OFF'}
  `).join('\n'));
});

bot.command('on', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  const c = db.channels.find(x => x.chatId === id);
  if (!c) return ctx.reply('❌ not found');
  c.enabled = true;
  saveDB();
  ctx.reply('🟢 enabled');
});

bot.command('off', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  const c = db.channels.find(x => x.chatId === id);
  if (!c) return ctx.reply('❌ not found');
  c.enabled = false;
  saveDB();
  ctx.reply('🔴 disabled');
});

bot.command('theme', ctx => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  const args = ctx.message.text.split(' ');
  const id = Number(args[1]);
  const themeName = args[2];
  const c = db.channels.find(x => x.chatId === id);
  if (!c) return ctx.reply('❌ channel not found');
  if (themeName !== 'auto' && !themes.find(t => t.name === themeName))
    return ctx.reply('❌ invalid theme');
  c.theme = themeName;
  saveDB();
  ctx.reply('🎭 theme updated');
});

// حذف پیام‌های سرویس تغییر عنوان/عکس
bot.on('channel_post', async ctx => {
  try {
    if (ctx.channelPost?.new_chat_title || ctx.channelPost?.new_chat_photo) {
      await ctx.deleteMessage();
    }
  } catch { }
});

// =====================================================
// UPDATE ENGINE
// =====================================================

async function tick() {
  if (running) return;
  running = true;
  let changed = false;

  try {
    for (const c of db.channels) {
      if (!c.enabled) continue;

      try {
        const title = buildTitle(c);
        if (title === c.last) {
          continue; // بدون تغییر
        }

        // به‌روزرسانی عنوان با retry
        await withRetry(() => bot.telegram.setChatTitle(c.chatId, title), `setTitle ${c.chatId}`);
        await delay(1000); // 1 ثانیه بین title و description

        const bio = buildBio(c);
        await withRetry(() => bot.telegram.setChatDescription(c.chatId, bio), `setDesc ${c.chatId}`);

        c.last = title;
        db.stats.updates++;
        changed = true;
        console.log(`✅ Updated ${c.chatId} (${c.prefix || 'no prefix'})`);

      } catch (e) {
        const msg = e.description || e.response?.description || e.message || '';
        console.log(`❌ Error for ${c.chatId}: ${msg}`);

        // غیرفعال کردن کانال در صورت عدم دسترسی یا حذف شدن
        if (msg.toLowerCase().includes('chat not found') ||
            msg.toLowerCase().includes('forbidden') ||
            msg.toLowerCase().includes('bot is not a member')) {
          c.enabled = false;
          changed = true;
          console.log(`⛔ Disabled channel ${c.chatId} (access revoked)`);
        }
      }

      await delay(2000); // فاصله بین کانال‌ها (کاهش یافته به 2 ثانیه)
    }

    if (changed) saveDB();

  } finally {
    running = false;
  }
}

// اجرای تیک هر 60 ثانیه با جلوگیری از همپوشانی
setInterval(() => {
  tick().catch(err => console.error('Tick error:', err));
}, 60000);

// اجرای اولیه
tick().catch(err => console.error('Initial tick error:', err));

// =====================================================
// START WEB SERVER
// =====================================================

server = app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =====================================================
// START BOT
// =====================================================

(async () => {
  try {
    await bot.launch({ dropPendingUpdates: true });
    console.log('🚀 Bot is online');
  } catch (e) {
    console.error('❌ Bot launch error:', e.message);
    process.exit(1);
  }
})();

// =====================================================
// ERROR HANDLERS
// =====================================================

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  bot.stop(signal);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));