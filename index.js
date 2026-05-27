const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "N ";
const DB_FILE = "./database.json";

// ---------------- DATABASE ----------------
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ensure user
function ensureUser(id) {
  if (!db[id]) {
    db[id] = {
      wallet: 0,
      bank: 0,
      daily: 0,
      work: 0
    };
  }
}

// ---------------- HELP ----------------
function helpMenu() {
  return `
💰 ECONOMY COMMANDS

!balance | !bal
!daily
!work
!beg
!deposit <amt>
!withdraw <amt>
!pay <user> <amt>
!give <user> <amt> (admin)
!rob <user>
!leaderboard

SHOP:
!buy <item>
!shop
!inventory

FUN:
!coinflip <heads/tails> <amt>
!dice <amt>
!slots <amt>

INFO:
!ping
!status
!help
  `;
}

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- MESSAGE ----------------
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  db = loadDB();
  ensureUser(message.author.id);

  const user = db[message.author.id];

  // ---------------- BASIC ----------------
  if (cmd === "ping") {
    return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }

  if (cmd === "help") {
    return message.reply(helpMenu());
  }

  if (cmd === "status") {
    return message.reply("🟢 Bot is running perfectly!");
  }

  // ---------------- BALANCE ----------------
  if (cmd === "balance" || cmd === "bal") {
    return message.reply(`💰 Wallet: ${user.wallet}\n🏦 Bank: ${user.bank}`);
  }

  // ---------------- DAILY ----------------
  if (cmd === "daily") {
    const now = Date.now();
    if (now - user.daily < 86400000) {
      return message.reply("⏳ You already claimed daily reward.");
    }

    const amount = 1000;
    user.wallet += amount;
    user.daily = now;

    saveDB(db);
    return message.reply(`🎁 You received ${amount} coins daily reward!`);
  }

  // ---------------- WORK ----------------
  if (cmd === "work") {
    const earn = Math.floor(Math.random() * 500) + 100;
    user.wallet += earn;
    saveDB(db);
    return message.reply(`🛠️ You worked and earned ${earn} coins!`);
  }

  // ---------------- BEG ----------------
  if (cmd === "beg") {
    const earn = Math.floor(Math.random() * 200);
    user.wallet += earn;
    saveDB(db);
    return message.reply(`🙏 You begged and got ${earn} coins`);
  }

  // ---------------- DEPOSIT ----------------
  if (cmd === "deposit") {
    const amt = parseInt(args[0]);
    if (!amt || amt <= 0 || user.wallet < amt) return message.reply("❌ Invalid amount");

    user.wallet -= amt;
    user.bank += amt;
    saveDB(db);

    return message.reply(`🏦 Deposited ${amt}`);
  }

  // ---------------- WITHDRAW ----------------
  if (cmd === "withdraw") {
    const amt = parseInt(args[0]);
    if (!amt || amt <= 0 || user.bank < amt) return message.reply("❌ Invalid amount");

    user.bank -= amt;
    user.wallet += amt;
    saveDB(db);

    return message.reply(`💰 Withdrawn ${amt}`);
  }

  // ---------------- PAY ----------------
  if (cmd === "pay") {
    const target = message.mentions.users.first();
    const amt = parseInt(args[1]);

    if (!target || !amt) return message.reply("Usage: !pay @user amount");

    ensureUser(target.id);

    if (user.wallet < amt) return message.reply("❌ Not enough money");

    user.wallet -= amt;
    db[target.id].wallet += amt;

    saveDB(db);
    return message.reply(`💸 Paid ${amt} to ${target.username}`);
  }

  // ---------------- ROB ----------------
  if (cmd === "rob") {
    const target = message.mentions.users.first();
    if (!target) return message.reply("Mention someone to rob");

    ensureUser(target.id);

    const success = Math.random() > 0.5;

    if (!success) {
      user.wallet -= 200;
      saveDB(db);
      return message.reply("🚨 You got caught and lost 200 coins!");
    }

    const steal = Math.floor(Math.random() * 500);
    user.wallet += steal;
    db[target.id].wallet -= steal;

    saveDB(db);
    return message.reply(`💰 You robbed ${steal} coins`);
  }

  // ---------------- LEADERBOARD ----------------
  if (cmd === "leaderboard") {
    const top = Object.entries(db)
      .sort((a, b) => (b[1].wallet + b[1].bank) - (a[1].wallet + a[1].bank))
      .slice(0, 5);

    const text = await Promise.all(
      top.map(async (u, i) => {
        const user = await client.users.fetch(u[0]).catch(() => null);
        return `${i + 1}. ${user?.username || "Unknown"} - ${u[1].wallet + u[1].bank}`;
      })
    );

    return message.reply("🏆 Leaderboard:\n" + text.join("\n"));
  }

  // ---------------- SIMPLE SHOP ----------------
  if (cmd === "shop") {
    return message.reply(`
🛒 SHOP
- phone (500)
- laptop (2000)
- car (5000)

Use: !buy item
    `);
  }

  if (cmd === "buy") {
    const item = args[0];
    const prices = { phone: 500, laptop: 2000, car: 5000 };

    if (!prices[item]) return message.reply("Item not found");

    if (user.wallet < prices[item]) return message.reply("❌ Not enough money");

    user.wallet -= prices[item];

    if (!user.inv) user.inv = [];
    user.inv.push(item);

    saveDB(db);
    return message.reply(`🛒 Bought ${item}`);
  }

  if (cmd === "inventory") {
    return message.reply("🎒 Items: " + (user.inv?.join(", ") || "Empty"));
  }

  // ---------------- FUN ----------------
  if (cmd === "coinflip") {
    const choice = args[0];
    const bet = parseInt(args[1]);

    if (!choice || !bet) return message.reply("Usage: !coinflip heads/tails amount");

    const result = Math.random() > 0.5 ? "heads" : "tails";

    if (choice !== result) {
      user.wallet -= bet;
      saveDB(db);
      return message.reply(`❌ You lost! It was ${result}`);
    }

    user.wallet += bet;
    saveDB(db);
    return message.reply(`🎉 You won! It was ${result}`);
  }

  if (cmd === "dice") {
    const bet = parseInt(args[0]);
    const roll = Math.floor(Math.random() * 6) + 1;

    if (roll > 3) user.wallet += bet;
    else user.wallet -= bet;

    saveDB(db);
    return message.reply(`🎲 Rolled ${roll}`);
  }

  if (cmd === "slots") {
    const bet = parseInt(args[0]);
    const symbols = ["🍒", "🍋", "💎"];
    const a = symbols[Math.floor(Math.random() * 3)];
    const b = symbols[Math.floor(Math.random() * 3)];
    const c = symbols[Math.floor(Math.random() * 3)];

    if (a === b && b === c) {
      user.wallet += bet * 3;
      saveDB(db);
      return message.reply(`${a} ${b} ${c} | JACKPOT!`);
    }

    user.wallet -= bet;
    saveDB(db);
    return message.reply(`${a} ${b} ${c} | You lost`);
  }
});

// ---------------- LOGIN ----------------
client.login("YOUR_BOT_TOKEN");
