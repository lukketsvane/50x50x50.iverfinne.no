/**
 * STRAUM — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Kroppen, tomrommet, skiveplana,
 * salen og tjuknene er alle funksjonar av desse tretti tala; ingen annan
 * fil i mappa held eit tal som ikkje kjem herifrå, og difor kan teikninga
 * og tabellen aldri kome i utakt.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader her ute og i radianar inne i motoren.
 *
 * Setehøgda står ikkje her. Ho ER høgda på kroppen: setekanten er toppen
 * av kappa, og to tal for same høgd er to tal som kan kome i utakt.
 */
import {
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type ParamBag,
  type Range,
} from "../core"
// body.ts importerer berre TYPEN Params herifrå, so importen er asyklisk
import { makeBody } from "./body"

const DEG = Math.PI / 180

export type Params = {
  // --- KROPP: dei fem kanalane i snittabellen, sett i endane -------------
  hogd: number // total høgd = setekanten, mm
  midjeH: number // kvar midja ligg, del av høgda
  midjeB: number // midja på tvers (Y), mm
  midjeD: number // midja fram og attende (X), mm
  seteB: number // setet på tvers, mm
  seteD: number // setet fram og attende, mm
  fotB: number // foten på tvers, mm
  fotD: number // foten fram og attende, mm
  morfNed: number // superellipse-eksponent ved golvet
  morfOpp: number // superellipse-eksponent ved setet
  mage: number // buk lagd på snittkanalane kring magehøgda, mm i diameter
  mageH: number // kvar buken sit, del av høgda

  // --- VRIDING ------------------------------------------------------------
  vridFot: number // vriding ved golvet, grader
  vridSete: number // vriding ved setet, grader
  vridSenter: number // kvar halve vridinga er teken ut, del av høgda

  // --- TOMROM -------------------------------------------------------------
  tomFra: number // der kroppen vert hol, del av høgda
  tomTil: number // der han vert massiv att
  veggT: number // veggtjukn, mm
  kile: number // innkiling i kvar ende, del av høgda

  // --- SKIVER -------------------------------------------------------------
  finnar: number // tal skiveplan
  skraa: number // skråstilling av planet ut av loddrett, grader
  planSenter: number // høgda planet vrir seg om, del av høgda
  planRetning: number // kva veg skiverekkja går, grader

  // --- SETE ---------------------------------------------------------------
  salsokk: number // salen ned på langs, mm
  sidesokk: number // salen ned på tvers, mm
  framkant: number // lårlette i framkanten, mm
  kantR: number // setekantradius, mm

  // --- BYGG ---------------------------------------------------------------
  finneT: number // finnetjukn, mm
  sokkelT: number // tjukn per sokkelplate, mm
  kappeT: number // tjukn per kappeplate, mm
  pressfit: number // sporet breiare enn plata i planet, mm
  fresD: number // fresediameter, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 340, max: 480, step: 1, label: "høgd", unit: "mm" },
  midjeH: { min: 0.2, max: 0.62, step: 0.005, label: "midjehøgd" },
  midjeB: { min: 90, max: 330, step: 1, label: "midje tvers", unit: "mm" },
  midjeD: { min: 70, max: 300, step: 1, label: "midje djup", unit: "mm" },
  seteB: { min: 240, max: 470, step: 1, label: "sete tvers", unit: "mm" },
  seteD: { min: 240, max: 470, step: 1, label: "sete djup", unit: "mm" },
  fotB: { min: 180, max: 470, step: 1, label: "fot tvers", unit: "mm" },
  fotD: { min: 180, max: 470, step: 1, label: "fot djup", unit: "mm" },
  morfNed: { min: 2, max: 7, step: 0.05, label: "morf nede" },
  morfOpp: { min: 2, max: 7, step: 0.05, label: "morf oppe" },
  mage: { min: -60, max: 80, step: 1, label: "mage", unit: "mm" },
  mageH: { min: 0.45, max: 0.85, step: 0.005, label: "magehøgd" },

  vridFot: { min: -80, max: 80, step: 1, label: "vriding fot", unit: "°" },
  vridSete: { min: -80, max: 80, step: 1, label: "vriding sete", unit: "°" },
  vridSenter: { min: 0.25, max: 0.75, step: 0.005, label: "vridingssenter" },

  tomFra: { min: 0.02, max: 0.4, step: 0.005, label: "tomrom frå" },
  tomTil: { min: 0.5, max: 0.95, step: 0.005, label: "tomrom til" },
  veggT: { min: 12, max: 60, step: 0.5, label: "veggtjukn", unit: "mm" },
  kile: { min: 0.004, max: 0.09, step: 0.001, label: "innkiling" },

  finnar: { min: 9, max: 39, step: 1, label: "skiveplan", int: true },
  skraa: { min: 0, max: 26, step: 0.5, label: "skråstilling", unit: "°" },
  planSenter: { min: 0.2, max: 0.8, step: 0.005, label: "planvriding" },
  planRetning: { min: 0, max: 180, step: 1, label: "skiveretning", unit: "°" },

  salsokk: { min: 8, max: 60, step: 0.5, label: "salsøkk", unit: "mm" },
  sidesokk: { min: 0, max: 30, step: 0.5, label: "sidesøkk", unit: "mm" },
  framkant: { min: 0, max: 24, step: 0.5, label: "framkant", unit: "mm" },
  kantR: { min: 2, max: 26, step: 0.5, label: "setekant", unit: "mm" },

  finneT: { min: 6, max: 18, step: 0.5, label: "finnetjukn", unit: "mm" },
  sokkelT: { min: 8, max: 22, step: 0.5, label: "sokkelplate", unit: "mm" },
  kappeT: { min: 8, max: 22, step: 0.5, label: "kappeplate", unit: "mm" },
  pressfit: { min: 0, max: 0.6, step: 0.01, label: "pressfit", unit: "mm" },
  fresD: { min: 3, max: 12, step: 0.5, label: "fresediameter", unit: "mm" },
}

