import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PlayerView from "./components/combat/PlayerView.jsx";
import "./index.css";

// Hors ligne : uniquement sur la version construite (npm run build), pas en développement
if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);

const isPlayerScreen = new URLSearchParams(location.search).has("joueurs");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isPlayerScreen ? <PlayerView /> : <App />}</React.StrictMode>
);
