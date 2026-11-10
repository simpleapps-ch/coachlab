import beispiel from "../../../tests/fixtures/uebungen/rondo-4v2-umschalten.json";
import { uebung } from "@/lib/uebung-schema";

/** Beispielübung für die Startseite (eigene Beispielübung von Coachlab, kein Vereinsinhalt). */
export const DEMO = uebung.parse(beispiel);
