/**
 * STRAUM — reglane.
 *
 * Ein sandkasse som berre teiknar er ein demonstrasjon. Det som gjer han
 * til ein reiskap er at han seier nei: at eit tal på skjermen kan slå fast
 * at objektet ikkje let seg byggja, ikkje let seg sitja på, eller ikkje
 * lenger er svar på oppgåva.
 *
 * Ein hard regel er brot: objektet går utanfor kuben, veltar, eller kan
 * ikkje setjast saman. Ein mjuk regel er eit val — han kan stå, men den
 * som let han stå skal ha sett kva han kostar. Difor har kvar regel ei
 * grunngjeving og ikkje berre eit tal.
 *
 * Reglane les måla frå `metrics` der dei finst. Det som ikkje finst der —
 * kva finne som er halden i kva spor, kor smalt eit bein er i midja, kor
 * mykje material det står att mellom to spor — vert målt her, av di dei
 * tala berre gjev meining som ein terskel og ikkje som ei rad i ein tabell.
 */
import { CUBE, nn, type Metrics, type Rule } from "../core"
import { makeBody, type Body } from "./body"
import { buildParts, type Build } from "./parts"
import { nest } from "./nest"
import type { Params } from "./params"

const TAU = Math.PI * 2

/** fingerfella: ei opning i dette bandet tek ein finger og held han */
const TRAP_LO = 5
const TRAP_HI = 25

const mm = (v: number) => nn(v, 0)
const mm1 = (v: number) => nn(v, 1)

/**
 * Smalaste veggen der tomrommet er fullt opna. Nær kvar ende av tomrommet
 * er veggen så tjukk som heile kroppen, og det talet seier ingen ting;
 * difor vert berre den delen av høgda der innkilinga er over halvvegs
 * teken med.
 */
function wallMin(bd: Body): number {
  let best = Infinity
  const N = 40
  for (let j = 1; j < N; j++) {
    const z = bd.voidZ0 + ((bd.voidZ1 - bd.voidZ0) * j) / N
    for (let i = 0; i < 120; i++) {
      const th = (i / 120) * TAU
      const ro = bd.ro(th, z)
      const ri = bd.ri(th, z)
      if (ri < (ro - bd.p.veggT) * 0.5) continue
      const w = ro - ri
      if (w < best) best = w
    }
  }
  return Number.isFinite(best) ? best : 0
}

