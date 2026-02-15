import "dotenv/config";
import { Telegraf } from "telegraf";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, unlinkSync } from "fs";
import { createDb } from "./db.js";
import { normalizeAndTokenize, makeBigrams, generateSentence } from "./markov.js";
import { getSettings, setTemperature, setStartMode, setRandomStartProb, formatSettings, StartMode } from "./settings.js";
import path from "path";

const execAsync = promisify(exec);

const bot = new Telegraf(process.env.BOT_TOKEN);
const store = createDb(process.env.DB_PATH);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

bot.on("text", (ctx, next) => {
    const msg = ctx.message;
    if (!msg?.text) return next();
    if (msg.from?.is_bot) return next();
    if (msg.text.startsWith("/")) return next();

    const tokens = normalizeAndTokenize(msg.text);
    if (!tokens.length) {
        log(`[SKIP] Chat ${ctx.chat.id}: No tokens extracted from message`);
        return next();
    }

    const pairs = makeBigrams(tokens);
    store.txInsert(ctx.chat.id, pairs);
    log(`[LEARN] Chat ${ctx.chat.id}: Learned ${pairs.length} bigrams from "${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}"`);

    return next();
});

function handleMarkovGenerate(ctx, commandName) {
    log(`[CMD] ${commandName} - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    const settings = getSettings(ctx.chat.id);
    const sentence = generateSentence(store, ctx.chat.id, settings);
    log(`[GEN] Chat ${ctx.chat.id}: Generated "${sentence || 'Hablen más 😈'}"`);
    ctx.reply(sentence || "Hablen más 😈");
}

bot.command("markov_habla", (ctx) => handleMarkovGenerate(ctx, "markov_habla"));
bot.command("markov", (ctx) => handleMarkovGenerate(ctx, "markov"));
bot.command("lamanito", (ctx) => handleMarkovGenerate(ctx, "lamanito"));
bot.command("la-manito", (ctx) => handleMarkovGenerate(ctx, "la-manito"));
bot.command("la-manito-jota", (ctx) => handleMarkovGenerate(ctx, "la-manito-jota"));
bot.command("jota", (ctx) => handleMarkovGenerate(ctx, "jota"));

bot.command("set_temperature", (ctx) => {
    const val = Number(ctx.message.text.split(" ")[1]);
    log(`[CMD] set_temperature ${val} - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    if (isNaN(val) || val < 0.3 || val > 2.5) {
        log(`[ERROR] Invalid temperature value: ${val}`);
        return ctx.reply("Rango: 0.3 - 2.5");
    }
    setTemperature(ctx.chat.id, val);
    log(`[SET] Chat ${ctx.chat.id}: Temperature set to ${val}`);
    ctx.reply("Ok big boss.");
});

