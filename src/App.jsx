import { useState, useRef, useCallback, useEffect } from "react";
import { Users, Ghost, Skull, Swords, Crosshair, Download, Upload, AlertTriangle, Undo2, ScrollText, Map as MapIcon, MonitorPlay, X } from "lucide-react";
import { RACES, CLASSES, BACKGROUNDS } from "./data/reference.js";
import { uid, withLog, PLAYER_CHANNEL, openPlayerScreen } from "./utils/helpers.js";
import { useCampaign } from "./hooks/useCampaign.js";
import { RulesContext } from "./hooks/useRules.js";
import { useFolderBackup } from "./hooks/useFolderBackup.js";
import FolderButton from "./components/campaign/FolderButton.jsx";
import FolderImportDialog from "./components/campaign/FolderImportDialog.jsx";
import TextDialog from "./components/ui/TextDialog.jsx";
import Roster from "./components/entities/Roster.jsx";
import EntityEditor from "./components/entities/EntityEditor.jsx";
import CombatList from "./components/combat/CombatList.jsx";
import CombatView from "./components/combat/CombatView.jsx";
import DiceRoller from "./components/combat/DiceRoller.jsx";
import SessionsView from "./components/campaign/SessionsView.jsx";
import WorldView from "./components/campaign/WorldView.jsx";
import GlobalSearch from "./components/campaign/GlobalSearch.jsx";
import BackupsDialog from "./components/campaign/BackupsDialog.jsx";
import { inputStyle } from "./components/ui/form.jsx";

function TabBtn({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors whitespace-nowrap"
      style={{
        color: active ? "var(--gold)" : "var(--muted)",
        borderBottom: `2px solid ${active ? "var(--gold)" : "transparent"}`,
        fontWeight: active ? 700 : 400,
      }}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={15} /> {label}
      {count != null && <span className="text-[10px] opacity-70">({count})</span>}
    </button>
  );
}

