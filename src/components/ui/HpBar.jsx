import { Shield } from "lucide-react";
import { clamp, hpColor } from "../../utils/helpers.js";

export default function HpBar({ e, small }) {
  const pct = e.hpMax > 0 ? clamp((e.hp / e.hpMax) * 100, 0, 100) : 0;
  return (
    <div>
      <div
        className={`w-full rounded-full overflow-hidden ${small ? "h-1.5" : "h-2.5"}`}
        style={{ background: "var(--well)", border: "1px solid var(--edge)" }}
      >
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: hpColor(e.hp, e.hpMax) }} />
      </div>
      {!small && (
        <div className="flex justify-between mt-1 text-xs" style={{ color: "var(--muted)" }}>
          <span>
            <b style={{ color: "var(--parchment)" }}>{e.hp}</b> / {e.hpMax} PV
            {e.tempHp > 0 && <span style={{ color: "var(--arcane)" }}> +{e.tempHp} temp</span>}
          </span>
          <span className="inline-flex items-center gap-1">
            <Shield size={11} /> CA {e.ac}
          </span>
        </div>
      )}
    </div>
  );
}
