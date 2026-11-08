// ============================================================
// Mon Info — Backend d'agrégation de presse (v3)
// Node.js + TypeScript. Dépendances : express, cors, rss-parser
//
// Nouveautés v3 :
//   1. PERSISTANCE : les toggles ON/OFF des médias sont sauvegardés
//      dans data/medias-actifs.json (survivent au redémarrage)
//   2. chargerFlux : filtrage AVANT le calcul de hash (plus propre)
//   3. Stopwords nettoyés (doublons et typos supprimés)
//   4. Regex de classification corrigées (typos, faux positifs)
//   5. Clustering optimisé : vecteurs pré-calculés (O(n) par article
//      au lieu de recalculer les titres à chaque comparaison)
//   6. Titre du sujet = article le plus représentatif du cluster
//      (le "médoïde" : celui le plus proche de tous les autres)
//
// Install : npm i express cors rss-parser
// Run     : npx ts-node backend/server.ts
// API     : GET /api/sujets          → sujets regroupés
//           GET /api/medias          → catalogue des médias
//           POST /api/medias/:id/toggle → activer/désactiver
// ============================================================

import express from "express";
import cors from "cors";
import Parser from "rss-parser";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// Chemin du fichier de persistance (<racine du projet>/data/medias-actifs.json)
// NB : on utilise process.cwd() (et non import.meta.url) car ts-node tourne
// en CommonJS sans "type": "module" dans le package.json racine.
const DATA_DIR = join(process.cwd(), "data");
const FICHIER_ETAT = join(DATA_DIR, "medias-actifs.json");

// ------------------------------------------------------------
// 1. CATALOGUE DES MÉDIAS (à enrichir librement)
// ------------------------------------------------------------
interface Media {
  id: string;
  nom: string;
  biais: "gauche" | "centre-gauche" | "centre" | "centre-droite" | "droite";
  rss: string;           // URL du flux RSS
  actif: boolean;        // choix de l'utilisateur (persisté)
}

const MEDIAS: Media[] = [
  { id: "lemonde", nom: "Le Monde", biais: "centre-gauche", rss: "https://www.lemonde.fr/rss/une.xml", actif: true },
  { id: "figaro", nom: "Le Figaro", biais: "centre-droite", rss: "https://www.lefigaro.fr/rss/figaro_actualites.xml", actif: true },
  { id: "humanite", nom: "L'Humanité", biais: "gauche", rss: "https://www.humanite.fr/rss", actif: true },
  { id: "leparisien", nom: "Le Parisien", biais: "centre", rss: "https://feeds.leparisien.fr/leparisien/rss", actif: true },
  { id: "ouestfrance", nom: "Ouest-France", biais: "centre", rss: "https://www.ouest-france.fr/rss-en-continu.xml", actif: true },
  { id: "challenges", nom: "Challenges", biais: "centre-droite", rss: "https://www.challenges.fr/rss.xml", actif: true },
  { id: "mediapart", nom: "Mediapart", biais: "gauche", rss: "https://www.mediapart.fr/articles/feed", actif: true },
  { id: "bfmtv", nom: "BFMTV", biais: "centre", rss: "https://www.bfmtv.com/rss/news-24-7/", actif: true },
  { id: "cnews", nom: "CNEWS", biais: "droite", rss: "https://www.cnews.fr/rss.xml", actif: true },
  { id: "franceinfo", nom: "franceinfo", biais: "centre", rss: "https://www.francetvinfo.fr/titres.rss", actif: true },
  { id: "sciencesavenir", nom: "Sciences et Avenir", biais: "centre", rss: "https://www.sciencesetavenir.fr/rss.xml", actif: true },
  { id: "blast", nom: "Blast", biais: "gauche", rss: "https://api.blast-info.fr/rss.xml", actif: true },
  { id: "courrierinter", nom: "Courrier International", biais: "centre-gauche", rss: "https://www.courrierinternational.com/feed/all/rss.xml", actif: true },
  { id: "lequipe", nom: "L'Équipe", biais: "centre", rss: "https://dwh.lequipe.fr/api/edito/rss?path=/", actif: true },
  // v3 : libe, historia et acrimed retirés — Libération a fermé ses flux
  // RSS publics (2023), Historia n'expose plus de flux accessible, et
  // Acrimed bloque les connexions depuis les serveurs (IP datacenter).
  // → ajoutez ici vos sources : une ligne = un média
];

