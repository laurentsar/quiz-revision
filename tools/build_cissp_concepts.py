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

# Noms officiels des domaines CISSP (ISC2, outline en vigueur au 15 avril 2024).
OFFICIAL_CISSP = {
    1: 'Security and Risk Management',
    2: 'Asset Security',
    3: 'Security Architecture and Engineering',
    4: 'Communication and Network Security',
    5: 'Identity and Access Management (IAM)',
    6: 'Security Assessment and Testing',
    7: 'Security Operations',
    8: 'Software Development Security',
}


# Mots isolés trop génériques pour être un terme de quiz (bruit de l'arbre).
JUNK_TERMS = {
    'signal', 'directories', 'level 2', 'level 3', 'administrative controls',
    'technical controls', 'physical controls', 'overview', 'introduction',
    'definition', 'definitions', 'types', 'examples', 'general', 'others',
}


def good_term(t):
    """Un terme doit nommer une notion : Titre/acronyme, ni fragment ni phrase."""
    t = t.strip()
    if not (3 <= len(t) <= 60) or t.count(' ') > 7:
        return False
    if NUM_PREFIX.match(t) or t.endswith(('.', ':', '?', ',')):
        return False
    if t.lower() in JUNK_TERMS:
        return False
    # Fragment : commence par une minuscule ou un article (« the tumbler lock »,
    # « managed security… ») -> ce n'est pas un intitulé de concept.
    first = t.split()[0].lower()
    if first in ('the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'with', 'from'):
        return False
    if t[0].islower():
        return False
    return True


def clean_def(t):
    """Retient une définition exploitable, avec ou sans verbe-indice, sinon None."""
    t = t.strip()
    if not (40 <= len(t) <= 400):
        return None
    if NUM_PREFIX.match(t) or t.lower().startswith(('e.g', 'example', 'see ', 'such as')):
        return None
    # au moins deux mots et une allure de phrase (pas un simple sigle entre parenthèses)
    if t.count(' ') < 3:
        return None
    return t


def best_def(leaves):
    """Meilleure définition parmi les feuilles DIRECTES d'un nœud.

    On exige un indice de verbe (« is/are/provides… ») : sans lui, la feuille la
    plus longue est souvent un détail voisin, pas la définition du terme — ce qui
    produisait des paires terme/définition fausses. On préfère donc la 1re feuille
    munie d'un verbe-indice (l'ordre de l'arbre = ordre de lecture)."""
    cands = [c for c in (clean_def(l) for l in leaves) if c and DEF_HINT.search(c)]
    return cands[0] if cands else None


def main():
    mm = json.load(open(SRC, encoding='utf-8'))
    base = json.load(open(BASE, encoding='utf-8'))
    taken = {c['term'].strip().lower() for c in base['concepts']}

    branches = {}
    concepts = []
    struct_count = defaultdict(int)

    for di, dom in enumerate(mm['domains'], start=1):
        key = f'cissp{di}'
        # Libellés officiels ISC2 CISSP (outline 15 avril 2024) : la source utilise
        # « Security Management Practices » (ancien nom CBK) pour le domaine 1.
        label = OFFICIAL_CISSP.get(di, re.sub(r'^Domain\s+\d+\.\s*', '', dom['t']))
        branches[key] = label

        def walk(node, section, path):
            kids = node.get('c', [])
            leaves = [k['t'] for k in kids if not k.get('c')]
            term = node['t'].strip()
            low = term.lower()

            if good_term(term) and low not in taken and section:
                # définition tirée uniquement des feuilles directes du nœud (fiable)
                dfn = best_def(leaves)
                trail = ' › '.join(path[-2:]) if path else section
                if dfn:
                    taken.add(low)
                    concepts.append({
                        'term': term, 'def': dfn, 'cat': section,
                        'branch': key, 'tip': 'Mind map CISSP · %s' % trail,
                    })
                elif kids and struct_count[key] < MAX_STRUCTURE_PER_DOMAIN:
                    # pas de définition exploitable : concept « structure » (question de catégorie)
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
