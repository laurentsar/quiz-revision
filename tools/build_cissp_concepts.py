#!/usr/bin/env python3
"""Dérive des concepts révisables (quiz + flashcards + Leitner) depuis la mind map CISSP.

Deux natures de concepts, toutes deux issues de l'arbre :

  • « def »       : le noeud a une vraie définition en feuille -> terme → définition,
                    exploitable par tous les types de questions du moteur.
  • « structure » : pas de définition, mais l'arbre dit à quelle section le noeud
                    appartient -> seules les questions de catégorie sont générées
                    (« À quelle catégorie appartient X ? »). C'est justement ce
                    qu'on veut mémoriser d'une mind map.

Les termes déjà présents dans secu_concepts.json sont écartés : le moteur indexe
par terme (BYTERM / SRS), un doublon écraserait l'autre.

Sortie : www/data/cissp_concepts.json
"""
import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'www/data/cissp_mindmap.json')
BASE = os.path.join(ROOT, 'www/data/secu_concepts.json')
OUT = os.path.join(ROOT, 'www/data/cissp_concepts.json')

DEF_HINT = re.compile(r'\b(is|are|refers to|means|consists of|provides|describes|defines|ensures)\b', re.I)
NUM_PREFIX = re.compile(r'^\d+[\.\)]\s*')
MAX_STRUCTURE_PER_DOMAIN = 70   # garde un pool équilibré entre domaines


def good_term(t):
    """Un terme doit être court et nommer une notion, pas une étape ni une phrase."""
    t = t.strip()
    if not (3 <= len(t) <= 60):
        return False
    if t.count(' ') > 7 or NUM_PREFIX.match(t):
        return False
    if t.endswith(('.', ':', '?')):
        return False
    return True


def good_def(t):
    if not (60 <= len(t) <= 400):
        return False
    if not DEF_HINT.search(t):
        return False
    if t.lower().startswith(('e.g', 'example', 'see ', 'such as')):
        return False
    return True


def main():
    mm = json.load(open(SRC, encoding='utf-8'))
    base = json.load(open(BASE, encoding='utf-8'))
    taken = {c['term'].strip().lower() for c in base['concepts']}

    branches = {}
    concepts = []
    struct_count = defaultdict(int)

    for di, dom in enumerate(mm['domains'], start=1):
        key = f'cissp{di}'
        # Les domaines sont regroupés sous « CISSP » dans le sélecteur : le libellé
        # ne garde que le nom du domaine (« Domain 3. » n'apporte rien).
        label = re.sub(r'^Domain\s+\d+\.\s*', '', dom['t'])
        branches[key] = label

        def walk(node, section, path):
            kids = node.get('c', [])
            leaves = [k['t'] for k in kids if not k.get('c')]
            term = node['t'].strip()
            low = term.lower()

            if good_term(term) and low not in taken and section:
                defs = [l for l in leaves if good_def(l)]
                short_leaves = [l for l in leaves if len(l) <= 60]
                trail = ' › '.join(path[-2:]) if path else section
                if defs and len(short_leaves) <= 6:
                    taken.add(low)
                    concepts.append({
                        'term': term, 'def': defs[0], 'cat': section,
                        'branch': key, 'tip': 'Mind map CISSP · %s' % trail,
                    })
                elif kids and struct_count[key] < MAX_STRUCTURE_PER_DOMAIN:
                    # pas de définition : concept « structure » (question de catégorie)
                    taken.add(low)
                    struct_count[key] += 1
                    concepts.append({
                        'term': term, 'cat': section, 'branch': key,
                        'tip': 'Mind map CISSP · %s' % trail,
                    })

            for k in kids:
                walk(k, section, path + [term])

        # les sections = enfants directs du domaine ; elles servent de catégories
        for sec in dom.get('c', []):
            for k in sec.get('c', []):
                walk(k, sec['t'].strip(), [])

    data = {'source': mm['source'], 'branches': branches, 'concepts': concepts}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    with_def = sum(1 for c in concepts if c.get('def'))
    print(f"{len(concepts)} concepts CISSP ({with_def} avec définition, "
          f"{len(concepts) - with_def} structure) -> {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT) / 1024:.0f} Ko)")
    for k, label in branches.items():
        n = sum(1 for c in concepts if c['branch'] == k)
        nd = sum(1 for c in concepts if c['branch'] == k and c.get('def'))
        cats = len({c['cat'] for c in concepts if c['branch'] == k})
        print(f"  {label[:45]:47s} {n:>3} concepts ({nd} déf.) · {cats} catégories")


if __name__ == '__main__':
    main()
