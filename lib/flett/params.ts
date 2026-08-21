/**
 * FLETT — parameterrommet.
 *
 * Typologien er den einaste i sandkassen der SITJEFLATA IKKJE ER SAMME
 * STOFF SOM BEREVERKET. Ramma er skoren av plate og ber berre bandendane;
 * flata sjølv er lange, tynne finérband som er fletta over og under
 * kvarandre. Ei plate ber ved å BØYE seg. Ein vev ber ved å STREKKJE seg,
 * og han sig — sigen er komforten, og han er samstundes heile
 * konstruksjonshistoria: kvar millimeter sig er ei omveg lasta tek gjennom
 * strekk i staden for gjennom bøying.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Millimeter og grader.
 *
 * RENNING er banda som går fram og attende (langs X, delte utover Y).
 * INNSLAG er banda som går på tvers (langs Y, delte utover X). Namna er
 * vevnaden sine eigne, og dei er brukte av di dei er dei einaste orda som
 * skil dei to retningane utan å måtte seie «den eine» og «den andre».
 */
import { MATERIALS, clampBag, type Group, type Range } from "../core"

export type Params = {
  // --- RAMME ---------------------------------------------------------------
  hogd: number // rammeplanet si høgd ved framkanten av opninga, mm
  djup: number // fri opning fram–bak, innanfor ramma, mm
  breidd: number // fri opning på tvers, innanfor ramma, mm
  planN: number // planform: 2 er ellipse, 8 er avrunda rektangel
  bakflat: number // kor rett bakkanten er, 0–1 — ryggbogen krev rett bakkant
  rammeT: number // ramma si tjukn, loddrett, mm
  rammeH: number // ramma si breidd, radialt utanfor opninga, mm
  rammetype: number // 0 hank (lukka), 1 bogar, 2 bein og rammer

  // --- BEIN ----------------------------------------------------------------
  beinB: number // fotbreidd på golvet, mm
  spreie: number // beinspreiing utover, grader
  bogeN: number // bogeform under ramma: 2 er ellipse, 4 nesten firkant
  fotfas: number // fas på foten, mm

  // --- RENNING (fram–bak) --------------------------------------------------
  renW: number // bandbreidd, mm
  renT: number // bandtjukn, mm
  renN: number // tal band
  renFall: number // gapgradient: + pakkar mot midten, − mot kantane

  // --- INNSLAG (på tvers) --------------------------------------------------
  innW: number
  innT: number
  innN: number
  innFall: number

  // --- FLETT ---------------------------------------------------------------
  flott: number // flottlengd: 1 er toskaft, 2 er kypert, 3–4 lange flott
  skift: number // kor mange kryss mønsteret skyv seg per band, 0 er rips
  boygtal: number // bøyetalet R/t for kald bøying av finérbandet
  spenn: number // førespenn i veven, 0–1

  // --- FORM ----------------------------------------------------------------
  kroneTvers: number // krone på tvers, mm
  kroneLangs: number // krone langs — negativ er ei skål, mm
  helling: number // setehelling bakover kring framkanten, grader
  vulst: number // kor mykje flata fell mot ramma, mm

  // --- RYGG ----------------------------------------------------------------
  ryggH: number // ryggbogen over bakkanten, mm — null er ein krakk
  ryggV: number // ryggbogen si lening bakover, grader
  ryggB: number // ryggbukt bakover på vegen opp, mm — berre høge bogar toler mykje
  ryggDekk: number // kor stor del av bogen veven klatrar opp i, 0–1

  // --- BYGG ----------------------------------------------------------------
  feste: number // 0 slisse, 1 omslag, 2 leppe
  kant: number // festelengd forbi ramma si innerside, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 360, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  djup: { min: 290, max: 400, step: 1, label: "ramme fram–bak", unit: "mm" },
  breidd: { min: 290, max: 420, step: 1, label: "ramme på tvers", unit: "mm" },
  planN: { min: 2, max: 8, step: 0.05, label: "planform" },
  bakflat: { min: 0, max: 1, step: 0.01, label: "rett bakkant" },
  rammeT: { min: 10, max: 28, step: 0.5, label: "rammetjukn", unit: "mm" },
  rammeH: { min: 34, max: 110, step: 1, label: "rammebreidd", unit: "mm" },
  rammetype: { min: 0, max: 2, step: 1, label: "rammelukking", int: true },

  beinB: { min: 44, max: 150, step: 1, label: "fotbreidd", unit: "mm" },
  spreie: { min: -3, max: 16, step: 0.5, label: "beinspreiing", unit: "°" },
  bogeN: { min: 1.6, max: 5, step: 0.05, label: "bogeform" },
  fotfas: { min: 0, max: 30, step: 0.5, label: "fotfas", unit: "mm" },

  renW: { min: 12, max: 82, step: 0.5, label: "renningsbreidd", unit: "mm" },
  renT: { min: 0.8, max: 5, step: 0.1, label: "renningstjukn", unit: "mm" },
  renN: { min: 3, max: 26, step: 1, label: "renningar", int: true },
  renFall: { min: -0.7, max: 0.7, step: 0.01, label: "renningsfall" },

  innW: { min: 12, max: 82, step: 0.5, label: "innslagsbreidd", unit: "mm" },
  innT: { min: 0.8, max: 5, step: 0.1, label: "innslagstjukn", unit: "mm" },
  innN: { min: 3, max: 26, step: 1, label: "innslag", int: true },
  innFall: { min: -0.7, max: 0.7, step: 0.01, label: "innslagsfall" },

  flott: { min: 1, max: 4, step: 1, label: "flottlengd", int: true },
  skift: { min: 0, max: 3, step: 1, label: "skift", int: true },
  boygtal: { min: 80, max: 160, step: 1, label: "bøyetal R/t" },
  spenn: { min: 0, max: 1, step: 0.01, label: "førespenn" },

  kroneTvers: { min: 0, max: 48, step: 0.5, label: "krone tvers", unit: "mm" },
  kroneLangs: { min: -36, max: 40, step: 0.5, label: "krone langs", unit: "mm" },
  helling: { min: -2, max: 9, step: 0.5, label: "setehelling", unit: "°" },
  vulst: { min: 0, max: 45, step: 0.5, label: "kantfall", unit: "mm" },

  ryggH: { min: 0, max: 170, step: 1, label: "rygghøgd", unit: "mm" },
  ryggV: { min: 0, max: 32, step: 0.5, label: "rygglening", unit: "°" },
  ryggB: { min: 0, max: 55, step: 1, label: "ryggbukt", unit: "mm" },
  ryggDekk: { min: 0, max: 1, step: 0.01, label: "ryggdekke" },

  feste: { min: 0, max: 2, step: 1, label: "bandfeste", int: true },
  kant: { min: 10, max: 70, step: 1, label: "festelengd", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  {
    id: "ramme",
    label: "ramme",
    keys: ["hogd", "djup", "breidd", "planN", "bakflat", "rammeT", "rammeH", "rammetype"],
  },
  { id: "bein", label: "bein", keys: ["beinB", "spreie", "bogeN", "fotfas"] },
  { id: "renning", label: "renning", keys: ["renW", "renT", "renN", "renFall"] },
  { id: "innslag", label: "innslag", keys: ["innW", "innT", "innN", "innFall"] },
  { id: "flett", label: "flett", keys: ["flott", "skift", "boygtal", "spenn"] },
  { id: "form", label: "form", keys: ["kroneTvers", "kroneLangs", "helling", "vulst"] },
  { id: "rygg", label: "rygg", keys: ["ryggH", "ryggV", "ryggB", "ryggDekk"] },
  { id: "bygg", label: "bygg", keys: ["feste", "kant"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden er referansen: den fletta krakken. Ei lukka hankeramme av
 * atten millimeter finér, fire bladbein i diagonalane, og eit KYPERT —
 * over to, under to, med eitt skift per renning — av band på førtifem gonger
 * to millimeter.
 *
 * Kvifor kypert og ikkje toskaft? Av di bøyebudsjettet er eitt og skal
 * delast. Radien bandet vert tvunge i, veks med kvadratet av flottlengda,
 * so eit kypert kjøper fire gonger radius av same deling. Eit toskaft av
 * same tjukn brukar heile budsjettet på sjølve flettinga og har ingen ting
 * att til KRONA — då må flata vera flat. Kyperten gjev både vev og bule.
 * Toskaftet står som ein eigen pose, med breie band og ei roleg flate, og
 * han syner nett den byttehandelen.
 *
 * Lufta mellom banda er 4,4 mm med vilje: veven har fleire titals opningar,
 * og kvar av dei er ei fingerfelle om ho ligg i bandet 5–25 mm. Eit tett
 * flett er den eine trygge sida av det bandet; eit vidopent er den andre.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 412,
  djup: 336,
  breidd: 348,
  planN: 4.4,
  bakflat: 0.35,
  rammeT: 18,
  rammeH: 60,
  rammetype: 0,

  beinB: 88,
  spreie: 5,
  bogeN: 2.4,
  fotfas: 12,

  renW: 45,
  renT: 2,
  renN: 7,
  renFall: 0,

  innW: 43.5,
  innT: 2,
  innN: 7,
  innFall: 0,

  flott: 2,
  skift: 1,
  boygtal: 120,
  spenn: 0.25,

  kroneTvers: 12,
  kroneLangs: -5,
  helling: 3,
  vulst: 6,

  ryggH: 0,
  ryggV: 14,
  ryggB: 18,
  ryggDekk: 0.6,

  feste: 0,
  kant: 30,
  material: "bjork",
}

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "renW" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

// =============================================================================
// KURATERTE POSAR
// =============================================================================
/**
 * Åtte posar, og dei er åtte ULIKE VEVAR — ikkje åtte silhuettar.
 * Skilnaden ligg i mønsteret og i kva ramma gjer med strekket, av di det
 * er dei to som ER typologien.
 *
 * Sjå kva flottlengda og skiftet gjer med DELINGA, for det er den
 * einaste staden i sandkassen der eit mønsterval har ein pris i
 * millimeter: toskaftet må ha femtiseks millimeter mellom banda der
 * kyperten greier seg med tretti, og ripsen — skift null — slepper
 * innslaget heilt fri og kan leggje tjue smale renningar der dei andre
 * har sju breie.
 */
export const POSES: readonly Partial<Params>[] = [
  // TOSKAFTET: over eitt, under eitt. Det reinaste flettet som finst, og
  // det dyraste: bandet må svinge for kvart einaste kryss, so delinga må
  // vera dobbelt so vid som i eit kypert. Fem band kvar veg, sekstifem
  // millimeter breie, og ei roleg flate — heile bøyebudsjettet gjekk med
  // til sjølve flettinga.
  {
    hogd: 410, planN: 3.6, rammeH: 56, beinB: 100, spreie: 5.5, fotfas: 14,
    renW: 65.4, renT: 1.6, renN: 5, innW: 63, innT: 1.6, innN: 5,
    flott: 1, spenn: 0.2, kroneTvers: 8, kroneLangs: -3, vulst: 4,
  },
  // RIPSEN: skift null. Kvar renning ligg likt, so innslaget kryssar aldri
  // over til andre sida og har inga svinging i det heile — då er det
  // ingen ting som avgrensar kor tett renningane kan liggje. Tjue smale
  // band mot åtte breie: same mønsterfamilie, heilt anna tekstur.
  {
    hogd: 408, djup: 334, breidd: 346, planN: 5.4, rammeT: 20, beinB: 96,
    renW: 13.5, renT: 2.2, renN: 20, innT: 2.2, skift: 0, spenn: 0.12,
    kroneTvers: 14, kroneLangs: -6, vulst: 3.6,
  },
  // KORGA: flott to, skift to. Skiftet hoppar over annakvart steg på
  // tvers, so innslaget sitt flott vert eitt einaste kryss langt medan
  // renninga sitt er to. Veven vert SKEIV i krav: fem breie renningar og
  // åtte smalare innslag, og leppefeste i ei fals langs innerkanten.
  {
    hogd: 406, djup: 338, breidd: 350, planN: 6.2, rammeT: 19, rammeH: 58, beinB: 92,
    renW: 65.8, renT: 1.6, renN: 5, innW: 38.3, innT: 1.6, innN: 8,
    skift: 2, spenn: 0.2, kroneLangs: -4, vulst: 7, feste: 2, kant: 40,
  },
  // BOGEKRAKKEN: ringen er kløyvd framme og bak, og to bogar i sidene ber
  // heile veven med tverrband under. Strekket frå renninga har då inga
  // ring å gå rundt — det må takast i BØYING, og difor er ramma
  // syttifire millimeter brei og seksogtjue tjukk. Førespennet er skrudd
  // heilt ned: krafta som står der heile døgeret, er dyrare for ei kutta
  // ramme enn lasta sjølv.
  {
    hogd: 402, djup: 332, breidd: 340, planN: 4.8, rammetype: 1,
    rammeT: 26, rammeH: 74, beinB: 100, spreie: 4, bogeN: 2.8,
    renT: 1.8, innT: 1.8, spenn: 0.05, kroneLangs: -4,
  },
  // FIRE BEIN OG FIRE RAMMER: ringen er kutta i hjørna, og kvar rammebit
  // bøyer seg for seg mellom to bein. Den lettaste lukkinga, og den som
  // spriker mest — momentet er halvanna gong bogekrakken sitt, av di dei
  // fire bitane ikkje heng saman kring hjørna. Lange flott på tre.
  {
    hogd: 414, djup: 332, breidd: 338, planN: 6.6, rammetype: 2,
    rammeT: 20, rammeH: 70, beinB: 76, spreie: 4.9, fotfas: 18,
    renW: 24.4, renT: 2.2, renN: 12, innT: 2.2, flott: 3,
    spenn: 0.08, kroneTvers: 14, vulst: 3.1,
  },
  // LENESTOLEN: bakkanten er rett, bogen stig hundre millimeter, og
  // renninga svingar over bakkanten og klatrar opp i han. Det er den
  // einaste posen der veven er både sete OG rygg — same band, same
  // mønster, berre bøygd opp. Svingen er ei VARIG bøying kring ramma sin
  // bakkant, og difor må ramma vera brei nok til å svinge kring.
  {
    hogd: 405, djup: 334, breidd: 344, planN: 6.8, bakflat: 1,
    rammeH: 56, beinB: 96, spreie: 4.2, spenn: 0.16, helling: 5,
    kroneTvers: 9, kroneLangs: -2, vulst: 1.5,
    ryggH: 101, ryggV: 12, ryggB: 0.9, ryggDekk: 0.6,
  },
  // SLAKKEN: nesten inkje førespenn. Veven lever då berre på det kubiske
  // leddet i kabellikninga og søkk åtte millimeter under ein vaksen —
  // den mjukaste sitjinga typologien kan gje utan å botne på ramma. Prisen
  // står i utnyttinga: strekket i bandet er det høgste i heile familien.
  {
    hogd: 418, breidd: 346, planN: 3.2, rammeT: 16, rammeH: 54, beinB: 106, spreie: 5.5,
    renW: 65, renT: 1.6, renN: 5, innW: 63, innT: 1.6, innN: 5, flott: 1,
    spenn: 0.02, kroneTvers: 14.6, kroneLangs: 4, vulst: 1.4,
  },
  // OMSLAGET: bandet går over ramma sin ytterkant og vert pinna under.
  // Den bøyen er varig og ikkje elastisk — bandet vert bløytt og lagt —
  // men radien er halve rammetjukna, og då må ramma vera tolv gonger so
  // tjukk som bandet. Toogtjue millimeter ramme mot eit band på halvanna:
  // omslaget er den festemåten som TVINGAR fram tynne band.
  {
    hogd: 406, breidd: 346, planN: 4.6, rammeT: 22, rammeH: 62, beinB: 94,
    renT: 1.6, innT: 1.6, spenn: 0.18, kroneTvers: 13, vulst: 8,
    feste: 1, kant: 40,
  },
]

// =============================================================================
// TERNINGEN
// =============================================================================
/** E-modul for finérbandet: kryssfinér ligg kring 250 gonger fm,k. */
export const EMOD = (mat: string) =>
  250 * MATERIALS[(mat in MATERIALS ? mat : "bjork") as keyof typeof MATERIALS].fmk
