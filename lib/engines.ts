/**
 * Motorregisteret.
 *
 * Fire typologiar, og dei er ikkje fire former. Dei er fire svar på det
 * same spørsmålet: korleis byggjer ein ei krum sitjeflate av flate plater?
 * Kvar av dei har sitt eige ledd, sitt eige spill og si eiga grense, og
 * det er grensene som skil dei — ikkje silhuetten.
 *
 * Nedtrekket byter motor og ikkje form. Kvar motor held på sitt eige
 * punkt: byter du frå SKAL til STRAUM og attende, står SKAL-objektet der
 * du forlét det. Terningen kryssar aldri motorgrensa, av di eit tal i eitt
 * parameterrom ikkje tyder noko i eit anna.
 */
import type { EngineDef, EngineId } from "./core"
import { SKAL } from "./skal/engine"
// MOTORAR-UNDER-ARBEID: straum, ribbe og vaffel vert kopla inn her
export const ENGINES: readonly EngineDef[] = [SKAL]

export const ENGINE_IDS = ENGINES.map((e) => e.id) as readonly EngineId[]

export function getEngine(id: EngineId): EngineDef {
  return ENGINES.find((e) => e.id === id) ?? SKAL
}

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ENGINE_IDS.includes(v as EngineId)
}
