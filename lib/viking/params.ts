/**
 * VIKING — parametrane.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader ut mot skyvaren og i radianar inne i motoren.
 *
 * TYPOLOGIEN er det siste ledige hjørnet. Dei fire fyrste motorane
 * snittar ei krum flate i plater og lét deg sitje på plata sin KANT;
 * LAFT lét deg sitje på plateFLATA, men flata er flat. VIKING gjev deg
 * begge: ei krum flate du kan leggje handa på, sett saman av flate bord
 * der krumminga bur i vinkelen MELLOM borda og ikkje i borda sjølve.
 *
 * Det er klinkbygging, og det er den eine trekonstruksjonen som har
 * løyst nettopp dette problemet før: eit vikingskip er krumt utan at eit
 * einaste bord er krumt.
 *
 * TALET PÅ BORD er ikkje ein pynteparameter. Færre bord er større vinkel i
 * kvar lapp, og større vinkel er ei breiare opning mellom borda — og ei
 * opning mellom fem og tjuefem millimeter tek ein finger. Difor er `bord`
 * den einaste skyvaren i heile sandkassen der talet på delar er ein
 * KOMFORTparameter.
 */
import {
  clampBag,
  MATERIALS,
  poseBag,
  randomBag,
  type Group,
  type Hovuddrag,
  type Material,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"
import { skrogMaal } from "./skrog"

export type Params = {
  // --- skroget ------------------------------------------------------------
  /** setekanten framme over golvet, mm */
  hogd: number
  /** avstanden frå setekant til bakkant, mm */
  djup: number
  /** skroget si største breidd, mm */
  breidd: number
  /** kor djup skåla i setet er, mm — heile komforten */
  skaal: number
  /** kor langt stamnen stikk fram frå setekanten, mm */
  stamn: number
  /** kor mykje skroget svingar inn mot endane, 0 er ein kasse */
  sving: number
  /** rygghøgda målt langs ryggen, mm */
  ryggH: number
  /** ryggen si lening frå loddrett, grader */
  ryggV: number

  // --- borda --------------------------------------------------------------
  /** talet på bord i skroget */
  bord: number
  /** kor mykje eit bord overlappar det under, mm */
  lapp: number

  // --- spanta -------------------------------------------------------------
  /** kor langt ut spanta står, del av halve breidda */
  spantY: number
  /** kor mykje spantet stikk ned under skroget ved foten, mm */
  fotH: number
  /** breidda på spantet sitt gods under skroglina, mm */
  spantB: number
  /** utskjeringa i spantet: 0 trekant, 0,5 drope, 1 boge */
  holform: number
  /** utskjeringa si storleik, 0 er inkje hòl */
  holstorleik: number
  /** foten: kor brei kvar av dei to føtene på spantet er, mm */
  fotbreidd: number

  // --- leddet -------------------------------------------------------------
  /** platetjukna, mm */
  plyT: number
  /** klaringa i spora, mm */
  pressfit: number
  /** fresediameteren, mm */
  fresD: number
  /** kor langt tappen stikk ut forbi spantet, mm */
  tapp: number
  /** lista som låser alle tappane på ei side, breidd i mm */
  listB: number

  material: Material
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 332, max: 468, step: 1, label: "setehøgd" },
  djup: { min: 300, max: 460, step: 1, label: "setedjup" },
  breidd: { min: 300, max: 470, step: 1, label: "breidd" },
  skaal: { min: 0, max: 78, step: 1, label: "skål" },
  stamn: { min: 0, max: 90, step: 1, label: "stamn" },
  sving: { min: 0, max: 0.55, step: 0.01, label: "sving" },
  ryggH: { min: 0, max: 250, step: 1, label: "rygghøgd" },
  ryggV: { min: 0, max: 38, step: 0.5, label: "rygglening" },

  bord: { min: 5, max: 14, step: 1, label: "bord" },
  lapp: { min: 14, max: 90, step: 1, label: "lapp" },

  spantY: { min: 0.4, max: 0.92, step: 0.01, label: "spantavstand" },
  fotH: { min: 0, max: 150, step: 1, label: "fothøgd" },
  spantB: { min: 40, max: 130, step: 1, label: "spantbreidd" },
  holform: { min: 0, max: 1, step: 0.01, label: "hòlform" },
  holstorleik: { min: 0, max: 0.9, step: 0.01, label: "hòlstorleik" },
  fotbreidd: { min: 40, max: 130, step: 1, label: "fotbreidd" },

  plyT: { min: 9, max: 24, step: 0.5, label: "platetjukn" },
  pressfit: { min: 0, max: 0.6, step: 0.05, label: "klaring" },
  fresD: { min: 3, max: 10, step: 0.5, label: "fresediameter" },
  tapp: { min: 12, max: 40, step: 1, label: "tapp" },
  listB: { min: 24, max: 70, step: 1, label: "list" },
}

