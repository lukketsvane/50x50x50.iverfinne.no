/**
 * VAFFEL som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er kryssholdte ribber i to retningar. Ei krum sitjeflate
 * let seg ikkje bøyge av ei plate, men ho let seg TILNÆRME av kantane på
 * mange plater — og ein plateknat er ei rett line. Difor er kvar del her
 * flat og rett, medan flata over dei er krum i begge retningar.
 *
 * Prisen er vekta. Kvar ribbe går heilt ned til golvet, så åtten plater
 * ber ein krakk som tre kunne ha bore; til gjengjeld finst det ikkje eit
 * lim, ein skrue eller ei oppspenning i heile møbelet. Rutenettet held seg
 * sjølv, og det er den eine tingen ingen av dei tre andre typologiane kan.
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
import type { Material } from "../core"
import { LASER } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { makeBody } from "./body"
import { buildGrid } from "./ribs"
import { DETAIL, contourLines, lagMesh, shellMesh } from "./mesh"
import { measure } from "./metrics"
import { feltPaMesh, lastVerste } from "./last"
import { lastForm } from "./lastform"
import { finmaskNett } from "../lastnett"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { nest } from "./nest"
import { partsToDxf } from "./export-dxf"
import { alleArkSvg, profileSvg } from "./export-svg"
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
/** Ein ny tom buffer kvar gong. Ein delt tom Float32Array vert kopla frå
 *  fyrste gong han vert send gjennom postMessage, og då er alle seinare
 *  visningar tomme utan at noko feilar. */
const EMPTY = () => new Float32Array(0)

export const VAFFEL: EngineDef = {
  id: "vaffel",
  label: "vaffel",
  note: "kryssholdte ribber i to retningar, utan lim og utan skruar",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "ribber",
  // lastkartet: VAFFEL er svaret prosjektet landar på, og han svarar fyrst
  kanLast: true,
  lastForm: (bag) => lastForm(asP(bag)) as unknown as ParamBag,

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const d = DETAIL[detail]
    const b = makeBody(p)

    if (view === "flate") {
      // Den glatte kroppen har inga kuttflate; tom kant let framsyninga
      // gisse frå normalane i staden.
      const m = shellMesh(b, d)
      return { ...m, kant: EMPTY(), lines: EMPTY(), heavy: EMPTY() }
    }

    const g = buildGrid(b, d.step)
    if (view === "lag") {
      const m = lagMesh(g)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    if (view === "last") {
      // Lastkartet: same nett som «lag», FINMASKA — store flate trekantar
      // smører hjørnefargane lineært diagonalt over flata, og då synte
      // kartet interpolasjonen i staden for feltet. Utnyttinga per hjørne
      // attåt; modellen står i last.ts og er den same som measure brukar.
      const m0 = lagMesh(g)
      const m = { ...m0, ...finmaskNett(m0) }
      // Ankeret er det analytiske maksimumet, ikkje hjørna sitt: hjørna
      // samplar og glattar smale toppar, og fargane skal strekkjast mot
      // det talet tavla faktisk viser.
      return {
        ...m,
        felt: feltPaMesh(g, m.positions),
        feltTak: lastVerste(g).util,
        lines: EMPTY(),
        heavy: EMPTY(),
      }
    }

    // Konturteikninga legg ribbene flatt ved sida av kvarandre og fyller
    // difor eit anna rom enn objektet. Kameraet skal ramme inn det som
    // faktisk vert teikna, så boksen vert lesen av linene sjølve.
    const c = contourLines(g)
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const arr of [c.lines, c.heavy]) {
      for (let i = 0; i < arr.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          if (arr[i + k] < min[k]) min[k] = arr[i + k]
          if (arr[i + k] > max[k]) max[k] = arr[i + k]
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
    const b = makeBody(p)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(buildGrid(b, DETAIL.hog.step)), "vaffel")
      return {
        name: "vaffel.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    const g = buildGrid(b, DETAIL.mid.step)
    if (what === "svg") {
      return { name: "vaffel-profilar.svg", mime: "image/svg+xml", text: profileSvg(g) }
    }
    if (what === "arksyn") {
      // biletet i panelet: same pakking som measure las — sjå ExportKind
      const ns = nest(buildParts(g, p.material as Material).parts)
      return { name: "vaffel-ark.svg", mime: "image/svg+xml", text: alleArkSvg(ns) }
    }
    // laseren: heile geometrien i modellskala tjukn/ribbT, so spora
    // framleis passar plata — nesta på lasersenga med laserluft
    const laser = maskin?.id === "laser" ? maskin : null
    const s = laser ? laser.tjukn / p.ribbT : 1
    const pl = buildParts(g, p.material as Material)
    const ns = nest(skalerDelar(pl.parts, s), laser ? { ...LASER, tett: true } : { cell: 4, tett: true })
    const merk = laser ? "-laser" : ""
    if (what === "ark") {
      return { name: "vaffel-" + ns.sheets.length + "ark" + merk + ".svg", mime: "image/svg+xml", text: alleArkSvg(ns) }
    }
    return { name: "vaffel" + merk + ".dxf", mime: "application/dxf", text: partsToDxf(ns, laser ? laser.tjukn : p.ribbT) }
  },
}
