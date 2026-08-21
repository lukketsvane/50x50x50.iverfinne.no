/**
 * KOTE — stabelen slik han vert bygd.
 *
 * Kroppen i `plan.ts` er ei glatt form. Her vert han SKOREN: vassrette
 * plan med fast tjukn, luft imellom, tredde på loddrette stavar med
 * hylser i gapa og låste med kile øvst. Plata er kutta av ark, so
 * kanten hennar står LODDRETT gjennom heile tjukna — planet vert lese
 * ved plata si midthøgd, og det er nett difor stabelen får trappa si.
 *
 * Tre ting vert avgjorde her og ingen annan stad:
 *   platetalet   luftgapet er ynskt, platetalet fell ut av det
 *   stavane      kvar dei kan stå so dei finn gods i KVAR einaste plate
 *   skåla        kor stor ho kan bli før ho et seg inn i stavhòla
 */
import { keep, type Pt } from "../core"
import { edgeDist, inPoly, makeKropp, nth, type Kropp } from "./plan"
import type { Params } from "./params"

const TAU = Math.PI * 2

/** minste og største platetal — under fire er det ikkje ein stabel, over
 *  åtteogtjue er kvar plate tynnare enn snittbreidda til fresen */
const N_LO = 4
const N_HI = 28

// =============================================================================
// PLATETALET
// =============================================================================
/**
 * Høgda er gjeven, tjukna er gjeven, gapet er ynskt — og då er platetalet
 * eit heiltal som fell ut av dei tre. Det verkelege gapet vert rekna
 * attende av det heiltalet, so toppen av stabelen står NØYAKTIG i
 * setehøgda: tre reglar les den høgda, og ein stabel som bommar med ein
 * halv gapshøgd bommar på alle tre.
 *
 * Sokkelen er dei nedste gapa lukka til null: foten vert ein massiv
 * kloss i staden for ein stabel, og krakken får ei brei, tung rot.
 */
export function stackTal(hogd: number, plyT: number, luft: number, sokkel: number) {
  let s = Math.max(0, Math.round(sokkel))
  let n = Math.round((hogd + (1 + s) * luft) / (plyT + luft))
  n = Math.max(N_LO, Math.min(N_HI, n))
  s = Math.min(s, n - 2)
  // Gapet kan ikkje bli negativt: får ikkje tjukna plass, må plater vike.
  while (n > N_LO && hogd - n * plyT < 0.8 * Math.max(1, n - 1 - s)) {
    n--
    s = Math.min(s, n - 2)
  }
  const open = Math.max(1, n - 1 - s)
  const luftEff = Math.max(0, (hogd - n * plyT) / open)
  return { n, sokkel: s, luft: luftEff }
}

/** det gapet som gjev nøyaktig dette platetalet — reparasjonen treng det */
export function luftFor(hogd: number, plyT: number, n: number, sokkel: number): number {
  const s = Math.min(Math.max(0, Math.round(sokkel)), n - 2)
  return (hogd - n * plyT) / Math.max(1, n - 1 - s)
}

// =============================================================================
// DELANE
// =============================================================================
export type Plate = {
  i: number
  /** underkant og overkant, mm */
  z0: number
  z1: number
  /** midthøgda — DET er kotelina plata er kutta etter */
  zm: number
  outline: Pt[]
  holes: Pt[][]
  /** netto areal, mm² */
  area: number
  /** minste radius i planet, mm */
  kjerne: number
  /** minste gjennomkorde: r(θ) + r(θ+π) på det tynnaste */
  hals: number
}

export type Stav = { x: number; y: number; ang: number }

export type Ring = { r0: number; r1: number; z: number }

export type Skaal = {
  /** verkeleg radius etter at stavhòla har teke sitt, mm */
  R: number
  /** radius slik skyvaren bad om han, mm */
  bedt: number
  /** vart ho kappa av stavane? */
  kutta: boolean
  /** verkeleg djupn etter at platetjukna har teke sitt, mm */
  djup: number
  ringar: Ring[]
}

export type Build = {
  p: Params
  k: Kropp
  H: number
  /** platetal */
  n: number
  /** verkeleg gap, mm */
  luft: number
  /** kor mange nedste gap som er lukka */
  sokkel: number
  /** gapa i rekkjefylgje, mm */
  gaps: number[]
  plates: Plate[]
  stavar: Stav[]
  /** stavringen sin radius, mm */
  rho: number
  /** hylsa si ytre vidd, mm */
  hylseD: number
  /** minste gods kring ein stav i nokon plate, mm */
  klaring: number
  skaal: Skaal
  /** trappa: steget i planet frå kote til kote */
  steg: { ut: number; utFlanke: number; flanke: number; snitt: number }
  /** munnen på opninga: klar høgd og breidd, og kva høgd ho står i */
  munn: { h: number; b: number; z: number }
}