// ------------------------------------------------------------
// 1bis. PERSISTANCE de l'état actif/inactif des médias
//      Format : { "lemonde": true, "figaro": false, ... }
// ------------------------------------------------------------
function chargerEtat(): void {
  try {
    if (!existsSync(FICHIER_ETAT)) return;
    const etat = JSON.parse(readFileSync(FICHIER_ETAT, "utf-8"));
    for (const m of MEDIAS) {
      if (typeof etat[m.id] === "boolean") m.actif = etat[m.id];
    }
    console.log(`💾 État des médias restauré depuis ${FICHIER_ETAT}`);
  } catch (e) {
    console.warn("⚠ Impossible de lire l'état des médias, valeurs par défaut.");
  }
}

function sauverEtat(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const etat: Record<string, boolean> = {};
    for (const m of MEDIAS) etat[m.id] = m.actif;
    writeFileSync(FICHIER_ETAT, JSON.stringify(etat, null, 2));
  } catch (e) {
    console.warn("⚠ Impossible de sauvegarder l'état des médias.");
  }
}

// ------------------------------------------------------------
// 2. ARTICLE BRUT, extrait du flux RSS
// ------------------------------------------------------------
interface Article {
  id: string;            // hash de l'URL (déduplication)
  mediaId: string;
  titre: string;
  lien: string;
  date: Date;
  visuel?: string;       // image du flux (enclosure / media:content)
  resume?: string;
}

async function chargerFlux(media: Media, parser: Parser): Promise<Article[]> {
  try {
    const flux = await parser.parseURL(media.rss);
    return (flux.items || [])
      .map(item => ({
        item,
        lien: item.link || "",
      }))
      // Filtrage AVANT le calcul du hash (v3) : on ignore les items sans lien
      .filter(({ lien }) => lien)
      .map(({ item, lien }) => ({
        id: createHash("md5").update(lien || item.title || "").digest("hex").slice(0, 12),
        mediaId: media.id,
        titre: (item.title || "").trim(),
        lien,
        date: item.isoDate ? new Date(item.isoDate) : new Date(),
        visuel:
          (item.enclosure as any)?.url ||                       // <enclosure url="...">
          ((item as any)["media:content"]?.$?.url as string) ||  // media:content
          (item as any)["media:thumbnail"]?.$?.url ||           // media:thumbnail
          undefined,
        resume: item.contentSnippet || item.content?.slice(0, 300),
      }));
  } catch (e) {
    console.warn(`⚠ Flux en échec : ${media.nom} (${media.rss})`);
    return [];
  }
}

// ------------------------------------------------------------
// 3. CLUSTERING PAR SUJET
//    a) nettoyage + tokens du titre (stopwords FR)
//    b) vecteurs de fréquences des mots (pré-calculés, v3)
//    c) similarité cosinus ; si 2 articles > SEUIL → même sujet
//    d) regroupement glouton par parcours chronologique
// ------------------------------------------------------------
const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou",
  "en", "a", "au", "aux", "dans", "sur", "pour", "par", "avec", "sans",
  "que", "qui", "quoi", "dont", "est", "sont", "ont", "ce", "cet",
  "cette", "ces", "son", "sa", "ses", "leur", "leurs", "plus", "moins",
  "se", "apres", "avant", "chez", "vers", "entre", "comme",
  "il", "elle", "ils", "elles", "on", "nous", "vous", "the", "of", "and",
]);
// v3 : doublons ("sa" ×2) et typos ("aprs", "apres" post-normalisation
// sans accent) supprimés. NB : les titres sont normalisés sans accent,
// donc "après" devient "apres" — c'est la seule forme utile.

function normaliser(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // accents → base
    .replace(/[^a-z0-9\s]/g, " ")                        // ponctuation
    .split(/\s+/)
    .filter(mot => mot.length > 2 && !STOPWORDS.has(mot));
}

function vecteur(tokens: string[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of tokens) v.set(t, (v.get(t) || 0) + 1);
  return v;
}

