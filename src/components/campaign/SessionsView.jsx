import { useState, useRef } from "react";
import { Plus, Trash2, ScrollText, X, Forward, Check, ChevronUp, ChevronDown, ImagePlus, Clapperboard, ChevronRight } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import { newSession, newScene, uid, resizeImage, sessionLinks, SCENE_KINDS, PLACE_KINDS, placeTree } from "../../utils/helpers.js";
import { Field, NumInput, TitleInput, inputCls, inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";
import Lightbox from "../ui/Lightbox.jsx";
import LinkPicker from "./LinkPicker.jsx";

const PREP_KINDS = {
  scene: { label: "Scène", icon: "🎬" },
  secret: { label: "Secret / indice", icon: "🗝️" },
  npc: { label: "PNJ", icon: "🎭" },
  place: { label: "Lieu", icon: "🏰" },
};
const TABS = [
  ["prep", "Préparation"],
  ["play", "Déroulé"],
  ["recap", "Bilan"],
];

const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "sans date");
const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");
const SectionTitle = ({ children }) => (
  <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
    {children}
  </span>
);

/**
 * Sessions : préparation (éléments à jouer, reliés aux fiches et lieux), déroulé scène par
 * scène (texte, images, liens vers personnages, lieux et quêtes) et bilan (résumé, présents,
 * XP, trésor, pistes pour la suite).
 */
export default function SessionsView({ sessions, setSessions, entities, updateEntity, world, selectedId, select, openEditor, openWorld, showHandout }) {
  const [tab, setTab] = useState("play");
  const [lightbox, setLightbox] = useState(null); // { src, title }
  const list = [...sessions].sort(byDateDesc);
  const s = sessions.find((x) => x.id === selectedId) || list[0];
  const today = new Date().toISOString().slice(0, 10);
  const recap = list.find((x) => x.summary.trim() && x.date <= today && x.id !== s?.id) || null;
  const pcs = entities.filter((e) => e.kind === "pc");

  const set = (patch) => setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  const setScenes = (fn) => setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, scenes: fn(x.scenes) } : x)));
  const create = (extra = {}) => {
    const n = { ...newSession(sessions.length + 1), present: pcs.map((e) => e.id), ...extra };
    setSessions((p) => [...p, n]);
    select(n.id);
  };
  const links = { entities, world, onOpenEntity: openEditor, onOpenWorld: openWorld };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl mr-auto" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
          Sessions{" "}
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            ({sessions.length})
          </span>
        </h2>
        <button onClick={() => create()} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
          <Plus size={15} /> Nouvelle session
        </button>
      </div>

      {!s ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          <ScrollText size={32} className="mx-auto mb-3 opacity-50" />
          Aucune session. Créez-en une pour préparer la prochaine séance ou raconter la dernière.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Liste des sessions */}
          <div className="rounded-xl p-2 self-start space-y-0.5 max-h-48 md:max-h-none overflow-y-auto" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
            {list.map((x) => (
              <button
                key={x.id}
                onClick={() => select(x.id)}
                className="w-full text-left rounded-lg px-2 py-1.5"
                style={{ background: x.id === s.id ? "rgba(201,162,39,.14)" : "transparent", border: `1px solid ${x.id === s.id ? "var(--gold)" : "transparent"}` }}
              >
                <div className="text-sm truncate" style={{ color: "var(--parchment)" }}>
                  {x.title || "Sans titre"}
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {fmtDate(x.date)}
                  {x.date > today ? " · à venir" : ""}
                  {x.scenes.length > 0 && ` · ${x.scenes.length} scène${x.scenes.length > 1 ? "s" : ""}`}
                </div>
              </button>
            ))}
          </div>

          {/* Détail */}
          <div className="space-y-3 min-w-0">
            {recap && (
              <div className="rounded-xl p-3" style={{ background: "rgba(201,162,39,.08)", border: "1px solid var(--gold)" }}>
                <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--gold)" }}>
                  Précédemment… ({recap.title})
                </div>
                <div className="text-sm whitespace-pre-wrap" style={{ color: "var(--parchment)", fontFamily: "var(--display)" }}>
                  {recap.summary}
                </div>
              </div>
            )}

            <div className="rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
              <div className="p-4 pb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TitleInput key={s.id} value={s.title} onChange={(title) => set({ title })} label="Titre de la session" className="flex-1 basis-full sm:basis-0" />
                  <button
                    onClick={() => {
                      if (!confirm(`Supprimer « ${s.title} » et tout son déroulé ? Cette action est définitive (Ctrl+Z pour revenir en arrière).`)) return;
                      setSessions((p) => p.filter((x) => x.id !== s.id));
                      select(null);
                    }}
                    className="p-2 rounded-md"
                    style={{ ...inputStyle, color: "var(--blood-l)" }}
                    title="Supprimer la session"
                    aria-label="Supprimer la session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  <label className="inline-flex items-center gap-1.5">
                    Jouée le
                    <input type="date" value={s.date} onChange={(ev) => set({ date: ev.target.value })} className="rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Date de la session" />
                  </label>
                  <label className="inline-flex items-center gap-1.5 flex-1 min-w-[12rem]">
                    Date en jeu
                    <input value={s.gameDate} onChange={(ev) => set({ gameDate: ev.target.value })} placeholder="3 Mirtul 1492, jour 12…" className="flex-1 min-w-0 rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Date dans le monde du jeu" />
                  </label>
                </div>
              </div>

              <nav className="flex gap-1 px-2 sm:px-4 overflow-x-auto no-scrollbar" style={{ borderBottom: "1px solid var(--edge)" }}>
                {TABS.map(([k, label]) => {
                  const count = k === "prep" ? `${s.prep.filter((p) => p.done).length}/${s.prep.length}` : k === "play" ? s.scenes.length : null;
                  return (
                    <button
                      key={k}
                      onClick={() => setTab(k)}
                      className="px-3 py-1.5 text-sm whitespace-nowrap"
                      style={{ color: tab === k ? "var(--gold)" : "var(--muted)", borderBottom: `2px solid ${tab === k ? "var(--gold)" : "transparent"}`, fontWeight: tab === k ? 700 : 400 }}
                      aria-current={tab === k ? "page" : undefined}
                    >
                      {label}
                      {count != null && <span className="ml-1 text-[10px] opacity-70">({count})</span>}
                    </button>
                  );
                })}
              </nav>

              <div className="p-3 sm:p-4">
                {tab === "prep" && (
                  <Prep
                    s={s}
                    set={set}
                    entities={entities}
                    world={world}
                    openEditor={openEditor}
                    openWorld={openWorld}
                    carryOver={(items) => create({ prep: items })}
                    toScene={(p) => {
                      const ref = p.refId;
                      const isPlace = world.some((w) => w.id === ref);
                      setScenes((sc) => [...sc, newScene({ title: p.text, entities: ref && !isPlace ? [ref] : [], places: ref && isPlace ? [ref] : [] })]);
                      set({ prep: s.prep.map((x) => (x.id === p.id ? { ...x, done: true } : x)) });
                      setTab("play");
                    }}
                  />
                )}
                {tab === "play" && <Scenes key={s.id} s={s} setScenes={setScenes} links={links} openImage={setLightbox} />}
                {tab === "recap" && <Recap s={s} set={set} pcs={pcs} entities={entities} world={world} updateEntity={updateEntity} links={links} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} onShow={() => showHandout({ title: lightbox.title, image: lightbox.src, text: "" })} />}
    </div>
  );
}