const BYGG_HUGS = keep<Build>(4)

export function buildStack(p: Params, m: number): Build {
  return BYGG_HUGS(JSON.stringify(p) + "|" + m, () => buildStackRaw(p, m))
}

/** hylsa er staven pluss fem millimeter gods kvar side — ei tynnare hylse
 *  sprekk når kila strammar stabelen */
export const hylseAv = (stavD: number) => stavD + 10

/** stavhòlet som tolvkant, MED KLOKKA — hòl går motsett veg av konturen */
function stavHol(s: Stav, r: number): Pt[] {
  const ring: Pt[] = []
  for (let i = 11; i >= 0; i--) {
    const a = (i / 12) * TAU
    ring.push([s.x + r * Math.cos(a), s.y + r * Math.sin(a)])
  }
  return ring
}

function buildStackRaw(p: Params, m: number): Build {
  const k = makeKropp(p)
  const H = k.H
  const st = stackTal(p.hogd, p.plyT, p.luft, p.sokkel)
  const n = st.n
  const N = nth(p, m)

  // --- høgdene ------------------------------------------------------------
  const gaps: number[] = []
  for (let i = 0; i < n - 1; i++) gaps.push(i < st.sokkel ? 0 : st.luft)
  const z0: number[] = []
  let z = 0
  for (let i = 0; i < n; i++) {
    z0.push(z)
    z += p.plyT + (gaps[i] ?? 0)
  }
  const zm = z0.map((q) => q + p.plyT / 2)

  // --- kotelinene ---------------------------------------------------------
  const outlines = zm.map((q) => k.plan(q, N))

  // --- trappa og overhenget -----------------------------------------------
  // Steget vert lese på ei FAST vinkeloppløysing og ikkje på detaljnivået:
  // overheng er ein regel, og ein regel som svarar ulikt på lav og høg
  // detalj er ikkje ein regel.
  //
  // Dei to tala er ikkje det same målt to gonger:
  //
  //   ut      største steg UTOVER, kvar som helst i planet. Ei plate som
  //           veks utanfor den under seg heng over, og over eit hol heng
  //           ho over ingenting. Difor tel biten med her.
  //   flanke  største steg der stabelen har ei SAMANHENGANDE SIDE — altså
  //           utanfor bitvindauga. Inne i biten er det ikkje ein flanke,
  //           det er ei opning, og djupna der er sjølve motivet. Ei hylle
  //           kan berre ta eit lår der det er ei side å ta det på.
  const NS = 72
  let ut = 0
  let utFlanke = 0
  let flanke = 0
  let sum = 0
  let tel = 0
  for (let i = 0; i + 1 < n; i++) {
    let worst = 0
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * TAU
      const d = k.r(th, zm[i + 1]) - k.r(th, zm[i])
      if (d > ut) ut = d
      // Vindauget vert lese i BEGGE høgdene: eit steg med biten open i
      // berre den eine er munnen på opninga og ikkje ein flanke. Men
      // vindauget er berre KVAR biten ville verka — han må gangast med
      // djupna for å seie om han verkar i det heile. Utan den ganginga
      // ville ein krakk heilt utan opning framleis ha eit stykke av
      // kanten sin rekna som «inne i holet», og då stod flanken der med
      // eit overheng ingen av spakane hadde lov å røre.
      const inne =
        k.bit(zm[i]) * k.vindu(th, zm[i]) > 0.004 ||
        k.bit(zm[i + 1]) * k.vindu(th, zm[i + 1]) > 0.004
      if (inne) continue
      if (d > utFlanke) utFlanke = d
      if (Math.abs(d) > worst) worst = Math.abs(d)
    }
    if (worst > flanke) flanke = worst
    sum += worst
    tel++
  }
  // `ut` og `utFlanke` skil dei to kjeldene til overheng frå kvarandre:
  // flikinga over midja, som er ein FLANKE, og taket over opninga, som er
  // ein krage. Reparasjonen må vita kva for ein av dei som er den bindande
  // — å stramme flikinga når det er holet som heng, gjer objektet mindre
  // utan å røre feilen.
  const steg = { ut, utFlanke, flanke, snitt: tel ? sum / tel : 0 }

  // --- munnen på opninga ---------------------------------------------------
  // Kor stort holet er, lese som eit vindauge ein ser gjennom: høgda er
  // det spennet der biten står djupare enn halve djupna si, og breidda er
  // korda over munnen der han er vidast. Det er dei to tala ein oppgjev
  // når ein skal seie kor stor opninga i krakken er.
  let munnH0 = Infinity
  let munnH1 = -Infinity
  let munnB = 0
  if (p.holhogd >= 8 && p.holdjup > 0 && p.holtal >= 1) {
    const halv = 0.5 * p.holdjup
    for (let s = 0; s <= 160; s++) {
      const z = (s / 160) * H
      if (k.bit(z) < halv) continue
      if (z < munnH0) munnH0 = z
      if (z > munnH1) munnH1 = z
      // korda mellom dei to skuldrene: dit biten sluttar å verke
      const b = k.bitar[0] + k.vri(z)
      const hb = Math.max(4, p.holbreidd) * (Math.PI / 180)
      const ra = k.r(b - hb, z)
      const rb = k.r(b + hb, z)
      const w = Math.hypot(
        ra * Math.cos(b - hb) - rb * Math.cos(b + hb),
        ra * Math.sin(b - hb) - rb * Math.sin(b + hb),
      )
      if (w > munnB) munnB = w
    }
  }
  const munn = {
    h: Number.isFinite(munnH0) && munnH1 > munnH0 ? munnH1 - munnH0 : 0,
    b: munnB,
    z: Number.isFinite(munnH0) ? (munnH0 + munnH1) / 2 : 0,
  }

  // --- stavane ------------------------------------------------------------
  // Staven står LODDRETT i verda medan planet vrir seg under han. Han må
  // difor finne gods i KVAR einaste kotelinje, og den trongaste avgjer for
  // alle: midja, eller ein bitkant som sveipar forbi under vridinga.
  //
  // Det som vert søkt er kor langt UT ringen kan liggje. Stavane ber ikkje
  // last i seg sjølve — dei held kotene i line — og ein smal stavtrekant
  // held ein brei stabel like dårleg som eit smalt bein held eit breitt
  // bord. Difor er målet størst mogleg ρ, og godset kring staven er kravet
  // som avgrensar han. (Ei tidlegare utgåve maksimerte godset i staden;
  // det er om lag likt for kvar fase, so heile søket avgjorde seg på ein
  // tidels millimeter støy og la stavringen midt i krakken.)
  const ns = Math.max(2, Math.round(p.stavar))
  const hylseD = hylseAv(p.stavD)
  const treng = hylseD / 2 + 3

  /** godset kring ein heil stavring ved radien ρ: den knappaste av alle */
  const godsVed = (fase: number, rr: number): number => {
    let kl = Infinity
    for (let s = 0; s < ns; s++) {
      const ang = fase + (s * TAU) / ns
      const x = rr * Math.cos(ang)
      const y = rr * Math.sin(ang)
      for (let i = 0; i < n; i++) {
        if (!inPoly(outlines[i], x, y)) return -1
        const d = edgeDist(outlines[i], x, y)
        if (d < kl) kl = d
        if (kl <= 0) return 0
      }
    }
    return kl
  }

  /**
   * Største lovlege ρ for éin fase. Taket er radielt — så langt ut som den
   * trongaste kotelina slepper staven, minus innsteget skyvaren bad om —
   * men radien lyg der kanten bøyer seg vekk frå strålen, so ρ vert dregen
   * inn til det MÅLTE godset held. Halveringa kostar tolv målingar og gjev
   * ein tidels millimeter; å gjette hadde kosta ein stav.
   */
  const fitRho = (fase: number): { rho: number; kl: number } => {
    let tak = Infinity
    for (let s = 0; s < ns; s++) {
      const ang = fase + (s * TAU) / ns
      for (let i = 0; i < n; i++) {
        const v = k.r(ang, zm[i])
        if (v < tak) tak = v
      }
    }
    let hi = tak - p.stavInn
    if (!(hi > 0)) return { rho: 0, kl: -1 }
    let klHi = godsVed(fase, hi)
    if (klHi >= treng) return { rho: hi, kl: klHi }
    // søk nedover: godset veks monotont innover so lenge kotelina er
    // stjerneforma om aksen, og det er ho — r(θ) er ein funksjon
    let lo = 0
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2
      if (godsVed(fase, mid) >= treng) lo = mid
      else hi = mid
    }
    return { rho: lo, kl: lo > 0 ? godsVed(fase, lo) : -1 }
  }

  const NF = 36
  let best: { rho: number; fase: number; kl: number } | null = null
  for (let f = 0; f < NF; f++) {
    const fase = (f / NF) * (TAU / ns)
    const { rho: rr, kl } = fitRho(fase)
    if (rr < 12 || kl < 0) continue
    if (!best || rr > best.rho + 1e-6) best = { rho: rr, fase, kl }
  }
  // finpuss kring den beste fasen: lobetoppen er skarp, og eit grovt nett
  // på ti grader kan bomme på han med fleire millimeter i ρ
  if (best) {
    const w = TAU / ns / NF
    const midt: number = best.fase
    for (let s = -4; s <= 4; s++) {
      if (s === 0) continue
      const f2 = midt + (s / 4) * w
      const { rho: rr, kl } = fitRho(f2)
      if (rr >= 12 && kl >= 0 && rr > best.rho + 1e-6) best = { rho: rr, fase: f2, kl }
    }
  }
  const rho = best ? best.rho : Math.max(12, k.kjerne(k.wZ, NS) * 0.5)
  const fase = best ? best.fase : 0
  const klaring = best ? best.kl : 0
  const stavar: Stav[] = []
  for (let s = 0; s < ns; s++) {
    const ang = fase + (s * TAU) / ns
    stavar.push({ x: rho * Math.cos(ang), y: rho * Math.sin(ang), ang })
  }

  // --- skåla --------------------------------------------------------------
  // Skåla er nominelt ein del av setet sin innskrivne radius, men ho kan
  // aldri nå fram til stavhòla: der står hylsa og kila, og ei skål som et
  // seg inn i eit stavhòl gjer setet til ei sil.
  const seatIn = k.kjerne(zm[n - 1], NS)
  const bedt = p.skaalR * seatIn
  const tak = rho - hylseD / 2 - 6
  const skaalR = Math.max(18, Math.min(bedt, tak))
  const djup = Math.max(0, Math.min(p.skaal, p.plyT - 4))
  const riller = Math.max(1, Math.round(p.riller))
  const ringar: Ring[] = []
  if (djup > 0.2) {
    for (let j = 0; j < riller; j++) {
      // like store ringareal: då er kvar kotelinje i setet like mykje verd
      ringar.push({
        r0: skaalR * Math.sqrt(j / riller),
        r1: skaalR * Math.sqrt((j + 1) / riller),
        z: H - djup * (1 - j / riller),
      })
    }
  }
  const skaal: Skaal = { R: skaalR, bedt, kutta: bedt > tak + 0.5, djup, ringar }

  // --- platene med hòl ----------------------------------------------------
  const holeR = p.stavD / 2 + 0.35
  const plates: Plate[] = outlines.map((o, i) => {
    // Eit stavhòl som ikkje står HEILT inne i kotelina er ikkje eit hòl —
    // det er ei opning i kanten. Regelen seier frå om at staven ikkje fann
    // gods; nettet skal likevel vera lukka, so hòlet fell bort her.
    const holes: Pt[][] = []
    for (const s of stavar) {
      if (!inPoly(o, s.x, s.y)) continue
      if (edgeDist(o, s.x, s.y) < holeR + 1.2) continue
      holes.push(stavHol(s, holeR))
    }
    let a = 0
    for (let j = 0; j < o.length; j++) {
      const b = o[(j + 1) % o.length]
      a += o[j][0] * b[1] - b[0] * o[j][1]
    }
    let area = Math.abs(a) / 2 - holes.length * Math.PI * holeR * holeR
    if (!(area > 0)) area = 1
    // kjernen og halsen: kor lite som står att etter bita
    let kj = Infinity
    let hals = Infinity
    const HN = 72
    for (let j = 0; j < HN; j++) {
      const th = (j / HN) * TAU
      const r0 = k.r(th, zm[i])
      const r1 = k.r(th + Math.PI, zm[i])
      if (r0 < kj) kj = r0
      if (r0 + r1 < hals) hals = r0 + r1
    }
    return {
      i,
      z0: z0[i],
      z1: z0[i] + p.plyT,
      zm: zm[i],
      outline: o,
      holes,
      area,
      kjerne: kj,
      hals,
    }
  })

  return {
    p, k, H, n,
    luft: st.luft,
    sokkel: st.sokkel,
    gaps,
    plates,
    stavar,
    rho,
    hylseD,
    klaring,
    skaal,
    steg,
    munn,
  }
}

/** kor høgt staven når over golvet, med kila si spiss */
export function toppHogd(p: Params): number {
  return p.hogd + p.stavOver + 0.4 * p.kileH
}
