import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Dices, Play, ChevronLeft, Map as MapIcon, ScrollText, MonitorPlay, Hand, Ruler, Circle, Triangle, Eye, EyeOff, Flame } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import {
  uid,
  tickEffects,
  cellDistance,
  tokenInTemplate,
  inRevealed,
  openPlayerScreen,
  clamp,
  resizeImage,
  sortOrder,
  nextTurn,
  removeToken,
  rollInitiatives,
  newToken,
  fighterOf,
  isShared,
  withLog,
  PLAYER_CHANNEL,
} from "../../utils/helpers.js";
import { useDismiss } from "../../hooks/useDismiss.js";
import { inputStyle, NumInput } from "../ui/form.jsx";
import Tip from "../ui/Tip.jsx";
import Portrait from "../ui/Portrait.jsx";
import HpBar from "../ui/HpBar.jsx";
import HpControls from "../entities/HpControls.jsx";
import ConditionPicker from "../entities/ConditionPicker.jsx";
import Resources from "../entities/Resources.jsx";
import Spells from "../entities/Spells.jsx";
import Board from "./Board.jsx";
import AttackList from "./AttackList.jsx";
import AoeDialog from "./AoeDialog.jsx";
import Effects from "./Effects.jsx";
import Difficulty from "./Difficulty.jsx";
import { useRules } from "../../hooks/useRules.js";

const TOOLS = [
  ["move", Hand, "Déplacer les pions"],
  ["measure", Ruler, "Mesurer une distance (glisser)"],
  ["sphere", Circle, "Gabarit sphère / cercle (cliquer le centre)"],
  ["cone", Triangle, "Gabarit cône (glisser depuis l'origine)"],
];
const FOG_TOOLS = [
  ["reveal", Eye, "Révéler le brouillard (peindre)"],
  ["hide", EyeOff, "Remettre du brouillard (peindre)"],
];
const SHAPE_LABEL = { sphere: "Sphère", cone: "Cône" };
const fmtM = (m) => `${m.toLocaleString("fr-FR")} m`;

/* Ce que voit l'écran joueurs : ni pions cachés, ni PV des monstres et PNJ */
const publicPiece = ({ t, f }) => ({
  t: { id: t.id, x: t.x, y: t.y, size: t.size },
  f: {
    kind: f.kind,
    name: f.name,
    image: f.image,
    hp: isShared(f) ? f.hp : f.hp > 0 ? 1 : 0,
    hpMax: isShared(f) ? f.hpMax : 1,
    conditions: f.conditions,
    customConditions: f.customConditions,
    exhaustion: f.exhaustion,
  },
});

/**
 * Vue d'une rencontre :
 * - carte importable avec grille de cases carrées réglable
 * - pions déplaçables ; chaque pion de monstre / PNJ a ses propres PV et états
 * - tracker d'initiative avec tours et rounds (touche N = tour suivant)
 * - panneau contextuel au clic sur un pion (PV, états, initiative…)
 * - journal horodaté, écran joueurs dans une seconde fenêtre
 */
