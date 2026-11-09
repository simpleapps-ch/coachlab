# Coachlab-Animationsstandard

Gilt für alle Vereine und alle Übungen mit zwei oder mehr Teams, heute und für jede neue Übung.
Umgesetzt in `src/components/animation/standard.ts` (`nachStandard`), angewendet im Player.

## Grundidee

In einer Übung werden nur die **wichtigen Aktionen** gespeichert: Pässe, Schüsse, Dribblings und die
Schlüssel-Laufwege (z. B. aus einem Trainerhandbuch). Alle anderen Spieler bewegt der Standard
automatisch, so dass jede Animation wie ein echtes Spiel aussieht. Wird der Standard verbessert,
profitieren alle bestehenden Übungen sofort davon.

## Prinzipien

1. **Alle Spieler in Bewegung.** In jedem Schritt bewegt sich jeder Spieler ausser dem
   Ballführenden (wenn er nicht abspielt).
2. **Dreiecke im Ballbesitz.** Die zwei nächsten Mitspieler bilden mit dem Ballempfänger ein
   Dreieck: 6–15 m Abstand, Winkel 45–135°, Passweg frei. Die übrigen machen das Feld breit und
   tief, halten Abstand zu Mitspielern und bleiben in ihrer Struktur.
3. **Gegen den Ball.** Der nächste Verteidiger presst den Ballempfänger, die anderen stellen die
   Passwege zu ihren Gegenspielern zu.
4. **Gegenpressing nach Ballverlust.** Zwei Schritte lang (etwa 5 Sekunden) laufen zwei Spieler
   des Teams, das den Ball verloren hat, sofort auf den Ball (von zwei Seiten), die übrigen
   schliessen die nächsten Passwege. Laufwege sind dabei länger als sonst.
5. **Pässe nur zwischen Spielern durch.** Kein Pass und kein Schuss läuft durch oder über einen
   Spieler (Mindestabstand 1,1 m × Massstab). Steht eine gespeicherte Position im Weg, wird sie
   minimal verschoben (seitlich, sonst Laufweg verkürzen, sonst schon im Schritt davor).
6. **Linien und Zonen.** End- und Seitenspieler bewegen sich nur entlang ihrer Linie, Torhüter nur
   auf der Torlinie. Grenzen von Zonen, Bahnen oder Hälften stehen in `animation.zonen` und werden
   von automatischen Bewegungen nicht überschritten.

## Regeln für neue Übungen (auch über den Claude-Connector)

- Nur Pässe, Schüsse, Dribblings und Schlüssel-Laufwege speichern, keine Füllbewegungen.
- Zonen, Bahnen oder Hälften als `animation.zonen` angeben (`x` und/oder `y` in Metern).
- Eine Animation zeigt einen ganzen Spielzug: Aufbau, Abschluss oder Punkt, Ballverlust und
  Umschalten (Gegenpressing).
- Übungen ohne Gegner (z. B. Passformen) bleiben unverändert; `animation.automatik: false`
  schaltet den Standard für eine Übung bewusst aus.

## Prüfungen

- `passKonflikte` (Engine): kein Pass durch einen Spieler. Test für alle Beispielübungen.
- `dreieckLuecken`: Nach jedem Pass hat der Empfänger zwei freie Anspielstationen, die nicht auf
  einer Linie stehen (30–150°). Ausgenommen: abgefangene Pässe, Empfänger auf einer Aussenlinie.
- `gegenpressingLuecken`: Nach einem Ballverlust laufen mindestens zwei Spieler sofort Richtung Ball.
