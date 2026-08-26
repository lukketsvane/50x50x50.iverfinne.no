/**
 * VAFFEL — reglane.
 *
 * Reiskapen nektar ikkje å teikne. Han teiknar kva som helst, men han seier
 * kva han har teikna, og kva av det som ikkje kan byggjast eller ikkje kan
 * sitjast på.
 *
 * `hard` tyder at objektet bryt oppgåva eller ikkje kan setjast saman. Ein
 * mjuk regel er eit val, og eit val skal stå på papiret i staden for i
 * hovudet på den som gjorde det.
 *
 * Tre av dei harde er særeigne for typologien, og dei er grunnen til at han
 * er ein eigen motor og ikkje ei innstilling: ribba må vera EITT stykke,
 * ho må ha minst to ledd, og fresen må koma ned i sporet. Bryt éin av dei,
 * ligg det ein haug med finér på golvet og ikkje ein krakk.
 */
import { CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { makeBody } from "./body"
import { buildGrid } from "./ribs"
import { buildParts } from "./parts"
import { nest } from "./nest"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

/** NS-EN 1729 for vaksne: setet skal liggje i dette bandet. */
const SIT_LO = 380
const SIT_HI = 480
/** Ei opning mellom fem og tjuefem millimeter tek ein finger. */
const TRAP_LO = 5
const TRAP_HI = 25

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b = makeBody(p)
  const g = buildGrid(b)
  const pl = buildParts(g, p.material as MaterialKey)
  const ns = nest(pl.parts)
  const out: Rule[] = []
  const add = (r: Rule) => out.push(r)

  // --- 1 kuben (hard) --------------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "står i kuben",
    hard: true,
    ok: big <= CUBE,
    value: `${mm1(big)} av ${CUBE}`,
    why: "Oppgåva er ein kube på 500 mm. Planet vert klemt ned til han av seg sjølv, så denne regelen skal aldri slå ut — gjer han det, er det innpassinga som er broten og ikkje forma.",
  })

  // --- 2 sitjehøgda (hard) ---------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er ikkje setekanten, men middelet av flata ein faktisk kviler på — gropa er rekna med.`,
  })

  // --- 3 velting (hard) ------------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "NS-EN 1022. Vinkelen er målt frå der ein sit og ut til kanten av støtteflata; under tolv grader veltar krakken av at nokon lener seg.",
  })

  // --- 4 styrke (hard) -------------------------------------------------------
  add({
    id: "styrke",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: "1600 N etter NS-EN 1728, mot kapasiteten i NS-EN 1995-1-1 med kmod 0,80 og materialfaktoren 1,20. Bøying i bandet over kvelvinga og trykk i beinet vert lagde saman.",
  })

  // --- 5 ribba er eitt stykke (hard) -----------------------------------------
  const split = g.ribs.filter((r) => r.outlines.length > 1)
  add({
    id: "heil",
    label: "kvar ribbe er eitt stykke",
    hard: true,
    ok: split.length === 0,
    value: split.length ? `${split.length} delte` : "alle heile",
    why: "Bit midja djupare enn ribba er brei, eller går kvelvinga gjennom botnen hennar, fell ribba frå kvarandre i lause bitar. Kvar bit ville stå i kuttlista som ein eigen del og henge i naboen sin — det er ikkje eit møbel, det er ein feil som let seg kutte.",
  })

  // --- 6 kvar ribbe har grep (hard) ------------------------------------------
  const loose = g.ribs.filter((r) => r.slots.length < 2)
  add({
    id: "grep",
    label: "ledd per ribbe",
    hard: true,
    ok: loose.length === 0,
    value: loose.length ? `${loose.length} med under to` : `minst ${Math.min(...g.ribs.map((r) => r.slots.length))}`,
    why: "Ei ribbe med eitt ledd kan svinge om det leddet, og ei med null ligg berre inntil. Rutenettet held seg sjølv av di kvar plate er låst i minst to andre — det finst ikkje ein skrue i møbelet.",
  })

  // --- 7 gods over sporet (hard) ---------------------------------------------
  const narrow = Math.min(...g.ribs.map((r) => r.narrow))
  add({
    id: "sporgods",
    label: "gods ved djupaste sporet",
    hard: true,
    ok: Number.isFinite(narrow) && narrow >= 20,
    value: mm1(Number.isFinite(narrow) ? narrow : 0),
    why: "Halve overlappet vert skore bort i kvar ribbe. Står det under tjue millimeter att ved det djupaste sporet, knekk ribba i leddet når nokon set seg — og leddet er den staden lasta faktisk går gjennom.",
  })

  // --- 8 fresen kjem ned i sporet (hard) -------------------------------------
  const slotW = p.ribbT + p.pressfit
  add({
    id: "fres",
    label: "fresen i sporet",
    hard: true,
    ok: p.fresD <= slotW,
    value: `${nn(p.fresD, 1)} mot ${nn(slotW, 2)} mm`,
    why: "Sporet er så breitt som ribba pluss pressfiten. Er fresen breiare enn det, finst ikkje sporet — det vert eit vidare spor, og leddet held ingenting.",
  })

  // --- 9 klemfare (mjuk) -----------------------------------------------------
  const gap = Math.min(g.gapX, g.gapY)
  add({
    id: "klemfare",
    label: "opning mellom ribber",
    hard: false,
    ok: !(gap >= TRAP_LO && gap < TRAP_HI),
    value: mm1(gap),
    why: `Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger og slepper han ikkje att. Ho skal anten vera for trong til å koma inn i eller vid nok til å koma ut av — og i eit rutenett er ho der i to retningar samstundes.`,
  })

  // --- 10 platetal (mjuk) ----------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: ns.sheets.length <= 2,
    value: `${ns.sheets.length} × 2500 × 1250`,
    why: "To plater er det ein får ut av eit standard ark utan å skøyte. Over det byrjar prosjektet å koste transport i staden for material.",
  })

  // --- 11 setebreidd (mjuk) --------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 320,
    value: mm1(seatMin),
    why: "Under 320 mm på den korte leia sit ein på kanten i staden for på setet. Talet er lese av kvar ribbene faktisk ber, ikkje av planet.",
  })

  // --- 12 slankheit (mjuk) ---------------------------------------------------
  const slender = m.envZ / p.ribbT
  add({
    id: "slank",
    label: "høgd mot ribbetjukn",
    hard: false,
    ok: slender <= 75,
    value: nn(slender, 0),
    why: "Ei plate som er meir enn 75 gonger så høg som ho er tjukk vippar under handa når ho står åleine på benken. I rutenettet er ho avstiva, men ho skal òg kunne handterast før ho kjem dit.",
  })

  // --- 13 støtteflate (mjuk) -------------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 90000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Under 900 cm² står krakken på for lite til at han kjennest trygg, same kva veltevinkelen seier — vinkelen måler den verste retninga, flata måler alle.",
  })

  // --- 14 masse (mjuk) -------------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 12,
    value: `${nn(m.mass, 2)} kg`,
    why: "Eit rutenett er tungt: kvar ribbe går heilt ned til golvet, og det er atten av dei. Over tolv kilo er det ikkje lenger ein krakk ein flyttar med éi hand, og det er prisen typologien tek.",
  })

  // --- 15 unike delar (mjuk) -------------------------------------------------
  add({
    id: "unike",
    label: "unike delar",
    hard: false,
    ok: pl.ids.length <= pl.parts.length * 0.85,
    value: `${pl.ids.length} av ${pl.parts.length}`,
    why: "Er kvar del ulik, er kvar del ei eiga oppspenning. Eit symmetrisk plan speglar halve rutenettet inn i den andre halva og halverer talet — det er den einaste staden i motoren der symmetri er verdt pengar.",
  })

  // --- 16 materialet (mjuk) --------------------------------------------------
  add({
    id: "material",
    label: "materiale",
    hard: false,
    ok: p.material !== "poppel",
    value: MATERIALS[p.material as MaterialKey].label,
    why: "Poppelkjerne er lett og billeg, men ei ribbe på 7,5 mm i poppel toler ikkje at nokon dreg krakken etter éi ribbe. Bjørk og bøk gjer det.",
  })

  // --- 17 plateutnytting (mjuk) ----------------------------------------------
  add({
    id: "plateutnytting",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.24,
    value: `${nn(m.sheetUtil * 100, 0)} %`,
    why: "Plata er ein del av objektet, òg den delen som vert til spon. Under fjerdedelen av arket i delar er eit val som skal stå på papiret: færre, breiare ribber pakkar betre enn mange smale med høg boge.",
  })

  return out
}

type MaterialKey = keyof typeof MATERIALS
