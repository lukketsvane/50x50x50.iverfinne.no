/**
 * SANDKASSE — tolv snitt gjennom rommet.
 *
 * Dette er ikkje ein meny av former. Kvar variant er DEFAULT_PARAMS med
 * éin eller to tal endra, og kvar av dei svarar på eit spørsmål motoren
 * stiller. Grunnen til at dei står her og ikkje i grensesnittet er den
 * kritikken metoden har mot seg sjølv: ein generator lagar variasjon
 * lettare enn han lagar meining, og tolv variantar frå same likning er
 * tolv snitt gjennom eitt rom, ikkje tolv idear. Dei høyrer difor heime
 * i dokumentasjonen, som argument — ikkje i reiskapen, som val.
 */
import { DEFAULT_PARAMS, type Params } from "./params"

export type Variant = {
  code: string
  name: string
  /** kva spørsmål varianten svarar på */
  why: string
  /** kvifor han likevel ikkje er objektet */
  against: string
  over: Partial<Params>
}

export const VARIANTS: readonly Variant[] = [
  {
    code: "A1",
    name: "urørt snitt",
    why: "Utan vriding er kvart lag ein skalert kopi av naboen, og heile flata kan lesast av eitt oppriss.",
    against: "Objektet har inga framside. Det ser likt ut frå kvar vinkel, og då er det ei bøtte.",
    over: { twist: 0, spineBack: 0, spineFwd: 0 },
  },
  {
    code: "A2",
    name: "hard vriding",
    why: "130 grader gjer at fingrane finn ei anna form i kvar høgd. Vridinga er det einaste som lagar krumning på tvers utan å kosta ein einaste krum del.",
    against: "Over hundre grader byrjar opningane å skru seg rundt kroppen fortare enn auget klarar fylgje.",
    over: { twist: 130 },
  },
  {
    code: "B1",
    name: "tønne",
    why: "Utan midje er skalet ei samanhengande kjegle. Enklaste stabelen som finst, og den med minst spill.",
    against: "Ingen handgrep, ingen skugge, og alt materialet står der momentet er størst.",
    over: { waist: 0.04, flare: 0.02 },
  },
  {
    code: "B2",
    name: "djup midje",
    why: "Midja pressa til det motoren tillèt. Materialet flyttar seg dit momentet er minst, og objektet får eit grep.",
    against: "Det minste tverrsnittet fell så langt at utnyttinga ikkje lenger er ei formalitet.",
    over: { waist: 0.56, waistZ: 0.46 },
  },
  {
    code: "C1",
    name: "fire bein",
    why: "Fire kontaktflater gjev jamnare fotavtrykk og betre veltevinkel i alle retningar.",
    against: "Fire bein på eit vridd skal les som ein stol. Tre er det talet som gjer objektet til eitt stykke.",
    over: { legs: 4, legGap: 52 },
  },
  {
    code: "C2",
    name: "utan strekt bein",
    why: "Alle tre beina like. Reinare plan, og éin del mindre å halde styr på.",
    against: "Veltevinkelen fell, og det er nett i den retninga setet lener seg at han trengst.",
    over: { legStretch: 0 },
  },
  {
    code: "D1",
    name: "utan sveip",
    why: "Fjernar den fjerde opninga. Kroppen vert lukka over midja og les som eit massivt volum.",
    against: "Baksida vert daud. Det er sveipet som gjer at objektet ikkje har ei side du ikkje viser fram.",
    over: { sweepSpan: 42, sweepH: 0.05 },
  },
  {
    code: "D2",
    name: "opna sveip",
    why: "250 grader: opninga vert hovudsaka og skalet vert eit band.",
    against: "Rimet mistar opplegg. Setet heng på for lite gods, og regelen seier frå.",
    over: { sweepSpan: 248, sweepH: 0.24 },
  },
  {
    code: "E1",
    name: "låg krakk",
    why: "340 mm sete. Ryggen får plass i kuben utan å kappast, og objektet vert breiare enn det er høgt.",
    against: "Under 380 mm er det ikkje lenger ein krakk, det er ein skammel.",
    over: { seatZ: 340, finRise: 96 },
  },
  {
    code: "E2",
    name: "utan rygg",
    why: "Rimet bylgjer, men reiser seg ikkje. Setehøgda kan då gå opp mot 450 utan å bryte kuben.",
    against: "Utan rygg finst det ingen grunn til at setet ligg så lågt, og heile grunngjevinga for proporsjonen fell.",
    over: { finRise: 0, seatZ: 445, rimWave: 34 },
  },
  {
    code: "F1",
    name: "tynn plate",
    why: "Tynnare plate gjev fleire lag og eit tettare mønster av limfuger — trappa på innsida vert nesten ei flate.",
    against: "Femti limfuger er femti sjansar til å bomme, og stabelen tek tre dagar til.",
    over: { plyT: 9, shellT: 10 },
  },
  {
    code: "F2",
    name: "tjukk plate",
    why: "Tjukkare plate gjev halve limjobben, og trappa på innsida vert eit grovare og ærlegare uttrykk.",
    against: "Trappa vert så grov at ho tek over lesinga frå flata. Objektet ser stabla ut i staden for å vera det.",
    over: { plyT: 22, shellT: 18, sand: 3 },
  },
]

export function variantParams(v: Variant): Params {
  return { ...DEFAULT_PARAMS, ...v.over }
}
