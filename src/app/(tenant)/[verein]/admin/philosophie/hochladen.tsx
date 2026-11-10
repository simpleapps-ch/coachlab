"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hinweis, Knopf } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { aufbereiten } from "./actions";

const MAX_MB = 25;

/** PDF direkt in den Storage laden (Ordner des Vereins), dann auf dem Server aufbereiten. */
export function Hochladen({ verein, tenantId }: { verein: string; tenantId: string }) {
  const router = useRouter();
  const [stand, setStand] = useState<"bereit" | "laedt" | "liest">("bereit");
  const [fehler, setFehler] = useState<string | null>(null);

  async function senden(form: FormData) {
    setFehler(null);
    const datei = form.get("pdf");
    if (!(datei instanceof File) || datei.size === 0) return setFehler("Bitte eine PDF-Datei wählen.");
    if (datei.type !== "application/pdf" && !datei.name.toLowerCase().endsWith(".pdf")) {
      return setFehler("Bitte eine PDF-Datei wählen.");
    }
    if (datei.size > MAX_MB * 1024 * 1024) return setFehler(`Die Datei ist grösser als ${MAX_MB} MB.`);

    setStand("laedt");
    const pfad = `${tenantId}/${crypto.randomUUID()}.pdf`;
    const { error } = await createClient()
      .storage.from("philosophie")
      .upload(pfad, datei, { contentType: "application/pdf", upsert: false });
    if (error) {
      setStand("bereit");
      return setFehler("Hochladen fehlgeschlagen. Bitte nochmals versuchen.");
    }

    setStand("liest");
    const r = await aufbereiten({ verein, datei: pfad, dateiname: datei.name });
    setStand("bereit");
    if (r.fehler) return setFehler(r.fehler);
    router.refresh();
  }

  return (
    <form action={senden} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">PDF-Datei (höchstens {MAX_MB} MB)</span>
        <input
          type="file"
          name="pdf"
          accept="application/pdf,.pdf"
          required
          disabled={stand !== "bereit"}
          className="rounded-lg border border-neutral-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 dark:border-neutral-700 dark:bg-neutral-950 dark:file:bg-neutral-800"
        />
      </label>
      {fehler ? <Hinweis art="fehler">{fehler}</Hinweis> : null}
      <div>
        <Knopf type="submit" disabled={stand !== "bereit"}>
          {stand === "laedt" ? "Wird hochgeladen …" : stand === "liest" ? "Abschnitte werden erstellt …" : "Hochladen und aufbereiten"}
        </Knopf>
      </div>
    </form>
  );
}
