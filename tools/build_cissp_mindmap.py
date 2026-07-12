#!/usr/bin/env python3
"""Convertit la mind map CISSP (yyds-page/cissp-mind-map, GPL-3.0) en JSON d'arbre.

Source : All-Domains-Tree-View.txt — arbre à indentation de 2 espaces, les feuilles
étant préfixées par « • ». On produit tools/cissp_mindmap.json :

    {"source": ..., "domains": [{"title": ..., "children": [{"t": ..., "c": [...]}, ...]}]}

Usage : python3 tools/build_cissp_mindmap.py <chemin/All-Domains-Tree-View.txt>
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools/cissp_mindmap.json')
SOURCE = 'https://github.com/yyds-page/cissp-mind-map (GPL-3.0) — CISSP 2020, OSG/AIO 8e éd.'


def parse(lines):
    roots = []
    # pile des noeuds ouverts : (indentation, noeud)
    stack = []
    for raw in lines:
        line = raw.rstrip('\n').rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(' '))
        text = line.strip()
        # « • » = feuille dans la source, ce n'est pas un niveau de plus
        text = re.sub(r'^[•·*-]\s*', '', text)
        if not text:
            continue
        node = {'t': text}
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if stack:
            parent = stack[-1][1]
            parent.setdefault('c', []).append(node)
        else:
            roots.append(node)
        stack.append((indent, node))
    return roots


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools/All-Domains-Tree-View.txt')
    with open(src, encoding='utf-8') as f:
        roots = parse(f)

    # Le domaine 8 est un placeholder vide (« Do it yourself ») dans la source : on l'écarte.
    domains = [r for r in roots if r['t'].lower().startswith('domain') and r.get('c')]
    if not domains:
        sys.exit('Aucun domaine trouvé — format source inattendu ?')

    def count(n):
        return 1 + sum(count(c) for c in n.get('c', []))

    data = {'source': SOURCE, 'domains': domains}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    total = sum(count(d) for d in domains)
    print(f'{len(domains)} domaines, {total} noeuds -> {os.path.relpath(OUT, ROOT)} '
          f'({os.path.getsize(OUT) / 1024:.0f} Ko)')
    for d in domains:
        print(f"  - {d['t']}  ({count(d) - 1} noeuds)")


if __name__ == '__main__':
    main()
