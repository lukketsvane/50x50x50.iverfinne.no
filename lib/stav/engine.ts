/**
 * STAV — STILLAS.
 *
 * Denne fila er eit mellombels stillas so motoren står i registeret og
 * alle prøveskripta kan køyre medan typologien vert bygd. Han lyg: han
 * er SKIVE med eit anna namn. Han skal erstattast i sin heilskap — ikkje
 * byggjast vidare på.
 *
 * Typologien: rundstav i massiv sete — kilte tappar, ingen skruv
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const STAV: EngineDef = {
  ...SKIVE,
  id: "stav",
  label: "stav",
  note: "rundstav i massiv sete — kilte tappar, ingen skruv",
}
