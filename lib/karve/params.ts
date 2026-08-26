/**
 * KARVE — parameterrommet.
 *
 * Typologien er den motsette av dei andre i sandkassen. Der dei set saman
 * ferdige delar, tek denne materiale VEKK: flate plater vert limte til ein
 * blokk, og møbelet er det som står att når fresen har gått over blokken
 * frå oppsida og — etter at emnet er snudd — frå undersida. Difor er
 * utsida samanhengande og ikkje trappa: trinna er skorne bort, og av laga
 * står berre limfugene att som kotelinjer på ei glatt flate.
 *
 * Tre band styrer forma, og dei er uavhengige:
 *   rSete(θ)  setet sin rosett i planet — lobane
 *   rFot(θ)   beinstjerna på golvet
 *   rMidje(θ) halsen mellom dei
 * Alt anna er høgdefelt: setet sin sal på oppsida, kvelvinga på undersida.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. θ = 0 er +X.
 * Alle mål i millimeter, vinklar i grader.
 */
import {
  MATERIALS,
  capacities,
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type Hovuddrag,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"
import { DETAIL, formOf, karv, snitt } from "./form"

export type Params = {
  // --- SETE ---------------------------------------------------------------
  hogd: number // høgste punkt på setet over golvet, mm
  seteB: number // setet sin akse på tvers (Y), mm — diameter
  seteD: number // setet sin akse fram/attende (X), mm — diameter
  lobar: number // kor mange lobar setet har
  lobeDjup: number // kor djupt kjervet mellom lobane skjer inn, 0–1
  lobeform: number // lobeform: låg er breie kløverblad, høg er smale kronblad
  kantR: number // setekanten sin avrunding, mm

  // --- SAL ----------------------------------------------------------------
  sal: number // kor mykje setehalvdelane krøller seg opp ytst, mm
  kryss: number // kjølen midt i setet, djupn, mm
  kryssB: number // kjølen si breidd, mm
  lobekroll: number // kor mykje lobetuppane ligg over resten av setet, mm
  framfall: number // framkanten fell, mm
  bakfall: number // bakkanten fell, mm — mindre enn framfall gjev høge bak-lobar

  // --- MIDJE --------------------------------------------------------------
  midjeH: number // midjehøgda som del av total høgd
  midjeR: number // minste halsradius, mm
  midjeInn: number // kor mange mm midja er dregen INNANFOR det fresen når, mm
  halsN: number // kor lenge halsen held seg slank før setet blømer ut

  // --- BEIN ---------------------------------------------------------------
  bein: number // kor mange bein
  vri: number // beinstjerna vridd mot seterosetten, grader
  fot: number // beinet sin radius på golvet, mm
  innsnitt: number // kor smal blokken er mellom beina på golvet, 0–1
  beinN: number // kor beinet sveipar ut på veg ned
  beinbreidd: number // beinbreidd i vinkel: høg er smale bein

  // --- KVELV --------------------------------------------------------------
  kvelv: number // krona i kvelvinga under møbelet, mm over golvet
  bogeform: number // bogeform: låg er rund, høg er spiss
  spring: number // kor langt inne kvelvinga tek av, del av halsradien
  pute: number // fotputa si lengd langs radien, mm
  foteR: number // avrunding der beinet møter golvet, mm

  // --- BLOKK --------------------------------------------------------------
  plyT: number // platetjukn i limte blokken, mm — set koteavstanden
  sagmon: number // sagmon på grovkutta plater, mm
  emneform: number // 0 er plater kutta til kontur, 1 er ein rein kasse
  fresR: number // freseradius (kulefres), mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 340, max: 470, step: 1, label: "høgd", unit: "mm" },
  seteB: { min: 300, max: 500, step: 1, label: "seteakse tvers", unit: "mm" },
  seteD: { min: 300, max: 500, step: 1, label: "seteakse fram", unit: "mm" },
  lobar: { min: 2, max: 6, step: 1, label: "lobar", int: true },
  lobeDjup: { min: 0.05, max: 0.55, step: 0.005, label: "lobedjup" },
  lobeform: { min: 0.6, max: 2.6, step: 0.05, label: "lobeform" },
  kantR: { min: 3, max: 34, step: 0.5, label: "setekant", unit: "mm" },

  sal: { min: 0, max: 78, step: 0.5, label: "sal", unit: "mm" },
  kryss: { min: 0, max: 46, step: 0.5, label: "kjøl", unit: "mm" },
  kryssB: { min: 40, max: 240, step: 1, label: "kjølbreidd", unit: "mm" },
  lobekroll: { min: 0, max: 40, step: 0.5, label: "lobekrøll", unit: "mm" },
  framfall: { min: 0, max: 64, step: 0.5, label: "framfall", unit: "mm" },
  bakfall: { min: 0, max: 64, step: 0.5, label: "bakfall", unit: "mm" },

  midjeH: { min: 0.34, max: 0.78, step: 0.005, label: "midjehøgd" },
  midjeR: { min: 34, max: 150, step: 1, label: "halsradius", unit: "mm" },
  midjeInn: { min: 0, max: 40, step: 0.5, label: "midjeinnhogg", unit: "mm" },
  halsN: { min: 0.9, max: 4.2, step: 0.05, label: "halsform" },

  bein: { min: 2, max: 6, step: 1, label: "bein", int: true },
  vri: { min: -90, max: 90, step: 1, label: "beinvri", unit: "°" },
  fot: { min: 120, max: 249, step: 1, label: "fotradius", unit: "mm" },
  innsnitt: { min: 0.12, max: 0.9, step: 0.005, label: "innsnitt" },
  beinN: { min: 0.85, max: 3.2, step: 0.05, label: "beinsveip" },
  beinbreidd: { min: 0.5, max: 3, step: 0.05, label: "beinbreidd" },

  kvelv: { min: 60, max: 320, step: 1, label: "kvelvkrone", unit: "mm" },
  bogeform: { min: 0.7, max: 3.2, step: 0.05, label: "bogeform" },
  spring: { min: 0.15, max: 1.1, step: 0.01, label: "kvelvspring" },
  pute: { min: 22, max: 110, step: 1, label: "fotpute", unit: "mm" },
  foteR: { min: 3, max: 40, step: 0.5, label: "fotavrunding", unit: "mm" },

  plyT: { min: 6, max: 30, step: 0.5, label: "platetjukn", unit: "mm" },
  sagmon: { min: 0, max: 30, step: 0.5, label: "sagmon", unit: "mm" },
  emneform: { min: 0, max: 1, step: 0.01, label: "emneform" },
  fresR: { min: 3, max: 18, step: 0.5, label: "freseradius", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  {
    id: "sete",
    label: "sete",
    keys: ["hogd", "seteB", "seteD", "lobar", "lobeDjup", "lobeform", "kantR"],
  },
  {
    id: "sal",
    label: "sal",
    keys: ["sal", "kryss", "kryssB", "lobekroll", "framfall", "bakfall"],
  },
  { id: "midje", label: "midje", keys: ["midjeH", "midjeR", "midjeInn", "halsN"] },
  {
    id: "bein",
    label: "bein",
    keys: ["bein", "vri", "fot", "innsnitt", "beinN", "beinbreidd"],
  },
  {
    id: "kvelv",
    label: "kvelv",
    keys: ["kvelv", "bogeform", "spring", "pute", "foteR"],
  },
  { id: "blokk", label: "blokk", keys: ["plyT", "sagmon", "emneform", "fresR"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden er referansen: fire lobar i kløverform, ein kjøl som går fram
 * og attende midt i setet so dei to halvdelane krøller seg opp i ein ekte
 * sal, ein hals under, og fire sveipa bein ut på små putar.
 *
 * BEINVRIEN PÅ 45 GRADER ER IKKJE PYNT — han er halsen.
 * Halsen kan aldri leggjast smalare enn min(rSete, rFot) utan å lage eit
 * rom fresen ikkje når. Står beinet rett under lobetuppen, er BEGGE store
 * i same vinkel, og då er halsen der like brei som setet: møbelet vert ei
 * tønne utan midje. Vridd ein halv lobe kjem beinet ned i KJERVET, der
 * setet er trekt inn, og halsen får fylgje det trange av dei to heile
 * vegen rundt. Midja er difor ikkje noko ein hoggar inn — ho er det som
 * står att når seterosetten og beinstjerna peikar kvar sin veg.
 *
 * Skyv `midjeInn` oppover, og forma snører seg forbi det fresen kan nå.
 * Det er nett den vegen regelen «fresen når inn» går raud.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 420,
  seteB: 492,
  seteD: 462,
  lobar: 4,
  lobeDjup: 0.45,
  lobeform: 1.35,
  kantR: 15,

  sal: 42,
  kryss: 22,
  kryssB: 116,
  lobekroll: 16,
  framfall: 25,
  bakfall: 9,

  midjeH: 0.66,
  midjeR: 62,
  midjeInn: 3,
  halsN: 1.15,

  bein: 4,
  vri: 45,
  fot: 242,
  innsnitt: 0.24,
  beinN: 1.15,
  beinbreidd: 1.7,

  kvelv: 200,
  bogeform: 1.5,
  spring: 0.45,
  pute: 56,
  foteR: 20,

  plyT: 15,
  sagmon: 9,
  emneform: 0.18,
  fresR: 8,
  material: "bjork",
}

/**
 * Kuraterte posar. Kvar av dei er eit anna medlem av same familie, og alle
 * held kvar einaste regel.
 */
export const POSES: readonly Partial<Params>[] = [
  // kløveren — referansen sjølv, med djupare kjøl og tyngre sal
  {
    lobar: 4, bein: 4, vri: 45, lobeDjup: 0.48, lobeform: 1.3, kryss: 30,
    kryssB: 104, sal: 50, lobekroll: 20, midjeR: 58, midjeInn: 3, fot: 244,
    innsnitt: 0.22, halsN: 1.1, beinN: 1.1, kvelv: 206, plyT: 13, hogd: 422,
  },
  // sommarfuglen — to lobar, ein brei sal og ein kjøl som deler setet i to
  // halvdelar. Beinstjerna står i kryss under kjerva, so føtene kjem ned
  // mellom vengene.
  {
    lobar: 2, bein: 4, vri: 0, lobeDjup: 0.24, lobeform: 1.05, sal: 58,
    kryss: 34, kryssB: 150, lobekroll: 6, seteB: 490, seteD: 474,
    midjeR: 74, midjeInn: 2, fot: 236, innsnitt: 0.24, halsN: 1.2,
    beinN: 1.2, beinbreidd: 1.6, kvelv: 232, hogd: 442, plyT: 14,
    spring: 0.4, midjeH: 0.7,
  },
  // trefoten — tre lobar og tre bein, vridde ein sekstedel mot kvarandre
  {
    lobar: 3, bein: 3, vri: 60, lobeDjup: 0.42, lobeform: 1.4, seteB: 478,
    seteD: 478, fot: 249, beinbreidd: 1.0, innsnitt: 0.3, kvelv: 202,
    midjeR: 74, midjeInn: 3, sal: 38, kryss: 16, halsN: 1.2, beinN: 1.15,
    hogd: 420, plyT: 17, pute: 86,
  },
  // steinen — grunn sal, låg kvelv, tjukke plater: eit tungt, stille volum
  // der kotene ligg som brede band
  {
    lobar: 4, bein: 4, vri: 45, lobeDjup: 0.3, lobeform: 1.8, sal: 22,
    kryss: 10, kryssB: 150, lobekroll: 5, kvelv: 160, midjeR: 104,
    midjeInn: 2, fot: 242, innsnitt: 0.42, beinN: 1.5, halsN: 1.6,
    beinbreidd: 1.3, plyT: 26, sagmon: 10, emneform: 0.24, hogd: 406,
    pute: 70, spring: 0.72, seteB: 452, seteD: 436,
  },
  // trakta — fem lobar og fem bein, høg midje og slank hals, høg kvelv
  {
    lobar: 5, bein: 5, vri: 36, lobeDjup: 0.44, lobeform: 1.5, midjeH: 0.72,
    midjeR: 50, midjeInn: 2, halsN: 1.05, beinN: 1.05, kvelv: 236,
    bogeform: 2.1, beinbreidd: 1.9, fot: 238, innsnitt: 0.2, hogd: 428,
    plyT: 11.5, sal: 46, kryss: 18, spring: 0.4, pute: 52,
  },
  // kassa — emnet er ein rein blokk og ikkje grovkutta plater. Same
  // objektet, dobbelt so mykje spon, og talet står svart på kvitt.
  {
    lobar: 4, bein: 4, vri: 45, emneform: 0.62, sagmon: 2, plyT: 21,
    lobeDjup: 0.4, lobeform: 1.4, sal: 34, kryss: 18, kvelv: 214,
    midjeR: 84, midjeInn: 2, fot: 236, innsnitt: 0.34, halsN: 1.25,
    beinN: 1.2, hogd: 414, spring: 0.55, pute: 60,
  },
]

/** Posane med namna sine — same liste, synlege som inngangar i panelet.
 *  Namnet står her og ikkje inne i kvar pose, so poseBag (terningen) les
 *  lista uendra. Rekkjefylgja er lista over. */
const POSE_NAMN: readonly string[] = [
  "kløveren", "sommarfuglen", "trefoten", "steinen", "trakta", "kassa",
]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag,
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. Kvart drag styrer
 *  eitt eller fleire eksisterande band saman — ingen nye parametrar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "sete", label: "sete", keys: [["seteB", 1], ["seteD", 1]] },
  { id: "sal", label: "sal", keys: [["sal", 1], ["kryss", 0.5]] },
  { id: "lobar", label: "lobar", keys: [["lobar", 1]] },
  { id: "bein", label: "bein", keys: [["bein", 1]] },
  { id: "kvelv", label: "kvelv", keys: [["kvelv", 1]] },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "plyT", pinch: "seteB" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

/**
 * REPARASJONSKASKADEN.
 *
 * Terningen får kaste kva han vil, men fire tal er SUMAR og eitt er eit
 * integral over geometrien: konvolutten, sitjehøgda, veltearma, svinnet og
 * — verst av alt — det innestengde volumet fresen ikkje når. Dei tre
 * fyrste let seg rekne av tala; dei to siste må MÅLAST, av di dei
 * kjem an på kvar rSete og rFot kryssar kvarandre, og det kryssnittet er
 * eit resultat og ikkje ein skyvar.
 *
 * Rekkjefylgja er: daudsoner, konvolutt, høgd, so den målte innestenginga.
 * Kvart steg rører berre ulåste skyvarar, alltid innanfor banda.
 */
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
    0.045,
  ) as unknown as Params | null
  const q =
    posed ??
    (randomBag(
      rnd,
      prev as unknown as ParamBag,
      PARAM_RANGES,
      PARAM_KEYS,
      locked,
    ) as unknown as Params)

  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k]
    ;(q as Record<string, number | string>)[k] = Math.min(
      r.max,
      Math.max(r.min, +v.toFixed(3)),
    )
  }

  // --- 1 daudsoner ----------------------------------------------------------
  // Halsen må vera slankare enn foten, elles finst det inga midje i det
  // heile og møbelet er ein kjegle. Og kjølen må vera anten ein kjøl eller
  // ingen ting: fem millimeter i ei hundre millimeter brei renne er noko
  // ingen ser og fresen likevel må køyre.
  if (q.midjeR > q.fot * 0.62) fix("midjeR", q.fot * 0.62)
  if (q.kryss > 0 && q.kryss < 6) fix("kryss", q.kryss < 3 ? 0 : 6)
  if (q.lobeDjup < 0.1 && q.lobar > 2) fix("lobeDjup", 0.1)

  // --- 2 vrien: beinet skal ned i kjervet -----------------------------------
  // Med like mange bein som lobar er det nøyaktig éin vri som set beinet i
  // kjervet: ein halv lobebreidd. Terningen får halde vrien sin når han
  // alt ligg nær, elles vert han snappa dit — det er den einaste stillinga
  // der eit sete som heng ut over eit bein ikkje lagar eit rom fresen
  // korkje når ovanfrå eller nedanfrå.
  {
    const k = Math.round(q.lobar)
    const kb = Math.round(q.bein)
    if (k === kb) {
      const halv = 180 / k
      const n = Math.round(q.vri / halv)
      const mål = (n % 2 === 0 ? n + 1 : n) * halv
      fix("vri", Math.abs(mål) <= 90 ? mål : mål - Math.sign(mål) * 2 * halv)
    }
  }

  // --- 3 konvolutten --------------------------------------------------------
  // Foten er den ytste radien i planet, og med eit bein som peikar rett
  // fram er han halve djupna. Setet er mindre enn rosetten sin radius, av
  // di kjerva dreg inn — men eit sete med to lobar kan peike rett ut, og
  // då er halve aksen det som gjeld.
  const env = () => {
    const a = Math.max(q.seteB, q.seteD) / 2
    return Math.max(q.fot, a * (Math.round(q.lobar) <= 2 ? 1 : 0.88)) * 2
  }
  if (env() > 496) {
    if (q.fot * 2 > 496) fix("fot", 248)
    if (env() > 496) {
      const s = 496 / env()
      fix("seteB", q.seteB * s)
      fix("seteD", q.seteD * s)
    }
  }

  // --- 4 sitjehøgda, grovt ---------------------------------------------------
  // Setetoppen er `hogd`; der ein faktisk sit ligg lågare, av di salen,
  // krøllen og fallet alle dreg ned. Overslaget her er grovt med vilje —
  // den nøyaktige verdien vert MÅLT under — men det sparer den målte
  // lykkja for dei kasta som ligg heilt utanfor.
  const sokk = () => 0.62 * q.sal + 0.5 * q.lobekroll + 0.16 * (q.framfall + q.bakfall)
  if (q.hogd - sokk() < 386) fix("hogd", 386 + sokk())
  if (q.hogd - sokk() > 470) fix("hogd", 470 + sokk())

  // --- 5 kvelvinga må stå under setet ---------------------------------------
  // Krona er taket i rommet under møbelet. Kjem ho opp i setet, er det
  // ikkje lenger eitt stykke, og fresen har skore halsen av innanfrå.
  if (q.kvelv > q.midjeH * q.hogd + 34) fix("kvelv", q.midjeH * q.hogd + 34)
  if (q.pute > q.fot * 0.55) fix("pute", q.fot * 0.55)

  // --- 6 DET MÅLTE ----------------------------------------------------------
  // Her sluttar rekninga og målinga tek over. Sju av tala reglane spør om
  // er integral over ei geometri som ikkje finst før ho er skanna:
  // sitjehøgda er eit arealvekta middel av setet, støtteflata er hylsteret
  // mellom putene, sitjeflata er omrisset av setekroppen, massen er
  // godsvolumet — og det innestengde er kvar rSete og rFot kryssar
  // kvarandre. Ingen av dei er noko terningen kastar; alle er noko som
  // skjer. Skanninga på lågt nivå kostar nokre få millisekund, og berre
  // dei kasta som faktisk ligg utanfor betalar for fleire omgangar.
  for (let pass = 0; pass < 14; pass++) {
    let k: ReturnType<typeof formOf>
    try {
      k = formOf(q)
    } catch {
      break
    }
    const cap = capacities(q.material as never)
    const rho = MATERIALS[q.material as keyof typeof MATERIALS].rho
    const masse = (k.vol * rho) / 1e9
    const sete = Math.min(k.seteW, k.seteD)
    // Det innestengde bur i tynne radiale band langs dei to loddrette
    // veggene, og det grove nettet ser dei berre halvt. Difor vert talet
    // lese om att på det NETTET REGELEN LES så snart det grove seier at
    // vi er i nærleiken — og berre då, av di det kostar tre gonger så
    // mykje som resten av omgangen.
    const stengd =
      k.stengdDel > 0.004 ? karv(q, DETAIL.mid).stengdDel : k.stengdDel
    const sn = snitt(k)
    const bein = sn.beinA
    const util = sn.sigC / cap.capC + sn.sigM / cap.capM
    let rort = false

    // (a) kuben. Konvolutten er målt på det freste omrisset og ikkje
    // gissa av foten: eit sete med to lobar kan stikke lenger ut enn
    // beina, og kva av dei to som styrer skiftar med lobetalet.
    const stor = Math.max(k.envX, k.envY)
    if (stor > 496) {
      const s = 496 / stor
      if (q.fot > 130) fix("fot", Math.max(130, q.fot * s))
      fix("seteB", q.seteB * s)
      fix("seteD", q.seteD * s)
      rort = true
    }

    // (b) sitjehøgda — hard. Salen er det billegaste å gje frå seg når
    // høgda alt står i taket sitt.
    if (k.sitZ < 384) {
      const treng = 384 - k.sitZ
      if (q.hogd + treng <= PARAM_RANGES.hogd.max && !locked.has("hogd")) {
        fix("hogd", q.hogd + treng)
      } else if (q.sal > 4) {
        fix("sal", Math.max(0, q.sal - treng / 0.62))
      } else if (q.lobekroll > 2) {
        fix("lobekroll", Math.max(0, q.lobekroll - treng / 0.5))
      } else {
        fix("framfall", Math.max(0, q.framfall - treng))
      }
      rort = true
    } else if (k.sitZ > 474) {
      fix("hogd", q.hogd - (k.sitZ - 474))
      rort = true
    }

    // (c) innestengt gods — hard. Grepa er dei tre målinga viser er
    // einsretta: mindre innhogg i midja, djupare kjerv so setet trekkjer
    // seg unna beinet, og smalare bein.
    if (stengd > 0.015) {
      if (!locked.has("midjeInn") && q.midjeInn > 0.2) {
        fix("midjeInn", q.midjeInn * 0.45)
      } else if (!locked.has("lobeDjup") && q.lobeDjup < PARAM_RANGES.lobeDjup.max) {
        fix("lobeDjup", Math.min(PARAM_RANGES.lobeDjup.max, q.lobeDjup + 0.07))
      } else if (!locked.has("beinbreidd") && q.beinbreidd < PARAM_RANGES.beinbreidd.max) {
        fix("beinbreidd", Math.min(PARAM_RANGES.beinbreidd.max, q.beinbreidd + 0.4))
      } else if (!locked.has("midjeR") && q.midjeR < q.fot * 0.6) {
        fix("midjeR", Math.min(q.fot * 0.6, q.midjeR + 14))
      } else if (sete > 340) {
        // eit mindre sete heng kortare ut over beinet, og då er det
        // mindre rom att som ingen av dei to passa når
        fix("seteB", q.seteB - 16)
        fix("seteD", q.seteD - 16)
      }
      rort = true
    }

    // (d) velting og støtteflate. Foten er den einaste spaken som flyttar
    // vippearma utan å røre sitjehøgda; putelengda breier ut kontakten
    // utan å gjera møbelet vidare; fleire bein er siste utveg, av di eit
    // bein til er ei ny opning i kvelvinga.
    if (k.kontaktar < 3 && Math.round(q.bein) < 3 && !locked.has("bein")) {
      // to putar er ei linje, og eit møbel som står på ei linje vippar om
      // henne. Kvelvinga skil beina; er det berre to av dei, er det ikkje
      // kvelvinga som er feil, det er beintalet.
      fix("bein", 3)
      rort = true
    }
    if (k.vippArm < 98 || k.fotAreal < 97000) {
      if (!locked.has("fot") && q.fot < 248 && stor < 486) {
        fix("fot", Math.min(248, q.fot + 16))
      } else if (!locked.has("pute") && q.pute < q.fot * 0.55) {
        fix("pute", Math.min(q.fot * 0.55, q.pute + 12))
      } else if (!locked.has("bein") && Math.round(q.bein) < 5) {
        fix("bein", Math.round(q.bein) + 1)
      } else if (!locked.has("beinbreidd") && q.beinbreidd > 0.7) {
        fix("beinbreidd", q.beinbreidd - 0.3)
      }
      rort = true
    }

    // (e) sitjeflata. Kjervet mellom lobane er det som et henne: eit djupt
    // kjerv gjer eit vidt sete smalt der ein sit.
    if (sete < 328) {
      if (!locked.has("lobeDjup") && q.lobeDjup > 0.12 && stengd < 0.008) {
        fix("lobeDjup", q.lobeDjup - 0.05)
      } else if (!locked.has("lobeform") && q.lobeform > 0.8) {
        // breiare lobar fyller kjervet utan å gjere rosetten større
        fix("lobeform", q.lobeform - 0.3)
      } else if (k.seteD <= k.seteW && k.envX < 486) {
        // berre den KORTE leia veks, og berre om ho har rom i kuben: eit
        // sete med to lobar er smalt fram og attende og vidt på tvers, og
        // å auke båe aksane ville skuve det ut av kuben på den leia som
        // alt er full
        fix("seteD", q.seteD + 22)
      } else if (k.envY < 486) {
        fix("seteB", q.seteB + 22)
      }
      rort = true
    }

    // (e2) kjølen. Ein kulefres kan ikkje lage ei renne skarpare enn
    // radien sin. Ein mindre fres er det ærlege svaret; ei breiare renne
    // er det nest ærlege; å teikne ein grunnare kjøl er det siste.
    const kjolTap = q.kryss - k.f.kryssEff
    if (kjolTap > 2.5) {
      if (!locked.has("fresR") && q.fresR > 3.5) {
        fix("fresR", q.fresR - 2.5)
      } else if (!locked.has("kryssB") && q.kryssB < 230) {
        fix("kryssB", q.kryssB + 30)
      } else {
        fix("kryss", k.f.kryssEff)
      }
      rort = true
    }

    // (f) snittet etter fresen. Halsen og beinet er begge det som står
    // ATT, og båe vert redda av det same: mindre utholing under, breiare
    // bein, fetare hals. Er snittet sjukt, står massespakane STILLE denne
    // omgangen — dei to set kvarandre i gang att i det uendelege elles,
    // og eit kast som svingar fram og attende brukar opp alle omgangane
    // sine utan å koma nokon stad.
    const sunn = sn.minA >= 6300 && bein >= 2650 && util <= 0.82
    if (!sunn) {
      if (util > 0.82 && !locked.has("beinN") && q.beinN > 1.15) {
        // bøyinga kjem av at det sveipa beinet ligg av trykklina; eit
        // rakare sveip er den einaste spaken som tek henne utan å gjere
        // møbelet mindre
        fix("beinN", q.beinN - 0.35)
      } else if (util > 0.82 && !locked.has("beinbreidd") && q.beinbreidd > 0.65) {
        fix("beinbreidd", q.beinbreidd - 0.35)
      } else if (!locked.has("kvelv") && q.kvelv > 80) {
        fix("kvelv", q.kvelv - 20)
      } else if (!locked.has("beinbreidd") && q.beinbreidd > 0.65) {
        fix("beinbreidd", q.beinbreidd - 0.35)
      } else if (!locked.has("midjeR") && q.midjeR < q.fot * 0.6) {
        fix("midjeR", Math.min(q.fot * 0.6, q.midjeR + 12))
      } else if (!locked.has("innsnitt") && q.innsnitt < 0.7) {
        fix("innsnitt", q.innsnitt + 0.08)
      } else if (!locked.has("bogeform") && q.bogeform > 0.85) {
        // slakare boge lèt kvelvinga sleppe golvet over ei breiare vifte,
        // og då står beinet att med meir gods på tvers
        fix("bogeform", q.bogeform - 0.3)
      } else if (!locked.has("foteR") && q.foteR > 6) {
        fix("foteR", q.foteR - 6)
      }
      rort = true
    }

    // (g) massen. Eit karva møbel er MASSIVT — det er ikkje eit avvik, det
    // er typologien: det finst ingen luft mellom lag og ingen hòl å spare
    // vekt i, av di eit hòl er ein stad fresen måtte nå inn.
    //
    // Spakane står i TO bunkar, og skiljet er heile grunnen til at dette
    // konvergerer. Krona hular ut UNDER møbelet og tek mest vekt, men ho
    // tek òg av snittet, og då dreg ho i same taug som (f) og kastet
    // svingar fram og attende til omgangane er brukte opp. Difor får ho
    // berre gå når snittet er friskt. Dei andre — høgare midje, slankare
    // hals, mindre sete, lågare høgd — rører ikkje halsen i det heile.
    if (masse > 15.4) {
      const tak = q.midjeH * q.hogd + 34
      if (sunn && !locked.has("kvelv") && q.kvelv < tak - 6) {
        // krona er den EINASTE spaken som er einsretta: kvar millimeter
        // ho stig tek eit skiv av rommet under møbelet og ingenting anna.
        // Springet flyttar berre kvar hòlet byrjar, og målinga syner at
        // han like gjerne legg vekt PÅ som tek vekk.
        fix("kvelv", Math.min(tak, q.kvelv + 22))
      } else if (!locked.has("midjeH") && q.midjeH < 0.74) {
        fix("midjeH", q.midjeH + 0.04)
      } else if (!locked.has("halsN") && q.halsN < PARAM_RANGES.halsN.max) {
        fix("halsN", Math.min(PARAM_RANGES.halsN.max, q.halsN + 0.4))
      } else if (sete > 342) {
        fix("seteB", q.seteB - 16)
        fix("seteD", q.seteD - 16)
      } else if (k.sitZ > 400 && q.hogd > 386) {
        fix("hogd", q.hogd - 12)
      }
      rort = true
    }

    // (h) svinnet. Emnet er plateomrisset gonger tjukna, og berre to
    // skyvarar rører det utan å røre objektet: sagmonen og emneforma.
    // Difor betalar dei fyrst — det er grovkuttet som er for grovt, ikkje
    // forma som er for lita.
    if (q.sagmon / 60 + q.emneform * 0.55 > 0.2) {
      if (!locked.has("emneform") && q.emneform > 0.04) {
        fix("emneform", q.emneform * 0.5)
      } else if (!locked.has("sagmon") && q.sagmon > 1) {
        fix("sagmon", q.sagmon * 0.6)
      }
      rort = true
    }

    // (i) kotene. Middelavstanden mellom limfugene kan aldri verta mindre
    // enn éi platetjukn — ho vert det på ein loddrett flanke — so ei plate
    // under elleve millimeter er eit garantert brot same kva forma gjer.
    if (q.plyT < 11.5) {
      fix("plyT", 11.5)
      rort = true
    }

    if (!rort) break
    // høgda kan ha flytta seg; krona skal framleis stå under setet
    if (q.kvelv > q.midjeH * q.hogd + 34) fix("kvelv", q.midjeH * q.hogd + 34)
    if (q.pute > q.fot * 0.55) fix("pute", q.fot * 0.55)
    if (q.midjeR > q.fot * 0.62) fix("midjeR", q.fot * 0.62)
  }

  return q
}
