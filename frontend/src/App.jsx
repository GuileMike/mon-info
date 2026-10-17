// ============================================================
// Mon Info — Frontend React connecté au backend Render
// Fichier : src/App.jsx (projet Vite/React)
//
// Différence avec le prototype : les données viennent du backend
// https://mon-info-backend.onrender.com (via fetch), plus de démo.
//
// Install local :
//   npm create vite@latest mon-info-frontend -- --template react
//   cd mon-info-frontend && npm install
//   → remplacer src/App.jsx par ce fichier
//   npm run dev      (test local : http://localhost:5173)
//   npm run build    (génère dist/ pour Netlify)
// ============================================================

import React, { useState, useEffect } from "react";

// ⬇️ REMPLACEZ par l'URL de votre service Render
const API = "https://mon-info-1.onrender.com";

export default function App() {
  const [sujets, setSujets] = useState(null);
  const [medias, setMedias] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  // Chargement initial : sujets + catalogue médias
  useEffect(() => {
    (async () => {
      try {
        const [rSujets, rMedias] = await Promise.all([
          fetch(`${API}/api/sujets`),
          fetch(`${API}/api/medias`),
        ]);
        if (!rSujets.ok) throw new Error(`Backend injoignable (${rSujets.status})`);
        setSujets(await rSujets.json());
        setMedias(await rMedias.json());
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  const toggleMedia = async (id) => {
    await fetch(`${API}/api/medias/${id}/toggle`, { method: "POST" });
    const [rSujets, rMedias] = await Promise.all([
      fetch(`${API}/api/sujets`),
      fetch(`${API}/api/medias`),
    ]);
    setSujets(await rSujets.json());
    setMedias(await rMedias.json());
  };

  const mediaById = Object.fromEntries(medias.map(m => [m.id, m]));

  // Styles inline minimalistes (pas de Tailwind ici → déploiement simple)
  const s = {
    app: { fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto", padding: "0 16px 40px", background: "#f8fafc", minHeight: "100vh" },
    header: { position: "sticky", top: 0, background: "white", borderBottom: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 },
    titre: { fontSize: 18, fontWeight: 800, margin: 0 },
    carte: { background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.1)", marginBottom: 12, cursor: "pointer" },
    image: { width: "100%", height: 160, objectFit: "cover", display: "block", background: "#e2e8f0" },
    credit: { position: "absolute" },
    contenu: { padding: 14 },
    badgeDesaccord: { display: "inline-block", background: "#fef3c7", color: "#92400e", borderRadius: 999, fontSize: 11, padding: "2px 8px" },
    pastille: { display: "inline-block", color: "white", borderRadius: 999, fontSize: 10, padding: "2px 8px", margin: 2 },
    article: { background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.1)", marginBottom: 12 },
    barreBiais: { height: 4 },
    sourceLigne: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", borderRadius: 12, padding: 14, marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,.06)" },
    bouton: { background: "#0f172a", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },
  };

  if (chargement) return <div style={{ ...s.app, textAlign: "center", paddingTop: 80, color: "#64748b" }}>Chargement des actualités…</div>;

  if (erreur) return (
    <div style={{ ...s.app, textAlign: "center", paddingTop: 80 }}>
      <p style={{ color: "#dc2626", fontWeight: 600 }}>Impossible de joindre le backend</p>
      <p style={{ color: "#64748b", fontSize: 14 }}>{erreur}</p>
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12 }}>Vérifiez que le service Render est démarré et que l'URL `API` en haut de App.jsx est correcte.</p>
    </div>
  );

  return (
    <div style={s.app}>
      <div style={s.header}>
        <h1 style={s.titre}>🇫🇷 Mon Info</h1>
        <button style={s.bouton} onClick={() => window.scrollTo(0, 0)}>
          {sujets ? `${sujets.length} sujets` : "…"}
        </button>
      </div>

      {/* FIL : un sujet = une carte */}
      {sujets && sujets.map(sujet => {
        const premier = sujet.articles[0];
        const premierMedia = mediaById[premier?.mediaId];
        return (
          <div key={sujet.id} style={{ ...s.carte, marginTop: 12 }}>
            {premier?.visuel && (
              <div style={{ position: "relative" }}>
                <img src={premier.visuel} alt="" style={s.image} />
                <span style={{ position: "absolute", bottom: 6, right: 8, background: "rgba(0,0,0,.5)", color: "white", fontSize: 9, padding: "2px 6px", borderRadius: 4 }}>
                  📷 {premierMedia ? premierMedia.nom : "visuel du flux"}
                </span>
              </div>
            )}
            <div style={s.contenu}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{sujet.categorie}</div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{sujet.titre}</h2>
              <span style={{ fontSize: 11, color: "#334155", background: "#f1f5f9", borderRadius: 999, padding: "2px 8px" }}>
                {sujet.articles.length} média{sujet.articles.length > 1 ? "s" : ""}
              </span>{" "}
              {sujet.desaccord && <span style={s.badgeDesaccord}>⚡ désaccord de couverture</span>}
              <div style={{ marginTop: 10 }}>
                {sujet.articles.map(a => {
                  const m = mediaById[a.mediaId];
                  return (
                    <span key={a.id} style={{ ...s.pastille, background: "#334155" }}>
                      {m ? m.nom : a.mediaId}
                    </span>
                  );
                })}
              </div>
              <div style={{ marginTop: 12 }}>
                {sujet.articles.map(a => {
                  const m = mediaById[a.mediaId];
                  return (
                    <div key={a.id} style={{ marginBottom: 10 }}>
                      <a href={a.lien} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 13, textDecoration: "none" }}>
                        <strong>{m ? m.nom : a.mediaId}</strong> — {a.titre}
                      </a>
                      {m && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>({m.biais})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* SOURCES */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "24px 0 8px" }}>Mes sources</h2>
      {medias.map(m => (
        <div key={m.id} style={{ ...s.sourceLigne, opacity: m.actif ? 1 : 0.5 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nom} <span style={{ fontSize: 10, color: "#94a3b8" }}>({m.biais})</span></div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{m.actif ? "● active" : "○ désactivée"}</div>
          </div>
          <button style={{ ...s.bouton, background: m.actif ? "#16a34a" : "#94a3b8" }} onClick={() => toggleMedia(m.id)}>
            {m.actif ? "ON" : "OFF"}
          </button>
        </div>
      ))}

      <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, marginTop: 24 }}>
        Mon Info — comparateur de couverture médiatique
      </p>
    </div>
  );
}
