/**
 * BØYG som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er PRESSBØYING, og han er den einaste i sandkassen der
 * plata ikkje vert kutta til form men TVINGA til form. Ei flat finérplate
 * går i ei form under trykk og kjem ut med ei ny kvile; fleire slike skal,
 * pressa over kvarandre i same form, vert nesta i ein fan og halde av éin
 * einaste dybel. Det finst ingen spor, ingen tappar og ikkje eit einaste
 * skruehol i heile møbelet.
 *
 * Grensa som skil typologien frå alle dei andre er bøyeradiusen: ei plate
 * kan berre svinge så tett før ho sprekk, og radien kostar djupn i kuben
 * to gonger — éin gong i framfolden og éin gong der halen bøyer ned.
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
import { alleArkSvg } from "../vaffel/export-svg"
import { blankett, boyeliner, bygg, DETAIL } from "./form"
import { flateMesh, konturLines, lagMesh } from "./mesh"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { blankettSvg } from "./export-svg"
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

export const BOYG: EngineDef = {
  id: "boyg",
  label: "bøyg",
  note: "flate plater pressa krumme over éi form, nesta i kvarandre og pinna med éin dybel",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "skal",

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const d = DETAIL[detail]
    const b = bygg(p, d)

    if (view === "flate") {
      // Den pressa forma utan kapp og utan dybel. Ingen kuttflate finst
      // her, so tom kant lèt framsyninga gisse av normalane i staden.
      const m = flateMesh(b, p, d.nw)
      return { ...m, kant: EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "lag") {
      const m = lagMesh(b, p, d.nw)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    // Blankettane flate ved sida av kvarandre — dei fyller eit anna rom
    // enn objektet, so boksen vert lesen av linene sjølve.
    const c = konturLines(b, p, boyeliner, blankett)
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
    const b = bygg(p, DETAIL.hog)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(b, p, DETAIL.hog.nw), "boyg")
      return {
        name: "boyg.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "boyg-blankettar.svg", mime: "image/svg+xml", text: blankettSvg(b, p) }
    }
    const ns = nest(buildParts(b, p).parts)
    if (what === "ark" || what === "arksyn") {
      return { name: "boyg-" + ns.sheets.length + "ark.svg", mime: "image/svg+xml", text: alleArkSvg(ns) }
    }
    return { name: "boyg.dxf", mime: "application/dxf", text: partsToDxf(ns, p.plyT) }
  },
}
