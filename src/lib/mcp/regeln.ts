/**
 * Texte, die der Connector an Claude gibt. Inhaltlich gleich wie docs/animations-standard.md:
 * Ändert sich der Standard, beides im selben Pull Request nachführen.
 */

export const SERVER_ANLEITUNG = `Coachlab ist die Trainingsplattform deines Fussballvereins.
Mit diesem Connector suchst und liest du die Übungen deines Vereins und erfasst neue Übungen als Entwurf.

Sprache: Deutsch (Schweiz), nie «ß», immer «ss». Fussballbegriffe nach SFV, Du-Form.

Ablauf für eine neue oder geänderte Übung:
1. coachlab_vereine: Verein und Rolle klären. Speichern dürfen nur Technische Leitung (owner) und Admins.
2. coachlab_uebungsformat einmal lesen (Pflichtformat und Animationsstandard). Als Vorlage eignet sich eine bestehende Übung (coachlab_uebung_lesen).
3. coachlab_uebung_pruefen so lange, bis keine Fehler mehr kommen. Hinweise mit der Person besprechen.
4. coachlab_uebung_speichern: Die Übung landet als Entwurf. Freigeben kann nur die Technische Leitung auf der Website.

Werte, die du schätzt oder ergänzt (Feldgrösse, Dauer, Koordinaten, zusätzliche Schritte), gehören in «zu_pruefen», die Herkunft in «quelle».`;

export const ANIMATIONS_STANDARD = `Coachlab-Animationsstandard (gilt für jede Übung mit zwei oder mehr Teams)

Koordinaten in Metern, Ursprung oben links, x nach rechts (0 bis feld.breite), y nach unten (0 bis feld.laenge).
Teams: A, B, C (drittes Team), N (neutral/Anspieler). Torhüter: rolle "torhueter".

Gespeichert werden nur die wichtigen Aktionen: Pässe, Schüsse, Dribblings und Schlüssel-Laufwege.
Alle übrigen Spieler bewegt der Standard automatisch im Player:
1. Alle Spieler in Bewegung: anbieten oder Passwege zustellen.
2. Dreiecke im Ballbesitz: Die zwei nächsten Mitspieler bilden mit dem Ballempfänger ein Dreieck (6–15 m, 45–135°, Passweg frei).
3. Gegen den Ball: Der Nächste presst den Ballempfänger, die anderen stellen Passwege zu.
4. Gegenpressing nach Ballverlust: zwei Schritte lang laufen zwei Spieler sofort auf den Ball, die übrigen schliessen Passwege.
5. Kein Pass und kein Schuss durch oder über einen Spieler (Mindestabstand 1,1 m × Massstab). Das wird geprüft und blockiert das Speichern.
6. Linienspieler bewegen sich nur entlang ihrer Linie, Torhüter nur auf der Torlinie.
7. Zonen, Bahnen, Hälften, Drittel oder eine zentrale Box immer in animation.zonen (x und/oder y in Metern). Sie werden farbig gezeichnet und von automatischen Bewegungen nicht verlassen; reine Markierung (z. B. Mittellinie): sperren: false.

Regeln für neue Übungen:
- Eine Animation zeigt einen ganzen Spielzug: Aufbau, Abschluss oder Punkt, Ballverlust und Umschalten (Gegenpressing).
- Keine Füllbewegungen speichern, der Standard ergänzt sie. Keine Pfeile, der Player zeigt keine.
- Schrittdauer 2–4 Sekunden, ein Schritt = ein Pass oder eine Aktion mit den dazugehörigen Laufwegen.
- Übungen ohne Gegner (Passformen) bleiben unverändert; animation.automatik: false schaltet den Standard bewusst aus.
- Feld der Übung ("feld": "BreitexLänge") und animation.feld müssen übereinstimmen.
- coachingpunkte: 3 bis 5. varianten: leichter und schwerer je 1 bis 3.`;
