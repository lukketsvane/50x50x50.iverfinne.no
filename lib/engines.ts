/**
 * Motorregisteret.
 *
 * Fire typologiar står ferdige, og dei er ikkje fire former. Dei er fire
 * svar på det same spørsmålet: korleis byggjer ein ei krum sitjeflate av
 * flate plater? Kvar av dei har sitt eige ledd, sitt eige spill og si eiga
 * grense, og det er grensene som skil dei — ikkje silhuetten.
 *
 * Nedtrekket byter motor og ikkje form. Kvar motor held på sitt eige
 * punkt: byter du frå SKIVE til STRAUM og attende, står SKIVE-objektet der
 * du forlét det. Terningen kryssar aldri motorgrensa, av di eit tal i eitt
 * parameterrom ikkje tyder noko i eit anna.
 */
import type { EngineDef, EngineId } from "./core"
import { SKIVE } from "./skive/engine"
import { STRAUM } from "./straum/engine"
import { RIBBE } from "./ribbe/engine"
import { VAFFEL } from "./vaffel/engine"
import { KOTE } from "./kote/engine"
import { KARVE } from "./karve/engine"
import { BOYG } from "./boyg/engine"

/**
 * ENGINES er det brukaren ser. UNDER_BYGGING er det som er under arbeid:
 * prøveskripta skal nå det, men nedtrekket skal ikkje. Ein motor som ikkje
 * er ferdig står framleis på stillaset sitt, og eit stillas er ein DUPLIKAT
 * av motoren det etterliknar. Fire like krakkar med ulike namn er ikkje
 * fire typologiar — det er ein feil brukaren møter før eg gjer det. Ein
 * motor vert flytta hit ned FYRST når han byggjer sin eigen geometri og
 * held alle fem portane.
 */
const UNDER_BYGGING: readonly EngineDef[] = [BOYG]

// VAFFEL fyrst: han er standardobjektet og øvst i nedtrekket. SKAL er
// teken ut — kjelda hans står att for dokumentpipelinen, men han er ikkje
// lenger ein modul i sandkassen.
export const ENGINES: readonly EngineDef[] = [VAFFEL, SKIVE, STRAUM, RIBBE, KOTE, KARVE]

/** alt, ferdig og uferdig — det prøveskripta skal måle */
export const ALLE_MOTORAR: readonly EngineDef[] = [...ENGINES, ...UNDER_BYGGING]

export const ENGINE_IDS = ENGINES.map((e) => e.id) as readonly EngineId[]

export function getEngine(id: EngineId): EngineDef {
  return ALLE_MOTORAR.find((e) => e.id === id) ?? VAFFEL
}

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ALLE_MOTORAR.some((e) => e.id === v)
}