/** dei tre som høyrer maskina til og ikkje forma */
export const FREDA = ["plyT", "pressfit", "fresD"]

export const GROUPS: Group[] = [
  {
    id: "skrog",
    label: "skrog",
    keys: ["hogd", "djup", "breidd", "skaal", "stamn", "sving"],
  },
  { id: "rygg", label: "rygg", keys: ["ryggH", "ryggV"] },
  { id: "bord", label: "bord", keys: ["bord", "lapp"] },
  {
    id: "spant",
    label: "spant",
    keys: ["spantY", "spantB", "fotH", "fotbreidd", "holform", "holstorleik"],
  },
  { id: "ledd", label: "ledd", keys: ["plyT", "pressfit", "fresD", "tapp", "listB"] },
]

export const PARAM_KEYS: readonly string[] = GROUPS.flatMap((g) => g.keys)

export const DEFAULT_PARAMS: Params = {
  hogd: 384,
  djup: 376,
  breidd: 404,
  skaal: 30,
  stamn: 30,
  sving: 0.198,
  ryggH: 58,
  ryggV: 18,

  bord: 8,
  lapp: 45,

  spantY: 0.72,
  fotH: 96,
  spantB: 74,
  holform: 0.45,
  holstorleik: 0.6,
  fotbreidd: 82,

  plyT: 15,
  pressfit: 0.2,
  fresD: 6,
  tapp: 22,
  listB: 44,

  material: "bjork",
}

export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "djup", pinch: "breidd" }

export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "skaal", label: "skål", keys: [["skaal", 1]] },
  { id: "rygg", label: "rygg", keys: [["ryggH", 1], ["ryggV", 0.4]] },
  { id: "klink", label: "klink", keys: [["bord", 1], ["lapp", 0.5]] },
  { id: "skute", label: "skute", keys: [["sving", 1], ["stamn", 0.7]] },
  { id: "spant", label: "spant", keys: [["spantY", 1], ["holstorleik", 0.6]] },
]

export function materialet(p: Params): Material {
  return (p.material as string) in MATERIALS ? p.material : "bjork"
}

/**
 * REPARASJONEN.
 *
 * Same tanken som i dei andre motorane: eit ulovleg punkt vert klipt til
 * det næraste som kan byggjast, og rekkjefylgja er ei prioritering.
 * Kuben fyrst, so kroppen, so leddet.
 */
