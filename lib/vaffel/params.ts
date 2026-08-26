/**
 * VAFFEL — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Kroppen, bogen, ribbene og ledda er
 * alle funksjonar av desse fire og tjue tala, og ingen annan fil i mappa held
 * eit tal som ikkje kjem herifrå.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader ut mot skyvaren.
 *
 * Djupna på ledda står ikkje her. Ho ER halve overlappet, og eit tal for
 * noko som alt er bestemt av geometrien er eit tal som kan kome i utakt med
 * henne. Det einaste som er eit val, er kvar i overlappet delinga ligg.
 */
import {
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type Hovuddrag,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"
import { applyFix } from "./reparasjon"

export type Params = {
  // --- PLAN: superellipsa kroppen er dratt opp av ------------------------
  planN: number // eksponent: 2 er ellipse, 6 les kuben inn i planet
  planA: number // halve utstrekninga fram og attende, mm
  planB: number // halve utstrekninga på tvers, mm

  // --- SILHUETT: kva planet gjer på vegen opp ----------------------------
  hogd: number // setekanten over golvet, mm
  fot: number // planet ved golvet, del av planet ved setet
  midje: number // innsnøringa i midja, del av planet
  midjeZ: number // høgda for det trongaste, normalisert
  midjeW: number // kor brei innsnøringa er
  skulder: number // kor mykje planet opnar seg att under setekanten
  lut: number // kor langt planet sig framover på vegen opp, mm

  // --- SETE ---------------------------------------------------------------
  sokk: number // setegropa på det djupaste, mm
  framkant: number // lårlette framme, mm
  rygg: number // kor høgt setekanten stig bak, mm
  kantR: number // setekantradius, mm

  // --- RIBBER -------------------------------------------------------------
  ribbX: number // ribber på tvers av X
  ribbY: number // ribber på tvers av Y
  ribbT: number // ribbetjukn, mm
  pressfit: number // sporet breiare enn ribba, mm
  lapp: number // kvar i overlappet delinga ligg, 0,5 er halvt om halvt

  // --- BOGE: opninga som gjer ribba til bein ------------------------------
  bogeH: number // kor høgt bogen når, del av ribbehøgda
  bogeBX: number // kor brei bogen er i X-leia, del av ribbebreidda
  bogeBY: number // kor brei bogen er i Y-leia, del av ribbebreidda
  bogeN: number // bogeeksponent: 2 er ellipse, 4 er nesten firkant

  // --- BYGG ---------------------------------------------------------------
  fresD: number // fresediameter, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  planN: { min: 2, max: 6, step: 0.05, label: "planform" },
  planA: { min: 130, max: 245, step: 1, label: "plan djup", unit: "mm" },
  planB: { min: 130, max: 245, step: 1, label: "plan tvers", unit: "mm" },

  hogd: { min: 350, max: 470, step: 1, label: "høgd", unit: "mm" },
  fot: { min: 0.55, max: 1.35, step: 0.005, label: "fot" },
  midje: { min: 0, max: 0.34, step: 0.005, label: "midje" },
  midjeZ: { min: 0.18, max: 0.72, step: 0.005, label: "midjehøgd" },
  midjeW: { min: 0.14, max: 0.62, step: 0.005, label: "midjebreidd" },
  skulder: { min: 0.86, max: 1.16, step: 0.005, label: "skulder" },
  lut: { min: -50, max: 50, step: 1, label: "framoverlut", unit: "mm" },

  sokk: { min: 0, max: 42, step: 0.5, label: "setegrop", unit: "mm" },
  framkant: { min: 0, max: 26, step: 0.5, label: "lårlette", unit: "mm" },
  rygg: { min: 0, max: 70, step: 1, label: "rygg", unit: "mm" },
  kantR: { min: 2, max: 26, step: 0.5, label: "kantradius", unit: "mm" },

  ribbX: { min: 3, max: 15, step: 1, label: "ribber langs X", int: true },
  ribbY: { min: 3, max: 15, step: 1, label: "ribber langs Y", int: true },
  ribbT: { min: 6, max: 24, step: 0.5, label: "ribbetjukn", unit: "mm" },
  pressfit: { min: 0.05, max: 0.4, step: 0.01, label: "pressfit", unit: "mm" },
  lapp: { min: 0.3, max: 0.7, step: 0.01, label: "leddeling" },

  bogeH: { min: 0, max: 0.86, step: 0.005, label: "bogehøgd" },
  bogeBX: { min: 0, max: 0.9, step: 0.005, label: "bogebreidd X" },
  bogeBY: { min: 0, max: 0.9, step: 0.005, label: "bogebreidd Y" },
  bogeN: { min: 1.4, max: 5, step: 0.05, label: "bogeform" },

  fresD: { min: 4, max: 12, step: 0.5, label: "fresediameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "plan", label: "plan", keys: ["planN", "planA", "planB"] },
  {
    id: "silhuett",
    label: "silhuett",
    keys: ["hogd", "fot", "midje", "midjeZ", "midjeW", "skulder", "lut"],
  },
  { id: "sete", label: "sete", keys: ["sokk", "framkant", "rygg", "kantR"] },
  {
    id: "ribber",
    label: "ribber",
    keys: ["ribbX", "ribbY", "ribbT", "pressfit", "lapp"],
  },
  { id: "boge", label: "boge", keys: ["bogeH", "bogeBX", "bogeBY", "bogeN"] },
  { id: "bygg", label: "bygg", keys: ["fresD"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden. Ni ribber kvar veg gjev sytti ledd, og ribbene er tynne av
 * di dei står i eit rutenett: ei plate på 7,5 mm som skal bera åleine er
 * for tynn, men ei som er avstiva kvar fyrtiande millimeter av ei plate på
 * tvers er det ikkje.
 *
 * Midja er grunn med vilje. Ho ser ut som ein smak, men ho er ei grense:
 * bit ho djupare enn fotavtrykket til den ytste ribba er breitt, vert den
 * ribba kutta i to av kroppen sin eigen form, og to lause stykke som heng
 * i naboen er ikkje ein del — dei er to delar som ikkje står i lista.
 */
export const DEFAULT_PARAMS: Params = {
  planN: 4.0,
  planA: 172,
  planB: 180,

  hogd: 432,
  fot: 1.06,
  midje: 0.09,
  midjeZ: 0.44,
  midjeW: 0.26,
  skulder: 1.03,
  lut: 0,

  sokk: 26,
  framkant: 11,
  rygg: 0,
  kantR: 14,

  // Åtte gonger åtte ribber på 6,5 held kvar einaste regel like godt som
  // ni på 7,5 gjorde, og sparer godt over kiloen — plata inn fell med
  // fjerdedelen, arkutnyttinga stig til 52 prosent. Bogen står urørd med
  // vilje: han er spaken «form av lasta» dreg i, og standarden skal ha
  // den monnen å gje.
  ribbX: 8,
  ribbY: 8,
  ribbT: 6.5,
  pressfit: 0.15,
  lapp: 0.5,

  bogeH: 0.62,
  bogeBX: 0.60,
  bogeBY: 0.60,
  bogeN: 2.6,

  fresD: 6,
  material: "bjork",
}

/** Kuraterte posar: handdesigna utgangspunkt terningen jittrar kring.
 *  Settet er ei utstilling i rekkjefylgje — tre kroppar, so dei breie, so
 *  strukturen, so sitjemåtane — og kvar pose er målt gjennom heile kjeda
 *  med null brot. Tjukner som står eksplisitt, står der av di dei er
 *  GRENSA for den posen; resten arvar standarden. */
export const POSES: readonly Partial<Params>[] = [
  // timeglas: innsnørt midje over vid klokkefot og opa skulder
  { midje: 0.2, midjeW: 0.45, midjeZ: 0.45, fot: 1.18, skulder: 1.1, bogeH: 0.55 },
  // amfora: rund kropp som smalnar mot foten, hals under setekanten og eit
  // ope lepe. Svingen frå hals til lepe er på grensa motoren set — den
  // ytste ribba må stå inne i kroppen i alle høgder.
  {
    planN: 2.3, planA: 210, planB: 210, fot: 0.96, midje: 0.13, midjeZ: 0.7,
    midjeW: 0.25, skulder: 1.1, ribbX: 7, ribbY: 7, bogeH: 0.45,
    bogeBX: 0.5, bogeBY: 0.5, bogeN: 2.2,
  },
  // nesten kube: superellipsen nesten ut i hjørna og brei, nesten firkanta
  // kvelving — kuben lesen inn i møbelet, boren av fire hjørnebein på
  // 66 % utnytting. Tjukna står eksplisitt av di det er ho som held det.
  { planN: 5.8, planA: 200, planB: 200, midje: 0.11, midjeZ: 0.5, midjeW: 0.3, fot: 1.0, ribbX: 9, ribbY: 9, ribbT: 6.5, bogeH: 0.75, bogeBX: 0.8, bogeBY: 0.8, bogeN: 3.6 },
  // tuva: låg og brei — setet 484 × 424 ved 386 mm, det lågaste og vidaste
  // i settet, med grunn grop og stutt framkant so sitjehøgda held bandet
  { planN: 5.2, planA: 215, planB: 245, hogd: 396, fot: 1.0, sokk: 12, framkant: 6, bogeH: 0.55 },
  // portalbenken: kvelvinga er BREI på tvers og smal i djupna — sett frå
  // sida ein krakk, sett framanfrå ei bru.
  {
    planN: 3.4, planA: 176, planB: 236, hogd: 428, fot: 1.08, midje: 0.075,
    skulder: 1.0, sokk: 20, framkant: 8, ribbX: 7, ribbY: 11,
    bogeH: 0.66, bogeBX: 0.42, bogeBY: 0.69, bogeN: 3.8,
  },
  // hallen: spissbogar (bogeN 1,7) i åtti prosent av høgda i BEGGE leier —
  // mest luft av alle posane, og lastkartet gløder på 80 % av kapasiteten.
  // Tjukna 8 er målt nedanfrå: ved 7 står utnyttinga i 91 prosent, og den
  // millimeteren er monen modellen ikkje reknar knekking med.
  { planA: 205, planB: 205, fot: 1.12, ribbT: 8, bogeH: 0.8, bogeBX: 0.75, bogeBY: 0.75, bogeN: 1.7 },
  // lågryggstolen: setekanten stig seksti seks millimeter bak, og då er
  // dette ikkje ein krakk lenger — det er ein stol med låg rygg. Med
  // ryggen er høgda 480, og slankleiken ligg på 74 av 75: tjukna 6,5 står
  // eksplisitt av di ho er grensa, ikkje av vane.
  {
    planN: 3.2, planA: 198, planB: 178, hogd: 418, fot: 1.02, midje: 0.06,
    skulder: 1.06, sokk: 30, framkant: 14, rygg: 66,
    ribbT: 6.5, bogeH: 0.6, bogeBX: 0.55, bogeBY: 0.62, bogeN: 3.0,
  },
  // lenekrakken: planet sig fire og førti millimeter framover på vegen opp,
  // so setet heng framom føtene og ein sit halvvegs — perchen. Høgda er
  // 466 og gropa er grunn med vilje. Veltevinkelen held 18° av di
  // vippearmen vert målt frå setet; tjukna 6,5 er grensa (slank 72 av 75).
  {
    planN: 3.0, planA: 200, planB: 200, hogd: 466, fot: 1.10, midje: 0.03,
    midjeZ: 0.4, midjeW: 0.3, skulder: 1.07, sokk: 12, framkant: 18, lut: 44,
    ribbT: 6.5, bogeH: 0.66, bogeBX: 0.58, bogeBY: 0.58, bogeN: 2.8,
  },
]

/** Posane med namna sine — same liste, synlege som inngangar i panelet.
 *  Namnet står her og ikkje inne i kvar pose, so poseBag (terningen) les
 *  lista uendra. Rekkjefylgja er lista over. */
const POSE_NAMN: readonly string[] = [
  "timeglas", "amfora", "nesten kube", "tuva",
  "portalbenken", "hallen", "lågryggstolen", "lenekrakken",
]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag,
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. Kvart drag styrer
 *  eitt eller fleire eksisterande band saman — ingen nye parametrar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "plan", label: "plan", keys: [["planA", 1], ["planB", 1]] },
  { id: "midje", label: "midje", keys: [["midje", 1], ["midjeW", 0.5]] },
  { id: "sete", label: "sete", keys: [["sokk", 1], ["framkant", 0.5]] },
  { id: "ribber", label: "ribber", keys: [["ribbX", 1], ["ribbY", 1]] },
  { id: "boge", label: "boge", keys: [["bogeH", 1], ["bogeBX", 0.6], ["bogeBY", 0.6]] },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "midje", pinch: "planA" }

export function clampParams(o: unknown, prev: Params): Params {
  // Gamle lenkjer har eitt bogeB. Det talet ER dei to nye i den gamle
  // verda — same breidd i begge leier — so det vert lese inn som begge.
  if (o && typeof o === "object") {
    const rec = o as Record<string, unknown>
    if (typeof rec.bogeB === "number" && rec.bogeBX === undefined && rec.bogeBY === undefined) {
      o = { ...rec, bogeBX: rec.bogeB, bogeBY: rec.bogeB }
    }
  }
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(rnd, prev, POSES, DEFAULT_PARAMS, PARAM_RANGES, PARAM_KEYS, locked)
  const q = posed ?? randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked)
  // Terningen får kaste kva han vil, men krava er summar av fleire tal og
  // eit fritt kast bryt dei oftare enn ikkje. Reparasjonen rører berre
  // ulåste skyvarar, alltid innanfor banda — sjå reparasjon.ts.
  return applyFix(q, locked, PARAM_RANGES)
}
