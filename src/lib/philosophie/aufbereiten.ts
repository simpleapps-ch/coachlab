/**
 * Macht aus den Textelementen eines PDFs (z. B. einer Foliensammlung) lesbare Abschnitte.
 * Reine Funktion ohne PDF-Bibliothek: Eingabe sind Textstücke mit Position und Grösse,
 * wie pdf.js sie liefert. Jede Seite wird ein Abschnitt; Kapitel-Trennseiten («A Spielphilosophie»)
 * gruppieren die Abschnitte. Erkannt werden Karten, Listen, Tabellen, nummerierte Punkte und Zitate.
 */

export type Stueck = { s: string; x: number; y: number; h: number; w: number; eol: boolean };
export type Seite = { breite: number; hoehe: number; items: Stueck[] };

export type Karte = { marke?: string; titel?: string; inhalt: Inhalt[] };
export type Inhalt =
  | { art: "text"; text: string }
  | { art: "feld"; name: string; wert: string }
  | { art: "liste"; punkte: string[] }
  | { art: "zitat"; text: string };
export type Block =
  | Inhalt
  | { art: "zwischentitel"; text: string }
  | { art: "leitsatz"; text: string }
  | { art: "label"; text: string }
  | { art: "karten"; karten: Karte[] }
  | { art: "tabelle"; zeilen: string[][] }
  | { art: "nummern"; punkte: { nr: string; titel: string; text?: string }[] };

export type Abschnitt = { id: string; seite: number; kapitel: number | null; titel: string; bloecke: Block[] };
export type Kapitel = { nr: number; zeichen: string; titel: string; untertitel?: string };
export type Dokument = { titel: string; untertitel?: string; kapitel: Kapitel[]; abschnitte: Abschnitt[] };

// ---------------------------------------------------------------------------
// 1. Absätze: pdf.js setzt vor jeden neuen Absatz ein leeres Stück.
// ---------------------------------------------------------------------------

type Absatz = {
  x: number;
  rechts: number;
  gesperrt: boolean; // nur Text in gesperrter Schrift (Etikett wie «V I S I O N»)
  y: number; // oberste Zeile (grösster y-Wert, Ursprung unten)
  unten: number;
  groesse: number;
  zellen: string[]; // Teile auf derselben Zeile mit grossem Abstand (Tabellenzeile)
  zeilen: string[];
};

const leer = (s: string) => s.trim() === "";
const normal = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/ ([,.:;!?])/g, "$1")
    .trim();

const istGesperrt = (s: string) => /^(\S{1,2} ){3,}\S{1,2}$/.test(s);
/**
 * Gesperrte Schrift («Z U G») zusammenziehen. Wortabstände sind darin nicht erkennbar,
 * darum nur kurze Stücke (ein Wort); längere bleiben gesperrt und werden so angezeigt.
 */
const entsperren = (s: string) => (istGesperrt(s) && s.length <= 17 ? s.replace(/ /g, "") : s);
const zitatInhalt = (s: string) => s.replace(/^[«"„]\s*|\s*[»"“]$/g, "").trim();

