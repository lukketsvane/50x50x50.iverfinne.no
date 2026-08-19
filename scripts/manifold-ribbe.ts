/**
 * Held nettet, og held kuben?
 *
 * Kvar retta kant skal ha nøyaktig éin motpart som går andre vegen:
 * «utan motpart 0, ueinig retning 0» er kravet. Prøva går på begge dei to
 * nettvisningane, på alle tre detaljnivåa, og på tretti tilfeldige objekt —
 * eit nett som berre er lukka i standardpunktet er ikkje lukka.
 */
import { build } from "../lib/ribbe/mesh.ts"
import { DEFAULT_PARAMS, randomParams } from "../lib/ribbe/params.ts"
import { CUBE, seeded, type DetailKey, type View } from "../lib/core.ts"

function probe(m: { positions: Float32Array; tris: number }) {
  const q = 1e3
  const vid = new Map<string, number>()
  const id = (i: number) => {
    const k = [0, 1, 2].map((c) => Math.round(m.positions[i * 3 + c] * q)).join(",")
    let x = vid.get(k)
    if (x === undefined) {
      x = vid.size
      vid.set(k, x)
    }
    return x
  }
  const key = (a: number, b: number) => `${a}|${b}`
  const dir = new Map<string, number>()
  for (let t = 0; t < m.tris; t++) {
    const a = id(t * 3)
    const b = id(t * 3 + 1)
    const c = id(t * 3 + 2)
    for (const [u, w] of [
      [a, b],
      [b, c],
      [c, a],
    ] as [number, number][]) {
      dir.set(key(u, w), (dir.get(key(u, w)) ?? 0) + 1)
    }
  }
  let bad = 0
  let border = 0
  let dup = 0
  for (const [k, n] of dir) {
    const [u, w] = k.split("|").map(Number)
    const back = dir.get(key(w, u)) ?? 0
    if (n > 1) dup++
    if (back === 0) border++
    else if (back !== n) bad++
  }
  let vol = 0
  for (let t = 0; t < m.tris; t++) {
    const P = (i: number) => [
      m.positions[(t * 3 + i) * 3],
      m.positions[(t * 3 + i) * 3 + 1],
      m.positions[(t * 3 + i) * 3 + 2],
    ]
    const [a, b, c] = [P(0), P(1), P(2)]
    vol +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6
  }
  return { edges: dir.size, border, bad, dup, vol }
}

const views: View[] = ["flate", "lag"]
const details: DetailKey[] = ["lav", "mid", "hog"]
for (const v of views) {
  for (const d of details) {
    const m = build(DEFAULT_PARAMS, d, v)
    const r = probe(m)
    console.log(
      `${v}/${d}: trekantar ${m.tris}  retta kantar ${r.edges}  utan motpart ${r.border}  ueinig retning ${r.bad}  duplikat ${r.dup}  volum ${(r.vol / 1e6).toFixed(2)} dm³`,
    )
  }
}

let worstSpan = 0
let over = 0
let broken = 0
for (let i = 1; i <= 30; i++) {
  const p = randomParams(seeded("ribbe" + i), DEFAULT_PARAMS)
  for (const v of views) {
    const m = build(p, "mid", v)
    const r = probe(m)
    if (r.border || r.bad || r.vol <= 0) {
      broken++
      console.log(`  ${i} ${v}: utan motpart ${r.border}  ueinig ${r.bad}  volum ${r.vol.toFixed(0)}`)
    }
    if (v === "lag") {
      const s = Math.max(m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2])
      if (s > worstSpan) worstSpan = s
      if (s > CUBE) {
        over++
        console.log(`  ${i}: ${s.toFixed(1)} mm — UTANFOR KUBEN`)
      }
    }
  }
}
console.log(
  `30 tilfeldige objekt · ${broken} med opne nett · største mål ${worstSpan.toFixed(1)} mm · ${over} utanfor kuben`,
)
