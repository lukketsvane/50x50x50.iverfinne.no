/**
 * LEDDPRØVA for LAFT — numerisk, ikkje visuell.
 *
 * Eit flatpakka møbel er ei samling plater som skal gripe i kvarandre og
 * ikkje gjennom kvarandre. Auget ser ikkje skilnaden på ein tapp som sit i
 * eit spor og ein tapp som står midt inne i naboplata: begge rendrar likt.
 * Difor denne fila. Ho svarar på to spørsmål med tal:
 *
 *   1 GJENNOM KVARANDRE  Deler to plater eitt einaste punkt materiale?
 *                        Då er sporet for smalt, feil plassert, eller
 *                        gløymt. Svaret skal alltid vera null.
 *   2 GRIP DEI I DET HEILE  For kvart par som SKAL vera i inngrep: går
 *                        den eine tvers gjennom planet til den andre,
 *                        innanfor omrisset hennar? Ein tapp som ikkje når
 *                        fram er like gale som ein som kolliderer, og han
 *                        ser endå betre ut.
 *
 *   npx tsx scripts/laft-ledd.ts          standardobjektet
 *   npx tsx scripts/laft-ledd.ts 2.0      med eiga rutestorleik i mm
 */
import { DEFAULT_PARAMS, POSAR, POSES, clampParams } from "../lib/laft/params.ts"
import { bygg, tilVerda, type Del } from "../lib/laft/profil.ts"
import type { Pt, Vec3 } from "../lib/core.ts"

const CELLE = Number(process.argv[2] ?? 2.5)
/** kontaktmargin: under dette er det ei felles flate, ikkje ein konflikt */
const TOL = Number(process.argv[3] ?? 0.8)

/** ligg punktet inne i ringen? Strålekast, med kanten som «inne». */
function iRing(ring: Pt[], x: number, y: number): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}

/** inne i delen sitt godsomriss: innanfor konturen og utanfor kvart hòl */
const iGods = (d: Del, x: number, y: number) =>
  iRing(d.outline, x, y) && !d.holes.some((h) => iRing(h, x, y))

/** frå verda inn i planet til ein del: (u, v, w) der w er langs normalen */
function tilPlan(d: Del, p: Vec3): [number, number, number] {
  const q: Vec3 = [p[0] - d.plass.o[0], p[1] - d.plass.o[1], p[2] - d.plass.o[2]]
  const pr = (a: Vec3) => q[0] * a[0] + q[1] * a[1] + q[2] * a[2]
  return [pr(d.plass.u), pr(d.plass.v), pr(d.plass.n)]
}

/** avstanden frå eit punkt inn til ein ring, positiv uansett side */
function tilRing(ring: Pt[], x: number, y: number): number {
  let d = Infinity
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const vx = b[0] - a[0]
    const vy = b[1] - a[1]
    const L = vx * vx + vy * vy || 1
    const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L))
    d = Math.min(d, Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t))
  }
  return d
}

/**
 * Er verdspunktet inne i denne plata — med margin?
 *
 * KONTAKT ER IKKJE KOLLISJON. Bladet sin overkant SKAL liggje mot
 * undersida av setet; det er heile grunnen til at setet ikkje dett ned.
 * Ei prøve som tel felles flate som konflikt ville dømt kvart einaste
 * ledd i møbelet. Difor tel eit punkt fyrst når det ligg meir enn
 * margin inne i naboen — både gjennom tjukna og inne i omrisset — og
 * det som står att er verkeleg materiale to stader samstundes.
 */
const iDel = (d: Del, p: Vec3, tol: number) => {
  const [u, v, w] = tilPlan(d, p)
  if (w < tol || w > d.t - tol) return false
  if (!iGods(d, u, v)) return false
  if (tilRing(d.outline, u, v) < tol) return false
  for (const h of d.holes) if (tilRing(h, u, v) < tol) return false
  return true
}

/** eit grovt punktskyv gjennom godset i ein del, i verdskoordinatar */
function punkt(d: Del, celle: number): Vec3[] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const q of d.outline) {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }
  const ut: Vec3[] = []
  const nw = Math.max(2, Math.round(d.t / celle))
  for (let y = y0 + celle / 2; y < y1; y += celle) {
    for (let x = x0 + celle / 2; x < x1; x += celle) {
      if (!iGods(d, x, y)) continue
      for (let k = 0; k < nw; k++) ut.push(tilVerda(d.plass, [x, y], ((k + 0.5) / nw) * d.t))
    }
  }
  return ut
}

