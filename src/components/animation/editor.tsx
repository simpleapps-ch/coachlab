"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { uebungPruefen } from "@/lib/mcp/pruefen";
import {
  animation as animationSchema,
  TEAMS,
  type Animation,
  type AnimationsObjekt,
  type Uebung,
} from "@/lib/uebung-schema";
import {
  aktionEntfernen,
  aktionText,
  ballVorSchritt,
  balltempoSetzen,
  bewegungEntfernen,
  bewegungSetzen,
  feldAendern,
  grenzenLesen,
  MAX_SCHRITTE,
  objektAendern,
  objektEntfernen,
  objektHinzufuegen,
  passSetzen,
  schrittAendern,
  schrittDuplizieren,
  schrittEinfuegen,
  schrittLoeschen,
  schrittVerschieben,
  schussSetzen,
  startSetzen,
  zonenAendern,
  type Balltempo,
  type NeuesObjekt,
} from "./bearbeiten";
import {
  alleZustaende,
  massstab,
  pfeile as pfeileBerechnen,
  schrittDauer,
  startZustand,
  type Punkt,
  type Zustand,
} from "./engine";
import { AnimationsPlayer } from "./player";
import { RAND, SPIELER_R, Spielfeld, TEAMFARBEN } from "./spielfeld";
import { nachStandard, standardAktiv } from "./standard";

/**
 * Animations-Editor für bestehende Übungen (Computer und Tablet, Maus und Finger).
 * Ansicht 0 = Aufstellung (Startpositionen), Ansicht k = Ende von Schritt k.
 * Gespeichert werden nur die Schlüsselaktionen; alle übrigen Spieler bewegt der Standard,
 * so wie im Player. Prüfung und Speichern nutzen dieselbe Funktion wie der Connector.
 */

type Werkzeug = "bewegen" | "pass" | "schuss";

export type SpeichernErgebnis =
  | { ok: true; stand: string; hinweise: string[] }
  | { ok: false; fehler: string[] };

export type Speichern = (d: { verein: string; uebung: string; stand: string; animation: unknown }) => Promise<SpeichernErgebnis>;
type Zug = { id: string; start: Punkt; p: Punkt; bewegt: boolean };

const GRENZE_ZIEHEN = 0.3; // Meter: darunter gilt es als Antippen

function lesbar(text: string, a: Animation): string {
  return text
    .replace(/^animation\.schritte\.(\d+)(\.aktionen(\.\d+)?)?/, (_, n) => `Schritt ${Number(n) + 1}`)
    .replace(/^animation\.objekte\.(\d+)(\.\w+)?/, (_, n) => `Objekt ${a.objekte[Number(n)]?.id ?? Number(n) + 1}`)
    .replace(/^animation\.feld|^feld/, "Feld")
    .replace(/^animation\.?/, "Animation");
}

function useVerlauf(start: Animation) {
  const [v, setV] = useState({ liste: [start], index: 0, schluessel: null as string | null });
  const aendern = useCallback((neu: Animation, schluessel?: string) => {
    setV((alt) => {
      if (neu === alt.liste[alt.index]) return alt;
      // Tippen im selben Textfeld ergibt einen einzigen Rückgängig-Schritt
      if (schluessel && schluessel === alt.schluessel) {
        const liste = [...alt.liste];
        liste[alt.index] = neu;
        return { ...alt, liste };
      }
      const liste = [...alt.liste.slice(Math.max(0, alt.index - 99), alt.index + 1), neu];
      return { liste, index: liste.length - 1, schluessel: schluessel ?? null };
    });
  }, []);
  const zurueck = useCallback(() => setV((alt) => ({ ...alt, index: Math.max(0, alt.index - 1), schluessel: null })), []);
  const vor = useCallback(
    () => setV((alt) => ({ ...alt, index: Math.min(alt.liste.length - 1, alt.index + 1), schluessel: null })),
    [],
  );
  return {
    a: v.liste[v.index],
    aendern,
    zurueck,
    vor,
    kannZurueck: v.index > 0,
    kannVor: v.index < v.liste.length - 1,
  };
}

const knopf =
  "inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";
