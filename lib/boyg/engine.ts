/**
 * BOYG — STILLAS.
 *
 * Mellombels: han er SKIVE med eit anna namn, so registeret kompilerer og
 * prøveskripta kan køyre medan typologien vert bygd. Han står i
 * UNDER_BYGGING og difor IKKJE i nedtrekket — ein motor som ikkje er
 * ferdig er ein duplikat, og ein duplikat har ingen ting på ei live side
 * å gjere. Fila skal erstattast i sin heilskap.
 *
 * Typologien: pressbøygde skal nesta i kvarandre, pinna på éin stav
 */
import type { EngineDef } from "../core"
import { SKIVE } from "../skive/engine"

export const BOYG: EngineDef = { ...SKIVE, id: "boyg", label: "bøyg", note: "pressbøygde skal nesta i kvarandre, pinna på éin stav" }