/**
 * STRAUM slik han står i dokumentet, målt attende inn i dette rommet.
 * Det er utgangspunktet og ikkje ein «preset»: sandkassen har ingen meny
 * av former, berre eitt punkt du alt står i.
 */
export const DEFAULT_PARAMS: Params = {
  // Tolv skiveplan og ein vegg på 34 mm, og ikkje dei 23 og 28 STRAUM-
  // dokumentet har. Det er eit VAL, og det er verdt å skrive kva som står
  // på kvar side av det.
  //
  // Med 23 plan er opninga mellom finnane 8,8 mm. Det ligg midt i bandet
  // frå 5 til 25 der ein finger kjem inn og ikkje ut, og med 23 plan er
  // ho der 22 gonger. Motargumentet er godt: klemfaren er ei FYLGJE av
  // typologien og ikkje ein reknefeil — dokumentet sitt eige objekt har
  // 7,8 mm — og ein reiskap som seier frå er nettopp poenget.
  //
  // Det held likevel ikkje her, av éin grunn: standardpunktet er ikkje ein
  // demonstrasjon av regelen, det er objektet motoren leverer. Held det
  // ikkje sine eigne reglar, er det ikkje eit ferdig objekt. Regelen står
  // urørt — det er forma som gav etter, ikkje grensa. Hadde eg mjuka opp
  // bandet i staden, ville eg ha flytta grensa for å farge eit tal grønt,
  // og då er regelen ikkje verdt noko.
  //
  // Prisen står òg her: tolv finnar er grovare enn 23, og formuttrykket
  // taper på det. Dokumentobjektet er ikkje borte — det er eit punkt i
  // dette rommet, og `finnar: 23, veggT: 28` fører deg dit.
  hogd: 440,
  midjeH: 0.39,
  midjeB: 150,
  midjeD: 92,
  seteB: 412,
  seteD: 372,
  fotB: 336,
  fotD: 320,
  morfNed: 5.2,
  morfOpp: 2.4,
  // mage 0 er nøytral: standardobjektet står nøyaktig som før kanalen kom
  mage: 0,
  mageH: 0.62,

  vridFot: -16,
  vridSete: 40,
  vridSenter: 0.5,

  tomFra: 0.06,
  tomTil: 0.87,
  veggT: 34,
  kile: 0.018,

  finnar: 12,
  skraa: 12,
  planSenter: 0.5,
  planRetning: 90,

  salsokk: 30,
  sidesokk: 5,
  framkant: 6,
  kantR: 12,

  finneT: 9,
  sokkelT: 12,
  kappeT: 12,
  pressfit: 0.15,
  fresD: 6,
  material: "bjork",
}

