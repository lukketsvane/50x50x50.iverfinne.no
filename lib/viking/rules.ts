/**
 * VIKING — reglane.
 *
 * FIRE av dei harde er særeigne for typologien, og dei er grunnen til at
 * han er ein eigen motor og ikkje ei innstilling:
 *
 *   · lappen må vera brei nok til å halde ein nagle — ein lapp utan nagle
 *     er eit hengsle, og eit skrog av hengsler er ein bunke bord,
 *   · kvart bord må nå BEGGE spanta, elles heng det i eitt punkt,
 *   · bordet må tole å verte sete på mellom spanta — det er plateflata i
 *     bøying, og det er den eine staden heile typologien kan ryke,
 *   · og skalet må vera eit skal: ligg borda for bratt, sit du ikkje i
 *     ein båt, du sit i ei renne.
 *
 * Og éin mjuk regel er typologien sitt eige dilemma. Krumminga bur i
 * vinkelen mellom borda, men den same vinkelen opnar ei GLIPE i lappen —
 * og ei opning mellom fem og tjuefem millimeter tek ein finger. Fleire
 * bord gjev mindre vinkel og mindre glipe; færre gjev meir av begge. Det
 * er den einaste staden i sandkassen der talet på delar er ein
 * komfortparameter.
 */
import { bbox, CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { byggSkrog } from "./skrog"
import { byggDelar } from "./parts"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

const SIT_LO = 330
const SIT_HI = 500
const TRAP_LO = 5
const TRAP_HI = 25

export function checkRules(p: Params, m: Metrics): Rule[] {
  const out: Rule[] = []
  const add = (r: Rule) => out.push(r)
  const sk = byggSkrog(p)
  const { delar } = byggDelar(p)
  const t = p.plyT

  // --- 1 kuben (hard) -----------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "står i kuben",
    hard: true,
    ok: big <= CUBE,
    value: `${mm1(big)} av ${CUBE}`,
    why: "Oppgåva er ein kube på 500 mm. VIKING har eit skrog som er ei samanhengande kurve frå golvet og opp, og han vert lang før han vert høg: det er lengda som bit fyrst.",
    peikar: ["djup", "stamn", "ryggH"],
  })

  // --- 2 sitjehøgda (hard) ------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `Botnen i skåla skal liggje mellom ${SIT_LO} og ${SIT_HI} mm. Han er ikkje det same som setekanten: skåla er heile komforten i denne typologien, og du sit i botnen av henne.`,
    peikar: ["hogd", "skaal"],
  })

  // --- 3 styrken (hard) ---------------------------------------------------
  add({
    id: "styrke",
    label: "toler 1600 N",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: "Lasta går ikkje ned ein platekant her, ho bøyer ei plateFLATE mellom to spant. Spennet er avstanden mellom spanta, og bøyespenninga veks med kvadratet av han — difor er `spantavstand` ein styrkeskyvar og ikkje ein plasseringsskyvar.",
    peikar: ["spantY", "plyT", "bord"],
  })

  // --- 4 velting (hard) ---------------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "Skroget lener seg attover og tyngdepunktet fylgjer med. Under femten grader vippar møbelet når nokon lener seg.",
    peikar: ["fotH", "stamn", "ryggV"],
  })

  // --- 5 lappen må halde ein nagle (hard, typologisk) ---------------------
  add({
    id: "lappgods",
    label: "nagle i lappen",
    hard: true,
    ok: p.lapp >= t * 0.62 + 20,
    value: `${mm1(p.lapp)} av ${mm1(t * 0.62 + 20)}`,
    why: "Naglen går gjennom begge borda i lappen, og han treng gods på begge sider av seg langs bordet. Kravet er difor naglen si eiga breidd — 0,62 platetjukner — pluss ti millimeter gods på kvar side. Under det sprekk lappen langs fiberen fyrste gongen nokon set seg, og ein lapp utan nagle er ikkje eit ledd, det er eit hengsle.",
    peikar: ["lapp", "plyT"],
  })

  // --- 6 kvart bord må nå begge spanta (hard, typologisk) ----------------
  const n = sk.knute.length - 1
  let smalast = Infinity
  for (let i = 0; i <= n; i++) smalast = Math.min(smalast, sk.halvB(i / n))
  const treng = sk.spantY + t / 2 + 8
  add({
    id: "spanttak",
    label: "borda når spanta",
    hard: true,
    ok: smalast >= treng,
    value: `${mm1(smalast)} av ${mm1(treng)}`,
    why: "Skroget svingar inn mot endane, og spanta står på ein fast avstand. Svingar han for mykje, rekk ikkje bordet i stamnen fram til spantet — og då heng det i det eine, som ei fjør. Anten må svingen ned eller spanta inn.",
    peikar: ["sving", "spantY", "breidd"],
  })

  // --- 7 sitjeflata (hard) ------------------------------------------------
  add({
    id: "sete",
    label: "sitjeflate",
    hard: true,
    ok: m.seatW >= 300 && m.seatD >= 250,
    value: `${nn(m.seatW, 0)} × ${nn(m.seatD, 0)} mm`,
    why: "Skroget må ha nok bord som ligg flatt nok til at ein kropp får plass. Vert skåla for djup eller stamnen for bratt, er det ikkje eit sete lenger — det er ei renne.",
    peikar: ["breidd", "djup", "skaal"],
  })

  // --- 8 klemfare i lappen (mjuk, og typologien sitt dilemma) ------------
  const glipe = m.list.find((q) => q.id === "lappGlipe")?.value ?? 0
  const lappV = m.list.find((q) => q.id === "lappV")?.value ?? 0
  add({
    id: "klemfare",
    label: "glipe i lappen",
    hard: false,
    ok: glipe < TRAP_LO || glipe > TRAP_HI,
    value: `${mm1(glipe)} ved ${nn(lappV, 0)}°`,
    why: `Krumminga bur i vinkelen mellom borda, og den same vinkelen opnar lappen i ytterkanten. Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger. Det er berre to vegar ut, og båe kostar: FLEIRE bord gjev mindre vinkel og lukkar glipa, eller ein LENGRE lapp gjer henne så brei at ho ikkje lenger er ei klemme. Dette er den eine staden i sandkassen der talet på delar er eit komfortval.`,
    peikar: ["bord", "lapp", "skaal"],
  })

  // --- 9 skalet er ei flate (mjuk, typologien sitt argument) -------------
  const seteA = m.list.find((q) => q.id === "seteA")?.value ?? 0
  const dekning = m.seatW * m.seatD > 0 ? seteA / (m.seatW * m.seatD) : 0
  add({
    id: "flate",
    label: "skalet er ei flate",
    hard: false,
    ok: dekning >= 0.72,
    value: `${nn(dekning * 100, 0)} % dekt`,
    why: "Heile argumentet til typologien er at du sit på plateFLATA og ikkje på kanten — at flata er LUKKA. Fell dekninga, er borda så smale eller så bratte at det som ligg under kroppen er luft, og då er VIKING vorten ein dyrare måte å gjere det dei fire andre gjer.",
    peikar: ["bord", "sving", "skaal"],
  })

  // --- 10 plateutnyttinga (mjuk) -----------------------------------------
  add({
    id: "plate",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.34,
    value: `${nn(m.sheetUtil * 100, 0)} % · ${m.sheets} ${m.sheets === 1 ? "plate" : "plater"}`,
    why: "Borda er lange og smale og pakkar godt; spanta er store og krumme og pakkar dårleg. Talet ligg difor midt imellom, og det er spanta som styrer det.",
    peikar: ["bord", "spantB", "fotH"],
  })

  // --- 11 føtene (mjuk) ---------------------------------------------------
  add({
    id: "fot",
    label: "føter mot golvet",
    hard: false,
    ok: m.contacts >= 4,
    value: `${m.contacts} stk`,
    why: "Kvart spant står på to føter, so møbelet står på fire punkt. Utan fothøgd står skroget rett på golvet, og det er stødig, men då er det ein slede og ikkje ein stol.",
    peikar: ["fotH"],
  })

  // --- 12 materialet (mjuk) ----------------------------------------------
  add({
    id: "material",
    label: "materialet",
    hard: false,
    ok: true,
    value: MATERIALS[(p.material as keyof typeof MATERIALS) in MATERIALS ? (p.material as keyof typeof MATERIALS) : "bjork"].label,
    why: "Kapasitetane i tavla er karakteristiske verdiar for dette materialet, med kmod og materialfaktor etter NS-EN 1995-1-1.",
  })

  void delar
  void bbox
  return out
}
