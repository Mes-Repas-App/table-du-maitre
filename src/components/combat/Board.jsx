import { forwardRef } from "react";
import { EyeOff } from "lucide-react";
import { clamp, hpColor, conePoints } from "../../utils/helpers.js";
import Portrait from "../ui/Portrait.jsx";

/** Gabarit de sort dessiné en cases */
function Template({ tp, preview }) {
  const style = { fill: "rgba(217,105,95,.22)", stroke: "var(--blood-l)", strokeWidth: 0.08, strokeDasharray: preview ? "0.3 0.2" : undefined };
  return tp.shape === "sphere" ? (
    <circle cx={tp.x} cy={tp.y} r={tp.size / 1.5} style={style} />
  ) : (
    <polygon points={conePoints(tp).map((p) => p.join(",")).join(" ")} style={style} />
  );
}

/**
 * Carte + grille + gabarits + brouillard + pions, partagée entre la vue MJ et l'écran joueurs.
 * La taille des pions suit celle des cases (unités cqw = % de la largeur de la carte).
 * `pieces` : [{ t: pion, f: combattant (fiche + état propre au pion) }]
 * `fogOpacity` : brouillard translucide pour le MJ, opaque pour les joueurs.
 * `children` : calque SVG en cases (règle de mesure, aperçu de gabarit).
 */
const Board = forwardRef(function Board(
  { combat, pieces, activeId, selectedId, onBoardDown, onTokenDown, showHp = () => true, fogOpacity = 0.45, preview, children, cursor },
  ref
) {
  const ratio = combat.mapRatio || 0.625;
  const cols = combat.gridCols || 20;
  const rows = cols * ratio;
  const fog = combat.fog?.on ? combat.fog.cells : null;
  return (
    <div
      ref={ref}
      className="relative w-full rounded-xl overflow-hidden select-none touch-none"
      style={{
        containerType: "inline-size",
        paddingBottom: `${ratio * 100}%`,
        background: combat.map ? `url(${combat.map}) center/100% 100%` : "var(--well)",
        border: "1px solid var(--edge)",
        boxShadow: "inset 0 0 60px rgba(0,0,0,.55)",
        cursor,
      }}
      onPointerDown={onBoardDown}
    >
      {combat.grid && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(232,220,195,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(232,220,195,.12) 1px, transparent 1px)",
            // Cases carrées : la hauteur d'une case en % de la carte dépend du ratio
            backgroundSize: `${100 / cols}% ${100 / (cols * ratio)}%`,
          }}
        />
      )}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none">
        {(combat.templates || []).map((tp) => (
          <Template key={tp.id} tp={tp} />
        ))}
        {preview && <Template tp={preview} preview />}
      </svg>
      {pieces.map(({ t, f }) => {
        const sz = `${(100 / cols) * (t.size || 1)}cqw`;
        const nbStates = f.conditions.length + (f.customConditions || []).length + (f.exhaustion > 0 ? 1 : 0);
        return (
          <div
            key={t.id}
            className={onTokenDown ? "absolute cursor-grab active:cursor-grabbing" : "absolute"}
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform: "translate(-50%,-50%)",
              zIndex: selectedId === t.id ? 20 : 10,
              opacity: t.hidden ? 0.45 : 1,
            }}
            onPointerDown={onTokenDown && ((ev) => onTokenDown(ev, t))}
          >
            <Portrait e={f} size={sz} active={activeId === t.id} dead={f.hp === 0} />
            {showHp(f) && (
              <div className="mx-auto mt-0.5 rounded-full overflow-hidden" style={{ width: `calc(${sz} * 0.9)`, height: 4, background: "rgba(0,0,0,.6)" }}>
                <div style={{ width: `${f.hpMax ? clamp((f.hp / f.hpMax) * 100, 0, 100) : 0}%`, height: "100%", background: hpColor(f.hp, f.hpMax) }} />
              </div>
            )}
            <div
              className="mx-auto text-center text-[9px] mt-0.5 px-1 rounded truncate"
              style={{ maxWidth: `calc(${sz} + 24px)`, background: "rgba(10,8,5,.7)", color: "var(--parchment)" }}
            >
              {f.name}
            </div>
            {nbStates > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 text-[10px] rounded-full px-1"
                style={{ background: "var(--arcane)", color: "#0d0f16", fontWeight: 700 }}
              >
                {nbStates}
              </span>
            )}
            {t.hidden && (
              <span className="absolute -top-1.5 -left-1.5 rounded-full p-0.5" style={{ background: "var(--chip)", color: "var(--muted)" }} title="Caché aux joueurs">
                <EyeOff size={10} />
              </span>
            )}
          </div>
        );
      })}
      {/* Brouillard : tout est masqué sauf les cases révélées (au-dessus des pions) */}
      {fog && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 25 }} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none">
          <defs>
            <mask id={`fog-${combat.id}`}>
              <rect width={cols} height={rows} fill="white" />
              {fog.map((k) => {
                const [x, y] = k.split(",").map(Number);
                return <rect key={k} x={x} y={y} width={1.02} height={1.02} fill="black" />;
              })}
            </mask>
          </defs>
          <rect width={cols} height={rows} fill="#0a0805" opacity={fogOpacity} mask={`url(#fog-${combat.id})`} />
        </svg>
      )}
      {children && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 30 }} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none">
          {children}
        </svg>
      )}
    </div>
  );
});

export default Board;
