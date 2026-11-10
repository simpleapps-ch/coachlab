# Handbuch für Vereins-Admins

Für die Technische Leitung (Owner) und ihre Stellvertretung (Admin).

## Mitglieder

**Mitglieder** im Menü.

- **Persönliche Einladung:** E-Mail und Rolle eingeben, «Einladen». Den Link kopieren und per E-Mail oder WhatsApp schicken. Gültig 14 Tage, nur einmal verwendbar, die Person ist sofort freigeschaltet.
- **Vereinscode:** ein Link für alle Trainer, 90 Tage gültig. Wer sich damit registriert, erscheint als «wartet auf Freischaltung» und muss von dir freigeschaltet werden.
- Bestehende Mitglieder kannst du freischalten, sperren, zu Admin bzw. Trainer machen oder entfernen. Die Technische Leitung selbst lässt sich hier nicht ändern.

## Übungen freigeben

**Entwürfe & Freigabe** im Menü.

1. Neue Übungen erfasst du mit Claude über den Coachlab-Connector (siehe unten). Sie erscheinen hier als **Entwurf**.
2. **Vorschau** öffnet die Übung so, wie Trainer sie sehen werden, mit Animation. Unter «Nur für Admins» stehen die Quelle und Werte, die Claude ergänzt hat und die du prüfen solltest.
3. **Freigeben**: Ab jetzt sehen alle Trainer die Übung in der Bibliothek.
4. **Zurück auf Entwurf** nimmt eine Übung wieder aus der Bibliothek. Entwürfe kannst du löschen.

In der Animation gibt es keine Pfeile: Ball und Spieler bewegen sich wie im Spiel. Für alle Spielformen gilt der Coachlab-Animationsstandard: Alle Spieler sind in Bewegung, die Mannschaft im Ballbesitz bildet Dreiecke, wer den Ball verliert, presst sofort und stellt Passwege zu, und kein Pass läuft durch oder über einen Spieler.

Wird eine freigegebene Übung später geändert, wird sie automatisch wieder zum Entwurf und muss neu freigegeben werden. Jede Änderung wird mit Datum und Person gespeichert.

## Abo

**Abo** im Menü (nur Technische Leitung und Admins).

- Ein Abo pro Verein, alle Trainer inklusive: CHF 49.– pro Monat oder CHF 490.– pro Jahr. Neue Vereine testen 14 Tage gratis.
- **Abo verwalten** öffnet das Stripe-Kundenportal: Zahlungsmittel ändern, Rechnungen herunterladen, zwischen Monat und Jahr wechseln oder kündigen. Gekündigt wird immer auf Ende der bezahlten Periode.
- Schlägt eine Zahlung fehl, versucht Stripe es automatisch erneut und schickt dir eine E-Mail. Der Zugang bleibt während dieser Zeit bestehen.
- Ohne aktives Abo sehen Trainer keine Inhalte mehr. Technische Leitung und Admins kommen weiterhin hinein, z. B. um das Abo neu abzuschliessen oder Inhalte zu exportieren.

## Claude verbinden (Coachlab-Connector)

Einmal pro Person einrichten:

1. In Claude unter **Einstellungen → Connectors** einen eigenen Connector hinzufügen (in Team- und Enterprise-Plänen macht das die Person, die Claude für eure Organisation verwaltet).
   - Name: `Coachlab`
   - Adresse: `https://coachlab-ch.netlify.app/api/mcp`
2. **Verbinden** wählen. Es öffnet sich die Coachlab-Seite «Claude mit Coachlab verbinden». Mit deinem Coachlab-Konto anmelden und **Erlauben**.

Danach kannst du in Claude zum Beispiel schreiben:

- «Erfasse aus diesem PDF die Übung ‹Rondo 5 gegen 2› für Zug94.»
- «Welche Übungen haben wir für die D-Junioren zum Thema Gegenpressing?»
- «Passe bei ‹positionsspiel-03› die Coachingpunkte an.»

Was der Connector darf:

- Alle: Übungen des Vereins suchen und lesen, genau wie auf der Website.
- Technische Leitung und Admins: Übungen als **Entwurf** speichern. Claude prüft dabei das Pflichtformat und den Animationsstandard (kein Pass durch einen Spieler) und meldet, was fehlt. Eine bestehende Übung ersetzt Claude nur, wenn du das ausdrücklich bestätigst.
- Freigeben geht nur hier unter «Entwürfe & Freigabe». Was Claude geschätzt oder ergänzt hat, steht in der Vorschau unter «Zu prüfen».

Zugriff entziehen: in Claude den Connector trennen.

## Drucken

Auf jeder Übung «Drucken / PDF»: Statt der Animation erscheint eine Skizze mit nummerierten Pfeilen und die Schritte als Liste.
