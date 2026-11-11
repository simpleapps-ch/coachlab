"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Schützt Vereinsinhalte im Browser: Ist die Sitzung weg (abgemeldet, abgelaufen, in einem
 * anderen Tab abgemeldet), geht es sofort zur Login-Seite. Wichtig für «Zurück» nach dem
 * Abmelden, weil der Browser Seiten dann ohne Anfrage an den Server aus dem Speicher zeigt.
 * Der Server prüft den Zugang ohnehin bei jeder Anfrage; dies schliesst nur die Lücke im Browser.
 */
export function Sitzungswaechter({ loginPfad, benutzerId }: { loginPfad: string; benutzerId: string }) {
  useEffect(() => {
    const supabase = createClient();
    let erledigt = false;
    const raus = () => {
      if (erledigt) return;
      erledigt = true;
      window.location.replace(loginPfad);
    };
    const pruefen = async () => {
      if (erledigt) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return raus();
      // Inzwischen jemand anderes angemeldet: Seite frisch vom Server holen
      if (data.session.user.id !== benutzerId) {
        erledigt = true;
        window.location.reload();
      }
    };
    const { data: abo } = supabase.auth.onAuthStateChange((ereignis) => {
      if (ereignis === "SIGNED_OUT") raus();
    });
    const beiAnzeige = (e: PageTransitionEvent) => {
      if (e.persisted) void pruefen(); // aus dem Zurück-Speicher des Browsers wiederhergestellt
    };
    const beiSichtbar = () => {
      if (document.visibilityState === "visible") void pruefen();
    };
    const beiNavigation = () => void pruefen();

    void pruefen();
    window.addEventListener("pageshow", beiAnzeige);
    window.addEventListener("popstate", beiNavigation);
    window.addEventListener("focus", beiNavigation);
    document.addEventListener("visibilitychange", beiSichtbar);
    return () => {
      abo.subscription.unsubscribe();
      window.removeEventListener("pageshow", beiAnzeige);
      window.removeEventListener("popstate", beiNavigation);
      window.removeEventListener("focus", beiNavigation);
      document.removeEventListener("visibilitychange", beiSichtbar);
    };
  }, [loginPfad, benutzerId]);

  return null;
}
