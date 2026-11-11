import { Plus, Trash2, Swords } from "lucide-react";
import { newCombat } from "../../utils/helpers.js";

/** Liste des rencontres avec aperçu de la carte. */
export default function CombatList({ combats, setCombats, open }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
          Rencontres{" "}
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            ({combats.length})
          </span>
        </h2>
        <button
          onClick={() => {
            const c = newCombat();
            setCombats((p) => [...p, c]);
            open(c.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#1a1409" }}
        >
          <Plus size={15} /> Créer un combat
        </button>
      </div>

      {combats.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          <Swords size={32} className="mx-auto mb-3 opacity-50" />
          Aucune rencontre. Créez un combat, choisissez une carte et placez vos combattants.
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {combats.map((c) => (
            <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
              <button onClick={() => open(c.id)} className="block w-full text-left">
                <div
                  className="h-28 w-full relative"
                  style={{
                    background: c.map
                      ? `url(${c.map}) center/cover`
                      : "repeating-linear-gradient(0deg, var(--well) 0 29px, var(--edge) 29px 30px), repeating-linear-gradient(90deg, var(--well) 0 29px, var(--edge) 29px 30px)",
                  }}
                >
                  <span className="absolute bottom-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(10,8,5,.75)", color: "var(--muted)" }}>
                    {c.tokens.length} combattant{c.tokens.length > 1 ? "s" : ""}
                    {c.started ? ` · round ${c.round}` : ""}
                  </span>
                </div>
                <div className="p-3" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
                  {c.name}
                </div>
              </button>
              <div className="px-3 pb-3 -mt-1">
                <button
                  onClick={() => confirm(`Supprimer la rencontre « ${c.name} » ? Cette action est définitive.`) && setCombats((p) => p.filter((x) => x.id !== c.id))}
                  className="text-[11px] inline-flex items-center gap-1"
                  style={{ color: "var(--blood-l)" }}
                >
                  <Trash2 size={11} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
