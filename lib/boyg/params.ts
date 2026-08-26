/**
 * BØYG — parameterrommet.
 *
 * Typologien er PRESSBØYING, og han har berre eitt ledd: dybelen. Ei flat
 * finérplate vert lagd i ei form og pressa til ho har ei ny kvile — ein
 * grunn Z: eit bein som stig framme, ein fold som legg seg over i eit
 * setelaup, og ein hale som spring ut bak og landar som fot. Fleire slike
 * skal, alle av SAME form, vert nesta i kvarandre og pinna med éin einaste
 * gjennomgåande dybel. Alt anna i møbelet er kontakt og friksjon.
 *
 * Grensa i typologien er BØYERADIUSEN. Kald finér sprekk under om lag
 * hundre gonger tjukna si; pressa over form med vått lim og trykk går ho
 * langt tettare, ned mot ti til tjue gonger, av di finérlaga då får gli på
 * kvarandre medan limet er vått. Her er pressa føresetnaden, og faktoren
 * står som skyvar: han er det som avgjer om ei plate kan svinge ein fold
 * eller ikkje.
 *
 * Aksar: X = fram(+)/bak(−), Y = på tvers, Z = opp. Millimeter og grader.
 */
import {
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type Hovuddrag,
  type Pose,
  type Range,
  CUBE,
  type Metrics,
} from "../core"
import { bygg, kjerneSoner, soneR } from "./form"
// metrics.ts og rules.ts hentar berre TYPEN Params herifrå, so importen er asyklisk
import { measure } from "./metrics"
import { checkRules } from "./rules"

