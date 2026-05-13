require('dotenv').config();

const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');
require('moment/locale/fa');
const jalaali = require('jalaali-js');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

const DATA_FILE = './channels.json';

// ================= DB =================
let db = { channels: [] };

if (fs.existsSync(DATA_FILE)) {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

const saveDB = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

// ================= FONTS =================
const numMap = {
  0:'𝟬',1:'𝟭',2:'𝟮',3:'𝟯',4:'𝟰',
  5:'𝟱',6:'𝟲',7:'𝟳',8:'𝟴',9:'𝟵'
};

const fancy = t => t.replace(/\d/g, d => numMap[d]);

// ================= TIME =================
const time = () =>
  moment().tz('Asia/Tehran').format('HH:mm');

// ================= THEMES (ANIMATION) =================
const themes = [
  { emoji:'🕐', deco:'⌬', name:'cyber' },
  { emoji:'🕑', deco:'⟐', name:'neon' },
  { emoji:'🕒', deco:'⟁', name:'matrix' },
  { emoji:'🕓', deco:'✦', name:'clean' },
  { emoji:'🕔', deco:'✧', name:'minimal' },
  { emoji:'🕕', deco:'⫷', name:'military' },
];

const getTheme = () => {
  const m = new Date().getMinutes();
  return themes[m % themes.length];
};

// ================= DATE =================
function jalali() {
  const j = jalaali.toJalaali(new Date());
  return fancy(`${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`);
}

// ================= TITLE =================
function buildTitle(prefix='') {
  const t = getTheme();
  return `${t.emoji} ${t.deco} ${prefix} ${fancy(time())}`.trim();
}

// ================= BIO =================
function buildBio() {
  const t = getTheme();

  return `
╭──⌈ ${t.deco} LIVE CLOCK ${t.deco} ⌋──╮

🕒 Time : ${fancy(time())}
📅 Date : ${jalali()}
🌍 Zone : Asia/Tehran
🎭 Theme : ${t.name}

╰─────⚡ POWERED BOT ⚡─────╯
`.trim();
}

// ================= DELETE SERVICE MESSAGES =================
bot.on('channel_post', async (ctx) => {
  try {
    if (ctx.channelPost?.new_chat_title) {
      await ctx.deleteMessage();
    }
  } catch {}
});

// ================= OWNER =================
const isOwner = id => id === OWNER_ID;

// ================= COMMANDS =================
bot.start(ctx => {
  if (!isOwner(ctx.from.id)) return;

  ctx.reply(`
⚡ CLOCK OS BOT

/add -100ID PREFIX
/remove ID
/list
/on ID
/off ID
/startclock
/stopclock
  `.trim());
});

bot.command('add', ctx => {
  if (!isOwner(ctx.from.id)) return;

  const p = ctx.message.text.split(' ');
  const chatId = Number(p[1]);
  const prefix = p.slice(2).join(' ');

  if (!chatId) return ctx.reply('❌ invalid');

  db.channels.push({
    chatId,
    prefix,
    enabled:true,
    last:''
  });

  saveDB();
  ctx.reply('✅ added');
});

bot.command('remove', ctx => {
  if (!isOwner(ctx.from.id)) return;

  const id = Number(ctx.message.text.split(' ')[1]);
  db.channels = db.channels.filter(c => c.chatId !== id);

  saveDB();
  ctx.reply('🗑 removed');
});

bot.command('list', ctx => {
  if (!isOwner(ctx.from.id)) return;

  ctx.reply(
    db.channels.map(c =>
      `${c.chatId} | ${c.prefix} | ${c.enabled?'ON':'OFF'}`
    ).join('\n') || 'empty'
  );
});

bot.command('on', ctx => {
  const id = Number(ctx.message.text.split(' ')[1]);
  const c = db.channels.find(x=>x.chatId===id);
  if (c) c.enabled = true;
  saveDB();
});

bot.command('off', ctx => {
  const id = Number(ctx.message.text.split(' ')[1]);
  const c = db.channels.find(x=>x.chatId===id);
  if (c) c.enabled = false;
  saveDB();
});

// ================= MAIN LOOP =================
async function tick() {

  for (const c of db.channels) {
    if (!c.enabled) continue;

    try {
      const title = buildTitle(c.prefix);
      const bio = buildBio();

      // جلوگیری از اسپم
      if (c.last === title) continue;

      await bot.telegram.setChatTitle(c.chatId, title);
      await bot.telegram.setChatDescription(c.chatId, bio);

      c.last = title;
      saveDB();

      console.log('updated', c.chatId);

    } catch (e) {
      console.log(e.description || e.message);
    }

    await new Promise(r => setTimeout(r, 2500));
  }
}

setInterval(tick, 60000);
tick();

// ================= START =================
bot.launch({
  allowedUpdates:['message','channel_post']
});

console.log('🚀 CLOCK OS FULL BOT RUNNING');

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