export function checkRules(p: Params, m: Metrics, pre?: { body?: Body; build?: Build }): Rule[] {
  const bd = pre?.body ?? makeBody(p)
  const B = pre?.build ?? buildParts(bd)
  const rules: Rule[] = []
  const add = (r: Rule) => rules.push(r)
  const cosA = bd.frame.cosA

  // sporbreidda i planet fell rett ut av skråstillinga og er ikkje skriven
  // inn nokon stad: ei plate som står 12° skrått treng eit spor som er
  // tjukna delt på cosinus til vinkelen, pluss pressfit
  const slotW = p.finneT / cosA + p.pressfit
  // lufta mellom to finnar, målt normalt på plana og ikkje vassrett
  const gap = bd.pitch * cosA - p.finneT
  // materialet som står att mellom to spor i sokkelen
  const web = bd.pitch - slotW

  // --- 1 kuben (hard) ------------------------------------------------------
  add({
    id: "kube",
    label: "kuben",
    hard: true,
    ok: Math.max(m.envX, m.envY, m.envZ) <= CUBE + 1e-6,
    value: `${mm1(m.envX)} × ${mm1(m.envY)} × ${mm1(m.envZ)} mm`,
    why: "Oppgåva er kuben, og eit objekt som ikkje går inn i han svarar ikkje lenger på henne — kor godt det elles måtte sitja.",
  })

  // --- 2 setehøgd (mjuk) ---------------------------------------------------
  add({
    id: "setehogd",
    label: "setehøgd",
    hard: false,
    ok: m.sitZ >= 380 && m.sitZ <= 480,
    value: `sit ${mm(m.sitZ)} · kant ${mm(m.seatZ)} mm`,
    why: "Setehøgda er der ein sit, ikkje der kanten står — på ein sal ligg dei tretti millimeter frå kvarandre. Under 380 mm pressar setet knea opp mot brystet, over 480 mm heng føtene i lause lufta; Stool 60 og Ulmer Hocker ligg begge på 440.",
    peikar: ["hogd", "salsokk", "sidesokk"],
  })

  // --- 3 veltevinkel (hard) ------------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${mm1(m.tipAngle)}° · arm ${mm(m.tipArm)} mm`,
    why: "Ein krakk som går rundt når nokon lener seg utover er farleg lenge før han er stygg. Vinkelen er rekna frå setehøgda og ikkje frå tyngdepunktet: lasta kjem inn ved setet, og ein person på 80 kg gjer krakken sine eigne kilo til avrunding.",
    peikar: ["fotB", "fotD", "hogd"],
  })

  // --- 4 kontaktflater mot golvet (hard) -----------------------------------
  add({
    id: "golv",
    label: "kontaktflater mot golvet",
    hard: true,
    ok: m.contacts === 1 || m.contacts >= 3,
    value: m.contacts === 1 ? "samanhengande sokkel" : `${mm(m.contacts)} flater`,
    why: "Sokkelen er ei heil skive og står stødig på eit kvart golv. Vert han delt i to av eit tomrom som når ned i han, vippar objektet same kor jamt golvet er — tre punkt legg eit plan, to gjer det ikkje.",
  })

  // --- 5 utnytting (hard) --------------------------------------------------
  add({
    id: "utnytting",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${mm(m.util * 100)} % · trykk ${nn(m.sigmaC, 2)} + bøying ${nn(m.sigmaM, 2)} MPa`,
    why: "Over 1,0 er lasta større enn materialet toler etter NS-EN 1995-1-1, og då er resten av teikninga likegyldig. Snittet er målt gjennom det som verkeleg ber — finnane med luft imellom — og ikkje gjennom kroppen som om han var massiv.",
    peikar: ["finneT", "midjeB", "midjeD", "finnar"],
  })

  // --- 6 samanheng frå sokkel til kappe (hard) -----------------------------
  const through = B.fins.filter((q) => q.holdLow && q.holdHigh).length
  add({
    id: "samanheng",
    label: "finnar heilt gjennom",
    hard: true,
    ok: through >= 3,
    value: `${mm(through)} av ${mm(B.fins.length)} går frå sokkel til kappe`,
    why: "Berre ei finne som står i sokkelen OG heng i kappa fører setelasta ned i golvet. Er dei færre enn tre, heng kappa på eit hengsle: dei korte finnane ved golvet og under setet er flens og ikkje berevegg, og objektet er to stykke som er limte saman i lufta.",
    peikar: ["midjeB", "midjeD", "skraa", "finnar"],
  })

  // --- 7 minste finnebreidd (mjuk) -----------------------------------------
  let narrow = Infinity
  for (const q of B.fins) narrow = Math.min(narrow, q.narrow)
  add({
    id: "finnebreidd",
    label: "smalaste beinet",
    hard: false,
    ok: Number.isFinite(narrow) && narrow >= 25,
    value: `${mm1(Number.isFinite(narrow) ? narrow : 0)} mm`,
    why: "Ei finne på ni millimeter som er smalare enn kring 25 mm på tvers knekk under tommelen når ho vert pressa ned i sporet sitt. Talet er målt utanom dei frie spissane, der kvar finne uansett går mot null.",
    peikar: ["veggT", "tomskyv", "midjeB", "midjeD"],
  })

  // --- 8 bein i midja (mjuk) -----------------------------------------------
  const split = B.fins.filter((q) => q.legs >= 2).length
  add({
    id: "bein",
    label: "bein i midja",
    hard: false,
    ok: split >= 2,
    value: `${mm(split)} delte finnar · ${mm(B.fins.reduce((a, q) => a + q.legs, 0))} bein`,
    why: "Tomrommet er det som deler kvar finne i to bein i midja, og det er dei to beina som gjer at forma vert lesen som ein kropp med ei midje i staden for som ein klump. Når inga finne vert delt, er kroppen massiv og tomrommet berre eit tal.",
    peikar: ["veggT", "midjeB", "midjeD"],
  })

  // --- 9 sporbreidd mot platetjukn (mjuk) ----------------------------------
  const plateT = Math.min(p.sokkelT, p.kappeT)
  add({
    id: "spor",
    label: "spor mot plate",
    hard: false,
    ok: plateT >= slotW,
    value: `${mm1(slotW)} mm i ei plate på ${mm1(plateT)} mm`,
    why: "Sporet er eit parallellogram og ikkje eit rektangel: finna står skrått, så breidda i planet er tjukna delt på cosinus til vinkelen. Er sporet breiare enn plata er tjukk, held det ikkje finna vinkelrett — det held henne berre på plass.",
    peikar: ["sokkelT", "kappeT", "finneT", "skraa"],
  })

  // --- 10 finnedeling mot fresediameter (hard) -----------------------------
  // Hard, ikkje mjuk: eit spor smalare enn fresen finst ikkje — det er
  // ikkje eit val ein kan stå for, det er ein del som ikkje kan skjerast.
  add({
    id: "fres",
    label: "material mellom spora",
    hard: true,
    ok: web >= p.fresD,
    value: `${mm1(web)} mm mot ein fres på ${mm1(p.fresD)} mm`,
    why: "To spor som står nærare kvarandre enn fresen er brei kan ikkje skjerast: verktøyet et opp heile stripa mellom dei, og sokkelen kjem ut av maskina som lause band.",
    peikar: ["finnar", "fresD", "finneT", "skraa"],
  })

  // --- 11 setebreidd (mjuk) ------------------------------------------------
  add({
    id: "setebreidd",
    label: "sitjeflate",
    hard: false,
    ok: m.seatW >= 300 && m.seatD >= 300,
    value: `${mm(m.seatW)} × ${mm(m.seatD)} mm`,
    why: "Tilrådd setebreidd med klede er 508–559 mm, og det er uråd inne i ein kube på 500. Skilnaden er ein eigenskap ved oppgåva og ikkje ved objektet; under 300 mm er det ikkje lenger eit sete, det er ein pinne.",
    peikar: ["seteB", "seteD", "kantR"],
  })

  // --- 12 klemfare (mjuk) --------------------------------------------------
  add({
    id: "klemfare",
    label: "klemfare mellom finnane",
    hard: false,
    ok: !(gap >= TRAP_LO && gap < TRAP_HI),
    value: `${mm1(gap)} mm`,
    why: "Ei opning mellom fem og tjuefem millimeter tek ein finger og slepper han ikkje att. Ho skal anten vera for trong til å koma inn i eller vid nok til å koma ut av — og med 24 finnar er ho der 23 gonger.",
    peikar: ["finnar", "finneT", "skraa"],
  })

  // --- 13 tal finnar (mjuk) ------------------------------------------------
  add({
    id: "finnetal",
    label: "tal finnar",
    hard: false,
    ok: B.fins.length <= 34,
    value: `${mm(B.fins.length)} stykke frå ${mm(bd.planes.length)} plan`,
    why: "Kvar finne er eit eige nummer, eit eige spor og ei eiga innsetjing. Over kring 34 stykke er monteringa ein halv dag i staden for ein halv time, og kvart stykke er ein sjanse til å setje feil finne i feil spor.",
    peikar: ["finnar", "skraa"],
  })

  // --- 14 platetal (mjuk) --------------------------------------------------
  const nst = nest(B.parts)
  add({
    id: "platetal",
    label: "plater",
    hard: false,
    ok: nst.sheets.length <= 4,
    value: `${mm(nst.sheets.length)} plater · utnytting ${mm((nst.used / (nst.sheets.length * 2440 * 1220)) * 100)} %`,
    why: "Emna let seg ikkje nesta tett same kva ein gjer — dei er store og krumme i begge endar. Over fire plater kostar objektet meir i avkapp enn i arbeid, og då er det talet på finnar som må ned.",
    peikar: ["finnar", "seteB", "seteD"],
  })

  // --- 15 veggen (mjuk) ----------------------------------------------------
  const wall = wallMin(bd)
  add({
    id: "vegg",
    label: "veggen kring tomrommet",
    hard: false,
    ok: wall >= 2 * p.finneT,
    value: `${mm1(wall)} mm mot ei finne på ${mm1(p.finneT)} mm`,
    why: "Veggen er det einaste som står att av kvar finne i midja. Er han tynnare enn to finnetjukner, er beinet ein tråd som knekk i limpressa lenge før nokon set seg på krakken.",
    peikar: ["veggT", "tomskyv", "finneT"],
  })

  // --- 16 kasta stykke (mjuk) ----------------------------------------------
  add({
    id: "kast",
    label: "kasta stykke",
    hard: false,
    ok: B.dropped <= B.fins.length,
    value: `${mm(B.dropped)} kasta · ${mm(B.fins.length)} står att`,
    why: "Der eit skiveplan går ut av kroppen vert skiva delt, og eit stykke som ikkje er festa korkje i sokkelen eller kappa vert kasta. Det er ein del av forma og ikkje ein feil — men kastar ein meir enn ein set inn, er det skråstillinga og ikkje uttrykket som styrer.",
    peikar: ["skraa", "finnar"],
  })

  // --- 17 tomrommet finst (mjuk) -------------------------------------------
  add({
    id: "tomrom",
    label: "tomrommet",
    hard: false,
    ok: bd.voidZ1 - bd.voidZ0 >= 60,
    value: `${mm(bd.voidZ0)} → ${mm(bd.voidZ1)} mm`,
    why: "Tomrommet vert klemt inn mellom sokkelen og kappa: eit tomrom som nådde ut i sporet ville dele finna i to lause delar. Vert det klemt heilt bort, er kroppen massiv — og då veg han halvanna kilo meir enn han treng.",
    peikar: ["tomFra", "tomTil", "hogd"],
  })

  // --- plateutnytting (mjuk) -------------------------------------------------
  add({
    id: "plateutnytting",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.22,
    value: `${nn(m.sheetUtil * 100, 0)} %`,
    why: "Finneemne nestar dårleg av natur — kring fjerdedelen av arket er eigenskapen til forma, ikkje til pakkinga. Under det att er det finnetalet og emnestorleiken som kastar, og det valet skal stå på papiret.",
    peikar: ["finnar", "seteB", "seteD"],
  })

  return rules
}
