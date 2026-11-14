import { useState } from "react";
import { RotateCcw, RotateCw, Undo2, Trash2, MonitorPlay, EyeOff, X } from "lucide-react";
import { openPlayerScreen } from "../../utils/helpers.js";
import { HandoutStage } from "../ui/Projection.jsx";
import { inputStyle } from "../ui/form.jsx";

const COLORS = [
  ["#e53935", "Rouge"],
  ["#fdd835", "Jaune"],
  ["#43a047", "Vert"],
  ["#1e88e5", "Bleu"],
  ["#ffffff", "Blanc"],
  ["#111111", "Noir"],
];
const WIDTHS = [
  [0.004, "Fin", 4],
  [0.009, "Moyen", 8],
  [0.018, "Épais", 13],
]; // épaisseur relative au grand côté de l'image, libellé, taille de la pastille

/**
 * Écran de projection du MJ : ce que voient les joueurs, avec les commandes
 * (rotation, dessin, effacement). L'écran joueurs reproduit tout en direct.
 */
export default function ProjectionAdmin({ handout, overlay, setOverlay, onClose, onStop }) {
  const [color, setColor] = useState(COLORS[0][0]);
  const [width, setWidth] = useState(WIDTHS[1][0]);
  const { rotation, strokes } = overlay;
  const turn = (d) => setOverlay((o) => ({ ...o, rotation: (o.rotation + d + 360) % 360 }));
  const setStrokes = (s) => setOverlay((o) => ({ ...o, strokes: s }));
  const btn = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs disabled:opacity-35";

  return (
    <div role="dialog" aria-modal="true" aria-label="Écran de projection" className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Commandes (invisibles pour les joueurs) */}
      <div className="flex flex-wrap items-center gap-1.5 p-2" style={{ background: "var(--panel)", borderBottom: "1px solid var(--edge)" }}>
        <span className="inline-flex items-center gap-1.5 mr-1 text-xs font-semibold" style={{ color: "var(--arcane)" }}>
          <MonitorPlay size={14} /> En direct
        </span>
        {handout.image && (
          <>
            <button onClick={() => turn(-90)} className={btn} style={inputStyle} title="Pivoter vers la gauche" aria-label="Pivoter vers la gauche">
              <RotateCcw size={15} />
            </button>
            <button onClick={() => turn(90)} className={btn} style={inputStyle} title="Pivoter vers la droite" aria-label="Pivoter vers la droite">
              <RotateCw size={15} />
            </button>
            <span className="w-px h-6 mx-1" style={{ background: "var(--edge)" }} />
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Couleur du crayon">
              {COLORS.map(([c, label]) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={color === c}
                  aria-label={label}
                  title={label}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full"
                  style={{ background: c, border: "2px solid var(--edge)", outline: color === c ? "2px solid var(--gold)" : "none", outlineOffset: 1 }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Épaisseur du trait">
              {WIDTHS.map(([w, label, dot]) => (
                <button key={w} role="radio" aria-checked={width === w} aria-label={label} title={label} onClick={() => setWidth(w)} className="w-8 h-8 rounded-md flex items-center justify-center" style={{ ...inputStyle, borderColor: width === w ? "var(--gold)" : undefined }}>
                  <span className="rounded-full" style={{ width: dot, height: dot, background: color }} />
                </button>
              ))}
            </div>
            <span className="w-px h-6 mx-1" style={{ background: "var(--edge)" }} />
            <button onClick={() => setStrokes(strokes.slice(0, -1))} disabled={!strokes.length} className={btn} style={inputStyle} title="Effacer le dernier trait">
              <Undo2 size={14} /> <span className="hidden sm:inline">Dernier trait</span>
            </button>
            <button onClick={() => setStrokes([])} disabled={!strokes.length} className={btn} style={inputStyle} title="Effacer tous les dessins">
              <Trash2 size={14} /> <span className="hidden sm:inline">Tout effacer</span>
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={openPlayerScreen} className={btn} style={inputStyle} title="Ouvrir (ou retrouver) la fenêtre des joueurs">
            <MonitorPlay size={14} /> <span className="hidden sm:inline">Fenêtre joueurs</span>
          </button>
          <button onClick={onStop} className={btn} style={inputStyle} title="Ne plus rien montrer aux joueurs">
            <EyeOff size={14} /> <span className="hidden sm:inline">Ne plus montrer</span>
          </button>
          <button onClick={onClose} className={btn} style={{ background: "var(--gold)", color: "#1a1409" }} title="Revenir à l'appli : les joueurs gardent l'affichage">
            <X size={14} /> Fermer
          </button>
        </div>
      </div>

      {/* Aperçu fidèle de l'écran joueurs */}
      <HandoutStage handout={handout} overlay={overlay} pen={handout.image ? { color, width } : null} onChange={setStrokes} />
      {handout.image && (
        <p className="pb-2 text-center text-[11px]" style={{ color: "var(--muted)" }}>
          Dessinez sur l'image à la souris ou au doigt : les joueurs voient vos traits en direct.
        </p>
      )}
    </div>
  );
}
