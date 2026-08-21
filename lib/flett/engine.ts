/**
 * FLETT som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er den einaste i sandkassen som har TO materialstraumar.
 * Ramma vert skoren av finérplate som bogesegment og lappa til ein ring;
 * banda vert kappa som lange, rette strimlar av eit tynnare gods og vevde
 * over og under kvarandre mellom bandendane ramma tek imot. Sitjeflata er
 * ikkje det same stoffet som bereverket, og ho ber ikkje på same måte:
 * ho ber i STREKK, og ho sig.
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
import { DETAIL, flateMesh, konturLines, lagMesh } from "./mesh"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { bandSvg } from "./export-svg"
import { makeWeave } from "./weave"
import { randomParams } from "./reparasjon"
import {
  DEFAULT_PARAMS,
  GROUPS,
  NUDGE_PARAMS,
  PARAM_KEYS,
  PARAM_RANGES,
  clampParams,
  type Params,
} from "./params"

const asP = (p: ParamBag) => p as unknown as Params
/** kvar tomme buffer må vera si eiga — ein delt vert fråkopla av postMessage */
const EMPTY = () => new Float32Array(0)

export const FLETT: EngineDef = {
  id: "flett",
  label: "flett",
  note: "finérband kappa i strimlar og vevde over og under i ein ring skoren av plate",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  unitLabel: "band",

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const w = makeWeave(p)
    const k = DETAIL[detail].k

    if (view === "flate") {
      const m = flateMesh(w, k)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "lag") {
      const m = lagMesh(w, k)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    // Konturkartet legg bandstrimlane flatt og fyller eit anna rom enn
    // objektet — boksen vert lesen av linene sjølve.
    const c = konturLines(w)
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
    const w = makeWeave(p)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(w, DETAIL.hog.k), "flett")
      return {
        name: "flett.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "flett-bandkart.svg", mime: "image/svg+xml", text: bandSvg(w) }
    }
    const pl = buildParts(w)
    if (what === "ark") {
      // Arket er BANDA: dei er den kuttlista som er særeigen for
      // typologien, og den einaste i sandkassen som er rein strimmelnesting.
      return { name: "flett-bandark1.svg", mime: "image/svg+xml", text: sheetSvg(nest(pl.band.parts), 0) }
    }
    // DXF-en er RAMMA: bogesegment, bein og bogar i finérplate, med
    // snittbreidda kompensert.
    return {
      name: "flett-ramme.dxf",
      mime: "application/dxf",
      text: partsToDxf(nest(pl.ramme.parts), p.rammeT),
    }
  },
}