function eittPass(q: Params): Params {
  const set = <K extends keyof Params>(k: K, v: Params[K]) => {
    const r = PARAM_RANGES[k as string]
    q = { ...q, [k]: r ? Math.min(r.max, Math.max(r.min, v as number)) : v }
  }
  const rv = () => q.ryggV * (Math.PI / 180)

  // 1 og 2 KUBEN. Høgda og lengda vert LESNE av kurva og ikkje rekna av
  //   ei formel: kurva vert skalert etter kvar ein sit, og eit anslag på
  //   ytre høgd bommar med tretti millimeter. Ryggen gjev etter fyrst i
  //   høgda, stamnen fyrst i lengda — det er dei to som er til pynt når
  //   det røyner på.
  // Skroglina er ikkje ytterkanten. Borda ligg ei tjukn utanfor henne
  // overalt; spanta stikk eit gods forbi borda att, men BERRE der dei
  // rekk — og dei sluttar ved kneet. Difor to påslag og ikkje eitt: i
  // høgda tel berre bordtjukna, av di det høgaste punktet er ryggtoppen
  // der ingen spant er, medan i lengda tel begge, av di baugen er nettopp
  // der spantet står lengst fram.
  const PROUD_H = q.plyT + 8
  const PROUD_L = q.plyT + 30
  {
    const m = skrogMaal(q)
    if (m.H + PROUD_H > 496) {
      const over = m.H + PROUD_H - 484
      const frRygg = Math.min(over, Math.max(0, q.ryggH - 30))
      set("ryggH", q.ryggH - frRygg)
      if (over - frRygg > 0) set("hogd", q.hogd - (over - frRygg))
    }
  }
  {
    const m = skrogMaal(q)
    if (m.L + PROUD_L > 496) {
      const over = m.L + PROUD_L - 484
      const frStamn = Math.min(over, q.stamn)
      set("stamn", q.stamn - frStamn)
      if (over - frStamn > 0) set("djup", q.djup - (over - frStamn))
    }
  }
  // 3 kuben sideveg
  if (q.breidd + q.plyT * 2 + q.tapp * 2 > 494) set("breidd", 494 - q.plyT * 2 - q.tapp * 2)

  // 3b SITJEHØGDA slik ho FAKTISK vert. `hogd` set botnen i skåla, men
  //    splinen skyt eit hår forbi kontrollpunktet der baugen krullar, og
  //    ti millimeter er nok til å falle under bandet. Difor vert ho lesen
  //    av kurva og ikkje trudd på.
  {
    const m = skrogMaal(q)
    if (m.sit < 334) {
      // Er det slakk i kuben, vert setet løfta. Er det ikkje det, ville
      // eit løft berre kome attende som eit kutt i neste passet, og dei
      // to ville skuve på kvarandre i det uendelege. Då er det BAUGEN som
      // gjev seg: det er krullen hans splinen skyt forbi på.
      if (m.H + PROUD_H < 466) set("hogd", q.hogd + (334 - m.sit))
      else set("stamn", Math.max(0, q.stamn - (334 - m.sit) * 1.6))
    }
  }
  // 4 sitjehøgda: skåla kan ikkje ete meir enn det er høgd til
  if (q.hogd - q.skaal < 320) set("skaal", Math.max(0, q.hogd - 320))
  // 5 skåla kan ikkje vera djupare enn setet er langt — då er det ikkje
  //   ein skål, det er eit hòl
  if (q.skaal > q.djup * 0.22) set("skaal", q.djup * 0.22)

  // 6 spanta må stå inne i skroget, med gods til tappen utanfor
  {
    const y = (q.breidd / 2) * q.spantY
    const maks = q.breidd / 2 - q.plyT - 8
    if (y > maks) set("spantY", Math.max(0.4, maks / (q.breidd / 2)))
  }
  // 7 lista må få plass på tappen
  if (q.listB > q.tapp * 2.4) set("listB", Math.max(24, q.tapp * 2.4))
  // 8 lappen kan ikkje eta heile bordet: profilen delt på tal bord er
  //   bordlengda, og lappen må vera mindre enn ho
  {
    const boge = q.djup * 1.35 + Math.max(1, q.ryggH) + q.stamn
    const bordL = boge / Math.max(5, Math.round(q.bord))
    if (q.lapp > bordL * 0.62) set("lapp", Math.max(14, bordL * 0.62))
  }
  // 8a NAGLEN må få plass i lappen: hans eiga breidd pluss gods på kvar
  //    side. Lappen vert klipt OPP til det, ikkje ned.
  {
    const minLapp = q.plyT * 0.62 + 21
    if (q.lapp < minLapp) set("lapp", minLapp)
  }
  // 8b SVINGEN kan ikkje smalne skroget forbi spanta. Minste halvbreidd
  //    er (breidd/2)·(1 − sving), og bordet må rekke forbi spantet med
  //    ei halv tjukn og litt gods. Lukka form, so reparasjonen treffer
  //    fyrste gongen.
  {
    // Skroget si minste halvbreidd er (breidd/2)·(1 − sving), men aldri
    // under seksti — den grensa bur i breiddfunksjonen og må reknast med,
    // elles trur reparasjonen at ho har rydda opp når ho ikkje har det.
    const B = q.breidd / 2
    const treng = B * q.spantY + q.plyT / 2 + 9
    const tak = 1 - treng / Math.max(1, B)
    if (Math.max(60, B * (1 - q.sving)) < treng) {
      if (tak > 0) set("sving", Math.max(0, tak))
      else set("spantY", Math.max(0.4, (B - q.plyT / 2 - 9) / Math.max(1, B) - q.sving))
    }
  }
  // 9 foten kan ikkje vera breiare enn spantet er langt
  if (q.fotbreidd > q.djup * 0.42) set("fotbreidd", q.djup * 0.42)
  return q
}

