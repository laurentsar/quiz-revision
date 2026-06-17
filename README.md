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

## Build de l'APK
Le build local n'est pas possible sur la machine de dev (ARM). L'APK est produit par
**GitHub Actions** (`.github/workflows/build-apk.yml`) à chaque `git push` sur `master` :
`npm install` → `npx cap sync android` → `./gradlew assembleRelease` → release GitHub signée.

Pour enrichir le quiz : ajouter un concept dans `secu_concepts.json` (term/def/cat/tip/ex),
commit + push, l'APK se reconstruit automatiquement.
