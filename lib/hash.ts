/**
 * DEN KORTE LENKJA.
 *
 * Hashen kodar objektet, og berre objektet: parametrane, materialet,
 * lesemåten og beisen. Den gamle #p=-forma var JSON og over tusen teikn —
 * for langt til ein QR-kode, linedelt i e-post. Denne forma kvantiserer
 * kvart band til sitt eige steg og pakkar indeksane i blanda radiks, og
 * ho er så kort som ho KAN vere: éin bokstav som ber både motor og
 * versjon, so nyttelasta — som ligg på informasjonsgrensa (summen av
 * log2 av trinna i banda, PLAN 3.3). For VAFFEL er heile hashen kring
 * 28 teikn. Under det kjem ingen utan å kaste trinn.
 *
 * REGLANE:
 *  - #p= vert lese for alltid. Ei lenkje som sluttar å verke er ei
 *    lenkje som aldri burde vore delt.
 *  - All avkoding går gjennom motoren sin eigen clamp. Hashen er ikkje
 *    til å stole på, og ei laga lenkje skal ikkje kunne skyve eit tal
 *    utanfor bandet sitt.
 *  - Rekkjefylgjene her er FROSNE. Ein ny motor, beis eller eit nytt
 *    materiale VERT LAGT TIL bakarst; å flytte eller fjerne eit ledd er
 *    å brekkje kvar delte lenkje. Endrar eit band min/max/step, får
 *    motoren ein NY bokstav og den gamle avkodinga står att.
 */
import type { EngineId, ParamBag, View } from "./core"
import { getEngine, isEngineId } from "./engines"

/**
 * Motor → bokstav, fryst. Bokstaven ber òg versjonen: endrar banda i ein
 * motor seg, får han ein ny bokstav (t.d. store V for vaffel v2) og den
 * gamle står att i tabellen og les gamle lenkjer. Bokstaven «p» er
 * verna (#p= er JSON-forma), og base64url-teikna i nyttelasta kan aldri
 * innehalde «=», so formene kan ikkje forvekslast. Fjerna motorar
 * (flett, kote, karve) fekk aldri ein bokstav. SKIVE og LAFT rakk å få
 * kvar sin — «k» og «f» — før dei vart tekne ut. Dei to bokstavane er
 * BRENDE og skal aldri gjevast til ein ny motor, so ei gammal SKIVE-
 * eller LAFT-lenkje avkodar til ingenting i staden for til feil møbel.
 *
 * VAFFEL og RIBBE står på versjon TO. Formspennrunda gav VAFFEL to nye
 * band (ryggfall og skålkant) og eit vidare ryggband, og RIBBE to nye
 * (bladtupp og leddeling) og eit vidare bandbreiddband. Nye band flyttar
 * kvar einaste siffer i nyttelasta, so dei to fekk kvar sin nye bokstav —
 * store «V» og «R» — og dei gamle, små «v» og «r», les framleis dei
 * gamle lenkjene gjennom GAMLE_BAND under. Det er heile grunnen til at
 * den tabellen finst: ei delt lenkje skal peike på det møbelet ho vart
 * delt av, og aldri på eit anna.
 */
const MOTOR_BOKSTAV: Record<string, string> = {
  vaffel: "V",
  straum: "s",
  ribbe: "R",
  boyg: "b",
  skal: "l",
}
const BOKSTAV_MOTOR: Record<string, EngineId> = {
  ...Object.fromEntries(Object.entries(MOTOR_BOKSTAV).map(([m, b]) => [b, m as EngineId])),
  // dei gamle versjonane: same motor, eige bandoppsett
  v: "vaffel",
  r: "ribbe",
}

/**
 * Dei frosne banda til dei gamle versjonane: [nøkkel, min, steg, trinn], i
 * NØYAKTIG den rekkjefylgja koding brukte den gongen. Meir treng ikkje ei
 * avkoding: verdien er min + indeks·steg, og radiksen er trinn + 1.
 *
 * Nøklar som ikkje finst i motoren lenger fell stilt bort i clampen hans,
 * og nøklar som er komne til etterpå får standardverdien sin same stad.
 * Difor treng ikkje tabellen vedlikehald når motoren endrar seg vidare —
 * han skal STÅ, og ein ny versjon får ein ny bokstav og ein ny post.
 */
