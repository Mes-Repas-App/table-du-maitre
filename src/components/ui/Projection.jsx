import { useEffect, useRef, useState } from "react";

/** Titre, image (pivotée et annotée) et texte : la mise en page commune à l'écran du MJ et à l'écran joueurs */
export function HandoutStage({ handout, overlay, pen, onChange }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center gap-3 p-3 md:p-6">
      <h1 className="text-2xl md:text-4xl text-center" style={{ fontFamily: "var(--display)", color: "var(--gold)" }}>
        {handout.title}
      </h1>
      {handout.image && (
        <div className="flex-1 min-h-0 w-full">
          <Projection key={handout.image} image={handout.image} title={handout.title} rotation={overlay?.rotation} strokes={overlay?.strokes} pen={pen} onChange={onChange} />
        </div>
      )}
      {handout.text && (
        <p className={`max-w-2xl whitespace-pre-wrap text-lg leading-relaxed text-center overflow-y-auto ${handout.image ? "max-h-[25vh]" : "my-auto"}`} style={{ color: "var(--parchment)", fontFamily: "var(--display)" }}>
          {handout.text}
        </p>
      )}
    </div>
  );
}

/**
 * Image montrée aux joueurs, pivotée et annotée, ajustée à la place disponible.
 * Même rendu sur l'écran du MJ (qui dessine : `pen` + `onChange`) et sur l'écran joueurs (lecture seule).
 * Les traits sont en pixels de l'image d'origine : ils restent en place quelle que soit la taille d'écran ou la rotation.
 */
export default function Projection({ image, title, rotation = 0, strokes = [], pen, onChange }) {
  const box = useRef(null);
  const svg = useRef(null);
  const drawing = useRef(false);
  const latest = useRef(strokes);
  latest.current = strokes;
  const [size, setSize] = useState(null); // place disponible
  const [nat, setNat] = useState(null); // taille d'origine de l'image

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const turned = rotation % 180 !== 0;
  const scale = size && nat ? Math.min(size.w / (turned ? nat.h : nat.w), size.h / (turned ? nat.w : nat.h)) : 0;
  const long = nat ? Math.max(nat.w, nat.h) : 1;

  // Écran → pixels de l'image (tient compte de la rotation)
  const at = (ev) => {
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.current.getScreenCTM().inverse());
    return [Math.round(p.x), Math.round(p.y)];
  };
  const down = (ev) => {
    if (!pen || ev.button > 0) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drawing.current = true;
    const p = at(ev);
    onChange([...latest.current, { color: pen.color, width: pen.width, points: [p, p] }]);
  };
  const move = (ev) => {
    if (!drawing.current) return;
    const list = latest.current;
    const last = list[list.length - 1];
    const p = at(ev);
    const [qx, qy] = last.points[last.points.length - 1];
    if (Math.hypot(p[0] - qx, p[1] - qy) < 2 / scale) return; // moins de 2 px à l'écran : inutile
    onChange([...list.slice(0, -1), { ...last, points: [...last.points, p] }]);
  };
  const up = () => (drawing.current = false);

  return (
    <div ref={box} className="relative w-full h-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: nat ? nat.w * scale : undefined,
          height: nat ? nat.h * scale : undefined,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transition: "transform .3s",
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <img
          src={image}
          alt={title || ""}
          draggable={false}
          onLoad={(ev) => setNat({ w: ev.currentTarget.naturalWidth, h: ev.currentTarget.naturalHeight })}
          className="block w-full h-full select-none rounded-lg shadow-2xl"
          style={{ border: "1px solid var(--edge)" }}
        />
        {nat && (
          <svg
            ref={svg}
            viewBox={`0 0 ${nat.w} ${nat.h}`}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: pen ? "none" : undefined, cursor: pen ? "crosshair" : undefined }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-hidden="true"
          >
            {strokes.map((s, i) => (
              <polyline key={i} points={s.points.join(" ")} fill="none" stroke={s.color} strokeWidth={s.width * long} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
