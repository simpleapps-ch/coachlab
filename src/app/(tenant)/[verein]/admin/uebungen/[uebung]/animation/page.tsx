import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimationsEditor } from "@/components/animation/editor";
import { Hinweis } from "@/components/ui";
import { uebungsSlug } from "@/lib/uebung-schema";
import { ladeUebung } from "@/lib/uebungen";
import { nurVerwalter, vereinsBasis } from "@/lib/verein";
import { animationSpeichern } from "./actions";

export const metadata: Metadata = { title: "Animation bearbeiten" };

/** Animations-Editor: nur Technische Leitung und Admins, für Computer und Tablet. */
export default async function AnimationBearbeiten({ params }: PageProps<"/[verein]/admin/uebungen/[uebung]/animation">) {
  const { verein: slug, uebung: uebungRoh } = await params;
  const z = await nurVerwalter(slug);
  if (!uebungsSlug.safeParse(uebungRoh).success) notFound();
  const basis = await vereinsBasis(slug);
  const d = await ladeUebung(z.verein.id, uebungRoh);
  if (!d) notFound();

  const detail = `${basis}/uebungen/${uebungRoh}`;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={detail} className="text-sm text-neutral-500 hover:underline">
          ← Zurück zur Übung
        </Link>
        <h1 className="text-2xl font-semibold">Animation bearbeiten</h1>
        <p className="mt-1 text-sm text-neutral-500">{d.karte.titel}</p>
      </div>
      {d.ok ? (
        <AnimationsEditor
          verein={slug}
          uebung={d.uebung}
          stand={d.karte.geaendert_am}
          freigegeben={d.karte.status === "freigegeben"}
          zurueck={detail}
          speichern={animationSpeichern}
        />
      ) : (
        <Hinweis art="fehler">
          Diese Übung entspricht nicht dem Pflichtformat und lässt sich hier nicht bearbeiten. Korrigiere sie mit
          Claude. Fehler: {d.fehler.slice(0, 5).join("; ")}
        </Hinweis>
      )}
    </div>
  );
}
