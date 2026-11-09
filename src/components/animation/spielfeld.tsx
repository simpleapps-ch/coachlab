import type { Animation } from "@/lib/uebung-schema";
import { alleZustaende, massstab, pfeile, type Pfeil, type Punkt, type Zustand } from "./engine";

export { massstab };

/**
 * Zeichnet Feld, Objekte und Pfeile als SVG. Gilt für alle Vereine gleich:
 * Teamfarben, Spielergrösse und Pfeilstil sind hier fest definiert, nie pro Übung.
 */

export const TEAMFARBEN = {
  A: { fuellung: "#2563eb", schrift: "#ffffff", name: "Team A" },
  B: { fuellung: "#f59e0b", schrift: "#1f2937", name: "Team B" },
  C: { fuellung: "#16a34a", schrift: "#ffffff", name: "Team C" },
  N: { fuellung: "#9ca3af", schrift: "#111827", name: "Neutral" },
} as const;

const RAND = 1.6; // Meter um das Feld herum
const SPIELER_R = 0.62;
const BALL_R = 0.3;

function wellenPfad(von: Punkt, nach: Punkt, m = 1): string {
  const dx = nach.x - von.x;
  const dy = nach.y - von.y;
  const laenge = Math.hypot(dx, dy);
  if (laenge < 0.5) return `M${von.x},${von.y} L${nach.x},${nach.y}`;
  const nx = -dy / laenge;
  const ny = dx / laenge;
  const wellen = Math.max(2, Math.round(laenge / (1.4 * m)));
  const amp = 0.28 * m;
  const punkte: string[] = [`M${von.x},${von.y}`];
  const schritte = wellen * 8;
  for (let i = 1; i <= schritte; i++) {
    const t = i / schritte;
    // am Ende gerade auslaufen, damit die Pfeilspitze sauber sitzt
    const daempfung = t > 0.85 ? (1 - t) / 0.15 : 1;
    const a = Math.sin(t * wellen * Math.PI * 2) * amp * daempfung;
    punkte.push(`L${(von.x + dx * t + nx * a).toFixed(3)},${(von.y + dy * t + ny * a).toFixed(3)}`);
  }
  return punkte.join(" ");
}

/** Pfeil kürzen, damit er nicht im Spielerkreis endet. */
function kuerzen(von: Punkt, nach: Punkt, start: number, ende: number): [Punkt, Punkt] {
  const dx = nach.x - von.x;
  const dy = nach.y - von.y;
  const l = Math.hypot(dx, dy) || 1;
  if (l < start + ende + 0.2) return [von, nach];
  return [
    { x: von.x + (dx / l) * start, y: von.y + (dy / l) * start },
    { x: nach.x - (dx / l) * ende, y: nach.y - (dy / l) * ende },
  ];
}

