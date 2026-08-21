/**
 * KARVE — reglane.
 *
 * Tre av dei harde finst berre i denne typologien, og dei er grunnen til
 * at han er ein eigen motor:
 *
 *   FRESEN NÅR IKKJE INN. Ein treakses fres har eit skaft. Heng setet ut
 *   over eit bein, ligg det luft mellom dei to som korkje passet ovanfrå
 *   eller passet nedanfrå kjem til, og lufta vert ståande som gods. Det
 *   er DET som avgrensar kor langt midja kan snørast under eit breitt
 *   sete — ikkje styrken, ikkje kuben.
 *
 *   SVINN. Blokken er limt opp av heile plater og betalt for. Alt som
 *   ikkje er møbel er spon.
 *
 *   SNITTET ETTER FRESEN. Blokken er sterk. Det er halsen og beina som
 *   står att som ber, og båe er resultat av kva som er teke vekk.
 */
import { CUBE, nn, type Metrics, type Rule } from "../core"
import { ekstra } from "./metrics"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"
const pct = (v: number) => nn(v * 100, 1) + " %"

const SIT_LO = 380
const SIT_HI = 480
/** kor mykje innestengt gods handslipinga kan nå inn og berge */
const STENGD_MAX = 0.02
const SVINN_MAX = 0.62