export default function App() {
  const {
    entities,
    setEntities,
    combats,
    setCombats,
    sessions,
    setSessions,
    world,
    setWorld,
    settings,
    setSettings,
    updateEntity,
    loaded,
    loadError,
    saveState,
    exportCampaign,
    importCampaign,
    exportDue,
    lastExport,
    snoozeExport,
    undo,
    canUndo,
    campaigns,
    currentId,
    switchCampaign,
    createCampaign,
    renameCampaign,
    deleteCampaign,
    listBackups,
    restoreBackup,
    camp,
    readCampaign,
    addCampaigns,
  } = useCampaign();
  const folder = useFolderBackup({ loaded, currentId, camp, campaigns, readCampaign, addCampaigns });
  const [tab, setTab] = useState("pc");
  const [editingId, setEditingId] = useState(null);
  const [openCombatId, setOpenCombatId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [worldId, setWorldId] = useState(null);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [handout, setHandout] = useState(null); // document affiché sur l'écran joueurs
  const [ask, setAsk] = useState(null); // fenêtre de saisie : { title, initial, okLabel, onOk }
  const importRef = useRef(null);
  const channelRef = useRef(null);
  const handoutRef = useRef(null);

  const editing = entities.find((e) => e.id === editingId);
  const openCombat = combats.find((c) => c.id === openCombatId);

  const setCombat = useCallback(
    (fn) => setCombats((p) => p.map((c) => (c.id === openCombatId ? (typeof fn === "function" ? fn(c) : fn) : c))),
    [openCombatId, setCombats]
  );

  /* Documents montrés aux joueurs (l'écran joueurs les affiche par-dessus la carte) */
  handoutRef.current = handout;
  useEffect(() => {
    const ch = new BroadcastChannel(PLAYER_CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (ev) => ev.data === "hello" && ch.postMessage({ handout: handoutRef.current });
    return () => ch.close();
  }, []);
  const showHandout = useCallback((h) => {
    setHandout(h);
    channelRef.current?.postMessage({ handout: h });
    if (h) openPlayerScreen();
  }, []);

  /* Ctrl+Z (⌘Z) annule, sauf dans un champ de saisie qui a sa propre annulation */
  useEffect(() => {
    const onKey = (ev) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.key.toLowerCase() !== "z") return;
      if (ev.target.matches?.("input, textarea, select")) return;
      ev.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const resetView = () => {
    setEditingId(null);
    setOpenCombatId(null);
    setSessionId(null);
    setWorldId(null);
  };

  const current = campaigns.find((c) => c.id === currentId);
  const onCampaignMenu = async (v) => {
    if (v === "__new") {
      setAsk({
        title: "Nom de la nouvelle campagne",
        initial: "Nouvelle campagne",
        okLabel: "Créer",
        onOk: async (name) => {
          await createCampaign(name);
          resetView();
        },
      });
      return;
    } else if (v === "__rename") {
      setAsk({ title: "Renommer la campagne", initial: current?.name, okLabel: "Renommer", onOk: renameCampaign });
      return;
    } else if (v === "__rules") {
      const next = settings.rules === "2024" ? "2014" : "2024";
      if (confirm(`Passer cette campagne aux règles ${next} ?\n\nCela change les textes des états, l'épuisement et la récupération des dés de vie au repos long.`)) setSettings((s) => ({ ...s, rules: next }));
      return;
    } else if (v === "__backups") {
      setBackupsOpen(true);
      return;
    } else if (v === "__delete") {
      if (campaigns.length < 2) return alert("C'est votre seule campagne : créez-en une autre avant de supprimer celle-ci.");
      if (!confirm(`Supprimer définitivement la campagne « ${current?.name} » et tout son contenu ?\n\nExportez-la d'abord si vous voulez la garder.`)) return;
      await deleteCampaign();
    } else {
      await switchCampaign(v);
    }
    resetView();
  };

  /* Résultat de la recherche globale → on ouvre le bon onglet et l'élément */
  const goTo = (kind, id) => {
    if (kind === "entity") {
      setTab(entities.find((e) => e.id === id)?.kind || "pc");
      setOpenCombatId(null);
      setEditingId(id);
    } else if (kind === "session") {
      setTab("sessions");
      setSessionId(id);
    } else if (kind === "world") {
      setTab("world");
      setWorldId(id);
    } else {
      setTab("combat");
      setOpenCombatId(id);
    }
  };

  /* Onglets : [id, icône, libellé, libellé court (barre du bas), nombre] */
  const tabs = [
    ["pc", Users, "Personnages", "Persos", entities.filter((e) => e.kind === "pc").length],
    ["npc", Ghost, "PNJ", "PNJ", entities.filter((e) => e.kind === "npc").length],
    ["monster", Skull, "Monstres", "Monstres", entities.filter((e) => e.kind === "monster").length],
    ["combat", Swords, "Combats", "Combats", combats.length],
    ["sessions", ScrollText, "Sessions", "Sessions", sessions.length],
    ["world", MapIcon, "Monde", "Monde", world.length],
  ];

  /* Boutons d'action de l'en-tête (affichés en haut sur ordinateur, en 2e ligne sur téléphone) */
  const actions = (
    <>
      <FolderButton folder={folder} />
      <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-md disabled:opacity-35" style={inputStyle} title="Annuler la dernière modification (Ctrl+Z)" aria-label="Annuler">
        <Undo2 size={16} />
      </button>
      <button onClick={exportCampaign} className="p-1.5 rounded-md" style={inputStyle} title="Exporter la campagne (JSON)" aria-label="Exporter la campagne">
        <Download size={16} />
      </button>
      <button onClick={() => importRef.current?.click()} className="p-1.5 rounded-md" style={inputStyle} title="Importer une campagne (JSON) — elle s'ajoute à vos campagnes" aria-label="Importer une campagne">
        <Upload size={16} />
      </button>
    </>
  );

  const tabProps = (id) => ({
    active: tab === id,
    onClick: () => {
      setTab(id);
      setOpenCombatId(null);
    },
  });

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: loadError ? "var(--blood-l)" : "var(--muted)", fontFamily: "var(--display)" }}>
        {loadError ? `Impossible d'ouvrir la campagne enregistrée (${loadError}). Rien n'a été effacé : rechargez la page ou essayez un autre navigateur.` : "Ouverture du grimoire…"}
      </div>
    );
  }

  const days = lastExport ? Math.floor((Date.now() - lastExport) / 86400000) : 0;

  return (
    <RulesContext.Provider value={settings.rules}>
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--parchment)", fontFamily: "var(--body)" }}>
      {/* Listes de suggestions : saisie libre + propositions */}
      <datalist id="races">{RACES.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="classes">{CLASSES.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="backgrounds">{BACKGROUNDS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="entity-names">{entities.map((e) => <option key={e.id} value={e.name} />)}</datalist>

      {/* En-tête */}
      <header className="sticky top-0 z-30" style={{ background: "rgba(20,17,12,.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--edge)" }}>
        {saveState === "error" && (
          <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--blood)", color: "var(--parchment)" }} role="alert">
            <AlertTriangle size={14} /> Sauvegarde impossible : vos dernières modifications ne sont pas enregistrées.
            <button onClick={exportCampaign} className="underline">
              Exporter maintenant
            </button>
          </div>
        )}
        {folder.permission === "prompt" && (
          <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-xs" style={{ background: "var(--chip)", color: "var(--parchment)", borderBottom: "1px solid var(--edge)" }} role="status">
            Le navigateur demande de ré-autoriser le dossier de sauvegarde « {folder.name} ».
            <button onClick={folder.reconnect} className="underline font-semibold" style={{ color: "var(--gold)" }}>
              Autoriser
            </button>
          </div>
        )}
        {saveState !== "error" && exportDue && folder.permission !== "granted" && (
          <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 text-xs" style={{ background: "var(--chip)", color: "var(--parchment)", borderBottom: "1px solid var(--edge)" }} role="status">
            <Download size={13} style={{ color: "var(--gold)" }} /> Dernier export de « {current?.name} » il y a {days} jours : gardez une copie hors du navigateur.
            <button onClick={exportCampaign} className="underline font-semibold" style={{ color: "var(--gold)" }}>
              Exporter
            </button>
            <button onClick={snoozeExport} className="underline" style={{ color: "var(--muted)" }}>
              Plus tard
            </button>
          </div>
        )}
        {handout && (
          <div className="flex items-center justify-center gap-2 px-3 py-1 text-xs" style={{ background: "rgba(139,157,212,.15)", color: "var(--arcane)" }}>
            <MonitorPlay size={13} /> Montré aux joueurs : « {handout.title} »
            <button onClick={() => showHandout(null)} className="inline-flex items-center gap-1 underline">
              <X size={12} /> Masquer
            </button>
          </div>
        )}
        <div className="max-w-6xl mx-auto px-3 md:px-5 pt-2 md:pt-3">
          <div className="flex items-center gap-2 md:gap-3">
            <Crosshair size={20} className="shrink-0" style={{ color: "var(--gold)" }} />
            <h1 className="hidden md:block text-lg lg:text-xl tracking-wide whitespace-nowrap" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
              Table du Maître
              <span className="hidden lg:inline">
                {" "}
                <span style={{ color: "var(--gold)" }}>·</span>{" "}
              </span>
              <span className="text-sm hidden lg:inline" style={{ color: "var(--muted)" }} title="Édition des règles de cette campagne (menu de campagne pour changer)">
                D&D 5e · {settings.rules}
              </span>
            </h1>
            {/* Sur téléphone, le nom de la campagne tient lieu de titre */}
            <select
              value={currentId}
              onChange={(ev) => onCampaignMenu(ev.target.value)}
              className="min-w-0 flex-1 md:flex-initial md:max-w-[13rem] rounded-md px-2 py-1.5 md:py-1 text-sm md:text-xs outline-none truncate"
              style={{ ...inputStyle, fontFamily: "var(--display)" }}
              aria-label="Campagne"
              title={`Changer de campagne (règles ${settings.rules})`}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="__new">＋ Nouvelle campagne…</option>
              <option value="__rename">✎ Renommer…</option>
              <option value="__rules">⚖ Règles {settings.rules} → passer en {settings.rules === "2024" ? "2014" : "2024"}…</option>
              <option value="__backups">⟲ Copies de secours…</option>
              <option value="__delete">✕ Supprimer…</option>
            </select>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-[10px] hidden lg:block" style={{ color: "var(--muted)" }}>
                {saveState === "saving" ? "Sauvegarde…" : saveState === "saved" ? "Campagne sauvegardée" : ""}
              </span>
              <div className="hidden md:flex items-center gap-2">{actions}</div>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) importCampaign(f).then(resetView);
                  ev.target.value = "";
                }}
              />
              <DiceRoller onRoll={tab === "combat" && openCombat ? (msg) => setCombat((c) => withLog(c, msg)) : undefined} />
            </div>
          </div>
          {/* Téléphone : recherche et actions sur une seconde ligne */}
          <div className="flex md:hidden items-center gap-1.5 mt-2 pb-2">
            <div className="flex-1 min-w-0">
              <GlobalSearch entities={entities} sessions={sessions} world={world} combats={combats} onPick={goTo} full />
            </div>
            {actions}
          </div>
          {/* Tablette et ordinateur : onglets en haut */}
          <div className="hidden md:flex items-end gap-2 mt-1">
            <nav className="flex gap-1 flex-1 min-w-0">
              {tabs.map(([id, icon, label, , count]) => (
                <TabBtn key={id} {...tabProps(id)} icon={icon} label={label} count={count} />
              ))}
            </nav>
            <div className="pb-1.5">
              <GlobalSearch entities={entities} sessions={sessions} world={world} combats={combats} onPick={goTo} />
            </div>
          </div>
        </div>
      </header>

      {/* Téléphone : onglets en bas de l'écran, à portée de pouce */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-6"
        style={{ background: "rgba(20,17,12,.97)", borderTop: "1px solid var(--edge)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map(([id, Icon, , short, count]) => {
          const { active, onClick } = tabProps(id);
          return (
            <button
              key={id}
              onClick={onClick}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] leading-none"
              style={{ color: active ? "var(--gold)" : "var(--muted)", fontWeight: active ? 700 : 400 }}
              aria-current={active ? "page" : undefined}
              aria-label={`${short} (${count})`}
            >
              {active && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full" style={{ background: "var(--gold)" }} />}
              <Icon size={19} />
              {short}
            </button>
          );
        })}
      </nav>

      <main className="max-w-6xl mx-auto px-3 md:px-5 py-4 md:py-5 pb-24 md:pb-28">
        {["pc", "npc", "monster"].includes(tab) && <Roster kind={tab} entities={entities} setEntities={setEntities} openEditor={setEditingId} />}
        {tab === "combat" && !openCombat && <CombatList combats={combats} setCombats={setCombats} open={setOpenCombatId} />}
        {tab === "combat" && openCombat && (
          <CombatView
            combat={openCombat}
            setCombat={setCombat}
            entities={entities}
            updateEntity={updateEntity}
            back={() => setOpenCombatId(null)}
            openEditor={setEditingId}
          />
        )}
        {tab === "sessions" && <SessionsView sessions={sessions} setSessions={setSessions} entities={entities} updateEntity={updateEntity} selectedId={sessionId} select={setSessionId} />}
        {tab === "world" && <WorldView world={world} setWorld={setWorld} selectedId={worldId} select={setWorldId} showHandout={showHandout} />}
      </main>

      {editing && (
        <EntityEditor
          key={editing.id}
          e={editing}
          entities={entities}
          openEditor={setEditingId}
          showHandout={showHandout}
          update={(patch) => updateEntity(editing.id, patch)}
          onClose={() => setEditingId(null)}
          onDelete={() => {
            const n = combats.filter((c) => c.tokens.some((t) => t.entityId === editing.id)).length;
            const where = n ? ` Ses pions seront aussi retirés de ${n} combat${n > 1 ? "s" : ""}.` : "";
            if (!confirm(`Supprimer « ${editing.name} » ?${where} Cette action est définitive.`)) return;
            setEntities((p) =>
              p.filter((x) => x.id !== editing.id).map((x) => (x.relations?.some((r) => r.targetId === editing.id) ? { ...x, relations: x.relations.filter((r) => r.targetId !== editing.id) } : x))
            );
            setCombats((p) => p.map((c) => ({ ...c, tokens: c.tokens.filter((t) => t.entityId !== editing.id) })));
            setEditingId(null);
          }}
          onDuplicate={() => {
            const copy = { ...editing, id: uid(), name: editing.name + " (copie)" };
            setEntities((p) => [...p, copy]);
            setEditingId(copy.id);
          }}
        />
      )}

      {backupsOpen && <BackupsDialog listBackups={listBackups} restore={restoreBackup} onClose={() => setBackupsOpen(false)} />}
      {ask && <TextDialog {...ask} onClose={() => setAsk(null)} />}
      {folder.found && <FolderImportDialog found={folder.found} onDone={folder.finishImport} />}
    </div>
    </RulesContext.Provider>
  );
}
