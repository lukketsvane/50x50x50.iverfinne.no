/**
 * GEOMETRI-REVISOREN.
 *
 * Prøver kvart nett på det som ikkje syns før det syns: opne kantar (hòl i
 * skalet), kantar to flater går SAME veg over (vrengde naboar), samanhengande
 * komponentar med negativt volum (delar som er vrengde innsida-ut), og
 * utarta trekantar. Kvar komponent vert funnen med union-find over kvantiserte
 * hjørne, og volumet hennar rekna kvar for seg — eit nett av mange lukka
 * delar skal ha KVAR del lukka og KVAR del vend ut.
 *
 *   npx tsx scripts/geometri.ts          alle motorar, standard + terning
 *   npx tsx scripts/geometri.ts skive    berre éin
 */
import { seeded } from "../lib/core.ts"
import { ENGINES } from "../lib/engines.ts"

/** held punktet dei harde reglane? Geometrikrava gjeld byggbare design —
 *  eit design som alt er raudt får ha slivers, men aldri NaN. */
function buildable(e: (typeof ENGINES)[number], p: Record<string, number | string>): boolean {
  try {
    const m = e.measure(p)
    return e.rules(p, m).every((r) => r.ok || !r.hard)
  } catch {
    return false
  }
}

type Mesh = { positions: Float32Array; tris: number }

function audit(m: Mesh) {
  const Q = 1e3
  const vid = new Map<string, number>()
  let nv = 0
  const ids = new Int32Array(m.tris * 3)
  for (let i = 0; i < m.tris * 3; i++) {
    const k = [0, 1, 2]
      .map((c) => Math.round(m.positions[i * 3 + c] * Q))
      .join(",")
    let v = vid.get(k)
    if (v === undefined) {
      v = nv++
      vid.set(k, v)
    }
    ids[i] = v
  }

  // union-find over hjørna: kva komponent kvar trekant høyrer til
  const parent = new Int32Array(nv)
  for (let i = 0; i < nv; i++) parent[i] = i
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    while (parent[i] !== r) {
      const n = parent[i]
      parent[i] = r
      i = n
    }
    return r
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let t = 0; t < m.tris; t++) {
    unite(ids[t * 3], ids[t * 3 + 1])
    unite(ids[t * 3], ids[t * 3 + 2])
  }

  // kantar, volum og boks per komponent
  const edges = new Map<string, number>()
  const compVol = new Map<number, number>()
  const compBox = new Map<number, [number, number, number, number, number, number]>()
  let degen = 0
  let nan = 0
  const P = m.positions
  for (let t = 0; t < m.tris; t++) {
    const a = ids[t * 3]
    const b = ids[t * 3 + 1]
    const c = ids[t * 3 + 2]
    const i = t * 9
    for (let q = 0; q < 9; q++) if (!Number.isFinite(P[i + q])) nan++
    // utarta: to kvantiserte hjørne fell saman
    if (a === b || b === c || c === a) {
      degen++
      continue
    }
    for (const [u, w] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = u + "," + w
      edges.set(k, (edges.get(k) ?? 0) + 1)
    }
    const comp = find(a)
    let bx = compBox.get(comp)
    if (!bx) {
      bx = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
      compBox.set(comp, bx)
    }
    for (let q = 0; q < 9; q += 3) {
      for (let c2 = 0; c2 < 3; c2++) {
        const v = P[i + q + c2]
        if (v < bx[c2]) bx[c2] = v
        if (v > bx[3 + c2]) bx[3 + c2] = v
      }
    }
    const d =
      P[i] * (P[i + 4] * P[i + 8] - P[i + 5] * P[i + 7]) -
      P[i + 1] * (P[i + 3] * P[i + 8] - P[i + 5] * P[i + 6]) +
      P[i + 2] * (P[i + 3] * P[i + 7] - P[i + 4] * P[i + 6])
    compVol.set(comp, (compVol.get(comp) ?? 0) + d / 6)
  }

  let border = 0
  let same = 0
  for (const [k, n] of edges) {
    if (n > 1) same += n - 1
    const [u, w] = k.split(",")
    if (!edges.has(w + "," + u)) border++
  }

  // Ein negativ komponent som ligg HEILT inne i ein positiv er ikkje ein
  // feil — han er eit lukka holrom, vinda innover med vilje (STRAUM sin
  // kropp har tomrommet sitt slik). Ein negativ komponent i fri luft er
  // derimot ein del som er vrengd innsida-ut.
  let negComp = 0
  let comps = 0
  for (const [c, v] of compVol) {
    comps++
    if (v >= -1000) continue
    const bx = compBox.get(c)
    let cavity = false
    if (bx) {
      for (const [c2, v2] of compVol) {
        if (c2 === c || v2 <= 0) continue
        const ox = compBox.get(c2)
        if (!ox) continue
        const M = 0.5
        if (
          bx[0] >= ox[0] - M && bx[1] >= ox[1] - M && bx[2] >= ox[2] - M &&
          bx[3] <= ox[3] + M && bx[4] <= ox[4] + M && bx[5] <= ox[5] + M
        ) {
          cavity = true
          break
        }
      }
    }
    if (!cavity) negComp++
  }

  return { border, same, negComp, comps, degen, nan }
}

const only = process.argv[2]
let fails = 0

for (const e of ENGINES) {
  if (only && e.id !== only) continue
  console.log(`\n== ${e.id.toUpperCase()} ==`)
  const points: [string, Record<string, number | string>][] = [
    ["standard", e.defaults],
  ]
  for (let i = 0; i < 6; i++) {
    points.push([
      `terning ${i}`,
      e.random(seeded(e.id + ":geo:" + i), e.defaults, new Set()),
    ])
  }
  const ok = new Map(points.map(([name, p]) => [name, name === "standard" || buildable(e, p)]))
  for (const view of ["flate", "lag"] as const) {
    for (const [name, p] of points) {
      const o = e.build(p, "mid", view)
      if (o.tris === 0) continue
      const r = audit({ positions: o.positions as Float32Array, tris: o.tris })
      // Byggbare design (og standarden, alltid) skal ha feilfri geometri.
      // Design som bryt harde reglar er alt raude — dei får ha slivers,
      // men aldri NaN.
      const strict = ok.get(name) as boolean
      const bad = strict
        ? r.border > 0 || r.same > 0 || r.negComp > 0 || r.nan > 0
        : r.nan > 0
      if (bad) fails++
      const mark = bad ? "  FEIL" : "  ok  "
      const note = strict ? "" : "  (ubyggbart punkt: berre NaN-krav)"
      console.log(
        `${mark} ${view}/${name}: hòl ${r.border} · vrengde ${r.same} · ` +
          `innsida-ut ${r.negComp}/${r.comps} · utarta ${r.degen} · NaN ${r.nan}${note}`,
      )
    }
  }
}

console.log(fails === 0 ? "\n\x1b[32mgeometrien held\x1b[0m" : `\n\x1b[31m${fails} nett med feil\x1b[0m`)
process.exit(fails === 0 ? 0 : 1)