export const GROUPS: readonly Group[] = [
  {
    id: "kropp",
    label: "kropp",
    keys: [
      "hogd", "midjeH", "midjeB", "midjeD", "seteB",
      "seteD", "fotB", "fotD", "morfNed", "morfOpp",
      "mage", "mageH",
    ],
  },
  { id: "vriding", label: "vriding", keys: ["vridFot", "vridSete", "vridSenter"] },
  { id: "tomrom", label: "tomrom", keys: ["tomFra", "tomTil", "veggT", "kile"] },
  {
    id: "skiver",
    label: "skiver",
    keys: ["finnar", "skraa", "planSenter", "planRetning"],
  },
  { id: "sete", label: "sete", keys: ["salsokk", "sidesokk", "framkant", "kantR"] },
  {
    id: "bygg",
    label: "bygg",
    keys: ["finneT", "sokkelT", "kappeT", "pressfit", "fresD"],
  },
]

export const PARAM_KEYS: readonly string[] = GROUPS.flatMap((g) => [...g.keys])

/** Kuraterte posar: tre handdesigna utgangspunkt terningen jittrar kring. */
export const POSES: readonly Partial<Params>[] = [
  // vridd søyle
  { vridFot: -60, vridSete: 60, finnar: 11, skraa: 18 },
  // timeglas
  { midjeB: 110, midjeD: 80, seteB: 430, seteD: 400, fotB: 400, fotD: 380, morfNed: 6, morfOpp: 3 },
  // dokumentobjektet: tett og mjukt — delinga pressa UNDER fingermålet
  // med ein finare fres, og ei fyldigare midje so plana ikkje deler seg
  // i fleire lause stykke enn verkstaden orkar setje i
  {
    finnar: 29, veggT: 28, skraa: 8, vridFot: -10, vridSete: 25,
    seteB: 400, seteD: 350, fotB: 360, fotD: 330, midjeB: 240, midjeD: 200,
    fresD: 3,
  },
  // amfora: buken sit over midja og er breiare enn både munning og fot —
  // ni plan so lufta mellom finnane står klar av fingerbandet, og midja
  // akkurat vid nok til at tre finnar går heilt gjennom
  {
    mage: 76, mageH: 0.7, midjeB: 140, midjeD: 110, seteB: 360, seteD: 345,
    fotB: 310, fotD: 300, finnar: 9, morfOpp: 3,
  },
]

/** Kva to-fingers-rulling på lerretet skrur på. */
export const NUDGE_PARAMS = { vertical: "midjeB", horizontal: "skraa" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params
}

/**
 * Terningen får kaste kva han vil, men reglane er funksjonar av fleire
 * tal samstundes, og eit fritt kast bryt nesten alltid ei av dei. Kaskaden
 * rettar kastet i rekkjefylgje — høgda fyrst, sidan alt etterpå les henne —
 * og rører berre ulåste nøklar, alltid innanfor banda. Estimata er
 * kalibrerte undermål, so ei retting aldri skapar eit nytt brot av same
 * slaget; eitt einaste kroppsoppslag midtvegs gjev den sanne spennvidda,
 * og då kan fres, klemfare og samanheng styrast eksakt utan ny bygging.
 */
