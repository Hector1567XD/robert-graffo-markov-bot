# 🧠 Markov Telegram Bot

Node.js + Telegraf + SQLite + Python (NetworkX)

Bot que aprende de mensajes de grupo usando cadenas de Markov (bigramas)
y puede generar frases o visualizar el grafo.

---

# 📁 ESTRUCTURA DEL PROYECTO

```
markov-bot/
  package.json
  .env
  src/
    index.js
    db.js
    markov.js
    settings.js
  scripts/
    grafo.py
  data/
```

---

# 1️⃣ package.json

```json
{
  "name": "markov-telegram-bot",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.5.0",
    "dotenv": "^16.4.5",
    "telegraf": "^4.16.3"
  }
}
```

---

# 2️⃣ .env

```
BOT_TOKEN=TU_TOKEN
DB_PATH=./data/markov.sqlite
PYTHON_BIN=python3
```

---

# 3️⃣ src/settings.js

```js
export const StartMode = Object.freeze({
  START: "start",
  RANDOM: "random",
  MIX: "mix"
});

export const DEFAULT_SETTINGS = Object.freeze({
  temperature: 1.0,
  startMode: StartMode.START,
  randomStartProb: 0.25
});

const settingsMap = new Map();

export function getSettings(chatId) {
  const s = settingsMap.get(chatId);
  return s ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS };
}

export function setTemperature(chatId, temperature) {
  const s = getSettings(chatId);
  s.temperature = temperature;
  settingsMap.set(chatId, s);
}

export function setStartMode(chatId, mode) {
  const s = getSettings(chatId);
  s.startMode = mode;
  settingsMap.set(chatId, s);
}

export function setRandomStartProb(chatId, prob) {
  const s = getSettings(chatId);
  s.randomStartProb = prob;
  settingsMap.set(chatId, s);
}

export function formatSettings(chatId) {
  const s = getSettings(chatId);
  return `temperature=${s.temperature} | startMode=${s.startMode} | randomStartProb=${s.randomStartProb}`;
}
```

---

# 4️⃣ src/db.js

```js
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function createDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS markov_graph (
      chat_id INTEGER NOT NULL,
      word_a TEXT NOT NULL,
      word_b TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (chat_id, word_a, word_b)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_word_a
      ON markov_graph(chat_id, word_a);
  `);

  const upsert = db.prepare(`
    INSERT INTO markov_graph (chat_id, word_a, word_b, frequency)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(chat_id, word_a, word_b)
    DO UPDATE SET frequency = frequency + 1;
  `);

  const txInsert = db.transaction((chatId, pairs) => {
    for (const [a, b] of pairs) upsert.run(chatId, a, b);
  });

  const getNexts = db.prepare(`
    SELECT word_b AS wordB, frequency
    FROM markov_graph
    WHERE chat_id = ? AND word_a = ?
  `);

  const getRandomWord = db.prepare(`
    SELECT word_a AS wordA
    FROM markov_graph
    WHERE chat_id = ?
      AND word_a NOT IN ('__START__','__END__')
    ORDER BY RANDOM()
    LIMIT 1
  `);

  return { db, txInsert, getNexts, getRandomWord };
}
```

---

# 5️⃣ src/markov.js

```js
export const START = "__START__";
export const END = "__END__";

export function normalizeAndTokenize(text) {
  let t = text.toLowerCase();

  t = t.replace(/\bhttps?:\/\/\S+\b/gi, " ");
  // mantenemos menciones
  t = t.replace(/[^\p{L}\p{N}\s@]+/gu, " ");
  t = t.replace(/\s+/g, " ").trim();

  return t ? t.split(" ") : [];
}

export function makeBigrams(tokens) {
  const words = [START, ...tokens, END];
  const pairs = [];

  for (let i = 0; i < words.length - 1; i++) {
    pairs.push([words[i], words[i + 1]]);
  }

  return pairs;
}

function weightedChoice(rows, temperature) {
  let total = 0;
  const weights = [];

  for (const row of rows) {
    const w = Math.pow(row.frequency, 1 / temperature);
    weights.push(w);
    total += w;
  }

  let r = Math.random() * total;

  for (let i = 0; i < rows.length; i++) {
    r -= weights[i];
    if (r <= 0) return rows[i].wordB;
  }

  return rows[rows.length - 1].wordB;
}

export function generateSentence(store, chatId, settings) {
  let current;

  if (settings.startMode === "random") {
    const row = store.getRandomWord.get(chatId);
    if (!row) return "";
    current = row.wordA;
  } else if (settings.startMode === "mix") {
    if (Math.random() < settings.randomStartProb) {
      const row = store.getRandomWord.get(chatId);
      if (!row) return "";
      current = row.wordA;
    } else {
      current = START;
    }
  } else {
    current = START;
  }

  const result = [];

  for (let i = 0; i < 20; i++) {
    const rows = store.getNexts.all(chatId, current);
    if (!rows.length) break;

    const next = weightedChoice(rows, settings.temperature);
    if (!next || next === END) break;

    result.push(next);
    current = next;
  }

  return result.join(" ");
}
```

---

# 6️⃣ src/index.js

```js
import "dotenv/config";
import { Telegraf } from "telegraf";
import { createDb } from "./db.js";
import { normalizeAndTokenize, makeBigrams, generateSentence } from "./markov.js";
import { getSettings, setTemperature, setStartMode, setRandomStartProb, formatSettings, StartMode } from "./settings.js";

const bot = new Telegraf(process.env.BOT_TOKEN);
const store = createDb(process.env.DB_PATH);

bot.on("text", (ctx, next) => {
  const msg = ctx.message;
  if (!msg?.text) return next();
  if (msg.from?.is_bot) return next();
  if (msg.text.startsWith("/")) return next();

  const tokens = normalizeAndTokenize(msg.text);
  if (!tokens.length) return next();

  const pairs = makeBigrams(tokens);
  store.txInsert(ctx.chat.id, pairs);

  return next();
});

bot.command("markov_habla", (ctx) => {
  const sentence = generateSentence(store, ctx.chat.id, getSettings(ctx.chat.id));
  ctx.reply(sentence || "Hablen más 😈");
});

bot.command("set-temperature", (ctx) => {
  const val = Number(ctx.message.text.split(" ")[1]);
  if (val < 0.3 || val > 2.5) return ctx.reply("Rango: 0.3 - 2.5");
  setTemperature(ctx.chat.id, val);
  ctx.reply("OK");
});

bot.command("start-mode", (ctx) => {
  const mode = ctx.message.text.split(" ")[1];
  if (!Object.values(StartMode).includes(mode))
    return ctx.reply("start|random|mix");
  setStartMode(ctx.chat.id, mode);
  ctx.reply("OK");
});

bot.command("set-random-start-prob", (ctx) => {
  const p = Number(ctx.message.text.split(" ")[1]);
  if (p < 0 || p > 1) return ctx.reply("0..1");
  setRandomStartProb(ctx.chat.id, p);
  ctx.reply("OK");
});

bot.command("show-settings", (ctx) => {
  ctx.reply(formatSettings(ctx.chat.id));
});

bot.launch();
```

---

# 🐍 scripts/grafo.py

```python
# (igual que antes)
```

---

# ▶ EJECUCIÓN

```
npm install
pip install networkx matplotlib
npm start
```

---

# 🎯 RESULTADO

- Aprendizaje en tiempo real
- Generación Markov ponderada
- Configuración dinámica
- Grafo visualizable
- Arquitectura limpia y modular
