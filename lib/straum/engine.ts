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
  Maskin,
} from "../core"
import { LASER } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { makeBody, type Body } from "./body"
import { buildParts, type Build } from "./parts"
import { assemblyMesh, contourLines } from "./assembly"
import { buildMesh, DETAIL } from "./surface"
import { feltPaMesh, lastProfil, snittMaskin } from "./last"
import { finmaskNett } from "../lastnett"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { nest } from "./nest"
import { partsToDxf } from "./export-dxf"
import { alleArkSvg, contourMapSvg } from "./export-svg"
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

/**
 * Kroppen og delane, hugsa for det siste punktet i parameterrommet.
 *
 * Grensesnittet spør om nett same objektet tre gonger etter kvarandre —
 * teikninga, måltavla og reglane — og kvar av dei tre skar før kroppen i
 * 23 plan på nytt. Ein sats på eitt einaste punkt tek halve tida bort, og
 * han kan ikkje bli gammal: nykelen er heile parametersatsen.
 */
/** Delane vert fyrst bygde når nokon spør etter dei: «flate» treng berre
 *  kroppen, og å kutte 24 finnar for eit nett som ikkje viser dei er å
 *  betale for noko ingen ser. Kropp og delar er dessutan hugsa i sine
 *  eigne modular, så oppslaget her er billeg same kva. */
function ctx(p: Params): { body: Body; parts: () => Build } {
  const body = makeBody(p)
  return { body, parts: () => buildParts(body) }
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
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "finnar",
  kanLast: true,

  // Params er ein type alias og ikkje eit interface, og difor tildelbar til
  // ParamBag utan eit einaste kast. Vegen andre vegen — frå sekk til
  // typa sats — er den som må kastast, av di han ikkje er trygg.
  clamp: (o, prev) => clampParams(o, asP(prev)),
  random: (rnd, prev, locked) => randomParams(rnd, asP(prev), locked),

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const { body: bd, parts } = ctx(p)
    if (view === "flate") {
      const m = buildMesh(p, DETAIL[detail], bd)
      return { ...m, kant: EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "lag") {
      const m = assemblyMesh(parts())
      return { ...m, kant: m.kant ?? EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }
    if (view === "last") {
      // Lastkartet: same nett som «lag», FINMASKA so hjørna samplar feltet
      // tett nok, farga med utnyttinga til snittet i si høgd. Ankeret er
      // det analytiske maksimumet — same talet som tavla viser.
      const B = parts()
      const m0 = assemblyMesh(B)
      const g = { ...m0, kant: m0.kant ?? EMPTY() }
      const m = { ...g, ...finmaskNett(g) }
      const lp = lastProfil(snittMaskin(p, bd, B), bd.H, p.kappeT)
      return {
        ...m,
        kant: EMPTY(),
        felt: feltPaMesh(lp, m.positions),
        feltTak: lp.verste.util,
        lines: EMPTY(),
        heavy: EMPTY(),
      }
    }
    const c = contourLines(parts())
    return {
      positions: EMPTY(),
      normals: EMPTY(),
      tris: 0,
      min: c.min,
      max: c.max,
      lines: c.positions,
      heavy: c.heavy,
      kant: EMPTY(),
    }
  },

  measure: (bag) => {
    const p = asP(bag)
    const c = ctx(p)
    return measure(p, { body: c.body, build: c.parts() })
  },
  rules: (bag, m) => {
    const p = asP(bag)
    const c = ctx(p)
    return checkRules(p, m, { body: c.body, build: c.parts() })
  },

  exportFile(bag: ParamBag, what: ExportKind, maskin?: Maskin): ExportOut {
    const p = asP(bag)
    const { body: bd, parts } = ctx(p)
    if (what === "stl") {
      const bytes = meshToStl(buildMesh(p, DETAIL.hog, bd), "straum")
      return {
        name: "straum.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "dxf" || what === "ark") {
      // laseren: modellskala tjukn/finneT — og ÉI plate for alt: sokkel
      // og kappe vert kutta or same tynne arket som finnane
      const laser = maskin?.id === "laser" ? maskin : null
      const s = laser ? laser.tjukn / p.finneT : 1
      let dl = skalerDelar(parts().parts, s)
      if (laser) dl = dl.map((q) => ({ ...q, t: laser.tjukn }))
      const ns = nest(dl, laser ? LASER : undefined)
      const merk = laser ? "-laser" : ""
      if (what === "dxf") {
        return { name: "straum" + merk + ".dxf", mime: "application/dxf", text: partsToDxf(ns) }
      }
      return {
        name: "straum-" + ns.sheets.length + "ark" + merk + ".svg",
        mime: "image/svg+xml",
        text: alleArkSvg(ns),
      }
    }
    return {
      name: "straum-kontur.svg",
      mime: "image/svg+xml",
      text: contourMapSvg(parts()),
    }
  },
}
