Mon Info 🇫🇷

Comparateur de couverture médiatique française — un agrégateur de presse qui regroupe automatiquement les articles par sujet et met en évidence les divergences de traitement entre médias.

✨ Fonctionnalités

Agrégation RSS de 15 médias français (presse nationale, TV, presse spécialisée)

Regroupement par sujet : les articles couvrant le même événement sont clusterisés automatiquement (TF-IDF + similarité cosinus, sans dépendance externe)

Classification en 7 catégories : Actualité, Politique, International, Société, Tech, Science, Sport

Badge ⚡ désaccord de couverture : un sujet traité par au moins un média de gauche ET un média de droite/centre-droite

Sources activables : chaque média peut être activé/désactivé (ON/OFF), avec persistance de l'état (data/medias-actifs.json)

Pastilles colorées par journal et fraîcheur relative du sujet ("il y a 12 min")

🏗️ Architecture

flowchart LR
    A["15 flux RSS"] --> B["Backend Express<br/>backend/server.ts"]
    B --> C["Clustering maison<br/>TF-IDF + cosinus ≥ 0.30"]
    C --> D["Sujets + catégories<br/>+ désaccord"]
    D --> E["Cache 10 min"]
    E --> F["Frontend React/Vite<br/>frontend/src/App.jsx"]
    F -->|POST toggle + persistance| B

Dossier

Rôle

backend/

Serveur Node.js + TypeScript (Express) : fetch RSS, clustering, classification, API

frontend/

Application React (Vite) : fil de sujets, onglets par catégorie, gestion des sources

🚀 Installation

Prérequis : Node.js ≥ 18

Backend

npm install
npm start        # npx ts-node backend/server.ts

Le serveur écoute sur http://localhost:3000.

Frontend

cd frontend
npm install
npm run dev      # http://localhost:5173

Pour connecter le frontend au backend local, créez frontend/.env.local :

VITE_API_URL=http://localhost:3000

Sans cette variable, le frontend pointe vers le backend de production (Render).

🔌 API

Endpoint

Méthode

Description

/api/sujets

GET

Sujets regroupés (tableau d'objets Sujet), cache 10 min

/api/medias

GET

Catalogue des médias (id, nom, biais, RSS, état actif)

/api/medias/:id/toggle

POST

Active/désactive un média, sauvegarde l'état, invalide le cache

Objet Sujet renvoyé par /api/sujets :

{
  "id": "a1b2c3d4e5",
  "titre": "Titre de l'article le plus représentatif du cluster",
  "categorie": "Politique",
  "desaccord": true,
  "articles": [
    {
      "id": "9f8e7d6c5b4a",
      "mediaId": "lemonde",
      "titre": "…",
      "lien": "https://…",
      "date": "2026-11-08T09:12:00.000Z",
      "visuel": "https://…",
      "resume": "…"
    }
  ]
}

⚙️ Paramètres ajustables (backend/server.ts)

Paramètre

Valeur

Effet

SEUIL_SUJET

0.30

Similarité minimale pour regrouper 2 articles (0.45 = plus strict, 0.25 = regroupe plus)

MEDIAS

15 entrées

Catalogue des sources : une ligne = un média (id, nom, biais, URL RSS)

STOPWORDS

~50 mots

Mots ignorés lors du clustering

classifier()

regex

Mots-clés par catégorie (ordre de priorité : Science > Tech > Sport > International > Politique > Société)

Cache /api/sujets

10 min

Durée avant re-fetch des flux RSS

🌍 Déploiement (Render)

Le backend est déployé sur Render : https://mon-info-1.onrender.com

Backend : nouveau service Web → Build npm install → Start npm start. Le déploiement se déclenche à chaque git push sur main (auto-deploy).

Frontend : service Web statique → Build cd frontend && npm install && npm run build → Publish frontend/dist.

⚠️ Note sur la persistance : le système de fichiers de Render (free tier) est éphémère. L'état ON/OFF des médias survit aux redémarrages du process mais est remis à zéro à chaque nouveau déploiement. Pour une persistance durable en production, prévoir une base de données (SQLite sur disque persistant, Turso, Supabase…).

🗺️ Feuille de route

Persistance des toggles en base de données (prod)

Tests unitaires des fonctions pures (normaliser, similarite, classifier, regrouper)

CI GitHub Actions (tsc --noEmit + lint à chaque push)

Regroupement assisté par LLM (option évoquée dans le code, le clustering maison servant de fallback)

Affichage des résumés d'articles (champ resume déjà disponible côté API)

📄 Licence

Projet personnel — libre de réutilisation pour vos propres agrégateurs.
