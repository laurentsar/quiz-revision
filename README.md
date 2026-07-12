# Quizz Révision — Cybersécurité & Homologation

Application **Android (APK) hors ligne** pour réviser une mindmap de cybersécurité / homologation
(« Offre Thales »). Les questions sont **générées à la volée** depuis une base de **82 concepts**
(terme / définition / catégorie / mnémonique / exemple), réparties en 4 thèmes :
Architecture sécurité, Analyse de risque, Accréditation/Homologation, Indicateurs.

## Fonctions d'apprentissage
- **Quiz généré à la volée** : « Que recouvre X ? », « Quel terme correspond à… », mises en
  situation, et catégorie. Les distracteurs changent à chaque tirage → variété quasi infinie.
- **Répétition espacée (Leitner)** : les concepts ratés reviennent plus souvent ; suivi de la
  **maîtrise par concept** (X / 82) et des concepts « à revoir aujourd'hui ».
- **Mode Apprendre (flashcards)** : terme → on révèle définition + mnémonique + exemple, puis
  « Je savais / À revoir ».
- **Pièges ciblés** : les mauvaises réponses sont tirées en priorité parmi les concepts de la
  même catégorie ou les confusions classiques (PCA/PRA, IDS/IPS, KPI/KRI…).
- **Feedback enrichi** : après chaque réponse, rappel de la définition + mnémonique + exemple.
- **Fiches de révision** : toute la mindmap sous forme de fiches consultables, par catégorie.

Tout est **local** (localStorage) et **hors ligne**.

## Contenu
- `www/` : application web (HTML/CSS/JS vanilla, 0 dépendance runtime) emballée par Capacitor.
- `www/data/secu_concepts.json` : la base de concepts (éditable / extensible).
- `www/data/cissp_mindmap.json` : les 7 mind maps CISSP (arbre navigable + recherche).
- `www/data/cissp_concepts.json` : concepts CISSP dérivés de ces mind maps, révisables
  comme les autres (quiz, flashcards, Leitner, « mes erreurs »).

## Mind maps CISSP
Les mind maps proviennent de [yyds-page/cissp-mind-map](https://github.com/yyds-page/cissp-mind-map)
(GPL-3.0, CISSP 2020 / OSG-AIO 8e éd., usage non commercial), converties depuis
`All-Domains-Tree-View.txt` par :

    python3 tools/build_cissp_mindmap.py tools/All-Domains-Tree-View.txt   # arbre navigable
    python3 tools/build_cissp_concepts.py                                  # concepts révisables

Deux natures de concepts sont dérivées de l'arbre : ceux qui ont une **définition**
en feuille (toutes les questions du moteur), et les concepts de **structure**, sans
définition, dont on révise la place dans la carte (questions de catégorie).

## Build de l'APK
Le build local n'est pas possible sur la machine de dev (ARM). L'APK est produit par
**GitHub Actions** (`.github/workflows/build-apk.yml`) à chaque `git push` sur `master` :
`npm install` → `npx cap sync android` → `./gradlew assembleRelease` → release GitHub signée.

Pour enrichir le quiz : ajouter un concept dans `secu_concepts.json` (term/def/cat/tip/ex),
commit + push, l'APK se reconstruit automatiquement.

## Mind maps Ignite Technologies
11 mind maps de [Ignitetechnologies/Mindmap](https://github.com/Ignitetechnologies/Mindmap)
(NIST CSF, RGPD, HIPAA, codes HTTP, ingénierie sociale, MITRE ATT&CK, Blue Team,
technologies cyber, Sécurité 360°, menaces & attaques, DevOps) sont transcrites et
**traduites en français** en concepts révisables — les images ne sont pas embarquées.
Regénérer : `python3 tools/build_ignite_concepts.py`. Ces 11 thèmes forment le groupe
« Réf. cyber » dans le sélecteur, distinct du CISSP.

## Certifications (contenu en anglais, examens en anglais)
Chaque certification est un **groupe** dans le sélecteur de thèmes.

| Cert | Éditeur | Domaines | Référentiel officiel | Généré par |
|------|---------|----------|----------------------|------------|
| CISSP | ISC2 | 8 | outline 15 avr. 2024 | `build_cissp_concepts.py` (mind map) + `build_isc2_concepts.py` (domaine 8) |
| SSCP | ISC2 | 7 | outline 15 sept. 2024 | `build_isc2_concepts.py` |
| CCSP | ISC2 | 6 | outline officiel | `build_isc2_concepts.py` |
| CC | ISC2 | 5 | outline 29 août 2022 | `build_isc2_concepts.py` |
| CEH v13 | EC-Council | 20 modules | course outline v13 | `build_ceh_concepts.py` |

Notes de cohérence CISSP : le domaine 1 de la mind map source (« Security Management
Practices », ancien nom CBK) est renommé au nom officiel « Security and Risk
Management » ; le domaine 8 « Software Development Security », absent de la source,
est rédigé à la main.

⚠️ **À re-vérifier périodiquement** : les éditeurs mettent à jour leurs référentiels
(ex. CC : nouvel outline au 1er sept. 2026 intégrant l'IA). Comparer aux sources
officielles (isc2.org/certifications, eccouncil.org) avant chaque session d'examen.