const GAMLE_BAND: Record<string, readonly (readonly [string, number, number, number])[]> = {
  // VAFFEL v1 — 24 band, slik dei stod til RYGGFALL og SKÅLKANT kom til
  v: [
    ["planN", 2, 0.05, 80],
    ["planA", 130, 1, 115],
    ["planB", 130, 1, 115],
    ["hogd", 350, 1, 120],
    ["fot", 0.55, 0.005, 160],
    ["midje", 0, 0.005, 68],
    ["midjeZ", 0.18, 0.005, 108],
    ["midjeW", 0.14, 0.005, 96],
    ["skulder", 0.86, 0.005, 60],
    ["lut", -50, 1, 100],
    ["sokk", 0, 0.5, 84],
    ["framkant", 0, 0.5, 52],
    ["rygg", 0, 1, 70],
    ["kantR", 2, 0.5, 48],
    ["ribbX", 3, 1, 12],
    ["ribbY", 3, 1, 12],
    ["ribbT", 6, 0.5, 36],
    ["pressfit", 0.05, 0.01, 35],
    ["lapp", 0.3, 0.01, 40],
    ["bogeH", 0, 0.005, 172],
    ["bogeBX", 0, 0.005, 180],
    ["bogeBY", 0, 0.005, 180],
    ["bogeN", 1.4, 0.05, 72],
    ["fresD", 4, 0.5, 16],
  ],
  // RIBBE v1 — 36 band, slik dei stod til BLADTUPP og LEDDELING kom til
  r: [
    ["planN", 2, 0.05, 90],
    ["planAsp", -0.5, 0.005, 200],
    ["planR", 120, 1, 140],
    ["flikar", 0, 1, 8],
    ["flik", 0, 0.005, 44],
    ["footR", 0.4, 0.005, 130],
    ["taper", 0.5, 0.01, 190],
    ["waist", 0, 0.005, 72],
    ["waistZ", 0.2, 0.005, 130],
    ["waistW", 0.12, 0.005, 116],
    ["swell", 0, 0.005, 60],
    ["blades", 6, 1, 28],
    ["bladeT", 8, 0.5, 32],
    ["twist", -40, 1, 80],
    ["inner", 0.02, 0.005, 68],
    ["innerZ", 0.15, 0.005, 150],
    ["innerW", -0.6, 0.01, 160],
    ["footArc", 0, 1, 150],
    ["hubGap", 0, 0.5, 48],
    ["bands", 2, 1, 4],
    ["bandZ0", 0.04, 0.005, 72],
    ["bandZ1", 0.55, 0.005, 84],
    ["bandT", 8, 0.5, 32],
    ["bandW", 22, 0.5, 96],
    ["bandOut", 0, 0.5, 68],
    ["seatZ", 360, 1, 120],
    ["seatT", 16, 0.5, 36],
    ["dish", 0, 0.5, 52],
    ["moon", 0, 0.005, 100],
    ["moonR", 0.5, 0.01, 170],
    ["moneV", 0, 5, 72],
    ["lip", 0, 0.5, 52],
    ["fit", 0.05, 0.05, 23],
    ["relief", 3, 0.5, 18],
    ["corner", 0, 0.5, 28],
    ["bit", 2, 0.5, 16],
  ],
}

/** Frosne rekkjefylgjer for dei tre vala utanfor parameterrommet — nye
 *  ledd VERT LAGDE TIL bakarst. Radiksane har rom å vekse i, so eit
 *  tillegg aldri flytter eit einaste bit. */
const VIEWS: readonly View[] = ["flate", "lag", "kontur", "last"]
const VIEW_RADIX = 8
// Nye ledd bakarst, aldri i midten: radiksen har rom, so MDF og akryl
// kunne leggjast til utan at eit einaste bit i ei gammal lenkje flytte seg.
const MATERIAL: readonly string[] = ["bjork", "bok", "poppel", "mdf", "akryl"]
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
  return bokstav + tilBase64url(acc)
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
  // Overgangsforma «s=b<bokstav>…» levde nokre timar på førehandsvisinga;
  // ho vert lesen ved å skrelle av prefikset. Ho kan ikkje forvekslast med
  // ein berr straum-hash («s…»), for base64url har ingen «=».
  const bare = raw.startsWith("s=b") ? raw.slice(3) : raw
  const engine = BOKSTAV_MOTOR[bare[0]]
  if (!engine || !isEngineId(engine)) return null
  let acc = fraBase64url(bare.slice(1))
  if (acc === null) return null
  const eng = getEngine(engine)
  // same felt, motsett veg: siste felt ut fyrst
  const dra = (radix: number) => {
    const d = Number(acc! % BigInt(radix))
    acc = acc! / BigInt(radix)
    return d
  }
  // Ein gammal bokstav les det gamle bandoppsettet; ein ny les motoren
  // slik han står i dag.
  const gamal = GAMLE_BAND[bare[0]]
  const band: readonly (readonly [string, number, number, number])[] =
    gamal ??
    eng.keys.map((k) => {
      const r = eng.ranges[k]
      return [k, r.min, r.step, trinn(r.min, r.max, r.step)] as const
    })
  const obj: Record<string, unknown> = { engine }
  for (let i = band.length - 1; i >= 0; i--) {
    const [k, min, step, n] = band[i]
    obj[k] = +(min + dra(n + 1) * step).toFixed(4)
  }
  // ein indeks utanfor lista (frå ei framtidig lenkje) fell stilt til standard
  obj.material = MATERIAL[dra(MATERIAL_RADIX)] ?? MATERIAL[0]
  obj.beis = BEIS[dra(BEIS_RADIX)] ?? BEIS[1]
  obj.view = VIEWS[dra(VIEW_RADIX)] ?? VIEWS[1]
  return { engine, obj }
}
