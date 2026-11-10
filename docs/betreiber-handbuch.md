# Betreiber-Handbuch Coachlab

Für die Admins der Simpleapps.ch GmbH. Bei jeder Änderung an Konten, Abläufen oder Tools im selben Pull Request nachführen.

## Konten

Alle Konten laufen auf die Funktionsadresse und haben mindestens zwei Admins. Zugangsdaten liegen im geteilten Passwort-Tresor.

| Dienst | Zweck | Status | Admin 1 | Admin 2 |
| --- | --- | --- | --- | --- |
| GitHub Organization `simpleapps-ch` | Code | eingerichtet | | |
| Netlify Team | Hosting, Deploy-Vorschauen | eingerichtet | | |
| Supabase Organization | Datenbank, Login, Dateien (Region EU, Frankfurt), Projekt `mhijnhtwutzatekpstxg`, Region eu-west-1 (Irland) | eingerichtet | | |
| Stripe | Abo und Rechnungen, Konto Simpleapps.ch GmbH (Test-Modus) | eingerichtet | | |
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
| `STRIPE_SECRET_KEY` | ja | Stripe > Developers > API keys (eingeschränkter Key, siehe unten) |
| `STRIPE_WEBHOOK_SECRET` | ja | Stripe > Developers > Webhooks > Endpunkt > Signing secret |

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

## Stripe (Abo)

Ein Abo pro Verein, Stripe Billing mit gehostetem Checkout und Kundenportal. Code: `src/lib/stripe/`, Webhook `src/app/api/stripe/webhook/route.ts`, Seiten `/registrieren` und `/<verein>/admin/abo`.

| Was | Wert (Test-Modus) |
| --- | --- |
| Produkt | `coachlab_verein` «Coachlab Verein», Steuercode `txcd_10103001` (SaaS, geschäftliche Nutzung) |
| Preise | `coachlab_verein_monat` CHF 49.– / Monat, `coachlab_verein_jahr` CHF 490.– / Jahr (lookup_key, Preise inkl. allfälliger MWST) |
| Testphase | 14 Tage, Zahlungsmittel wird beim Start hinterlegt, nur beim ersten Abo eines Vereins |
| Kundenportal | Zahlungsmittel, Rechnungen, Wechsel Monat ↔ Jahr (Jahr → Monat erst auf Periodenende), Kündigung auf Periodenende |
| MWST | keine: Simpleapps.ch GmbH ist nicht MWST-pflichtig. Stripe Tax überwacht die Schwelle (Tax → Locations). Wird die GmbH pflichtig: Registrierung CH in Stripe Tax erfassen und `automatic_tax` im Checkout einschalten. |

Ablauf: `/registrieren` legt Konto und Verein an (`abo_status = incomplete`), dann Stripe Checkout. Der Webhook setzt danach `trialing`, `active`, `past_due`, `canceled` usw. Vereine mit Tarif `gratis` (Zug94) überspringt der Webhook immer; sie haben keinen Stripe-Kunden.

**Webhook-Endpunkt** (Stripe > Developers > Webhooks, Test-Modus angelegt am 10.11.2026, `we_1UaBoNPIw1X2ZCKgYFPj69nn`): `https://coachlab-ch.netlify.app/api/stripe/webhook` mit den Ereignissen aus `EREIGNISSE` in `src/lib/stripe/webhook.ts`:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `charge.refunded`, `radar.early_fraud_warning.created`.
Das Signing secret (`whsec_…`) trägt eine Betreiber-Person selbst in Netlify ein.

**API-Key:** eingeschränkter Key (`rk_…`) mit Schreibrechten auf Customers, Checkout Sessions, Customer portal, Subscriptions und Leserechten auf Prices, Charges. Nie in den Chat oder ins Repo.

Einstellungen im Dashboard (einmalig, auch im Live-Modus): Billing → Revenue recovery: Smart Retries ein, E-Mails bei fehlgeschlagener Zahlung ein; Settings → Customer emails: Quittungen und Rechnungen ein.

Backlog: Zahlung auf Rechnung (Überweisung) nach ersten Kundenrückmeldungen entscheiden.

## Philosophie (Storage)