function absaetze(seite: Seite): Absatz[] {
  const gruppen: Stueck[][] = [];
  let aktuell: Stueck[] = [];
  for (const it of seite.items) {
    if (it.s === "" && aktuell.length) {
      gruppen.push(aktuell);
      aktuell = [];
      continue;
    }
    aktuell.push(it);
  }
  if (aktuell.length) gruppen.push(aktuell);

  return gruppen
    .map((g) => {
      const text = g.filter((i) => !leer(i.s));
      if (!text.length) return null;
      const groesse = Math.max(...text.map((i) => i.h));
      const gesperrt = text.every((i) => istGesperrt(i.s) || /^[·•]$/.test(i.s));
      // Zellen: grosser waagrechter Abstand auf derselben Höhe
      const zellen: string[][] = [[]];
      const zeilen: string[][] = [[]];
      let vorher: Stueck | null = null;
      for (const i of g) {
        if (leer(i.s)) continue;
        if (vorher) {
          const gleicheZeile = Math.abs(i.y - vorher.y) < Math.max(i.h, vorher.h) * 0.8 && !vorher.eol;
          const abstand = i.x - (vorher.x + vorher.w);
          if (gleicheZeile && abstand > Math.max(1.5 * Math.max(i.h, vorher.h), 18)) zellen.push([]);
          if (vorher.eol || !gleicheZeile) zeilen.push([]);
        }
        zellen[zellen.length - 1].push(entsperren(i.s));
        zeilen[zeilen.length - 1].push(entsperren(i.s));
        vorher = i;
      }
      return {
        x: Math.min(...text.map((i) => i.x)),
        rechts: Math.max(...text.map((i) => i.x + i.w)),
        gesperrt,
        y: Math.max(...text.map((i) => i.y)),
        unten: Math.min(...text.map((i) => i.y)),
        groesse,
        zellen: zellen.map((z) => normal(z.join(" "))).filter(Boolean),
        zeilen: zeilen.map((z) => normal(z.join(" "))).filter(Boolean),
      } satisfies Absatz;
    })
    .filter((a): a is Absatz => a !== null)
    .flatMap((a): Absatz[] => {
      // Eine Nummer der nächsten Spalte hängt manchmal am Absatz davor («… Spiel. 2»)
      const letzte = a.zellen.at(-1) ?? "";
      if (a.zellen.length >= 2 && /^\d{1,2}$/.test(letzte)) {
        const vorne = { ...a, zellen: a.zellen.slice(0, -1), zeilen: a.zeilen.map((z) => z.replace(new RegExp(`\\s*${letzte}$`), "")) };
        const marke = { ...a, x: a.rechts + 1, rechts: a.rechts + 20, zellen: [letzte], zeilen: [letzte] };
        return [vorne, marke];
      }
      return [a];
    });
}

const textVon = (a: Absatz) => normal(a.zellen.join(" "));

// ---------------------------------------------------------------------------
// 2. Gruppen: Ein Kasten auf der Folie liest sich von oben nach unten; geht es
//    wieder nach oben oder weit zur Seite, beginnt ein neuer Kasten.
// ---------------------------------------------------------------------------

function gruppieren(liste: Absatz[], koerper: number): Absatz[][] {
  const gruppen: Absatz[][] = [];
  const ueberlappt = (a: Absatz, g: Absatz[]) => {
    const l = Math.min(...g.map((b) => b.x));
    const r = Math.max(...g.map((b) => b.rechts));
    const schnitt = Math.min(r, a.rechts) - Math.max(l, a.x);
    return schnitt > 0.3 * Math.min(r - l, a.rechts - a.x) || Math.abs(a.x - l) < 20;
  };
  for (const a of liste) {
    const g = gruppen.at(-1);
    const letzter = g?.at(-1);
    const beginntNeu = startetKarte(a, koerper) && !!g && g.some((b) => !startetKarte(b, koerper) || b !== g[0]);
    // Nummer links, Titel rechts daneben (etwas höher): gehören zusammen
    const nebenMarke =
      !!g && !!letzter && g.length === 1 && istMarke(textVon(letzter)) && a.x > letzter.x && a.y - letzter.y < 3 * a.groesse;
    if (nebenMarke) {
      g.push(a);
      continue;
    }
    const neu =
      !g ||
      !letzter ||
      a.gesperrt ||
      letzter.gesperrt ||
      a.y > letzter.y + 1 || // wieder nach oben: nächste Spalte
      !ueberlappt(a, g) || // andere Spalte
      letzter.unten - a.y > 5 * Math.max(a.groesse, koerper) || // grosse Lücke
      beginntNeu; // nächste Karte im gleichen Kasten
    if (neu) gruppen.push([a]);
    else g.push(a);
  }
  return gruppen;
}

/** Beginnt hier eine Karte? Nummer/Marke oder kurzer grösserer Titel. */
function startetKarte(a: Absatz, koerper: number) {
  const t = a.zellen.join(" ");
  return (
    istMarke(a.zellen[0] ?? "") ||
    (a.groesse >= koerper * 1.12 && t.length <= 60 && !/[.!?:»"“]$/.test(t) && !/^[«"„]/.test(t))
  );
}

// ---------------------------------------------------------------------------
// 3. Bausteine erkennen
// ---------------------------------------------------------------------------

