/**
 * VIKING som motor: kontrakten i core.ts, fylt av modulane i denne mappa.
 *
 * Sandkassen hadde fem typologiar og eit hol i midten. Fire av dei svarar
 * på det same spørsmålet — korleis byggjer ein ei krum sitjeflate av
 * flate plater? — og alle fire svarar det på ein måte ingen av dei seier
 * høgt: dei SNITTAR. VAFFEL i to retningar, SKIVE i éi, STRAUM på skrå,
 * RIBBE radialt. Fylgja er den same i alle fire, og ho er fysisk: du sit
 * på plata sin KANT. Sju til tjueein tverrskorne finérkantar under låret,
 * og flata finst berre som striper med luft imellom.
 *
 * LAFT nekta spørsmålet: ei plate er ei plate, komforten kjem av vinklar.
 * Der sit du på plateFLATA — men flata er flat.
 *
 * VIKING er det som stod att:
 *
 *                     du sit på KANTEN      du sit på FLATA
 *   krum flate        vaffel skive              VIKING
 *                     straum ribbe
 *   flat flate            —                      laft
 *
 * KLINKBYGGING er det eine handverket som har løyst nettopp dette før.
 * Eit vikingskip er krumt utan at eit einaste bord er krumt: kvart bord
 * er ei flat stripe, og krumminga bur i VINKELEN MELLOM DEI. Borda
 * overlappar i lappen — dei ligg ikkje kant i kant i eit spor — og
 * skalet vert ei lukka flate ein kan leggje handa på.
 *
 * Prisen står i tavla, som alltid, og han er ærleg: den same vinkelen som
 * gjev krumminga opnar ei GLIPE i lappen, og ei opning mellom fem og
 * tjuefem millimeter tek ein finger. Fleire bord lukkar glipa og kostar
 * delar; ein lengre lapp opnar henne forbi fara og kostar materiale.
 * VIKING er den einaste motoren der talet på delar er eit komfortval.
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
import { LASER, bbox } from "../core"
import { skalerDelar } from "../nestraster"
import { meshToStl } from "../skal/export-stl"
import { nest } from "../vaffel/nest"
import { partsToDxf } from "../vaffel/export-dxf"
import { alleArkSvg } from "../vaffel/export-svg"
import { finmaskNett } from "../lastnett"
import { byggDelar, buildParts } from "./parts"
import { contourLines, flateMesh, lagMesh } from "./mesh"
import { feltPaMesh, lastVerste } from "./last"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import {
  DEFAULT_PARAMS,
  GROUPS,
  HOVUDDRAG,
  NUDGE_PARAMS,
  PARAM_KEYS,
  PARAM_RANGES,
  POSAR,
  clampParams,
  randomParams,
  type Params,
} from "./params"

const asP = (p: ParamBag) => p as unknown as Params
/** kvar tomme buffer må vera si eiga — ein delt vert fråkopla av postMessage */
const EMPTY = () => new Float32Array(0)

export const VIKING: EngineDef = {
  id: "viking",
  label: "viking",
  note: "overlappande bord klinka til to spant — du sit på flata, ikkje på kanten",
  ranges: PARAM_RANGES,
  groups: GROUPS,
  keys: PARAM_KEYS,
  defaults: DEFAULT_PARAMS as unknown as ParamBag,
  nudge: NUDGE_PARAMS,
  poses: POSAR,
  hovuddrag: HOVUDDRAG,
  unitLabel: "bord",
  kanLast: true,

  clamp: (o, prev) => clampParams(o, asP(prev)) as unknown as ParamBag,
  random: (rnd, prev, locked) => randomParams(rnd, asP(prev), locked) as unknown as ParamBag,

  build(bag: ParamBag, _detail: DetailKey, view: View): BuildOut {
    const p = asP(bag)

    if (view === "kontur") {
      const c = contourLines(p)
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
    }

    const { delar } = byggDelar(p)

    if (view === "flate") {
      // BERRE borda. Skilnaden på «flate» og «lag» er spanta og naglane,
      // altså produksjonen — flata sjølv er der i begge, av di ho ER
      // platene og ikkje ei tilnærming til noko anna.
      const m = flateMesh(delar)
      return { ...m, lines: EMPTY(), heavy: EMPTY() }
    }

    if (view === "last") {
      const m0 = flateMesh(delar)
      const m = { ...m0, ...finmaskNett(m0) }
      return {
        ...m,
        felt: feltPaMesh(p, m.positions),
        feltTak: lastVerste(p).util,
        lines: EMPTY(),
        heavy: EMPTY(),
      }
    }

    const m = lagMesh(delar)
    return { ...m, lines: EMPTY(), heavy: EMPTY() }
  },

  measure: (bag) => measure(asP(bag)),
  rules: (bag, m) => checkRules(asP(bag), m),

  exportFile(bag: ParamBag, what: ExportKind, maskin?: Maskin): ExportOut {
    const p = asP(bag)
    if (what === "stl") {
      const bytes = meshToStl(lagMesh(byggDelar(p).delar), "viking")
      return {
        name: "viking.stl",
        mime: "model/stl",
        data: bytes.buffer.slice(0) as ArrayBuffer,
      }
    }
    const pl = buildParts(p)
    if (what === "svg") {
      // profilarket: kvart emne éin gong, i millimeter
      const seen = new Set<string>()
      const unike = pl.parts.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
      const GAP = 30
      let x = 0
      const bitar: string[] = []
      let W = 0
      let H = 0
      for (const d of unike) {
        const b = bbox(d.outline)
        const dx = x - b.x0
        const dy = -b.y0
        const bane = (r: { 0: number; 1: number }[]) =>
          `M ${r.map((q) => `${(q[0] + dx).toFixed(2)},${(q[1] + dy).toFixed(2)}`).join(" L ")} Z`
        bitar.push(`<path d="${bane(d.outline)}" fill="none" stroke="#111" stroke-width="0.8"/>`)
        for (const h of d.holes) {
          bitar.push(`<path d="${bane(h)}" fill="none" stroke="#111" stroke-width="0.5"/>`)
        }
        x += b.x1 - b.x0 + GAP
        W = x
        H = Math.max(H, b.y1 - b.y0)
      }
      const M = 20
      return {
        name: "viking-profilar.svg",
        mime: "image/svg+xml",
        text:
          `<svg xmlns="http://www.w3.org/2000/svg" width="${(W + 2 * M).toFixed(1)}mm" height="${(H + 2 * M).toFixed(1)}mm" ` +
          `viewBox="${-M} ${-M} ${(W + 2 * M).toFixed(1)} ${(H + 2 * M).toFixed(1)}">` +
          `<g transform="scale(1,-1) translate(0,${-H})">${bitar.join("")}</g></svg>`,
      }
    }
    const laser = maskin?.id === "laser" ? maskin : null
    const s = laser ? laser.tjukn / p.plyT : 1
    const ns = nest(
      skalerDelar(pl.parts, s),
      laser ? { ...LASER, tett: true } : { cell: 4, tett: true },
    )
    const merk = laser ? "-laser" : ""
    if (what === "ark" || what === "arksyn") {
      return {
        name: "viking-" + ns.sheets.length + "ark" + merk + ".svg",
        mime: "image/svg+xml",
        text: alleArkSvg(ns),
      }
    }
    return {
      name: "viking" + merk + ".dxf",
      mime: "application/dxf",
      text: partsToDxf(ns, laser ? laser.tjukn : p.plyT),
    }
  },
}
