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
import { SKIVE } from "./skive/engine"
import { STRAUM } from "./straum/engine"
import { RIBBE } from "./ribbe/engine"
import { VAFFEL } from "./vaffel/engine"
import { KOTE } from "./kote/engine"
import { FLETT } from "./flett/engine"
import { BRETT } from "./brett/engine"
import { STAV } from "./stav/engine"
import { SKRIN } from "./skrin/engine"

// VAFFEL fyrst: han er standardobjektet og øvst i nedtrekket. SKAL er
// teken ut av registeret — kjelda hans står att for dokumentpipelinen,
// men han er ikkje lenger ein modul i sandkassen.
export const ENGINES: readonly EngineDef[] = [
  VAFFEL, SKIVE, STRAUM, RIBBE,
  KOTE, FLETT, BRETT, STAV, SKRIN,
]

export const ENGINE_IDS = ENGINES.map((e) => e.id) as readonly EngineId[]

export function getEngine(id: EngineId): EngineDef {
  return ENGINES.find((e) => e.id === id) ?? VAFFEL
}

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ENGINE_IDS.includes(v as EngineId)
}