function repair(q: Params, locked: ReadonlySet<string>): Params {
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k as string]
    const c = Math.min(r.max, Math.max(r.min, v))
    ;(q as Record<string, number | string>)[k] = r.int ? Math.round(c) : +c.toFixed(3)
  }

  // --- 1 sitjehøgda fyrst: alt etterpå les hogd ---------------------------
  // salen dreg sitjepunktet under kanten; 0,8·salsøkk + 0,15·sidesøkk − 3
  // bommar med −6 til −0,8 mm over 200 kast, so [384,476] held [380,480]
  const sitEst = () => q.hogd - 0.8 * q.salsokk - 0.15 * q.sidesokk - 3
  if (sitEst() < 384) fix("hogd", 384 + 3 + 0.8 * q.salsokk + 0.15 * q.sidesokk)
  if (sitEst() > 476) fix("hogd", 476 + 3 + 0.8 * q.salsokk + 0.15 * q.sidesokk)

  // --- 2 veltevinkelen: foten må bera setehøgda ---------------------------
  // tan 15° · 2 = 0,536; 0,57 legg mon for senterskyv og smal superellipse
  // (kalibrert på 300 kast: alle brot låg under 0,55)
  const fotMin = 0.57 * q.hogd
  if (q.fotB < fotMin) fix("fotB", fotMin)
  if (q.fotD < fotMin) fix("fotD", fotMin)

  // --- 3 sitjeflata: kantradien et av den målte breidda -------------------
  if (q.seteB - 4 * q.kantR < 316) fix("seteB", 316 + 4 * q.kantR)
  if (q.seteD - 4 * q.kantR < 316) fix("seteD", 316 + 4 * q.kantR)

  // --- 4 fresen, grovt: delinga må gje plass til spor pluss fres ----------
  // spanEst er eit strengt undermål av spennvidda (kvar superellipse med
  // n ≥ 2 inneheld ellipsen sin), so å krympe finneT etter han er trygt;
  // ei negativ mage kan snøre forma under estimatet, og det tek steg 5
  const sEst = Math.min(1, 492 / Math.max(q.seteB, q.seteD, q.fotB, q.fotD))
  const spanEst = sEst * Math.max(Math.min(q.fotB, q.fotD), Math.min(q.seteB, q.seteD))
  const cosA = Math.cos(q.skraa * DEG)
  let slotW = q.finneT / cosA + q.pressfit
  let nMax = Math.floor(spanEst / (q.fresD + slotW))
  if (nMax < 9) {
    // ni plan er golvet i bandet: gjer sporet smalare til dei får plass
    fix("finneT", (spanEst / 9 - q.fresD - q.pressfit) * cosA)
    slotW = q.finneT / cosA + q.pressfit
    nMax = Math.max(9, Math.floor(spanEst / (q.fresD + slotW)))
  }
  if (Math.round(q.finnar) > nMax) fix("finnar", nMax)

  // --- 5 eitt kroppsoppslag: sann spennvidd, resten vert eksakt -----------
  // Spennvidda er uavhengig av finnar (delinga er spennet delt på talet)
  // og midja styrer henne aldri, so etter dette eine oppslaget kan fres,
  // klemfare og samanheng setjast utan ny bygging.
  {
    const bd0 = makeBody(q)
    const spanTrue = bd0.pitch * Math.max(2, Math.round(q.finnar))
    let nMaxT = Math.floor(spanTrue / (q.fresD + slotW))
    if (nMaxT < 9) {
      fix("finneT", (spanTrue / 9 - q.fresD - q.pressfit) * cosA)
      slotW = q.finneT / cosA + q.pressfit
      nMaxT = Math.floor(spanTrue / (q.fresD + slotW))
    }
    if (Math.round(q.finnar) > nMaxT) fix("finnar", nMaxT)
    // klemfare: lufta mellom finnane må ut av fingerbandet [5,25)
    const gap = (n: number) => (spanTrue / n) * cosA - q.finneT
    const n0 = Math.round(q.finnar)
    if (gap(n0) >= 5 && gap(n0) < 25) {
      const nOpen = Math.floor((spanTrue * cosA) / (q.finneT + 25))
      const nDense = Math.ceil((spanTrue * cosA) / (q.finneT + 5))
      if (nOpen >= 9) fix("finnar", Math.min(n0, nOpen))
      else if (nDense <= Math.min(39, nMaxT)) fix("finnar", nDense)
    }
    // samanheng: midja må halde minst tre finnar heile vegen gjennom
    // (kalibrert: under tre gjennomgåande er aldri sett over 2,74 · deling,
    // og ei midje på 0,31 · spennet styrer aldri spennvidda sjølv)
    const midjeMin = 2.8 * (spanTrue / Math.round(q.finnar))
    if (q.midjeB < midjeMin) fix("midjeB", midjeMin)
    if (q.midjeD < midjeMin) fix("midjeD", midjeMin)
  }

  // --- 6 sporet mot plata: parallellogrammet må inn i tjukna --------------
  // (+0,05 mm mon mot toFixed-avrundinga i fix)
  if (Math.min(q.sokkelT, q.kappeT) < slotW) {
    if (q.sokkelT < slotW) fix("sokkelT", slotW + 0.05)
    if (q.kappeT < slotW) fix("kappeT", slotW + 0.05)
    if (Math.min(q.sokkelT, q.kappeT) < slotW) {
      fix("finneT", (Math.min(q.sokkelT, q.kappeT) - q.pressfit) * cosA)
    }
  }

  // --- 7 veggen: beinet i midja må bera to finnetjukner -------------------
  if (q.veggT < 2 * q.finneT) fix("veggT", 2 * q.finneT + 1)

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
  )
  const q = (posed ??
    randomBag(
      rnd,
      prev as unknown as ParamBag,
      PARAM_RANGES,
      PARAM_KEYS,
      locked,
    )) as unknown as Params
  return repair(q, locked)
}
