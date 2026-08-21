/**
 * FLETT — STILLAS.
 *
 * Mellombels: han er SKIVE med eit anna namn, so registeret kompilerer og
 * prøveskripta kan køyre medan typologien vert bygd. Han står i
 * UNDER_BYGGING og difor IKKJE i nedtrekket — ein motor som ikkje er
 * ferdig er ein duplikat, og ein duplikat har ingen ting på ei live side
 * å gjere. Fila skal erstattast i sin heilskap.
 *
 * Typologien: fletta band over og under — flata som vev, ikkje som plate
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const FLETT: EngineDef = { ...SKIVE, id: "flett", label: "flett", note: "fletta band over og under — flata som vev, ikkje som plate" }
