/**
 * Motorregisteret.
 *
 * Fem typologiar står ferdige, og dei er ikkje fem former. Dei fire fyrste
 * er fire svar på det same spørsmålet: korleis byggjer ein ei krum
 * sitjeflate av flate plater? Kvar av dei har sitt eige ledd, sitt eige
 * spill og si eiga grense, og det er grensene som skil dei — ikkje
 * silhuetten. LAFT er den femte, og han svarar ikkje: han NEKTAR
 * spørsmålet. Ei plate er ei plate, seier han, komforten kjem av vinklar,
 * og flata får vera flat. Eit argument treng begge endane av rommet sitt.
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
import { BOYG } from "./boyg/engine"
import { LAFT } from "./laft/engine"

/**
 * ENGINES er det brukaren ser. UNDER_BYGGING er det som er under arbeid:
 * prøveskripta skal nå det, men nedtrekket skal ikkje. Ein motor som ikkje
 * er ferdig står framleis på stillaset sitt, og eit stillas er ein DUPLIKAT
 * av motoren det etterliknar. Fem like krakkar med ulike namn er ikkje
 * fem typologiar — det er ein feil brukaren møter før eg gjer det. Ein
 * motor vert flytta hit ned FYRST når han byggjer sin eigen geometri og
 * held alle fem portane.
 */
const UNDER_BYGGING: readonly EngineDef[] = [BOYG]

// VAFFEL fyrst: han er standardobjektet og øvst i nedtrekket. SKAL er
// teken ut — kjelda hans står att for dokumentpipelinen, men han er ikkje
// lenger ein modul i sandkassen. KOTE og KARVE er tekne HEILT ut, som
// FLETT før dei, og av same grunn: dei svara på andre spørsmål. KARVE
// var subtraktiv skulptur — flata vart graven ut av ei limt blokk, ikkje
// bygd av plater — og stod på éin prosent styrke same kva avlen tok.
// KOTE var stabelen som aldri nådde flata: setet var riller, ikkje ei
// krum flate. Fire svar på EITT spørsmål er argumentet; seks var støy.
export const ENGINES: readonly EngineDef[] = [VAFFEL, SKIVE, STRAUM, RIBBE, LAFT]

/** alt, ferdig og uferdig — det prøveskripta skal måle */
export const ALLE_MOTORAR: readonly EngineDef[] = [...ENGINES, ...UNDER_BYGGING]

export function getEngine(id: EngineId): EngineDef {
  return ALLE_MOTORAR.find((e) => e.id === id) ?? VAFFEL
}

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ALLE_MOTORAR.some((e) => e.id === v)
}
