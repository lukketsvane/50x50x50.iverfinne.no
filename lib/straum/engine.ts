/**
 * STRAUM som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er skrå skiveplan. Ei flate som er krum i to retningar
 * samstundes let seg ikkje bøyge av ei plate; ho let seg derimot skjera i
 * plan, og eit skråstilt plan er framleis eit plan. Difor er kvar finne
 * flat og kan kappast ut av ei plate, medan heile forma er krum — og
 * difor rakar striperinga på tvers av forma i staden for å stå i givakt.
 *
 * Prisen er avkappet: 24 emne på kring 350 × 400 mm let seg ikkje nesta
 * tett, og utnyttinga av plata ligg kring tjue prosent. Vinsten er at det
 * finst nøyaktig eitt ledd i heile møbelet.
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
import { meshToStl } from "../skal/export-stl"
import { makeBody, type Body } from "./body"
import { buildParts, type Build } from "./parts"
import { assemblyMesh, contourLines } from "./assembly"
import { buildMesh, DETAIL } from "./surface"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { nest } from "./nest"
import { partsToDxf } from "./export-dxf"
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

/**
 * Kroppen og delane, hugsa for det siste punktet i parameterrommet.
 *
 * Grensesnittet spør om nett same objektet tre gonger etter kvarandre —
 * teikninga, måltavla og reglane — og kvar av dei tre skar før kroppen i
 * 23 plan på nytt. Ein sats på eitt einaste punkt tek halve tida bort, og
 * han kan ikkje bli gammal: nykelen er heile parametersatsen.
 */
let last: { key: string; body: Body; build: Build } | null = null
function ctx(p: Params): { body: Body; build: Build } {
  const key = JSON.stringify(p)
  if (last && last.key === key) return last
  const body = makeBody(p)
  last = { key, body, build: buildParts(body) }
  return last
}
/** Kvar tom Float32Array må vera si eiga: ein delt konstant vert frakopla
 *  fyrste gongen han går gjennom postMessage, og då døyr kvar melding
 *  etter den fyrste. */
const EMPTY = () => new Float32Array(0)

export const STRAUM: EngineDef = {
  id: "straum",
  label: "straum",
  note: "éin kropp skoren i skrå skiveplan, finnar sette i spor",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS,
  nudge: NUDGE_PARAMS,
  unitLabel: "finnar",

  // Params er ein type alias og ikkje eit interface, og difor tildelbar til
  // ParamBag utan eit einaste kast. Vegen andre vegen — frå sekk til
  // typa sats — er den som må kastast, av di han ikkje er trygg.
  clamp: (o, prev) => clampParams(o, asP(prev)),
  random: (rnd, prev, locked) => randomParams(rnd, asP(prev), locked),

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const { body: bd, build: B } = ctx(p)
    if (view === "flate") {
      const m = buildMesh(p, DETAIL[detail], bd)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "lag") {
      const m = assemblyMesh(B)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }
    const c = contourLines(B)
    return {
      positions: EMPTY(),
      normals: EMPTY(),
      tris: 0,
      min: c.min,
      max: c.max,
      lines: c.positions,
      heavy: c.heavy,
    }
  },

  measure: (bag) => measure(asP(bag), ctx(asP(bag))),
  rules: (bag, m) => checkRules(asP(bag), m, ctx(asP(bag))),

  exportFile(bag: ParamBag, what: ExportKind): ExportOut {
    const p = asP(bag)
    const { body: bd, build: B } = ctx(p)
    if (what === "stl") {
      const bytes = meshToStl(buildMesh(p, DETAIL.hog, bd), "straum")
      return {
        name: "straum.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "dxf") {
      return {
        name: "straum.dxf",
        mime: "application/dxf",
        text: partsToDxf(nest(B.parts)),
      }
    }
    if (what === "ark") {
      return {
        name: "straum-ark1.svg",
        mime: "image/svg+xml",
        text: sheetSvg(nest(B.parts), 0),
      }
    }
    return {
      name: "straum-kontur.svg",
      mime: "image/svg+xml",
      text: contourMapSvg(B),
    }
  },
}
