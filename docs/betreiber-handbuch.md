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

Hinweise des Supabase-Sicherheitschecks, die bewusst so sind:
- `verein_oeffentlich` ist ohne Login aufrufbar (security definer). Gewollt: liefert nur Name, Slug, Logo und Farben für Login-Seite und Branding, keine Abo-Daten.

## Admin-Wechsel

Siehe Projektplan, Checkliste «Betreiber-Admin wechselt».
