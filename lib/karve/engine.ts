/**
 * KARVE som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er den motsette av dei andre i sandkassen. Dei set
 * saman ferdige delar; denne limer flate plater til ein blokk og tek
 * materiale VEKK — fresen frå oversida, emnet snudd, fresen frå
 * undersida, og så slipepapir. Difor er utsida samanhengande og ikkje
 * trappa, og difor syner laga berre som kotelinjer på ei glatt flate.
 *
 * Prisen for den glatte flata er to ting ingen av dei andre motorane
 * betalar: alt som ikkje er møbel er spon, og ei flate som heng ut over
 * seg sjølv finst ikkje — fresen har skaft.
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
import { DETAIL, karv } from "./form"
import { flateMesh, konturLines, lagMesh } from "./mesh"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { koteSvg } from "./export-svg"
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

export const KARVE: EngineDef = {
  id: "karve",
  label: "karve",
  note: "limt blokk, frest og sliten glatt — laga syner berre som kotelinjer",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "lag",

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const k = karv(p, DETAIL[detail])

    if (view === "flate") {
      const m = flateMesh(k)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "lag") {
      const m = lagMesh(k, p)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    // Konturkartet legg plateomrissa flatt og fyller eit anna rom enn
    // objektet — boksen vert lesen av linene sjølve.
    const c = konturLines(k, p)
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
    const k = karv(p, DETAIL.hog)
    if (what === "stl") {
      const bytes = meshToStl(flateMesh(k), "karve")
      return {
        name: "karve.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "karve-kotekart.svg", mime: "image/svg+xml", text: koteSvg(k, p) }
    }
    const ns = nest(buildParts(k, p).parts)
    if (what === "ark") {
      return { name: "karve-ark1.svg", mime: "image/svg+xml", text: sheetSvg(ns, 0) }
    }
    return { name: "karve.dxf", mime: "application/dxf", text: partsToDxf(ns, p.plyT) }
  },
}
