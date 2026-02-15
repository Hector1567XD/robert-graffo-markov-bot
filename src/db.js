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

  const getWordStats = db.prepare(`
    SELECT word_a AS word, SUM(frequency) AS total_freq
    FROM markov_graph
    WHERE chat_id = ? AND word_a NOT IN ('__START__', '__END__')
    GROUP BY word_a
    ORDER BY total_freq DESC
    LIMIT ?
  `);

  const getTotalBigrams = db.prepare(`
    SELECT COUNT(*) AS total
    FROM markov_graph
    WHERE chat_id = ? AND word_a NOT IN ('__START__', '__END__')
  `);

  const getTotalWords = db.prepare(`
    SELECT COUNT(DISTINCT word_a) AS total
    FROM markov_graph
    WHERE chat_id = ? AND word_a NOT IN ('__START__', '__END__')
  `);

  const getTotalFrequency = db.prepare(`
    SELECT SUM(frequency) AS total
    FROM markov_graph
    WHERE chat_id = ? AND word_a NOT IN ('__START__', '__END__')
  `);

  return { 
    db, 
    txInsert, 
    getNexts, 
    getRandomWord,
    getWordStats,
    getTotalBigrams,
    getTotalWords,
    getTotalFrequency
  };
}
