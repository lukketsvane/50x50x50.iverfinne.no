/**
 * LAFT — reglane.
 *
 * Reiskapen teiknar kva som helst, men han seier kva han har teikna, og
 * kva av det som ikkje kan byggjast eller ikkje kan sitjast på.
 *
 * FIRE av dei harde er særeigne for typologien, og dei er grunnen til at
 * han er ein eigen motor og ikkje ei innstilling:
 *
 *   · tappen må ha gods kring seg i setet — eit spor for nær kanten
 *     sprekk fyrste gongen nokon set seg,
 *   · tunga må vera brei nok til å bera BEGGE hakka og kilesporet,
 *   · kilen må få plass mellom bladene,
 *   · laftet må ha noko å lafte i: sporet ned i bladet kan ikkje vera
 *     djupare enn bladet er høgt der.
 *
 * Bryt éin av dei, ligg det fire plater på golvet og ikkje ein stol.
 */
import { CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { bygg } from "./profil"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

/** NS-EN 1729 for vaksne: setet skal liggje i dette bandet. */
const SIT_LO = 380
const SIT_HI = 500
/** Ei opning mellom fem og tjuefem millimeter tek ein finger. */
const TRAP_LO = 5
const TRAP_HI = 25
/** laftet i bladet er så djupt — sjå profil.ts */
const LAFT_DJUP = 34

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b = bygg(p)
  const out: Rule[] = []
  const add = (r: Rule) => out.push(r)
  const t = p.plyT

  // --- 1 kuben (hard) -----------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "står i kuben",
    hard: true,
    ok: big <= CUBE,
    value: `${mm1(big)} av ${CUBE}`,
    why: "Oppgåva er ein kube på 500 mm. LAFT er den einaste typologien som kan sprengje han med eit einaste tal, av di rygghøgda og setehøgda legg seg rett oppå kvarandre.",
    peikar: ["ryggH", "hogd", "framspark", "bakspark"],
  })

  // --- 2 sitjehøgda (hard) ------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. Talet er midt på den brukbare flata, ikkje framkanten — vippen gjer dei to ulike.`,
    peikar: ["hogd", "setevipp"],
  })

  // --- 3 sitjeflata (hard) ------------------------------------------------
  add({
    id: "sete",
    label: "sitjeflate",
    hard: true,
    ok: m.seatW >= 300 && m.seatD >= 260,
    value: `${nn(m.seatW, 0)} × ${nn(m.seatD, 0)} mm`,
    why: "Under 300 mm på tvers eller 260 i djupn er det ein pinne å sitje PÅ, ikkje ein stol. Djupna er målt fram til ryggen, ikkje til plata sin bakkant.",
    peikar: ["breidd", "djup"],
  })

  // --- 4 styrken (hard) ---------------------------------------------------
  add({
    id: "styrke",
    label: "1600 N på setet",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} % av kapasiteten`,
    why: "NS-EN 1728 på kontraktnivå. Setet er rekna som bjelke mellom bladene med utkraging, og det verste av «sit midt på» og «sit på kanten» gjeld. Over 100 % bøyer plata seg varig.",
    peikar: ["spenn", "plyT", "djup"],
  })

  // --- 5 veltevinkelen (hard) ---------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "Under femten grader vippar stolen når nokon lener seg. Sparket fram og bak er heile svaret — bladene er det einaste som står på golvet.",
    peikar: ["framspark", "bakspark"],
  })

  // --- 6 gods kring tappesporet (hard, typologisk) ------------------------
  const kantGods = p.breidd / 2 - p.spenn / 2 - (t + p.pressfit) / 2
  add({
    id: "tappgods",
    label: "gods kring tappesporet",
    hard: true,
    ok: kantGods >= 18,
    value: mm1(kantGods),
    why: "Sporet som tek tappen ligg i setet, og lasta går tvers gjennom det. Med under atten millimeter finér mellom sporet og plata sin eigen kant, riv tappen seg ut fyrste gongen nokon sit på kanten.",
    peikar: ["breidd", "spenn"],
  })

  // --- 7 tunga (hard, typologisk) -----------------------------------------
  const tungeGods = (p.ryggF - p.spenn - 2 * t) / 2
  add({
    id: "tunge",
    label: "tunga ber hakka",
    hard: true,
    ok: tungeGods >= 14,
    value: mm1(tungeGods),
    why: "Tunga under setet har eit hakk for kvart blad. Er ho ikkje brei nok til å ha gods UTANFOR begge hakka, er det ikkje ei tunge lenger — det er tre fingrar som knekk kvar for seg.",
    peikar: ["ryggF", "spenn"],
  })

  // --- 8 kilen (hard, typologisk) -----------------------------------------
  const kileGods = p.spenn / 2 - t / 2 - (t + p.pressfit) / 2
  add({
    id: "kilerom",
    label: "gods kring kilehòlet",
    hard: true,
    ok: kileGods >= 24,
    value: mm1(kileGods),
    why: "Kilehòlet står midt i tunga, hakka til bladene står ute ved kanten, og imellom må det vera finér. Kjem dei to for nær kvarandre, er tunga perforert på tvers akkurat der lasta går gjennom henne.",
    peikar: ["spenn"],
  })

  // --- 9 laftet (hard, typologisk) ----------------------------------------
  const bladHogd = b.seteUnder(b.delar.find((d) => d.kind === "rygg")!.plass.o[0])
  add({
    id: "laft",
    label: "laftet har botn",
    hard: true,
    ok: bladHogd > LAFT_DJUP + 40,
    value: `${mm1(bladHogd)} bladhøgd mot ${LAFT_DJUP} mm spor`,
    why: "Sporet ryggen lafter seg ned i er 34 mm djupt. Er bladet ikkje monaleg høgare enn det der ryggen kryssar, skjer sporet bladet av på tvers.",
    peikar: ["hogd", "bakspark"],
  })

  // --- 10 klemfare mellom rygg og sete (mjuk) -----------------------------
  // Ryggen lener seg bakover og opnar ei kile mot setet sin bakkant. Er
  // ho i fingerbandet, er ho ei felle; er ho vid, er ho eit hòl ein ser
  // gjennom, og det er greitt.
  const bakGap = Math.abs(b.xB - b.delar.find((d) => d.kind === "rygg")!.plass.o[0]) - t
  add({
    id: "klemfare",
    label: "opning bak setet",
    hard: false,
    ok: bakGap <= TRAP_LO || bakGap >= TRAP_HI,
    value: mm1(bakGap),
    why: `Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger og slepper han ikkje. Her er ho mellom ryggen og setet sin bakkant, og ho vert styrt av kor langt bak ryggen står.`,
    peikar: ["djup", "ryggV"],
  })

  // --- 11 bereholet (mjuk) -------------------------------------------------
  add({
    id: "berehol",
    label: "bereholet",
    hard: false,
    ok: p.grep === 0 || (p.grep >= 90 && p.ryggT - p.grep >= 84),
    value: p.grep === 0 ? "ikkje noko hòl" : `${nn(p.grep, 0)} mm i ${nn(p.ryggT, 0)} mm plate`,
    why: "Ei hand treng nitti millimeter. Og hòlet må ha gods kring seg: er det breiare enn plata minus åtti, er ryggen to smale stavar over eit hòl.",
    peikar: ["grep", "ryggT"],
  })

  // --- 12 plateutnyttinga (mjuk) ------------------------------------------
  add({
    id: "plate",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.4,
    value: `${nn(m.sheetUtil * 100, 0)} % · ${m.sheets} ${m.sheets === 1 ? "plate" : "plater"}`,
    why: "Prosenten er låg med vilje, og det er ikkje pakkaren sin skuld: fem delar fyller ikkje ei plate som er 2500 mm brei på tvers, og bandet vert betalt i full breidd same kor få delar som står i det. Det LAFT vinn er talet under — EITT band på kring ein kvadratmeter, mot to og tre plater hjå dei andre. Kjem han under 40 %, spriker forma so bandet vert høgare enn den høgaste delen treng.",
    peikar: ["djup", "breidd", "framspark"],
  })

  // --- 13 talet på delar (mjuk) -------------------------------------------
  add({
    id: "delar",
    label: "delar i alt",
    hard: false,
    ok: m.parts <= 5,
    value: `${m.parts} stk`,
    why: "Heile argumentet til typologien er at ein stol kan vera fire plater og ein kile. Går talet opp, er det ein annan typologi som svarar betre.",
  })

  // --- 14 foten (mjuk) -----------------------------------------------------
  add({
    id: "fot",
    label: "føter mot golvet",
    hard: false,
    ok: m.contacts >= 4,
    value: `${m.contacts} stk`,
    why: "Med fotboge har kvart blad to føter, og stolen står på fire punkt som eit møbel skal. Utan bogen står han på to lange kantar — det er stødig, men det vaggar på eit ujamnt golv.",
    peikar: ["fotboge"],
  })

  // --- 15 slankleiken i ryggen (mjuk) --------------------------------------
  const slank = p.ryggH / t
  add({
    id: "slank",
    label: "ryggen sin slankleik",
    hard: false,
    ok: slank <= 34,
    value: `${nn(slank, 0)} × tjukna`,
    why: "Ryggen er ei fri plate som stikk opp frå eitt einaste laft. Over fire og tretti gonger tjukna svaiar ho synleg når nokon lener seg — modellen reknar ikkje den svaien, so regelen står i staden.",
    peikar: ["ryggH", "plyT"],
  })

  // --- 16 materialet (mjuk) ------------------------------------------------
  add({
    id: "material",
    label: "materialet",
    hard: false,
    ok: true,
    value: MATERIALS[(p.material as keyof typeof MATERIALS) in MATERIALS ? (p.material as keyof typeof MATERIALS) : "bjork"].label,
    why: "Kapasitetane i tavla er karakteristiske verdiar for dette materialet, med kmod og materialfaktor etter NS-EN 1995-1-1.",
  })

  return out
}
