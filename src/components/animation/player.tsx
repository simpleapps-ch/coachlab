"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Animation } from "@/lib/uebung-schema";
import { alleZustaende, pfeile, zwischen } from "./engine";
import { Legende, Spielfeld } from "./spielfeld";

const TEMPI = [0.5, 1, 1.5, 2] as const;

/**
 * Animations-Player: Play/Pause, Schritt vor/zurück, Tempo.
 * Ein Schritt ist eine klare Aktion; der Text zum Schritt steht unter dem Feld.
 */
export function AnimationsPlayer({ animation, titel }: { animation: Animation; titel: string }) {
  const zustaende = useMemo(() => alleZustaende(animation), [animation]);
  const anzahl = animation.schritte.length;

  const [schritt, setSchritt] = useState(0); // aktueller Schritt (0..anzahl-1)
  const [t, setT] = useState(0); // Fortschritt im Schritt (0..1)
  const [spielt, setSpielt] = useState(false);
  const [tempo, setTempo] = useState<(typeof TEMPI)[number]>(1);

  // Aktueller Stand für die Animationsschleife (wird nach jedem Rendern nachgeführt).
  const zustand = useRef({ schritt, t, tempo });
  useEffect(() => {
    zustand.current = { schritt, t, tempo };
  }, [schritt, t, tempo]);

  const amEnde = schritt === anzahl - 1 && t >= 1;

  useEffect(() => {
    if (!spielt) return;
    let rahmen = 0;
    let zuletzt = performance.now();
    const tick = (jetzt: number) => {
      const dt = (jetzt - zuletzt) / 1000;
      zuletzt = jetzt;
      const { schritt: s, t: tt, tempo: tp } = zustand.current;
      const naechstes = tt + (dt * tp) / animation.schritte[s].dauer;
      if (naechstes < 1) {
        setT(naechstes);
      } else if (s < anzahl - 1) {
        setSchritt(s + 1);
        setT(0);
      } else {
        setT(1);
        setSpielt(false);
        return;
      }
      rahmen = requestAnimationFrame(tick);
    };
    rahmen = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rahmen);
  }, [spielt, animation, anzahl]);

  const s = animation.schritte[schritt];
  const bild = zwischen(zustaende[schritt], zustaende[schritt + 1], s, t);
  const aktuellePfeile = pfeile(zustaende[schritt], zustaende[schritt + 1], s);

  const abspielen = () => {
    if (amEnde) {
      setSchritt(0);
      setT(0);
    }
    setSpielt((x) => !x || amEnde);
  };
  const zurueck = () => {
    setSpielt(false);
    if (t > 0.05) setT(0);
    else if (schritt > 0) {
      setSchritt(schritt - 1);
      setT(0);
    }
  };
  const vor = () => {
    setSpielt(false);
    if (t < 1 && schritt < anzahl - 1) {
      setSchritt(schritt + 1);
      setT(0);
    } else setT(1);
  };

  const knopf =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-2 text-sm hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";

  return (
    <figure className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl">
        <Spielfeld animation={animation} zustand={bild} pfeile={aktuellePfeile} titel={titel} />
      </div>

      <figcaption className="min-h-12 text-sm" aria-live="polite">
        <span className="font-semibold">
          Schritt {schritt + 1} von {anzahl}:
        </span>{" "}
        {s.text}
      </figcaption>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className={knopf} onClick={zurueck} disabled={schritt === 0 && t === 0} aria-label="Schritt zurück">
          ⏮
        </button>
        <button
          type="button"
          className={`${knopf} min-w-24 bg-[var(--vereinsfarbe)] font-medium text-white hover:bg-[var(--vereinsfarbe)] hover:opacity-90`}
          onClick={abspielen}
        >
          {spielt ? "⏸ Pause" : amEnde ? "↺ Nochmals" : "▶ Abspielen"}
        </button>
        <button type="button" className={knopf} onClick={vor} disabled={amEnde} aria-label="Schritt vor">
          ⏭
        </button>

        <div className="ml-1 flex items-center gap-1" role="group" aria-label="Tempo">
          {TEMPI.map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setTempo(tp)}
              aria-pressed={tempo === tp}
              className={`h-9 rounded-lg px-2 text-sm ${tempo === tp ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            >
              {tp}×
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1" aria-label="Schritte">
          {animation.schritte.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Zu Schritt ${i + 1}`}
              onClick={() => {
                setSpielt(false);
                setSchritt(i);
                setT(0);
              }}
              className={`h-2.5 w-6 rounded-full ${i < schritt || (i === schritt && t > 0) ? "bg-[var(--vereinsfarbe)]" : i === schritt ? "bg-neutral-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
            />
          ))}
        </div>
      </div>
      <div className="print:hidden">
        <Legende />
      </div>
    </figure>
  );
}
