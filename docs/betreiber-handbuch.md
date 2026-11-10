# Betreiber-Handbuch Coachlab

Für die Admins der Simpleapps.ch GmbH. Bei jeder Änderung an Konten, Abläufen oder Tools im selben Pull Request nachführen.

## Konten

Alle Konten laufen auf die Funktionsadresse und haben mindestens zwei Admins. Zugangsdaten liegen im geteilten Passwort-Tresor.

| Dienst | Zweck | Status | Admin 1 | Admin 2 |
| --- | --- | --- | --- | --- |
| GitHub Organization `simpleapps-ch` | Code | eingerichtet | | |
| Netlify Team | Hosting, Deploy-Vorschauen | eingerichtet | | |
| Supabase Organization | Datenbank, Login, Dateien (Region EU, Frankfurt), Projekt `mhijnhtwutzatekpstxg`, Region eu-west-1 (Irland) | eingerichtet | | |
| Stripe | Abo und Rechnungen (ab Phase 4) | offen | | |
| Resend | E-Mails | offen | | |
| Domain coachlab.com / coachlab.ch | DNS bei Netlify | offen | | |
| Claude Team-Plan | Entwicklung, Plugin | offen | | |

## Umgebungsvariablen in Netlify

Netlify > Site configuration > Environment variables. Werte siehe `.env.example`.

| Variable | Geheim | Herkunft |
| --- | --- | --- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | nein | `coachlab.com` (vorerst die Netlify-Adresse) |
| `NEXT_PUBLIC_SUPABASE_URL` | nein | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | nein | Supabase > Project Settings > API Keys |
| `SUPABASE_SECRET_KEY` | ja | Supabase > Project Settings > API Keys |

## Supabase: Login-Adressen

Supabase → Authentication → **URL Configuration**. Ohne diese Einträge funktionieren die Links in Bestätigungs-E-Mails nicht.

| Feld | Wert |
| --- | --- |
| Site URL | `https://coachlab-ch.netlify.app` (später `https://coachlab.com`) |
| Redirect URLs | `https://coachlab-ch.netlify.app/**` |
| | `https://deploy-preview-*--coachlab-ch.netlify.app/**` |
| | `http://localhost:3000/**` und `http://*.coachlab.localhost:3000/**` |
| | später zusätzlich `https://coachlab.com/**` und `https://*.coachlab.com/**` |

## Vereine

| Verein | Slug | Tarif | Owner |
| --- | --- | --- | --- |
| Zug94 | `zug94` | gratis (Pilotverein, wird nie abgerechnet) | Bahadir Durak |

Einen Verein von Hand anlegen (z. B. Partnerverein ohne Abo): Claude über den Supabase-Connector bitten. Das Login legt die Person selbst an (Authentication → Users → Add user), Claude verknüpft es danach als Owner.

Zusätzlich legt die Supabase-Erweiterung von Netlify `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` und `SUPABASE_JWKS_URL` als geheime Variablen an. Sie sind öffentlich und in `netlify.toml` unter `SECRETS_SCAN_OMIT_KEYS` vom Geheimnis-Scanner ausgenommen. **Nie** `SUPABASE_SECRET_KEY` dort eintragen: Bricht der Build wegen dieses Schlüssels ab, ist er wirklich im Code gelandet.

## Fehlersuche: Statusseite

`https://coachlab-ch.netlify.app/api/status` zeigt, welche Werte die Website sieht (nie Geheimnisse, nur ob sie gesetzt sind) und ob Supabase erreichbar ist. Erwartet: `"ok": true`.

- `probleme` nennt fehlende oder falsche Variablen. `NEXT_PUBLIC_`-Variablen werden beim Build eingebaut: nach jeder Änderung in Netlify **Clear cache and deploy site**.
- `commit` zeigt, welche Version live ist.

## Coachlab-Connector (Claude)

Vereine verbinden Claude mit Coachlab über `https://coachlab-ch.netlify.app/api/mcp` (später `https://coachlab.com/api/mcp`). Die Anmeldung läuft über den OAuth-2.1-Server von Supabase Auth; die Zustimmungsseite liegt unter `/oauth/zustimmung`. Jede Abfrage läuft mit dem Token der Person, also unter Row Level Security wie auf der Website. Gespeichert wird immer als Entwurf.

