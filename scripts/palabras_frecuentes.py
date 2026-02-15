#!/usr/bin/env python3

import sqlite3
import sys
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

def main():
    if len(sys.argv) < 3:
        print("Usage: python palabras_frecuentes.py <db_path> <chat_id>")
        sys.exit(1)

    db_path = sys.argv[1]
    chat_id = int(sys.argv[2])
    top_n = int(sys.argv[3]) if len(sys.argv) > 3 else 20

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT word_a AS word, SUM(frequency) AS total_freq
        FROM markov_graph
        WHERE chat_id = ? AND word_a NOT IN ('__START__', '__END__')
        GROUP BY word_a
        ORDER BY total_freq DESC
        LIMIT ?
    """, (chat_id, top_n))

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print(f"No data found for chat_id {chat_id}")
        sys.exit(0)

    words = [row[0] for row in rows]
    frequencies = [row[1] for row in rows]

    plt.figure(figsize=(14, 8))
    colors = plt.cm.viridis([i / len(words) for i in range(len(words))])
    bars = plt.barh(range(len(words)), frequencies, color=colors)
    
    plt.yticks(range(len(words)), words)
    plt.xlabel('Frecuencia', fontsize=12, fontweight='bold')
    plt.ylabel('Palabras', fontsize=12, fontweight='bold')
    plt.title(f'Top {len(words)} Palabras Más Frecuentes - Chat {chat_id}', 
              fontsize=14, fontweight='bold', pad=20)
    plt.gca().invert_yaxis()
    
    for i, (word, freq) in enumerate(zip(words, frequencies)):
        plt.text(freq + max(frequencies) * 0.01, i, str(freq), 
                va='center', fontweight='bold', fontsize=9)

    plt.grid(axis='x', alpha=0.3, linestyle='--')
    plt.tight_layout()

    output_file = f"palabras_frecuentes_chat_{chat_id}.png"
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Graph saved to {output_file}")

if __name__ == "__main__":
    main()
