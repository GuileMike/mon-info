// ============================================================
// Mon Info — Backend d'agrégation de presse
// Node.js + TypeScript. Dépendances : express, cors, rss-parser
// (le clustering est fait maison : TF-IDF + similarité cosinus,
//  sans dépendance externe — un LLM peut être branché en option)
//
// Install : npm i express cors rss-parser
// Run     : npx ts-node server.ts
// API     : GET /api/sujets          → sujets regroupés
//           GET /api/medias          → catalogue des médias
//           POST /api/medias/:id/toggle → activer/désactiver
// ============================================================

import express from "express";
import cors from "cors";
import Parser from "rss-parser";
import { createHash } from "crypto";

// ------------------------------------------------------------
// 1. CATALOGUE DES MÉDIAS (à enrichir librement)
// ------------------------------------------------------------
interface Media {
  id: string;
  nom: string;
  biais: "gauche" | "centre-gauche" | "centre" | "centre-droite" | "droite";
  rss: string;           // URL du flux RSS
  actif: boolean;        // choix de l'utilisateur
}

const MEDIAS: Media[] = [
  { id: "lemonde", nom: "Le Monde", biais: "centre-gauche", rss: "https://www.lemonde.fr/rss/une.xml", actif: true },
  { id: "figaro", nom: "Le Figaro", biais: "centre-droite", rss: "https://www.lefigaro.fr/rss/figaro_actualites.xml", actif: true },
  { id: "libe", nom: "Libération", biais: "gauche", rss: "https://www.liberation.fr/rss/latest", actif: true },
  { id: "humanite", nom: "L'Humanité", biais: "gauche", rss: "https://www.humanite.fr/rss", actif: true },
  { id: "leparisien", nom: "Le Parisien", biais: "centre", rss: "https://www.leparisien.fr/actu/rss.xml", actif: true },
  { id: "ouestfrance", nom: "Ouest-France", biais: "centre", rss: "https://www.ouest-france.fr/rss-en-continu.xml", actif: true },
  { id: "challenges", nom: "Challenges", biais: "centre-droite", rss: "https://www.challenges.fr/rss.xml", actif: true },
  { id: "mediapart", nom: "Mediapart", biais: "gauche", rss: "https://www.mediapart.fr/articles/rss", actif: true },
  { id: "bfmtv", nom: "BFMTV", biais: "centre", rss: "https://www.bfmtv.com/rss/news-24-7/", actif: true },
  { id: "cnews", nom: "CNEWS", biais: "droite", rss: "https://www.cnews.fr/rss", actif: true },
  { id: "franceinfo", nom: "franceinfo", biais: "centre", rss: "https://www.francetvinfo.fr/titres.rss", actif: true },
  { id: "sciencesavenir", nom: "Sciences et Avenir", biais: "centre", rss: "https://www.sciencesetavenir.fr/rss.xml", actif: true },
  { id: "historia", nom: "Historia", biais: "centre", rss: "https://www.historia.fr/rss", actif: true },
  { id: "blast", nom: "Blast", biais: "gauche", rss: "https://www.blast-info.fr/rss", actif: true },
  { id: "acrimed", nom: "Acrimed", biais: "gauche", rss: "https://acrimed.org/spip.php?page=backend", actif: true },
  // → ajoutez ici vos sources : une ligne = un média
];

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
    return (flux.items || []).map(item => ({
      id: createHash("md5").update(item.link || item.title || "").digest("hex").slice(0, 12),
      mediaId: media.id,
      titre: (item.title || "").trim(),
      lien: item.link || "",
      date: item.isoDate ? new Date(item.isoDate) : new Date(),
      visuel:
        (item.enclosure as any)?.url ||                       // <enclosure url="...">
        ((item as any)["media:content"]?.$?.url as string) ||  // media:content
        (item as any)["media:thumbnail"]?.$?.url ||           // media:thumbnail
        undefined,
      resume: item.contentSnippet || item.content?.slice(0, 300),
    })).filter(a => a.lien);
  } catch (e) {
    console.warn(`⚠ Flux en échec : ${media.nom} (${media.rss})`);
    return [];
  }
}

