/**
 * BRETT — STILLAS.
 *
 * Denne fila er eit mellombels stillas so motoren står i registeret og
 * alle prøveskripta kan køyre medan typologien vert bygd. Han lyg: han
 * er SKIVE med eit anna namn. Han skal erstattast i sin heilskap — ikkje
 * byggjast vidare på.
 *
 * Typologien: EI plate, sagd og bretta — heile møbelet av eitt stykke
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const BRETT: EngineDef = {
  ...SKIVE,
  id: "brett",
  label: "brett",
  note: "EI plate, sagd og bretta — heile møbelet av eitt stykke",
}
