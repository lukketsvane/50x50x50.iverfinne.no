/**
 * LAFT som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er FÅ STORE PLATER som lafter seg ned i kvarandre.
 * Der dei fire andre typologiane byggjer den krumme flata av mange små
 * delar — ribber, skiver, finnar, blad — nektar LAFT å byggje henne i det
 * heile. Ei plate er ei plate, seier han, og komforten kjem av vinklar:
 * setet vippa, ryggen lena.
 *
 * UNDERSTELLET ER EIN X. To blad står i kvar sitt loddrette plan, og dei
 * to plana kryssar kvarandre midt under setet. Det er den einaste
 * konstruksjonen som gjev fire føter, fire hjørne og berre EITT ledd i
 * heile understellet — ei krysshalving, det eine bladet hogd ned frå
 * toppen, det andre opp frå bogen. To parallelle sidevegger ville sett
 * likt ut frå sida og vore ein heilt annan stol: fire ledd, og ei ramme
 * som klappar saman den vegen ingen ser.
 *
 * Prisen er ærleg og står i tavla: flata er flat, og i ein kube på
 * femhundre vert ryggen ei LIST og ikkje ein rygg. Vinsten er talet ingen
 * annan motor er i nærleiken av — FEM delar, og ein pakke som er stolen
 * sjølv kollapsa: platene flate mot kvarandre, med den største som
 * omslag, og ingen ting i bunten som ikkje er møbel.
 *
 * Kilen er den einaste delen som SKAL kuttast i eit anna treslag. Han er
 * det som held møbelet saman, og då skal ein sjå kvar han sit.
 */
import type {
  BuildOut,
  DetailKey,
  EngineDef,
  ExportKind,
  ExportOut,
  Maskin,
  ParamBag,
  View,
} from "../core"
import { LASER } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { nest } from "../vaffel/nest"
import { partsToDxf } from "../vaffel/export-dxf"
import { alleArkSvg } from "../vaffel/export-svg"
import { finmaskNett } from "../lastnett"
import { bygg } from "./profil"
import { contourLines, flateMesh, lagMesh } from "./mesh"
import { feltPaMesh, lastVerste } from "./last"
import { lastForm } from "./lastform"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { buildParts } from "./parts"
import { stabel, stabelSvg } from "./pakke"
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

export const LAFT: EngineDef = {
  id: "laft",
  label: "laft",
  note: "to kryssande blad, eit sete og ei list — flatpakka, utan lim",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "plater",
  kanLast: true,
  lastForm: (bag) => lastForm(asP(bag)) as unknown as ParamBag,

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) => randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, _detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)
    const b = bygg(p)

    if (view === "flate") {
      // Ikkje ei tilnærma krum flate — LAFT har inga. Dette er dei to
      // plana kroppen faktisk møter, reinska for spor og hòl.
      const m = flateMesh(b)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    if (view === "lag") {
      const m = lagMesh(b)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    if (view === "last") {
      // Lastkartet: same nett som «lag», finmaska so hjørna samplar feltet
      // tett nok. Ankeret er det analytiske maksimumet — same talet som
      // tavla viser.
      const m0 = lagMesh(b)
      const m = { ...m0, ...finmaskNett(m0) }
      return {
        ...m,
        felt: feltPaMesh(b, m.positions),
        feltTak: lastVerste(b).util,
        lines: EMPTY(),
        heavy: EMPTY(),
      }
    }

    const c = contourLines(b)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const arr of [c.lines, c.heavy]) {
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i] < x0) x0 = arr[i]
        if (arr[i] > x1) x1 = arr[i]
        if (arr[i + 2] < z0) z0 = arr[i + 2]
        if (arr[i + 2] > z1) z1 = arr[i + 2]
      }
    }
    if (!Number.isFinite(x0)) { x0 = z0 = 0; x1 = z1 = 1 }
    return {
      positions: EMPTY(),
      normals: EMPTY(),
      tris: 0,
      kant: EMPTY(),
      min: [x0, 0, z0],
      max: [x1, 0, z1],
      lines: c.lines,
      heavy: c.heavy,
    }
  },

  measure: (bag) => measure(asP(bag)),
  rules: (bag, m) => checkRules(asP(bag), m),

  exportFile(bag: ParamBag, what: ExportKind, maskin?: Maskin): ExportOut {
    const p = asP(bag)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(bygg(p)), "laft")
      return {
        name: "laft.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    if (what === "svg") {
      return { name: "laft-profilar.svg", mime: "image/svg+xml", text: profileSvg(bygg(p)) }
    }
    // dei to bladene er same emnet, men BEGGE skal kuttast
    const pl = buildParts(p)
    if (what === "arksyn") {
      // Biletet i panelet er PAKKEN og ikkje kuttarket. Kuttarket svarar
      // på kor mange plater jobben krev, og det talet står i tavla; men
      // det ein vil SJÅ av eit flatpakka møbel er bunten han kjem som —
      // og bunten er ein stabel med den største delen som omslag, ikkje
      // eit brett med delane nesta ved sida av kvarandre.
      return { name: "laft-pakke.svg", mime: "image/svg+xml", text: stabelSvg(stabel(pl.parts)) }
    }
    const laser = maskin?.id === "laser" ? maskin : null
    const s = laser ? laser.tjukn / p.plyT : 1
    const ns = nest(
      skalerDelar(pl.parts, s),
      laser ? { ...LASER, tett: true } : { cell: 4, tett: true },
    )
    const merk = laser ? "-laser" : ""
    if (what === "ark") {
      return {
        name: "laft-" + ns.sheets.length + "ark" + merk + ".svg",
        mime: "image/svg+xml",
        text: alleArkSvg(ns),
      }
    }
    return {
      name: "laft" + merk + ".dxf",
      mime: "application/dxf",
      text: partsToDxf(ns, laser ? laser.tjukn : p.plyT),
    }
  },
}
