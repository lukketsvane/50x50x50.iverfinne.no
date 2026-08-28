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
import { bbox, CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { iKuben, stabel } from "./pakke"
import { buildParts } from "./parts"
import { bygg } from "./profil"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

/** NS-EN 1729 for vaksne: setet skal liggje i dette bandet. */
/**
 * NS-EN 1729 set 380 mm som botn for ei ARBEIDSHØGD. Denne typologien er
 * ein lounge — referansane hans er golvnære stolar — og i ein kube på
 * femhundre er kvar millimeter under arbeidshøgd ein millimeter rygg. Det
 * harde bandet går difor ned til 330, som er der ein framleis kjem seg
 * opp av stolen, og arbeidshøgda står att som ein MJUK regel som seier
 * frå kva ein har byta bort.
 */
const SIT_LO = 330
const SIT_HI = 500
const ARBEID_LO = 380
const ARBEID_HI = 470
/** Ei opning mellom fem og tjuefem millimeter tek ein finger. */
const TRAP_LO = 5
const TRAP_HI = 25
/** laftet i bladet er så djupt — sjå profil.ts */
const LAFT_DJUP = 34

export function checkRules(p: Params, m: Metrics): Rule[] {
  const b = bygg(p)
  const st = stabel(buildParts(p).parts)
  const stKube = iKuben(st)
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
    peikar: ["ryggH", "hogd", "fotX", "fotY"],
  })

  // --- 2 sitjehøgda (hard) ------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `Under ${SIT_LO} mm er det ikkje ein stol lenger — det er ei pute på golvet, og ein kjem seg ikkje opp av henne. Talet er midt på den brukbare flata, ikkje framkanten: vippen gjer dei to ulike.`,
    peikar: ["hogd", "setevipp"],
  })

  // --- 2b arbeidshøgda (mjuk) ---------------------------------------------
  add({
    id: "arbeidshogd",
    label: "arbeidshøgd",
    hard: false,
    // Regelen spør ikkje om sitjehøgda er låg. Han spør om ho er låg TIL
    // INGEN NYTTE. I ein kube på femhundre er kvar millimeter under
    // arbeidshøgd ein millimeter som kan bli rygg, og det er ein god
    // handel — men berre om ryggen faktisk fekk plassen.
    ok: (m.sitZ >= ARBEID_LO && m.sitZ <= ARBEID_HI) || p.ryggH >= 150,
    value: `${mm1(m.sitZ)} sete · ${nn(p.ryggH, 0)} mm rygg`,
    why: `NS-EN 1729 set ${ARBEID_LO}–${ARBEID_HI} mm for ein stol ein arbeider i. Under det er stolen ein lounge, og det er eit VAL — men eit val som skal betalast for: i ein halvmeters kube er kvar millimeter under arbeidshøgd ein millimeter rygg. Er setet lågt OG ryggen kort, er ingen ting vunne, og det er berre ein liten stol.`,
    peikar: ["hogd", "ryggH", "setevipp"],
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
    peikar: ["fotY", "plyT", "djup"],
  })

  // --- 5 veltevinkelen (hard) ---------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "Under femten grader vippar stolen når nokon lener seg. Fotavtrykket er heile svaret — dei fire føtene på kryssarmane er det einaste som står på golvet.",
    peikar: ["fotX", "fotY"],
  })

  // --- 6 gods kring tappesporet (hard, typologisk) ------------------------
  // Med kryss under kan ikkje dette reknast av eit spenn: tappane sit
  // ute på kvar sin arm, og kor mykje finér som står att utanfor dei er
  // eit reint AVSTANDSSPØRSMÅL i seteplata. Difor vert det målt, ikkje
  // rekna: minste avstand frå eit tappespor til kanten av setet.
  const sete = b.delar.find((d) => d.kind === "sete")!
  const tappHol = sete.holes.filter((h) => {
    const q = bbox(h)
    return q.x1 - q.x0 > t && q.y1 - q.y0 > t && Math.abs((q.y0 + q.y1) / 2) > 20
  })
  let kantGods = Infinity
  for (const h of tappHol) {
    for (const q of h) {
      let d = Infinity
      const ring = sete.outline
      for (let i = 0; i < ring.length; i++) {
        const a2 = ring[i]
        const c2 = ring[(i + 1) % ring.length]
        const vx = c2[0] - a2[0]
        const vy = c2[1] - a2[1]
        const L2 = vx * vx + vy * vy || 1
        const tt = Math.max(0, Math.min(1, ((q[0] - a2[0]) * vx + (q[1] - a2[1]) * vy) / L2))
        d = Math.min(d, Math.hypot(q[0] - a2[0] - vx * tt, q[1] - a2[1] - vy * tt))
      }
      kantGods = Math.min(kantGods, d)
    }
  }
  if (!Number.isFinite(kantGods)) kantGods = 0
  add({
    id: "tappgods",
    label: "gods kring tappesporet",
    hard: true,
    ok: kantGods >= 18,
    value: mm1(kantGods),
    why: "Sporet som tek tappen ligg i setet, og lasta går tvers gjennom det. Med under atten millimeter finér mellom sporet og plata sin eigen kant, riv tappen seg ut fyrste gongen nokon sit på kanten.",
    peikar: ["breidd", "fotY", "djup"],
  })

  // --- 7 tunga (hard, typologisk) -----------------------------------------
  const staveB = (p.ryggT - (p.ryggdel >= 1.5 ? p.ryggglipe : 0)) / (p.ryggdel >= 1.5 ? 2 : 1)
  // Tunga si djupn er IKKJE parameteren: ho er det geometrien gav.
  // Kryssarmane konvergerer mot midtlina, og ei tunge som lener seg
  // framover medan ho fell renn til slutt tom for rom. Difor melder
  // regelen kva ho faktisk vart, ikkje kva som vart bede om.
  const djup = Math.min(...b.tungeDjup)
  add({
    id: "tunge",
    label: "tunga rekk ned",
    hard: true,
    ok: djup >= 56,
    value: `${mm1(djup)} av ${nn(p.tunge, 0)} bedne`,
    why: "Tunga er det einaste som held ryggen, og kilen skal ha gods under setet å klemme mot. Kryssarmane tek rommet frå henne di lenger ned ho kjem — med mykje lening, lang tunge eller delt rygg renn ho tom, og under femtiseks millimeter er det ikkje ei tunge lenger, det er ein stubb som ikkje held nokon ting.",
    peikar: ["tunge", "ryggV", "ryggdel", "fotY"],
  })

  // --- 8 kilen skal ikkje treffe bladene (hard, typologisk) ---------------
  // Kilen står i midtplanet; bladene ligg på armane og er difor lenger
  // og lenger frå midten di lenger fram ein kjem. Det som avgjer er kor
  // langt kilen står frå næraste arm.
  const kilar = b.delar.filter((d) => d.kind === "kile")
  const kileGods = Math.min(
    ...kilar.map((k) => b.tilBlad(k.plass.o[0], k.plass.o[1] - t / 2) - t),
  )
  add({
    id: "kilerom",
    label: "kilen klar av armane",
    hard: true,
    ok: kileGods >= 16,
    value: mm1(kileGods),
    why: "Kilen vert driven fram gjennom tunga i midtplanet, og kryssarmane skjer same rommet på skrå. Møtest dei, kan ikkje kilen slåast inn — og det oppdagar ein fyrst med delane i handa.",
    peikar: ["fotY", "ryggV", "djup"],
  })

  // --- 9 krysshalvinga (hard, typologisk) ---------------------------------
  const overlapp = b.kryssTopp - b.kryssBotn
  add({
    id: "laft",
    label: "krysshalvinga har botn",
    hard: true,
    ok: overlapp >= 44,
    value: `${mm1(overlapp)} overlapp`,
    why: "Dei to blada deler overlappet mellom seg: halve hakket i kvar. Er overlappet mindre enn førtifire millimeter, står kvart blad att med under tjueto — og eit hakk som er djupare enn godset er eit brot, ikkje eit ledd.",
    peikar: ["bogeH", "hogd"],
  })

  // --- 10 klemfare mellom rygg og sete (mjuk) -----------------------------
  // Ryggen lener seg bakover og opnar ei kile mot setet sin bakkant. Er
  // ho i fingerbandet, er ho ei felle; er ho vid, er ho eit hòl ein ser
  // gjennom, og det er greitt.
  const bakGap = Math.abs(b.xB - b.xRygg) - t
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
    ok: p.grep === 0 || (p.grep >= 88 && staveB - p.grep >= 40),
    value:
      p.grep === 0
        ? "ikkje noko hòl"
        : `${nn(p.grep, 0)} mm i ${nn(staveB, 0)} mm ${p.ryggdel >= 1.5 ? "stav" : "plate"}`,
    why: "Ei hand treng åttiåtte millimeter. Målet er mot STAVEN og ikkje mot heile ryggen: med to stavar har kvar sitt hòl, og det er staven som må ha gods kring sitt. Under tjue millimeter på kvar side er det ikkje ein bere, det er to fingrar som knekk.",
    peikar: ["grep", "ryggT", "ryggdel"],
  })

  // --- 12 plateutnyttinga (mjuk) ------------------------------------------
  add({
    id: "plate",
    label: "plateutnytting",
    hard: false,
    ok: m.sheetUtil >= 0.34,
    value: `${nn(m.sheetUtil * 100, 0)} % · ${m.sheets} ${m.sheets === 1 ? "plate" : "plater"}`,
    why: "Prosenten er låg med vilje, og det er ikkje pakkaren sin skuld: fem delar fyller ikkje ei plate som er 2500 mm brei på tvers, og bandet vert betalt i full breidd same kor få delar som står i det. Det LAFT vinn er talet under — EITT band på kring ein kvadratmeter, mot to og tre plater hjå dei andre. Målt over rommet ligg han på 30 nedst, 37 i midten og 46 på det beste — fire prosentpoeng lågare enn før midja, av di eit blad med innsving tek same bandhøgda og mindre av bandet. Under 34 spriker forma so bandet vert høgare enn den høgaste delen treng.",
    peikar: ["djup", "breidd", "hjorne"],
  })

  // --- 13 talet på delar (mjuk) -------------------------------------------
  add({
    id: "delar",
    label: "delar i alt",
    hard: false,
    ok: m.parts <= 7,
    value: `${m.parts} stk`,
    why: "Heile argumentet til typologien er at ein stol kan vera fire plater og ein kile. Delt rygg gjer det til sju — to stavar og ein kile til kvar, og det er eit VAL med ein grunn — to smale stavar toler fiberretninga betre enn éi brei plate med eit hòl i. Går talet over sju, er det ein annan typologi som svarar betre.",
  })

  // --- 14 pakken i kuben (hard) --------------------------------------------
  // Oppgåva gjev éi grense, og ho gjeld ikkje berre den reiste stolen.
  // Eit flatpakka møbel har to former, og den andre er bunten. Referansane
  // gjer bunten til eit objekt med mål; her vert han målt mot den SAME
  // kuben. Det er den einaste grensa ein pakke kan bryte, og den einaste
  // regelen i motoren som ser på ein ENKELT del si lengd — kuberegelen
  // over måler den samansette stolen og slepp gjennom eit blad på sju
  // hundre millimeter utan å blunke.
  add({
    id: "pakke",
    label: "pakken i kuben",
    hard: true,
    ok: stKube !== "nei",
    value:
      `${nn(st.L, 0)} × ${nn(st.B, 0)} × ${nn(st.D, 0)} mm` +
      (stKube === "beint" ? "" : stKube === "på skrå" ? " · på skrå" : " · UTANFOR"),
    why: "Krysshalvinga gjer at det lengste emnet er heile diagonalen i fotavtrykket — 2·√(fotX² + fotY²) — og han er alltid lenger enn sida i fotavtrykket sjølv. Ein stol som står i kuben kan difor ha ein pakke som ikkje gjer det. Ei plate får plass i kuben anten beint fram, eller lagd på skrå: eit rektangel på lengd × tjukn står i eit kvadrat på 500 når lengd + tjukn ≤ 707. Bit regelen, er det kryssvinkelen og ikkje setet som skal gje seg.",
    peikar: ["fotX", "fotY", "plyT"],
  })


  // --- 15 foten (mjuk) -----------------------------------------------------
  add({
    id: "fot",
    label: "føter mot golvet",
    hard: false,
    ok: m.contacts >= 4,
    value: `${m.contacts} stk`,
    why: "Med fotboge har kvart blad to føter, og stolen står på fire punkt som eit møbel skal. Utan bogen står han på to lange kantar — det er stødig, men det vaggar på eit ujamnt golv.",
    peikar: ["bogeH"],
  })

  // --- 16 slankleiken i ryggen (mjuk) --------------------------------------
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

  // --- 17 materialet (mjuk) ------------------------------------------------
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