const klein =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-2 text-sm hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";
const eingabe =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-[var(--vereinsfarbe)] focus:ring-2 focus:ring-[var(--vereinsfarbe)]/20 dark:border-neutral-700 dark:bg-neutral-950";

function Bereich({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{titel}</h2>
      {children}
    </section>
  );
}

/** Zahl erst übernehmen, wenn das Feld verlassen oder Enter gedrückt wird. */
function ZahlFeld({
  label,
  wert,
  min,
  max,
  schritt = 1,
  uebernehmen,
}: {
  label: string;
  wert: number;
  min: number;
  max: number;
  schritt?: number;
  uebernehmen: (v: number) => void;
}) {
  const [text, setText] = useState(String(wert));
  const fertig = () => {
    const v = Number(text.replace(",", "."));
    if (Number.isFinite(v) && v >= min && v <= max) uebernehmen(v);
    else setText(String(wert));
  };
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className={eingabe}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={schritt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={fertig}
        onKeyDown={(e) => e.key === "Enter" && fertig()}
      />
    </label>
  );
}

function GrenzenFeld({ label, werte, max, uebernehmen }: { label: string; werte: number[]; max: number; uebernehmen: (v: number[]) => void }) {
  const [text, setText] = useState(werte.join(", "));
  const fertig = () => {
    const v = grenzenLesen(text, max);
    setText(v.join(", "));
    uebernehmen(v);
  };
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className={eingabe}
        placeholder="z. B. 10, 20"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={fertig}
        onKeyDown={(e) => e.key === "Enter" && fertig()}
      />
    </label>
  );
}

