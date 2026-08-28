/**
 * AVSTANDEN MELLOM TYPOLOGIANE.
 *
 * `lib/engines.ts` seier det sjølv: «eit stillas er ein DUPLIKAT av
 * motoren det etterliknar. Fem like krakkar med ulike namn er ikkje fem
 * typologiar.» Det er ein påstand som har vore umogleg å prøve, av di
 * motorane ikkje deler ein einaste parameter — `hjorne` i LAFT og
 * `planform` i VAFFEL er ikkje same akse, og ein kan ikkje trekkje dei
 * frå kvarandre. `scripts/laft-avstand.ts` måler avstanden mellom POSAR
 * inne i éin motor; dette måler avstanden mellom MOTORAR.
 *
 * Det som KAN samanliknast er det ferdige objektet. To typologiar som
 * kastar same skuggen frå alle tre sider, og som har same delelista, er
 * same krakken med to namn — same kor ulike likningane bak dei er.
 *
 * Difor to mål, og dei skal lesast saman:
 *
 *   SKUGGEN   Objektet vert rendra i «lag» — delane slik dei faktisk er,
 *             montert — og projisert på dei tre sideflatene i kuben.
 *             Kvar projeksjon er ei binær maske i eit fast rutenett, so
 *             alle motorar vert målte i det same rommet. Overlappet
 *             mellom to masker er Jaccard: snitt delt på union. 1,0 er
 *             same skugge.
 *   DELELISTA  Kor mange delar, kor mange ULIKE delar, og kor stripete
 *             dei er. Ein motor av tjue like ribber og ein av fem store
 *             plater er ikkje same produksjonsveg, same kva skuggen seier.
 *
 * Terskelen er ikkje sett, han er MÅLT: dei fem motorane som står i
 * nedtrekket i dag er per definisjon fem typologiar, so den likaste
 * paringa mellom dei er baren ein sjette må halde seg under.
 *
 *   npx tsx scripts/typologi-avstand.ts          alle motorar
 *   npx tsx scripts/typologi-avstand.ts 96       med eiga rutestorleik
 */
import { ALLE_MOTORAR } from "../lib/engines.ts"
import type { EngineDef } from "../lib/core.ts"

const N = Number(process.argv[2] ?? 72)
const KUBE = 500

const raud = (s: string) => `\x1b[31m${s}\x1b[0m`
const gron = (s: string) => `\x1b[32m${s}\x1b[0m`
const gul = (s: string) => `\x1b[33m${s}\x1b[0m`

/**
 * Dei tre skuggane, som binære masker. Trekantane vert rasteriserte og
 * ikkje berre hjørna sette: eit nett med få, store trekantar ville elles
 * få ein sil av ein skugge, og ein motor med mange små ville sjå tettare
 * ut enn han er — reint av oppløysing.
 */
function skuggar(e: EngineDef): Uint8Array[] {
  const b = e.build(e.defaults, "mid", "lag")
  const P = b.positions
  const masker = [new Uint8Array(N * N), new Uint8Array(N * N), new Uint8Array(N * N)]
  // objektet vert sentrert i kuben på x og y, og sett på golvet i z
  const mid = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]]
  const skala = N / KUBE
  const rute = (m: Uint8Array, u: number, v: number) => {
    const iu = Math.floor((u + KUBE / 2) * skala)
    const iv = Math.floor(v * skala)
    if (iu >= 0 && iu < N && iv >= 0 && iv < N) m[iv * N + iu] = 1
  }
  /** ein trekant, sampla tett nok til at ingen flate slepp gjennom */
  const tri = (ax: number[], bx: number[], cx: number[]) => {
    const kant = Math.max(
      Math.hypot(bx[0] - ax[0], bx[1] - ax[1], bx[2] - ax[2]),
      Math.hypot(cx[0] - ax[0], cx[1] - ax[1], cx[2] - ax[2]),
    )
    const S = Math.max(2, Math.min(48, Math.ceil((kant * skala) / 0.6)))
    for (let i = 0; i <= S; i++) {
      for (let j = 0; i + j <= S; j++) {
        const w0 = 1 - (i + j) / S
        const w1 = i / S
        const w2 = j / S
        const x = ax[0] * w0 + bx[0] * w1 + cx[0] * w2
        const y = ax[1] * w0 + bx[1] * w1 + cx[1] * w2
        const z = ax[2] * w0 + bx[2] * w1 + cx[2] * w2
        rute(masker[0], y, z) // framfrå: y opp mot z
        rute(masker[1], x, z) // frå sida: x opp mot z
        rute(masker[2], y, x + KUBE / 2) // ovanfrå: y mot x
      }
    }
  }
  for (let t = 0; t < P.length; t += 9) {
    const a = [P[t] - mid[0], P[t + 1] - mid[1], P[t + 2] - mid[2]]
    const b1 = [P[t + 3] - mid[0], P[t + 4] - mid[1], P[t + 5] - mid[2]]
    const c = [P[t + 6] - mid[0], P[t + 7] - mid[1], P[t + 8] - mid[2]]
    tri(a, b1, c)
  }
  return masker
}

