/**
 * FLETT — STILLAS.
 *
 * Denne fila er eit mellombels stillas so motoren står i registeret og
 * alle prøveskripta kan køyre medan typologien vert bygd. Han lyg: han
 * er SKIVE med eit anna namn. Han skal erstattast i sin heilskap — ikkje
 * byggjast vidare på.
 *
 * Typologien: fletta band over og under — flata som vev, ikkje som plate
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const FLETT: EngineDef = {
  ...SKIVE,
  id: "flett",
  label: "flett",
  note: "fletta band over og under — flata som vev, ikkje som plate",
}