Einmalig im Supabase-Dashboard einrichten (Authentication → **OAuth Server**, erledigt am 10.11.2026):

| Einstellung | Wert |
| --- | --- |
| OAuth 2.1 Server | eingeschaltet (in der Beta-Phase gratis) |
| Authorization Path | `/oauth/zustimmung` (wird an die Site URL angehängt) |
| Dynamic Client Registration | eingeschaltet (Claude registriert sich selbst) |

Empfohlen: unter Project Settings → **JWT Keys** auf asymmetrische Schlüssel (ES256/RS256) umstellen, dann prüft der Connector Tokens ohne Umweg über Supabase.

Prüfen:
- `https://coachlab-ch.netlify.app/.well-known/oauth-protected-resource/api/mcp` zeigt auf `https://mhijnhtwutzatekpstxg.supabase.co/auth/v1`.
- `https://coachlab-ch.netlify.app/api/mcp` ohne Anmeldung antwortet mit 401 und einem `WWW-Authenticate`-Header.
- Registrierte Clients sieht man unter Authentication → OAuth Server → Clients; dort regelmässig auf Unbekanntes prüfen.

Werkzeuge: `coachlab_vereine`, `coachlab_uebungen_suchen`, `coachlab_uebung_lesen`, `coachlab_uebungsformat`, `coachlab_uebung_pruefen`, `coachlab_uebung_speichern` (Code: `src/lib/mcp/`). Ändert sich der Animationsstandard, auch den Text in `src/lib/mcp/regeln.ts` nachführen.

Wechselt die Domain auf coachlab.com: Site URL in Supabase anpassen, dann wandert die Zustimmungsseite automatisch mit. Vereine müssen den Connector mit der neuen Adresse neu verbinden.

## Datenbank-Migrationen in Produktion einspielen

Migrationen liegen in `supabase/migrations/` und werden erst nach dem Merge in `main` eingespielt.

**Weg 1 (üblich): über Claude.** Der Supabase-Connector ist mit dem Projekt verbunden. Claude spielt gemergte Migrationen ein, prüft RLS und die Sicherheitshinweise und gleicht den Dateinamen im Repo an die von Supabase vergebene Version an.

**Weg 2: Supabase CLI.** Dafür braucht es das Datenbank-Passwort aus dem Passwort-Tresor.

```bash
npx supabase login                                   # einmalig, öffnet den Browser
npx supabase link --project-ref mhijnhtwutzatekpstxg # einmalig, fragt nach dem DB-Passwort
npx supabase db push                                 # spielt alle neuen Migrationen ein
```

Bei beiden Wegen danach im Supabase-Dashboard unter **Database → Tables** prüfen, dass bei jeder Tabelle «RLS enabled» steht.

### Eingespielte Migrationen

| Version | Name | Eingespielt |
| --- | --- | --- |
| 20261109144012 | mandanten | 9.11.2026 |
| 20261109145505 | einladungen | 9.11.2026 |
| 20261109153358 | uebungen | 9.11.2026 |
| 20261110091246 | oauth_reserviert | 10.11.2026 |

Hinweise des Supabase-Sicherheitschecks, die bewusst so sind:
- `verein_oeffentlich` ist ohne Login aufrufbar (security definer). Gewollt: liefert nur Name, Slug, Logo und Farben für Login-Seite und Branding, keine Abo-Daten.
- `einladung_pruefen` ist ohne Login aufrufbar. Gewollt: zeigt vor der Registrierung Verein und Rolle, nie E-Mail-Adressen. Codes sind 32 Zeichen zufällig.
- `einladung_annehmen` und `mitglieder_liste` sind für angemeldete Benutzer aufrufbar. Gewollt: beide prüfen intern E-Mail bzw. Owner/Admin-Rolle (Tests in `tests/einladungen.test.ts`).

Offener Hinweis, im Dashboard zu erledigen: **Leaked Password Protection** einschalten (Authentication → Sign In / Providers → Email). Sie prüft neue Passwörter gegen bekannte Datenlecks; je nach Supabase-Tarif erst ab Pro verfügbar.

## Admin-Wechsel

Siehe Projektplan, Checkliste «Betreiber-Admin wechselt».