export default function CombatView({ combat, setCombat, entities, updateEntity, back, openEditor }) {
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const mapRef = useRef(null);
  const addRef = useRef(null);
  const channelRef = useRef(null);
  const publicRef = useRef(null);
  const [selected, setSelected] = useState(null); // id du pion
  const [showLog, setShowLog] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [tool, setTool] = useState("move");
  const [tplSize, setTplSize] = useState(6); // taille des gabarits en mètres
  const [brush, setBrush] = useState(1); // rayon du pinceau de brouillard, en cases
  const [ruler, setRuler] = useState(null); // { a, b } en cases
  const [preview, setPreview] = useState(null); // gabarit en cours de placement
  const [aoe, setAoe] = useState(null); // ids des pions ciblés par des dégâts de zone
  const gesture = useRef(null); // geste en cours sur la carte (mesure, gabarit, brouillard)
  const pointer = useRef({});
  useDismiss(addRef, addOpen, () => setAddOpen(false));

  const byId = useMemo(() => Object.fromEntries(entities.map((e) => [e.id, e])), [entities]);
  const order = sortOrder(combat.tokens, byId);
  const pieces = order.map((t) => ({ t, f: fighterOf(t, byId[t.entityId]) }));
  const activeId = combat.started ? combat.activeId : null;

  const log = useCallback((msg) => setCombat((c) => withLog(c, msg)), [setCombat]);

  const setToken = useCallback(
    (id, patch) => setCombat((c) => ({ ...c, tokens: c.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    [setCombat]
  );

  /* PJ : on modifie la fiche ; monstre / PNJ : l'état propre au pion */
  const updateFighter = (t, patch) =>
    t.stats
      ? setCombat((c) => ({ ...c, tokens: c.tokens.map((x) => (x.id === t.id ? { ...x, stats: { ...x.stats, ...patch } } : x)) }))
      : updateEntity(t.entityId, patch);

  const rules = useRules();
  const effects = combat.effects || [];

  /* Fin d'un effet : on retire son état, sauf si un autre effet du même pion le maintient */
  const endEffect = (ef, remaining) => {
    const p = pieces.find((x) => x.t.id === ef.tokenId);
    if (!p) return;
    log(`${ef.label} prend fin pour ${p.f.name}`);
    const kept = remaining.some((o) => o.tokenId === ef.tokenId && o.conditionId === ef.conditionId);
    if (ef.conditionId && !kept && p.f.conditions.includes(ef.conditionId)) {
      updateFighter(p.t, { conditions: p.f.conditions.filter((c) => c !== ef.conditionId) });
    }
  };

  const addEffect = (ef) => {
    const p = pieces.find((x) => x.t.id === ef.tokenId);
    setCombat((c) => ({ ...c, effects: [...(c.effects || []), { ...ef, id: uid() }] }));
    if (ef.conditionId && !p.f.conditions.includes(ef.conditionId)) updateFighter(p.t, { conditions: [...p.f.conditions, ef.conditionId] });
    log(`${p.f.name} : ${ef.label} (${ef.rounds} round${ef.rounds > 1 ? "s" : ""})`);
  };

  const removeEffect = (ef) => {
    const remaining = effects.filter((o) => o.id !== ef.id);
    setCombat((c) => ({ ...c, effects: (c.effects || []).filter((o) => o.id !== ef.id) }));
    endEffect(ef, remaining);
  };

  /* Tour suivant + décompte des effets de celui qui commence son tour */
  const turn = () => {
    const { combat: next, expired } = tickEffects(nextTurn(combat, byId));
    setCombat(() => next);
    expired.forEach((ef) => endEffect(ef, next.effects));
  };

  /* Position du pointeur en cases (1 case = largeur / nombre de colonnes) */
  const toCell = (ev) => {
    const r = boardRef.current.getBoundingClientRect();
    const cols = combat.gridCols || 20;
    return { x: ((ev.clientX - r.left) / r.width) * cols, y: ((ev.clientY - r.top) / r.width) * cols };
  };

  const makeTpl = (shape, a, b) => ({ shape, x: a.x, y: a.y, size: tplSize, angle: shape === "cone" && (b.x !== a.x || b.y !== a.y) ? Math.atan2(b.y - a.y, b.x - a.x) : 0 });

  /* Brouillard : révèle ou masque les cases sous le pinceau */
  const paint = (p, kind) => {
    const cols = combat.gridCols || 20;
    const rows = Math.ceil(cols * (combat.mapRatio || 0.625));
    const keys = [];
    for (let dx = 1 - brush; dx < brush; dx++)
      for (let dy = 1 - brush; dy < brush; dy++) {
        const x = Math.floor(p.x) + dx;
        const y = Math.floor(p.y) + dy;
        if (x >= 0 && y >= 0 && x < cols && y < rows) keys.push(`${x},${y}`);
      }
    setCombat((c) => {
      const has = new Set(c.fog.cells);
      if (keys.every((k) => has.has(k) === (kind === "reveal"))) return c; // rien ne change
      keys.forEach((k) => (kind === "reveal" ? has.add(k) : has.delete(k)));
      return { ...c, fog: { ...c.fog, cells: [...has] } };
    });
  };
  const allCells = () => {
    const cols = combat.gridCols || 20;
    const rows = Math.ceil(cols * (combat.mapRatio || 0.625));
    return Array.from({ length: cols * rows }, (_, i) => `${i % cols},${Math.floor(i / cols)}`);
  };

  /* Gestes sur la carte (recréés à chaque rendu pour voir l'état courant) */
  pointer.current.move = (ev) => {
    if (!boardRef.current) return;
    if (dragRef.current) {
      const r = boardRef.current.getBoundingClientRect();
      const x = clamp(((ev.clientX - r.left) / r.width) * 100, 1, 99);
      const y = clamp(((ev.clientY - r.top) / r.height) * 100, 1, 99);
      setToken(dragRef.current, { x, y });
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const p = toCell(ev);
    if (g.kind === "measure") setRuler({ a: g.start, b: p });
    else if (g.kind === "cone" || g.kind === "sphere") setPreview((g.tpl = makeTpl(g.kind, g.start, p)));
    else paint(p, g.kind);
  };
  pointer.current.up = () => {
    dragRef.current = null;
    const g = gesture.current;
    gesture.current = null;
    if (g?.tpl) {
      setCombat((c) => ({ ...c, templates: [...c.templates, { ...g.tpl, id: uid() }] }));
      setPreview(null);
    }
  };
  pointer.current.down = (ev) => {
    if (tool === "move") return setSelected(null);
    const p = toCell(ev);
    gesture.current = { kind: tool, start: p };
    if (tool === "measure") setRuler({ a: p, b: p });
    else if (tool === "sphere" || tool === "cone") setPreview((gesture.current.tpl = makeTpl(tool, p, p)));
    else paint(p, tool);
  };

  useEffect(() => {
    const move = (ev) => pointer.current.move(ev);
    const up = (ev) => pointer.current.up(ev);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const targetsOf = (tp) => pieces.filter(({ t }) => tokenInTemplate(tp, t, combat)).map(({ t }) => t.id);

  /* Raccourcis : N = tour suivant, Échap = fermer le panneau */
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.target.matches?.("input, textarea, select") || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (document.querySelector('[role="dialog"]')) return; // fiche ou fenêtre ouverte par-dessus
      if (ev.key === "Escape") setSelected(null);
      if (ev.key === "n" || ev.key === "N") turn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  /* Diffusion vers l'écran joueurs : la carte à part (lourde), le reste à chaque rendu */
  const publicState = {
    id: combat.id,
    templates: combat.templates,
    fog: combat.fog,
    name: combat.name,
    round: combat.round,
    started: combat.started,
    grid: combat.grid,
    gridCols: combat.gridCols,
    mapRatio: combat.mapRatio,
    activeId,
    pieces: pieces.filter((p) => !p.t.hidden && inRevealed(p.t, combat)).map(publicPiece),
  };
  publicRef.current = { ...publicState, map: combat.map };
  useEffect(() => {
    const ch = new BroadcastChannel(PLAYER_CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (ev) => ev.data === "hello" && ch.postMessage(publicRef.current);
    return () => {
      ch.postMessage({ pieces: null, map: "" }); // combat fermé : l'écran joueurs se met en attente
      ch.close();
    };
  }, []);
  useEffect(() => {
    channelRef.current?.postMessage({ map: combat.map });
  }, [combat.map]);
  useEffect(() => {
    channelRef.current?.postMessage(publicState);
  });

  const addToken = (e) => {
    const t = newToken(e, combat.tokens);
    setCombat((c) => withLog({ ...c, tokens: [...c.tokens, t] }, `${t.stats?.name ?? e.name} rejoint la rencontre`));
  };

  const sel = pieces.find((p) => p.t.id === selected);

  return (
    <div>
      {/* Barre du combat */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={back} className="p-1.5 rounded-md" style={inputStyle} title="Retour aux rencontres">
          <ChevronLeft size={16} />
        </button>
        <input
          value={combat.name}
          onChange={(ev) => setCombat((c) => ({ ...c, name: ev.target.value }))}
          className="bg-transparent outline-none text-lg min-w-[11rem] flex-1"
          style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}
          aria-label="Nom de la rencontre"
        />
        {combat.started && (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--chip)", border: "1px solid var(--gold)", color: "var(--gold)" }}>
            Round {combat.round}
          </span>
        )}
        <button
          onClick={openPlayerScreen}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold"
          style={inputStyle}
          title="Ouvre la carte pour les joueurs dans une autre fenêtre (à placer sur un second écran)"
        >
          <MonitorPlay size={14} /> Écran joueurs
        </button>
        <Tip text="Lance pour les monstres et PNJ. Les PJ gardent l'initiative déjà saisie (videz-la pour la relancer)." wide>
          <button
            onClick={() => {
              setCombat((c) => rollInitiatives(c, byId));
              log("Initiatives lancées — que le combat commence !");
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold"
            style={inputStyle}
          >
            <Dices size={14} /> {combat.started ? "Relancer initiatives" : "Lancer initiatives"}
          </button>
        </Tip>
        <button
          onClick={turn}
          disabled={!order.length}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-40"
          style={{ background: "var(--gold)", color: "#1a1409" }}
          title="Raccourci : touche N"
        >
          <Play size={14} /> Tour suivant
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Ordre d'initiative + ajout de combattants */}
        <div className="rounded-xl p-2.5 self-start" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Initiative
            </span>
            <div className="relative" ref={addRef}>
              <button
                onClick={() => setAddOpen(!addOpen)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1"
                style={{ background: "var(--gold)", color: "#1a1409" }}
              >
                <Plus size={12} /> Ajouter
              </button>
              {addOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-30 w-60 max-h-72 overflow-y-auto rounded-lg p-1.5 shadow-2xl"
                  style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}
                >
                  {["pc", "npc", "monster"].map((k) => {
                    const av = entities.filter((e) => e.kind === k);
                    if (!av.length) return null;
                    return (
                      <div key={k}>
                        <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-widest" style={{ color: KINDS[k].ring }}>
                          {KINDS[k].label}
                        </div>
                        {av.map((e) => {
                          const count = combat.tokens.filter((t) => t.entityId === e.id).length;
                          const blocked = isShared(e) && count > 0; // un PJ n'existe qu'une fois
                          return (
                            <button
                              key={e.id}
                              disabled={blocked}
                              onClick={() => addToken(e)}
                              className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs disabled:opacity-35 hover:bg-white/5"
                              style={{ color: "var(--parchment)" }}
                            >
                              <Portrait e={e} size={22} /> <span className="truncate">{e.name}</span>
                              {count > 0 && (
                                <span className="ml-auto text-[9px] shrink-0" style={{ color: "var(--muted)" }}>
                                  {blocked ? "déjà là" : `×${count} · +1`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {!entities.length && (
                    <div className="p-2 text-xs" style={{ color: "var(--muted)" }}>
                      Créez d'abord des personnages ou monstres.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            {order.length === 0 && (
              <div className="text-xs p-2" style={{ color: "var(--muted)" }}>
                Ajoutez des combattants puis lancez les initiatives.
              </div>
            )}
            {pieces.map(({ t, f }) => {
              const active = activeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors"
                  style={{
                    background: active ? "rgba(201,162,39,.14)" : selected === t.id ? "rgba(255,255,255,.05)" : "transparent",
                    border: `1px solid ${active ? "var(--gold)" : "transparent"}`,
                    opacity: t.hidden ? 0.6 : 1,
                  }}
                >
                  <span
                    className="w-6 text-center font-bold text-sm shrink-0"
                    style={{ fontFamily: "var(--display)", color: active ? "var(--gold)" : "var(--muted)" }}
                  >
                    {t.init ?? "—"}
                  </span>
                  <Portrait e={f} size={26} active={active} dead={f.hp === 0} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--parchment)" }}>
                      <span className="truncate">{f.name}</span>
                      {effects.some((ef) => ef.tokenId === t.id) && (
                        <span className="ml-auto shrink-0 text-[10px]" style={{ color: "var(--arcane)" }} title={effects.filter((ef) => ef.tokenId === t.id).map((ef) => `${ef.label} : ${ef.rounds} rd`).join("\n")}>
                          ⏳{Math.min(...effects.filter((ef) => ef.tokenId === t.id).map((ef) => ef.rounds))}
                        </span>
                      )}
                    </div>
                    <HpBar e={f} small />
                  </div>
                </button>
              );
            })}
          </div>
          <Difficulty pieces={pieces} entities={entities} rules={rules} />
        </div>

        {/* Carte et pions */}
        <div>
          {/* Outils de la carte */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs">
            {[...TOOLS, ...(combat.fog.on ? FOG_TOOLS : [])].map(([k, Icon, label]) => (
              <button
                key={k}
                onClick={() => {
                  setTool(k);
                  setRuler(null);
                }}
                className="p-1.5 rounded-md"
                style={{ ...inputStyle, color: tool === k ? "var(--gold)" : "var(--muted)", borderColor: tool === k ? "var(--gold)" : "var(--edge)" }}
                title={label}
                aria-label={label}
                aria-pressed={tool === k}
              >
                <Icon size={14} />
              </button>
            ))}
            {(tool === "sphere" || tool === "cone") && (
              <label className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                {tool === "sphere" ? "Rayon" : "Longueur"}
                <NumInput min="1.5" step="1.5" value={tplSize} onChange={(v) => setTplSize(Math.max(1.5, v))} className="w-14 rounded-md px-1.5 py-1 text-center outline-none" style={inputStyle} />
                m
              </label>
            )}
            {(tool === "reveal" || tool === "hide") && (
              <select value={brush} onChange={(ev) => setBrush(Number(ev.target.value))} className="rounded-md px-1.5 py-1 outline-none" style={inputStyle} aria-label="Taille du pinceau">
                <option value={1}>Pinceau 1 case</option>
                <option value={2}>Pinceau 3×3</option>
                <option value={3}>Pinceau 5×5</option>
              </select>
            )}
            {ruler && (
              <span className="font-semibold" style={{ color: "var(--gold)" }}>
                {cellDistance(ruler.a, ruler.b)} case{cellDistance(ruler.a, ruler.b) > 1 ? "s" : ""} · {fmtM(cellDistance(ruler.a, ruler.b) * 1.5)}
              </span>
            )}
            <span className="mx-1 h-5 w-px" style={{ background: "var(--edge)" }} />
            <label className="inline-flex items-center gap-1 cursor-pointer" style={{ color: "var(--muted)" }} title="Les joueurs ne voient que les zones révélées">
              <input
                type="checkbox"
                checked={combat.fog.on}
                onChange={(ev) => {
                  setCombat((c) => ({ ...c, fog: { ...c.fog, on: ev.target.checked } }));
                  if (ev.target.checked) setTool("reveal");
                  else if (tool === "reveal" || tool === "hide") setTool("move");
                }}
              />
              Brouillard
            </label>
            {combat.fog.on && (
              <>
                <button onClick={() => setCombat((c) => ({ ...c, fog: { ...c.fog, cells: allCells() } }))} className="rounded-md px-2 py-1" style={inputStyle}>
                  Tout révéler
                </button>
                <button onClick={() => setCombat((c) => ({ ...c, fog: { ...c.fog, cells: [] } }))} className="rounded-md px-2 py-1" style={inputStyle}>
                  Tout masquer
                </button>
              </>
            )}
            <button
              onClick={() => setAoe(selected ? [selected] : [])}
              disabled={!order.length}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold disabled:opacity-40"
              style={{ ...inputStyle, color: "var(--blood-l)" }}
            >
              <Flame size={13} /> Dégâts de zone
            </button>
          </div>

          <div className="relative">
            <Board
              ref={boardRef}
              combat={combat}
              pieces={pieces}
              activeId={activeId}
              selectedId={selected}
              preview={preview}
              cursor={tool === "move" ? undefined : "crosshair"}
              onBoardDown={(ev) => pointer.current.down(ev)}
              onTokenDown={
                tool === "move"
                  ? (ev, t) => {
                      ev.stopPropagation();
                      dragRef.current = t.id;
                      setSelected(t.id);
                    }
                  : undefined
              }
            >
              {ruler && (
                <>
                  <line x1={ruler.a.x} y1={ruler.a.y} x2={ruler.b.x} y2={ruler.b.y} stroke="#c9a227" strokeWidth={0.12} strokeDasharray="0.4 0.25" />
                  <circle cx={ruler.a.x} cy={ruler.a.y} r={0.18} fill="#c9a227" />
                  <circle cx={ruler.b.x} cy={ruler.b.y} r={0.18} fill="#c9a227" />
                </>
              )}
            </Board>
            {!order.length && (
              <div className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none" style={{ color: "var(--muted)" }}>
                <span className="px-3 py-1.5 rounded-md" style={{ background: "rgba(10,8,5,.6)" }}>
                  Ajoutez des combattants via « + Ajouter », puis glissez-les librement.
                </span>
              </div>
            )}
          </div>

          {/* Gabarits posés */}
          {combat.templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
              {combat.templates.map((tp) => {
                const ids = targetsOf(tp);
                return (
                  <span key={tp.id} className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-0.5" style={{ background: "var(--chip)", border: "1px solid var(--blood-l)", color: "var(--parchment)" }}>
                    {SHAPE_LABEL[tp.shape]} {fmtM(tp.size)}
                    <button onClick={() => setAoe(ids)} className="underline" style={{ color: "var(--blood-l)" }} title="Dégâts de zone sur les pions touchés">
                      {ids.length} cible{ids.length > 1 ? "s" : ""}
                    </button>
                    <button onClick={() => setCombat((c) => ({ ...c, templates: c.templates.filter((x) => x.id !== tp.id) }))} className="p-0.5" style={{ color: "var(--muted)" }} aria-label="Retirer le gabarit">
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Options de la carte */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <button onClick={() => mapRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={inputStyle}>
              <MapIcon size={13} /> {combat.map ? "Changer la carte" : "Importer une carte"}
            </button>
            <input
              ref={mapRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (!f) return;
                try {
                  const { data, ratio } = await resizeImage(f, 1600, 0.8);
                  setCombat((c) => ({ ...c, map: data, mapRatio: clamp(ratio, 0.4, 1.4) }));
                  log("Nouvelle carte chargée");
                } catch {
                  alert("Impossible de lire cette image.");
                }
              }}
            />
            {combat.map && (
              <button onClick={() => setCombat((c) => ({ ...c, map: "", mapRatio: 0.625 }))} className="rounded-md px-2.5 py-1.5" style={inputStyle}>
                Retirer la carte
              </button>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer" style={{ color: "var(--muted)" }}>
              <input type="checkbox" checked={combat.grid} onChange={(ev) => setCombat((c) => ({ ...c, grid: ev.target.checked }))} />
              Grille
            </label>
            <Tip text="Nombre de cases sur la largeur de la carte. Réglez-le pour caler la grille sur celle de votre carte ; les pions suivent la taille des cases.">
              <label className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                Cases
                <NumInput
                  min="4"
                  max="80"
                  value={combat.gridCols || 20}
                  onChange={(v) => setCombat((c) => ({ ...c, gridCols: clamp(v, 4, 80) }))}
                  className="w-14 rounded-md px-1.5 py-1 text-center outline-none"
                  style={inputStyle}
                />
              </label>
            </Tip>
            <button onClick={() => setShowLog(!showLog)} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={inputStyle}>
              <ScrollText size={13} /> Journal ({combat.log.length})
            </button>
          </div>

          {showLog && (
            <div
              className="mt-2 rounded-xl p-3 max-h-44 overflow-y-auto text-xs space-y-1"
              style={{ background: "var(--panel)", border: "1px solid var(--edge)", color: "var(--muted)" }}
            >
              {combat.log.length === 0 && <span>Le journal de la rencontre est vide.</span>}
              {combat.log.map((l, i) => (
                <div key={i}>
                  <span style={{ color: "var(--edge2)" }}>
                    {new Date(l.t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>{" "}
                  — {l.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panneau du combattant sélectionné (key : remet à zéro ses états internes à chaque pion) */}
      {sel && (
        <SelectedPanel
          key={sel.t.id}
          t={sel.t}
          f={sel.f}
          update={(p) => updateFighter(sel.t, p)}
          setToken={(p) => setToken(sel.t.id, p)}
          effectsPanel={<Effects t={sel.t} effects={effects.filter((ef) => ef.tokenId === sel.t.id)} pieces={pieces} activeId={activeId} add={addEffect} remove={removeEffect} />}
          log={log}
          openEditor={openEditor}
          close={() => setSelected(null)}
          remove={() => {
            setCombat((c) => removeToken(c, sel.t.id, byId));
            log(`${sel.f.name} quitte la rencontre`);
            setSelected(null);
          }}
        />
      )}

      {aoe && <AoeDialog pieces={pieces} initialIds={aoe} apply={updateFighter} onLog={log} onClose={() => setAoe(null)} />}
    </div>
  );
}

function SelectedPanel({ t, f, update, setToken, log, openEditor, close, remove, effectsPanel }) {
  return (
    <div
      className="fixed z-30 left-0 right-0 md:left-auto md:right-4 md:w-96 rounded-t-xl md:rounded-xl shadow-2xl bottom-[calc(3.6rem+env(safe-area-inset-bottom))] md:bottom-4"
      style={{ background: "var(--panel)", border: "1px solid var(--edge)", maxHeight: "min(70vh, calc(100dvh - 9rem))", overflowY: "auto", overscrollBehavior: "contain" }}
    >
      <div className="flex items-center gap-2.5 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
        <Portrait e={f} size={40} dead={f.hp === 0} />
        <div className="min-w-0 flex-1">
          {t.stats ? (
            <input
              value={f.name}
              onChange={(ev) => update({ name: ev.target.value })}
              className="w-full bg-transparent outline-none"
              style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}
              aria-label="Nom du pion"
            />
          ) : (
            <div className="truncate" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
              {f.name}
            </div>
          )}
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            CA {f.ac} · Vitesse {f.speed} m · {KINDS[f.kind].single}
          </div>
          {(f.resistances || f.immunities || f.vulnerabilities) && (
            <div className="text-[10px] truncate" style={{ color: "var(--arcane)" }} title={[f.resistances, f.immunities, f.vulnerabilities].join(" · ")}>
              {[f.resistances && `Résiste : ${f.resistances}`, f.immunities && `Immunisé : ${f.immunities}`, f.vulnerabilities && `Vulnérable : ${f.vulnerabilities}`].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <button onClick={() => openEditor(t.entityId)} className="text-[11px] rounded-md px-2 py-1" style={inputStyle}>
          Fiche
        </button>
        <button onClick={close} className="p-1.5 rounded-md" style={inputStyle} title="Fermer (Échap)">
          <X size={14} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {t.stats && (
          <div className="text-[10px]" style={{ color: "var(--muted)" }}>
            PV, états et ressources propres à ce pion — la fiche sert de modèle.
          </div>
        )}
        <HpControls e={f} update={update} onLog={log} />
        {effectsPanel}
        <div>
          <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
            États — survolez pour la règle
          </span>
          <ConditionPicker e={f} update={update} onLog={log} />
        </div>
        <AttackList f={f} onLog={log} />
        <Spells e={f} update={update} onLog={log} />
        <Resources e={f} update={update} />
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span style={{ color: "var(--muted)" }}>Initiative</span>
          <input
            type="number"
            value={t.init ?? ""}
            placeholder="—"
            onChange={(ev) => setToken({ init: ev.target.value === "" ? null : Number(ev.target.value) })}
            className="w-14 rounded-md px-1.5 py-1 text-center outline-none"
            style={inputStyle}
          />
          <span style={{ color: "var(--muted)" }}>Taille</span>
          <select value={t.size || 1} onChange={(ev) => setToken({ size: Number(ev.target.value) })} className="rounded-md px-1.5 py-1 outline-none" style={inputStyle}>
            {![0.75, 1, 2, 3, 4].includes(t.size || 1) && <option value={t.size}>Autre ({t.size})</option>}
            <option value={0.75}>P</option>
            <option value={1}>M</option>
            <option value={2}>G</option>
            <option value={3}>TG</option>
            <option value={4}>Gig</option>
          </select>
          <label className="inline-flex items-center gap-1 cursor-pointer" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={!!t.hidden} onChange={(ev) => setToken({ hidden: ev.target.checked })} />
            Caché aux joueurs
          </label>
          <button onClick={remove} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ ...inputStyle, color: "var(--blood-l)" }}>
            <Trash2 size={12} /> Retirer
          </button>
        </div>
      </div>
    </div>
  );
}
