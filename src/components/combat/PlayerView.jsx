import { useState, useEffect } from "react";
import { PLAYER_CHANNEL, isShared } from "../../utils/helpers.js";
import Portrait from "../ui/Portrait.jsx";
import Board from "./Board.jsx";
import { HandoutStage } from "../ui/Projection.jsx";

/**
 * Écran joueurs (?joueurs) : affiche en lecture seule le combat ouvert par le MJ
 * dans l'autre fenêtre (sans pions cachés, zones sous le brouillard ni PV des monstres),
 * l'ordre d'initiative et les documents que le MJ choisit de montrer (pivotés et annotés en direct).
 */
export default function PlayerView() {
  const [s, setS] = useState({});

  useEffect(() => {
    document.title = "Écran joueurs · Table du Maître";
    const ch = new BroadcastChannel(PLAYER_CHANNEL);
    ch.onmessage = (ev) => ev.data !== "hello" && setS((p) => ({ ...p, ...ev.data }));
    ch.postMessage("hello"); // demande l'état courant au MJ
    return () => ch.close();
  }, []);

  const ratio = s.mapRatio || 0.625;

  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg)" }}>
      {!s.pieces ? (
        <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: "var(--muted)", fontFamily: "var(--display)" }}>
          En attente du maître du jeu…
        </div>
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="py-1 text-sm" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            {s.name}
            {s.started && <span style={{ color: "var(--gold)" }}> · Round {s.round}</span>}
          </div>
          <div className="flex items-start gap-3 justify-center w-full">
            <div style={{ width: `min(calc(100vw - ${s.started ? 13 : 0}rem), ${92 / ratio}vh)` }}>
              <Board combat={s} pieces={s.pieces} activeId={s.activeId} showHp={isShared} fogOpacity={1} />
            </div>
            {/* Ordre d'initiative visible par les joueurs */}
            {s.started && s.pieces.length > 0 && (
              <ol className="w-48 shrink-0 space-y-1 rounded-xl p-2" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }} aria-label="Ordre d'initiative">
                {s.pieces.map(({ t, f }) => {
                  const active = t.id === s.activeId;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm"
                      style={{ background: active ? "rgba(201,162,39,.16)" : "transparent", border: `1px solid ${active ? "var(--gold)" : "transparent"}`, color: active ? "var(--gold)" : "var(--parchment)" }}
                      aria-current={active ? "step" : undefined}
                    >
                      <Portrait e={f} size={24} active={active} dead={f.hp === 0} />
                      <span className="truncate">{f.name}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Document montré par le MJ */}
      {s.handout && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
          <HandoutStage handout={s.handout} overlay={s.overlay} />
        </div>
      )}
    </div>
  );
}
