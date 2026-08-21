/**
 * KOTE — STILLAS.
 *
 * Denne fila er eit mellombels stillas so motoren står i registeret og
 * alle prøveskripta kan køyre medan typologien vert bygd. Han lyg: han
 * er SKIVE med eit anna namn. Han skal erstattast i sin heilskap — ikkje
 * byggjast vidare på.
 *
 * Typologien: vassrette lag stabla i høgda — møbelet som terreng
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const KOTE: EngineDef = {
  ...SKIVE,
  id: "kote",
  label: "kote",
  note: "vassrette lag stabla i høgda — møbelet som terreng",
}
