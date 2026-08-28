/**
 * LAFT — platene og ledda.
 *
 * Her bur heile geometrien, og han bur berre her: kuttarket, nettet,
 * måltavla og lastmodellen les alle DENNE fila. Kvar del er ein lukka
 * kontur i sitt eige plan pluss ei plassering i rommet, og det er alt eit
 * flatpakka møbel ER.
 *
 * UNDERSTELLET ER EIN X. To blad står i kvar sitt loddrette plan, og dei
 * to plana kryssar kvarandre i ei loddrett line midt under setet. Kvart
 * blad ber to føter, og av di plana spriker, hamnar dei fire føtene i
 * kvar sin kvadrant. Leddet er ei krysshalving: det eine bladet har eit
 * ope hakk ned frå overkanten, det andre eit ope hakk opp frå bogen, og
 * summen av dei to er nøyaktig overlappet. Dette er den einaste
 * samanføyinga i heile understellet.
 *
 *   sete   ligg vassrett, vippa bakover. To spor tek tappane frå blada.
 *          Eitt hakk midt i bakkanten tek ryggen.
 *   bein   to blad, kryssa. Boge kutta ut mellom føtene, og eit hòl i
 *          kvar halvdel som glir frå trekant gjennom drope til boge.
 *   rygg   ei plate — eller to stavar — som lener seg bakover og går NED
 *          gjennom hakket i setet. Bereholet er det einaste hòlet som
 *          ikkje er eit ledd.
 *   kile   vert driven fram gjennom tunga under setet. Skuldra til ryggen
 *          ligg over setet, kilen under: plata er klemd mellom dei to.
 *
 * INGEN LIM, INGEN SKRUAR. Rekkjefylgja er: kryss dei to blada, senk
 * setet ned over toppen, skyv ryggen ned gjennom setet, slå kilen.
 *
 * INGEN SPOR VERT TEIKNA. Kvart spor er SKUGGEN av den delen som skal
 * gjennom, rekna av `spor.ts`. Ei plate som lener seg femten grader
 * flyttar seg fire millimeter sidelengs medan ho passerer eit sete på
 * femten — eit spor rekna av tjukna åleine er fire millimeter for smalt,
 * og det ser ein ikkje på skjermen.
 */
import { shoelace, type Pt, type Vec3 } from "../core"
import { materialet, type Params } from "./params"
import { rekt, sporRing, tilPlan, tilVerda, type Plass } from "./spor"
import { ryggPlass as loysRygg, setePlan } from "./seteplan"

export { setePlan } from "./seteplan"

const RAD = Math.PI / 180

export type { Plass }
export { tilVerda, tilPlan }

export type DelKind = "sete" | "bein" | "rygg" | "kile"

export type Del = {
  id: string
  kind: DelKind
  /** lukka kontur i planet, mot klokka */
  outline: Pt[]
  /** hòl og gjennomgåande spor, med klokka */
  holes: Pt[][]
  plass: Plass
  t: number
}

// =============================================================================
// SMÅVERKTØY
// =============================================================================
const kryssV = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** ei lukka rekkje mot klokka, uansett kva vegen ho kom inn */
const motKlokka = (ring: Pt[]): Pt[] => (shoelace(ring) < 0 ? ring.slice().reverse() : ring)
/** eit hòl går motsett veg av konturen */
const medKlokka = (ring: Pt[]): Pt[] => (shoelace(ring) > 0 ? ring.slice().reverse() : ring)

/**
 * Reinsk ein ring: kast punkt som ligg oppå kvarandre, og punkt som
 * ligg på lina mellom naboane sine.
 *
 * Dette er ikkje pynt. Nettet byggjer LOKKET med øyreklipping og VEGGEN
 * ved å gå kanten, og øyreklippinga må kaste kollineære punkt — ein
 * trekant utan areal er ikkje ein trekant. Gjer ho det på eiga hand,
 * har lokket og veggen ulike hjørne, og skalet får hòl akkurat der dei
 * er usamde. Difor vert ringen reinsa ÉIN gong, her, og båe les same
 * lista.
 */
function reinsk(ring: Pt[], eps = 0.02): Pt[] {
  let ut: Pt[] = []
  for (const q of ring) {
    const f = ut[ut.length - 1]
    if (f && Math.hypot(q[0] - f[0], q[1] - f[1]) < eps) continue
    ut.push(q)
  }
  while (ut.length > 3) {
    const a = ut[0]
    const b = ut[ut.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= eps) break
    ut.pop()
  }
  // kollineære punkt, til det ikkje er fleire att
  for (let runde = 0; runde < 4; runde++) {
    const inn = ut
    ut = []
    for (let i = 0; i < inn.length; i++) {
      const a = inn[(i + inn.length - 1) % inn.length]
      const b = inn[i]
      const c = inn[(i + 1) % inn.length]
      const cc = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if (inn.length > 3 && Math.abs(cc) < 1e-5) continue
      ut.push(b)
    }
    if (ut.length === inn.length) break
  }
  return ut
}

