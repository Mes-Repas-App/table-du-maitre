import { useRef, useEffect, useState } from "react";
import { X, Trash2, Copy, Upload, Zap, Moon, Sun, Coffee, Eye, Star, MonitorPlay } from "lucide-react";
import { ABILITIES, KINDS, SKILLS } from "../../data/reference.js";
import { mod, fmtMod, clamp, resizeImage, profBonus } from "../../utils/helpers.js";
import { Field, NumInput, inputCls, inputStyle } from "../ui/form.jsx";
import Tip from "../ui/Tip.jsx";
import Portrait from "../ui/Portrait.jsx";
import HpControls from "./HpControls.jsx";
import ConditionPicker from "./ConditionPicker.jsx";
import Resources from "./Resources.jsx";
import Inventory from "./Inventory.jsx";
import Spells from "./Spells.jsx";
import Relations from "./Relations.jsx";

const PROF_LABELS = ["", "maîtrise", "expertise"];
const TABS = [
  ["sheet", "Fiche"],
  ["spells", "Sorts"],
  ["gear", "Inventaire"],
  ["profile", "Profil & relations"],
];

/** Modale de fiche complète : identité, caractéristiques, maîtrises, PV, états, ressources,
    sorts, inventaire, profil et relations. */
export default function EntityEditor({ e, update, onClose, onDelete, onDuplicate, entities, openEditor, showHandout }) {
  const fileRef = useRef(null);
  const [tab, setTab] = useState("sheet");
  const setAb = (k, v) => update({ abilities: { ...e.abilities, [k]: v } });
  const initiative = e.initBonus ?? mod(e.abilities.dex);
  const pb = profBonus(e);
  const skillVal = (id, ab) => mod(e.abilities[ab]) + pb * (e.skills?.[id] || 0);
  const restore = (kinds) => (e.resources || []).map((r) => (kinds.includes(r.reset) ? { ...r, cur: r.max } : r));

  /* Échap ferme la fiche (en priorité sur les autres raccourcis de la page) */
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto"
      style={{ background: "rgba(10,8,5,.8)", backdropFilter: "blur(3px)" }}
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={e.name} className="w-full max-w-3xl rounded-xl my-4 shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        {/* En-tête : portrait cliquable, nom, actions */}
        <div className="flex items-center gap-3 p-4 pb-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <button onClick={() => fileRef.current?.click()} className="relative group/img shrink-0" title="Changer l'image">
            <Portrait e={e} size={64} />
            <span className="absolute inset-0 rounded-full hidden group-hover/img:flex items-center justify-center text-white" style={{ background: "rgba(0,0,0,.55)" }}>
              <Upload size={18} />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              if (!f) return;
              try {
                update({ image: (await resizeImage(f, 320)).data });
              } catch {
                alert("Impossible de lire cette image.");
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <input
              value={e.name}
              onChange={(ev) => update({ name: ev.target.value })}
              className="w-full bg-transparent outline-none text-xl md:text-2xl"
              style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}
              aria-label="Nom"
            />
            <span className="text-xs uppercase tracking-widest" style={{ color: KINDS[e.kind].ring }}>
              {KINDS[e.kind].single}
            </span>
          </div>
          {e.kind === "pc" && (
            <button
              onClick={() => update({ inspiration: !e.inspiration })}
              className="p-2 rounded-md"
              style={{ ...inputStyle, color: e.inspiration ? "var(--gold)" : "var(--muted)", borderColor: e.inspiration ? "var(--gold)" : "var(--edge)" }}
              title={e.inspiration ? "Inspiration (cliquer pour la dépenser)" : "Donner l'inspiration"}
              aria-pressed={!!e.inspiration}
            >
              <Star size={15} fill={e.inspiration ? "currentColor" : "none"} />
            </button>
          )}
          <button onClick={() => showHandout({ title: e.name, image: e.image, text: "" })} className="p-2 rounded-md" style={inputStyle} title="Montrer le portrait aux joueurs">
            <MonitorPlay size={15} />
          </button>
          <button onClick={onDuplicate} className="p-2 rounded-md" style={inputStyle} title="Dupliquer">
            <Copy size={15} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-md" style={{ ...inputStyle, color: "var(--blood-l)" }} title="Supprimer">
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} className="p-2 rounded-md" style={inputStyle} title="Fermer (Échap)">
            <X size={15} />
          </button>
        </div>

        <nav className="flex gap-1 px-4 pt-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--edge)" }}>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-3 py-1.5 text-sm whitespace-nowrap"
              style={{ color: tab === k ? "var(--gold)" : "var(--muted)", borderBottom: `2px solid ${tab === k ? "var(--gold)" : "transparent"}`, fontWeight: tab === k ? 700 : 400 }}
              aria-current={tab === k ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "spells" && (
          <div className="p-4">
            <Spells e={e} update={update} edit />
          </div>
        )}
        {tab === "gear" && (
          <div className="p-4">
            <Inventory e={e} update={update} />
          </div>
        )}
        {tab === "profile" && (
          <div className="p-4 grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {e.kind === "pc" && (
                <Field label="Points d'expérience">
                  <NumInput min="0" value={e.xp || 0} onChange={(v) => update({ xp: Math.max(0, v) })} className={inputCls} style={inputStyle} />
                </Field>
              )}
              {[
                ["languages", "Langues", "Commun, elfique…"],
                ["senses", "Sens", "Vision dans le noir 18 m…"],
                ["resistances", "Résistances", "feu, poison…"],
                ["immunities", "Immunités", "nécrotique, état empoisonné…"],
                ["vulnerabilities", "Vulnérabilités", "radiant…"],
              ].map(([k, label, ph]) => (
                <Field key={k} label={label}>
                  <input value={e[k] || ""} onChange={(ev) => update({ [k]: ev.target.value })} placeholder={ph} className={inputCls} style={inputStyle} />
                </Field>
              ))}
            </div>
            <Relations e={e} update={update} entities={entities} openEditor={openEditor} />
          </div>
        )}

        <div className={tab === "sheet" ? "p-4 grid md:grid-cols-2 gap-4" : "hidden"}>
          {/* Colonne gauche : identité + PV + ressources + notes */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Race / Espèce">
                <input list="races" value={e.race} onChange={(ev) => update({ race: ev.target.value })} className={inputCls} style={inputStyle} placeholder="Elfe, Gobelin…" />
              </Field>
              {e.kind === "monster" ? (
                <Field label="Facteur de puissance">
                  <input value={e.cr} onChange={(ev) => update({ cr: ev.target.value })} className={inputCls} style={inputStyle} placeholder="FP 1/2, 3…" />
                </Field>
              ) : (
                <Field label="Classe">
                  <input list="classes" value={e.clazz} onChange={(ev) => update({ clazz: ev.target.value })} className={inputCls} style={inputStyle} />
                </Field>
              )}
              <Field label="Historique">
                <input list="backgrounds" value={e.background} onChange={(ev) => update({ background: ev.target.value })} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Niveau">
                <NumInput min="1" max="20" value={e.level} onChange={(v) => update({ level: clamp(v, 1, 20) })} className={inputCls} style={inputStyle} />
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Field label="PV max">
                <NumInput value={e.hpMax} onChange={(m) => update({ hpMax: Math.max(0, m), hp: Math.min(e.hp, Math.max(0, m)) })} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="PV actuels">
                <NumInput value={e.hp} onChange={(v) => update({ hp: clamp(v, 0, e.hpMax) })} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="CA">
                <NumInput value={e.ac} onChange={(v) => update({ ac: v })} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Vitesse (m)">
                <NumInput value={e.speed} onChange={(v) => update({ speed: v })} className={inputCls} style={inputStyle} />
              </Field>
            </div>

            <HpControls e={e} update={update} />

            <Resources e={e} update={update} edit />

            <Field label="Attaques & capacités">
              <textarea
                rows={3}
                value={e.attacks}
                onChange={(ev) => update({ attacks: ev.target.value })}
                placeholder={"Épée longue : +5, 1d8+3 tranchant\nArc court : +4, 1d6+2 perforant"}
                className={inputCls}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
            <Field label="Notes (histoire, malédictions, objets…)">
              <textarea rows={3} value={e.notes} onChange={(ev) => update({ notes: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
          </div>

          {/* Colonne droite : caractéristiques, maîtrises, états */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map(([k, abbr, full]) => {
                const save = mod(e.abilities[k]) + (e.saves?.[k] ? pb : 0);
                return (
                  <div key={k} className="rounded-lg p-2 text-center w-full" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
                    <Tip text={full}>
                      <span tabIndex={0} className="text-[10px] uppercase tracking-widest cursor-help" style={{ color: "var(--muted)" }}>
                        {abbr}
                      </span>
                    </Tip>
                    <NumInput
                      min="1"
                      max="30"
                      value={e.abilities[k]}
                      onChange={(v) => setAb(k, clamp(v, 1, 30))}
                      className="w-full bg-transparent text-center text-lg font-bold outline-none"
                      style={{ color: "var(--parchment)" }}
                      aria-label={full}
                    />
                    <div className="text-sm" style={{ color: "var(--gold)", fontFamily: "var(--display)" }}>
                      {fmtMod(mod(e.abilities[k]))}
                    </div>
                    <button
                      onClick={() => update({ saves: { ...e.saves, [k]: e.saves?.[k] ? 0 : 1 } })}
                      className="mt-1 w-full rounded text-[10px] py-0.5"
                      style={{
                        background: e.saves?.[k] ? "rgba(201,162,39,.18)" : "transparent",
                        border: `1px solid ${e.saves?.[k] ? "var(--gold)" : "var(--edge)"}`,
                        color: e.saves?.[k] ? "var(--gold)" : "var(--muted)",
                      }}
                      title="Cliquer pour la maîtrise du jet de sauvegarde"
                    >
                      JS {fmtMod(save)}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg p-2" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
              <Zap size={14} style={{ color: "var(--gold)" }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Initiative
              </span>
              <NumInput
                value={initiative}
                onChange={(v) => update({ initBonus: v })}
                className="w-12 rounded-md px-1 py-0.5 text-sm text-center outline-none"
                style={{ ...inputStyle, background: "var(--panel)" }}
                aria-label="Bonus d'initiative"
              />
              {e.initBonus != null && e.initBonus !== mod(e.abilities.dex) && (
                <button className="text-[10px] underline" style={{ color: "var(--muted)" }} onClick={() => update({ initBonus: null })}>
                  auto (DEX)
                </button>
              )}
              <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
                Maîtrise <b style={{ color: "var(--gold)" }}>{fmtMod(pb)}</b>
              </span>
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }} title="Perception passive : 10 + Perception">
                <Eye size={12} /> <b style={{ color: "var(--parchment)" }}>{10 + skillVal("perception", "sag")}</b>
              </span>
            </div>

            <div>
              <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
                Compétences — clic : maîtrise, puis expertise
              </span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {SKILLS.map(([id, label, ab]) => {
                  const lvl = e.skills?.[id] || 0;
                  return (
                    <button
                      key={id}
                      onClick={() => update({ skills: { ...e.skills, [id]: (lvl + 1) % 3 } })}
                      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-left hover:bg-white/5"
                      style={{ color: lvl ? "var(--parchment)" : "var(--muted)" }}
                      title={PROF_LABELS[lvl] || "pas de maîtrise"}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ border: "1px solid var(--gold)", background: lvl === 2 ? "var(--gold)" : lvl ? "rgba(201,162,39,.45)" : "transparent" }} />
                      <span className="truncate flex-1">{label}</span>
                      <b style={{ color: lvl ? "var(--gold)" : "var(--muted)" }}>{fmtMod(skillVal(id, ab))}</b>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
                États & effets — survolez pour la règle
              </span>
              <ConditionPicker e={e} update={update} />
            </div>

            <div className="flex gap-2 pt-1">
              <Tip text="Repos court : récupère les ressources marquées « repos court »." wide>
                <button
                  onClick={() => update({ resources: restore(["short"]) })}
                  className="flex-1 rounded-md px-2 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  style={inputStyle}
                >
                  <Coffee size={13} /> Repos court
                </button>
              </Tip>
              <Tip text="Repos long : PV au maximum, PV temporaires perdus, -1 niveau d'épuisement, ressources et emplacements de sorts récupérés." wide>
                <button
                  onClick={() =>
                    update({
                      hp: e.hpMax,
                      tempHp: 0,
                      exhaustion: Math.max(0, (e.exhaustion || 0) - 1),
                      deathSaves: { ok: 0, ko: 0 },
                      resources: restore(["short", "long"]),
                      slots: Object.fromEntries(Object.entries(e.slots || {}).map(([l, s]) => [l, { ...s, cur: s.max }])),
                    })
                  }
                  className="flex-1 rounded-md px-2 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  style={inputStyle}
                >
                  <Moon size={13} /> Repos long
                </button>
              </Tip>
              <Tip text="Purge tous les états, malus et l'épuisement du personnage." wide>
                <button
                  onClick={() => update({ conditions: [], customConditions: [], exhaustion: 0 })}
                  className="flex-1 rounded-md px-2 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  style={inputStyle}
                >
                  <Sun size={13} /> Purger
                </button>
              </Tip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
