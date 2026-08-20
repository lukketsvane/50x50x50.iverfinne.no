/**
 * SKIVE — parameterrommet.
 *
 * Typologien er den enklaste av alle: parallelle, ståande skiver med luft
 * imellom, tredde på stavar. Kvar skive er heile møbelet sett frå sida —
 * sete, rygg og to føter i EITT stykke — og møbelet er den same silhuetten
 * gjenteken med små endringar på vegen ut mot sidene. Det er den einaste
 * typologien her der snittet og møbelet er same teikning.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg (skivene står normalt på Y),
 * Z = opp. Alle mål i millimeter, vinklar i grader.
 */
import {
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type ParamBag,
  type Range,
} from "../core"

export type Params = {
  // --- SETE ---------------------------------------------------------------
  hogd: number // setekanten ved nasen, mm
  djup: number // sete frå nase til rygg, mm
  grop: number // setegropa på det djupaste, mm
  nase: number // naseradius framme, mm

  // --- RYGG ---------------------------------------------------------------
  ryggH: number // ryggkanten over setet, mm — null er ein krakk
  ryggV: number // bakoverlening, grader
  ryggB: number // ryggboge: kor mykje ryggen bular bakover på midten, mm
  ryggT: number // ryggtjukn i profilen, mm

  // --- BEIN OG BOGE -------------------------------------------------------
  frambein: number // framfoten si breidd på golvet, mm
  bakbein: number // bakfoten si breidd på golvet, mm
  bogeH: number // kor høgt opninga under setet når, mm
  bogeN: number // bogeeksponent: 2 er ellipse, 4 er nesten firkant
  flare: number // kor brått framkanten flarar ut mot foten

  // --- SKIVENE ------------------------------------------------------------
  skiver: number // kor mange skiver
  plyT: number // skivetjukn, mm
  luft: number // opning mellom skivene, mm
  kuppel: number // kor mykje ryggen fell av ut mot sidene, 0–1
  sidefall: number // kor mykje setet fell av ut mot sidene, mm
  innsving: number // kor mykje dei ytste skivene er dregne inn, 0–1
  bogefall: number // kor mykje bogen krympar ut mot sidene, 0–1 — hòla vert ei GROTTE
  bogedrift: number // kor langt bogetoppen sig bakover/framover ut mot sidene, mm
  vifte: number // skivene roterte i solfjøs kring midten, grader per ytste skive

  // --- BYGG ---------------------------------------------------------------
  stavD: number // stavdiameter, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 380, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  djup: { min: 300, max: 420, step: 1, label: "setedjup", unit: "mm" },
  grop: { min: 0, max: 40, step: 0.5, label: "setegrop", unit: "mm" },
  nase: { min: 8, max: 45, step: 0.5, label: "naseradius", unit: "mm" },

  ryggH: { min: 0, max: 120, step: 1, label: "rygghøgd", unit: "mm" },
  ryggV: { min: 0, max: 28, step: 0.5, label: "rygglening", unit: "°" },
  ryggB: { min: 0, max: 40, step: 0.5, label: "ryggboge", unit: "mm" },
  ryggT: { min: 40, max: 110, step: 1, label: "ryggtjukn", unit: "mm" },

  frambein: { min: 90, max: 210, step: 1, label: "framfot", unit: "mm" },
  bakbein: { min: 90, max: 220, step: 1, label: "bakfot", unit: "mm" },
  bogeH: { min: 120, max: 330, step: 1, label: "bogehøgd", unit: "mm" },
  bogeN: { min: 1.6, max: 5, step: 0.05, label: "bogeform" },
  flare: { min: 1.2, max: 3.6, step: 0.05, label: "flare" },

  skiver: { min: 7, max: 21, step: 1, label: "skiver", int: true },
  plyT: { min: 9, max: 24, step: 0.5, label: "skivetjukn", unit: "mm" },
  luft: { min: 0, max: 60, step: 0.5, label: "luft", unit: "mm" },
  kuppel: { min: -0.5, max: 0.8, step: 0.005, label: "kuppel" },
  sidefall: { min: -20, max: 30, step: 0.5, label: "sidefall", unit: "mm" },
  innsving: { min: -0.1, max: 0.16, step: 0.002, label: "innsving" },
  bogefall: { min: 0, max: 0.9, step: 0.005, label: "grotte" },
  bogedrift: { min: -90, max: 90, step: 1, label: "bogedrift", unit: "mm" },
  vifte: { min: -14, max: 14, step: 0.5, label: "vifte", unit: "°" },

  stavD: { min: 8, max: 16, step: 0.5, label: "stavdiameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "sete", label: "sete", keys: ["hogd", "djup", "grop", "nase"] },
  { id: "rygg", label: "rygg", keys: ["ryggH", "ryggV", "ryggB", "ryggT"] },
  {
    id: "bein",
    label: "bein",
    keys: ["frambein", "bakbein", "bogeH", "bogeN", "flare"],
  },
  {
    id: "skiver",
    label: "skiver",
    keys: ["skiver", "plyT", "luft", "kuppel", "sidefall", "innsving", "bogefall", "bogedrift", "vifte"],
  },
  { id: "bygg", label: "bygg", keys: ["stavD"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden siktar på referansespråket: tretten skiver, tjue millimeter
 * luft, ein låg kuppelrygg som fell av mot sidene, og ei stor opning under
 * setet. Ryggen er låg med vilje — kuben på 500 og sitjehøgdbandet i
 * NS-EN 1729 gjev til saman under 120 mm rygg over setet, og det er nok
 * til ei lend, ikkje til eit skulderblad.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 404,
  djup: 324,
  grop: 16,
  nase: 26,

  ryggH: 90,
  ryggV: 13,
  ryggB: 14,
  ryggT: 50,

  frambein: 112,
  bakbein: 116,
  bogeH: 290,
  bogeN: 2.6,
  flare: 2.2,

  skiver: 11,
  plyT: 14,
  luft: 31,
  kuppel: 0.42,
  sidefall: 10,
  innsving: 0.05,
  bogefall: 0,
  bogedrift: 0,
  vifte: 0,

  stavD: 12,
  material: "bjork",
}

/**
 * Kuraterte posar: fire handdesigna utgangspunkt terningen jittrar kring
 * annakvar gong. Grotta er den mørke referansen — bogen krympar og sig på
 * skrå gjennom stabelen; benken er rein og rygglaus; stolen er den blå
 * referansen med høg kuppel; den lette er luft og nesten ingenting anna.
 */
export const POSES: readonly Partial<Params>[] = [
  // grotta
  {
    bogefall: 0.72, bogedrift: 55, bogeH: 320, bogeN: 2.2,
    skiver: 10, plyT: 14, luft: 34, ryggH: 70, kuppel: 0.15,
    grop: 20, sidefall: 16, innsving: 0.03, djup: 330,
  },
  // benken
  {
    ryggH: 0, hogd: 396, djup: 360, frambein: 130, bakbein: 130,
    bogeH: 300, luft: 36, skiver: 10, plyT: 15, kuppel: 0,
    sidefall: 18, grop: 24, bogefall: 0.2,
  },
  // stolen
  {
    ryggH: 100, hogd: 396, ryggV: 20, ryggB: 24, kuppel: 0.55,
    skiver: 12, plyT: 13, luft: 28, djup: 330, grop: 14, sidefall: 8,
  },
  // den lette
  {
    skiver: 8, plyT: 19, luft: 44, bogeH: 320, bogeN: 1.9,
    frambein: 100, bakbein: 104, ryggH: 60, kuppel: 0.3,
    innsving: 0.09, stavD: 14,
  },
  // vifta: skivene roterte i solfjøs — same kuttfil, heilt anna møbel
  {
    vifte: 7, skiver: 12, plyT: 13, luft: 26, ryggH: 80,
    kuppel: 0.35, grop: 18, djup: 322, bogeH: 290, frambein: 104, bakbein: 106,
  },
  // vengene: ryggen STIG ut mot sidene og setet kronar seg
  {
    kuppel: -0.45, ryggH: 68, hogd: 396, sidefall: -12,
    ryggV: 16, skiver: 12, plyT: 14, luft: 27, grop: 22,
  },
  // spent: dei ytste skivene er STØRRE — silhuetten spriker som ein gange
  {
    innsving: -0.08, djup: 324, hogd: 398, frambein: 100, bakbein: 104,
    skiver: 11, plyT: 14, luft: 30, ryggH: 74, kuppel: 0.3, bogeH: 300,
  },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "luft" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(rnd, prev, POSES, DEFAULT_PARAMS, PARAM_RANGES, PARAM_KEYS, locked)
  const q = posed ?? (randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked) as Params)
  // Terningen får kaste kva han vil, men tre tal er SUMAR av andre og
  // bryt kuben nesten alltid utan hjelp: breidda, rygghøgda og djupna.
  // Reparasjonen rører berre ulåste skyvarar, og alltid innanfor banda.
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k]
    ;(q as Record<string, number | string>)[k] = Math.min(r.max, Math.max(r.min, +v.toFixed(3)))
  }
  const n = Math.max(2, Math.round(q.skiver))
  const wMax = 492
  if (n * q.plyT + (n - 1) * q.luft > wMax) {
    fix("luft", (wMax - n * q.plyT) / (n - 1))
    const n2 = Math.max(2, Math.round(q.skiver))
    if (n2 * q.plyT + (n2 - 1) * q.luft > wMax) {
      fix("skiver", Math.floor((wMax + q.luft) / (q.plyT + q.luft)))
    }
  }
  if (q.hogd + q.ryggH > 494) fix("ryggH", 494 - q.hogd)
  // djupna: nase + flare framme og rygg + flare bak et av kuben i X
  const envX = q.djup + 0.25 * q.frambein + q.ryggT + 0.35 * q.bakbein
  if (envX > 492) fix("djup", 492 - 0.25 * q.frambein - q.ryggT - 0.35 * q.bakbein)
  // gropa skal ikkje dra sitjehøgda under bandet
  if (q.hogd - 0.6 * (q.grop + q.sidefall) < 382) fix("grop", Math.max(0, (q.hogd - 382) / 0.6 - q.sidefall))
  return q
}
