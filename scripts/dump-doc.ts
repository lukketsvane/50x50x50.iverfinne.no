/**
 * Dumpar alt PDF-mappa treng, ut av den same motoren som teiknar
 * nettsida. Det er heile poenget: teikninga, tabellen, kuttarket og
 * berekninga kan ikkje kome i utakt, fordi dei har éin kjelde.
 *
 *   npx tsx scripts/dump-doc.ts [utmappe]
 *
 * Skriv doc/data/doc.json og eitt binært mesh per rendring. Meshane er
 * rå float32 — 18 tal per trekant, tre hjørne à posisjon og normal — av
 * di JSON av ein million tal er ei fillæst fil ingen har hatt godt av.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  DEFAULT_PARAMS,
  GROUPS,
  MATERIALS,
  PARAM_RANGES,
  CUBE,
  type Params,
} from "../lib/skal/params.ts"
import { makeShell, planArcs } from "../lib/skal/field.ts"
import { buildMesh, DETAIL, type MeshData } from "../lib/skal/surface.ts"
import { buildStack } from "../lib/skal/laminae.ts"
import { stackMesh } from "../lib/skal/stack-mesh.ts"
import { measure } from "../lib/skal/metrics.ts"
import { checkRules } from "../lib/skal/rules.ts"
import { nest } from "../lib/skal/nest.ts"
import { VARIANTS, variantParams } from "../lib/skal/variants.ts"

const OUT = process.argv[2] ?? "doc/data"
mkdirSync(OUT, { recursive: true })
const TAU = Math.PI * 2

function writeMesh(name: string, m: MeshData): { name: string; tris: number; file: string } {
  const n = m.tris * 3
  const buf = new Float32Array(n * 6)
  for (let i = 0; i < n; i++) {
    buf[i * 6 + 0] = m.positions[i * 3 + 0]
    buf[i * 6 + 1] = m.positions[i * 3 + 1]
    buf[i * 6 + 2] = m.positions[i * 3 + 2]
    buf[i * 6 + 3] = m.normals[i * 3 + 0]
    buf[i * 6 + 4] = m.normals[i * 3 + 1]
    buf[i * 6 + 5] = m.normals[i * 3 + 2]
  }
  const file = `${name}.f32`
  writeFileSync(join(OUT, file), Buffer.from(buf.buffer))
  return { name, tris: m.tris, file }
}

/** tverrsnittsarealet gjennom høgda — kurva som viser bein, midje og finne */
function areaProfile(p: Params, n = 160) {
  const sh = makeShell(p)
  const rows: { z: number; area: number; spanX: number; spanY: number }[] = []
  for (let j = 0; j <= n; j++) {
    const z = (j / n) * sh.zTop
    let area = 0
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const arc of planArcs(sh, z, 720)) {
      for (let i = 0; i + 1 < arc.length; i++) {
        const dth = arc[i + 1].th - arc[i].th
        const d = dth > Math.PI ? dth - TAU : dth < -Math.PI ? dth + TAU : dth
        const ro = (arc[i].ro + arc[i + 1].ro) / 2
        const ri = (arc[i].ri + arc[i + 1].ri) / 2
        area += 0.5 * (ro * ro - ri * ri) * Math.abs(d)
      }
      const c = sh.spine(sh.hOf(z))
      for (const q of arc) {
        const x = c[0] + q.ro * Math.cos(q.th)
        const y = c[1] + q.ro * Math.sin(q.th)
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    rows.push({
      z,
      area,
      spanX: Number.isFinite(x0) ? x1 - x0 : 0,
      spanY: Number.isFinite(y0) ? y1 - y0 : 0,
    })
  }
  return rows
}

/** det utrulla rektangelet: vinkel til høgre, høgd oppover */
function fieldGrid(p: Params, nth = 360, nh = 180) {
  const sh = makeShell(p)
  const v = new Array<number>(nth * nh)
  // Over rimet er det korkje material eller opning — det er utanfor
  // objektet. Held ein ikkje dei to frå kvarandre, les rektangelet som om
  // heile lufta over ryggen var eit hòl nokon hadde skore.
  const above = new Array<number>(nth * nh)
  for (let j = 0; j < nh; j++) {
    const h = j / (nh - 1)
    for (let i = 0; i < nth; i++) {
      const th = (i / nth) * TAU
      const over = h * sh.zTop > sh.rimZ(th)
      above[j * nth + i] = over ? 1 : 0
      v[j * nth + i] = sh.matAt(th, h)
    }
  }
  return { nth, nh, values: v.map((x) => +x.toFixed(3)), above }
}

/** ryggrad, vriding, midje og akseforhold gjennom høgda */
function laws(p: Params, n = 120) {
  const sh = makeShell(p)
  const rows: { h: number; z: number; x: number; y: number; twist: number; r0: number; r90: number }[] = []
  for (let j = 0; j <= n; j++) {
    const h = j / n
    const z = h * sh.zTop
    const [x, y] = sh.spine(h)
    rows.push({
      h,
      z,
      x,
      y,
      twist: (sh.twistAt(h) * 180) / Math.PI,
      r0: sh.rOuter(0, z),
      r90: sh.rOuter(Math.PI / 2, z),
    })
  }
  return rows
}

console.log("byggjer hovudobjektet …")
const p = DEFAULT_PARAMS
const sh = makeShell(p)
const stack = buildStack(p, sh)
const metrics = measure(p)
const rules = checkRules(p, metrics)
const nesting = nest(stack)

const meshes = [
  writeMesh("skal", buildMesh(p, DETAIL.hog, sh)),
  writeMesh("lag", stackMesh(stack)),
  writeMesh("sprikt", stackMesh(stack, 5)),
]

console.log("byggjer tolv variantar …")
const variants = VARIANTS.map((v) => {
  const vp = variantParams(v)
  const vsh = makeShell(vp)
  const vm = measure(vp)
  const mesh = writeMesh(`var-${v.code}`, buildMesh(vp, DETAIL.lav, vsh))
  return {
    code: v.code,
    name: v.name,
    why: v.why,
    against: v.against,
    over: v.over,
    metrics: {
      envX: vm.envX,
      envY: vm.envY,
      envZ: vm.envZ,
      seatZ: vm.seatZ,
      tipAngle: vm.tipAngle,
      mass: vm.mass,
      layers: vm.layers,
      parts: vm.parts,
      util: vm.util,
    },
    rules: checkRules(vp, vm).filter((r) => !r.ok).map((r) => r.id),
    mesh: mesh.file,
    tris: mesh.tris,
  }
})

const doc = {
  cube: CUBE,
  params: p,
  ranges: PARAM_RANGES,
  groups: GROUPS,
  material: MATERIALS[p.material],
  metrics,
  rules,
  stack: {
    count: stack.count,
    plyT: stack.plyT,
    parts: stack.parts,
    area: stack.area,
    mass: stack.mass,
    layers: stack.layers.map((L) => ({
      i: L.i,
      z0: L.z0,
      z1: L.z1,
      parts: L.parts.map((q) => ({
        ring: q.ring,
        span: q.span,
        area: q.area,
        mass: q.mass,
        wmin: q.wmin,
        outline: q.outline.map((c) => [+c[0].toFixed(2), +c[1].toFixed(2)]),
        holes: q.holes.map((h) => h.map((c) => [+c[0].toFixed(2), +c[1].toFixed(2)])),
      })),
    })),
  },
  nesting: {
    sheetW: nesting.sheetW,
    sheetH: nesting.sheetH,
    util: nesting.util,
    usedLen: nesting.usedLen,
    sheets: nesting.sheets.map((s) => ({
      w: s.w,
      h: s.h,
      used: s.used,
      util: s.util,
      placed: s.placed.map((q) => ({
        layer: q.part.layer,
        index: q.part.index,
        x: q.x,
        y: q.y,
        rot: q.rot,
        outline: q.part.outline.map((c) => [+c[0].toFixed(2), +c[1].toFixed(2)]),
        holes: q.part.holes.map((h) => h.map((c) => [+c[0].toFixed(2), +c[1].toFixed(2)])),
      })),
    })),
  },
  profile: areaProfile(p),
  field: fieldGrid(p),
  laws: laws(p),
  meshes,
  variants,
  zTop: sh.zTop,
  R: sh.R,
}

writeFileSync(join(OUT, "doc.json"), JSON.stringify(doc))
console.log(
  `skreiv ${OUT}/doc.json — ${stack.count} lag, ${stack.parts} delar, ` +
    `${meshes.length + variants.length} mesh, ${rules.filter((r) => !r.ok).length} reglar som ikkje er oppfylte`,
)
