/**
 * SKAL som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er stabla lamellar. Ei flate som er krum i to retningar
 * samstundes let seg ikkje bøyge av ei plate utan å kutte henne opp; ho let
 * seg derimot stable av vassrette lag og slipe ned. Prisen er slipinga —
 * halve arbeidstida — og vinsten er at limfugene vert eit mønster som
 * fortel kva forma gjer.
 */
import type {
  BuildOut,
  DetailKey,
  EngineDef,
  ExportKind,
  ExportOut,
  ParamBag,
  View,
} from "../core"
import { makeShell } from "./field"
import { buildMesh, DETAIL } from "./surface"
import { buildStack } from "./laminae"
import { contourLines, stackMesh } from "./stack-mesh"
import { measure, type Metrics as SkalMetrics } from "./metrics"
import { checkRules } from "./rules"
import { nest } from "./nest"
import { meshToStl } from "./export-stl"
import { stackToDxf } from "./export-dxf"
import { contourMapSvg, sheetSvg } from "./export-svg"
import {
  DEFAULT_PARAMS,
  GROUPS,
  NUDGE_PARAMS,
  PARAM_KEYS,
  PARAM_RANGES,
  clampParams,
  randomParams,
  type Params,
} from "./params"

const asP = (p: ParamBag) => p as unknown as Params
const EMPTY = () => new Float32Array(0)

export const SKAL: EngineDef = {
  id: "skal",
  label: "skal",
  note: "vassrette lamellar, stabla og slipte ned til éi flate",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  unitLabel: "lag",

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const sh = makeShell(p)
    // Stabelen fylgjer detaljnivået i vinkeloppløysing: medan skyvaren er i
    // rørsle er 144 punkt kring omkrinsen meir enn auget rekk å lesa. Dei
    // fine stega brukar 360 — det SAME som målinga, so stabelen frå det
    // fine bygget og stabelen kuttlista les er eitt og same hugsa objekt.
    const nth = detail === "lav" ? 144 : 360
    if (view === "kontur") {
      const c = contourLines(buildStack(p, sh, nth))
      return {
        positions: EMPTY(),
        normals: EMPTY(),
        tris: 0,
        min: [-sh.R, -sh.R, 0],
        max: [sh.R, sh.R, sh.zTop],
        lines: c.positions,
        heavy: c.heavy,
        kant: EMPTY(),
      }
    }
    const m =
      view === "lag" ? stackMesh(buildStack(p, sh, nth)) : buildMesh(p, DETAIL[detail], sh)
    return { ...m, kant: m.kant ?? EMPTY(), lines: EMPTY(), heavy: EMPTY() }
  },

  measure: (bag) => measure(asP(bag)),
  // Motoren produserer alltid sine eigne måltal, så nedkastet her er trygt:
  // det som kjem inn er nett det `measure` gav ut ei line lenger opp.
  rules: (bag, m) => checkRules(asP(bag), m as SkalMetrics),

  exportFile(bag: ParamBag, what: ExportKind): ExportOut {
    const p = asP(bag)
    const sh = makeShell(p)
    if (what === "stl") {
      const bytes = meshToStl(buildMesh(p, DETAIL.hog, sh), "skal")
      return {
        name: "skal.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    const stack = buildStack(p, sh)
    if (what === "dxf") {
      return {
        name: "skal.dxf",
        mime: "application/dxf",
        text: stackToDxf(stack, nest(stack)),
      }
    }
    if (what === "ark") {
      return {
        name: "skal-ark1.svg",
        mime: "image/svg+xml",
        text: sheetSvg(nest(stack), 0),
      }
    }
    return {
      name: "skal-kontur.svg",
      mime: "image/svg+xml",
      text: contourMapSvg(stack),
    }
  },
}
