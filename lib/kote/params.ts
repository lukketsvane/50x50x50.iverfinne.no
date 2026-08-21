/**
 * KOTE — parameterrommet.
 *
 * Typologien er vassrett kotesnitt. Ein kropp vert definert i rommet og
 * skoren av VASSRETTE plan; kvar plate er den høgda sitt PLAN, kutta av
 * ark; platene vert tredde på loddrette stavar med luft imellom og låste
 * med kile. Det som berre vassrett snitt kan gje står i midten av rommet
 * her: planet kan VRI SEG frå kote til kote, holet kan gå tvers gjennom
 * kroppen utan å dele nokon plate, og setet kan skjerast som ei skål av
 * konsentriske riller — eit kotekart ein sit i.
 *
 * Aksar: X = framover, Y = sideveg, Z = opp. Alle mål i millimeter,
 * vinklar i grader.
 */
import {
  MATERIALS,
  clampBag,
  poseBag,
  randomBag,
  smooth,
  type Group,
  type ParamBag,
  type Range,
} from "../core"
import { buildStack, hylseAv, luftFor, stackTal, toppHogd } from "./stack"
import { measure } from "./metrics"

export type Params = {
  // --- PLANET -------------------------------------------------------------
  lober: number // tal lober i planet — tre er den rundkanta trekanten
  rundhet: number // hjørneradius som del av ytre radius: 0 mangekant, 1 sirkel
  sidebog: number // sida bular ut (+) eller inn (−), del av radien
  rundvri: number // rundleiken frå fot til sete: + rundare oppe
  vri: number // vridinga frå botn til topp, grader — det berre vassrett snitt kan

  // --- KROPPEN ------------------------------------------------------------
  hogd: number // setehøgd, mm — toppen av stabelen
  fotR: number // ytre radius ved golvet, mm
  midjeR: number // ytre radius i midja, mm
  seteR: number // ytre radius i setet, mm
  midjeH: number // midjehøgda som del av høgda
  fotkurve: number // kor lenge foten held breidda før han knip inn
  setekurve: number // kor lenge halsen held seg smal før setet flikar ut

  // --- HOLET --------------------------------------------------------------
  holhogd: number // opninga si høgd, mm — null er ingen opning
  holZ: number // opninga sitt senter som del av høgda
  holdjup: number // kor djupt biten går, del av radien
  holbreidd: number // biten si halve breidd, grader
  holtal: number // kor mange bit — eitt er ei bukt, fleire er gjennomsyn
  holfase: number // bita dreidde bort frå plassen mellom lobene, grader

  // --- PLATENE ------------------------------------------------------------
  plyT: number // platetjukn, mm
  luft: number // ynskt gap mellom platene, mm — platetalet fell ut av det
  sokkel: number // kor mange av dei nedste gapa som er lukka til ein massiv fot

  // --- STAVANE ------------------------------------------------------------
  stavar: number // kor mange stavar
  stavD: number // stavdiameter, mm
  stavInn: number // innsteg frå kanten i den trongaste kotelina, mm
  stavOver: number // kor høgt staven står over setet, mm
  kileB: number // kiletjukn, mm
  kileH: number // kilehøgd, mm

  // --- SETET --------------------------------------------------------------
  skaal: number // skåldjupn i setet, mm
  riller: number // kor mange konsentriske riller skåla er skoren i
  skaalR: number // skålradius som del av setet sin innskrivne radius

  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  lober: { min: 3, max: 7, step: 1, label: "lober", int: true },
  rundhet: { min: 0.05, max: 0.95, step: 0.01, label: "rundleik" },
  sidebog: { min: -0.25, max: 0.4, step: 0.005, label: "sidebog" },
  rundvri: { min: -0.4, max: 0.4, step: 0.005, label: "rundfall" },
  vri: { min: -80, max: 80, step: 1, label: "vriding", unit: "°" },

  hogd: { min: 380, max: 480, step: 1, label: "setehøgd", unit: "mm" },
  fotR: { min: 100, max: 240, step: 1, label: "fotradius", unit: "mm" },
  midjeR: { min: 60, max: 230, step: 1, label: "midjeradius", unit: "mm" },
  seteR: { min: 110, max: 240, step: 1, label: "seteradius", unit: "mm" },
  midjeH: { min: 0.22, max: 0.82, step: 0.005, label: "midjehøgd" },
  fotkurve: { min: 0.5, max: 2.6, step: 0.05, label: "fotkurve" },
  setekurve: { min: 0.5, max: 2.6, step: 0.05, label: "setekurve" },

  holhogd: { min: 0, max: 250, step: 1, label: "holhøgd", unit: "mm" },
  holZ: { min: 0.12, max: 0.62, step: 0.005, label: "holet står" },
  holdjup: { min: 0, max: 0.92, step: 0.01, label: "holdjupn" },
  holbreidd: { min: 10, max: 58, step: 1, label: "holbreidd", unit: "°" },
  holtal: { min: 1, max: 4, step: 1, label: "bit", int: true },
  holfase: { min: -60, max: 60, step: 1, label: "holfase", unit: "°" },

  plyT: { min: 12, max: 30, step: 0.5, label: "platetjukn", unit: "mm" },
  luft: { min: 0, max: 48, step: 0.5, label: "luft", unit: "mm" },
  sokkel: { min: 0, max: 3, step: 1, label: "sokkel", int: true },

  stavar: { min: 2, max: 5, step: 1, label: "stavar", int: true },
  stavD: { min: 8, max: 20, step: 0.5, label: "stavdiameter", unit: "mm" },
  stavInn: { min: 12, max: 60, step: 1, label: "stavinnsteg", unit: "mm" },
  stavOver: { min: 6, max: 44, step: 1, label: "staven over setet", unit: "mm" },
  kileB: { min: 2, max: 9, step: 0.25, label: "kiletjukn", unit: "mm" },
  kileH: { min: 10, max: 40, step: 1, label: "kilehøgd", unit: "mm" },

  skaal: { min: 0, max: 26, step: 0.5, label: "skåldjupn", unit: "mm" },
  riller: { min: 1, max: 12, step: 1, label: "riller", int: true },
  skaalR: { min: 0.3, max: 0.95, step: 0.01, label: "skålradius" },
}

