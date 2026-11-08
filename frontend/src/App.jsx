// ============================================================
// Mon Info — Frontend React connecté au backend (v3)
// Fichier : frontend/src/App.jsx
//
// Nouveautés v3 :
//   1. URL d'API configurable : variable d'environnement VITE_API_URL
//      (fallback vers Render) — plus besoin d'éditer le code
//   2. Compteur "Fil" = sujets de l'onglet actif (et non le total)
//   3. Dates affichées : fraîcheur relative du sujet ("il y a 12 min")
//   4. Toggles Sources optimistes : mise à jour instantanée, recalcul
//      en arrière-plan sans bloquer l'interface
//   5. Bouton "Rafraîchir" dans l'en-tête
//   6. mediaById mémoïsé (useMemo)
//   7. Images : fallback coloré par journal si visuel absent/cassé
//   8. Accessibilité : role="tablist"/"tab", aria-selected,
//      aria-pressed sur les toggles, aria-label sur le rafraîchissement
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from "react";

// ⬇️ En local : créez un fichier frontend/.env.local avec la ligne
//      VITE_API_URL=http://localhost:3000
// Sans variable d'environnement, on retombe sur le backend Render.
const API = import.meta.env.VITE_API_URL || "https://mon-info-1.onrender.com";

// Couleurs des journaux (id → couleur). Ajoutez vos médias ici.
const COULEURS = {
  lemonde: "#4338ca",
  figaro: "#b45309",
  libe: "#be123c",
  humanite: "#dc2626",
  leparisien: "#0f766e",
  ouestfrance: "#0e7490",
  challenges: "#7c3aed",
  mediapart: "#db2777",
  bfmtv: "#1d4ed8",
  cnews: "#334155",
  franceinfo: "#ca8a04",
  sciencesavenir: "#059669",
  historia: "#9a3412",
  blast: "#dc2626",
  acrimed: "#b45309",
};

// Ordre d'affichage des onglets de tri
const CATEGORIES = [
  "Tous",
  "Actualité",
  "Politique",
  "International",
  "Société",
  "Tech",
  "Science",
  "Sport",
];

// ------------------------------------------------------------
// Fraîcheur relative : "à l'instant", "il y a 12 min", "il y a 3 h"…
// ------------------------------------------------------------
function fraicheur(dateIso) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

