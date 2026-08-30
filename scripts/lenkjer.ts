/**
 * LENKJEPRØVA: peikar ei gammal lenkje framleis på det same møbelet?
 *
 * `lib/hash.ts` lovar det, og det er eit løfte ingen annan prøve held
 * auge med: kontraktprøva byggjer alltid frå standarden, og poseprøva frå
 * posane. Ei lenkje er den einaste tilstanden i heile sandkassen som lever
 * UTANFOR koden — ho ligg i ein e-post, i eit dokument, i ein QR-kode på
 * eit ark — og difor er ho den einaste som ikkje kan rettast etterpå.
 *
 * Hasharane under er laga med koden slik han faktisk stod, og fasiten er
 * lesen ut av den same koden same dagen. Dei skal ALDRI endrast. Kjem eit
 * nytt band til i ein motor, får han ein ny bokstav, den gamle vert lagd
 * inn i GAMLE_BAND, og ei ny rad vert lagd til her — ho vert ikkje bytt ut.
 *
 *   npx tsx scripts/lenkjer.ts
 */
import { getEngine } from "../lib/engines.ts"
import { kortHash, lesHash } from "../lib/hash.ts"

type Prove = {
  namn: string
  hash: string
  /** kva hashen SKAL avkode til — eit utval felt, ikkje heile sekken */
  fasit: Record<string, number | string>
}

const PROVAR: readonly Prove[] = [
  // --- VAFFEL v1, bokstav «v» — 24 band, før ryggfall og skålkant ----------
  {
    namn: "vaffel v1 · standard",
    hash: "vIvfAD96fvNvxB4QOApewOn8jOS",
    fasit: { hogd: 432, planA: 172, planB: 180, ribbX: 8, ribbY: 8, rygg: 0, view: "lag", beis: "natur" },
  },
  {
    namn: "vaffel v1 · lågrygg",
    hash: "vlA5YHodgT07F_QyKSzCRcZOl-",
    fasit: { hogd: 418, planA: 198, ribbX: 7, rygg: 66, view: "flate", beis: "aho" },
  },
  // --- RIBBE v1, bokstav «r» — 36 band, før bladtupp og leddeling ----------
  {
    namn: "ribbe v1 · standard",
    hash: "rzEnIien-x4BCHAOzFrBk0ZwaE4llqX_yF3MLn",
    fasit: { seatZ: 448, blades: 22, bladeT: 11, bandW: 40, bands: 3, view: "lag", beis: "natur" },
  },
  {
    namn: "ribbe v1 · vridd",
    hash: "rBvkkE8REhIyCZYm-4wbsdcOQYhPJFdwETXuHGX",
    fasit: { seatZ: 448, blades: 26, twist: 22, bandW: 52, view: "kontur", beis: "petrol" },
  },
]

/** band som ikkje fanst i v1 skal stå på standarden sin etter ei v1-lenkje */
const NYE_BAND: Record<string, readonly string[]> = {
  vaffel: ["ryggV", "skaal"],
  ribbe: ["bladTupp", "bandLapp"],
}

let feil = 0
const nei = (s: string) => {
  feil++
  console.log(`  \x1b[31m${s}\x1b[0m`)
}

console.log("== gamle lenkjer ==")
for (const pr of PROVAR) {
  const les = lesHash(pr.hash)
  if (!les) {
    nei(`${pr.namn}: avkoda ikkje i det heile`)
    continue
  }
  const eng = getEngine(les.engine)
  const p = eng.clamp(les.obj, eng.defaults) as Record<string, number>
  const galne: string[] = []
  for (const [k, v] of Object.entries(pr.fasit)) {
    const fekk = typeof v === "number" ? p[k] : les.obj[k]
    if (typeof v === "number" ? Math.abs((fekk as number) - v) > 1e-6 : fekk !== v) {
      galne.push(`${k} ${fekk} != ${v}`)
    }
  }
  // eit band som ikkje fanst då lenkja vart delt, kan ikkje ha ein verdi
  // frå henne — det skal stå på standarden
  const d = eng.defaults as Record<string, number>
  for (const k of NYE_BAND[les.engine] ?? []) {
    if (p[k] !== d[k]) galne.push(`${k} ${p[k]} != standard ${d[k]}`)
  }
  if (galne.length) nei(`${pr.namn}: ${galne.join(", ")}`)
  else console.log(`  ok   ${pr.namn}`)
}

console.log("\n== rundgang på det som står i dag ==")
for (const eng of [getEngine("vaffel"), getEngine("ribbe"), getEngine("straum")]) {
  const h = kortHash(eng.id, eng.defaults, "lag", "natur")
  const attende = lesHash(h)
  if (!attende || attende.engine !== eng.id) {
    nei(`${eng.id}: rundgangen kom attende som ${attende?.engine ?? "ingenting"}`)
    continue
  }
  const p = eng.clamp(attende.obj, eng.defaults) as Record<string, number>
  const d = eng.defaults as Record<string, number>
  const avvik = eng.keys.filter((k) => Math.abs((p[k] ?? 0) - (d[k] ?? 0)) > 1e-6)
  if (avvik.length) nei(`${eng.id}: ${avvik.join(", ")} kom ikkje heilskinna attende`)
  else console.log(`  ok   ${eng.id} · ${h.length} teikn · bokstav «${h[0]}»`)
}

console.log(
  feil ? `\n\x1b[31m${feil} lenkjer peikar feil\x1b[0m` : "\n\x1b[32malle lenkjer held\x1b[0m",
)
process.exit(feil ? 1 : 0)
