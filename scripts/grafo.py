#!/usr/bin/env python3

import sqlite3
import sys
import networkx as nx
import matplotlib.pyplot as plt
import numpy as np

def main():
    if len(sys.argv) < 3:
        print("Usage: python grafo.py <db_path> <chat_id>")
        sys.exit(1)

    db_path = sys.argv[1]
    chat_id = int(sys.argv[2])

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT word_a, word_b, frequency
        FROM markov_graph
        WHERE chat_id = ?
    """, (chat_id,))

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print(f"No data found for chat_id {chat_id}")
        sys.exit(0)

    G = nx.DiGraph()

    for word_a, word_b, freq in rows:
        if word_a == "__START__" or word_b == "__END__":
            continue
        G.add_edge(word_a, word_b, weight=freq)

    if len(G.nodes()) == 0:
        print("No valid nodes to visualize")
        sys.exit(0)

    node_weights = {}
    for node in G.nodes():
        in_weight = sum(G[u][node]['weight'] for u in G.predecessors(node))
        out_weight = sum(G[node][v]['weight'] for v in G.successors(node))
        node_weights[node] = in_weight + out_weight

    max_node_weight = max(node_weights.values()) if node_weights else 1
    min_node_weight = min(node_weights.values()) if node_weights else 1

    plt.figure(figsize=(16, 12))
    pos = nx.spring_layout(G, k=0.5, iterations=50)

    edges = G.edges()
    edge_weights = [G[u][v]['weight'] for u, v in edges]
    max_edge_weight = max(edge_weights) if edge_weights else 1

    node_sizes = []
    node_colors = []
    for node in G.nodes():
        weight = node_weights[node]
        size = 300 + (weight / max_node_weight) * 1200
        node_sizes.append(size)
        normalized_weight = (weight - min_node_weight) / (max_node_weight - min_node_weight) if max_node_weight > min_node_weight else 0.5
        node_colors.append(normalized_weight)

    cmap = plt.cm.viridis
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, 
                          cmap=cmap, alpha=0.9, vmin=0, vmax=1)
    nx.draw_networkx_labels(G, pos, font_size=9, font_weight='bold')

    for (u, v), weight in zip(edges, edge_weights):
        width = 1 + (weight / max_edge_weight) * 4
        alpha = 0.3 + (weight / max_edge_weight) * 0.6
        nx.draw_networkx_edges(G, pos, [(u, v)], width=width, alpha=alpha, 
                               edge_color='gray', arrows=True, arrowsize=15)

    sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(vmin=min_node_weight, vmax=max_node_weight))
    sm.set_array([])
    cbar = plt.colorbar(sm, ax=plt.gca(), shrink=0.8)
    cbar.set_label('Peso del Nodo (Frecuencia Total)', rotation=270, labelpad=20, fontsize=10)

    plt.title(f"Markov Chain Graph - Chat {chat_id}", fontsize=16, fontweight='bold')
    plt.axis('off')
    plt.tight_layout()

    output_file = f"markov_graph_chat_{chat_id}.png"
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Graph saved to {output_file}")

if __name__ == "__main__":
    main()