/** Jaccard: snitt delt på union. 1 er same skugge, 0 er ingen overlapp. */
function jaccard(a: Uint8Array, b: Uint8Array): number {
  let snitt = 0
  let union = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++
    if (a[i] && b[i]) snitt++
  }
  return union ? snitt / union : 1
}

/** delelista, som tre tal ein kan samanlikne på tvers av motorar */
function delar(e: EngineDef) {
  const m = e.measure(e.defaults)
  const f = (id: string) => m.list.find((q) => q.id === id)?.value ?? 0
  return {
    tal: m.parts,
    ulike: f("unike") || m.units || 0,
    /** kor mykje plate per del: ein motor av mange små er ikkje ein av få store */
    perDel: m.parts > 0 ? m.plyArea / m.parts : 0,
  }
}

const motorar = [...ALLE_MOTORAR]
const sk = motorar.map(skuggar)
const dl = motorar.map(delar)

/**
 * Éin avstand av dei to måla. Skuggen tel mest — det er han som avgjer om
 * to objekt er den same krakken — men delelista får rette opp når to
 * ulike produksjonsvegar tilfeldigvis kastar same silhuett.
 */
function likskap(i: number, j: number): { skugge: number; delar: number; sum: number } {
  const s = (jaccard(sk[i][0], sk[j][0]) + jaccard(sk[i][1], sk[j][1]) + jaccard(sk[i][2], sk[j][2])) / 3
  const a = dl[i]
  const b = dl[j]
  const rel = (x: number, y: number) => (Math.max(x, y) > 0 ? Math.min(x, y) / Math.max(x, y) : 1)
  const d = (rel(a.tal, b.tal) + rel(a.perDel, b.perDel)) / 2
  return { skugge: s, delar: d, sum: 0.7 * s + 0.3 * d }
}

console.log(`TYPOLOGIAVSTAND — ${motorar.length} motorar, rutenett ${N} × ${N} over 500-kuben\n`)
console.log("delelista:")
motorar.forEach((e, i) =>
  console.log(
    `  ${e.id.padEnd(8)} ${String(dl[i].tal).padStart(3)} delar · ` +
      `${(dl[i].perDel / 100).toFixed(0).padStart(5)} cm² per del`,
  ),
)

const B = "      " + motorar.map((e) => e.id.slice(0, 6).padStart(7)).join("")
console.log("\nlikskap (1,00 = same krakk):")
console.log(B)
const par: { a: string; b: string; v: number; s: number; d: number }[] = []
motorar.forEach((e, i) => {
  const rad = motorar.map((_, j) => {
    if (i === j) return "      ·"
    const l = likskap(i, j)
    if (i < j) par.push({ a: e.id, b: motorar[j].id, v: l.sum, s: l.skugge, d: l.delar })
    return l.sum.toFixed(2).padStart(7)
  })
  console.log(e.id.slice(0, 6).padEnd(6) + rad.join(""))
})

par.sort((x, y) => y.v - x.v)
console.log("\ndei fem likaste paringane:")
for (const p of par.slice(0, 5)) {
  console.log(`  ${(p.a + "–" + p.b).padEnd(18)} ${p.v.toFixed(3)}   (skugge ${p.s.toFixed(2)} · delar ${p.d.toFixed(2)})`)
}

// --- baren -----------------------------------------------------------------
// Motorane i nedtrekket er per definisjon typologiar. Den likaste paringa
// mellom DEI er difor baren: ein motor som ligg nærare ein annan enn dei
// ligg innbyrdes, er ikkje ein sjette typologi.
const NEDTREKK = new Set(["vaffel", "skive", "straum", "ribbe", "laft"])
const innbyrdes = par.filter((p) => NEDTREKK.has(p.a) && NEDTREKK.has(p.b))
const bar = innbyrdes.length ? innbyrdes[0].v : 1
console.log(
  `\nbaren: den likaste paringa mellom dei fem i nedtrekket er ` +
    `${innbyrdes[0]?.a}–${innbyrdes[0]?.b} på ${bar.toFixed(3)}`,
)

let brot = 0
for (const p of par) {
  if (NEDTREKK.has(p.a) && NEDTREKK.has(p.b)) continue
  const namn = (p.a + "–" + p.b).padEnd(18)
  if (p.v > bar) {
    brot++
    console.log(raud(`  BROT ${namn} ${p.v.toFixed(3)} — likare enn baren`))
  } else if (p.v > bar * 0.88) {
    console.log(gul(`  knapt ${namn} ${p.v.toFixed(3)}`))
  }
}
if (brot) {
  console.log(raud(`\n${brot} paring(ar) er likare enn dei fem er innbyrdes`))
  process.exit(1)
}
console.log(gron("\nkvar motor er lenger frå kvar annan enn baren"))