/** kapselen: eit langhòl med halvrunde endar — bereholet */
function kapsel(cx: number, cy: number, len: number, r: number, n = 12): Pt[] {
  const L = Math.max(0, len / 2 - r)
  const ut: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI
    ut.push([cx + L + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI
    ut.push([cx - L + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return ut
}

/**
 * Avlastinga i eit indre hjørne. Ein fres har ein radius og kan ikkje
 * skjera skarpt; utan eit lite hòl i hjørnet vert sporet trongare enn
 * teikninga heilt ute i endane, og delen går ikkje ned. Referansefotoa
 * viser dei same små kvadratiske utvidingane i kvar sporende.
 */
function avlasting(x: number, y: number, d: number): Pt[] {
  const r = d / 2
  const ut: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    ut.push([x + r * Math.cos(a), y + r * Math.sin(a)])
  }
  return ut
}

/**
 * Eit spor med avlasting i kvart hjørne — som ÉIN kuttbane.
 *
 * Fresen har ein radius og kan ikkje skjera skarpt. Utan avlasting vert
 * sporet trongare enn teikninga heilt ute i hjørna, og delen går ikkje
 * ned. Referansefotoa viser dei same små firkanta utvidingane i kvar
 * sporende.
 *
 * Men avlastingane må vera DEL AV RINGEN og ikkje fem ringar til. Setet
 * har fire tappespor og eitt ryggspor; med fire lause avlastingar kvar
 * vert det tjuefem hòl i éi plate, og hòl vert sydde inn i ytterkanten
 * med null-breie bruer før dei kan trianguleras. Tjuefem bruer i eitt
 * omriss kryssar kvarandre, øyreklippinga gjev opp, og plata vert full
 * av trekantar som vender feil veg. På skjermen ser det ut som setet er
 * borte. Difor: eitt spor, ein ring, hjørna innebygde.
 */
function sporMedAvlasting(ring: Pt[], d: number): Pt[][] {
  const r = d / 2
  const n = ring.length
  const ut: Pt[] = []
  for (let i = 0; i < n; i++) {
    const p0 = ring[(i + n - 1) % n]
    const p1 = ring[i]
    const p2 = ring[(i + 1) % n]
    let ax = p0[0] - p1[0]
    let ay = p0[1] - p1[1]
    let bx = p2[0] - p1[0]
    let by = p2[1] - p1[1]
    const la = Math.hypot(ax, ay) || 1
    const lb = Math.hypot(bx, by) || 1
    ax /= la; ay /= la; bx /= lb; by /= lb
    let mx = ax + bx
    let my = ay + by
    const lm = Math.hypot(mx, my)
    if (lm < 1e-6 || la < 3 * r || lb < 3 * r) {
      ut.push(p1)
      continue
    }
    // ut frå hjørnet, langs den motsette halveringslina
    mx = -mx / lm
    my = -my / lm
    const w = r * 0.72
    const L = r * 0.95
    ut.push([p1[0] + ax * w, p1[1] + ay * w])
    ut.push([p1[0] + ax * w + mx * L, p1[1] + ay * w + my * L])
    ut.push([p1[0] + bx * w + mx * L, p1[1] + by * w + my * L])
    ut.push([p1[0] + bx * w, p1[1] + by * w])
  }
  return [medKlokka(ut)]
}

// =============================================================================
// HÒLET I BLADET — trekant gjennom drope til boge
// =============================================================================
/**
 * Éi kurve, tre språk. Eksponenten opnar frå ein romb til eit runda
 * rektangel, og fallet gjer det eine hjørnet spisst — ein romb med fall
 * er ein trekant, ein ellipse med fall er ein drope, og ein runda
 * firkant utan fall er bogen. Ingen av dei tre er eit særtilfelle i
 * koden; dei ligg på same linja gjennom holform.
 */
function bladhol(cx: number, cy: number, bw: number, bh: number, holform: number, N = 64): Pt[] {
  const nH = 1.35 + holform * 1.75
  const fall = 0.62 * (1 - holform)
  const ut: Pt[] = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    const c = Math.cos(th)
    const s = Math.sin(th)
    const x0 = Math.sign(c) * Math.abs(c) ** (2 / nH)
    const y0 = Math.sign(s) * Math.abs(s) ** (2 / nH)
    // fallet smalnar den eine enden: spissen i trekanten og i dropen
    const k = 1 - fall * (0.5 + y0 / 2)
    ut.push([cx + (bw / 2) * x0 * k, cy + (bh / 2) * y0])
  }
  return ut
}

// =============================================================================
// BYGGET
// =============================================================================
export type Bygg = {
  p: Params
  delar: Del[]
  /** setevippen i radianar */
  a: number
  /** ryggleninga i radianar */
  rv: number
  /** halve vinkelen mellom dei to bladplana, radianar */
  phi: number
  /** setet si over- og underside i høgd z ved vassrett x */
  seteTopp(x: number): number
  seteUnder(x: number): number
  /** vassrett utstrekning av setet, fram og bak, på midtlina */
  xF: number
  xB: number
  /** føtene sin avstand frå midten, i bladet sitt plan */
  R: number
  /** høgda på krysset: bladet sin topp og bogen sin topp midt under setet */
  kryssTopp: number
  kryssBotn: number
  /** største avstand frå ein setekant til næraste bladline, mm */
  overheng: number
  /** kor langt setet ligg PÅ ei bladline — berebreidda i bøyinga */
  stotteB: number
  /** avstanden frå eit setepunkt i verda til næraste bladline */
  tilBlad(x: number, y: number): number
  /** ryggen sin x der han går gjennom setet */
  xRygg: number
  /** kor djup kvar tunge faktisk vart — geometrien har siste ordet */
  tungeDjup: number[]
}

/**
 * Eitt steg minne. Eit skyvarslepp spør om det same objektet fire gonger
 * — tavla byggjer det, delelista byggjer det, reglane byggjer det, og
 * pakkaren spør delelista om att — og kvar bygging er tolv millisekund.
 * Nøkkelen er parametrane, av di det er dei bygginga er ein funksjon av.
 */
let sisteBygg: { nokkel: string; b: Bygg } | null = null

export function bygg(p: Params): Bygg {
  const nokkel = JSON.stringify(p)
  if (sisteBygg && sisteBygg.nokkel === nokkel) return sisteBygg.b
  const b = byggja(p)
  sisteBygg = { nokkel, b }
  return b
}

function byggja(p: Params): Bygg {
  const a = p.setevipp * RAD
  const rv = p.ryggV * RAD
  const t = p.plyT
  const fit = p.pressfit
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const A = p.djup / 2

  // --- setet sitt plan ------------------------------------------------------
  const seteU: Vec3 = [ca, 0, sa]
  const seteV: Vec3 = [0, 1, 0]
  const seteN = kryssV(seteU, seteV)
  const setePlass: Plass = {
    o: [t * sa, 0, p.hogd - A * sa - t * ca],
    u: seteU,
    v: seteV,
    n: seteN,
  }
  const seteTopp = (x: number) => p.hogd - (A - x / ca) * sa
  const seteUnder = (x: number) => seteTopp(x) - t / ca
  const xF = (A + p.nase) * ca
  const xB = (-A + p.bakbukt) * ca

  // --- kvar ryggen får stå, og kor brei han får vera ------------------------
  // Løysinga bur i seteplan.ts, av di reparasjonen i params.ts må rekne
  // nøyaktig det same. Sjå kommentaren der for kvifor bakkanten ikkje kan
  // lesast på midtlina.
  const planet = setePlan(p)
  const { xRygg, ryggB } = loysRygg(p, planet)

  // --- bladplana ------------------------------------------------------------
  const phi = Math.atan2(p.fotY, p.fotX)
  const R = Math.hypot(p.fotX, p.fotY)
  const bladPlass = (teikn: number): Plass => {
    const u: Vec3 = [Math.cos(phi), teikn * Math.sin(phi), 0]
    const v: Vec3 = [0, 0, 1]
    const n = kryssV(u, v)
    return { o: [(-n[0] * t) / 2, (-n[1] * t) / 2, (-n[2] * t) / 2], u, v, n }
  }

  // --- kor langt setet rekk langs ei kryssarm ------------------------------
  // Bladet skal vera så høgt setet treng, og ikkje ein millimeter høgare.
  // Difor vert det målt kvar setet SLUTTAR langs armen, og utanfor det
  // punktet fell overkanten av. Det er heile skilnaden mellom eit bein og
  // ein sidevegg, og det er ikkje eit tal nokon set — det er setet sitt
  // eige omriss lese langs armen.
  const setering = motKlokka(planet)
  const iSete = (u: number, v: number) => {
    let inne = false
    for (let i = 0, j = setering.length - 1; i < setering.length; j = i++) {
      const [xi, yi] = setering[i]
      const [xj, yj] = setering[j]
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inne = !inne
    }
    return inne
  }
  let sSete = 0
  for (let sv = 4; sv <= R; sv += 3) {
    if (iSete((sv * Math.cos(phi)) / ca, -sv * Math.sin(phi))) sSete = sv
  }
  sSete = Math.max(40, Math.min(R - 24, sSete))

  /**
   * Bladet sin topp: full høgd ut til SKULDRA, og fall derifrå ut til
   * foten.
   *
   * Utan skulder er bladet ein sidevegg — ei plate i full høgd frå fot
   * til fot, og då er det ikkje eit bein, det er ein vegg med eit hòl i.
   * Skuldra er kor langt ut setet faktisk vert bore; utanfor henne har
   * plata ingen jobb, og då skal ho vekk. Referansane gjer nettopp det,
   * og det er difor dei les som bein.
   *
   * Prisen er ærleg og står i lastmodellen: kortare skulder gjev større
   * overheng, og overhenget er heile bøyemomentet i setet.
   */
  // krysshakket si breidd — tappane må halde seg klar av han
  const hakkGrov = (t * (1 + Math.abs(Math.cos(2 * phi)))) / Math.max(0.2, Math.sin(2 * phi)) + fit
  const sSkulder = Math.min(sSete, Math.max(60, p.hals * R))
  const fotTopp = 0.34
  // Krysset sit rett under setemidten, so bladet si fulle høgd der er
  // ikkje anna enn setet si underside i null. At talet kan lesast så
  // beint er ikkje kosmetikk: bogen mellom føtene er skalert av det, og
  // overkanten støyter mot bogen, so ei av dei tre må reknast først.
  const kryssTopp = seteUnder(0)
  // bogen mellom føtene: høgast på midten. Han set NEDRE kant av bladet
  // — og dermed golvet som midja aldri får eta seg ned i.
  const sInn = Math.max(30, R - p.fotbreidd)
  const kryssBotn = p.bogeH * kryssTopp
  /**
   * PORTEN. Bogen mellom føtene er den lengste samanhengande kurva i heile
   * silhuetten, og han stod på eit hardkoda tal. Eksponenten er heile
   * formspråket: éin er ein rein V med spissen i taket, to og eit halvt er
   * ein romansk boge, og fem er gotisk — smal og høg, med beina som to
   * skaft. Referansane spenner over alle tre, og skilnaden les ein frå
   * fire meter; `holstorleik` under setet gjer ein ikkje.
   */
  const bogeK = p.port
  const bogeZ = (s: number) =>
    Math.abs(s) >= sInn ? 0 : kryssBotn * (1 - (Math.abs(s) / sInn) ** bogeK)
  const bladTopp = (s: number) => {
    const a2 = Math.abs(s)
    if (a2 <= sSkulder) return seteUnder(s * Math.cos(phi))
    const zSk = seteUnder(Math.sign(s) * sSkulder * Math.cos(phi))
    const tau = Math.min(1, (a2 - sSkulder) / Math.max(1, R - sSkulder))
    // heva cosinus: flat ved skuldra, flat ved foten, alt fallet imellom
    const f = 0.5 * (1 + Math.cos(Math.PI * tau))
    const grunn = zSk * (fotTopp + (1 - fotTopp) * f)
    // MIDJA. Eit søkk midt på strekket mellom skuldra og foten, null i
    // begge endar, so bladet vert smalt der og breitt att ute. Det er
    // heile skilnaden på ei A-ramme og figuren i referansane — same
    // bein, men med ei innsving som gjer at auget les to lemmer og
    // ikkje éi plate. Søkket kan aldri eta seg ned i bogen: eit blad
    // som er kutta av på midten er ikkje ei midje, det er to delar.
    const sokk = p.midje * zSk * 0.46 * Math.sin(Math.PI * tau) ** 1.3
    return Math.max(grunn - sokk, bogeZ(s) + 34)
  }

  // --- bladomrisset ---------------------------------------------------------
  // Tappane går OPP gjennom setet. Dei sit der bladet er breiast under
  // setet, altså midt mellom krysset og foten.
  const sTapp = Math.min(sInn * 0.52, sSkulder * 0.62)
  const tappB = Math.min(96, sInn * 0.42)
  const tappH = t / ca + 1.2

  // Den BAKRE tappen og ryggplata vil begge stå i setet på same staden:
  // tappen kjem bakover langs armen, ryggen ned gjennom bakkanten, og
  // dei to sporene skjer kvarandre inne i plata. Ryggen vinn — han ber
  // lasta ein lener på — so tappen vert kappa framfor han. Grensa er
  // rekna av kvar ryggen faktisk står, ikkje sett med eit tal.
  const bakGrense = (xRygg + t + 12) / Math.cos(phi)
  // Kappinga må aldri SNU spennet. Går grensa forbi den fremre enden av
  // tappen, vert lo større enn hi — og då er tappen ein baklengs firkant
  // i omrisset som ingen ting kuttar spor til, av di filteret som lagar
  // sporet slepper gjennom null punkt. Plata er full av materiale ingen
  // har bedt om, og det ser ut som ein tapp. Difor: kapp bakfrå, men
  // skuv fram att til tappen har lengd, og stopp klar av krysshakket.
  const framStopp = -(hakkGrov / 2 + 10)
  const tappSpenn = [-sTapp, sTapp].map((c) => {
    let lo = c - tappB / 2
    let hi = c + tappB / 2
    if (c < 0 && lo < bakGrense) {
      lo = bakGrense
      if (hi - lo < 34) hi = Math.min(lo + 34, framStopp)
      if (hi - lo < 18) lo = hi - 18
    }
    return [lo, Math.max(hi, lo + 18)] as const
  })
  const iTapp = (s: number) => tappSpenn.some(([lo, hi]) => s > lo && s < hi)

  function bladOmriss(): Pt[] {
    const ut: Pt[] = []
    const N = 64
    // Overkanten frå bak til fram. Han følgjer undersida av setet, bortsett
    // frå der tappane stig gjennom plata — dei vert sette inn som fire
    // punkt kvar, og prøvepunkt inne i ein tapp vert hoppa over, elles
    // fell kanten ned att midt i tappen.
    for (let i = 0; i <= N; i++) {
      const s = -R + (2 * R * i) / N
      const s2 = -R + (2 * R * (i + 1)) / N
      if (!iTapp(s)) ut.push([s, bladTopp(s)])
      for (const [lo, hi] of tappSpenn) {
        if (s < lo && s2 >= lo) {
          ut.push([lo, bladTopp(lo)])
          ut.push([lo, bladTopp((lo + hi) / 2) + tappH])
          ut.push([hi, bladTopp((lo + hi) / 2) + tappH])
          ut.push([hi, bladTopp(hi)])
        }
      }
    }
    // framre fot ned, bogen tilbake, bakre fot opp
    ut.push([R, 0])
    for (let i = 0; i <= 60; i++) {
      const s = sInn - (2 * sInn * i) / 60
      ut.push([s, bogeZ(s)])
    }
    ut.push([-R, 0])
    return ut
  }

  // --- delane ---------------------------------------------------------------
  const delar: Del[] = []

  const blad: Del[] = [1, -1].map((teikn, i) => ({
    id: "B" + (i + 1),
    kind: "bein" as const,
    outline: motKlokka(bladOmriss()),
    holes: [],
    plass: bladPlass(teikn),
    t,
  }))

  // KRYSSHALVINGA, rekna eksakt.
  //
  // Her er skuggen feil verktøy: naboen kastar skugge langs HEILE si eiga
  // høgd, frå foten til tappen, og eit hakk skore etter den skuggen hamnar
  // både for høgt og for langt. Det som gjeld er overlappet mellom dei to
  // — frå bogen sin topp til bladet sin topp — delt på midten.
  //
  // Breidda er naboen si TILSYNELATANDE tjukn i dette planet. Dei to
  // plana står ikkje vinkelrett på kvarandre; dei står i vinkelen 2φ, og
  // ei plate på femten millimeter sedd på skrå er femten delt på sinus
  // til den vinkelen. Ved seksti grader er det sytten, ved tretti er det
  // tretti. Eit hakk kutta til femten ville aldri gått ned.
  const overlapp = kryssTopp - kryssBotn
  const midt = (kryssTopp + kryssBotn) / 2
  // Og tjukna til DENNE plata sveipar òg: eit punkt som ligg ute ved si
  // eiga bakside er alt eit stykke inn i naboen. Difor står det (1 +
  // |cos 2φ|) i teljaren og ikkje berre ein — utan det leddet vert hakket
  // eit par millimeter for smalt, og dei to blada deler ei tynn flis
  // materiale heile overlappet gjennom.
  const hakkB = hakkGrov
  // Hakket skal OPNE seg gjennom kanten, og då må det stikke forbi kanten
  // DER HAKKET ER BREITT — ikkje forbi toppunktet hennar. Bogen er ein
  // spiss når porten står på V: fire millimeter under toppen er framleis
  // godt over kanten ute ved hakkekanten, og då vert det opne hakket eit
  // lukka hòl tre millimeter frå kanten. Overskotet vert difor rekna av
  // bogen si eiga høgd i hakket sin ytterkant.
  const botnKant = Math.min(bogeZ(-hakkB / 2), bogeZ(hakkB / 2)) - 4
  blad.forEach((d, i) => {
    const h =
      i === 0
        ? rekt(-hakkB / 2, midt, hakkB / 2, kryssTopp + 4)
        : rekt(-hakkB / 2, botnKant, hakkB / 2, midt)
    d.holes.push(...sporMedAvlasting(h, p.fresD))
  })

  // hòlet i kvar halvdel av bladet
  if (p.holstorleik > 0.04) {
    for (const d of blad) {
      for (const teikn of [-1, 1]) {
        const cs = teikn * sInn * 0.55
        const romH = bladTopp(cs) - bogeZ(cs)
        const bw = sInn * 0.62 * p.holstorleik
        const bh = romH * 0.72 * p.holstorleik
        if (bw < 24 || bh < 24) continue
        d.holes.push(medKlokka(bladhol(cs, bogeZ(cs) + romH * 0.52, bw, bh, p.holform)))
      }
    }
  }
  delar.push(...blad)

  // --- ryggen ---------------------------------------------------------------
  const zSete = seteTopp(xRygg)
  const ryggU: Vec3 = [0, 1, 0]
  const ryggV3: Vec3 = [-Math.sin(rv), 0, Math.cos(rv)]
  const ryggN = kryssV(ryggU, ryggV3)
  const ryggPlass: Plass = {
    o: [xRygg - (ryggN[0] * t) / 2, -(ryggN[1] * t) / 2, zSete - (ryggN[2] * t) / 2],
    u: ryggU,
    v: ryggV3,
    n: ryggN,
  }

  const ryggTal = p.ryggdel >= 1.5 ? 2 : 1
  const glipe = ryggTal === 2 ? p.ryggglipe : 0
  const staveB = (ryggB - glipe) / ryggTal
  const rygg: Del[] = []
  const tungeMidt: number[] = []
  const tungeDjup: number[] = []
  for (let k = 0; k < ryggTal; k++) {
    const cy = ryggTal === 1 ? 0 : (k - 0.5) * (staveB + glipe)
    const y0 = cy - staveB / 2
    const y1 = cy + staveB / 2
    const vTopp = p.ryggH
    // TUNGA FØLGJER ARMANE.
    //
    // Under setet konvergerer dei to bladplana mot midtlina, og di lenger
    // ned tunga kjem, di mindre rom er det. Ei tunge med rett kant må
    // difor skjerast etter det TRONGASTE punktet — og med mykje lening
    // rekk ho heilt inn til krysset, der rommet er null, og då finst det
    // ikkje noko lovleg rett kant i det heile.
    //
    // Difor er sidene på tunga ikkje rette. Dei følgjer bladplanet med
    // fast klaring, heile vegen ned, og tunga vert kutta der ho ikkje er
    // brei nok til å vera ei tunge lenger. `tunge` er difor eit ØNSKE og
    // ikkje eit mål: geometrien har siste ordet, og måltavla melder kva
    // ho enda på.
    //
    // Avstanden frå midtlina til eit bladplan er |x|·SIN(φ) — den
    // vinkelrette avstanden — og ikkje |x|·tan(φ). Tangenten måler langs
    // ein akse og ikkje på tvers av plata, og gjev tretti prosent for
    // mykje rom.
    const glipeT = 14
    const MINTUNGE = 34
    /** halve kilerommet i høgda v, målt vinkelrett på bladplanet */
    const romV = (v: number) => {
      const x = xRygg - v * Math.sin(rv)
      return Math.abs(x) * Math.sin(phi) - t / 2 - 5
    }
    /** tunga si venstre og høgre kant i høgda v, for denne ryggdelen */
    const tungeKant = (v: number): [number, number] => {
      const rom = romV(v)
      if (ryggTal === 1) {
        const h = Math.max(1, Math.min(staveB / 2, rom))
        return [-h, h]
      }
      const inn = glipeT / 2
      // Ytterkanten er ABSOLUTTVERDIEN av staven si ytterkant: for den
      // venstre staven er cy negativ, og cy + halve breidda er då eit
      // lite negativt tal — ikkje kor langt ut han rekk.
      const ut = Math.max(inn + 1, Math.min(Math.abs(cy) + staveB / 2, rom))
      return k === 1 ? [inn, ut] : [-ut, -inn]
    }
    const tungeB0 = (v: number) => {
      const [a, b2] = tungeKant(v)
      return b2 - a
    }
    // Kor langt ned tunga REKK. Breidda veks monotont oppover — rommet
    // opnar seg di lenger frå krysset ein kjem — so djupna let seg løyse
    // med halvering i staden for å prøvast. Å prøve seg fram med ein
    // faktor er det som gjorde at delt rygg enda med to tunger som
    // krossa kvarandre: lykkja gav opp på ei grense og lét ei ugyldig
    // breidd stå.
    let vBotn = -Math.max(20, p.tunge)
    if (tungeB0(vBotn) < MINTUNGE) {
      // Halveringa må gå frå den GRUNNE sida og ned. Rommet opnar seg
      // oppover, so det grunne punktet held alltid og det djupe aldri;
      // markøren som skal flyttast er den som held, og han skal krype
      // NEDOVER mot grensa. Startar han på den djupe sida, kryp han feil
      // veg og endar på seks millimeter uansett kor mykje rom det er.
      let god = -6
      let ille = vBotn
      for (let n = 0; n < 28; n++) {
        const mid = (god + ille) / 2
        if (tungeB0(mid) >= MINTUNGE) god = mid
        else ille = mid
      }
      vBotn = god
    }
    const [t0, t1] = tungeKant(vBotn)
    tungeMidt.push((t0 + t1) / 2)
    tungeDjup.push(-vBotn)
    // toppen: rett kant som opnar seg mot ein halvsirkel
    const rTopp = (p.ryggtopp * staveB) / 2
    // Skuldra SKRÅR. Ei vassrett skulder gjev fire punkt på same lina, og
    // då vert øyreklippinga og veggen usamde om kvar kantane går: klippet
    // kastar det midtre punktet, veggen går innom det, og skalet får eit
    // hòl nøyaktig der. Ei skrå skulder har ikkje det problemet — og ho er
    // dessutan rett konstruksjon, av di eit skarpt innvendig hjørne i ei
    // finérplate er der ho sprekk.
    const skulder = Math.min(16, staveB / 8)
    // høgre side av tunga, nedanfrå og opp — han følgjer armen
    const NT = 10
    const ring: Pt[] = [[t0, vBotn], [t1, vBotn]]
    for (let n = NT - 1; n >= 0; n--) {
      const v = (vBotn * n) / NT
      ring.push([tungeKant(v)[1], v])
    }
    ring.push([y1, skulder], [y1, vTopp - rTopp])
    // TOPPEN. Ved null er han ein rett kant; ved eitt er han ein halv
    // sirkel med radius lik halve breidda. Imellom er han ein boge som
    // er flat på midten og runda i hjørna — same kurva heile vegen, so
    // skyvaren ikkje har eit sprang i seg. Bogen er teikna med den
    // radien `rTopp` gjev, og senteret ligg der han må for at kurva skal
    // møte sidekantane rett.
    if (rTopp > 0.5) {
      const flat = Math.max(0, staveB / 2 - rTopp)
      const NB = 16
      for (let i = 0; i <= NB; i++) {
        const th = (i / NB) * Math.PI
        const cx = cy + flat * Math.cos(th)
        ring.push([cx + rTopp * Math.cos(th), vTopp - rTopp + rTopp * Math.sin(th)])
      }
    }
    ring.push([y0, vTopp - rTopp])
    ring.push([y0, skulder])
    for (let n = 0; n < NT; n++) {
      const v = (vBotn * n) / NT
      ring.push([tungeKant(v)[0], v])
    }

    const d: Del = {
      id: "R" + (k + 1),
      kind: "rygg",
      // Er tunga like brei som staven, fell skuldra bort og to punkt
      // hamnar oppå kvarandre. Ein null-lang kant er ikkje ein kant: han
      // gjev ein trekant utan areal, og eit skal med hòl i.
      outline: motKlokka(reinsk(ring)),
      holes: [],
      plass: ryggPlass,
      t,
    }
    // BEREHOLET, løyst mot plata si eiga kant.
    //
    // Hòlet stod før på eit tal: så langt ned frå toppen som `grepZ` sa,
    // så langt som `grep` sa, klipt av staven si breidd. Det held berre
    // for ei rett plate. Er toppen runda, smalnar plata nettopp der hòlet
    // ligg, og kapselen sine endar bryt ut gjennom det runda hjørnet —
    // eit berehol som er ope i eine enden er ikkje eit berehol, det er ei
    // gaffel. `scripts/laft-gods.ts` fann det på seks av førti kast, verst
    // med hòlkanten éin millimeter UTANFOR plata.
    //
    // No vert både høgda og lengda løyste mot den same toppkurva plata er
    // teikna med. På ei rett plate gjev det nøyaktig det gamle talet.
    const rH = 17
    const godsH = 38
    /** plata si halve breidd i høgd v — rett kant nedanfor bogen, boge over */
    const halvTopp = (v: number) => {
      if (rTopp <= 0.5 || v <= vTopp - rTopp) return staveB / 2
      const flat = Math.max(0, staveB / 2 - rTopp)
      const q = Math.min(1, (v - (vTopp - rTopp)) / rTopp)
      return flat + rTopp * Math.sqrt(Math.max(0, 1 - q * q))
    }
    // senteret: der skyvaren vil ha det, men aldri så høgt at kapselen
    // bryt toppen eller så lågt at han et seg ned i skuldra
    const vH = Math.min(vTopp - rH - godsH / 2, Math.max(skulder + rH + godsH / 2, vTopp - p.grepZ))
    // lengda: det plata gjev ved kapselen sin topp OG botn
    const romH = Math.min(halvTopp(vH + rH), halvTopp(vH - rH))
    const gl = Math.min(p.grep, 2 * romH - 2 * godsH)
    if (gl >= 84) d.holes.push(medKlokka(kapsel(cy, vH, gl, rH)))
    rygg.push(d)
  }
  delar.push(...rygg)

  // --- kilane ---------------------------------------------------------------
  // Ein kile per ryggdel. Han står i tunga sitt eige plan og vert driven
  // FRAM gjennom henne; skråkanten er heile mekanikken: di lenger inn han
  // går, di høgare vert snittet i hòlet, og til slutt pressar overkanten
  // opp mot undersida av setet. Skuldra ligg over setet og kilen under —
  // plata er klemd mellom dei to, og då sit møbelet.
  //
  // Med DELT rygg er det to tunger, og dei står kvar for seg inne i
  // kilerommet med ei glipe imellom. Éin kile i midtplanet ville gå
  // gjennom glipa og ikkje gjennom nokon av dei. Difor får kvar tunge sin
  // eigen — og då er kontrastkilen ikkje eitt merke i møbelet, men to.
  const kileH0 = 26
  // Kilen skal sitje i TUNGA, og tunga er ikkje like djup kvar gong —
  // ho vert løyst av kilerommet og kan bli kort. Ein fast avstand under
  // setet hamnar då nedanfor enden på henne, og kilen går gjennom lufta.
  // Difor vert han plassert etter tunga: godt under setet, so det er
  // gods å bera mot, og godt over enden, so det er gods å klemme.
  const vKile = Math.min(-(t / ca + 20), Math.min(...tungeDjup) * -0.55)
  const kileZ = zSete + vKile * Math.cos(rv)
  // Tunga lener seg framover medan ho fell: der ho står i kilehøgda er
  // ikkje der ho gjekk gjennom setet. Kilen må stå DER.
  const xTunge = xRygg + (zSete - kileZ) * Math.tan(rv)
  const kileL = p.kileB
  const kileRing: Pt[] = [
    [-kileL * 0.5, -kileH0 / 2],
    [kileL * 0.22, -kileH0 / 2 + 4],
    [kileL * 0.34, -kileH0 / 2 + 5],
    [kileL * 0.34, kileH0 / 2 + 9],
    [kileL * 0.22, kileH0 / 2 + 9],
    [kileL * 0.22, kileH0 / 2],
    [-kileL * 0.5, kileH0 / 2 - 3],
  ]
  const kilar: Del[] = rygg.map((r, i) => ({
    id: "K" + (i + 1),
    kind: "kile" as const,
    outline: motKlokka(kileRing),
    holes: [],
    plass: {
      o: [xTunge, tungeMidt[i] + t / 2, kileZ],
      u: [1, 0, 0],
      v: [0, 0, 1],
      n: [0, -1, 0],
    } as Plass,
    t,
  }))
  delar.push(...kilar)

  // --- SPORA, rekna av dei som skal gjennom --------------------------------
  const sete: Del = {
    id: "S1",
    kind: "sete",
    outline: motKlokka(setePlan(p)),
    holes: [],
    plass: setePlass,
    t,
  }
  // Tappane frå blada — eitt spor per TAPP. Eit filter som slepper
  // gjennom begge ville gjeve éin skugge som spente over heile bladet,
  // og då er sporet ikkje eit spor lenger, men ei kløft.
  for (const d of blad) {
    for (const [lo, hi] of tappSpenn) {
      const s = sporRing(
        setePlass,
        t,
        d,
        fit,
        (q) => q[0] > lo - 0.2 && q[0] < hi + 0.2 && q[1] > bladTopp(q[0]) + 0.3,
      )
      if (s) sete.holes.push(...sporMedAvlasting(s, p.fresD))
    }
  }
  // hakket til ryggen, opent mot bakkanten
  for (const d of rygg) {
    const s = sporRing(setePlass, t, d, fit)
    if (s) sete.holes.push(...sporMedAvlasting(s, p.fresD))
  }
  delar.unshift(sete)

  // hòlet i tunga som kilen går gjennom — kvar sin
  rygg.forEach((d, i) => {
    const s = sporRing(d.plass, d.t, kilar[i], fit)
    if (s) d.holes.push(...sporMedAvlasting(s, p.fresD))
  })

  // --- kor setet ligg i høve til krysset -----------------------------------
  // Med eit kryss er setet ikkje ein bjelke mellom to opplegg; det er
  // fire trekantar som kvar ligg på to linjer og er fri ute i hjørnet.
  // Då er det EIN avstand som styrer alt: kor langt eit punkt er frå
  // næraste bladline. Overhenget er den største av dei.
  const tilBlad = (x: number, y: number) =>
    Math.min(
      Math.abs(x * Math.sin(phi) - y * Math.cos(phi)),
      Math.abs(x * Math.sin(phi) + y * Math.cos(phi)),
    )
  let overheng = 0
  for (const q of sete.outline) overheng = Math.max(overheng, tilBlad(q[0] * ca, q[1]))
  // berebreidda: korda setet har langs ei bladline
  let korda = 0
  {
    const inne = (x: number, y: number) => {
      // strålekast i setet sitt eige plan
      const u = x / ca
      let n = 0
      const ring = sete.outline
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y && u < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n++
      }
      return n % 2 === 1
    }
    const steg = 4
    for (let s2 = -R * 1.6; s2 <= R * 1.6; s2 += steg) {
      if (inne(s2 * Math.cos(phi), -s2 * Math.sin(phi))) korda += steg
    }
  }
  const stotteB = Math.max(40, korda)

  for (const d of delar) {
    d.outline = reinsk(d.outline)
    d.holes = d.holes.map((h) => reinsk(h)).filter((h) => h.length >= 3)
  }

  return {
    p,
    delar,
    a,
    rv,
    phi,
    seteTopp,
    seteUnder,
    xF,
    xB,
    R,
    kryssTopp,
    kryssBotn,
    overheng,
    stotteB,
    tilBlad,
    xRygg,
    tungeDjup,
  }
}

/** arealet av ein del: konturen minus hòla */
export function delAreal(d: Del): number {
  let s = Math.abs(shoelace(d.outline))
  for (const h of d.holes) s -= Math.abs(shoelace(h))
  return Math.max(0, s)
}

export { materialet }
