/**
 * RIBBE som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Produksjonsvegen er radiale blad og vassrette band, kryssholdte i
 * kvarandre. Ei flate som er krum i to retningar samstundes let seg ikkje
 * bøyge av ei plate; ho let seg derimot ANTYDE av eit skjelett som står i
 * flata. Prisen er at flata aldri vert ei flate — han er tjueto meridianar
 * og tre ringar, og auget fyller resten. Vinsten er at heile objektet kjem
 * ut av éi plate, at kvar del er flat, og at det einaste leddet i heile
 * konstruksjonen er det same snittet gjenteke seksti gonger.
 *
 * Motoren har ingen presetmeny. Tolv variantar frå same likning er tolv
 * snitt gjennom eitt rom, ikkje tolv idear — rommet er rommet, og
 * terningen er den einaste knappen som lagar noko ein ikkje hadde tenkt på.
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
import { LASER, MATERIALS } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { makeShell } from "./shell"
import { build, buildAll, DETAIL, lagMesh } from "./mesh"
import { buildParts } from "./parts"
import { nest } from "./nest"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { lastForm } from "./lastform"
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

export const RIBBE: EngineDef = {
  id: "ribbe",
  label: "ribbe",
  note: "radiale blad og vassrette band, kryssholdte i kvarandre",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "blad",
  kanLast: true,
  lastForm: (bag) => lastForm(asP(bag)) as unknown as ParamBag,

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) =>
    randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, detail: DetailKey, view: View): BuildOut {
    return build(asP(bag), detail, view)
  },

  measure: (bag) => measure(asP(bag)),
  rules: (bag, m) => checkRules(asP(bag), m),

  exportFile(bag: ParamBag, what: ExportKind, maskin?: Maskin): ExportOut {
    const p = asP(bag)
    const sh = makeShell(p)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(sh, buildAll(p, DETAIL.hog, sh)), "ribbe")
      return {
        name: "ribbe.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    const g = buildAll(p, DETAIL.mid, sh)
    if (what === "svg") {
      return { name: "ribbe-profilar.svg", mime: "image/svg+xml", text: profileSvg(sh, g) }
    }
    // laseren: modellskala tjukn/bladeT, nesta på lasersenga
    const laser = maskin?.id === "laser" ? maskin : null
    const s = laser ? laser.tjukn / p.bladeT : 1
    const pl = buildParts(sh, g, MATERIALS[p.material].rho)
    const ns = nest(skalerDelar(pl.parts, s), laser ? LASER : undefined)
    const merk = laser ? "-laser" : ""
    if (what === "ark") {
      return { name: "ribbe-" + ns.sheets.length + "ark" + merk + ".svg", mime: "image/svg+xml", text: alleArkSvg(ns) }
    }
    return { name: "ribbe" + merk + ".dxf", mime: "application/dxf", text: partsToDxf(ns, laser ? laser.tjukn : p.bladeT) }
  },
}