function PfeilSvg({ p, nummer, blass, m }: { p: Pfeil; nummer?: number; blass?: boolean; m: number }) {
  const [a, b] = kuerzen(p.von, p.nach, (SPIELER_R + 0.1) * m, p.art === "schuss" ? 0.1 : (SPIELER_R + 0.15) * m);
  const gemeinsam = {
    fill: "none",
    stroke: "#ffffff",
    strokeLinecap: "round" as const,
    opacity: blass ? 0.55 : 0.95,
    markerEnd: "url(#pfeilspitze)",
  };
  const linie =
    p.art === "dribbling" ? (
      <path d={wellenPfad(a, b, m)} strokeWidth={0.12 * m} {...gemeinsam} />
    ) : (
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        strokeWidth={(p.art === "schuss" ? 0.22 : 0.12) * m}
        strokeDasharray={p.art === "pass" ? `${0.45 * m} ${0.3 * m}` : undefined}
        {...gemeinsam}
      />
    );
  return (
    <g>
      {linie}
      {nummer !== undefined ? (
        <g transform={`translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2}) scale(${m})`}>
          <circle r={0.42} fill="#111827" opacity={0.8} />
          <text fontSize={0.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700}>
            {nummer}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export function Spielfeld({
  animation,
  zustand,
  pfeile = [],
  pfeilNummern,
  titel,
}: {
  animation: Animation;
  zustand: Zustand;
  pfeile?: Pfeil[];
  /** Für die Skizze: Schrittnummer je Pfeil. */
  pfeilNummern?: number[];
  titel?: string;
}) {
  const { breite, laenge } = animation.feld;
  const vb = `${-RAND} ${-RAND} ${breite + 2 * RAND} ${laenge + 2 * RAND}`;
  const streifen = Math.max(4, Math.round(laenge / 4));
  const m = massstab(breite, laenge);

  return (
    <svg viewBox={vb} role="img" aria-label={titel ?? "Übungsanimation"} className="block h-auto w-full">
      <defs>
        <marker id="pfeilspitze" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#ffffff" />
        </marker>
      </defs>

      {/* Rasen mit Mähstreifen */}
      <rect x={-RAND} y={-RAND} width={breite + 2 * RAND} height={laenge + 2 * RAND} fill="#2f7d3b" rx={0.6} />
      {Array.from({ length: streifen }, (_, i) =>
        i % 2 === 0 ? (
          <rect key={i} x={-RAND} y={-RAND + (i * (laenge + 2 * RAND)) / streifen} width={breite + 2 * RAND} height={(laenge + 2 * RAND) / streifen} fill="#2a7335" />
        ) : null,
      )}
      <rect x={0} y={0} width={breite} height={laenge} fill="none" stroke="#e8f5e9" strokeWidth={0.1} opacity={0.85} />
      {animation.feld.ansicht === "ganzfeld" ? (
        <line x1={0} y1={laenge / 2} x2={breite} y2={laenge / 2} stroke="#e8f5e9" strokeWidth={0.1} opacity={0.6} />
      ) : null}

      {/* Tore und Hütchen */}
      {animation.objekte.map((o) => {
        const p = zustand.pos[o.id];
        if (!p) return null;
        if (o.typ === "tor") {
          const quer = o.ausrichtung === "oben" || o.ausrichtung === "unten";
          const tiefe = 0.9;
          const w = quer ? o.breite : tiefe;
          const h = quer ? tiefe : o.breite;
          const x = quer ? p.x - o.breite / 2 : o.ausrichtung === "links" ? p.x - tiefe : p.x;
          const y = quer ? (o.ausrichtung === "oben" ? p.y - tiefe : p.y) : p.y - o.breite / 2;
          return (
            <rect key={o.id} x={x} y={y} width={w} height={h} fill="#ffffff" fillOpacity={0.15} stroke="#ffffff" strokeWidth={0.14} />
          );
        }
        if (o.typ === "huetchen") {
          return (
            <path key={o.id} transform={`translate(${p.x},${p.y}) scale(${m})`} d="M0,-0.42 L0.36,0.26 L-0.36,0.26 Z" fill="#fb923c" stroke="#9a3412" strokeWidth={0.05} />
          );
        }
        return null;
      })}

      {/* Pfeile unter den Spielern */}
      {pfeile.map((p, i) => (
        <PfeilSvg key={i} p={p} nummer={pfeilNummern?.[i]} blass={pfeilNummern !== undefined} m={m} />
      ))}

      {/* Spieler */}
      {animation.objekte.map((o) => {
        if (o.typ !== "spieler") return null;
        const p = zustand.pos[o.id];
        const farbe = TEAMFARBEN[o.team];
        return (
          <g key={o.id} transform={`translate(${p.x},${p.y}) scale(${m})`}>
            <circle r={SPIELER_R} fill={farbe.fuellung} stroke={o.rolle === "torhueter" ? "#111827" : "#ffffff"} strokeWidth={o.rolle === "torhueter" ? 0.16 : 0.08} />
            <text fontSize={0.52} textAnchor="middle" dominantBaseline="central" fill={farbe.schrift} fontWeight={700} fontFamily="system-ui, sans-serif">
              {o.id.length > 3 ? o.id.slice(0, 3) : o.id}
            </text>
          </g>
        );
      })}

      {/* Ball, beim Spieler leicht versetzt vor den Füssen */}
      {zustand.ball ? (
        <circle
          cx={zustand.ball.x + (zustand.ballBei ? 0.55 * m : 0)}
          cy={zustand.ball.y + (zustand.ballBei ? 0.45 * m : 0)}
          r={BALL_R * m}
          fill="#ffffff"
          stroke="#111827"
          strokeWidth={0.07 * m}
        />
      ) : null}
    </svg>
  );
}

/** Legende für Pfeile und Teams (nur die Teams, die in der Animation vorkommen). Ohne Pfeile im Player. */
export function Legende({ animation, pfeile = true }: { animation?: Animation; pfeile?: boolean }) {
  const teams = animation
    ? (["A", "B", "C", "N"] as const).filter((t) =>
        animation.objekte.some((o) => o.typ === "spieler" && o.team === t),
      )
    : (["A", "B"] as const);
  const zeile = (stil: React.ReactNode, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden>
        {stil}
      </svg>
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
      {pfeile ? (
        <>
          {zeile(<line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />, "Pass")}
          {zeile(<line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth="2" />, "Laufweg")}
          {zeile(<path d="M1,5 Q4,1 7,5 T13,5 T19,5 T25,5" fill="none" stroke="currentColor" strokeWidth="2" />, "Dribbling")}
          {zeile(<line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth="4" />, "Schuss")}
        </>
      ) : null}
      {teams.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAMFARBEN[t].fuellung }} />
          {TEAMFARBEN[t].name}
        </span>
      ))}
    </div>
  );
}

/**
 * Statische Skizze für Druck und PDF: Startaufstellung mit allen Aktionen,
 * nummeriert nach Schritt.
 */
export function Skizze({ animation, titel }: { animation: Animation; titel?: string }) {
  const z = alleZustaende(animation);
  const alle: Pfeil[] = [];
  const nummern: number[] = [];
  animation.schritte.forEach((s, i) => {
    for (const p of pfeile(z[i], z[i + 1], s)) {
      alle.push(p);
      nummern.push(i + 1);
    }
  });
  return <Spielfeld animation={animation} zustand={z[0]} pfeile={alle} pfeilNummern={nummern} titel={titel} />;
}