const istMarke = (s: string) => /^(P?\d{1,2}|[A-Z]|\d{2}|(Stufe|Ebene|Phase|Schritt) \d+)$/.test(s);
// Gedankenstrich am Zeilenanfang ist meist Fortsetzung («– das Spiel verstehen»), kein Aufzählungszeichen.
const istPunkt = (s: string) => /^[•●▪◦✓→]\s*/.test(s) && s.length > 2;
const ohnePunkt = (s: string) => s.replace(/^[•●▪◦✓→]\s*/, "");

function inhaltVon(absaetzeDerGruppe: Absatz[], koerper = 14): Inhalt[] {
  const aus: Inhalt[] = [];
  for (let k = 0; k < absaetzeDerGruppe.length; k++) {
    const a = absaetzeDerGruppe[k];
    const t = textVon(a);
    const naechster = absaetzeDerGruppe[k + 1];
    // Kleines Etikett mit Wert darunter («Motto» / «Ich»)
    if (naechster && a.groesse < koerper * 0.93 && t.length <= 25 && !/[.!?]$/.test(t) && naechster.groesse >= a.groesse) {
      aus.push({ art: "feld", name: t, wert: textVon(naechster).replace(/^[«"„]\s*|\s*[»"“]$/g, "") });
      k++;
      continue;
    }
    // Aufzählung: jede Zeile mit Punkt beginnt einen neuen Punkt, Folgezeilen hängen an.
    const punktzeilen = a.zeilen.filter(istPunkt).length;
    if (punktzeilen > 0 || (a.zellen[0] && /^[•✓→]$/.test(a.zellen[0]))) {
      const punkte: string[] = [];
      const zeilen = a.zellen[0] && /^[•✓→]$/.test(a.zellen[0]) ? [a.zellen.join(" ")] : a.zeilen;
      for (const z of zeilen) {
        if (istPunkt(z) || !punkte.length) punkte.push(ohnePunkt(z));
        else punkte[punkte.length - 1] = normal(`${punkte[punkte.length - 1]} ${z}`);
      }
      const letzte = aus.at(-1);
      if (letzte?.art === "liste") letzte.punkte.push(...punkte);
      else aus.push({ art: "liste", punkte });
      continue;
    }
    if (/^[«"„]/.test(t) && /[»"“]$/.test(t)) {
      aus.push({ art: "zitat", text: t.replace(/^[«"„]\s*|\s*[»"“]$/g, "") });
      continue;
    }
    aus.push({ art: "text", text: t });
  }
  return aus;
}