export type Params = {
  // --- PROFILEN ------------------------------------------------------------
  hogd: number // setehøgd på topskalet, mm
  setelop: number // setelaupet langs skalet, mm
  setekrum: number // setet sin dish langs laupet, grader sving
  nase: number // framkanten lyft: kort motsving rett etter folden, grader
  foldV: number // framfolden sin sving, grader
  foldR: number // framfolden sin radius, mm
  beinfall: number // framebeinet si helling frå loddrett, grader
  beinvri: number // beinet bøygd, grader per 100 mm
  haleV: number // halefolden sin sving, grader — spriket bakover
  haleR: number // halefolden sin radius, mm
  halevri: number // halen bøygd, grader per 100 mm

  // --- NESTINGA ------------------------------------------------------------
  skal: number // kor mange skal i fanen
  steg: number // vifta per skal, grader
  stegkurve: number // vifta si form: 1 er jamn, over 1 samlar midten
  klaring: number // luft mellom to naboskal ved dybelen, mm
  klaringfall: number // gapa graderte gjennom stabelen

  // --- SKALA ---------------------------------------------------------------
  plyT: number // platetjukn, mm
  breidd: number // skalbreidd der ein sit, mm
  breiddfall: number // kor mykje breidda smalnar mot endane
  krone: number // krone på tvers: setet disha frå side til side, mm
  sale: number // kor flatt foten er kappa: 0 tvert av, 1 i golvet
  skulder: number // avrunding av blanketthjørna, mm

  // --- PRESSA --------------------------------------------------------------
  boyefaktor: number // minste bøyeradius som gonger platetjukna
  finer: number // finértjukn i oppbygget, mm
  sprett: number // sprett attende av forma, grader

  // --- DYBELEN -------------------------------------------------------------
  pinnD: number // dybeldiameter, mm
  pinnstad: number // kor langt ute i kjernen dybelen står, del av kjernen
  pinnhol: number // hòlklaring over dybelen, mm
  pinnut: number // kor langt dybelen stikk ut av fanen, mm

  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 380, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  setelop: { min: 208, max: 300, step: 1, label: "setelaup", unit: "mm" },
  setekrum: { min: -4, max: 22, step: 0.5, label: "setedish", unit: "°" },
  nase: { min: 0, max: 16, step: 0.5, label: "framkantlyft", unit: "°" },
  foldV: { min: 78, max: 116, step: 0.5, label: "framfoldvinkel", unit: "°" },
  foldR: { min: 40, max: 120, step: 1, label: "framfoldradius", unit: "mm" },
  beinfall: { min: -28, max: 20, step: 0.5, label: "beinhelling", unit: "°" },
  beinvri: { min: -12, max: 12, step: 0.25, label: "beinbøy", unit: "°/100" },
  haleV: { min: 56, max: 96, step: 0.5, label: "halevinkel", unit: "°" },
  haleR: { min: 30, max: 120, step: 1, label: "halefoldradius", unit: "mm" },
  halevri: { min: -12, max: 12, step: 0.25, label: "halebøy", unit: "°/100" },

  skal: { min: 3, max: 9, step: 1, label: "skal", int: true },
  steg: { min: -3, max: 8, step: 0.1, label: "vifte", unit: "°" },
  stegkurve: { min: 0.55, max: 1.9, step: 0.01, label: "vifteform" },
  klaring: { min: 2, max: 48, step: 0.5, label: "klaring", unit: "mm" },
  klaringfall: { min: -0.6, max: 0.6, step: 0.005, label: "klaringfall" },

  plyT: { min: 5, max: 22, step: 0.5, label: "platetjukn", unit: "mm" },
  breidd: { min: 280, max: 440, step: 1, label: "skalbreidd", unit: "mm" },
  breiddfall: { min: 0, max: 0.55, step: 0.005, label: "breiddfall" },
  krone: { min: -8, max: 34, step: 0.5, label: "krone", unit: "mm" },
  sale: { min: 0, max: 1, step: 0.01, label: "saleskjering" },
  skulder: { min: 0, max: 70, step: 1, label: "skulder", unit: "mm" },

  boyefaktor: { min: 8, max: 22, step: 0.5, label: "bøyefaktor R/t" },
  finer: { min: 0.6, max: 3, step: 0.05, label: "finértjukn", unit: "mm" },
  sprett: { min: 0, max: 9, step: 0.1, label: "sprett attende", unit: "°" },

  pinnD: { min: 8, max: 26, step: 0.5, label: "dybeldiameter", unit: "mm" },
  pinnstad: { min: 0.06, max: 0.62, step: 0.005, label: "dybelstad" },
  pinnhol: { min: 0.1, max: 2, step: 0.05, label: "hòlklaring", unit: "mm" },
  pinnut: { min: 0, max: 45, step: 1, label: "dybelutstikk", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  {
    id: "profil",
    label: "profil",
    keys: [
      "hogd", "setelop", "setekrum", "nase", "foldV", "foldR",
      "beinfall", "beinvri", "haleV", "haleR", "halevri",
    ],
  },
  {
    id: "nest",
    label: "nesting",
    keys: ["skal", "steg", "stegkurve", "klaring", "klaringfall"],
  },
  {
    id: "skal",
    label: "skal",
    keys: ["plyT", "breidd", "breiddfall", "krone", "sale", "skulder"],
  },
  { id: "press", label: "pressa", keys: ["boyefaktor", "finer", "sprett"] },
  { id: "pinn", label: "dybelen", keys: ["pinnD", "pinnstad", "pinnhol", "pinnut"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * STANDARDEN er referansen: seks skal av sju millimeters bjørkefinér,
 * pressa over éi og same form, nesta tett i kvarandre og pinna med éin lys
 * dybel like inne i framfolden.
 *
 * Tre av tala er ikkje smak, dei er rekning. Bøyefaktoren står på åtte —
 * det er ei VÅT oppleggspresse, der finérlaga vert lagde i forma kvar for
 * seg og får gli på kvarandre medan limet er vått; ei ferdig plate pressa
 * varm ligg på tolv til tjue, og kald bøying på hundre. Platetjukna er
 * sju av di ho gongar opp: minste bøyeradius er faktoren gonger tjukna, og
 * kvar millimeter plate kostar åtte millimeter fold — og folden kostar
 * djupn i kuben to gonger, både framme og bak. Klaringa er fire, altså
 * UNDER fingerbandet: fanen må vera tett, av di kvart skal utanpå det
 * førre er ein radius større og eit stykke lengre, og lufta mellom dei
 * betaler seg i djupn.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 404,
  setelop: 222,
  setekrum: 10,
  nase: 6.5,
  foldV: 100,
  foldR: 56,
  beinfall: -2,
  beinvri: 0,
  haleV: 94,
  haleR: 56,
  halevri: 3.5,

  skal: 6,
  steg: 0.3,
  stegkurve: 1,
  klaring: 4,
  klaringfall: 0,

  plyT: 6.5,
  breidd: 410,
  breiddfall: 0.34,
  krone: 22,
  sale: 1,
  skulder: 24,

  boyefaktor: 8.5,
  finer: 1.3,
  sprett: 2.5,

  pinnD: 14,
  pinnstad: 0.09,
  pinnhol: 0.4,
  pinnut: 10,

  material: "bjork",
}

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "klaring" }

export const POSES: readonly Partial<Params>[] = []

/** Ingen posar enno — motoren står på stillaset og har ikkje fått ansikt. */
export const POSAR: readonly Pose[] = []

/** Hovuddraga: dei få kontrollane som verkeleg formar. Kvart drag styrer
 *  eitt eller fleire eksisterande band saman — ingen nye parametrar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "skal", label: "skal", keys: [["skal", 1]] },
  { id: "klaring", label: "klaring", keys: [["klaring", 1]] },
  { id: "fold", label: "framfold", keys: [["foldV", 1]] },
]

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

/**
 * Terningreparasjonen.
 *
 * Tre av krava i denne typologien er ikkje skyvarar men FYLGJER av dei, og
 * eit fritt kast bryt alle tre nesten kvar gong: djupna er summen av to
 * foldar og eit setelaup, bøyeradiusen er ein terskel platetjukna set, og
 * omhyllinga veks med vifta som ikkje står i nokon parameter.
 *
 * Difor er kaskaden todelt. Fyrst dei eksakte tala som kan reknast utan å
 * byggje noko: radiane mot tjukna, vridinga mot same terskelen, dybelen
 * mot platetjukna. So ei MÅLT lykkje, av di resten — omhyllinga, nestinga,
 * utkraget — er integral over ei geometri som ikkje finst før ho er bygd.
 * Ei måling kostar fjorten millisekund; berre kast som framleis bryt noko
 * betaler for fleire.
 */
function fiksTerning(q: Params, locked: ReadonlySet<string>): Params {
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k as string]
    ;(q as Record<string, number | string>)[k as string] = Math.min(
      r.max,
      Math.max(r.min, r.int ? Math.round(v) : +v.toFixed(3)),
    )
  }

  // --- eksakt: bøyeradiusen er ein terskel og ikkje ein smak -------------
  // Ei plate bøygd tettare enn faktoren gonger tjukna sprekk. Vridinga
  // langs laupet er den same radiusen sedd frå ei anna side: `vri` grader
  // per hundre millimeter er radien 5730/vri.
  const rMax = Math.min(PARAM_RANGES.foldR.max, PARAM_RANGES.haleR.max)
  const krav = () => q.boyefaktor * q.plyT
  // Kravet er eit produkt av to skyvarar, og ingen radius i kuben kan møte
  // det om produktet spring forbi den største folden som får plass. Då er
  // det tjukna som må vike — ei tynnare plate svingar tettare, og det er
  // heile grunnen til at denne typologien er tynn.
  if (krav() > rMax) fix("plyT", rMax / q.boyefaktor)
  if (krav() > rMax) fix("boyefaktor", rMax / q.plyT)
  if (q.foldR < krav()) fix("foldR", krav())
  if (q.haleR < krav()) fix("haleR", krav())
  const vriTak = () => 5729.58 / Math.max(1, krav())
  if (Math.abs(q.beinvri) > vriTak()) fix("beinvri", Math.sign(q.beinvri) * vriTak())
  if (Math.abs(q.halevri) > vriTak()) fix("halevri", Math.sign(q.halevri) * vriTak())
  // dybelen treng gods: hòlet et kjernen, og ein grov dybel i tynn plate
  // gjev hòltrykk lenge før han gjev styrke
  if (q.pinnD > 2.4 * q.plyT) fix("pinnD", 2.4 * q.plyT)

  // --- målt: alt som er eit integral over den bygde forma ---------------
  //
  // Omhyllinga her er ikkje ein sum av to eller tre skyvarar. Ho er
  // integralet av heile profilen: to foldar med kvar sin radius, eit
  // setelaup, ei vridning langs kvar arm, ein nase og eit setedish — og
  // ved ALLE lengdemål på minimum kan djupna framleis stå i åtte hundre
  // millimeter om vinklane står feil. Det finst ingen einskild spak å dra
  // i, og ein kaskade som prøver å gisse seg fram til rett spak vil ta
  // feil oftare enn han tek rett.
  //
  // Difor: når eit kast ikkje kan bergast av sine eigne spakar, vert det
  // DREGE MOT REFERANSEPUNKTET. Standarden er lovleg per definisjon, so
  // ei blanding mot han konvergerer alltid — og han vert dregen so lite
  // som råd: prøva startar på ein sjettedel og aukar berre når ho må.
  // Eit kast som held alt ved fyrste måling vert ikkje rørt i det heile.
  const start: Record<string, number> = {}
  for (const k of PARAM_KEYS) {
    const v = (q as Record<string, number | string>)[k]
    if (typeof v === "number") start[k] = v
  }
  const dra = (t: number) => {
    for (const k of PARAM_KEYS) {
      if (locked.has(k) || start[k] === undefined) continue
      const d = (DEFAULT_PARAMS as unknown as Record<string, number>)[k]
      if (typeof d !== "number") continue
      fix(k as keyof Params, start[k] + (d - start[k]) * t)
    }
  }

  for (const t of [0, 0.1, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1]) {
    if (t > 0) dra(t)
    // Målretta fyrst, heimdraging berre om dei ikkje held. Kvart av desse
    // grepa er ein spak som verkeleg styrer det han rettar, og dei kostar
    // langt mindre av kastet sin karakter enn ei blanding gjer.
    for (let i = 0; i < 5; i++) {
      let mm: Metrics
      try {
        mm = measure(q)
      } catch {
        break
      }
      const b = checkRules(q, mm).filter((r) => !r.ok && r.hard)
      if (!b.length) break
      const har = (id: string) => b.some((r) => r.id === id)
      let gjort = false
      const big = Math.max(mm.envX, mm.envY, mm.envZ)
      if (har("kube") && big > CUBE - 6) {
        // Omhyllinga er nesten lineær i lengdemåla: ein skalafaktor treffer
        // i eitt steg der ei einskild spak ville trunge fem.
        const sc = Math.max(0.8, (CUBE - 10) / big)
        for (const k of ["setelop", "foldR", "haleR", "breidd", "hogd"] as const) fix(k, q[k] * sc)
        if (q.foldR < krav()) fix("foldR", krav())
        if (q.haleR < krav()) fix("haleR", krav())
        gjort = true
      }
      if (!gjort && har("utkrag") && q.krone < PARAM_RANGES.krone.max) {
        // Krona gjer snittet til ei renne i staden for eit ark, og det er
        // billegare enn ei tjukkare plate — tjukna dreg bøyekravet med seg.
        fix("krone", q.krone + 7)
        gjort = true
      }
      if (!gjort && har("velting") && q.haleV > PARAM_RANGES.haleV.min + 4) {
        fix("haleV", q.haleV - 6) // flatare hale når lenger bak
        gjort = true
      }
      if (!gjort && har("sitjehogd")) {
        fix("hogd", q.hogd + (mm.sitZ < 400 ? 398 - mm.sitZ : 468 - mm.sitZ))
        gjort = true
      }
      if (!gjort && har("nesting")) {
        if (Math.abs(q.steg) > 0.4) fix("steg", q.steg * 0.5)
        else fix("klaring", q.klaring + 5)
        gjort = true
      }
      if (!gjort && (har("holtrykk") || har("dybelgods"))) {
        fix("pinnD", q.pinnD - 2)
        gjort = true
      }
      if (!gjort) break
    }
    let m: Metrics
    try {
      m = measure(q)
    } catch {
      continue // ei form som ikkje let seg måle er ikkje ei form å stole på
    }
    const brot = checkRules(q, m).filter((r) => !r.ok && r.hard)
    if (!brot.length && m.mass <= 12) break
    // Massen er breidd gonger tjukn gonger tal skal, og han er den einaste
    // som kan rettast utan å røre forma: eit skal av eller ein millimeter
    // tynnare plate kostar mindre uttrykk enn å dra heile kastet heim.
    if (!brot.length) {
      for (let i = 0; i < 4 && measure(q).mass > 12; i++) {
        if (q.skal > 3) fix("skal", q.skal - 1)
        else if (q.plyT > PARAM_RANGES.plyT.min + 0.5) fix("plyT", q.plyT - 1)
        else fix("breidd", q.breidd - 25)
      }
      if (measure(q).mass <= 12) break
    }
  }
  return q
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(rnd, prev, POSES, DEFAULT_PARAMS, PARAM_RANGES, PARAM_KEYS, locked)
  const q = posed ?? (randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked) as Params)
  void bygg
  void kjerneSoner
  void soneR
  return fiksTerning(q, locked)
}