export default function App() {
  const [sujets, setSujets] = useState(null);
  const [medias, setMedias] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [majEnCours, setMajEnCours] = useState(false); // rafraîchissement silencieux
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState("Tous");
  const [vueSources, setVueSources] = useState(false);

  // v3 : charger() accepte un mode "silencieux" qui ne bloque pas l'UI
  const charger = useCallback(async (silencieux = false) => {
    if (silencieux) {
      setMajEnCours(true);
    } else {
      setChargement(true);
    }
    setErreur(null);
    try {
      const [rS, rM] = await Promise.all([
        fetch(API + "/api/sujets"),
        fetch(API + "/api/medias"),
      ]);
      if (!rS.ok) throw new Error("Backend injoignable (" + rS.status + ")");
      setSujets(await rS.json());
      setMedias(await rM.json());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
      setMajEnCours(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // v3 : bascule optimiste — l'UI réagit instantanément, le recalcul
  // du fil se fait ensuite en arrière-plan (silencieux)
  const toggleMedia = async (id) => {
    setMedias((ms) =>
      ms.map((m) => (m.id === id ? { ...m, actif: !m.actif } : m))
    );
    try {
      await fetch(API + "/api/medias/" + id + "/toggle", { method: "POST" });
    } catch {
      // En cas d'échec, on resynchronise avec le serveur
      charger(true);
      return;
    }
    charger(true);
  };

  // v3 : mémoïsé — recalculé seulement quand medias change
  const mediaById = useMemo(
    () => Object.fromEntries(medias.map((m) => [m.id, m])),
    [medias]
  );

  // v3 : sujets filtrés calculés tôt pour alimenter le compteur du Fil
  const sujetsFiltres = useMemo(() => {
    if (!sujets) return [];
    return onglet === "Tous" ? sujets : sujets.filter((x) => x.categorie === onglet);
  }, [sujets, onglet]);

  // v3 : état d'image par sujet pour le fallback (image cassée/absente)
  const [imagesKO, setImagesKO] = useState({});
  const marquerImageKO = (id) =>
    setImagesKO((etat) => (etat[id] ? etat : { ...etat, [id]: true }));

  const s = {
    app: {
      fontFamily: "system-ui, sans-serif",
      maxWidth: 640,
      margin: "0 auto",
      padding: "0 0 40px",
      background: "#f8fafc",
      minHeight: "100vh",
    },
    header: {
      position: "sticky",
      top: 0,
      background: "white",
      borderBottom: "1px solid #e2e8f0",
      padding: "12px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 10,
    },
    titre: { fontSize: 18, fontWeight: 800, margin: 0 },
    bouton: {
      background: "#0f172a",
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
    },
    boutonVert: {
      background: "#16a34a",
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
    },
    boutonGris: {
      background: "#94a3b8",
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
    },
    boutonRafraichir: {
      background: "white",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 13,
      cursor: "pointer",
    },
    barreOnglets: {
      position: "sticky",
      top: 52,
      background: "white",
      display: "flex",
      gap: 6,
      overflowX: "auto",
      padding: "8px 12px",
      borderBottom: "1px solid #e2e8f0",
      zIndex: 9,
    },
    onglet: {
      border: "1px solid #cbd5e1",
      background: "white",
      borderRadius: 999,
      padding: "4px 12px",
      fontSize: 12,
      whiteSpace: "nowrap",
      cursor: "pointer",
      color: "#334155",
    },
    ongletActif: {
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "white",
      borderRadius: 999,
      padding: "4px 12px",
      fontSize: 12,
      whiteSpace: "nowrap",
      cursor: "pointer",
    },
    carte: {
      background: "white",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,.1)",
      margin: "12px 16px",
    },
    image: {
      width: "100%",
      height: 160,
      objectFit: "cover",
      display: "block",
      background: "#e2e8f0",
    },
    // v3 : bloc coloré de remplacement quand pas d'image (ou image cassée)
    imageFallback: {
      width: "100%",
      height: 160,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 28,
    },
    contenu: { padding: 14 },
    badgeDesaccord: {
      display: "inline-block",
      background: "#fef3c7",
      color: "#92400e",
      borderRadius: 999,
      fontSize: 11,
      padding: "2px 8px",
    },
    barreCouleurs: {
      display: "flex",
      height: 6,
    },
    ligneArticle: {
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      padding: "6px 0",
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      flexShrink: 0,
      marginTop: 5,
    },
    sourceLigne: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "white",
      borderRadius: 12,
      padding: 14,
      margin: "0 16px 8px",
      boxShadow: "0 1px 2px rgba(0,0,0,.06)",
    },
    texteGris: { color: "#94a3b8" },
    // v3 : petit indicateur "mise à jour…" pendant le recalcul silencieux
    bandeauMaj: {
      textAlign: "center",
      fontSize: 11,
      color: "#64748b",
      padding: "6px 0",
      background: "#f1f5f9",
    },
  };

  if (chargement) {
    return (
      <div style={{ ...s.app, textAlign: "center", paddingTop: 80, color: "#64748b" }}>
        Chargement des actualités…
      </div>
    );
  }

  if (erreur) {
    return (
      <div style={{ ...s.app, textAlign: "center", paddingTop: 80 }}>
        <p style={{ color: "#dc2626", fontWeight: 600 }}>
          Impossible de joindre le backend
        </p>
        <p style={{ color: "#64748b", fontSize: 14 }}>{erreur}</p>
        <button style={{ ...s.bouton, marginTop: 12 }} onClick={() => charger()}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={s.app}>
      {/* EN-TÊTE */}
      <div style={s.header}>
        <h1 style={s.titre}>🇫🇷 Mon Info</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* v3 : bouton Rafraîchir, accessible */}
          <button
            style={s.boutonRafraichir}
            onClick={() => charger(true)}
            aria-label="Rafraîchir le fil"
            title="Rafraîchir"
          >
            {majEnCours ? "⏳" : "⟳"}
          </button>
          <button
            style={vueSources ? s.boutonGris : s.bouton}
            onClick={() => setVueSources(true)}
            aria-pressed={vueSources}
          >
            Sources
          </button>
          <button
            style={vueSources ? s.bouton : s.boutonGris}
            onClick={() => setVueSources(false)}
            aria-pressed={!vueSources}
          >
            {/* v3 : compteur = sujets de l'onglet actif */}
            Fil ({sujetsFiltres.length})
          </button>
        </div>
      </div>

      {/* v3 : bandeau discret pendant un recalcul en arrière-plan */}
      {majEnCours ? <div style={s.bandeauMaj}>Mise à jour du fil…</div> : null}

      {/* VUE SOURCES */}
      {vueSources ? (
        <div style={{ paddingTop: 12 }}>
          <p style={{ ...s.texteGris, fontSize: 12, margin: "0 16px 8px" }}>
            Activez ou désactivez vos sources. Le fil se met à jour en
            arrière-plan dès que le backend a recalculé.
          </p>
          {medias.map((m) => (
            <div
              key={m.id}
              style={{ ...s.sourceLigne, opacity: m.actif ? 1 : 0.5 }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    ...s.dot,
                    background: COULEURS[m.id] || "#334155",
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {m.nom}{" "}
                    <span style={{ ...s.texteGris, fontSize: 10 }}>
                      ({m.biais})
                    </span>
                  </div>
                  <div style={{ ...s.texteGris, fontSize: 10 }}>
                    {m.actif ? "● active" : "○ désactivée"}
                  </div>
                </div>
              </div>
              {/* v3 : aria-pressed pour les lecteurs d'écran */}
              <button
                style={m.actif ? s.boutonVert : s.boutonGris}
                onClick={() => toggleMedia(m.id)}
                aria-pressed={m.actif}
                aria-label={`${m.actif ? "Désactiver" : "Activer"} ${m.nom}`}
              >
                {m.actif ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ONGLETS DE TRI — v3 : sémantique role="tablist"/"tab" */}
          <div style={s.barreOnglets} role="tablist" aria-label="Catégories">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={onglet === c}
                style={onglet === c ? s.ongletActif : s.onglet}
                onClick={() => setOnglet(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* FIL */}
          {sujetsFiltres.map((sujet) => {
            const premier = sujet.articles[0];
            const couleurs = sujet.articles
              .map((a) => COULEURS[a.mediaId] || "#334155")
              .filter((v, i, arr) => arr.indexOf(v) === i);

            // v3 : fraîcheur = date de l'article le plus récent du sujet
            const datePlusRecente = sujet.articles.reduce(
              (max, a) => (new Date(a.date) > max ? new Date(a.date) : max),
              new Date(0)
            );
            const fraiche = fraicheur(datePlusRecente.toISOString());

            const afficherImage =
              premier && premier.visuel && !imagesKO[sujet.id];
            // v3 : couleur de fallback = couleur du 1er média du sujet
            const couleurFallback =
              COULEURS[premier?.mediaId] || "#334155";

            return (
              <div key={sujet.id} style={s.carte}>
                {/* Barre de couleurs des médias du sujet */}
                <div style={s.barreCouleurs}>
                  {couleurs.map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c }} />
                  ))}
                </div>

                {/* v3 : image avec fallback coloré si absente ou cassée */}
                {afficherImage ? (
                  <img
                    src={premier.visuel}
                    alt=""
                    style={s.image}
                    onError={() => marquerImageKO(sujet.id)}
                  />
                ) : (
                  <div
                    style={{
                      ...s.imageFallback,
                      background: couleurFallback + "22", // version pastel
                    }}
                  >
                    <span style={{ opacity: 0.5 }}>🗞️</span>
                  </div>
                )}

                <div style={s.contenu}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{sujet.categorie}</span>
                    {/* v3 : fraîcheur du sujet */}
                    <span title={datePlusRecente.toLocaleString("fr-FR")}>
                      {fraiche}
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      margin: "0 0 8px",
                      lineHeight: 1.35,
                    }}
                  >
                    {sujet.titre}
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#334155",
                      background: "#f1f5f9",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {sujet.articles.length} média
                    {sujet.articles.length > 1 ? "s" : ""}
                  </span>{" "}
                  {sujet.desaccord ? (
                    <span style={s.badgeDesaccord}>
                      ⚡ désaccord de couverture
                    </span>
                  ) : null}

                  {/* Liste des articles, avec pastille colorée du journal */}
                  <div style={{ marginTop: 12 }}>
                    {sujet.articles.map((a) => {
                      const m = mediaById[a.mediaId];
                      const couleur = COULEURS[a.mediaId] || "#334155";
                      return (
                        <div key={a.id} style={s.ligneArticle}>
                          <span style={{ ...s.dot, background: couleur }} />
                          <div>
                            <a
                              href={a.lien}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#1d4ed8",
                                fontSize: 13,
                                textDecoration: "none",
                              }}
                            >
                              {m ? m.nom : a.mediaId} — {a.titre}
                            </a>
                            {m ? (
                              <span
                                style={{
                                  ...s.texteGris,
                                  fontSize: 10,
                                  marginLeft: 6,
                                }}
                              >
                                ({m.biais})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {sujetsFiltres.length === 0 ? (
            <p
              style={{ ...s.texteGris, textAlign: "center", marginTop: 40 }}
            >
              Aucun sujet en {onglet} pour le moment.
            </p>
          ) : null}
        </>
      )}

      <p
        style={{
          ...s.texteGris,
          textAlign: "center",
          fontSize: 11,
          marginTop: 24,
        }}
      >
        Mon Info — comparateur de couverture médiatique
      </p>
    </div>
  );
}
