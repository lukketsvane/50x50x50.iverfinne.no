/**
 * KOTE — reglane.
 *
 * Fire av dei harde finst berre i denne typologien, og dei er grunnen
 * til at han er ein eigen motor og ikkje ein variant:
 *
 *   OVERHENG   ei plate som stikk ut over den under seg står på ingen ting
 *   STAVANE    kvar stav må finne gods i KVAR einaste kote, ikkje berre ei
 *   HOLET      opninga får ikkje snøre nokon kote ned til ein tråd
 *   KILA       ei kile kløyver det ho vert driven i om ho får høve
 *
 * Ein hard regel er brot: objektet går utanfor kuben, veltar, eller kan
 * ikkje setjast saman. Ein mjuk regel er eit val — han kan stå, men den
 * som let han stå skal ha sett kva det kostar.
 */
import {
  CUBE,
  GAMMA_M,
  KMOD,
  MATERIALS,
  nn,
  type Material,
  type Metrics,
  type Rule,
} from "../core"
import { nest } from "../vaffel/nest"
import { buildStack, hylseAv } from "./stack"
import { buildParts } from "./parts"
import { MEASURE_M } from "./metrics"
import type { Params } from "./params"

const mm = (v: number) => nn(v, 0) + " mm"
const mm1 = (v: number) => nn(v, 1) + " mm"

