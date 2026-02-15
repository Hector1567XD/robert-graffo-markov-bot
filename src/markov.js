export const START = "__START__";
export const END = "__END__";

export function normalizeAndTokenize(text) {
    let t = text.toLowerCase();

    t = t.replace(/\bhttps?:\/\/\S+\b/gi, " ");
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