export const GROUPS: readonly Group[] = [
  { id: "plan", label: "planet", keys: ["lober", "rundhet", "sidebog", "rundvri", "vri"] },
  {
    id: "kropp",
    label: "kroppen",
    keys: ["hogd", "fotR", "midjeR", "seteR", "midjeH", "fotkurve", "setekurve"],
  },
  {
    id: "hol",
    label: "holet",
    keys: ["holhogd", "holZ", "holdjup", "holbreidd", "holtal", "holfase"],
  },
  { id: "plater", label: "platene", keys: ["plyT", "luft", "sokkel"] },
  {
    id: "stavar",
    label: "stavane",
    keys: ["stavar", "stavD", "stavInn", "stavOver", "kileB", "kileH"],
  },
  { id: "sete", label: "setet", keys: ["skaal", "riller", "skaalR"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden ER referansen: ein krakk på 450 der planet er ein rundkanta
 * trekant, foten brei og flat, midja litt over halve høgda og setet flika
 * ut att til ein ny rundkanta trekant. Silhuetten knip inn til 65 % av
 * fotbreidda i midja.
 *
 * Ti plater på 22 mm med 25,6 mm luft. Gapet er om lag so djupt som plata
 * er tjukk — men det er ikkje smak: 25,6 er den fyrste verdien OVER
 * fingerbandet på 5–25 som eit heilt platetal i 450 millimeter gjev, og
 * bandet gjeld ni gonger oppå kvarandre. Det er difor kotane er ti og
 * ikkje femten.
 *
 * Tre bit mellom lobene et seg 45 % inn frå foten opp til midja og lèt tre
 * bein stå att med vindauge imellom: opninga måler 239 × 113 mm. Bita og
 * lobene byter plass med kvarandre av seg sjølve — søket etter stavringen
 * legg stavane der godset er, altså i lobene, og då er det tynnaste av
 * planet som vert bore bort.
 *
 * Tre stavar på 14 mm står i lobene 104 mm ute, kila øvst, og setet er
 * skore som ei skål av fem konsentriske riller. Skåla stoggar på 72 mm av
 * di stavhòla står på 104 — det er stavringen, ikkje smaken, som set kor
 * stor skåla kan bli.
 */
export const DEFAULT_PARAMS: Params = {
  lober: 3,
  rundhet: 0.55,
  sidebog: 0.04,
  rundvri: 0.1,
  vri: 0,

  hogd: 450,
  fotR: 176,
  midjeR: 122,
  seteR: 180,
  midjeH: 0.55,
  fotkurve: 1.25,
  setekurve: 1,

  holhogd: 232,
  holZ: 0.24,
  holdjup: 0.45,
  holbreidd: 46,
  holtal: 3,
  holfase: 0,

  plyT: 22,
  luft: 26,
  sokkel: 0,

  stavar: 3,
  stavD: 14,
  stavInn: 18,
  stavOver: 24,
  kileB: 5,
  kileH: 26,

  skaal: 14,
  riller: 5,
  skaalR: 0.47,

  material: "bjork",
}

/**
 * Kuraterte posar: handdesigna utgangspunkt terningen jittrar kring
 * annakvar gong. Kvar av dei er ein ANNAN familie i det same rommet —
 * ikkje standarden med andre tal.
 */
export const POSES: readonly Partial<Params>[] = [
  // SKRUEN. Vridinga er det einaste vassrett snitt kan og loddrett ikkje:
  // fire lober som dreiar seg femtifem grader frå fot til sete. Planet er
  // rundt av naudsyn og ikkje av smak — ein djup lobe som vrir seg står
  // med toppen sin utanfor naboen sin, og då heng han.
  {
    lober: 4, vri: 55, rundhet: 0.72, rundvri: 0.16, sidebog: 0.02,
    hogd: 450, fotR: 178, midjeR: 132, seteR: 180, midjeH: 0.5,
    fotkurve: 1.1, setekurve: 1,
    holhogd: 230, holZ: 0.26, holdjup: 0.3, holbreidd: 34, holtal: 4, holfase: 0,
    plyT: 22, luft: 26, sokkel: 0,
    stavar: 4, stavD: 13, stavInn: 16, stavOver: 24, kileB: 5, kileH: 26,
    skaal: 11, riller: 6, skaalR: 0.5,
  },
  // SOKKELEN. Dei tre nedste gapa er lukka, so foten er ein massiv kloss
  // på fire kotar og resten står som eit tårn av få, tjukke plater oppå
  // han. Krakken får ei tung rot og ei lett krone.
  {
    lober: 3, vri: 0, rundhet: 0.68, rundvri: -0.1, sidebog: 0.1,
    hogd: 440, fotR: 188, midjeR: 144, seteR: 182, midjeH: 0.6,
    fotkurve: 1.9, setekurve: 0.9,
    holhogd: 210, holZ: 0.3, holdjup: 0.24, holbreidd: 34, holtal: 3, holfase: 0,
    plyT: 24, luft: 28, sokkel: 3,
    stavar: 3, stavD: 16, stavInn: 20, stavOver: 26, kileB: 6, kileH: 28,
    skaal: 16, riller: 7, skaalR: 0.5,
  },
  // KLØVEREN. Fem lober med innoverbøygde sider — planet er ein blome, og
  // kvar kote teiknar han om att litt mindre eller litt større.
  {
    lober: 5, vri: -18, rundhet: 0.46, rundvri: 0.2, sidebog: -0.14,
    hogd: 446, fotR: 184, midjeR: 146, seteR: 182, midjeH: 0.5,
    fotkurve: 1.4, setekurve: 1.2,
    holhogd: 190, holZ: 0.25, holdjup: 0.28, holbreidd: 22, holtal: 5, holfase: 0,
    plyT: 20, luft: 27, sokkel: 0,
    stavar: 5, stavD: 12, stavInn: 16, stavOver: 20, kileB: 4.5, kileH: 22,
    skaal: 10, riller: 9, skaalR: 0.52,
  },
  // PORTEN. Eitt einaste, svært bit: krakken har ei bukt i eine sida ein
  // kan ta tak i og bera han etter, og resten av kroppen står urørt. Eit
  // einsleg bit må vera høgt — det er berre høgda som gjev taket over
  // opninga plater nok til å lukke seg over.
  {
    lober: 3, vri: 0, rundhet: 0.74, rundvri: 0, sidebog: 0.06,
    hogd: 432, fotR: 190, midjeR: 158, seteR: 186, midjeH: 0.46,
    fotkurve: 1.5, setekurve: 0.85,
    holhogd: 250, holZ: 0.3, holdjup: 0.28, holbreidd: 50, holtal: 1, holfase: 0,
    plyT: 24, luft: 30, sokkel: 0,
    stavar: 3, stavD: 16, stavInn: 20, stavOver: 22, kileB: 6, kileH: 24,
    skaal: 17, riller: 8, skaalR: 0.5,
  },
  // TRAKTA. Brei flat fot, midja høgt oppe, og eit sete som flikar ut att
  // over eit kort spenn. Det korte spennet er heile poenget og heile
  // vanskane: flikinga har berre tre plater på seg til å koma ut.
  {
    lober: 3, vri: 12, rundhet: 0.5, rundvri: 0.22, sidebog: 0.14,
    hogd: 452, fotR: 200, midjeR: 148, seteR: 182, midjeH: 0.62,
    fotkurve: 0.8, setekurve: 0.9,
    holhogd: 210, holZ: 0.28, holdjup: 0.34, holbreidd: 42, holtal: 3, holfase: 0,
    plyT: 25, luft: 28, sokkel: 0,
    stavar: 3, stavD: 14, stavInn: 18, stavOver: 20, kileB: 5, kileH: 22,
    skaal: 14, riller: 4, skaalR: 0.5,
  },
  // KOTEKARTET. Tolv tynne kotar er så mange strekar som eit gap over
  // fingerbandet gjev rom for i 450 millimeter, og setet er ei skål av
  // tolv riller: heile krakken er kotelinjer, i silhuetten og i flata ein
  // sit på. Skåla er grunn av di plata er tynn — det skal stå fem
  // millimeter finér att under det djupaste, og tretten minus fem er åtte.
  //
  // Den motsette enden av `luft` — gap under fem millimeter, tjuefem kotar
  // tett i tett — er eit verkeleg medlem av familien, men han er ikkje ein
  // pose: ein stabel som er tre firedelar massiv veg over femten kilo før
  // setet er breitt nok til å sitje på. Terningen finn han, og kaskaden
  // flyttar platetalet ned til han ber seg.
  {
    lober: 6, vri: 14, rundhet: 0.7, rundvri: -0.08, sidebog: 0.04,
    hogd: 448, fotR: 176, midjeR: 150, seteR: 182, midjeH: 0.52,
    fotkurve: 1.2, setekurve: 1,
    holhogd: 250, holZ: 0.27, holdjup: 0.18, holbreidd: 22, holtal: 3, holfase: 0,
    plyT: 13, luft: 26, sokkel: 0,
    stavar: 3, stavD: 12, stavInn: 16, stavOver: 20, kileB: 4.5, kileH: 22,
    skaal: 7, riller: 12, skaalR: 0.55,
  },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "luft" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

// =============================================================================
// REPARASJONSKASKADEN
// =============================================================================
/** kuben minus litt: alt objektet får fylle */
const KUBE = 494

/**
 * Terningen får kaste kva han vil. Etterpå dreg denne kaskaden kastet inn
 * i dei harde reglane att — fyrst med aritmetikk der samanhengen er
 * eksakt (kila, kuben, gapet), so med MÅLING der han ikkje er det.
 *
 * Rekkjefylgja er ikkje tilfeldig: kila og skåla er reine ulikskapar
 * mellom to skyvarar, kuben er ein sum, gapet er eit heiltalsval, og
 * overhenget og stavane er ting berre geometrien veit svaret på. Låste
 * skyvarar står urørte heile vegen.
 */
function fiksTerning(q0: Params, locked: ReadonlySet<string>): Params {
  const q = { ...q0 }
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k]
    if (!r || !Number.isFinite(v)) return
    const c = Math.min(r.max, Math.max(r.min, v))
    ;(q as Record<string, number | string>)[k] = r.int ? Math.round(c) : +c.toFixed(4)
  }
  const fri = (k: keyof Params) => !locked.has(k)

  // --- daudsonene: kvart kast må VELJE side ---------------------------------
  // Eit hol på tolv millimeter er ikkje eit hol, det er ei ripe i
  // silhuetten; ein rille på ein millimeter er ikkje ei skål. Halvvegs er
  // det verste eit slikt trekk kan vera, so kastet vert dytta til den
  // næraste av dei to endane.
  if (q.holhogd > 0 && q.holhogd < 55) fix("holhogd", q.holhogd < 28 ? 0 : 55)
  if (q.holdjup > 0 && q.holdjup < 0.12) fix("holdjup", q.holdjup < 0.06 ? 0 : 0.12)
  if (q.holdjup < 0.06 || q.holhogd < 28) {
    fix("holhogd", 0)
    fix("holdjup", 0)
  }
  if (q.skaal > 0 && q.skaal < 3) fix("skaal", q.skaal < 1.5 ? 0 : 3)

  // --- kila (hard) ----------------------------------------------------------
  // To ulikskapar: tjukna mot staven, og kor djupt kila går mot kor høgt
  // stavenden står fri over setet. Ho vert køyrd om att kvar gong noko
  // rører staven eller høgda — det er nett dei to kila heng i.
  // Marginen på ein hundredel er ikkje pynt: `fix` rundar av til fire
  // desimalar, og ein reint utrekna grenseverdi kan runde OPPOVER og lande
  // ein billiondels millimeter på feil side av sin eigen ulikskap.
  const kileFix = () => {
    fix("kileB", Math.min(q.kileB, 0.4 * q.stavD - 0.01))
    if (0.6 * q.kileH <= q.stavOver - 4) return
    if (fri("kileH")) fix("kileH", (q.stavOver - 4) / 0.6 - 0.01)
    if (0.6 * q.kileH > q.stavOver - 4 && fri("stavOver")) {
      fix("stavOver", 0.6 * q.kileH + 4 + 0.01)
    }
  }
  kileFix()

  // --- skåla står i plata (hard) --------------------------------------------
  fix("skaal", Math.min(q.skaal, q.plyT - 5 - 0.01))

  // --- sitjehøgda (hard) ----------------------------------------------------
  // Skåla dreg sitjehøgda ned med om lag helvta av djupna si over den
  // flata ein faktisk sit på.
  if (q.hogd - 0.5 * q.skaal < 384) fix("hogd", 384 + 0.5 * q.skaal)

  // --- kuben i høgda (hard) -------------------------------------------------
  // Staven og kilespissen står OVER setet og tel med i kuben. Kila er det
  // billegaste å gje frå seg, so ho ryk fyrst; deretter stavenden, men
  // aldri under det kila treng for ikkje å kløyve; til slutt høgda.
  const takZ = () => {
    for (let it = 0; it < 4; it++) {
      const over = toppHogd(q) - KUBE
      if (over <= 0) break
      if (fri("kileH") && q.kileH > PARAM_RANGES.kileH.min) {
        fix("kileH", q.kileH - over / 0.4)
      } else if (fri("stavOver") && q.stavOver > 10) {
        fix("stavOver", Math.max(10, q.stavOver - over))
      } else {
        fix("hogd", q.hogd - over)
      }
      kileFix()
    }
  }
  takZ()

  // --- kuben i planet (hard) ------------------------------------------------
  // Ei rundkanta mangekant fyller mest to radiusar på tvers. Sidebogen
  // legg seg utanpå det når han er positiv.
  const vidd = () => (1 + Math.max(0, q.sidebog)) * 2
  const kubeXY = () => {
    const rMax = Math.max(q.fotR, q.midjeR, q.seteR)
    if (rMax * vidd() <= KUBE) return
    const s = KUBE / (rMax * vidd())
    fix("fotR", q.fotR * s)
    fix("midjeR", q.midjeR * s)
    fix("seteR", q.seteR * s)
  }
  kubeXY()

  // --- gapet ut av fingerbandet (mjuk, men han gjeld ni gonger på rad) ------
  // Det verkelege gapet er ein funksjon av PLATETALET åleine. Difor vert
  // heiltalet valt, og gapet sett til det talet som gjev nett det talet
  // attende — då er valet eksakt og ikkje ei tilnærming.
  const gapFix = () => {
    if (locked.has("luft")) return
    const st0 = stackTal(q.hogd, q.plyT, q.luft, q.sokkel)
    if (st0.luft < 5 || st0.luft >= 25) return
    let best = -1
    let bestD = Infinity
    for (let n = 4; n <= 28; n++) {
      const g = luftFor(q.hogd, q.plyT, n, q.sokkel)
      if (!(g >= 0) || (g >= 5 && g < 25.4)) continue
      const d = Math.abs(g - q.luft)
      if (d < bestD) {
        bestD = d
        best = n
      }
    }
    if (best > 0) fix("luft", luftFor(q.hogd, q.plyT, best, q.sokkel))
  }
  gapFix()

  /**
   * Set platetalet til det ynskte — men berre til eit tal som gjev eit gap
   * UTANFOR fingerbandet.
   *
   * Grunnen til at det må gjerast slik og ikkje ved å setje lufta og la
   * gapfiksen rydde etterpå: for tynne plater finst det ikkje eit einaste
   * lovleg platetal mellom dei to endane. Med tolv millimeter finér og ei
   * høgd på 450 gjev alt frå tretten til seksogtjue kotar eit gap midt i
   * bandet, so stabelen må VELJE — anten tolv kotar med god luft, eller
   * sjuogtjue som mest ligg inntil kvarandre. Set ein lufta og ryddar
   * etterpå, fell ho attende til den tettaste enden kvar gong, for ho
   * ligg nærast i millimeter — og då står platetalet stille same kor mange
   * gonger ein ber om færre.
   */
  const settPlatetal = (onske: number) => {
    if (locked.has("luft")) return
    let best = -1
    let bestD = Infinity
    for (let n = 4; n <= 28; n++) {
      const g = luftFor(q.hogd, q.plyT, n, q.sokkel)
      if (!(g >= 0) || (g >= 5 && g < 25.4)) continue
      // færre kotar enn bede om er alltid betre enn fleire: det var færre
      // som var ynsket
      const d = n <= onske ? onske - n : (n - onske) * 3
      if (d < bestD) {
        bestD = d
        best = n
      }
    }
    if (best > 0) fix("luft", luftFor(q.hogd, q.plyT, best, q.sokkel))
  }

  // --- flikinga mot overhenget (hard) ---------------------------------------
  // Her sluttar gjettinga og aritmetikken tek over. Overhenget i FLANKEN
  // er ikkje eit mysterium: flanken veks (seteR − midjeR) millimeter over
  // det spennet som ligg over midja, spennet rommar så og så mange plater,
  // og glattsteget legg halvanna gong middelstigninga i det brattaste
  // punktet sitt. Då er største steg utover
  //
  //     1,5 · (seteR − midjeR) · stiging / ((1 − midjeH) · hogd)
  //
  // og kravet er at det ikkje er større enn platetjukna. Snudd om gjev
  // det eit TAK på flikinga, og det same taket gjeld nedover mot foten
  // når foten er smalare enn midja. Å rekne det ut er gratis; å måle seg
  // fram til det same tok ni bygg.
  /**
   * Brattaste stigninga i formkurva smooth(v^kurve), lese av kurva sjølv
   * og ikkje gjeten. For kurve = 1 er ho halvanna; men `setekurve` skyv
   * heile flikinga seinare og gjer henne brattare der ho skjer, og ved 1,6
   * er toppen nærare det doble. Ei gjetta halvanna slepp nett den familien
   * gjennom med eit overheng som fyrst syner seg når geometrien er bygd.
   * Sekstifire prøver er nok til fire siffer, og kostar ingen ting mot eit
   * bygg.
   */
  const brattast = (kurve: number): number => {
    const M = 64
    let mx = 0
    for (let i = 1; i <= M; i++) {
      const d = smooth(Math.pow(i / M, kurve)) - smooth(Math.pow((i - 1) / M, kurve))
      if (d > mx) mx = d
    }
    return Math.max(1, mx * M)
  }

  const flikTak = () => {
    const st = stackTal(q.hogd, q.plyT, q.luft, q.sokkel)
    const stiging = q.plyT + st.luft
    const w = Math.min(0.86, Math.max(0.14, q.midjeH))
    const oppe =
      ((1 - w) * q.hogd * q.plyT) / (brattast(q.setekurve) * Math.max(1, stiging))
    const nede = (w * q.hogd * q.plyT) / (brattast(q.fotkurve) * Math.max(1, stiging))
    if (q.seteR - q.midjeR > oppe) {
      // Setet skal helst halde breidda si — det er der ein sit — so midja
      // vert løfta fyrst, og berre om ho ikkje kan løftast meir vert setet
      // stramma inn.
      if (fri("midjeR") && q.midjeR < q.seteR - oppe) fix("midjeR", q.seteR - oppe)
      if (q.seteR - q.midjeR > oppe) fix("seteR", q.midjeR + oppe)
    }
    if (q.fotR - q.midjeR < -nede) {
      if (fri("midjeR") && q.midjeR > q.fotR + nede) fix("midjeR", q.fotR + nede)
      if (q.fotR - q.midjeR < -nede) fix("fotR", q.midjeR - nede)
    }
  }
  flikTak()
  kubeXY()

  // --- det målte ------------------------------------------------------------
  // Resten er ting berre geometrien veit svaret på: kor mykje av
  // overhenget som kjem frå TAKET OVER HOLET og ikkje frå flanken, og kvar
  // stavane kan stå medan planet vrir seg under dei. Ei måling kostar
  // kring femten millisekund, og berre dei kasta som faktisk ligg utanfor
  // betalar for fleire.

  /**
   * Eitt steg av overhengsreparasjonen, lese av ein ferdig stabel.
   *
   * `utFlanke` er flanken åleine. Ligg han like høgt som heile overhenget,
   * er det FLIKINGA over midja som heng; ligg han lågare, er skilnaden
   * taket over opninga. Dei to har kvar sine spakar, og å dra i feil spak
   * gjer objektet mindre utan å røre feilen — difor vert kjelda avgjord
   * fyrst og begge prøvde, kvar for seg, i same runden.
   *
   * Returnerer om noko vart rørt: står alle spakane i botn, er det inga
   * von i å måle om att.
   */
  const hengSteg = (b: ReturnType<typeof buildStack>): boolean => {
    const tak = q.plyT - 0.15
    if (b.steg.ut <= tak) return false
    const fraHol = b.steg.ut - b.steg.utFlanke > 0.4
    const fraFlanke = b.steg.utFlanke > tak
    let rort = false

    if (fraHol) {
      const stiging = q.plyT + b.luft
      if (fri("holhogd") && q.holhogd < PARAM_RANGES.holhogd.max && q.holhogd < 3.4 * stiging) {
        // Ei kort opning må lukke seg på ei einaste plate. Å strekkje
        // henne over fleire plater kostar ingen ting av forma og tek heile
        // kragen bort — difor fyrst.
        fix("holhogd", Math.min(PARAM_RANGES.holhogd.max, q.holhogd + 40))
        rort = true
      } else if (fri("vri") && Math.abs(q.vri) > 8) {
        // Vridinga sveipar bitkanten sidevegs frå kote til kote, og ein
        // kant som flyttar seg legg like mykje gods utanpå naboen som ein
        // bit som lukkar seg.
        fix("vri", q.vri * 0.65)
        rort = true
      } else if (fri("holdjup") && q.holdjup > 0) {
        fix("holdjup", q.holdjup > 0.12 ? q.holdjup * 0.65 : 0)
        rort = true
      } else if (fri("holbreidd") && q.holbreidd > 12) {
        fix("holbreidd", q.holbreidd * 0.85)
        rort = true
      }
    }
    if (fraFlanke) {
      const skala = Math.max(0.5, (tak / b.steg.utFlanke) * 0.95)
      // Kor mykje av flankesteget kan FLIKINGA åleine forklare? Det er
      // rein aritmetikk, den same som `flikTak` reknar baklengs. Ligg det
      // målte godt over, er skilnaden noko anna: planet som DREIER SEG
      // under seg sjølv. Ein lobetopp på kote i+1 som har vridd seg inn
      // over ei hòl side på kote i heng like reelt som ei flik gjer, og
      // å stramme flikinga rører ikkje den feilen med ein millimeter.
      const stiging2 = q.plyT + b.luft
      const w2 = Math.min(0.86, Math.max(0.14, q.midjeH))
      const flikSteg = Math.max(
        ((q.seteR - q.midjeR) * brattast(q.setekurve) * stiging2) / Math.max(1, (1 - w2) * q.hogd),
        ((q.midjeR - q.fotR) * brattast(q.fotkurve) * stiging2) / Math.max(1, w2 * q.hogd),
        0,
      )
      const fraVrid = b.steg.utFlanke > 1.3 * flikSteg + 1
      if (fraVrid && fri("vri") && Math.abs(q.vri) > 6) {
        fix("vri", q.vri * 0.7)
        rort = true
      } else if (fraVrid && fri("rundhet") && q.rundhet < 0.9) {
        // Ei rundare kotelinje har grunnare lober, og ein grunn lobe kan
        // vri seg mykje lenger før toppen hans står utanfor naboen.
        fix("rundhet", Math.min(0.9, q.rundhet + 0.1))
        rort = true
      } else if (fri("seteR") && q.seteR - q.midjeR > 4) {
        fix("seteR", q.midjeR + (q.seteR - q.midjeR) * skala)
        rort = true
      } else if (fri("midjeR") && q.fotR - q.midjeR < -4) {
        fix("midjeR", q.fotR + (q.midjeR - q.fotR) * skala)
        rort = true
      } else if (fri("plyT") && q.plyT < PARAM_RANGES.plyT.max) {
        fix("plyT", Math.min(PARAM_RANGES.plyT.max, q.plyT + 2))
        fix("skaal", Math.min(q.skaal, q.plyT - 5 - 0.01))
        gapFix()
        rort = true
      }
    }
    return rort
  }

  const hengFiks = (rundar: number) => {
    for (let i = 0; i < rundar; i++) {
      let b: ReturnType<typeof buildStack>
      try {
        b = buildStack(q, 26)
      } catch {
        return
      }
      if (!hengSteg(b)) return
    }
  }

  for (let pass = 0; pass < 10; pass++) {
    let b: ReturnType<typeof buildStack>
    try {
      b = buildStack(q, 26)
    } catch {
      break
    }
    const stav = b.klaring < hylseAv(q.stavD) / 2 + 3.2
    let rort = hengSteg(b)

    if (stav) {
      // Vridinga sveipar bita forbi stavane; ho er den billegaste å gje
      // frå seg. So biten, so staven sjølv.
      if (fri("vri") && Math.abs(q.vri) > 4) {
        fix("vri", q.vri * 0.6)
        rort = true
      } else if (fri("holdjup") && q.holdjup > 0.12) {
        fix("holdjup", q.holdjup * 0.7)
        rort = true
      } else if (fri("holbreidd") && q.holbreidd > 12) {
        fix("holbreidd", q.holbreidd * 0.8)
        rort = true
      } else if (fri("stavInn") && q.stavInn < PARAM_RANGES.stavInn.max) {
        fix("stavInn", q.stavInn + 8)
        rort = true
      } else if (fri("stavD") && q.stavD > PARAM_RANGES.stavD.min) {
        fix("stavD", q.stavD - 2)
        kileFix()
        rort = true
      } else if (fri("stavar") && q.stavar > PARAM_RANGES.stavar.min) {
        fix("stavar", q.stavar - 1)
        rort = true
      }
    }
    if (!rort) break
  }

  // --- skåla mot stavringen (mjuk, men eksakt) ------------------------------
  // Skålradien er BEDT om som ein del av setet sin innskrivne radius, og
  // taket er stavringen minus hylsa og seks millimeter. Begge er kjende
  // etter eit bygg, so dette er ei tildeling og ikkje eit søk: skåla vert
  // sett til det ho får lov å vera. Held ikkje det, står stavane for
  // trongt, og då er innsteget deira det som skal seiast opp.
  const skaalFiks = () => {
    for (let pass = 0; pass < 4; pass++) {
      let b: ReturnType<typeof buildStack>
      try {
        b = buildStack(q, 26)
      } catch {
        return
      }
      if (q.skaal <= 0 || b.skaal.djup <= 0.2 || !b.skaal.kutta) return
      const seatIn = b.skaal.bedt / Math.max(1e-6, q.skaalR)
      const tak = b.rho - b.hylseD / 2 - 6
      const vil = (tak - 1.5) / Math.max(1, seatIn)
      if (vil >= PARAM_RANGES.skaalR.min && fri("skaalR")) {
        fix("skaalR", Math.min(q.skaalR, vil))
        return
      }
      if (fri("stavInn") && q.stavInn > PARAM_RANGES.stavInn.min) {
        fix("stavInn", Math.max(PARAM_RANGES.stavInn.min, q.stavInn - 10))
        continue
      }
      if (fri("skaal")) fix("skaal", 0)
      return
    }
  }
  skaalFiks()

  // --- siste runde på måltala -----------------------------------------------
  // Massen, veltinga, styrken og sitjeflata er integral over den ferdige
  // geometrien. Spakane som verkar er godset (tjukna), platetalet, foten
  // (vippearma), stavtverrsnittet (trykket) og seteradien — og kvar av dei
  // gjer objektet mindre ekstremt, aldri meir.
  for (let pass = 0; pass < 8; pass++) {
    let m: ReturnType<typeof measure>
    try {
      m = measure(q)
    } catch {
      break
    }
    const tung = m.mass > 14.6
    const vippen = m.tipAngle < 12.6
    const sterk = m.util > 0.94
    const smaltSete = Math.min(m.seatW, m.seatD) < 326
    const smalFot = m.footArea < 57000
    if (!tung && !vippen && !sterk && !smaltSete && !smalFot) break
    let rort = false

    if (tung) {
      const st = stackTal(q.hogd, q.plyT, q.luft, q.sokkel)
      if (fri("plyT") && q.plyT > PARAM_RANGES.plyT.min) {
        fix("plyT", Math.max(PARAM_RANGES.plyT.min, q.plyT * Math.max(0.72, 14.6 / m.mass)))
        fix("skaal", Math.min(q.skaal, q.plyT - 5 - 0.01))
        gapFix()
        flikTak()
        rort = true
      } else if (fri("sokkel") && q.sokkel > 0) {
        // Sokkelen er lukka gap: rein masse og inga luft. Han er det
        // fyrste ein gjev frå seg når krakken vert for tung å bera.
        fix("sokkel", q.sokkel - 1)
        rort = true
      } else if (fri("luft") && st.n > 6) {
        // Godset er så tynt det får lov å bli. Då er massen platetalet
        // gonger arealet, og platetalet er lufta si sak: fleire millimeter
        // luft er færre kotar i same høgda. Å ta plater bort er billegare
        // enn å ta storleik bort, for storleiken er setet.
        const n2 = Math.max(6, Math.round(st.n * Math.max(0.55, 14.6 / m.mass)))
        const for0 = stackTal(q.hogd, q.plyT, q.luft, q.sokkel).n
        settPlatetal(n2)
        flikTak()
        rort = stackTal(q.hogd, q.plyT, q.luft, q.sokkel).n < for0
      } else if (Math.min(m.seatW, m.seatD) > 360) {
        // Til slutt arealet — men berre når setet har slark å gje. Massen
        // går med kvadratet av radien, so ei rot er det rette steget, og
        // alle tre radiusane må fylgjast åt: elles er det flikinga og
        // ikkje storleiken som vert endra. Er setet alt på grensa, ville
        // dette steget berre trekkje det same trekket sitjeflata dreg
        // andre vegen, og dei to ville stå og skubbe på kvarandre til
        // rundane var brukte opp.
        const sk = Math.max(0.88, Math.sqrt(14.6 / m.mass))
        fix("fotR", q.fotR * sk)
        fix("midjeR", q.midjeR * sk)
        fix("seteR", q.seteR * sk)
        rort = true
      }
    }
    if (smaltSete) {
      // Setet er for smalt på den korte leia. Å blåse opp SETET åleine
      // ville auke flikinga over midja og slå rett i overhenget; difor
      // vert seteradien og midjeradien skalerte SAMAN. Skilnaden mellom
      // dei — og dermed heile flikinga — står då urørt, og krakken vert
      // berre eit nummer større.
      const sk = Math.min(1.25, 326 / Math.max(1, Math.min(m.seatW, m.seatD)))
      const rom = q.seteR < PARAM_RANGES.seteR.max - 0.5
      if (sk > 1.001 && rom && (fri("seteR") || fri("midjeR"))) {
        fix("seteR", q.seteR * sk)
        fix("midjeR", q.midjeR * sk)
        rort = true
      } else if (fri("rundhet") && q.rundhet < 0.9) {
        // Rundleiken er den gratis spaken: ei rundare kotelinje fyller
        // boksen sin betre utan å veksa utover i det heile.
        fix("rundhet", Math.min(0.9, q.rundhet + 0.12))
        rort = true
      }
      kubeXY()
      flikTak()
    }
    if (vippen || smalFot) {
      // Vippearma og støtteflata er den same foten lesen to vegar: den
      // eine måler den verste retninga, den andre måler alle. Begge svarar
      // på at foten vert breiare.
      if (fri("fotR") && q.fotR < PARAM_RANGES.fotR.max) {
        fix("fotR", Math.min(PARAM_RANGES.fotR.max, q.fotR + 14))
        flikTak()
        kubeXY()
        rort = true
      } else if (fri("hogd") && q.hogd > 386) {
        fix("hogd", q.hogd - 12)
        rort = true
      }
    }
    if (sterk) {
      if (fri("stavD") && q.stavD < PARAM_RANGES.stavD.max) {
        fix("stavD", Math.min(PARAM_RANGES.stavD.max, q.stavD + 2))
        kileFix()
        rort = true
      } else if (fri("stavar") && q.stavar < PARAM_RANGES.stavar.max) {
        fix("stavar", q.stavar + 1)
        rort = true
      } else if (fri("plyT") && q.plyT < PARAM_RANGES.plyT.max) {
        fix("plyT", Math.min(PARAM_RANGES.plyT.max, q.plyT + 2))
        gapFix()
        rort = true
      }
    }
    if (!rort) break
  }

  // --- siste stadfesting ----------------------------------------------------
  // Massetrimmen kan ha endra platetjukna og setetrimmen radiusane, og
  // begge dei to les kuben, kila og overhenget om att. Overhenget er det
  // einaste HARDE av dei som ikkje er rein aritmetikk, so det er det som
  // får siste ordet — med nok rundar til at han rekk gjennom heile rekkja
  // av spakar sjølv om dei fyrste ikkje bit.
  fix("skaal", Math.min(q.skaal, q.plyT - 5 - 0.01))
  if (q.hogd - 0.5 * q.skaal < 384) fix("hogd", 384 + 0.5 * q.skaal)
  kileFix()
  takZ()
  kubeXY()
  gapFix()
  hengFiks(12)
  skaalFiks()
  return q
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(
    rnd,
    prev as unknown as ParamBag,
    POSES as unknown as readonly Partial<Record<string, number | string>>[],
    DEFAULT_PARAMS as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    locked,
    0.04,
  ) as unknown as Params | null
  const q =
    posed ?? (randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked) as Params)
  if (!locked.has("material") && !(q.material in MATERIALS)) q.material = "bjork"
  return fiksTerning(q, locked)
}

/** høgda staven når, lese utanfrå — reglane og måltala treng same tal */
export { toppHogd }