export function AnimationsEditor({
  verein,
  uebung,
  stand: startStand,
  freigegeben,
  zurueck: zurueckLink,
  speichern: animationSpeichern,
}: {
  verein: string;
  uebung: Uebung;
  stand: string;
  freigegeben: boolean;
  zurueck: string;
  /** Server-Aktion (wird von der Seite übergeben). */
  speichern: Speichern;
}) {
  const { a, aendern, zurueck, vor, kannZurueck, kannVor } = useVerlauf(uebung.animation);
  const [gespeichert, setGespeichert] = useState<Animation>(uebung.animation);
  const [stand, setStand] = useState(startStand);
  const [ansichtRoh, setAnsicht] = useState(0); // 0 = Aufstellung, k = Schritt k
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("bewegen");
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [zug, setZug] = useState<Zug | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState(false);
  const [ergebnis, setErgebnis] = useState<SpeichernErgebnis | null>(null);
  const [speichert, starten] = useTransition();
  const leinwand = useRef<SVGSVGElement>(null);

  const anzahl = a.schritte.length;
  // Nach Rückgängig oder Löschen kann es weniger Schritte geben
  const ansicht = Math.min(ansichtRoh, anzahl);
  const schritt = ansicht - 1; // 0-basiert, -1 = Aufstellung
  const geaendert = a !== gespeichert;
  const B = a.feld.breite;
  const L = a.feld.laenge;
  const m = massstab(B, L);


  // Wie im Player: der Standard bewegt alle Spieler ohne eigenen Laufweg.
  const standard = standardAktiv(a);
  const anzeige = useMemo(() => {
    try {
      return standard ? nachStandard(a) : a;
    } catch {
      return a;
    }
  }, [a, standard]);
  const zustaende = useMemo(() => alleZustaende(anzeige), [anzeige]);

  const basis: Zustand = schritt < 0 ? startZustand(a) : (zustaende[schritt + 1] ?? startZustand(a));
  const pfeile = schritt < 0 ? [] : pfeileBerechnen(zustaende[schritt], zustaende[schritt + 1], a.schritte[schritt]);
  const halter = schritt < 0 ? null : ballVorSchritt(a, schritt);
  const explizit = new Set(
    schritt < 0
      ? []
      : a.schritte[schritt].aktionen.flatMap((ak) => (ak.art === "lauf" || ak.art === "dribbling" ? [ak.id] : [])),
  );

  // Pass oder Schuss des Schritts und seine Dauer (wie im Player)
  const ballAktion = schritt >= 0 ? a.schritte[schritt].aktionen.find((ak) => ak.art === "pass" || ak.art === "schuss") : undefined;
  const dauerJetzt =
    schritt >= 0 && zustaende[schritt] && zustaende[schritt + 1]
      ? schrittDauer(zustaende[schritt], zustaende[schritt + 1], anzeige.schritte[schritt] ?? a.schritte[schritt])
      : 0;

  // Dribbling und Pass desselben Spielers laufen im gleichen Schritt gleichzeitig ab
  const gleichzeitig =
    schritt >= 0 &&
    a.schritte[schritt].aktionen.some(
      (ak) =>
        (ak.art === "pass" || ak.art === "schuss") &&
        a.schritte[schritt].aktionen.some((x) => x.art === "dribbling" && x.id === ak.von),
    );

  // Während des Ziehens: Objekt (und Ball am Fuss) folgt dem Finger
  const bild: Zustand = useMemo(() => {
    if (!zug) return basis;
    const pos = { ...basis.pos };
    let { ball, ballBei } = basis;
    if (pos[zug.id]) {
      pos[zug.id] = zug.p;
      if (ballBei === zug.id) ball = zug.p;
    } else {
      ball = zug.p;
      ballBei = null;
    }
    return { pos, ball, ballBei };
  }, [basis, zug]);

  // Live-Prüfung wie beim Connector, verzögert, damit Ziehen flüssig bleibt
  const geprueft = useDeferredValue(a);
  const pruefung = useMemo(
    () => uebungPruefen({ ...uebung, animation: geprueft, feld: `${geprueft.feld.breite}x${geprueft.feld.laenge}` }),
    [uebung, geprueft],
  );
  const abspielbar = useMemo(() => animationSchema.safeParse(a).success, [a]);

  // Ungespeicherte Änderungen nicht aus Versehen verlieren
  useEffect(() => {
    if (!geaendert) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [geaendert]);

  const ausgewaehlt = auswahl ? a.objekte.find((o) => o.id === auswahl) : undefined;

  const loeschen = useCallback(() => {
    if (!auswahl) return;
    aendern(objektEntfernen(a, auswahl));
    setAuswahl(null);
  }, [a, aendern, auswahl]);

  // Tastatur: Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y, Entf in der Aufstellung
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.tagName === "SELECT")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) vor();
        else zurueck();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        vor();
      } else if ((e.key === "Delete" || e.key === "Backspace") && ansicht === 0 && auswahl) {
        e.preventDefault();
        loeschen();
      } else if (e.key === "Escape") {
        setAuswahl(null);
        setWerkzeug("bewegen");
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [ansicht, auswahl, loeschen, vor, zurueck]);

  // ---------------------------------------------------------------------------
  // Zeiger (Maus, Finger, Stift)
  // ---------------------------------------------------------------------------

  const punktAus = (e: React.PointerEvent): Punkt | null => {
    const svg = leinwand.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const objektGreifen = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const p = punktAus(e);
    if (!p) return;
    setMeldung(null);
    if (schritt >= 0 && werkzeug === "pass") {
      const r = passSetzen(a, schritt, id);
      if (r.ok) {
        aendern(r.animation);
        setWerkzeug("bewegen");
      } else setMeldung(r.grund);
      return;
    }
    if (schritt >= 0 && werkzeug === "schuss") {
      feldTippen(e);
      return;
    }
    // In den Schritten bewegen sich nur Spieler; Hütchen, Tore und Ball nur in der Aufstellung.
    const o = a.objekte.find((x) => x.id === id);
    if (schritt >= 0 && o?.typ !== "spieler") return;
    leinwand.current?.setPointerCapture(e.pointerId);
    const start = id === "§ball" ? (bild.ball ?? p) : (bild.pos[id] ?? p);
    setAuswahl(id === "§ball" ? (a.objekte.find((x) => x.typ === "ball")?.id ?? null) : id);
    setZug({ id, start, p: start, bewegt: false });
  };

  const ziehen = (e: React.PointerEvent) => {
    if (!zug) return;
    const p = punktAus(e);
    if (!p) return;
    const q = { x: Math.min(B, Math.max(0, p.x)), y: Math.min(L, Math.max(0, p.y)) };
    const bewegt = zug.bewegt || Math.hypot(q.x - zug.start.x, q.y - zug.start.y) > GRENZE_ZIEHEN;
    setZug({ ...zug, p: bewegt ? q : zug.start, bewegt });
  };

  const loslassen = () => {
    if (!zug) return;
    if (zug.bewegt) {
      if (schritt < 0) {
        const ballId = a.objekte.find((o) => o.typ === "ball")?.id;
        aendern(startSetzen(a, zug.id === "§ball" && ballId ? ballId : zug.id, zug.p));
      } else {
        aendern(bewegungSetzen(a, schritt, zug.id, zug.p));
      }
    }
    setZug(null);
  };

  const feldTippen = (e: React.PointerEvent) => {
    const p = punktAus(e);
    if (!p) return;
    if (schritt >= 0 && werkzeug === "schuss") {
      const r = schussSetzen(a, schritt, p);
      if (r.ok) {
        aendern(r.animation);
        setWerkzeug("bewegen");
      } else setMeldung(r.grund);
      return;
    }
    setAuswahl(null);
  };

  // ---------------------------------------------------------------------------
  // Speichern
  // ---------------------------------------------------------------------------

  const speichern = () => {
    const version = a;
    setErgebnis(null);
    starten(async () => {
      const r = await animationSpeichern({ verein, uebung: uebung.id, stand, animation: version });
      setErgebnis(r);
      if (r.ok) {
        setGespeichert(version);
        setStand(r.stand);
      }
    });
  };

  const hinzufuegen = (neu: NeuesObjekt) => {
    const r = objektHinzufuegen(a, neu);
    if (r.id) {
      aendern(r.animation);
      setAuswahl(r.id);
    } else setMeldung(neu.typ === "ball" ? "Es gibt schon einen Ball." : "Höchstens 40 Objekte.");
  };

  const ballObjekt = a.objekte.find((o) => o.typ === "ball");
  const verhaeltnis = (B + 2 * RAND) / (L + 2 * RAND);

  // ---------------------------------------------------------------------------
  // Darstellung
  // ---------------------------------------------------------------------------

  const werkzeugHinweis =
    schritt < 0
      ? "Ziehe Spieler, Hütchen, Tore und Ball an ihre Startposition. Den Ball legst du einem Spieler vor die Füsse, indem du ihn auf den Spieler ziehst."
      : werkzeug === "pass"
        ? halter
          ? `Pass von ${halter}: Tippe auf den Empfänger.`
          : "Zu Beginn dieses Schritts hat niemand den Ball."
        : werkzeug === "schuss"
          ? halter
            ? `Schuss von ${halter}: Tippe auf den Zielpunkt.`
            : "Zu Beginn dieses Schritts hat niemand den Ball."
          : "Ziehe einen Spieler dorthin, wo er am Ende des Schritts steht. Mit Ball wird daraus ein Dribbling. Gestrichelter Ring = eigener Laufweg; die übrigen Spieler bewegt der Standard.";

  return (
    <div className="flex flex-col gap-4">
      {/* Leiste: Rückgängig, Vorschau, Speichern */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <button type="button" className={knopf} onClick={zurueck} disabled={!kannZurueck} title="Rückgängig (Ctrl+Z)">
          ↶ <span className="hidden sm:inline">Rückgängig</span>
        </button>
        <button type="button" className={knopf} onClick={vor} disabled={!kannVor} title="Wiederholen (Ctrl+Shift+Z)">
          ↷ <span className="hidden sm:inline">Wiederholen</span>
        </button>
        <button
          type="button"
          className={knopf}
          aria-pressed={vorschau}
          onClick={() => setVorschau((v) => !v)}
          disabled={!vorschau && !abspielbar}
          title={abspielbar ? undefined : "Erst abspielbar, wenn das Format stimmt"}
        >
          {vorschau ? "✎ Bearbeiten" : "▶ Vorschau"}
        </button>
        <span className="ml-auto text-sm text-neutral-500" aria-live="polite">
          {speichert ? "Speichert …" : geaendert ? "Ungespeicherte Änderungen" : ergebnis?.ok ? "Gespeichert als Entwurf" : ""}
        </span>
        <button
          type="button"
          onClick={speichern}
          disabled={!geaendert || speichert || !pruefung.ok}
          className="inline-flex min-h-10 items-center rounded-lg bg-[var(--vereinsfarbe)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          title={pruefung.ok ? undefined : "Zuerst die Fehler beheben"}
        >
          Als Entwurf speichern
        </button>
      </div>

      {ergebnis && !ergebnis.ok ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Nicht gespeichert</p>
          <ul className="mt-1 list-disc pl-5">
            {ergebnis.fehler.slice(0, 6).map((f) => (
              <li key={f}>{lesbar(f, a)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ergebnis?.ok && !geaendert ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Gespeichert. {freigegeben ? "Die Übung ist jetzt wieder ein Entwurf; Trainer sehen die neue Animation erst nach der Freigabe. " : ""}
          <Link href={zurueckLink} className="font-medium underline">
            Zur Übung und freigeben
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* Spielfeld */}
        <div className="flex flex-col gap-3">
          {/* Ansichten: Aufstellung und Schritte */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Ansicht">
            {[0, ...a.schritte.map((_, i) => i + 1)].map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={ansicht === k}
                onClick={() => {
                  setAnsicht(k);
                  setVorschau(false);
                  setWerkzeug("bewegen");
                  setMeldung(null);
                }}
                className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-medium ${
                  ansicht === k
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "border border-neutral-300 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
                } ${k > 0 && a.schritte[k - 1].aktionen.length === 0 ? "ring-2 ring-red-400" : ""}`}
              >
                {k === 0 ? "Aufstellung" : `Schritt ${k}`}
              </button>
            ))}
            <button
              type="button"
              className={`${klein} shrink-0`}
              disabled={anzahl >= MAX_SCHRITTE}
              onClick={() => {
                aendern(schrittEinfuegen(a, anzahl - 1));
                setAnsicht(anzahl + 1);
              }}
              aria-label="Schritt am Ende hinzufügen"
            >
              +
            </button>
          </div>

          {vorschau && abspielbar ? (
            <div className="mx-auto w-full" style={{ maxWidth: `calc(${verhaeltnis} * 70vh)` }}>
              <AnimationsPlayer animation={a} titel={uebung.titel} />
            </div>
          ) : (
            <>
              <div className="relative mx-auto w-full select-none" style={{ maxWidth: `calc(${verhaeltnis} * 70vh)` }}>
                <div className="overflow-hidden rounded-xl">
                  <Spielfeld animation={a} zustand={bild} pfeile={zug ? [] : pfeile} titel={uebung.titel} />
                </div>
                <svg
                  ref={leinwand}
                  viewBox={`${-RAND} ${-RAND} ${B + 2 * RAND} ${L + 2 * RAND}`}
                  className={`absolute inset-0 h-full w-full touch-none ${werkzeug === "schuss" ? "cursor-crosshair" : ""}`}
                  onPointerDown={feldTippen}
                  onPointerMove={ziehen}
                  onPointerUp={loslassen}
                  onPointerCancel={() => setZug(null)}
                  aria-label="Spielfeld bearbeiten"
                >
                  {/* Ballführender zu Beginn des Schritts */}
                  {halter && bild.pos[halter] && werkzeug !== "bewegen" ? (
                    <circle
                      cx={zustaende[schritt]?.pos[halter]?.x}
                      cy={zustaende[schritt]?.pos[halter]?.y}
                      r={SPIELER_R * m * 1.7}
                      fill="none"
                      stroke="#fde047"
                      strokeWidth={0.12 * m}
                      strokeDasharray={`${0.3 * m} ${0.2 * m}`}
                    />
                  ) : null}
                  {a.objekte.map((o) => {
                    if (o.typ === "ball") return null;
                    const p = bild.pos[o.id];
                    if (!p) return null;
                    const r = o.typ === "spieler" ? SPIELER_R * m : o.typ === "tor" ? Math.max(o.breite / 2, 0.7) : 0.5 * m;
                    const markiert = auswahl === o.id || (zug?.id === o.id);
                    return (
                      <g key={o.id}>
                        {explizit.has(o.id) ? (
                          <circle cx={p.x} cy={p.y} r={r + 0.25 * m} fill="none" stroke="#ffffff" strokeWidth={0.08 * m} strokeDasharray={`${0.25 * m} ${0.18 * m}`} />
                        ) : null}
                        {markiert ? (
                          <circle cx={p.x} cy={p.y} r={r + 0.35 * m} fill="none" stroke="#fde047" strokeWidth={0.14 * m} />
                        ) : null}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={Math.max(r * 1.5, 0.9 * m)}
                          fill="transparent"
                          className={schritt < 0 || o.typ === "spieler" ? "cursor-grab" : ""}
                          onPointerDown={(e) => objektGreifen(e, o.id)}
                        >
                          <title>{o.id}</title>
                        </circle>
                      </g>
                    );
                  })}
                  {/* Ball: nur in der Aufstellung greifbar */}
                  {schritt < 0 && bild.ball ? (
                    <circle
                      cx={bild.ball.x + (bild.ballBei ? 0.55 * m : 0)}
                      cy={bild.ball.y + (bild.ballBei ? 0.45 * m : 0)}
                      r={0.5 * m}
                      fill="transparent"
                      stroke={auswahl && auswahl === ballObjekt?.id ? "#fde047" : "none"}
                      strokeWidth={0.1 * m}
                      className="cursor-grab"
                      onPointerDown={(e) => objektGreifen(e, "§ball")}
                    >
                      <title>Ball</title>
                    </circle>
                  ) : null}
                </svg>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{werkzeugHinweis}</p>
              {gleichzeitig ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Dribbling und Pass laufen in einem Schritt gleichzeitig: Der Ball startet dort, wo der Spieler zu
                  Beginn steht. Für «erst dribbeln, dann passen» zwei Schritte verwenden.
                </p>
              ) : null}
              {meldung ? (
                <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
                  {meldung}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Seitenleiste */}
        <div className="flex flex-col gap-4">
          {schritt < 0 ? (
            <>
              <Bereich titel="Hinzufügen">
                <div className="flex flex-wrap gap-2">
                  {TEAMS.map((t) => (
                    <button key={t} type="button" className={klein} onClick={() => hinzufuegen({ typ: "spieler", team: t })}>
                      <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-full" style={{ background: TEAMFARBEN[t].fuellung }} />
                      {TEAMFARBEN[t].name}
                    </button>
                  ))}
                  <button type="button" className={klein} onClick={() => hinzufuegen({ typ: "huetchen" })}>
                    Hütchen
                  </button>
                  <button type="button" className={klein} onClick={() => hinzufuegen({ typ: "tor" })}>
                    Tor
                  </button>
                  {ballObjekt ? null : (
                    <button type="button" className={klein} onClick={() => hinzufuegen({ typ: "ball" })}>
                      Ball
                    </button>
                  )}
                </div>
              </Bereich>

              {ausgewaehlt ? (
                <ObjektBereich
                  o={ausgewaehlt}
                  aendern={(felder) => aendern(objektAendern(a, ausgewaehlt.id, felder))}
                  loeschen={loeschen}
                />
              ) : (
                <p className="px-1 text-sm text-neutral-500">Tippe auf ein Objekt, um Team, Rolle oder Tor anzupassen.</p>
              )}

              <Bereich titel="Feld und Zonen">
                <div className="grid grid-cols-2 gap-3" key={`${B}x${L}`}>
                  <ZahlFeld label="Breite (m)" wert={B} min={5} max={75} uebernehmen={(v) => aendern(feldAendern(a, v, L))} />
                  <ZahlFeld label="Länge (m)" wert={L} min={5} max={110} uebernehmen={(v) => aendern(feldAendern(a, B, v))} />
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Ansicht</span>
                  <select
                    className={eingabe}
                    value={a.feld.ansicht}
                    onChange={(e) => aendern({ ...a, feld: { ...a.feld, ansicht: e.target.value as Animation["feld"]["ansicht"] } })}
                  >
                    <option value="ausschnitt">Ausschnitt</option>
                    <option value="halbfeld">Halbfeld</option>
                    <option value="ganzfeld">Ganzfeld (mit Mittellinie)</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3" key={JSON.stringify(a.zonen ?? null)}>
                  <GrenzenFeld label="Senkrechte Linien bei x" werte={a.zonen?.x ?? []} max={B} uebernehmen={(x) => aendern(zonenAendern(a, { x }))} />
                  <GrenzenFeld label="Waagrechte Linien bei y" werte={a.zonen?.y ?? []} max={L} uebernehmen={(y) => aendern(zonenAendern(a, { y }))} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={a.zonen?.sperren ?? true}
                    disabled={!a.zonen}
                    onChange={(e) => aendern(zonenAendern(a, { sperren: e.target.checked }))}
                  />
                  <span>Zonen sperren: Automatische Bewegungen bleiben in ihrer Zone. Aus = nur Markierung.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={standard}
                    onChange={(e) => aendern({ ...a, automatik: e.target.checked })}
                  />
                  <span>Coachlab-Standard: Spieler ohne eigenen Laufweg bewegen sich automatisch (Dreiecke, Gegenpressing).</span>
                </label>
              </Bereich>
            </>
          ) : (
            <>
              <Bereich titel={`Schritt ${schritt + 1} von ${anzahl}`}>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Werkzeug">
                  {(
                    [
                      ["bewegen", "Laufweg"],
                      ["pass", "Pass"],
                      ["schuss", "Schuss"],
                    ] as const
                  ).map(([w, name]) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={werkzeug === w}
                      onClick={() => {
                        setWerkzeug(werkzeug === w ? "bewegen" : w);
                        setMeldung(null);
                      }}
                      className={`min-h-10 rounded-lg text-sm font-medium ${
                        werkzeug === w
                          ? "bg-[var(--vereinsfarbe)] text-white"
                          : "border border-neutral-300 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Text unter dem Feld</span>
                  <textarea
                    className={`${eingabe} min-h-20`}
                    maxLength={200}
                    value={a.schritte[schritt].text}
                    onChange={(e) => aendern(schrittAendern(a, schritt, { text: e.target.value }), `text-${schritt}`)}
                  />
                </label>
                {ballAktion ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Ballgeschwindigkeit ({ballAktion.art === "pass" ? "Pass" : "Schuss"})</span>
                    <div className="grid grid-cols-4 gap-1" role="group" aria-label="Ballgeschwindigkeit">
                      {(
                        [
                          [undefined, "Auto"],
                          ["langsam", "Langsam"],
                          ["mittel", "Mittel"],
                          ["scharf", "Scharf"],
                        ] as [Balltempo | undefined, string][]
                      ).map(([t, name]) => (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={ballAktion.tempo === t}
                          onClick={() => aendern(balltempoSetzen(a, schritt, t))}
                          className={`min-h-10 rounded-lg text-sm ${
                            ballAktion.tempo === t
                              ? "bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900"
                              : "border border-neutral-300 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <span className="text-neutral-500">
                      {ballAktion.tempo
                        ? `Der Schritt dauert so lange, wie der Ball unterwegs ist: ${dauerJetzt.toFixed(1)} s.`
                        : `Auto: Der Ball passt sich der Schrittdauer an (${dauerJetzt.toFixed(1)} s).`}
                    </span>
                  </div>
                ) : null}
                <div key={`dauer-${schritt}-${a.schritte[schritt].dauer}`} className={ballAktion?.tempo ? "hidden" : ""}>
                  <ZahlFeld
                    label="Mindestdauer (Sekunden)"
                    wert={a.schritte[schritt].dauer}
                    min={0.3}
                    max={10}
                    schritt={0.1}
                    uebernehmen={(v) => aendern(schrittAendern(a, schritt, { dauer: v }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Aktionen</p>
                  {a.schritte[schritt].aktionen.length ? (
                    <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {a.schritte[schritt].aktionen.map((ak, k) => (
                        <li key={k} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                          <span>{aktionText(ak)}</span>
                          <button
                            type="button"
                            className="min-h-8 min-w-8 rounded text-neutral-500 hover:bg-neutral-100 hover:text-red-700 dark:hover:bg-neutral-800"
                            aria-label={`${aktionText(ak)} entfernen`}
                            onClick={() => aendern(aktionEntfernen(a, schritt, k))}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Noch keine Aktion. Ziehe einen Spieler oder setze einen Pass oder Schuss.
                    </p>
                  )}
                </div>
                {auswahl && explizit.has(auswahl) ? (
                  <button type="button" className={klein} onClick={() => aendern(bewegungEntfernen(a, schritt, auswahl))}>
                    Laufweg von {auswahl} entfernen (Standard übernimmt)
                  </button>
                ) : null}
                <div className="flex flex-wrap gap-1.5 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <button type="button" className={klein} disabled={schritt === 0} onClick={() => { aendern(schrittVerschieben(a, schritt, -1)); setAnsicht(ansicht - 1); }} aria-label="Schritt nach vorne">
                    ← Früher
                  </button>
                  <button type="button" className={klein} disabled={schritt === anzahl - 1} onClick={() => { aendern(schrittVerschieben(a, schritt, 1)); setAnsicht(ansicht + 1); }} aria-label="Schritt nach hinten">
                    Später →
                  </button>
                  <button type="button" className={klein} disabled={anzahl >= MAX_SCHRITTE} onClick={() => { aendern(schrittDuplizieren(a, schritt)); setAnsicht(ansicht + 1); }}>
                    Duplizieren
                  </button>
                  <button type="button" className={klein} disabled={anzahl >= MAX_SCHRITTE} onClick={() => { aendern(schrittEinfuegen(a, schritt)); setAnsicht(ansicht + 1); }}>
                    + Danach
                  </button>
                  <button
                    type="button"
                    className={`${klein} text-red-700 dark:text-red-400`}
                    disabled={anzahl <= 1}
                    onClick={() => {
                      aendern(schrittLoeschen(a, schritt));
                      setAnsicht(Math.max(1, ansicht - 1));
                    }}
                  >
                    Löschen
                  </button>
                </div>
              </Bereich>
            </>
          )}

          <Bereich titel="Prüfung">
            {pruefung.ok ? (
              <p className="text-sm text-green-700 dark:text-green-400">✓ Format und Animationsstandard erfüllt.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-red-700 dark:text-red-400">
                {pruefung.fehler.slice(0, 8).map((f) => (
                  <li key={f}>{lesbar(f, a)}</li>
                ))}
              </ul>
            )}
            {pruefung.hinweise.length ? (
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">Hinweise (speichern möglich)</p>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-neutral-600 dark:text-neutral-400">
                  {pruefung.hinweise.slice(0, 6).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Bereich>
        </div>
      </div>
    </div>
  );
}

function ObjektBereich({
  o,
  aendern,
  loeschen,
}: {
  o: AnimationsObjekt;
  aendern: (felder: Partial<AnimationsObjekt>) => void;
  loeschen: () => void;
}) {
  const titel =
    o.typ === "spieler" ? `Spieler ${o.id}` : o.typ === "tor" ? `Tor ${o.id}` : o.typ === "huetchen" ? `Hütchen ${o.id}` : "Ball";
  return (
    <Bereich titel={titel}>
      {o.typ === "spieler" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Team</span>
            <select className={eingabe} value={o.team} onChange={(e) => aendern({ team: e.target.value as (typeof TEAMS)[number] })}>
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {TEAMFARBEN[t].name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Rolle</span>
            <select className={eingabe} value={o.rolle} onChange={(e) => aendern({ rolle: e.target.value as "feld" | "torhueter" })}>
              <option value="feld">Feldspieler</option>
              <option value="torhueter">Torhüter</option>
            </select>
          </label>
        </div>
      ) : null}
      {o.typ === "tor" ? (
        <div className="grid grid-cols-2 gap-3" key={o.breite}>
          <ZahlFeld label="Breite (m)" wert={o.breite} min={0.5} max={7.32} schritt={0.1} uebernehmen={(v) => aendern({ breite: v })} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Öffnung</span>
            <select
              className={eingabe}
              value={o.ausrichtung}
              onChange={(e) => aendern({ ausrichtung: e.target.value as "oben" | "unten" | "links" | "rechts" })}
            >
              <option value="oben">oben</option>
              <option value="unten">unten</option>
              <option value="links">links</option>
              <option value="rechts">rechts</option>
            </select>
          </label>
        </div>
      ) : null}
      {o.typ === "ball" ? (
        <p className="text-sm text-neutral-500">{o.bei ? `Liegt bei ${o.bei}.` : "Liegt frei im Feld."}</p>
      ) : null}
      <button type="button" className={`${klein} self-start text-red-700 dark:text-red-400`} onClick={loeschen}>
        Entfernen
      </button>
    </Bereich>
  );
}
