/**
 * RIBBE — reglane.
 *
 * Ein sandkasse som berre teiknar er ein demonstrasjon. Det som gjer han
 * til ein reiskap er at han seier nei: at eit tal på skjermen kan slå fast
 * at objektet ikkje let seg byggja, ikkje let seg sitja på, eller ikkje
 * lenger er svar på oppgåva.
 *
 * Ein hard regel er brot: objektet går utanfor kuben, blada kolliderer i
 * navet, veven fell under minstemålet, leddet finst ikkje. Ein mjuk regel
 * er eit val — han kan stå, men den som let han stå skal ha sett kva han
 * kostar. Difor har kvar regel ei grunngjeving og ikkje berre eit tal.
 *
 * Reglane les måla frå `metrics` der dei finst. Det som ikkje finst der —
 * opninga mellom to blad, den loddrette luka mellom to band — vert målt
 * her, av di dei tala berre gjev meining som ein terskel.
 */
import { CUBE, nn, type Metrics, type Rule } from "../core"
import type { Params } from "./params"
import { makeShell, type Shell } from "./shell"
import { buildAll, DETAIL, type Built } from "./mesh"
import { makeBlade, sAtRad, bladePt } from "./blade"
import { buildParts } from "./parts"
import { nest } from "./nest"
import { MATERIALS } from "../core"

const mm = (v: number) => nn(v, 0)
const mm1 = (v: number) => nn(v, 1)

/** fingerfella: ei lukka opning i dette bandet tek ein finger og held han */
const TRAP_LO = 5
const TRAP_HI = 25

/** vevdjupna objektet ikkje toler å gå under, mm */
const WEB_MIN = 24

/**
 * Den frie opninga mellom to naboblad ved ein gjeven radius, målt vinkelrett
 * på bladet og ikkje langs boga: det er den avstanden ein finger, eit
 * blad eller ein klemme faktisk møter.
 */
function openAt(sh: Shell, rho: number): number {
  const b0 = makeBlade(sh, 0)
  const b1 = makeBlade(sh, 1 % sh.angles.length)
  const s = sAtRad(b0, sh.rHub, rho)
  const q = bladePt(b0, s)
  const d = Math.abs((q[0] - b1.a[0]) * b1.n[0] + (q[1] - b1.a[1]) * b1.n[1])
  return d - sh.p.bladeT
}

/** dei lukka luftromma mellom banda, i loddrett lei */
function bandGaps(sh: Shell): number[] {
  const p = sh.p
  const out: number[] = []
  const z = sh.bandZ
  out.push(z[0] - p.bandT / 2)
  for (let j = 0; j + 1 < z.length; j++) out.push(z[j + 1] - z[j] - p.bandT)
  out.push(sh.zBlade - (z[z.length - 1] + p.bandT / 2))
  return out
}

