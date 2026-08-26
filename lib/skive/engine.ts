/**
 * SKIVE som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er den enklaste i heile sandkassen: parallelle skiver
 * med luft imellom, tredde på stavar. Kvar skive er heile møbelet sett
 * frå sida, og møbelet er den silhuetten gjenteken med små endringar ut
 * mot sidene — kuppelen i ryggen, sidefallet i setet. Det er den einaste
 * typologien her som kan ha RYGG, og prisen er at flata berre finst som
 * strimer: det du sit på er annakvar plate og annakvar luft.
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
  Maskin,
} from "../core"
import { LASER } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { nest } from "../vaffel/nest"
import { partsToDxf } from "../vaffel/export-dxf"
import { alleArkSvg } from "../vaffel/export-svg"
import { buildSlices, DETAIL } from "./profile"
import { contourLines, lagMesh, loftMesh } from "./mesh"
import { feltPaMesh, lastVerste } from "./last"
import { finmaskNett } from "../lastnett"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { lastForm } from "./lastform"
import { buildParts } from "./parts"
import { profileSvg } from "./export-svg"
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

export const SKIVE: EngineDef = {
  id: "skive",
  label: "skive",
  note: "parallelle skiver med luft imellom, tredde på stavar — med rygg",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "skiver",
  kanLast: true,
  lastForm: (bag) => lastForm(asP(bag)) as unknown as ParamBag,

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const k = DETAIL[detail].k

    if (view === "flate") {
      // Den glatte forma har inga kuttflate; tom kant let framsyninga
      // gisse frå normalane i staden.
      const stations = detail === "lav" ? 18 : detail === "mid" ? 40 : 64
      const m = loftMesh(p, k, stations)
      return { ...m, kant: EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }

    const b = buildSlices(p, k)
    if (view === "lag") {
      const m = lagMesh(p, b)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    if (view === "last") {
      // Lastkartet: same nett som «lag», FINMASKA so hjørna samplar feltet
      // tett nok — store flate trekantar smører fargane diagonalt elles.
      // Ankeret er det analytiske maksimumet — same talet som tavla viser.
      const m0 = lagMesh(p, b)
      const m = { ...m0, ...finmaskNett(m0) }
      return {
        ...m,
        felt: feltPaMesh(p, b, m.positions),
        feltTak: lastVerste(p, b).util,
        lines: EMPTY(),
        heavy: EMPTY(),
      }
    }

    // Konturkartet legg silhuettane flatt ved sida av kvarandre og fyller
    // eit anna rom enn objektet — boksen vert lesen av linene sjølve.
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

  exportFile(bag: ParamBag, what: ExportKind, maskin?: Maskin): ExportOut {
    const p = asP(bag)
    const b = buildSlices(p, DETAIL.hog.k)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(p, b), "skive")
      return {
        name: "skive.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "skive-profilar.svg", mime: "image/svg+xml", text: profileSvg(b) }
    }
    // laseren: modellskala tjukn/plyT, nesta på lasersenga
    const laser = maskin?.id === "laser" ? maskin : null
    const s = laser ? laser.tjukn / p.plyT : 1
    const ns = nest(skalerDelar(buildParts(p, b).parts, s), laser ? LASER : undefined)
    const merk = laser ? "-laser" : ""
    if (what === "ark") {
      return { name: "skive-" + ns.sheets.length + "ark" + merk + ".svg", mime: "image/svg+xml", text: alleArkSvg(ns) }
    }
    return { name: "skive" + merk + ".dxf", mime: "application/dxf", text: partsToDxf(ns, laser ? laser.tjukn : p.plyT) }
  },
}