Vereine laden ihre Philosophie als PDF hoch. Das PDF liegt im privaten Supabase-Storage-Bucket `philosophie` unter `<tenant_id>/<zufall>.pdf` (nur PDF, höchstens 25 MB; angelegt durch die Migration `philosophie`). Owner/Admins laden hoch und löschen, Trainer lesen nur die freigegebene Datei (Storage-Policies). Die aufbereiteten Abschnitte stehen in der Tabelle `philosophien`. Code: `src/lib/philosophie/` (Erkennung in `aufbereiten.ts`, getestet), Seiten `/<verein>/philosophie` und `/<verein>/admin/philosophie`.

Lässt sich ein PDF schlecht aufbereiten (z. B. eingescannt oder mit ungewöhnlichem Aufbau), bleibt «Original ansehen» als Rückfall. Verbesserungen an der Erkennung wirken erst beim nächsten Hochladen.

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
| 20261110095746 | abo | 10.11.2026 |
| 20261110110512 | philosophie | 10.11.2026 |

Hinweise des Supabase-Sicherheitschecks, die bewusst so sind:
- `verein_oeffentlich` ist ohne Login aufrufbar (security definer). Gewollt: liefert nur Name, Slug, Logo und Farben für Login-Seite und Branding, keine Abo-Daten.
- `einladung_pruefen` ist ohne Login aufrufbar. Gewollt: zeigt vor der Registrierung Verein und Rolle, nie E-Mail-Adressen. Codes sind 32 Zeichen zufällig.
- `slug_frei` ist ohne Login aufrufbar. Gewollt: sagt nur, ob eine Vereinsadresse frei ist (Registrierungsformular); dass ein Verein existiert, zeigt die Login-Seite ohnehin.
- `verein_registrieren` ist für angemeldete Benutzer aufrufbar. Gewollt: legt höchstens einen Verein ohne Abo pro Person an, die Person wird Owner (Tests in `tests/abo-db.test.ts`).
- `philosophie_freigeben` ist für angemeldete Benutzer aufrufbar. Gewollt: prüft intern Owner/Admin (Tests in `tests/philosophie-db.test.ts`).
- `stripe_events` hat RLS ohne Policy. Gewollt: nur der Webhook (Service-Role) liest und schreibt.
- `einladung_annehmen` und `mitglieder_liste` sind für angemeldete Benutzer aufrufbar. Gewollt: beide prüfen intern E-Mail bzw. Owner/Admin-Rolle (Tests in `tests/einladungen.test.ts`).

Offener Hinweis: **Leaked Password Protection** ist aus, weil sie den Pro-Tarif braucht (Projekt läuft auf Free). Wird beim Go-live eingeschaltet, siehe Checkliste unten.

## Checkliste Go-live

Vor dem ersten zahlenden Verein abarbeiten:

- [ ] Supabase auf **Pro** wechseln (tägliche Backups, keine Pausierung).
- [ ] **Leaked Password Protection** einschalten: Authentication → Sign In / Providers → Email → «Prevent use of leaked passwords». Danach Sicherheitscheck (get_advisors) prüfen.
- [ ] Passwortregeln verschärfen (mindestens 10 Zeichen, Ziffern, Gross- und Kleinbuchstaben).
- [ ] Domain coachlab.com bei Netlify, `NEXT_PUBLIC_ROOT_DOMAIN` setzen, Site URL und Redirect URLs in Supabase anpassen.
- [ ] Connector-Adresse auf `https://coachlab.com/api/mcp` umstellen (Admin-Handbuch, `plugin/.mcp.json`); Vereine verbinden neu.
- [ ] Stripe im Live-Modus: Konto aktivieren, Produkt, Preise (gleiche lookup_keys) und Kundenportal im Live-Modus anlegen, Webhook-Endpunkt live, eingeschränkten Live-Key und Live-Signing-Secret in Netlify (nur Production). Zug94 bleibt gratis.
- [ ] Datenschutzerklärung und AGB veröffentlichen und im Stripe-Kundenportal verlinken.

## Admin-Wechsel

Siehe Projektplan, Checkliste «Betreiber-Admin wechselt».