export function checkRules(p: Params, m: Metrics, pre?: { sh?: Shell; g?: Built }): Rule[] {
  const sh = pre?.sh ?? makeShell(p)
  const g = pre?.g ?? buildAll(p, DETAIL.lav, sh)
  const R: Rule[] = []
  const add = (r: Rule) => R.push(r)

  // --- 1 kuben -------------------------------------------------------------
  add({
    id: "kube",
    label: "kuben",
    hard: true,
    ok: Math.max(m.envX, m.envY, m.envZ) <= CUBE + 1e-6,
    value: `${mm1(m.envX)} × ${mm1(m.envY)} × ${mm1(m.envZ)} mm`,
    why: "Oppgåva er kuben, og eit objekt som ikkje går inn i han svarar ikkje lenger på henne — kor godt det elles måtte sitja.",
  })

  // --- 2 setehøgd ----------------------------------------------------------
  add({
    id: "setehogd",
    label: "setehøgd",
    hard: false,
    ok: m.sitZ >= 380 && m.sitZ <= 480,
    value: `sit ${mm(m.sitZ)} · kant ${mm(m.seatZ)} mm`,
    why: "Setehøgda er der ein sit og ikkje der kanten står; på ei skål ligg dei eit par centimeter frå kvarandre. Under 380 mm pressar setet knea opp mot brystet, over 480 mm heng føtene i lause lufta.",
    peikar: ["seatZ", "dish"],
  })

  // --- 3 veltevinkel -------------------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${mm1(m.tipAngle)}° · arm ${mm(m.tipArm)} mm`,
    why: "Ein krakk som går rundt når nokon lener seg utover er farleg lenge før han er stygg; Stool 60 har kring 23 grader å gå på.",
    peikar: ["footR", "planR", "seatZ"],
  })

  // --- 4 navet -------------------------------------------------------------
  // Den harde grensa i heile typologien: blada kan ikkje møtast i sentrum.
  const need = (sh.angles.length * p.bladeT) / (Math.PI * 2)
  const hubOpen = openAt(sh, sh.rHub)
  add({
    id: "nav",
    label: "navet",
    hard: true,
    ok: hubOpen >= 0 && sh.rHub >= need,
    value: `radius ${mm1(sh.rHub)} mot ${mm1(need)} mm · fritt ${mm1(hubOpen)} mm`,
    why: "Tjueto blad på femten millimeter treng 22·15/2π = 52,5 mm radius berre for å stå ved sida av kvarandre. Den indre kanten vert klemd mot det talet og ikkje mot ein ynskjeverdi — er han mindre, finst ikkje objektet, det er berre teikna.",
    peikar: ["hubGap", "twist", "blades", "bladeT"],
  })

  // --- 5 vevdjupn ----------------------------------------------------------
  let web = Infinity
  for (const bl of g.blades) web = Math.min(web, bl.web)
  add({
    id: "vev",
    label: "vevdjupn",
    hard: true,
    ok: web >= WEB_MIN,
    value: `${mm1(web)} mm`,
    why: "Ribbene er ikkje smale lister, dei er djupe vevar. Under 24 millimeter mellom ytre og indre kant ber bladet korkje lasta eller lesinga: objektet vert ei lykt i staden for ein kropp.",
    peikar: ["waist", "inner", "hubGap", "planR"],
  })

  // --- 6 utnytting ---------------------------------------------------------
  add({
    id: "utnytting",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${mm(m.util * 100)} % · trykk ${nn(m.sigmaC, 2)} + bøying ${nn(m.sigmaM, 2)} MPa`,
    why: "Over 1,0 er lasta større enn materialet toler etter NS-EN 1995-1-1, og då er resten av teikninga likegyldig. Momentet kjem ikkje frå lasta, men frå at ribba ikkje er rett.",
    peikar: ["waist", "bladeT", "inner", "bandW"],
  })

  // --- 7 leddet ------------------------------------------------------------
  const lap = p.bandW - p.bandOut
  add({
    id: "ledd",
    label: "kryssholdt ledd",
    hard: true,
    ok: lap >= 12,
    value: `overlapp ${mm1(lap)} mm · ${mm1(lap / 2)} mm i kvar del`,
    why: "Kryssholdt er det einaste leddet i objektet. Overlappen er bandbreidda minus utstikket, og han vert delt i to. Under seks millimeter i kvar del er det ikkje eit ledd, det er to delar som ligg inntil kvarandre.",
    peikar: ["bandW", "bandOut"],
  })

  // --- 8 sporklaring -------------------------------------------------------
  add({
    id: "klaring",
    label: "sporklaring",
    hard: false,
    ok: p.fit >= 0.1 && p.fit <= 0.5,
    value: `${nn(p.fit, 2)} mm per side · ${nn(p.fit * 2, 2)} mm på sporbreidda`,
    why: "Finér på femten millimeter har toleranse ±0,5 mm. Klaringa skal liggja LÅGARE enn toleransen med vilje, slik at leddet må bankast saman og difor held utan lim; over ein halv millimeter held det ikkje av seg sjølv.",
    peikar: ["fit"],
  })

  // --- 9 avlasting ---------------------------------------------------------
  add({
    id: "avlasting",
    label: "avlasting i hjørna",
    hard: true,
    ok: p.relief > p.bit,
    value: `⌀${nn(p.relief, 1)} mot fres ⌀${nn(p.bit, 1)} mm`,
    why: "Ein fres kan ikkje lage eit skarpt innvendig hjørne. Er avlastinga ikkje større enn fresen, står radien hans att i hjørnet og delane vert ståande tre millimeter frå kvarandre — ti gonger klaringa.",
    peikar: ["relief", "bit"],
  })

  // --- 10 bandet ut --------------------------------------------------------
  add({
    id: "bandut",
    label: "bandet stikk ut",
    hard: false,
    ok: p.bandOut >= 8,
    value: `${mm1(p.bandOut)} mm forbi bladet`,
    why: "Ringane skal vera det ytste elementet: dei lagar silhuetten i si eiga høgd. Ligg dei i flukt med blada, vert sporet i bladet ståande fram som ei sagtann heile vegen rundt.",
    peikar: ["bandOut"],
  })

  // --- 11 opningane mellom blada -------------------------------------------
  const wide = openAt(sh, m.footX / 2)
  add({
    id: "opning",
    label: "opning mot bladtjukn",
    hard: false,
    ok: wide >= p.bladeT,
    value: `${mm1(wide)} mm mot ${mm1(p.bladeT)} mm`,
    why: "Talet på blad er det talet der opningane framleis er breiare enn bladet sjølv. Færre blad ser lettare ut men gjev grovare fasettar i silhuetten; fleire lukkar objektet.",
    peikar: ["blades", "bladeT", "planR"],
  })

  // --- 12 klemfare ---------------------------------------------------------
  const gaps = bandGaps(sh)
  const trapped = gaps.filter((v) => v >= TRAP_LO && v < TRAP_HI)
  add({
    id: "klemfare",
    label: "klemfare",
    hard: false,
    ok: trapped.length === 0,
    value: `minste luke ${mm1(Math.min(...gaps))} mm`,
    why: "Rommet mellom to band og to blad er ei lukka opning. Er ho mellom fem og tjuefem millimeter høg, tek ho ein finger og slepper han ikkje att; ho skal anten vera for trong til å koma inn i eller vid nok til å koma ut av.",
    peikar: ["bands", "bandZ0", "bandZ1", "bandT"],
  })

  // --- 13 setet på blada ---------------------------------------------------
  const needBlades = Math.ceil(sh.angles.length * 0.6)
  add({
    id: "setebaering",
    label: "setet ligg på blada",
    hard: true,
    ok: g.seat.onBlades >= needBlades,
    value: `${mm(g.seat.onBlades)} av ${mm(sh.angles.length)} blad`,
    why: "Setet har inga anna oppleiring enn toppen av blada. Bit halvmånen eller overhenget bort for mange av dei, er setet ei plate lagd over eit hol.",
    peikar: ["moon", "moonR", "lip"],
  })

  // --- 14 ei plate ---------------------------------------------------------
  const pl = buildParts(sh, g, MATERIALS[p.material].rho)
  const ns = nest(pl.parts)
  add({
    id: "plate",
    label: "ei plate",
    hard: false,
    ok: ns.sheets.length <= 1,
    value: `${mm(ns.sheets.length)} ark · ${mm(ns.util * 100)} % utnytting`,
    why: "Heile objektet skal koma ut av éi plate på 2500 × 1250 mm. Utnyttinga er låg fordi ringane er annulusar og hòlet i midten er avfall; det ærlege talet er kor mange plater jobben krev.",
    peikar: ["planR", "blades", "bandW", "bands"],
  })

  // --- 15 fotbogen ---------------------------------------------------------
  const arc = Math.min(p.footArc, sh.zBlade * 0.45)
  add({
    id: "fotboge",
    label: "fotbogen",
    hard: false,
    ok: arc >= 20 && arc <= sh.zBlade * 0.4,
    value: `${mm(arc)} mm opp mot navet · ${mm(m.contacts)} føter`,
    why: "Botnkanten stig innover mot navet, slik at objektet står på ytterendane. Utan bogen vert botnen ei vifte av vassrette kantar som svevar over golvet; går han forbi to femtedelar av høgda, er det ikkje lenger ein boge, det er ein skrå bladunderkant.",
    peikar: ["footArc", "seatZ"],
  })

  // --- 16 skåla mot setetjukna ---------------------------------------------
  add({
    id: "skal",
    label: "skåla i setet",
    hard: true,
    ok: p.dish <= p.seatT - 8,
    value: `${mm1(p.dish)} mm i ${mm1(p.seatT)} mm plate`,
    why: "Skåla er frest ned i setet frå oversida. Står det under åtte millimeter att under botnen av henne, er setet ikkje lenger ei plate med ei skål i, det er eit hol med ein kant rundt.",
    peikar: ["dish", "seatT"],
  })

  // --- plateutnytting (mjuk) -------------------------------------------------
  add({
    id: "plateutnytting",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.28,
    value: `${nn(m.sheetUtil * 100, 0)} %`,
    why: "Plata er ein del av objektet, òg den delen som vert til spon. Blad og band pakkar godt når planet er rundt og blada liknar kvarandre; under 28 prosent er det silhuetten som kastar arket, og det valet skal stå her.",
    peikar: ["planAsp", "waist", "bandW"],
  })

  return R
}
