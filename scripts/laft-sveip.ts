/**
 * LEDDSVEIPET — leddprøva over HEILE rommet, ikkje berre standardpunktet.
 *
 * Eit ledd som held i eitt punkt seier ingen ting om dei andre. Sporet er
 * rekna av gjesten, so det følgjer geometrien når ho endrar seg — men
 * kva som RØRER kva endrar seg òg, og eit blad som i standardpunktet går
 * klar av ryggen kan skjere tvers gjennom han tjue millimeter lenger
 * framme. Difor denne: same prøva, køyrd på kvar kuratert pose og eit
 * sveip av terningkast, med berre det verste ut.
 *
 *   npx tsx scripts/laft-sveip.ts          posane + 40 kast
 *   npx tsx scripts/laft-sveip.ts 80       eige tal kast
 */
import { seeded, type Pt, type Vec3 } from "../lib/core.ts"
import { LAFT } from "../lib/laft/engine.ts"
import { DEFAULT_PARAMS, POSAR, POSES, clampParams, type Params } from "../lib/laft/params.ts"
import { bygg, tilVerda, type Del } from "../lib/laft/profil.ts"

const KAST = Number(process.argv[2] ?? 40)
const CELLE = 3
const TOL = 0.8

function iRing(ring: Pt[], x: number, y: number): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}
const iGods = (d: Del, x: number, y: number) =>
  iRing(d.outline, x, y) && !d.holes.some((h) => iRing(h, x, y))

function tilPlan(d: Del, p: Vec3): [number, number, number] {
  const q: Vec3 = [p[0] - d.plass.o[0], p[1] - d.plass.o[1], p[2] - d.plass.o[2]]
  const pr = (a: Vec3) => q[0] * a[0] + q[1] * a[1] + q[2] * a[2]
  return [pr(d.plass.u), pr(d.plass.v), pr(d.plass.n)]
}
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
const iDel = (d: Del, p: Vec3, tol: number) => {
  const [u, v, w] = tilPlan(d, p)
  if (w < tol || w > d.t - tol) return false
  if (!iGods(d, u, v)) return false
  if (tilRing(d.outline, u, v) < tol) return false
  for (const h of d.holes) if (tilRing(h, u, v) < tol) return false
  return true
}
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

/** krasjvolum i cm³ per par, og kva par som er verst */
function proev(p: Params) {
  const b = bygg(p)
  const delar = b.delar
  const sky = delar.map((d) => punkt(d, CELLE))
  let sum = 0
  let verst = ""
  let verstN = 0
  const engasjert = new Set<string>()
  for (let i = 0; i < delar.length; i++) {
    for (let j = i + 1; j < delar.length; j++) {
      let n = 0
      for (const q of sky[i]) if (iDel(delar[j], q, TOL)) n++
      for (const q of sky[j]) if (iDel(delar[i], q, TOL)) n++
      sum += n
      if (n > verstN) { verstN = n; verst = `${delar[i].id}×${delar[j].id}` }
    }
  }
  // grip dei? kvar del må gå tvers gjennom minst éi anna
  for (let i = 0; i < delar.length; i++) {
    for (let j = 0; j < delar.length; j++) {
      if (i === j) continue
      const d = delar[j]
      let foran = 0
      let bak = 0
      for (const q of sky[i]) {
        const [u, v, w] = tilPlan(d, q)
        if (!iRing(d.outline, u, v)) continue
        if (w > d.t) foran++
        else if (w < 0) bak++
      }
      if (foran > 2 && bak > 2) engasjert.add(delar[i].id)
    }
  }
  const laus = delar.filter((d) => !engasjert.has(d.id)).map((d) => d.id)
  return { vol: (sum * CELLE ** 3) / 1000, verst, verstN, laus, delar: delar.length }
}

const rader: [string, Params][] = []
rader.push(["standard", DEFAULT_PARAMS])
// namna kjem frå motoren sjølv — ei hardkoda liste her vart utdatert
// same dagen posane vart bytte, og då peika prøva på feil stol
POSES.forEach((q, i) => rader.push([POSAR[i]?.namn ?? "pose " + i, clampParams({ ...DEFAULT_PARAMS, ...q }, DEFAULT_PARAMS)]))
let bag: any = LAFT.defaults
for (let i = 0; i < KAST; i++) {
  bag = LAFT.random(seeded("sveip-" + i), LAFT.defaults, new Set())
  rader.push(["kast " + i, bag as Params])
}

let feil = 0
const verstelista: [number, string][] = []
for (const [namn, p] of rader) {
  const r = proev(p)
  const daarleg = r.vol > 0.4 || r.laus.length > 0
  if (daarleg) feil++
  const merk = daarleg ? "  FEIL" : "  ok  "
  const linje = `${merk} ${namn.padEnd(10)} krasj ${r.vol.toFixed(2).padStart(7)} cm³` +
    (r.verstN ? `  verst ${r.verst}` : "") +
    (r.laus.length ? `   LAUSE DELAR: ${r.laus.join(",")}` : "")
  if (daarleg || namn.length < 9) console.log(linje)
  verstelista.push([r.vol, namn])
}
verstelista.sort((a, b) => b[0] - a[0])
console.log("\nverste fem:", verstelista.slice(0, 5).map(([v, n]) => `${n} ${v.toFixed(2)}`).join(" · "))
console.log(feil ? `\x1b[31m${feil} av ${rader.length} punkt har brote geometri\x1b[0m` : `\x1b[32malle ${rader.length} punkta held ledda\x1b[0m`)
