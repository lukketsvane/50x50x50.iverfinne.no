/**
 * SKIVE — reglane.
 *
 * To av dei harde er særeigne for typologien og grunnen til at han er ein
 * eigen motor: silhuetten må vera EITT stykke (bogen får ikkje eta seg
 * gjennom setet), og stavane må finne gods i ALLE skivene — utan stavar
 * er møbelet ein bunke plater, ikkje eit møbel.
 */
import { CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { nest } from "../vaffel/nest"
import { buildSlices } from "./profile"
import { buildParts } from "./parts"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

const SIT_LO = 380
const SIT_HI = 480
const TRAP_LO = 5
const TRAP_HI = 25

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b = buildSlices(p)
  const pl = buildParts(p, b)
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
    why: "Oppgåva er ein kube på 500 mm. Skivene gjer rekninga gjennomsiktig: breidda er skiver gonger tjukn pluss luft, og kvar av dei tre er ein skyvar.",
    peikar: ["luft", "skiver", "plyT", "djup"],
  })

  // --- 2 sitjehøgda (hard) ---------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er middelet av flata ein faktisk sit på — gropa og sidefallet er rekna med.`,
    peikar: ["hogd", "grop", "setevipp", "sidefall"],
  })

  // --- 3 velting (hard) ------------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "NS-EN 1022. Vinkelen er målt frå der ein sit og ut til kanten av støtteflata; under tolv grader veltar møbelet av at nokon lener seg.",
    peikar: ["frambein", "luft", "bakflare", "hogd"],
  })

  // --- 4 styrke (hard) -------------------------------------------------------
  add({
    id: "styrke",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: "1600 N etter NS-EN 1728, delt på dei skivene som faktisk ligg under puta. Bøying i setebandet over bogen og trykk i beinet vert lagde saman mot NS-EN 1995-1-1.",
    peikar: ["bogeH", "plyT", "luft", "djup"],
  })

  // --- 5 silhuetten er eitt stykke (hard) ------------------------------------
  // Bogetoppen sit midt i spennet, so det er setet ved x = 0 bandet vert
  // rekna mot — og der har setevippen teke halve fallet sitt.
  const vippMidt = Math.tan((p.setevipp * Math.PI) / 180) * (p.djup / 2)
  const bandMin = m.seatZ - p.grop - p.sidefall - p.bogeH - vippMidt
  add({
    id: "heil",
    label: "silhuetten er eitt stykke",
    hard: true,
    ok: bandMin >= 30,
    value: mm1(bandMin),
    why: "Bogen under setet får ikkje eta seg gjennom setebandet. Under tretti millimeter gods mellom bogetoppen og den djupaste gropa finst det inga skive lenger — berre to bein som ikkje kjenner kvarandre.",
    peikar: ["bogeH", "hogd", "grop", "sidefall"],
  })

  // --- 6 stavane finn gods (hard) --------------------------------------------
  add({
    id: "stavar",
    label: "stavar i gods",
    hard: true,
    ok: b.rods.length >= 3,
    value: `${b.rods.length} av 3`,
    why: "Møbelet er skiver tredde på stavar — det finst ikkje lim mellom skivene. Ein stav treng gods med mon rundt hòlet i ALLE skivene, og morfen dreg dei ytste inn: det som er trygt midt i møbelet kan vera luft ytst.",
    peikar: ["stavD", "innsving", "vifte", "bogeH"],
  })

  // --- 6b vifta klarer seg (mjuk) --------------------------------------------
  // To naboskiver i vifta står i kvar sin vinkel og MØTEST eit stykke ute:
  // avstanden dit er gapet delt på vinkelskilnaden. Ligg møtet innanfor
  // skivene si eiga utstrekning, skjer platene kvarandre i lufta.
  {
    const n = Math.max(2, Math.round(p.skiver))
    const dAng = ((Math.abs(p.vifte) * 2) / Math.max(1, n - 1)) * (Math.PI / 180)
    let maxR = 0
    for (const q of b.slices[0]?.outline ?? []) maxR = Math.max(maxR, Math.abs(q[0]))
    const kryss = dAng > 1e-6 ? (p.plyT + p.luft) / Math.tan(dAng) : Infinity
    add({
      id: "vifte",
      label: "vifta klarer seg",
      hard: false,
      ok: kryss > maxR + 10,
      value: dAng > 1e-6 ? `møtest ${mm1(kryss)} ute` : "ikkje vift",
      why: "To naboskiver i vifta møtest der gapet er ete opp av vinkelen. Ligg møtet innanfor skivene si eiga utstrekning, skjer platene kvarandre — meir luft, færre skiver eller mindre vifte flyttar møtet ut i fri luft.",
      peikar: ["vifte", "luft", "skiver"],
    })
  }

  // --- 7 klemfare (mjuk) -----------------------------------------------------
  add({
    id: "klemfare",
    label: "luft mellom skivene",
    hard: false,
    ok: !(p.luft >= TRAP_LO && p.luft < TRAP_HI),
    value: mm1(p.luft),
    why: `Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger og slepper han ikkje att. Lufta skal anten vera for trong til å koma inn i eller vid nok til å koma ut av — og her er ho der ${Math.max(0, Math.round(p.skiver) - 1)} gonger på rad.`,
    peikar: ["luft"],
  })

  // --- 8 platetal (mjuk) -----------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: ns.sheets.length <= 2,
    value: `${ns.sheets.length} × 2500 × 1250`,
    why: "To plater er det ein får ut av eit standard ark utan å skøyte. Skivene er store, men dei er få — og annakvar er den same delen spegelvend.",
    peikar: ["skiver", "djup", "hogd"],
  })

  // --- 9 sitjeflate (mjuk) ---------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 320,
    value: mm1(seatMin),
    why: "Under 320 mm på den korte leia sit ein på kanten i staden for på setet. På tvers er talet heile skivebreidda — lufta tel med, slik ho gjer på ein benk av spiler.",
    peikar: ["djup", "luft", "skiver", "plyT"],
  })

  // --- 10 slankheit (mjuk) ---------------------------------------------------
  const slender = m.envZ / p.plyT
  add({
    id: "slank",
    label: "høgd mot skivetjukn",
    hard: false,
    ok: slender <= 75,
    value: nn(slender, 0),
    why: "Ei skive som er meir enn 75 gonger så høg som ho er tjukk vippar under handa på benken. I møbelet er ho halden av stavane, men ho skal òg kunne handterast før ho kjem dit.",
    peikar: ["plyT", "hogd", "ryggH"],
  })

  // --- 11 støtteflate (mjuk) -------------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 90000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Under 900 cm² står møbelet på for lite til at det kjennest trygt, same kva veltevinkelen seier — vinkelen måler den verste retninga, flata måler alle.",
    peikar: ["luft", "frambein", "bakbein", "skiver"],
  })

  // --- 12 masse (mjuk) -------------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 12,
    value: `${nn(m.mass, 2)} kg`,
    why: "Lufta mellom skivene er den innebygde letta i typologien: kvar millimeter luft er ein millimeter finér ingen betalar for og ingen ber på. Over tolv kilo er lufta skrudd for langt ned.",
    peikar: ["plyT", "skiver", "bogeH", "djup"],
  })

  // --- 13 unike delar (mjuk) -------------------------------------------------
  add({
    id: "unike",
    label: "unike delar",
    hard: false,
    ok: pl.ids.length <= Math.ceil(pl.parts.length / 2) + 1,
    value: `${pl.ids.length} av ${pl.parts.length}`,
    why: "Morfen er symmetrisk om midten, so skive i og spegelskiva hennar er same del. Fleire unike enn halvparten pluss éin tyder at symmetrien er broten ein stad han ikkje skulle vera.",
  })

  // --- 14 materialet (mjuk) --------------------------------------------------
  add({
    id: "material",
    label: "materiale",
    hard: false,
    ok: p.material !== "poppel",
    value: MATERIALS[p.material as keyof typeof MATERIALS].label,
    why: "Poppelkjerne er lett og billeg, men her ber kvar skive åleine på tvers av lufta — det finst inga naboplate å lene seg på før stavane. Bjørk og bøk toler det.",
  })

  // --- plateutnytting (mjuk) -------------------------------------------------
  add({
    id: "plateutnytting",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.23,
    value: `${nn(m.sheetUtil * 100, 0)} %`,
    why: "Plata er ein del av objektet, òg den delen som vert til spon. Skiver med djup grotte og høg boge let mest av arket liggja att som avfall — det er eit val, og det skal stå her og ikkje i hovudet.",
    peikar: ["bogeH", "bogefall"],
  })

  return out
}