// ------------------------------------------------------------
// 3. CLUSTERING PAR SUJET
//    a) nettoyage + tokens du titre (stopwords FR)
//    b) vecteurs de fréquences des mots
//    c) similarité cosinus ; si 2 articles > SEUIL → même sujet
//    d) regroupement glouton par parcours chronologique
// ------------------------------------------------------------
const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou",
  "en", "à", "au", "aux", "dans", "sur", "pour", "par", "avec", "sans",
  "que", "qui", "quoi", "dont", "est", "sont", "a", "ont", "ce", "cet",
  "cette", "ces", "son", "sa", "ses", "leur", "leurs", "plus", "moins",
  "se", "sa", "apres", "avant", "chez", "vers", "entre", "comme", "aprs",
  "il", "elle", "ils", "elles", "on", "nous", "vous", "the", "of", "and",
]);

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
  titre: string;             // titre du 1er article (ou titre IA en option)
  categorie: string;         // classification simple par mots-clés
  articles: Article[];
  desaccord: boolean;        // médias de biais opposés présents ?
}

function classifier(titre: string): string {
  const t = titre.toLowerCase();
  if (/ariane|fusée|spatial|nasa|cnes|science|recherche|santé|vaccin|climat/.test(t)) return "Science";
  if (/histoire|archéo|découverte|gaulois|siècle|musée|napoléon/.test(t)) return "Histoire";
  if (/retraites|loi|gouvernement|président|élection|parlement|ministre|macron/.test(t)) return "Politique";
  if (/ue|europe|bruxelles|ukraine|israël|usa|états-unis|chine|onu|otan/.test(t)) return "International";
  if (/ia|intelligence artificielle|tech|numérique|apple|google|start-up/.test(t)) return "Tech";
  if (/foot|match|champions|ligue|psg|ol|tour de france|jeux olympiques/.test(t)) return "Sport";
  if (/canicule|tempête|inondation|pauvreté|société|école|grève|manifestation/.test(t)) return "Société";
  return "Général";
}

function regrouper(articles: Article[]): Sujet[] {
  const tries = [...articles].sort((x, y) => y.date.getTime() - x.date.getTime());
  const sujets: Sujet[] = [];

  for (const art of tries) {
    const vArt = vecteur(normaliser(art.titre));
    let meilleur: { sujet: Sujet; sim: number } | null = null;

    for (const s of sujets) {
      // on compare aux titres déjà regroupés (meilleure similarité)
      const sims = s.articles.map(a => similarite(vArt, vecteur(normaliser(a.titre))));
      const sim = Math.max(...sims);
      if (sim > SEUIL_SUJET && (!meilleur || sim > meilleur.sim)) meilleur = { sujet: s, sim };
    }

    if (meilleur) {
      meilleur.sujet.articles.push(art);
    } else {
      sujets.push({
        id: createHash("md5").update(art.id).digest("hex").slice(0, 10),
        titre: art.titre,
        categorie: classifier(art.titre),
        articles: [art],
        desaccord: false,
      });
    }
  }

  // Désaccord = au moins un média gauche ET un média droite sur le même sujet
  for (const s of sujets) {
    const biais = new Set(s.articles.map(a => MEDIAS.find(m => m.id === a.mediaId)?.biais));
    s.desaccord = (biais.has("gauche") && (biais.has("droite") || biais.has("centre-droite")));
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
  cache = null;                       // invalide le cache pour recalcul
  res.json({ id: m.id, actif: m.actif });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Mon Info backend sur http://localhost:${PORT}`));

// ------------------------------------------------------------
// OPTION LLM (recommandée en production) :
// remplacer regrouper() par un appel à un modèle de langage
// qui reçoit les 50 derniers titres et renvoie des clusters +
// un titre commun par sujet, comme le fait ibou ("Les angles IA").
// Le clustering maison ci-dessus reste un bon fallback gratuit.
// ------------------------------------------------------------
