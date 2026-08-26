/**
 * DEN KORTE LENKJA — #s=
 *
 * Hashen kodar objektet, og berre objektet: parametrane, materialet,
 * lesemåten og beisen. Den gamle #p=-forma var JSON og over tusen teikn —
 * for langt til ein QR-kode, linedelt i e-post. Denne forma kvantiserer
 * kvart band til sitt eige steg og pakkar indeksane i blanda radiks:
 * kring 30–60 teikn etter motor. Under informasjonsgrensa (PLAN 3.3)
 * kjem ein ikkje; dette ligg tett på henne.
 *
 * REGLANE:
 *  - #p= vert lese for alltid. Ei lenkje som sluttar å verke er ei
 *    lenkje som aldri burde vore delt.
 *  - All avkoding går gjennom motoren sin eigen clamp. Hashen er ikkje
 *    til å stole på, og ei laga lenkje skal ikkje kunne skyve eit tal
 *    utanfor bandet sitt.
 *  - Rekkjefylgjene her er FROSNE. Ein ny motor, beis eller eit nytt
 *    materiale VERT LAGT TIL bakarst; å flytte eller fjerne eit ledd er
 *    å brekkje kvar delte lenkje. Endrar eit band min/max/step, må
 *    versjonsbokstaven bytast og den gamle avkodinga stå att.
 */
import type { EngineId, ParamBag, View } from "./core"
import { getEngine, isEngineId } from "./engines"

/** Versjonen av kodinga — byt bokstav om banda endrar seg. «a» levde eit
 *  par timar på ei førehandsvising og las view med radiks 3; «b» gjev dei
 *  tre små felta fast radiks med rom å vekse i, so eit nytt ledd aldri
 *  meir krev ein ny bokstav. */
const VERSJON = "b"

/** motor → bokstav, fryst. Fjerna motorar (flett, kote, karve) fekk
 *  aldri ein bokstav; lenkjene deira var #p= og fell til standard. */
const MOTOR_BOKSTAV: Record<string, string> = {
  vaffel: "v",
  skive: "k",
  straum: "s",
  ribbe: "r",
  boyg: "b",
  skal: "l",
}
const BOKSTAV_MOTOR: Record<string, EngineId> = Object.fromEntries(
  Object.entries(MOTOR_BOKSTAV).map(([m, b]) => [b, m as EngineId]),
)

/** Frosne rekkjefylgjer for dei tre vala utanfor parameterrommet — nye
 *  ledd VERT LAGDE TIL bakarst. Radiksane har rom å vekse i, so eit
 *  tillegg aldri flytter eit einaste bit. */
const VIEWS: readonly View[] = ["flate", "lag", "kontur", "last"]
const VIEW_RADIX = 8
const MATERIAL: readonly string[] = ["bjork", "bok", "poppel"]
const MATERIAL_RADIX = 8
const BEIS: readonly string[] = [
  "natur", "aho", "kvit", "petrol", "marine", "gron", "rust", "svart",
]
const BEIS_RADIX = 16

/** kor mange trinn eit band har — indeksane går frå 0 til og med steps */
const trinn = (min: number, max: number, step: number) =>
  Math.max(1, Math.round((max - min) / step))

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

function tilBase64url(acc: bigint): string {
  if (acc === 0n) return B64[0]
  let s = ""
  while (acc > 0n) {
    s = B64[Number(acc & 63n)] + s
    acc >>= 6n
  }
  return s
}

function fraBase64url(s: string): bigint | null {
  let acc = 0n
  for (const ch of s) {
    const i = B64.indexOf(ch)
    if (i < 0) return null
    acc = (acc << 6n) | BigInt(i)
  }
  return acc
}

/** Objektet som står på skjermen → «#s=…» (utan #). */
export function kortHash(
  engine: EngineId,
  params: ParamBag,
  view: View,
  beis: string,
): string {
  const eng = getEngine(engine)
  const bokstav = MOTOR_BOKSTAV[engine] ?? MOTOR_BOKSTAV.vaffel
  let acc = 0n
  const legg = (idx: number, radix: number) => {
    acc = acc * BigInt(radix) + BigInt(Math.min(radix - 1, Math.max(0, idx)))
  }
  legg(Math.max(0, VIEWS.indexOf(view)), VIEW_RADIX)
  legg(Math.max(0, BEIS.indexOf(beis)), BEIS_RADIX)
  legg(Math.max(0, MATERIAL.indexOf(String(params.material))), MATERIAL_RADIX)
  for (const k of eng.keys) {
    const r = eng.ranges[k]
    const n = trinn(r.min, r.max, r.step)
    const v = typeof params[k] === "number" ? (params[k] as number) : r.min
    legg(Math.round((Math.min(r.max, Math.max(r.min, v)) - r.min) / r.step), n + 1)
  }
  return "s=" + VERSJON + bokstav + tilBase64url(acc)
}

/**
 * Hashen (utan #) → det råaste laget: motor-id og ein sekk med tal, som
 * SKAL gjennom motoren sin clamp etterpå. Begge formene vert lesne:
 * #p= (JSON, for alltid) og #s= (kvantisert). Alt som ikkje let seg
 * lese, gjev null — og då står objektet som stod.
 */
export function lesHash(
  raw: string,
): { engine: EngineId; obj: Record<string, unknown> } | null {
  if (raw.startsWith("p=")) {
    try {
      const obj = JSON.parse(decodeURIComponent(raw.slice(2))) as Record<string, unknown>
      const engine = isEngineId(obj.engine) ? obj.engine : "vaffel"
      return { engine, obj }
    } catch {
      return null
    }
  }
  if (!raw.startsWith("s=")) return null
  const versjon = raw[2]
  if (versjon !== VERSJON) return null
  const engine = BOKSTAV_MOTOR[raw[3]]
  if (!engine || !isEngineId(engine)) return null
  let acc = fraBase64url(raw.slice(4))
  if (acc === null) return null
  const eng = getEngine(engine)
  // same felt, motsett veg: siste felt ut fyrst
  const dra = (radix: number) => {
    const d = Number(acc! % BigInt(radix))
    acc = acc! / BigInt(radix)
    return d
  }
  const obj: Record<string, unknown> = { engine }
  for (const k of [...eng.keys].reverse()) {
    const r = eng.ranges[k]
    const n = trinn(r.min, r.max, r.step)
    obj[k] = +(r.min + dra(n + 1) * r.step).toFixed(4)
  }
  // ein indeks utanfor lista (frå ei framtidig lenkje) fell stilt til standard
  obj.material = MATERIAL[dra(MATERIAL_RADIX)] ?? MATERIAL[0]
  obj.beis = BEIS[dra(BEIS_RADIX)] ?? BEIS[1]
  obj.view = VIEWS[dra(VIEW_RADIX)] ?? VIEWS[1]
  return { engine, obj }
}
