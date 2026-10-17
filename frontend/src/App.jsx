// ============================================================
// Mon Info — Frontend React connecté au backend Render (v2)
// Fichier : frontend/src/App.jsx
//
// Nouveautés v2 :
//   - Onglets de tri par catégorie (Tous, Politique, International...)
//   - Onglet Sources (activer/désactiver chaque média, bouton ON/OFF)
//   - Couleurs par journal (pastille colorée sur chaque article)
//
// ⬇️ REMPLACEZ la constante API par l'URL de votre service Render
// ============================================================

import React, { useState, useEffect } from "react";

const API = "https://mon-info-1.onrender.com";

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
  "Politique",
  "International",
  "Société",
  "Tech",
  "Science",
  "Histoire",
  "Sport",
  "Général",
];

export default function App() {
  const [sujets, setSujets] = useState(null);
  const [medias, setMedias] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState("Tous");
  const [vueSources, setVueSources] = useState(false);

  const charger = async () => {
    setChargement(true);
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
    }
  };

  useEffect(() => { charger(); }, []);

  const toggleMedia = async (id) => {
    await fetch(API + "/api/medias/" + id + "/toggle", {
      method: "POST",
    });
    await charger();
  };

  const mediaById = Object.fromEntries(medias.map((m) => [m.id, m]));

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
    pastille: {
      display: "inline-block",
      color: "white",
      borderRadius: 999,
      fontSize: 10,
      padding: "2px 8px",
      margin: 2,
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
        <button style={{ ...s.bouton, marginTop: 12 }} onClick={charger}>
          Réessayer
        </button>
      </div>
    );
  }

  const sujetsFiltres =
    onglet === "Tous"
      ? sujets
      : sujets.filter((x) => x.categorie === onglet);

  return (
    <div style={s.app}>
      {/* EN-TÊTE */}
      <div style={s.header}>
        <h1 style={s.titre}>🇫🇷 Mon Info</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={vueSources ? s.boutonGris : s.bouton}
            onClick={() => setVueSources(true)}
          >
            Sources
          </button>
          <button
            style={vueSources ? s.bouton : s.boutonGris}
            onClick={() => setVueSources(false)}
          >
            Fil ({sujets.length})
          </button>
        </div>
      </div>

      {/* VUE SOURCES */}
      {vueSources ? (
        <div style={{ paddingTop: 12 }}>
          <p style={{ ...s.texteGris, fontSize: 12, margin: "0 16px 8px" }}>
            Activez ou désactivez vos sources. Le fil se recalcule
            automatiquement (comptez ~1 min).
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
              <button
                style={m.actif ? s.boutonVert : s.boutonGris}
                onClick={() => toggleMedia(m.id)}
              >
                {m.actif ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ONGLETS DE TRI */}
          <div style={s.barreOnglets}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
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

            return (
              <div key={sujet.id} style={s.carte}>
                {/* Barre de couleurs des médias du sujet */}
                <div style={s.barreCouleurs}>
                  {couleurs.map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c }} />
                  ))}
                </div>

                {premier && premier.visuel ? (
                  <img src={premier.visuel} alt="" style={s.image} />
                ) : null}

                <div style={s.contenu}>
                  <div
                    style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}
                  >
                    {sujet.categorie}
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
                      const couleur =
                        COULEURS[a.mediaId] || "#334155";
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
