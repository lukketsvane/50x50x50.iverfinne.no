/**
 * KOTE som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er vassrett kotesnitt. Ein kropp vert definert i
 * rommet og skoren av VASSRETTE plan; kvar plate er den høgda sitt plan,
 * kutta av ark; platene vert tredde på loddrette stavar med hylser som
 * held lufta mellom dei, og heile stabelen er låst med kile i stavenden.
 *
 * Det berre vassrett snitt kan gje, og som ingen av dei andre motorane
 * her rår over: planet kan VRI SEG frå kote til kote, holet kan gå tvers
 * gjennom kroppen utan å dele nokon einaste plate, og setet er éi
 * samanhengande flate — skoren som ei skål av konsentriske riller, so
 * det ein sit i er bokstavleg talt eit kotekart.
 */
import type {
  BuildOut,
  DetailKey,
  EngineDef,
  ExportKind,
  ExportOut,
  ParamBag,
  Vec3,
  View,
} from "../core"
import { meshToStl } from "../skal/export-stl"
import { nest } from "../vaffel/nest"
import { partsToDxf } from "../vaffel/export-dxf"
import { sheetSvg } from "../vaffel/export-svg"
import { DETAIL, makeKropp, nth } from "./plan"
import { buildStack } from "./stack"
import { contourLines, flateMesh, lagMesh } from "./mesh"
import { MEASURE_M, measure } from "./metrics"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { planSvg } from "./export-svg"
import {
  DEFAULT_PARAMS,
  GROUPS,
  HOVUDDRAG,
  NUDGE_PARAMS,
  PARAM_KEYS,
  POSAR,
  PARAM_RANGES,
  clampParams,
  randomParams,
  type Params,
} from "./params"

const asP = (p: ParamBag) => p as unknown as Params
/** kvar tomme buffer må vera si eiga — ein delt vert fråkopla av postMessage */
const EMPTY = () => new Float32Array(0)

export const KOTE: EngineDef = {
  id: "kote",
  label: "kote",
  note: "vassrette kotesnitt kutta av ark, tredde på stavar med hylser og låste med kile",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "plater",

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const d = DETAIL[detail]

    if (view === "flate") {
      // Den glatte kroppen har inga kuttflate; tom kant let framsyninga
      // gisse frå normalane i staden.
      const k = makeKropp(p)
      const b = buildStack(p, d.m)
      const m = flateMesh(k, b, nth(p, d.m), d.zst)
      return { ...m, kant: EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }

    const b = buildStack(p, d.m)
    if (view === "lag") {
      const m = lagMesh(p, b, nth(p, d.m))
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    // Kotekartet legg kotelinene flatt i XY og fyller eit anna rom enn
    // objektet — boksen vert lesen av linene sjølve.
    const c = contourLines(b)
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const arr of [c.lines, c.heavy]) {
      for (let i = 0; i < arr.length; i += 3) {
        for (let q = 0; q < 3; q++) {
          if (arr[i + q] < min[q]) min[q] = arr[i + q]
          if (arr[i + q] > max[q]) max[q] = arr[i + q]
        }
      }
    }
    if (!Number.isFinite(min[0])) {
      min[0] = min[1] = min[2] = 0
      max[0] = max[1] = max[2] = 1
    }
    return {
      positions: EMPTY(),
      normals: EMPTY(),
      tris: 0,
      kant: EMPTY(),
      min,
      max,
      lines: c.lines,
      heavy: c.heavy,
    }
  },

  measure: (bag) => measure(asP(bag)),
  rules: (bag, m) => checkRules(asP(bag), m),

  exportFile(bag: ParamBag, what: ExportKind): ExportOut {
    const p = asP(bag)
    const b = buildStack(p, DETAIL.hog.m)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(p, b, nth(p, DETAIL.hog.m)), "kote")
      return {
        name: "kote.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "kote-kotekart.svg", mime: "image/svg+xml", text: planSvg(b) }
    }
    const ns = nest(buildParts(p, b).parts)
    if (what === "ark") {
      return { name: "kote-ark1.svg", mime: "image/svg+xml", text: sheetSvg(ns, 0) }
    }
    return { name: "kote.dxf", mime: "application/dxf", text: partsToDxf(ns, p.plyT) }
  },
}

export { MEASURE_M }
