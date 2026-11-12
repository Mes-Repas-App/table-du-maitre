import { useState } from "react";
import { Plus, Trash2, ScrollText, X, Forward, Check } from "lucide-react";
import { newSession, uid } from "../../utils/helpers.js";
import { Field, NumInput, TitleInput, inputCls, inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";

const PREP_KINDS = {
  scene: { label: "Scène", icon: "🎬" },
  secret: { label: "Secret / indice", icon: "🗝️" },
  npc: { label: "PNJ", icon: "🎭" },
  place: { label: "Lieu", icon: "🏰" },
};

const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "sans date");
const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");

/**
 * Journal des sessions : résumé, présents, XP et trésor, et préparation
 * de séance (scènes, secrets, PNJ, lieux) qu'on coche une fois joués.
 */
export default function SessionsView({ sessions, setSessions, entities, updateEntity, selectedId, select }) {
  const list = [...sessions].sort(byDateDesc);
  const s = sessions.find((x) => x.id === selectedId) || list[0];
  const today = new Date().toISOString().slice(0, 10);
  const recap = list.find((x) => x.summary.trim() && x.date <= today && x.id !== s?.id) || null;
  const pcs = entities.filter((e) => e.kind === "pc");

  const set = (patch) => setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  const create = (extra = {}) => {
    const n = { ...newSession(sessions.length + 1), present: pcs.map((e) => e.id), ...extra };
    setSessions((p) => [...p, n]);
    select(n.id);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl mr-auto" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
          Sessions{" "}
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            ({sessions.length})
          </span>
        </h2>
        <button
          onClick={() => create()}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#1a1409" }}
        >
          <Plus size={15} /> Nouvelle session
        </button>
      </div>

      {!s ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          <ScrollText size={32} className="mx-auto mb-3 opacity-50" />
          Aucune session. Créez-en une pour préparer la prochaine séance ou résumer la dernière.
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
                  {x.title}
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {fmtDate(x.date)}
                  {x.date > today ? " · à venir" : ""}
                </div>
              </button>
            ))}
          </div>

          {/* Détail */}
          <div className="space-y-3">
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

            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <TitleInput key={s.id} value={s.title} onChange={(title) => set({ title })} label="Titre de la session" className="flex-1 basis-full sm:basis-0" />
                <input type="date" value={s.date} onChange={(ev) => set({ date: ev.target.value })} className="rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Date" />
                <button
                  onClick={() => {
                    if (!confirm(`Supprimer « ${s.title} » ?`)) return;
                    setSessions((p) => p.filter((x) => x.id !== s.id));
                    select(null);
                  }}
                  className="p-2 rounded-md"
                  style={{ ...inputStyle, color: "var(--blood-l)" }}
                  title="Supprimer la session"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <Prep s={s} set={set} carryOver={(items) => create({ prep: items })} />

              <Field label="Résumé (ce qui s'est passé — servira de « Précédemment… »)">
                <textarea rows={4} value={s.summary} onChange={(ev) => set({ summary: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              {pcs.length > 0 && (
                <div>
                  <span className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
                    Personnages présents
                  </span>
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

              <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3">
                <Field label="XP gagnés (total du groupe)">
                  <div className="flex gap-1.5">
                    <NumInput min="0" value={s.xp} onChange={(v) => set({ xp: Math.max(0, v) })} className={inputCls} style={inputStyle} />
                  </div>
                  <XpButton s={s} set={set} entities={entities} updateEntity={updateEntity} />
                </Field>
                <Field label="Trésor et objets trouvés">
                  <textarea rows={3} value={s.loot} onChange={(ev) => set({ loot: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
                </Field>
              </div>
            </div>
          </div>
        </div>
      )}
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

/** Préparation de séance : éléments à jouer, cochés au fil de la partie */
function Prep({ s, set, carryOver }) {
  const [kind, setKind] = useState("scene");
  const [text, setText] = useState("");
  const left = s.prep.filter((p) => !p.done);
  const setItem = (id, patch) => set({ prep: s.prep.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Préparation — cochez ce qui a été joué
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
              <div key={p.id} className="flex items-start gap-2 text-sm py-0.5 group">
                <input type="checkbox" checked={p.done} onChange={(ev) => setItem(p.id, { done: ev.target.checked })} className="mt-1" aria-label="Joué" />
                <span className="flex-1" style={{ color: p.done ? "var(--muted)" : "var(--parchment)", textDecoration: p.done ? "line-through" : "none" }}>
                  {p.text}
                </span>
                <button onClick={() => set({ prep: s.prep.filter((x) => x.id !== p.id) })} className="opacity-50 hover:opacity-100" style={{ color: "var(--muted)" }} aria-label="Retirer">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <form
        className="flex gap-1.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!text.trim()) return;
          set({ prep: [...s.prep, { id: uid(), kind, text: text.trim(), done: false }] });
          setText("");
        }}
      >
        <select value={kind} onChange={(ev) => setKind(ev.target.value)} className="rounded-md px-1.5 py-1 text-xs outline-none" style={{ ...inputStyle, background: "var(--panel)" }} aria-label="Type">
          {Object.entries(PREP_KINDS).map(([k, K]) => (
            <option key={k} value={k}>
              {K.icon} {K.label}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="Ex : le marchand est un espion de la Guilde"
          className="flex-1 min-w-0 rounded-md px-2 py-1 text-sm outline-none"
          style={{ ...inputStyle, background: "var(--panel)" }}
          aria-label="Élément à préparer"
        />
        <button className="rounded-md px-2.5 py-1 text-xs font-bold" style={{ background: "var(--gold)", color: "#1a1409" }}>
          Ajouter
        </button>
      </form>
      {left.length > 0 && s.prep.length > left.length && (
        <button
          onClick={() => carryOver(left.map((p) => ({ ...p, id: uid() })))}
          className="mt-2 inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--arcane)" }}
        >
          <Forward size={12} /> Reporter les {left.length} élément{left.length > 1 ? "s" : ""} non joué{left.length > 1 ? "s" : ""} dans une nouvelle session
        </button>
      )}
    </div>
  );
}
