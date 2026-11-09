import type { Metadata } from "next";
import Link from "next/link";
import { Karte, Knopf } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { aktuelleOrigin, nurVerwalter, vereinsBasis } from "@/lib/verein";
import { einladungLoeschen, mitgliedAendern } from "./actions";
import { EinladungFormular, LinkKopieren } from "./einladung-formular";

export const metadata: Metadata = { title: "Mitglieder" };

type Mitglied = {
  user_id: string;
  email: string;
  name: string | null;
  rolle: "owner" | "admin" | "trainer";
  status: "wartet" | "aktiv" | "gesperrt";
};

type Einladung = {
  id: string;
  email: string | null;
  code: string;
  rolle: string;
  gueltig_bis: string;
};

const ROLLE = { owner: "Technische Leitung", admin: "Admin", trainer: "Trainer" };
const STATUS = {
  wartet: "wartet auf Freischaltung",
  aktiv: "aktiv",
  gesperrt: "gesperrt",
};

const datum = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "numeric", year: "numeric" });

export default async function MitgliederSeite({ params }: PageProps<"/[verein]/admin/mitglieder">) {
  const { verein: slug } = await params;
  const z = await nurVerwalter(slug);
  const basis = await vereinsBasis(slug);
  const origin = await aktuelleOrigin();
  const supabase = await createClient();

  const [{ data: mitglieder }, { data: einladungen }] = await Promise.all([
    supabase.rpc("mitglieder_liste", { p_tenant: z.verein.id }),
    supabase
      .from("invitations")
      .select("id, email, code, rolle, gueltig_bis")
      .eq("tenant_id", z.verein.id)
      .is("angenommen_am", null)
      .gt("gueltig_bis", new Date().toISOString())
      .order("erstellt_am", { ascending: false }),
  ]);

  const liste = (mitglieder ?? []) as Mitglied[];
  const offen = (einladungen ?? []) as Einladung[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`${basis}/`} className="text-sm text-neutral-500 hover:underline">
          ← {z.verein.name}
        </Link>
        <h1 className="text-2xl font-semibold">Mitglieder</h1>
      </div>

      <Karte>
        <h2 className="mb-4 font-semibold">Jemanden einladen</h2>
        <EinladungFormular verein={slug} />
      </Karte>

      {offen.length > 0 ? (
        <Karte>
          <h2 className="mb-4 font-semibold">Offene Einladungen</h2>
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {offen.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>{e.email ?? "Vereinscode"}</strong>{" "}
                    <span className="text-neutral-500">
                      · {ROLLE[e.rolle as keyof typeof ROLLE] ?? e.rolle} · gültig bis{" "}
                      {datum.format(new Date(e.gueltig_bis))}
                    </span>
                  </span>
                  <form action={einladungLoeschen}>
                    <input type="hidden" name="verein" value={slug} />
                    <input type="hidden" name="id" value={e.id} />
                    <Knopf art="gefahr" klein>
                      Zurückziehen
                    </Knopf>
                  </form>
                </div>
                <LinkKopieren link={`${origin}${basis}/einladung?code=${e.code}`} />
              </li>
            ))}
          </ul>
        </Karte>
      ) : null}

      <Karte>
        <h2 className="mb-4 font-semibold">Mitglieder ({liste.length})</h2>
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {liste.map((m) => {
            const ich = m.user_id === z.benutzer.id;
            const aenderbar = !ich && m.rolle !== "owner";
            return (
              <li
                key={m.user_id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.name ?? m.email} {ich ? <span className="text-neutral-400">(du)</span> : null}
                  </p>
                  <p className="truncate text-sm text-neutral-500">
                    {m.email} · {ROLLE[m.rolle]} ·{" "}
                    <span className={m.status === "wartet" ? "font-medium text-amber-600" : ""}>
                      {STATUS[m.status]}
                    </span>
                  </p>
                </div>
                {aenderbar ? (
                  <form action={mitgliedAendern} className="flex flex-wrap gap-2">
                    <input type="hidden" name="verein" value={slug} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    {m.status === "wartet" ? (
                      <Knopf name="aktion" value="freischalten" klein>
                        Freischalten
                      </Knopf>
                    ) : null}
                    {m.status === "aktiv" && m.rolle === "trainer" ? (
                      <Knopf name="aktion" value="zu_admin" art="sekundaer" klein>
                        Zu Admin
                      </Knopf>
                    ) : null}
                    {m.status === "aktiv" && m.rolle === "admin" ? (
                      <Knopf name="aktion" value="zu_trainer" art="sekundaer" klein>
                        Zu Trainer
                      </Knopf>
                    ) : null}
                    {m.status === "aktiv" ? (
                      <Knopf name="aktion" value="sperren" art="sekundaer" klein>
                        Sperren
                      </Knopf>
                    ) : null}
                    {m.status === "gesperrt" ? (
                      <Knopf name="aktion" value="entsperren" art="sekundaer" klein>
                        Entsperren
                      </Knopf>
                    ) : null}
                    <Knopf name="aktion" value="entfernen" art="gefahr" klein>
                      Entfernen
                    </Knopf>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Karte>
    </div>
  );
}
