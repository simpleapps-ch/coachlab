import { z } from "zod";

/** Kennung der Anfrage von Supabase; nur harmlose Zeichen, weil sie in die URL zurückgeht. */
export const autorisierungsId = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