bot.command("start_mode", (ctx) => {
    const mode = ctx.message.text.split(" ")[1];
    log(`[CMD] start_mode ${mode} - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    if (!Object.values(StartMode).includes(mode)) {
        log(`[ERROR] Invalid start mode: ${mode}`);
        return ctx.reply("start|random|mix");
    }
    setStartMode(ctx.chat.id, mode);
    log(`[SET] Chat ${ctx.chat.id}: Start mode set to ${mode}`);
    ctx.reply("Ok big boss.");
});

bot.command("set_random_start_prob", (ctx) => {
    const p = Number(ctx.message.text.split(" ")[1]);
    log(`[CMD] set_random_start_prob ${p} - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    if (isNaN(p) || p < 0 || p > 1) {
        log(`[ERROR] Invalid probability value: ${p}`);
        return ctx.reply("0..1");
    }
    setRandomStartProb(ctx.chat.id, p);
    log(`[SET] Chat ${ctx.chat.id}: Random start probability set to ${p}`);
    ctx.reply("Ok big boss.");
});

bot.command("show_settings", (ctx) => {
    log(`[CMD] show_settings - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    const settings = formatSettings(ctx.chat.id);
    log(`[INFO] Chat ${ctx.chat.id} settings: ${settings}`);
    ctx.reply(settings);
});

bot.command("help", (ctx) => {
    log(`[CMD] help - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    const helpText = `🤖 Comandos disponibles:

💬 Generar frases:
/markov_habla, /markov, /lamanito, /la-manito, /la-manito-jota, /jota
  Genera una frase basada en los mensajes aprendidos

📊 Estadísticas y gráficos:
/stats - Muestra estadísticas del chat (palabras, bigramas, configuración)
/grafo - Genera y envía una visualización del grafo de Markov
/palabras [número] - Genera gráfico de palabras más frecuentes (default: 20)

⚙️ Configuración:
/set_temperature <valor> - Ajusta la temperatura (0.3 - 2.5)
  • Menor = más predecible
  • Mayor = más aleatorio
/start_mode <modo> - Cambia el modo de inicio
  • start - Siempre desde el inicio
  • random - Siempre palabra aleatoria
  • mix - Mezcla entre inicio y aleatorio
/set_random_start_prob <valor> - Probabilidad de inicio aleatorio en modo mix (0-1)
/show_settings - Muestra la configuración actual

ℹ️ Ayuda:
/help - Muestra esta ayuda
/comandos - Redirige a /help`;
    ctx.reply(helpText);
});

bot.command("grafo", async (ctx) => {
    log(`[CMD] grafo - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    
    const dbPath = process.env.DB_PATH || "./data/markov.sqlite";
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const scriptPath = path.join(process.cwd(), "scripts", "grafo.py");
    const chatId = ctx.chat.id;
    const outputFile = path.join(process.cwd(), `markov_graph_chat_${chatId}.png`);

    try {
        log(`[GRAFO] Generating graph for chat ${chatId}...`);
        const { stdout, stderr } = await execAsync(
            `cd "${process.cwd()}" && ${pythonBin} "${scriptPath}" "${dbPath}" ${chatId}`
        );

        if (stderr && !stderr.includes("Graph saved")) {
            log(`[GRAFO] Python stderr: ${stderr}`);
        }

        if (stdout) {
            log(`[GRAFO] ${stdout.trim()}`);
        }

        if (existsSync(outputFile)) {
            log(`[GRAFO] Sending graph image to chat ${chatId}`);
            await ctx.replyWithPhoto(
                { source: outputFile },
                { caption: `Grafo de Markov - Chat ${chatId}` }
            );
            unlinkSync(outputFile);
            log(`[GRAFO] Graph image sent and cleaned up`);
        } else {
            log(`[GRAFO] No graph file generated, checking if there's data...`);
            const rows = store.getNexts.all(chatId, "__START__");
            if (rows.length === 0) {
                ctx.reply("No hay datos suficientes para generar el grafo. Hablen más primero 😈");
            } else {
                ctx.reply("Error al generar el grafo. Verifica que networkx y matplotlib estén instalados.");
            }
        }
    } catch (error) {
        log(`[ERROR] Error generating graph: ${error.message}`);
        ctx.reply("Error al generar el grafo. Verifica los logs.");
    }
});

bot.command("stats", (ctx) => {
    log(`[CMD] stats - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    
    const chatId = ctx.chat.id;
    const totalBigrams = store.getTotalBigrams.get(chatId)?.total || 0;
    const totalWords = store.getTotalWords.get(chatId)?.total || 0;
    const totalFreq = store.getTotalFrequency.get(chatId)?.total || 0;
    const topWords = store.getWordStats.all(chatId, 10);
    const settings = getSettings(chatId);

    let statsText = `📊 Estadísticas del Chat ${chatId}\n\n`;
    statsText += `📝 Palabras únicas: ${totalWords}\n`;
    statsText += `🔗 Bigramas únicos: ${totalBigrams}\n`;
    statsText += `📈 Frecuencia total: ${totalFreq}\n\n`;
    
    statsText += `⚙️ Configuración:\n`;
    statsText += `  • Temperature: ${settings.temperature}\n`;
    statsText += `  • Start Mode: ${settings.startMode}\n`;
    statsText += `  • Random Start Prob: ${settings.randomStartProb}\n\n`;

    if (topWords.length > 0) {
        statsText += `🔝 Top ${Math.min(10, topWords.length)} palabras:\n`;
        topWords.forEach((row, idx) => {
            statsText += `  ${idx + 1}. ${row.word}: ${row.total_freq}\n`;
        });
    } else {
        statsText += `💬 No hay datos suficientes todavía. Hablen más! 😈`;
    }

    log(`[STATS] Chat ${chatId}: ${totalWords} words, ${totalBigrams} bigrams, ${totalFreq} total freq`);
    ctx.reply(statsText);
});

bot.command("palabras", async (ctx) => {
    log(`[CMD] palabras - Chat ${ctx.chat.id} - User ${ctx.from.username || ctx.from.id}`);
    
    const dbPath = process.env.DB_PATH || "./data/markov.sqlite";
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const scriptPath = path.join(process.cwd(), "scripts", "palabras_frecuentes.py");
    const chatId = ctx.chat.id;
    const topN = ctx.message.text.split(" ")[1] || "20";
    const outputFile = path.join(process.cwd(), `palabras_frecuentes_chat_${chatId}.png`);

    try {
        log(`[PALABRAS] Generating word frequency chart for chat ${chatId} (top ${topN})...`);
        const { stdout, stderr } = await execAsync(
            `cd "${process.cwd()}" && ${pythonBin} "${scriptPath}" "${dbPath}" ${chatId} ${topN}`
        );

        if (stderr && !stderr.includes("Graph saved")) {
            log(`[PALABRAS] Python stderr: ${stderr}`);
        }

        if (stdout) {
            log(`[PALABRAS] ${stdout.trim()}`);
        }

        if (existsSync(outputFile)) {
            log(`[PALABRAS] Sending chart image to chat ${chatId}`);
            await ctx.replyWithPhoto(
                { source: outputFile },
                { caption: `Top ${topN} Palabras Más Frecuentes - Chat ${chatId}` }
            );
            unlinkSync(outputFile);
            log(`[PALABRAS] Chart image sent and cleaned up`);
        } else {
            log(`[PALABRAS] No chart file generated, checking if there's data...`);
            const rows = store.getNexts.all(chatId, "__START__");
            if (rows.length === 0) {
                ctx.reply("No hay datos suficientes para generar el gráfico. Hablen más primero 😈");
            } else {
                ctx.reply("Error al generar el gráfico. Verifica que matplotlib esté instalado.");
            }
        }
    } catch (error) {
        log(`[ERROR] Error generating word frequency chart: ${error.message}`);
        ctx.reply("Error al generar el gráfico. Verifica los logs.");
    }
});

bot.command("comandos", (ctx) => {
    bot.telegram.sendMessage(ctx.chat.id, "Usa /help para ver los comandos disponibles");
});

bot.catch((err, ctx) => {
    log(`[ERROR] Chat ${ctx.chat.id}: ${err.message}`);
    console.error(err);
});

bot.launch().then(() => {
    log("✅ Bot iniciado correctamente");
}).catch((err) => {
    log(`❌ Error al iniciar el bot: ${err.message}`);
    console.error(err);
    process.exit(1);
});