/** NS-EN 1729, vaksne */
const SIT_LO = 380
const SIT_HI = 480
/** fingerfella: ei opning i dette bandet tek ein finger og held han */
const TRAP_LO = 5
const TRAP_HI = 25

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b = buildStack(p, MEASURE_M)
  const pl = buildParts(p, b)
  const ns = nest(pl.parts)
  const out: Rule[] = []
  const add = (r: Rule) => out.push(r)

  // --- 1 kuben (hard) ------------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "står i kuben",
    hard: true,
    ok: big <= CUBE,
    value: `${mm1(big)} av ${CUBE}`,
    why: "Oppgåva er ein kube på 500 mm. Her er høgda ei rein sum: setehøgda pluss det staven står over setet pluss kilespissen — og kila er det billegaste av dei tre å gje frå seg.",
  })

  // --- 2 sitjehøgda (hard) -------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: `${mm(m.sitZ)} · kant ${mm(m.seatZ)}`,
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er middelet av skåla over den flata ein faktisk sit på, ikkje setekanten — mellom dei to ligg heile skåldjupna.`,
  })

  // --- 3 velting (hard) ----------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}° · arm ${mm(m.tipArm)}`,
    why: "NS-EN 1022. Vippearma går frå setesenteret ut til kanten av botnkotelina — ho ER støtteflata her, for stabelen står på ei heil plate og ikkje på bein. Under tolv grader veltar krakken av at nokon lener seg.",
  })

  // --- 4 styrke (hard) -----------------------------------------------------
  add({
    id: "styrke",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} % · trykk ${nn(m.sigmaC, 2)} + bøying ${nn(m.sigmaM, 2)} MPa`,
    why: "1600 N etter NS-EN 1728. Setet ber lasta mellom stavane i bøying, og stavane med hylsene fører henne ned gjennom kvart gap i trykk. Lagt saman mot NS-EN 1995-1-1; det styrande snittet ligg i LUFTA, ikkje i finéren.",
  })

  // --- 5 overheng (hard) ---------------------------------------------------
  // Kjelda står i verdien, ikkje berre talet: `utFlanke` er flanken åleine,
  // og skilnaden opp til `ut` er taket over opninga. Den som skal rette
  // eit overheng må vita kva for ein av dei to skyvarane som eig det.
  const fraHol = b.steg.ut - b.steg.utFlanke > 0.4
  add({
    id: "overheng",
    label: "overheng",
    hard: true,
    ok: b.steg.ut <= p.plyT,
    value: `${mm1(b.steg.ut)} av ${mm1(p.plyT)} · ${fraHol ? "taket over holet" : "flikinga"}`,
    why: "Ei plate som stikk lenger ut over den under seg enn ho sjølv er tjukk, er ein krage som bøyer seg før han ber: lasta går ned gjennom den søyla av gods dei to platene DELER, og stavane held berre kotene i line. Ein utstikk lik tjukna er den same 45°-linja ein murar kraga etter. Tre stader gjer det: flikinga over midja, taket over opninga — og vridinga, for ein lobetopp som har dreidd seg inn over ei hòl side på kota under står like mykje på ingen ting.",
  })

  // --- 6 stavane finn gods (hard) ------------------------------------------
  const treng = hylseAv(p.stavD) / 2 + 3
  add({
    id: "stavar",
    label: "stavane finn gods",
    hard: true,
    ok: b.klaring >= treng,
    value: `${mm1(b.klaring)} av ${mm1(treng)}`,
    why: "Staven står loddrett medan planet vrir seg og bita sveipar forbi. Han må ha hylsa si vidd pluss tre millimeter gods rundt seg i KVAR einaste kote — den trongaste avgjer, og det er som regel midja eller ein bitkant.",
  })

  // --- 7 holet deler ikkje stabelen (hard) ---------------------------------
  let hals = Infinity
  let kjerne = Infinity
  for (const q of b.plates) {
    if (q.hals < hals) hals = q.hals
    if (q.kjerne < kjerne) kjerne = q.kjerne
  }
  add({
    id: "holet",
    label: "holet deler ikkje stabelen",
    hard: true,
    ok: hals >= 90,
    value: `${mm(hals)} på det tynnaste`,
    why: "Bita får ete så mykje dei vil av kanten, men to bit rett imot kvarandre snører kotelina av på midten. Under nitti millimeter gjennom planet heng armane i ein tråd, og då er plata to delar som berre stavane held saman.",
  })

  // --- 8 kila (hard) -------------------------------------------------------
  // Slingringa er ein tjuandels millimeter: finare enn eit sagsnitt, og
  // difor ikkje ein skilnad nokon kan lage. Utan henne fell reine
  // likskapar — ei kile skoren nett so tjukk ho får lov — på feil side.
  const SNITT = 0.05
  const kileOk =
    p.kileB <= 0.4 * p.stavD + SNITT && 0.6 * p.kileH <= p.stavOver - 4 + SNITT
  add({
    id: "kila",
    label: "kila kløyver ikkje",
    hard: true,
    ok: kileOk,
    value: `${nn(p.kileB, 2)} av ${nn(0.4 * p.stavD, 2)} · ned ${mm(0.6 * p.kileH)} av ${mm(p.stavOver - 4)}`,
    why: "Kila spreier stavenden i sagsnittet. Er ho tjukkare enn to femdelar av staven, spreier ho han ikkje — ho kløyver han. Og går ho djupare ned enn stavenden står fri over setet, held sprekken fram nedi seteplata.",
  })

  // --- 9 skåla står i plata (hard) -----------------------------------------
  add({
    id: "skaal",
    label: "gods under skåla",
    hard: true,
    ok: p.skaal <= p.plyT - 5 + 0.05,
    value: `${mm1(p.plyT - p.skaal)} att av ${mm1(p.plyT)}`,
    why: "Skåla er frest ned i seteplata. Står det mindre enn fem millimeter finér att under det djupaste, er setet ikkje lenger ei plate med ei skål — det er ein ring med hòl i.",
  })

  // --- 10 trappa (mjuk) ----------------------------------------------------
  // Stiginga er tjukn pluss luft. Eit steg like langt som stiginga er høg
  // tyder ein flanke på nøyaktig 45°, og det er vippepunktet: brattare, og
  // stabelen les som ei side; slakare, og han les som ei trapp.
  const stiging = p.plyT + b.luft
  const trappOk = b.steg.flanke <= stiging && b.steg.snitt >= 1.2
  add({
    id: "trappa",
    label: "trappa",
    hard: false,
    ok: trappOk,
    value: `største ${mm1(b.steg.flanke)} av ${mm1(stiging)} · snitt ${mm1(b.steg.snitt)}`,
    why: `Steget frå kote til kote er platetjukna delt på fallet i flanken. Er steget lengre enn stiginga — tjukn pluss luft — fell flanken slakare enn 45°, og då er stabelen ikkje ei side lenger, men ei trapp med ${b.plates.length} trinn som kvart tek eit lår. Under 1,2 mm i snitt seier kvar kote det same som naboen, og då har du betalt for eit lag som ikkje teiknar noko. Steget vert lese UTANFOR bitvindauga: inne i opninga er det ingen flanke å ta eit lår på, og djupna der er sjølve motivet.`,
  })

  // --- 11 klemfare (mjuk) --------------------------------------------------
  const gapOpen = b.gaps.filter((g) => g > 0.4)
  const trap = gapOpen.some((g) => g >= TRAP_LO && g < TRAP_HI)
  add({
    id: "klemfare",
    label: "luft mellom platene",
    hard: false,
    ok: !trap,
    value: `${mm1(b.luft)} × ${gapOpen.length}`,
    why: `Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger og slepper han ikkje att. Lufta skal anten vera for trong til å koma inn i eller vid nok til å koma ut av — og her står ho ${gapOpen.length} gonger oppå kvarandre.`,
  })

  // --- 12 hylsa mot plata (mjuk) -------------------------------------------
  const hD = hylseAv(p.stavD)
  const bearArea =
    (b.stavar.length * Math.PI * (hD * hD - p.stavD * p.stavD)) / 4
  const sigma90 = 1600 / Math.max(1, bearArea)
  const cap90 = (MATERIALS[p.material as Material].fck * 0.2 * KMOD) / GAMMA_M
  add({
    id: "hylse",
    label: "hylsa mot plata",
    hard: false,
    ok: sigma90 <= cap90,
    value: `${nn(sigma90, 2)} av ${nn(cap90, 2)} MPa`,
    why: "Hylsa står på flatsida av finéren, og på tvers av planet toler kryssfinér kring ein femdel av det han toler i planet. Ei tynn hylse på ein tynn stav trykkjer seg ned i plata; ein tjukkare stav gjev breiare hylse og lågare trykk.",
  })

  // --- 13 sitjeflate (mjuk) ------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 320,
    value: `${mm(m.seatD)} × ${mm(m.seatW)}`,
    why: "Under 320 mm på den korte leia sit ein på kanten i staden for på setet. Talet er den ferdige seteplata sitt omriss — lobene tel med, for det er dei ein legg låret over.",
  })

  // --- 14 skåla og staven (mjuk) -------------------------------------------
  add({
    id: "skaalstav",
    label: "skåla klemmer ikkje staven",
    hard: false,
    ok: !b.skaal.kutta,
    value: b.skaal.kutta ? `kappa ${mm(b.skaal.bedt)} → ${mm(b.skaal.R)}` : mm(b.skaal.R),
    why: "Stavhòlet og kila står i seteplata der skåla vil vera. Bad du om ei større skål enn stavringen gjev rom for, er ho kappa her — og det er skålradien som skal seiast opp, ikkje stavane som skal flyttast inn.",
  })

  // --- 15 platetal (mjuk) --------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: ns.sheets.length <= 2,
    value: `${ns.sheets.length} × 2500 × 1250`,
    why: "To ark er det ein får ut av ei standard levering utan å skøyte. Kotene er store, men dei er flate og kviler tett i kvarandre sine bogar — ein pakkar som fylgjer konturen og ikkje omrisset ville løfta talet monaleg.",
  })

  // --- 16 masse (mjuk) -----------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 15,
    value: `${nn(m.mass, 2)} kg`,
    why: "Ein stabel av vassrette plan er den tyngste av typologiane: kvar kote er full flate, og lufta mellom dei er den einaste letta som finst. Over femten kilo ber ingen krakken med éi hand.",
  })

  // --- 17 støtteflate (mjuk) -----------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 55000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Botnkotelina er heile fotavtrykket. Under 550 cm² står krakken på for lite til at det kjennest trygt, same kva veltevinkelen seier — vinkelen måler den verste retninga, flata måler alle.",
  })

  // --- 18 materialet (mjuk) ------------------------------------------------
  add({
    id: "material",
    label: "materiale",
    hard: false,
    ok: p.material !== "poppel",
    value: MATERIALS[p.material as Material].label,
    why: "Heile lastvegen går gjennom hylsa si flate mot finéren og gjennom stavhòlet si vegg. Poppelkjerne er lett og billeg, men han krøller seg under eit punkttrykk på tvers av planet. Bjørk og bøk toler det.",
  })

  return out
}