// tredje argumentet er ein pose: prøva skal kunne peike på KVA punkt
// som helst, og det er posane som oftast ligg ute mot grensene
const POSE = process.argv[4]
const punktet = POSE
  ? clampParams({ ...DEFAULT_PARAMS, ...POSES[POSAR.findIndex((q) => q.namn === POSE)] }, DEFAULT_PARAMS)
  : DEFAULT_PARAMS
const b = bygg(punktet)
const delar = b.delar
console.log(`LEDDPRØVA ${POSE ?? "standard"} — ${delar.length} delar, rute ${CELLE} mm, kontaktmargin ${TOL} mm\n`)

for (const d of delar) {
  const ps = punkt(d, CELLE)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of ps) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0])
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1])
    z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2])
  }
  console.log(
    `  ${d.id.padEnd(4)} ${d.kind.padEnd(5)} x ${x0.toFixed(0).padStart(5)}..${x1.toFixed(0).padStart(4)}` +
      `  y ${y0.toFixed(0).padStart(5)}..${y1.toFixed(0).padStart(4)}` +
      `  z ${z0.toFixed(0).padStart(5)}..${z1.toFixed(0).padStart(4)}   ${ps.length} punkt`,
  )
}

// --- 1 GJENNOM KVARANDRE ---------------------------------------------------
console.log("\n1 · gjennom kvarandre — kvart par skal dele NULL materiale")
const sky = delar.map((d) => punkt(d, CELLE))
let verstKrasj = 0
for (let i = 0; i < delar.length; i++) {
  for (let j = i + 1; j < delar.length; j++) {
    const felles: Vec3[] = []
    let ni = 0
    let nj = 0
    for (const p of sky[i]) if (iDel(delar[j], p, TOL)) { felles.push(p); ni++ }
    for (const p of sky[j]) if (iDel(delar[i], p, TOL)) { felles.push(p); nj++ }
    const n = felles.length
    if (!n) continue
    verstKrasj = Math.max(verstKrasj, n)
    // Kvar konflikten LIGG seier kva slag feil det er: eit spor som
    // manglar heilt fyller heile tappen, eit som er for smalt gjev ein
    // tynn skorpe langs to kantar, og eit som står feil gjev ein klump
    // ute i eine enden.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const p of felles) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0])
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1])
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2])
    }
    const vol = (n * CELLE * CELLE * CELLE) / 1000
    console.log(
      `  KRASJ ${delar[i].id} × ${delar[j].id}   ${String(n).padStart(5)} punkt` +
        ` ≈ ${vol.toFixed(1)} cm³  (${ni} av ${delar[i].id} inne i ${delar[j].id}, ${nj} motsett)` +
        `   i x ${x0.toFixed(0)}..${x1.toFixed(0)}` +
        ` y ${y0.toFixed(0)}..${y1.toFixed(0)} z ${z0.toFixed(0)}..${z1.toFixed(0)}` +
        `   ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}×${(z1 - z0).toFixed(0)} mm`,
    )
  }
}
if (!verstKrasj) console.log("  ok   ingen delar deler materiale")

// --- 2 GRIP DEI ------------------------------------------------------------
// Ein del er i INNGREP med ein annan når godset hennar finst på BEGGE
// sider av det andre planet, innanfor det andre omrisset. Då går ho
// faktisk gjennom, og ikkje forbi.
console.log("\n2 · inngrep — kven går tvers gjennom kven")
for (let i = 0; i < delar.length; i++) {
  for (let j = 0; j < delar.length; j++) {
    if (i === j) continue
    const d = delar[j]
    let foran = 0
    let bak = 0
    for (const p of sky[i]) {
      const [u, v, w] = tilPlan(d, p)
      if (!iRing(d.outline, u, v)) continue
      if (w > d.t) foran++
      else if (w < 0) bak++
    }
    if (foran > 2 && bak > 2) {
      console.log(`  ok   ${delar[i].id} går tvers gjennom ${d.id}   ${bak} bak · ${foran} framfor`)
    }
  }
}

console.log(
  "\n" + (verstKrasj ? `\x1b[31m${verstKrasj} punkt i konflikt\x1b[0m` : "\x1b[32mledda held\x1b[0m"),
)