function karteVon(g: Absatz[], koerper: number): Karte | null {
  const [erster, ...rest] = g;
  const t = textVon(erster);
  // «1 | Flach von hinten aufbauen» oder «P1» + Titel darunter
  if (erster.zellen.length >= 2 && istMarke(erster.zellen[0])) {
    const weitere: Inhalt[] = erster.zellen.length > 2 ? [{ art: "text", text: erster.zellen.slice(2).join(" ") }] : [];
    return { marke: erster.zellen[0], titel: erster.zellen[1], inhalt: [...weitere, ...inhaltVon(rest, koerper)] };
  }
  if (istMarke(t) && rest.length) {
    const [zweiter, ...uebrig] = rest;
    const titelArtig = zweiter.groesse >= koerper * 1.1 && textVon(zweiter).length < 60;
    return titelArtig
      ? { marke: t, titel: textVon(zweiter), inhalt: inhaltVon(uebrig, koerper) }
      : { marke: t, inhalt: inhaltVon(rest, koerper) };
  }
  if (/^[«"„]/.test(t)) return null; // Zitat über mehrere Absätze
  if (erster.groesse >= koerper * 1.12 && t.length <= 60 && rest.length) {
    return { titel: t, inhalt: inhaltVon(rest, koerper) };
  }
  return null;
}

function bloeckeVon(gruppen: Absatz[][], koerper: number): Block[] {
  const bloecke: Block[] = [];
  const anhaengen = (b: Block) => {
    const letzte = bloecke.at(-1);
    if (b.art === "karten" && letzte?.art === "karten") letzte.karten.push(...b.karten);
    else if (b.art === "nummern" && letzte?.art === "nummern") letzte.punkte.push(...b.punkte);
    else if (
      b.art === "karten" &&
      letzte?.art === "nummern" &&
      b.karten.every((k) => k.marke && k.titel && !k.inhalt.length)
    )
      letzte.punkte.push(...b.karten.map((k) => ({ nr: k.marke!, titel: k.titel! })));
    else if (b.art === "karten" && letzte?.art === "nummern" && b.karten.length === 1 && b.karten[0].marke && b.karten[0].titel) {
      const k = b.karten[0];
      const text = k.inhalt.map((i) => ("text" in i ? i.text : "")).join(" ").trim();
      letzte.punkte.push({ nr: k.marke!, titel: k.titel!, text: text || undefined });
    } else bloecke.push(b);
  };

  for (const g of gruppen) {
    if (g.length === 1 && g[0].gesperrt) {
      anhaengen({ art: "label", text: textVon(g[0]) });
      continue;
    }
    if (g.length === 1 && g[0].groesse >= koerper * 1.8 && textVon(g[0]).length > 60) {
      const t = textVon(g[0]);
      anhaengen(/^[«"„]/.test(t) ? { art: "zitat", text: zitatInhalt(t) } : { art: "leitsatz", text: t });
      continue;
    }
    // Tabelle oder nummerierte Punkte: mehrere Absätze mit Zellen
    const mitZellen = g.filter((a) => a.zellen.length >= 2);
    if (mitZellen.length >= 2 && mitZellen.length >= g.length - 1) {
      const zeilen = g.map((a) => a.zellen);
      if (zeilen.every((z) => istMarke(z[0]))) {
        anhaengen({
          art: "nummern",
          punkte: zeilen.map((z) => ({ nr: z[0], titel: z[1], text: z.slice(2).join(" ") || undefined })),
        });
      } else {
        anhaengen({ art: "tabelle", zeilen });
      }
      continue;
    }
    const karte = karteVon(g, koerper);
    if (karte) {
      anhaengen({ art: "karten", karten: [karte] });
      continue;
    }
    // Einzelner kurzer, grosser Absatz: Zwischentitel
    if (g.length === 1 && g[0].groesse >= koerper * 1.12 && textVon(g[0]).length <= 70 && !/[.!?]$/.test(textVon(g[0]))) {
      anhaengen({ art: "zwischentitel", text: textVon(g[0]) });
      continue;
    }
    const ganz = normal(g.map(textVon).join(" "));
    const zitat = /^[«"„]\s*([^»"“]+)[»"“]\s*(.*)$/.exec(ganz);
    if (zitat && g.length > 1) {
      anhaengen({ art: "zitat", text: zitat[1].trim() });
      if (zitat[2]) anhaengen({ art: "text", text: zitat[2] });
      continue;
    }
    for (const i of inhaltVon(g, koerper)) anhaengen(i);
  }

  // Eine einzelne Karte ohne Nachbarn: als Zwischentitel + Inhalt lesen
  return bloecke.flatMap((b): Block[] =>
    b.art === "karten" && b.karten.length === 1 && !b.karten[0].marke
      ? [{ art: "zwischentitel", text: b.karten[0].titel ?? "" }, ...b.karten[0].inhalt]
      : [b],
  );
}

// ---------------------------------------------------------------------------
// 4. Dokument
// ---------------------------------------------------------------------------

/** Häufigste Schriftgrösse, gewichtet nach Textmenge: die Grösse des Fliesstexts. */
const koerperVon = (liste: Absatz[]) => {
  const anteil = new Map<number, number>();
  for (const a of liste) {
    const g = Math.round(a.groesse);
    anteil.set(g, (anteil.get(g) ?? 0) + textVon(a).length);
  }
  let beste = 14;
  let max = -1;
  for (const [g, n] of anteil) if (n > max) [beste, max] = [g, n];
  return beste;
};

/** «UNSER LEITBILD» -> «Unser Leitbild» (nur für Titel in Grossbuchstaben). */
const schoen = (s: string) =>
  s === s.toUpperCase() && /[A-ZÄÖÜ]{4}/.test(s)
    ? s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    : s;

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "abschnitt";

export function dokumentAusSeiten(seiten: Seite[]): Dokument {
  const alle = seiten.map(absaetze);

  // Fusszeile: Texte, die unten auf vielen Seiten gleich stehen, und Seitenzahlen.
  const unten = new Map<string, number>();
  alle.forEach((liste, i) =>
    liste
      .filter((a) => a.y < seiten[i].hoehe * 0.1)
      .forEach((a) => unten.set(textVon(a), (unten.get(textVon(a)) ?? 0) + 1)),
  );
  const fuss = new Set([...unten].filter(([, n]) => n >= Math.max(2, seiten.length * 0.4)).map(([t]) => t));
  const ohneFuss = alle.map((liste, i) =>
    liste.filter((a) => !(a.y < seiten[i].hoehe * 0.1 && (fuss.has(textVon(a)) || /^\d{1,3}$/.test(textVon(a))))),
  );

  const koerperDok = koerperVon(ohneFuss.flat());

  const dok: Dokument = { titel: "", kapitel: [], abschnitte: [] };
  const ids = new Set<string>();

  ohneFuss.forEach((liste, i) => {
    if (!liste.length) return;
    const groesster = Math.max(...liste.map((a) => a.groesse));

    // Titelseite: erste Seite, grosser Titel
    if (i === 0 && groesster >= koerperDok * 2) {
      const titelTeile = liste.filter((a) => a.groesse === groesster).map(textVon);
      dok.titel = normal(titelTeile.join(" "));
      const nachTitel = liste.filter((a) => a.groesse < groesster && a.y < Math.max(...liste.filter((b) => b.groesse === groesster).map((b) => b.y)));
      dok.untertitel = nachTitel[0] ? textVon(nachTitel[0]) : undefined;
      return;
    }

    // Kapitelseite: ein Buchstabe, ein grosser Titel, höchstens ein Untertitel
    const kopf = /^([A-Z])(?: (.+))?$/.exec(textVon(liste[0]));
    if (liste.length <= 3 && kopf) {
      const titel = kopf[2] ?? (liste[1] ? textVon(liste[1]) : "");
      const unter = kopf[2] ? liste[1] : liste[2];
      dok.kapitel.push({ nr: dok.kapitel.length + 1, zeichen: kopf[1], titel, untertitel: unter ? textVon(unter) : undefined });
      return;
    }

    // Folientitel: grösste Schrift im oberen Viertel
    const oben = liste.filter((a) => a.y > seiten[i].hoehe * 0.72);
    const titelAbsatz = oben.length ? oben.reduce((m, a) => (a.groesse > m.groesse ? a : m)) : null;
    let kopfzeile: Absatz | null = titelAbsatz && titelAbsatz.groesse >= koerperDok * 1.6 ? titelAbsatz : null;
    // Ohne grossen Titel: oberstes kurzes Etikett («UNSER LEITBILD») als Titel
    const oberstes = liste.reduce((m, a) => (a.y > m.y ? a : m));
    if (!kopfzeile && oberstes.y > seiten[i].hoehe * 0.72 && textVon(oberstes).length <= 50) kopfzeile = oberstes;
    if (!kopfzeile) {
      const groesste = liste.reduce((m, a) => (a.groesse > m.groesse ? a : m));
      if (textVon(groesste).length <= 50) kopfzeile = groesste;
    }
    // Titel über mehrere Absätze gleicher Grösse («Mutig. Intelligent.» / «Gemeinsam.»)
    const titelTeile = kopfzeile ? [kopfzeile] : [];
    if (kopfzeile) {
      for (let k = liste.indexOf(kopfzeile) + 1; k < liste.length; k++) {
        const a = liste[k];
        if (Math.abs(a.groesse - kopfzeile.groesse) < 1 && titelTeile.at(-1)!.unten - a.y < 2 * a.groesse) titelTeile.push(a);
        else break;
      }
    }
    const titel = kopfzeile ? schoen(normal(titelTeile.map(textVon).join(" "))) : `Seite ${i + 1}`;
    const inhalt = liste.filter((a) => !titelTeile.includes(a));
    const koerper = koerperVon(inhalt);

    let id = slug(titel);
    for (let n = 2; ids.has(id); n++) id = `${slug(titel)}-${n}`;
    ids.add(id);

    dok.abschnitte.push({
      id,
      seite: i + 1,
      kapitel: dok.kapitel.length ? dok.kapitel.length : null,
      titel,
      bloecke: bloeckeVon(gruppieren(inhalt, koerper), koerper),
    });
  });

  if (!dok.titel) dok.titel = dok.abschnitte[0]?.titel ?? "Ausbildungsphilosophie";
  return dok;
}