function similarite(a: Map<string, number>, b: Map<string, number>): number {
  let num = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [t, y] of b) {
    nb += y * y;
    const x = a.get(t);
    if (x) num += x * y;         // produit scalaire
  }
  return (na && nb) ? num / Math.sqrt(na * nb) : 0;
}

const SEUIL_SUJET = 0.30;   // à ajuster : 0.3 = regroupe plus, 0.45 = plus strict

interface Sujet {
  id: string;
  titre: string;             // titre de l'article le plus représentatif (v3)
  categorie: string;         // classification simple par mots-clés
  articles: Article[];
  desaccord: boolean;        // médias de biais opposés présents ?
}

// ------------------------------------------------------------
// CLASSIFICATION — ordre de priorité :
// Actualité (gérée au niveau sujet) > Science > Tech > Sport
// > International > Politique > Société (par défaut)
// NB (v3) : les regex s'appliquent sur un titre normalisé (minuscules,
// sans accents) — "présidentielle" se teste donc "presidentielle".
// ------------------------------------------------------------
function classifier(titre: string): string {
  const t = titre
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Science (v3 : "ihu" ne matche plus n'importe quoi, "napoleon" conservé)
  if (/spatial|fusee|ariane|nasa|cnes|astronaute|satellite|planete|\bmars\b|climat|biodiversite|vaccin|virus|cancer|genetiqu|peste|ihu\b|medecin|patient|sante|recherche|histoire|archeo|musee|napoleon/.test(t)) return "Science";
  // 2. Tech
  if (/\bia\b|intelligence artificielle|\bmusk\b|starlink|spacex|tech|numerique|iphone|apple|google|cyber|donnees|telecom|jeux video/.test(t)) return "Tech";
  // 3. Sport (v3 : \bom\b retiré, trop ambigu — "OM" reste attrapé par "ligue 1"/"championnat"/"match" dans la vraie vie)
  if (/foot|tennis|rugby|ligue 1|ligue des champions|\bpsg\b|equipe de france|championnat|match|tour de france|jeux olympiques|medaille/.test(t)) return "Sport";
  // 4. International (tout ce qui est hors France)
  if (/ukraine|russie|israel|palestin|syrie|iran|chine|japon|coree|afrique|americ|etats-unis|usa|trump|poutine|zelensky|vance|washington|kosovo|taiwan|gaza|liban|merkel|europeenne|\bue\b|bruxelles|colombie|greenland|britannique/.test(t)) return "International";
  // 5. Politique française (v3 : "castets" corrigé, "lucy carles" était une typo)
  if (/election|presidentielle|legislative|municipale|candidat|campagne|sondage|vote|urne|congres|macron|melenchon|bardella|le pen|castets|gouvernement|parlement|assemblee|senat|ministre|ministere|prefet|retraites|\bloi\b|decrete/.test(t)) return "Politique";
  // 6. Par défaut : Société (sujets généraux, people, art, cinéma…)
  return "Société";
}

function regrouper(articles: Article[]): Sujet[] {
  const tries = [...articles].sort((x, y) => y.date.getTime() - x.date.getTime());
  const sujets: Sujet[] = [];

  // v3 : les vecteurs de tokens sont pré-calculés UNE fois par article,
  // au lieu d'être recalculés à chaque comparaison de titres.
  const vecteurs = new Map<string, Map<string, number>>();
  for (const a of tries) vecteurs.set(a.id, vecteur(normaliser(a.titre)));

  // v3 : on garde aussi le vecteur représentatif de chaque sujet
  // (dernier vecteur comparé le plus similaire) pour un test rapide
  // avant la comparaison fine avec tous les titres du sujet.
  const vecteurSujet = new Map<Sujet, Map<string, number>>();

  for (const art of tries) {
    const vArt = vecteurs.get(art.id)!;
    let meilleur: { sujet: Sujet; sim: number } | null = null;

    for (const s of sujets) {
      // Test rapide : si même pas proche du vecteur du sujet, on saute
      const vSuj = vecteurSujet.get(s)!;
      const simRapide = similarite(vArt, vSuj);
      if (simRapide <= SEUIL_SUJET) continue;

      // Comparaison fine avec les titres déjà regroupés
      const sims = s.articles.map(a => similarite(vArt, vecteurs.get(a.id)!));
      const sim = Math.max(...sims, simRapide);
      if (sim > SEUIL_SUJET && (!meilleur || sim > meilleur.sim)) meilleur = { sujet: s, sim };
    }

    if (meilleur) {
      meilleur.sujet.articles.push(art);
    } else {
      const nouveau: Sujet = {
        id: createHash("md5").update(art.id).digest("hex").slice(0, 10),
        titre: art.titre,
        categorie: classifier(art.titre),
        articles: [art],
        desaccord: false,
      };
      sujets.push(nouveau);
      vecteurSujet.set(nouveau, vArt);
    }
  }

  // Désaccord = au moins un média gauche ET un média droite sur le même sujet
  for (const s of sujets) {
    const biais = new Set(s.articles.map(a => MEDIAS.find(m => m.id === a.mediaId)?.biais));
    s.desaccord = (biais.has("gauche") && (biais.has("droite") || biais.has("centre-droite")));
  }
  // Sujet "chaud" = gros titre : beaucoup de médias, ou mention direct/urgent
  for (const s of sujets) {
    const chaud =
      s.articles.length >= 4 ||
      /en direct|urgent|breaking/i.test(s.titre);
    if (chaud) s.categorie = "Actualité";
  }
  // v3 : titre du sujet = article le plus représentatif (médoïde).
  // On choisit l'article dont la somme des similarités avec tous les
  // autres articles du sujet est la plus élevée — plus robuste que
  // "le premier arrivé" pour représenter le cluster.
  for (const s of sujets) {
    if (s.articles.length < 2) continue;
    let meilleurScore = -1, meilleurTitre = s.titre;
    for (const a of s.articles) {
      const vA = vecteurs.get(a.id)!;
      let score = 0;
      for (const b of s.articles) {
        if (a.id === b.id) continue;
        score += similarite(vA, vecteurs.get(b.id)!);
      }
      if (score > meilleurScore) {
        meilleurScore = score;
        meilleurTitre = a.titre;
      }
    }
    s.titre = meilleurTitre;
  }
  // Tri : sujets les plus couverts d'abord
  return sujets.sort((a, b) => b.articles.length - a.articles.length);
}

// ------------------------------------------------------------
// 4. API SERVEUR
// ------------------------------------------------------------
const app = express();
app.use(cors());
const parser: Parser = new Parser({ timeout: 8000 });
let cache: { sujets: Sujet[]; maj: Date } | null = null;

app.get("/api/sujets", async (_req, res) => {
  // Rafraîchit si cache > 10 min (les flux ne changent pas plus vite)
  if (!cache || Date.now() - cache.maj.getTime() > 10 * 60 * 1000) {
    const actifs = MEDIAS.filter(m => m.actif);
    const lots = await Promise.all(actifs.map(m => chargerFlux(m, parser)));
    const tous = lots.flat();
    cache = { sujets: regrouper(tous), maj: new Date() };
    console.log(`${tous.length} articles → ${cache.sujets.length} sujets (${actifs.length} flux actifs)`);
  }
  res.json(cache.sujets);
});

app.get("/api/medias", (_req, res) => res.json(MEDIAS));

app.post("/api/medias/:id/toggle", (req, res) => {
  const m = MEDIAS.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ erreur: "Média inconnu" });
  m.actif = !m.actif;
  sauverEtat();                        // v3 : persistance sur disque
  cache = null;                       // invalide le cache pour recalcul
  res.json({ id: m.id, actif: m.actif });
});

// ------------------------------------------------------------
// 5. DÉMARRAGE
// ------------------------------------------------------------
chargerEtat();   // v3 : restaure l'état ON/OFF sauvegardé

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Mon Info backend sur http://localhost:${PORT}`));

// ------------------------------------------------------------
// OPTION LLM (recommandée en production) :
// remplacer regrouper() par un appel à un modèle de langage
// qui reçoit les 50 derniers titres et renvoie des clusters +
// un titre commun par sujet, comme le fait ibou ("Les angles IA").
// Le clustering maison ci-dessus reste un bon fallback gratuit.
// Le "titre médoïde" (v3) est déjà une amélioration sans LLM.
// ------------------------------------------------------------
