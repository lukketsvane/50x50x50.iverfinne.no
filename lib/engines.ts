/**
 * Motorregisteret.
 *
 * Fire typologiar står ferdige, og dei er ikkje fire former. Dei er fire
 * svar på det same spørsmålet: korleis byggjer ein ei krum sitjeflate av
 * flate plater? Kvar av dei har sitt eige ledd, sitt eige spill og si
 * eiga grense, og det er grensene som skil dei — ikkje silhuetten.
 *
 * VAFFEL er svaret prosjektet landar på. Dei tre andre står som
 * argumentet kring valet: RIBBE er den næraste naboen (same leddet,
 * radialt i staden for kartesisk), SKIVE er den motsette enden (éi
 * retning, og difor ein fri kontur).
 *
 * Nedtrekket byter motor og ikkje form. Kvar motor held på sitt eige
 * punkt: byter du frå VAFFEL til STRAUM og attende, står VAFFEL-objektet
 * der du forlét det. Terningen kryssar aldri motorgrensa, av di eit tal i
 * eitt parameterrom ikkje tyder noko i eit anna.
 */
import type { EngineDef, EngineId } from "./core"
import { SKIVE } from "./skive/engine"
import { STRAUM } from "./straum/engine"
import { RIBBE } from "./ribbe/engine"
import { VAFFEL } from "./vaffel/engine"
import { BOYG } from "./boyg/engine"
import { VIKING } from "./viking/engine"

/**
 * ENGINES er det brukaren ser. UNDER_BYGGING er det som er under arbeid:
 * prøveskripta skal nå det, men nedtrekket skal ikkje. Ein motor som ikkje
 * er ferdig står framleis på stillaset sitt, og eit stillas er ein DUPLIKAT
 * av motoren det etterliknar. Fem like krakkar med ulike namn er ikkje
 * fem typologiar — det er ein feil brukaren møter før eg gjer det. Ein
 * motor vert flytta hit ned FYRST når han byggjer sin eigen geometri og
 * held alle fem portane.
 */
const UNDER_BYGGING: readonly EngineDef[] = [BOYG, VIKING]

// VAFFEL fyrst: han er standardobjektet, øvst i nedtrekket, og han er
// SLUTTPRODUKTET. Resten står som argumentet kring valet.
//
// SKIVE er ATTE. Han gjekk ut på argumentet om at han berre snittar éin
// veg og at VAFFEL og RIBBE seier alt han kan seie — og det argumentet
// var feil. Éin retning er ikkje ein fattigare versjon av to; det er ein
// ANNAN ting. Ei skive kan ha ein profil som ingen kryssholdt ribbe kan
// ha, av di ho ikkje treng møte nokon på tvers: heile konturen er fri.
// Det er difor mest kvar einaste papp- og finérkrakk i verda er skiver
// og ikkje vaflar, og ein sandkasse som ikkje kan lage dei manglar ikkje
// ein pose — han manglar eit svar.
//
// Tekne heilt ut, og kvar sin grunn: FLETT (vevne band — band er ikkje
// plate), KARVE (subtraktiv skulptur — flata vart graven ut av ei limt
// blokk, ikkje bygd av plater), KOTE (stabelen som aldri nådde flata:
// setet var riller), LAFT (han svara aldri på spørsmålet — han NEKTA
// det, og ei flat sitjeflate er eit anna prosjekt). SKAL er teken ut av
// registeret, men kjelda hans står att for dokumentpipelinen.
export const ENGINES: readonly EngineDef[] = [VAFFEL, SKIVE, STRAUM, RIBBE]

/** alt, ferdig og uferdig — det prøveskripta skal måle */
export const ALLE_MOTORAR: readonly EngineDef[] = [...ENGINES, ...UNDER_BYGGING]

export function getEngine(id: EngineId): EngineDef {
  return ALLE_MOTORAR.find((e) => e.id === id) ?? VAFFEL
}

export function isEngineId(v: unknown): v is EngineId {
  return typeof v === "string" && ALLE_MOTORAR.some((e) => e.id === v)
}
