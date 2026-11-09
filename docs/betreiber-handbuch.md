# Betreiber-Handbuch Coachlab

Für die Admins der Simpleapps.ch GmbH. Bei jeder Änderung an Konten, Abläufen oder Tools im selben Pull Request nachführen.

## Konten

Alle Konten laufen auf die Funktionsadresse und haben mindestens zwei Admins. Zugangsdaten liegen im geteilten Passwort-Tresor.

| Dienst | Zweck | Status | Admin 1 | Admin 2 |
| --- | --- | --- | --- | --- |
| GitHub Organization `simpleapps-ch` | Code | eingerichtet | | |
| Netlify Team | Hosting, Deploy-Vorschauen | eingerichtet | | |
| Supabase Organization | Datenbank, Login, Dateien (Region EU, Frankfurt), Projekt `mhijnhtwutzatekpstxg` | eingerichtet | | |
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

Migrationen liegen in `supabase/migrations/` und werden erst nach dem Merge in `main` eingespielt. Dafür braucht es das Datenbank-Passwort aus dem Passwort-Tresor.

```bash
npx supabase login                                   # einmalig, öffnet den Browser
npx supabase link --project-ref mhijnhtwutzatekpstxg # einmalig, fragt nach dem DB-Passwort
npx supabase db push                                 # spielt alle neuen Migrationen ein
```

Danach im Supabase-Dashboard unter **Database → Tables** prüfen, dass bei jeder Tabelle «RLS enabled» steht.

## Admin-Wechsel

Siehe Projektplan, Checkliste «Betreiber-Admin wechselt».