export function checkRules(p: Params, m: Metrics): Rule[] {
  const e = ekstra(p)
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
    why: "Oppgåva er ein kube på 500 mm. Her er han òg emnet sitt yttermål: blokken kan ikkje vera større enn det ferdige objektet, og plateomrisset er difor det same talet.",
  })

  // --- 2 sitjehøgda (hard) ---------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er arealvekta over den midtre skiva av setet, so salen og kjølen tel med slik dei verkeleg dreg ned.`,
  })

  // --- 3 velting (hard) ------------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "NS-EN 1022. Vinkelen går frå der ein sit ut til kanten av støtteflata. Fotputene er små her — dei er det einaste av blokken som aldri vart frest — og støtteflata er hylsteret mellom dei, ikkje summen av dei.",
  })

  // --- 4 styrke (hard) -------------------------------------------------------
  add({
    id: "styrke",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: "1600 N etter NS-EN 1728. Trykk i det smalaste vassrette snittet og bøying i beinet vert lagde saman mot NS-EN 1995-1-1. Bøyinga kjem av at det sveipa beinet ikkje ligg på trykklina mellom halsen og fotputa — eit rakare bein har mindre av henne.",
  })

  // --- 5 fresen når inn (hard) ----------------------------------------------
  add({
    id: "fres",
    label: "fresen når inn",
    hard: true,
    ok: e.k.stengdDel <= STENGD_MAX,
    value: `${pct(e.k.stengdDel)} innestengt · beinet ${nn(e.vriAvvik, 0)}° frå kjervet`,
    why: `Fresen kjem ovanfrå og har skaft. Emnet vert snudd og køyrt frå begge sider, og alt som ligg mellom det øvste og det nedste materialet i same planpunkt er utanfor rekkjevidd. Over ${nn(STENGD_MAX * 100, 0)} % er det ikkje lenger noko handslipinga kan berge. Midjeinnhogget er det som lagar rommet, og beinvrien er det som avgjer kor stort det vert: står beinet i kjervet mellom lobane, heng ikkje setet ut over det.`,
  })

  // --- 6 svinn (hard) --------------------------------------------------------
  add({
    id: "svinn",
    label: "svinn frå emnet",
    hard: true,
    ok: e.svinn <= SVINN_MAX,
    value: pct(e.svinn),
    why: `Emnet er ${nn(e.emneV / 1e6, 1)} dm³ limt opp av heile plater; objektet er ${nn(m.volume / 1e6, 1)} dm³. Resten er spon. Over ${nn(SVINN_MAX * 100, 0)} % karvar ein bort meir enn ein lagar, og då er det grovkuttet — ikkje forma — som er feil: sagmon og emneform er dei to skyvarane som betalar.`,
  })

  // --- 7 sitjeflate (mjuk) ---------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 320,
    value: mm1(seatMin),
    why: "Under 320 mm på den korte leia sit ein på kanten i staden for på setet. Talet er omrisset av det som ligg over halve spranget frå midja til toppen — altså sjølve setekroppen, ikkje lobetuppane åleine.",
  })

  // --- 8 halsen (mjuk) -------------------------------------------------------
  add({
    id: "hals",
    label: "halsen etter fresen",
    hard: false,
    ok: m.minSecArea >= 5200,
    value: `${nn(m.minSecArea / 100, 0)} cm² i ${nn(m.minSecZ, 0)} mm`,
    why: "Det smalaste vassrette snittet i lastvegen — som regel halsen over midja, men på eit møbel med små putar er det putene sjølve. Under 52 cm² er snittet slankt nok til at ein tørkesprekk gjennom éi limfuge er heile snittet, og limfugene ligg nett på tvers av lasta her.",
  })

  // --- 9 beinsnittet (mjuk) --------------------------------------------------
  add({
    id: "bein",
    label: "beinsnitt",
    hard: false,
    ok: e.sn.beinA >= 2200,
    value: `${nn(e.sn.beinA / 100, 0)} cm² i ${nn(e.sn.beinZ, 0)} mm`,
    why: "Snittet i eitt bein, målt vassrett etter fresing. Under 22 cm² står beinet att som ein flis av blokken, og ein flis av kryssfinér med fuga på tvers er det svakaste ein kan lage av eit sterkt materiale.",
  })

  // --- 10 kotetettleik (mjuk) -----------------------------------------------
  add({
    id: "kotetett",
    label: "koteavstand",
    hard: false,
    ok: e.kote.snitt >= 11 && e.kote.snitt <= 86,
    value: `${mm1(e.kote.snitt)} i snitt`,
    why: "Avstanden mellom to limfuger målt langs flata er platetjukna delt på sinus til helninga: på ein loddrett flanke er ho nøyaktig éi plate, på ei vassrett flate går ho mot uendeleg. Under elleve millimeter i snitt les skinna som ein tekstur og ikkje som lag; over 86 er det for få liner att til å teikne forma i det heile.",
  })

  // --- 11 naken skinn (mjuk) -------------------------------------------------
  add({
    id: "naken",
    label: "naken skinn",
    hard: false,
    ok: e.kote.naken <= 0.3,
    value: pct(e.kote.naken),
    why: "Der flata ligg nesten vassrett spenner éi plate over meir enn 110 mm, og laga syner ikkje. Setemidten og fotputene er dei to stadene det alltid skjer; vert dei meir enn tre tidelar av skinna, er heile grunnen til å lime opp ein blokk borte.",
  })

  // --- 12 kjølen (mjuk) ------------------------------------------------------
  add({
    id: "kjol",
    label: "kjølen etter fresen",
    hard: false,
    ok: e.kjolTap <= 3,
    value: `${mm1(e.kjolTap)} borte`,
    why: "Ein kulefres med radius R kan ikkje lage ei renne som krummar skarpare enn R. Krumminga i botnen av kjølen er 4,6 · djup / halvbreidd², og er ho for skarp, kjem fresen ikkje ned: det som står att er ei grunnare renne enn den som vart teikna. Ein mindre fres eller ein breiare kjøl får henne heilt ned.",
  })

  // --- 13 limfuga på tvers (mjuk) --------------------------------------------
  add({
    id: "limfuge",
    label: "limfuge mot beinakse",
    hard: false,
    ok: e.fugeVinkel >= 34,
    value: `${nn(e.fugeVinkel, 0)}°`,
    why: "Limfugene ligg vassrett; lasta går langs beinet. Står beinet bratt, vert fuga presst saman, og då er ho sterkare enn veden. Legg beinet seg ned mot 30 grader, går lasta i staden som skuv langs fuga — og rullskjer i finérstrukturen er det svakaste snittet i heile plata.",
  })

  // --- 14 føter (mjuk) -------------------------------------------------------
  add({
    id: "foter",
    label: "føter mot golvet",
    hard: false,
    ok: m.contacts >= 3,
    value: `${m.contacts} stk`,
    why: "Kvelvinga under møbelet skil beina frå kvarandre. Når ho ikkje golvet mellom to bein, står objektet på ein sokkel i staden for på føter, og då vaklar det på kvart golv som ikkje er heilt plant.",
  })

  // --- 15 støtteflate (mjuk) -------------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 90000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Under 900 cm² står møbelet på for lite til at det kjennest trygt, same kva veltevinkelen seier — vinkelen måler den verste retninga, flata måler alle.",
  })

  // --- 16 masse (mjuk) -------------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 16,
    value: `${nn(m.mass, 2)} kg`,
    why: "Eit karva møbel er massivt: her er det ingen luft mellom lag og ingen hòl å spare vekt i, av di eit hòl er ein stad fresen måtte nå inn. Det ein kan gjere er å ta rommet UNDER møbelet — høgare kvelv, springet lenger inn — og over seksten kilo er det den vegen å gå, for då ber ein han ikkje med éi hand lenger.",
  })

  // --- 17 plater (mjuk) ------------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: e.sheets <= 4,
    value: `${e.sheets} × 2500 × 1250`,
    why: "Kvart lag er ei heil plate ut av arket, og dei er store: eit lag frå midt i setet fyller nesten ein halv kvadratmeter. Fire ark er det ein hentar i ein tur.",
  })

  // --- 18 lagtal (mjuk) ------------------------------------------------------
  add({
    id: "lag",
    label: "lag i blokken",
    hard: false,
    ok: e.lag >= 12 && e.lag <= 46,
    value: `${e.lag} lag`,
    why: "Under tolv lag er blokken ein stabel klossar, og kotene vert til brede band i staden for linjer. Over førtiseks er det for mange fuger til å få jamt trykk i éi pressing — då må blokken limast i bolkar, og kvar bolk er ei ny skøyt å halde rett.",
  })

  return out
}
