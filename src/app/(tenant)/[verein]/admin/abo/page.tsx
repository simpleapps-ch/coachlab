import type { Metadata } from "next";
import { Hinweis, Karte, Knopf } from "@/components/ui";
import { aboErlaubtZugriff } from "@/lib/stripe/abo";
import { nachCheckoutAbgleichen } from "@/lib/stripe/checkout";
import { createClient } from "@/lib/supabase/server";
import { nurVerwalter } from "@/lib/verein";
import { aboAbschliessen, aboVerwalten } from "./actions";

export const metadata: Metadata = { title: "Abo" };

type Abo = {
  plan: "monat" | "jahr" | "gratis" | null;
  abo_status: string;
  trial_ende: string | null;
  abo_periode_ende: string | null;
  abo_gekuendigt: boolean;
  stripe_customer_id: string | null;
};

const STATUS: Record<string, string> = {
  trialing: "Testphase",
  active: "aktiv",
  past_due: "Zahlung offen",
  canceled: "beendet",
  unpaid: "unbezahlt",
  incomplete: "noch nicht abgeschlossen",
};
const PLAN = { monat: "CHF 49.– pro Monat", jahr: "CHF 490.– pro Jahr", gratis: "Gratis" };
const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(s)) : "–";

export default async function AboSeite({ params, searchParams }: PageProps<"/[verein]/admin/abo">) {
  const { verein: slug } = await params;
  const { checkout, fehler } = await searchParams;
  const z = await nurVerwalter(slug);

  if (typeof checkout === "string") {
    try {
      await nachCheckoutAbgleichen(z.verein.id, checkout);
    } catch (e) {
      console.error("[stripe] Abgleich nach Checkout", e); // Webhook holt es nach
    }
  }

  // Mitglieder sehen ihre Vereinszeile (RLS); Abo-Felder sind lesbar, nur nicht schreibbar.
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("plan, abo_status, trial_ende, abo_periode_ende, abo_gekuendigt, stripe_customer_id")
    .eq("id", z.verein.id)
    .single();
  const abo = data as Abo;
  const gratis = abo.plan === "gratis";
  const zugriff = aboErlaubtZugriff(abo.abo_status);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Abo</h1>

      {typeof fehler === "string" ? <Hinweis art="fehler">{fehler}</Hinweis> : null}
      {typeof checkout === "string" && zugriff ? (
        <Hinweis art="erfolg">Danke! Das Abo ist abgeschlossen. Lade jetzt deine Trainer unter «Mitglieder» ein.</Hinweis>
      ) : null}
      {typeof checkout === "string" && !zugriff ? (
        <Hinweis>Die Zahlung wird bestätigt. Lade die Seite in einigen Sekunden neu.</Hinweis>
      ) : null}

      <Karte>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-neutral-500">Tarif</dt>
          <dd className="font-medium">{abo.plan ? PLAN[abo.plan] : "–"}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-medium">{gratis ? "aktiv, wird nie abgerechnet" : (STATUS[abo.abo_status] ?? abo.abo_status)}</dd>
          {!gratis && abo.abo_status === "trialing" ? (
            <>
              <dt className="text-neutral-500">Testphase bis</dt>
              <dd>{datum(abo.trial_ende)}</dd>
            </>
          ) : null}
          {!gratis && abo.abo_periode_ende && zugriff ? (
            <>
              <dt className="text-neutral-500">{abo.abo_gekuendigt ? "Läuft aus am" : "Nächste Abrechnung"}</dt>
              <dd>{datum(abo.abo_periode_ende)}</dd>
            </>
          ) : null}
        </dl>

        {gratis ? null : zugriff || abo.abo_status === "unpaid" ? (
          <form action={aboVerwalten} className="mt-6">
            <input type="hidden" name="verein" value={slug} />
            <Knopf type="submit">Abo verwalten</Knopf>
            <p className="mt-2 text-xs text-neutral-500">
              Zahlungsmittel ändern, Rechnungen herunterladen, zwischen Monat und Jahr wechseln oder kündigen (bei Stripe).
            </p>
          </form>
        ) : (
          <form action={aboAbschliessen} className="mt-6 flex flex-col gap-3">
            <input type="hidden" name="verein" value={slug} />
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">Abo abschliessen</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="plan" value="monat" defaultChecked /> CHF 49.– pro Monat
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="plan" value="jahr" /> CHF 490.– pro Jahr (2 Monate gratis)
              </label>
            </fieldset>
            <Knopf type="submit">Weiter zur Zahlung</Knopf>
            <p className="text-xs text-neutral-500">
              {abo.trial_ende ? "" : "14 Tage gratis testen. "}Bezahlt wird sicher über Stripe. Kündigung jederzeit auf Ende der Periode.
            </p>
          </form>
        )}
      </Karte>
      {!gratis && abo.abo_status === "past_due" ? (
        <Hinweis art="fehler">
          Die letzte Zahlung hat nicht geklappt. Stripe versucht es automatisch erneut. Bitte prüfe das Zahlungsmittel unter «Abo verwalten».
        </Hinweis>
      ) : null}
    </div>
  );
}