/* ---------- Déroulé : scènes ---------- */

function Scenes({ s, setScenes, links, openImage }) {
  const [folded, setFolded] = useState([]); // scènes repliées (affichage seulement)
  const update = (id, patch) => setScenes((sc) => sc.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i, dir) =>
    setScenes((sc) => {
      const next = [...sc];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  const add = () => setScenes((sc) => [...sc, newScene()]);

  return (
    <div className="space-y-3">
      {s.scenes.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Racontez la session scène par scène : ce qui s'est passé, des images (cartes, portraits, croquis), et les personnages, lieux et quêtes concernés.
        </p>
      )}
      {s.scenes.length > 1 && (
        <div className="flex justify-end gap-3 text-[11px]" style={{ color: "var(--arcane)" }}>
          <button className="underline" onClick={() => setFolded(s.scenes.map((x) => x.id))}>
            Tout replier
          </button>
          <button className="underline" onClick={() => setFolded([])}>
            Tout déplier
          </button>
        </div>
      )}
      {s.scenes.map((sc, i) => (
        <SceneCard
          key={sc.id}
          sc={sc}
          index={i}
          total={s.scenes.length}
          folded={folded.includes(sc.id)}
          toggle={() => setFolded((f) => (f.includes(sc.id) ? f.filter((x) => x !== sc.id) : [...f, sc.id]))}
          update={(patch) => update(sc.id, patch)}
          move={(dir) => move(i, dir)}
          remove={() => confirm(`Supprimer la scène « ${sc.title || "sans titre"} » ?`) && setScenes((all) => all.filter((x) => x.id !== sc.id))}
          links={links}
          openImage={openImage}
        />
      ))}
      <button onClick={add} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px dashed var(--gold)", color: "var(--gold)" }}>
        <Plus size={15} /> Nouvelle scène
      </button>
    </div>
  );
}

function SceneCard({ sc, index, total, folded, toggle, update, move, remove, links, openImage }) {
  const fileRef = useRef(null);
  const K = SCENE_KINDS[sc.kind] || SCENE_KINDS.scene;
  const nLinks = sc.entities.length + sc.places.length + sc.quests.length;

  return (
    <article className="rounded-lg" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
      <header className="flex flex-wrap items-center gap-2 p-2.5">
        <button onClick={toggle} className="p-1 rounded-md shrink-0" style={{ color: "var(--muted)" }} title={folded ? "Déplier la scène" : "Replier la scène"} aria-expanded={!folded}>
          <ChevronRight size={14} style={{ transform: folded ? "none" : "rotate(90deg)", transition: "transform .15s" }} />
        </button>
        <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--gold)" }}>
          {index + 1}.
        </span>
        <select value={sc.kind} onChange={(ev) => update({ kind: ev.target.value })} className="rounded-md px-1 py-0.5 text-xs outline-none shrink-0" style={{ ...inputStyle, background: "var(--panel)" }} aria-label="Type de scène">
          {Object.entries(SCENE_KINDS).map(([k, S]) => (
            <option key={k} value={k}>
              {S.icon} {S.label}
            </option>
          ))}
        </select>
        {/* Sur téléphone, le titre prend toute une ligne sous le type et les boutons */}
        <TitleInput value={sc.title} onChange={(title) => update({ title })} label="Titre de la scène" size="text-base" className="order-last sm:order-none basis-full sm:basis-0 sm:flex-1 min-w-0" />
        <span className="flex items-center gap-0.5 shrink-0 ml-auto sm:ml-0">
          <button disabled={index === 0} onClick={() => move(-1)} className="p-1 rounded-md disabled:opacity-25" style={{ color: "var(--muted)" }} title="Monter" aria-label="Monter la scène">
            <ChevronUp size={14} />
          </button>
          <button disabled={index === total - 1} onClick={() => move(1)} className="p-1 rounded-md disabled:opacity-25" style={{ color: "var(--muted)" }} title="Descendre" aria-label="Descendre la scène">
            <ChevronDown size={14} />
          </button>
          <button onClick={remove} className="p-1 rounded-md" style={{ color: "var(--blood-l)" }} title="Supprimer la scène" aria-label="Supprimer la scène">
            <Trash2 size={13} />
          </button>
        </span>
      </header>

      {folded ? (
        <button onClick={toggle} className="block w-full text-left px-3 pb-2.5 text-xs truncate" style={{ color: "var(--muted)" }}>
          {K.icon} {sc.text.split("\n")[0] || "—"}
          {sc.images.length > 0 && ` · ${sc.images.length} image${sc.images.length > 1 ? "s" : ""}`}
          {nLinks > 0 && ` · ${nLinks} lien${nLinks > 1 ? "s" : ""}`}
        </button>
      ) : (
        <div className="px-3 pb-3 space-y-2.5">
          <textarea
            value={sc.text}
            onChange={(ev) => update({ text: ev.target.value })}
            rows={Math.max(4, Math.min(24, sc.text.split("\n").length + 1))}
            placeholder="Ce qui s'est passé, les répliques marquantes, les décisions des joueurs, les jets décisifs…"
            className={inputCls}
            style={{ ...inputStyle, background: "var(--panel)", resize: "vertical", lineHeight: 1.5 }}
            aria-label="Récit de la scène"
          />

          {/* Images */}
          <div className="flex flex-wrap gap-2">
            {sc.images.map((src, j) => (
              <div key={j} className="relative">
                <button onClick={() => openImage({ src, title: sc.title })} title="Voir en grand">
                  <img src={src} alt={`${sc.title} — image ${j + 1}`} className="h-24 w-auto max-w-[10rem] object-cover rounded-md" style={{ border: "1px solid var(--edge)" }} />
                </button>
                <button onClick={() => update({ images: sc.images.filter((_, k) => k !== j) })} className="absolute top-1 right-1 p-0.5 rounded" style={{ ...inputStyle, background: "rgba(10,8,5,.75)" }} aria-label="Retirer l'image">
                  <X size={11} />
                </button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()} className="h-24 px-3 inline-flex flex-col items-center justify-center gap-1 rounded-md text-[11px]" style={{ border: "1px dashed var(--edge2)", color: "var(--muted)" }}>
              <ImagePlus size={16} /> Ajouter des images
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (ev) => {
                const files = [...(ev.target.files || [])];
                ev.target.value = "";
                const added = [];
                for (const f of files) {
                  try {
                    added.push((await resizeImage(f, 1600)).data);
                  } catch {
                    alert(`Impossible de lire l'image « ${f.name} ».`);
                  }
                }
                if (added.length) update({ images: [...sc.images, ...added] });
              }}
            />
          </div>

          {/* Liens */}
          <LinkPicker links={sc} onChange={update} {...links} />
        </div>
      )}
    </article>
  );
}

/* ---------- Bilan ---------- */

function Recap({ s, set, pcs, entities, world, updateEntity, links }) {
  // Tout ce que la session a croisé, rassemblé depuis les scènes et la préparation
  const ids = sessionLinks(s);
  const met = entities.filter((e) => ids.has(e.id) && !s.present.includes(e.id));
  const places = world.filter((w) => w.type === "place" && ids.has(w.id));
  const quests = world.filter((w) => w.type === "quest" && ids.has(w.id));

  return (
    <div className="space-y-4">
      <Field label="Résumé (servira de « Précédemment… » à la session suivante)">
        <textarea rows={5} value={s.summary} onChange={(ev) => set({ summary: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      {pcs.length > 0 && (
        <div>
          <SectionTitle>Personnages présents</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {pcs.map((e) => {
              const on = s.present.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => set({ present: on ? s.present.filter((id) => id !== e.id) : [...s.present, e.id] })}
                  className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 text-xs"
                  style={{ background: on ? "var(--chip)" : "transparent", border: `1px solid ${on ? "var(--gold)" : "var(--edge)"}`, color: on ? "var(--parchment)" : "var(--muted)", opacity: on ? 1 : 0.6 }}
                  aria-pressed={on}
                >
                  <Portrait e={e} size={20} /> {e.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(met.length > 0 || places.length > 0 || quests.length > 0) && (
        <div>
          <SectionTitle>Croisés pendant la session</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {met.map((e) => (
              <button key={e.id} onClick={() => links.onOpenEntity(e.id)} className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 text-xs" style={{ ...inputStyle, background: "var(--chip)" }} title={KINDS[e.kind].single}>
                <Portrait e={e} size={18} /> {e.name}
              </button>
            ))}
            {places.map((p) => (
              <button key={p.id} onClick={() => links.onOpenWorld(p.id)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ ...inputStyle, background: "var(--chip)" }}>
                {(PLACE_KINDS[p.kind] || PLACE_KINDS.other).icon} {p.name || "Sans nom"}
              </button>
            ))}
            {quests.map((q) => (
              <button key={q.id} onClick={() => links.onOpenWorld(q.id)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ ...inputStyle, background: "var(--chip)" }}>
                📜 {q.name || "Sans nom"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3">
        <Field label="XP gagnés (total du groupe)">
          <NumInput min="0" value={s.xp} onChange={(v) => set({ xp: Math.max(0, v) })} className={inputCls} style={inputStyle} />
          <XpButton s={s} set={set} entities={entities} updateEntity={updateEntity} />
        </Field>
        <Field label="Trésor et objets trouvés">
          <textarea rows={3} value={s.loot} onChange={(ev) => set({ loot: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
      </div>

      <Field label="Pour la suite (pistes, questions en suspens, à préparer)">
        <textarea rows={3} value={s.nextHooks} onChange={(ev) => set({ nextHooks: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
    </div>
  );
}

function XpButton({ s, set, entities, updateEntity }) {
  const present = entities.filter((e) => s.present.includes(e.id));
  const each = present.length ? Math.floor(s.xp / present.length) : 0;
  if (s.xpGiven) {
    return (
      <div className="mt-1.5 text-[11px] inline-flex items-center gap-1" style={{ color: "var(--life-l)" }}>
        <Check size={12} /> XP distribués
      </div>
    );
  }
  return (
    <button
      disabled={!each}
      onClick={() => {
        present.forEach((e) => updateEntity(e.id, { xp: (e.xp || 0) + each }));
        set({ xpGiven: true });
      }}
      className="mt-1.5 w-full rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
      style={inputStyle}
    >
      Distribuer {each || 0} XP à chacun ({present.length})
    </button>
  );
}

/* ---------- Préparation ---------- */

/** Éléments à jouer, cochés au fil de la partie ; PNJ et lieux reliés aux vraies fiches */
function Prep({ s, set, entities, world, openEditor, openWorld, carryOver, toScene }) {
  const [kind, setKind] = useState("scene");
  const [text, setText] = useState("");
  const [refId, setRefId] = useState("");
  const left = s.prep.filter((p) => !p.done);
  const setItem = (id, patch) => set({ prep: s.prep.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const npcs = entities.filter((e) => e.kind !== "pc");
  const places = world.filter((w) => w.type === "place");
  const refName = (id) => entities.find((e) => e.id === id)?.name || world.find((w) => w.id === id)?.name;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          À jouer — cochez au fil de la partie
        </span>
        {s.prep.length > 0 && (
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {s.prep.length - left.length}/{s.prep.length}
          </span>
        )}
      </div>
      {Object.entries(PREP_KINDS).map(([k, K]) => {
        const items = s.prep.filter((p) => p.kind === k);
        if (!items.length) return null;
        return (
          <div key={k} className="mb-2">
            <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--gold)" }}>
              {K.icon} {K.label}
            </div>
            {items.map((p) => (
              <div key={p.id} className="flex flex-wrap items-start gap-2 text-sm py-0.5">
                <input type="checkbox" checked={p.done} onChange={(ev) => setItem(p.id, { done: ev.target.checked })} className="mt-1" aria-label="Joué" />
                <span className="flex-1 min-w-[8rem]" style={{ color: p.done ? "var(--muted)" : "var(--parchment)", textDecoration: p.done ? "line-through" : "none" }}>
                  {p.text}
                  {p.refId && refName(p.refId) && (
                    <button
                      onClick={() => (entities.some((e) => e.id === p.refId) ? openEditor(p.refId) : openWorld(p.refId))}
                      className="ml-2 rounded-full px-2 py-0 text-[11px]"
                      style={{ ...inputStyle, background: "var(--chip)", textDecoration: "none" }}
                      title="Ouvrir"
                    >
                      {refName(p.refId)}
                    </button>
                  )}
                </span>
                <button onClick={() => toScene(p)} className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--arcane)" }} title="Raconter cet élément dans le déroulé">
                  <Clapperboard size={12} /> en scène
                </button>
                <button onClick={() => set({ prep: s.prep.filter((x) => x.id !== p.id) })} style={{ color: "var(--muted)" }} aria-label="Retirer">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <form
        className="flex flex-wrap gap-1.5 mt-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          const label = text.trim() || refName(refId) || "";
          if (!label) return;
          set({ prep: [...s.prep, { id: uid(), kind, text: label, done: false, refId: refId || null }] });
          setText("");
          setRefId("");
        }}
      >
        <select
          value={kind}
          onChange={(ev) => {
            setKind(ev.target.value);
            setRefId("");
          }}
          className="rounded-md px-1.5 py-1 text-xs outline-none"
          style={inputStyle}
          aria-label="Type"
        >
          {Object.entries(PREP_KINDS).map(([k, K]) => (
            <option key={k} value={k}>
              {K.icon} {K.label}
            </option>
          ))}
        </select>
        {(kind === "npc" || kind === "place") && (
          <select value={refId} onChange={(ev) => setRefId(ev.target.value)} className="rounded-md px-1.5 py-1 text-xs outline-none max-w-[12rem]" style={inputStyle} aria-label={kind === "npc" ? "PNJ lié" : "Lieu lié"}>
            <option value="">{kind === "npc" ? "— fiche (facultatif) —" : "— lieu (facultatif) —"}</option>
            {kind === "npc"
              ? npcs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))
              : placeTree(places).map(({ p, depth }) => (
                  <option key={p.id} value={p.id}>
                    {"   ".repeat(depth)}
                    {(PLACE_KINDS[p.kind] || PLACE_KINDS.other).icon} {p.name || "Sans nom"}
                  </option>
                ))}
          </select>
        )}
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder={kind === "npc" ? "Ce qu'il veut, ce qu'il sait…" : kind === "place" ? "Ce qu'on y trouvera…" : "Ex : le marchand est un espion de la Guilde"}
          className="flex-1 min-w-[10rem] rounded-md px-2 py-1 text-sm outline-none"
          style={inputStyle}
          aria-label="Élément à préparer"
        />
        <button className="rounded-md px-2.5 py-1 text-xs font-bold" style={{ background: "var(--gold)", color: "#1a1409" }}>
          Ajouter
        </button>
      </form>
      {left.length > 0 && s.prep.length > left.length && (
        <button onClick={() => carryOver(left.map((p) => ({ ...p, id: uid() })))} className="mt-2 inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--arcane)" }}>
          <Forward size={12} /> Reporter les {left.length} élément{left.length > 1 ? "s" : ""} non joué{left.length > 1 ? "s" : ""} dans une nouvelle session
        </button>
      )}
    </div>
  );
}
