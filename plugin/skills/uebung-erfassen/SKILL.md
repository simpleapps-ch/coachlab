---
name: uebung-erfassen
description: Eine Fussballübung (aus PDF, Foto, Notizen oder Gespräch) im Coachlab-Format mit Animation erfassen, prüfen und als Entwurf im Verein speichern. Verwenden, wenn jemand eine Übung, Spielform oder ein Positionsspiel in Coachlab anlegen oder ändern will.
---

# Übung für Coachlab erfassen

Sprache: Deutsch (Schweiz), nie «ß», immer «ss». Fussballbegriffe nach SFV, Du-Form.

## Ablauf

1. **Verein klären:** `coachlab_vereine`. Speichern dürfen nur Technische Leitung und Admins. Bei Trainern: erfassen und prüfen ja, Speichern übernimmt die Technische Leitung.
2. **Format und Standard lesen:** `coachlab_uebungsformat` einmal pro Gespräch. Als Vorlage eine ähnliche bestehende Übung mit `coachlab_uebungen_suchen` finden und mit `coachlab_uebung_lesen` holen.
3. **Inhalt aus der Quelle übernehmen**, nichts erfinden, was dort steht: Titel, Ziel, Aufbau, Ablauf, Regeln, Coachingpunkte (3–5), Varianten. Was du schätzt (Feldgrösse, Dauer, Stufen, Koordinaten, zusätzliche Schritte), kommt in `zu_pruefen`. Die Herkunft in `quelle`.
4. **Animation bauen** nach dem Animationsstandard:
   - Nur Pässe, Schüsse, Dribblings und Schlüssel-Laufwege speichern. Füllbewegungen ergänzt der Standard.
   - Ein ganzer Spielzug: Aufbau, Abschluss oder Punkt, Ballverlust, Umschalten mit Gegenpressing.
   - Kein Pass durch oder über einen Spieler.
   - Zonen, Bahnen, Hälften, Drittel oder Box in `animation.zonen` (reine Markierung: `sperren: false`).
   - `feld` (BreitexLänge) gleich wie `animation.feld`.
5. **Prüfen:** `coachlab_uebung_pruefen`, bis keine Fehler mehr kommen. Hinweise (Dreiecke, Gegenpressing, Ballverlust) kurz mit der Person besprechen.
6. **Speichern:** `coachlab_uebung_speichern`. Gibt es die ID schon, zuerst fragen, ob die bestehende Übung ersetzt werden soll, erst dann `ueberschreiben: true`.
7. **Abschluss:** Vorschau-Link nennen und daran erinnern, dass die Technische Leitung die Übung unter «Entwürfe & Freigabe» freigibt.

## Mehrere Übungen

Bei einem Handbuch mit vielen Übungen: eine Übung nach der anderen prüfen und speichern, am Schluss eine kurze Liste mit Links und offenen Punkten aus `zu_pruefen`.
