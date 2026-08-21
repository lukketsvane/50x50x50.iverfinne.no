/**
 * BØYG — reglane.
 *
 * Fire av dei harde er typologien sine eigne, og dei er grunnen til at han
 * er ein eigen motor:
 *
 *   BØYERADIUS   ei plate som vert bøygd tettare enn faktoren tillèt,
 *                sprekk i pressa. Det er den eine grensa alt anna kretsar om.
 *   NESTINGA     skal som skjer gjennom kvarandre er ikkje eit møbel.
 *   DYBELEN      han må finne gods i KVART skal, med kantavstand.
 *   UTKRAGET     setet er ei tynn plate mellom to føter, og folden er der
 *                bøyinga fyrst gjev etter.
 */
import { CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { nest } from "../vaffel/nest"
import { bygg, soneR, type Bygg } from "./form"
import { dybelTal } from "./metrics"
import { buildParts } from "./parts"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

const SIT_LO = 380
const SIT_HI = 480
const KLEM_LO = 5
const KLEM_HI = 25

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b: Bygg = bygg(p)
  const pl = buildParts(b, p)
  const ns = nest(pl.parts)
  const dy = dybelTal(b, p)
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
    why: "Oppgåva er ein kube på 500 mm. Djupna er summen av to foldar og eit setelaup, og kvar fold kostar radien sin to gonger — det er difor bøyeradiusen og djupna er same skyvar sett frå to sider.",
  })

  // --- 2 sitjehøgda (hard) ---------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er skanna av fanen: det er høgda på den flata som til kvar tid ligg øvst, ikkje på eit punkt i ein parameter.`,
  })

  // --- 3 bøyeradius (hard) ---------------------------------------------------
  const krav = p.boyefaktor * p.plyT
  add({
    id: "boyeradius",
    label: "bøyeradius",
    hard: true,
    ok: b.minR >= krav - 0.01,
    value: `${nn(b.minR, 0)} mm mot ${nn(krav, 0)}`,
    why: `Ei finérplate sprekk når ho vert bøygd tettare enn nokre titals gonger tjukna si. Pressa er føresetnaden her: med vått lim og trykk får laga gli på kvarandre, og faktoren står på ${nn(p.boyefaktor, 1)}. Det inste skalet ligg rett på forma og er difor det som avgjer — kvart skal utanpå har ein større radius og har det lettare.`,
  })

  // --- 4 nestinga (hard) -----------------------------------------------------
  add({
    id: "nesting",
    label: "skala går klar",
    hard: true,
    ok: b.minGap >= 0.6,
    value: mm1(b.minGap),
    why: "To skal som skjer gjennom kvarandre er ikkje eit møbel. Skala er parallellkurver og held difor lufta si av seg sjølv — men vifta er ei VRIDING oppå, og ho et av lufta i den eine enden av skalet. Meir vifte krev meir klaring.",
  })

  // --- 5 dybelen finn gods (hard) --------------------------------------------
  add({
    id: "dybelgods",
    label: "dybelen i gods",
    hard: true,
    ok: b.feil.indexOf("dybel") < 0 && dy.kant >= 1.5 * p.pinnD,
    value: `${nn(dy.kant, 0)} mm kant`,
    why: `Dybelen er den einaste festen i heile møbelet, og han står i ${dy.plan} skjerplan. Han må treffe kvart einaste skal, og hòlet treng gods rundt seg: under halvanna diameter frå enden riv finéren ut i staden for å bera.`,
  })

  // --- 6 velting (hard) ------------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "NS-EN 1022. Det er halane som gjer arbeidet: dei ligg bakover og spriker, og kvar millimeter dei når lenger bak er ein millimeter meir vippearm. Ein kort hale under eit djupt sete er nett den feilen denne typologien inviterer til.",
  })

  // --- 7 utkraget (hard) -----------------------------------------------------
  add({
    id: "utkrag",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: `1600 N etter NS-EN 1728, delt på dei ${m.list.find((q) => q.id === "barande")?.value ?? 1} skala som ligg innanfor sitjebandet. Setet er ei tynn plate mellom to føter, og krona på tvers er det som gjer snittet til eit renne i staden for eit ark — utan henne held det ikkje.`,
  })

  // --- 8 hòltrykk i plata (hard) ---------------------------------------------
  add({
    id: "holtrykk",
    label: "hòltrykk",
    hard: true,
    ok: dy.sigmaH <= dy.capH,
    value: `${nn(dy.sigmaH, 1)} av ${nn(dy.capH, 0)} MPa`,
    why: "NS-EN 1995-1-1 (8.36): hòltrykkfastleiken i kryssfinér er 50·t^0,6·d^−0,3. Ein tynn dybel i ei tynn plate gjev lite lager, og då er det ikkje dybelen som ryk — det er hòlet som vert ovalt.",
  })

  // --- 9 klemfare (mjuk) -----------------------------------------------------
  const klem = p.klaring >= KLEM_LO && p.klaring < KLEM_HI
  add({
    id: "klemfare",
    label: "luft mellom skala",
    hard: false,
    ok: !klem,
    value: mm1(p.klaring),
    why: `Ei opning mellom ${KLEM_LO} og ${KLEM_HI} mm tek ein finger og slepper han ikkje att, og her er ho der ${Math.max(0, Math.round(p.skal) - 1)} gonger på rad. Anten skal fanen vera tett nok til at ingen finger kjem inn, eller open nok til at han kjem ut att.`,
  })

  // --- 10 rasling (mjuk) -----------------------------------------------------
  add({
    id: "rasling",
    label: "skala står stille",
    hard: false,
    ok: p.klaring >= 1.6,
    value: mm1(p.klaring),
    why: "Under halvannan millimeter er ikkje luft, det er toleranse. Skala kjem til å røre kvarandre i ein flekk og hoppe frå flekk til flekk når nokon set seg — ein krakk som klikkar. Anten skal dei bera på kvarandre heilt, eller gå heilt klar.",
  })

  // --- 11 sprett attende (mjuk) ----------------------------------------------
  add({
    id: "sprett",
    label: "sprett attende",
    hard: false,
    ok: p.sprett <= 5,
    value: `${nn(p.sprett, 1)}° · form ${nn(p.foldV + p.sprett, 0)}°`,
    why: `Eit skal slepper forma og rettar seg nokre grader ut att. Forma må difor overbøyast: skal folden stå på ${nn(p.foldV, 0)}°, må forma skjerast til ${nn(p.foldV + p.sprett, 0)}°. Over fem grader er spriket så stort at to skal ikkje kjem like ut av same press, og då finst det ikkje ei nesting lenger.`,
  })

  // --- 12 finéroppbygget (mjuk) ----------------------------------------------
  const lag = Math.round(p.plyT / p.finer)
  add({
    id: "oppbygg",
    label: "finérlag",
    hard: false,
    ok: lag % 2 === 1 && lag >= 5,
    value: `${lag} lag à ${nn(p.finer, 1)} mm`,
    why: "Eit balansert oppbygg har ULIKE tal lag, so kryssbindinga er symmetrisk om midtlaget — eit partal lag skeivar seg når trekket skiftar. Og under fem lag finst det ikkje nok kryss til at plata er kryssfinér i det heile.",
  })

  // --- 13 dybelen står rett (mjuk) -------------------------------------------
  add({
    id: "dybelvinkel",
    label: "dybelen står rett",
    hard: false,
    ok: dy.skeiv <= 12,
    value: `${nn(dy.skeiv, 1)}°`,
    why: "Dybelen er ei rett line gjennom ein bøygd stabel. Han står vinkelrett på det midtre skalet og skeivare og skeivare utover; over tolv grader er hòlet så ovalt at det må borast med mal og ikkje med hand.",
  })

  // --- 14 sitjeflate (mjuk) --------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 300,
    value: mm1(seatMin),
    why: "Under 300 mm på den korte leia sit ein på kanten. Djupna er skanna, ikkje sett: ho er den samanhengande strekninga der oversida ligg i toppbandet og er flatare enn 28 grader — resten er skråning.",
  })

  // --- 15 støtteflate (mjuk) -------------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 80000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Under 800 cm² står møbelet på for lite, same kva veltevinkelen seier. Saleskjeringa er skyvaren: ein ende kappa tvert av står på ein kant av finér, ein ende kappa i golvplanet ligg med heile flata si.",
  })

  // --- 16 plater (mjuk) ------------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: ns.sheets.length <= 3,
    value: `${ns.sheets.length} × 2500 × 1250`,
    why: "Blankettane er lange strimler og legg seg godt på plate, men dei er ikkje like: kvart skal utanpå det førre er lengre. Over tre plater er fanen for stor eller skala for breie til at det er ei kuttfil lenger.",
  })

  // --- 17 masse (mjuk) -------------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 11,
    value: `${nn(m.mass, 2)} kg`,
    why: "Ein pressbøygd krakk skal kunne lyftast med ei hand. Godset er tynt av natur her, so over elleve kilo tyder at skala er for mange eller for breie — ikkje at plata er for tjukk.",
  })

  // --- 18 forma (mjuk) -------------------------------------------------------
  // Forholdet mellom den YTSTE og den INSTE framfolden — same fold i same
  // form, berre med alle innlegga imellom.
  const fold = (i: number) => {
    const z = b.skal[i].soner.find((s) => s.id === "framfold")
    return z ? soneR(z) : 1
  }
  const spenn = fold(0) / Math.max(1, fold(b.skal.length - 1))
  add({
    id: "form",
    label: "éi form",
    hard: false,
    ok: spenn <= 2.6,
    value: `${nn(spenn, 2)} × frå inst til ytst`,
    why: "Alle skala kjem av same form med innlegg imellom. Vert det ytste skalet meir enn tre gonger så late i folden som det inste, ser dei ikkje lenger ut som same familie — og då er det to former og ikkje éi.",
  })

  // --- 19 materialet (mjuk) --------------------------------------------------
  add({
    id: "material",
    label: "materiale",
    hard: false,
    ok: p.material !== "poppel",
    value: MATERIALS[p.material as keyof typeof MATERIALS].label,
    why: "Poppelkjerne er lett, men han er òg mjuk i hòlet, og her går heile lasta gjennom éin dybel i eitt hòl per skal. Bjørk og bøk toler lageret.",
  })

  return out
}