export function fiks(p: Params): Params {
  let q = p
  for (let i = 0; i < 4; i++) q = eittPass(q)
  return q
}

export function clampParams(o: unknown, prev: Params): Params {
  return fiks(clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params)
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  // Maskinparametrane er FREDA i terningen: eit kast som byter platetjukn
  // er ikkje ei ny form, det er ein ny verkstad.
  const laast = new Set<string>([...locked, ...FREDA])
  const posed = poseBag(
    rnd,
    prev as unknown as ParamBag,
    POSES as readonly Partial<Record<string, number | string>>[],
    DEFAULT_PARAMS as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    laast,
  )
  const q = (posed ??
    randomBag(rnd, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS, laast)) as unknown as Params
  return clampParams(q, prev)
}

/**
 * POSANE.
 *
 * Fem skuter, ikkje fem tal. Kvar av dei skal svare på eit anna spørsmål
 * om kva eit klinkbygd sitjemøbel kan vera.
 */
const POSE_NAMN = ["knarren", "faringen", "skeida", "buksa", "vraket"]

export const POSES: readonly Partial<Params>[] = [
  // KNARREN — handelsskipet: djupt, breitt, tungt lasta. Låg rygg og den
  // største skåla i settet — du søkk ned i han. Sju bord med djup lapp:
  // eit tungt skrog med få og breie hudplankar.
  {
    hogd: 336, djup: 424, breidd: 448, skaal: 62, stamn: 18, sving: 0.12,
    ryggH: 70, ryggV: 26, bord: 7, lapp: 55, spantY: 0.8, fotH: 84,
    spantB: 92, holform: 0.85, holstorleik: 0.7, fotbreidd: 110, tapp: 18, listB: 36,
  },
  // FÆRINGEN — den vesle robåten: FÆRRAST bord i settet, so kvar lapp er
  // ein tydeleg knekk og skroget er openbert fasettert. Smal, høg, med den
  // lengste baugen og den djupaste lappen — sytti millimeter overlapp på
  // fem bord er nesten ein tredel hud på hud.
  {
    hogd: 404, djup: 330, breidd: 336, skaal: 22, stamn: 70, sving: 0.34,
    ryggH: 46, ryggV: 8, bord: 5, lapp: 69, spantY: 0.58, fotH: 130,
    spantB: 52, holform: 0.1, holstorleik: 0.35, fotbreidd: 62, tapp: 34, listB: 62,
  },
  // SKEIDA — langskipet: den lange, låge, lena. Størst rygg i settet og
  // minst skål — ein lener seg attover i staden for å søkkje ned. Slakaste
  // lappevinkelen av alle, av di kurva er lang og kneet lågt.
  {
    hogd: 340, djup: 420, breidd: 372, skaal: 12, stamn: 52, sving: 0.28,
    ryggH: 122, ryggV: 34, bord: 7, lapp: 56, spantY: 0.66, fotH: 40,
    spantB: 118, holform: 0.55, holstorleik: 0.82, fotbreidd: 96, tapp: 26, listB: 48,
  },
  // BUKSA — kassen: sving null, stamn null. Eit klinkbygd skrog med rette
  // sider, so ein ser at fasettane åleine gjer krumminga — ingen båtform
  // å gøyme seg bak. Spanta står heilt ute i kanten.
  {
    hogd: 372, djup: 356, breidd: 424, skaal: 30, stamn: 0, sving: 0,
    ryggH: 78, ryggV: 12, bord: 6, lapp: 53, spantY: 0.9, fotH: 118,
    spantB: 44, holform: 0, holstorleik: 0, fotbreidd: 128, tapp: 14, listB: 30,
  },
  // VRAKET — skroget utan rygg og nesten utan spant: ein krakk som er
  // berre skal. Ingen rygg, djupaste skåla i høve til høgda, og spanta
  // reduserte til to smale bøylar med det største hòlet i settet.
  {
    hogd: 380, djup: 392, breidd: 396, skaal: 66, stamn: 46, sving: 0.3,
    ryggH: 0, ryggV: 0, bord: 6, lapp: 60, spantY: 0.5, fotH: 62,
    spantB: 128, holform: 1, holstorleik: 0.9, fotbreidd: 72, tapp: 30, listB: 66,
  },
]

export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag: bag as Pose["bag"],
}))
