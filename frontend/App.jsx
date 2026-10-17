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
    app: { fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto", padding: "
