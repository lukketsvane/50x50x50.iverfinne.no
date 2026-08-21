/**
 * BØYG — skala, og korleis dei ligg i kvarandre.
 *
 * Typologien er PRESSBØYING. Ei flat finérplate vert lagd i ei form og
 * pressa til ho har ei ny, krum kvile — ho er ikkje spent, ho er BØYGD.
 * Alle skala kjem av SAME form, so kjernen deira — framfolden, nasen,
 * setelaupet, halefolden — er nøyaktig den same kurva i kvart einaste
 * skal. Det einaste som skil dei er kvar dei står, og kvar dei er kappa.
 *
 * PLASSERINGA er ei stiv rørsle om dybelen og ingen ting anna:
 *   1  skalet vert vridd θ grader kring dybelpunktet
 *   2  skalet vert skuve δ millimeter langs dybelaksen
 * Dybelen står difor i SAME punkt på kvart einaste skal, og hòla ligg på
 * ei rett line — det er den lina den eine dybelen fylgjer. Vridinga er
 * grunnen til at profilen VIFTAR seg ut bakover sjølv om skala er like:
 * to kongruente kurver vridde om eit felles punkt møtest berre DER, og
 * spriker overalt elles.
 *
 * KAPPINGA er det einaste skalet ikkje deler med grannen sin. Beinet og
 * halen er rette (eller heilt svakt bøygde) laup, og dei vert kappa i
 * golvet etter at fanen er sett saman — som ein alltid kappar beina på ein
 * krakk til slutt. Éi form, mange kapp.
 *
 * Aksar: X = fram(+)/bak(−), Y = på tvers, Z = opp. Millimeter og grader.
 */
import { keep, type Pt } from "../core"
import type { Params } from "./params"

export type Detail = { ns: number; nw: number }
export const DETAIL: Record<"lav" | "mid" | "hog", Detail> = {
  lav: { ns: 46, nw: 4 },
  mid: { ns: 80, nw: 6 },
  hog: { ns: 132, nw: 10 },
}

const RAD = Math.PI / 180

/** Ei sone er eit stykke av skalet med KONSTANT krumming — altså eitt
 *  bøygd felt i forma, eller eit rett laup. Bøyeradiusen i sona er
 *  lengda delt på svingen, og det er det talet pressa må klare. */
export type Sone = {
  id: string
  label: string
  len: number
  /** total sving gjennom sona, radianar; positiv er mot klokka i (x, z) */
  turn: number
  /** true når sona er pressa over form og ikkje berre eit rett laup */
  press: boolean
}

/** eit punkt på senterlina med retning, breidd og kva sone det ligg i */
export type Stasjon = {
  s: number
  x: number
  z: number
  /** eining-tangent */
  tx: number
  tz: number
  /** venstrenormalen, altså rot90 mot klokka av tangenten */
  nx: number
  nz: number
  /** halv breidd på tvers, mm */
  w: number
  /** krona si djupn her, mm — null ute i endane */
  kr: number
  sone: number
}

export type Skal = {
  k: number
  /** vridinga kring dybelen, radianar */
  theta: number
  /** skuvet langs dybelaksen, mm */
  delta: number
  soner: Sone[]
  st: Stasjon[]
  /** samla lengd på blanketten, mm */
  len: number
  /** dybelen si bogelengd frå framenden av DETTE skalet */
  sPin: number
  /** dybelpunktet i verda */
  pin: Pt
  /** enderingane sine kutteplan-normalar */
  cutA: Pt
  cutB: Pt
}

export type Bygg = {
  skal: Skal[]
  /** dybelaksen: punkt og eining-retning i (x, z) */
  pinP: Pt
  pinD: Pt
  /** minste og største δ over stabelen */
  d0: number
  d1: number
  /** kjernen sine soner — dei er like i kvart skal */
  kjerne: Sone[]
  /** minste pressradius i kjernen, mm */
  minR: number
  /** der ein sit: (x, z) på topskalet si sitjeflate */
  sitX: number
  sitZ: number
  /** setelaupet sitt X-spenn på topskalet, mm */
  seteD: number
  /** brukbar breidd over setelaupet, mm */
  seteW: number
  /** kor mange skal ligg innanfor sitjebandet og deler lasta */
  barande: number
  /** høgda på det lågaste punktet i sitjeflata, mm */
  seteZ0: number
  /** minste luft mellom to naboskal, målt normalt, mm */
  minGap: number
  /** kva som ikkje let seg byggje */
  feil: string[]
}

// =============================================================================
// KURVA
// =============================================================================
/**
 * Eit steg langs ei kurve med konstant krumming. κ = sving/lengd, og
 * grensa κ → 0 er det rette laupet. Alt i denne fila går gjennom denne
 * eine funksjonen, so eit rett bein og ein pressa fold er same rekning.
 */
function stig(x: number, z: number, phi: number, len: number, turn: number): [number, number, number] {
  if (Math.abs(turn) < 1e-9) {
    return [x + len * Math.cos(phi), z + len * Math.sin(phi), phi]
  }
  const k = turn / len
  const p2 = phi + turn
  return [
    x + (Math.sin(p2) - Math.sin(phi)) / k,
    z + (Math.cos(phi) - Math.cos(p2)) / k,
    p2,
  ]
}

/** kjernen: dei fire pressa felta som ALLE skala deler */
export function kjerneSoner(p: Params): Sone[] {
  const nl = Math.max(24, p.setelop * 0.16)
  const sl = Math.max(40, p.setelop - nl)
  return [
    {
      id: "framfold",
      label: "framfold",
      len: p.foldR * p.foldV * RAD,
      turn: p.foldV * RAD,
      press: true,
    },
    { id: "nase", label: "nasesving", len: nl, turn: -p.nase * RAD, press: true },
    { id: "sete", label: "setelaup", len: sl, turn: -p.setekrum * RAD, press: true },
    {
      id: "halefold",
      label: "halefold",
      len: p.haleR * p.haleV * RAD,
      turn: p.haleV * RAD,
      press: true,
    },
  ]
}

/** bøyeradiusen i ei sone; eit rett laup har uendeleg radius */
export const soneR = (s: Sone) => (Math.abs(s.turn) < 1e-9 ? Infinity : s.len / Math.abs(s.turn))

// =============================================================================
// BREIDDA OG KRONA
// =============================================================================
/**
 * Breidda langs laupet. Skalet er breiast der ein sit og smalnar mot
 * begge endane — det er ikkje pynt: eit bøygd skal er stivast der det er
 * breiast, og det er under puta stivleiken trengst. Skuldra er ei
 * sirkulær avrunding heilt ytst, so enden ikkje er eit skarpt hjørne av
 * finér.
 */
function breidd(p: Params, s: number, len: number, sSete: number): number {
  const halv = p.breidd / 2
  const spenn = Math.max(1, Math.max(sSete, len - sSete))
  const t = Math.min(1, Math.abs(s - sSete) / spenn)
  let w = halv * (1 - p.breiddfall * Math.pow(t, 1.3))
  // skuldra: sirkulær fillet inn frå kvar ende
  const r = Math.min(p.skulder, halv * 0.45)
  if (r > 0.5) {
    const d = Math.min(s, len - s)
    if (d < r) w -= r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)))
  }
  return Math.max(6, w)
}

/** krona fell av mot endane: pressa dishar setet, beinet er flatt */
function krone(p: Params, s: number, s0: number, s1: number, len: number): number {
  const inn = 0.55
  let f = 1
  if (s < s0) f = Math.max(0, s / Math.max(1, s0 * inn + 1e-6))
  else if (s > s1) f = Math.max(0, (len - s) / Math.max(1, (len - s1) * inn + 1e-6))
  return p.krone * Math.min(1, f)
}

// =============================================================================
// BYGGET
// =============================================================================
const HUGS = keep<Bygg>(4)

export function bygg(p: Params, d: Detail = DETAIL.mid): Bygg {
  return HUGS(JSON.stringify(p) + "|" + d.ns + "|" + d.nw, () => byggRaa(p, d))
}

function byggRaa(p: Params, d: Detail): Bygg {
  const feil: string[] = []
  const kjerne = kjerneSoner(p)
  const kLen = kjerne.reduce((a, s) => a + s.len, 0)
  const phi0 = (90 + p.beinfall) * RAD

  // --- kjernen på det MIDTRE skalet, med framfolden sin start i (0, 0) ---
  const kp = kjede(kjerne, 0, 0, phi0)
  const kEnd = kp[kp.length - 1]

  // --- dybelpunktet og sitjepunktet, begge lesne på det midtre skalet ----
  const sPinK = Math.min(kLen - 8, Math.max(4, p.pinnstad * kLen))
  const pinLok = punktIKjerne(kjerne, kp, sPinK)
  const sSeteStart = kjerne[0].len + kjerne[1].len
  const sSit = sSeteStart + 0.55 * kjerne[2].len
  const sitLok = punktIKjerne(kjerne, kp, sSit)

  // --- NESTINGA -----------------------------------------------------------
  // Skala er IKKJE kongruente, og det er ikkje ein forenkling — det er
  // det einaste som let ein fan av bøygde skal nestast i det heile. To
  // like kurver lagde med luft imellom må vera vridde om eit punkt, og
  // profilen her svingar hundre og åtti grader frå bein til hale: uansett
  // kvar det punktet vert lagt, lukkar gapet seg i den eine enden og
  // skala skjer gjennom kvarandre. Ei PARALLELLKURVE gjer det ikkje: ho
  // held same luft heile vegen, av di ho har same senter og ein annan
  // radius. Difor er skal nummer k pressa OVER skal k−1, med ein
  // mellomlegg i forma — same form, N innlegg, og kvart skal ein tanke
  // lengre og latare i folden enn det inni.
  const n = Math.max(2, Math.round(p.skal))
  const m = n - 1
  const gaps: number[] = []
  if (m > 0) {
    const ws: number[] = []
    for (let j2 = 0; j2 < m; j2++) {
      const c = m > 1 ? Math.abs(j2 - (m - 1) / 2) / ((m - 1) / 2) : 1
      ws.push(Math.max(0.06, 1 - p.klaringfall * (1 - c)))
    }
    const sum = ws.reduce((a, b) => a + b, 0)
    for (const w of ws) gaps.push((p.klaring * m * w) / sum)
  }
  // Forskuvinga er ALDRI negativ: skal med forskuving null er det som
  // ligg rett på forma, og det er han bøyeradiusen skal målast på. Kvart
  // skal utanpå får radius pluss si eiga forskuving og vert dermed latare
  // i folden og lengre i blanketten. Skal 0 er det YTSTE — det største,
  // det høgste, og det ein sit på.
  const cum: number[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    cum.push(acc)
    if (i < m) acc += p.plyT + gaps[i]
  }
  const offs = cum.map((_, i) => cum[n - 1 - i])

  // VIFTA på toppen av nestinga: ei lita vriding kring dybelen som let
  // halane sprike meir enn parallellkurvene åleine gjer. Ho et av lufta i
  // den eine enden, og difor er ho eit skyvar med ei grense og ikkje pynt.
  const halv = (n - 1) / 2
  const thetas: number[] = []
  for (let i = 0; i < n; i++) {
    const u = halv > 0 ? (halv - i) / halv : 0
    thetas.push(Math.sign(u) * Math.pow(Math.abs(u), p.stegkurve) * halv * p.steg * RAD)
  }

  // dybelaksen: normalen i dybelpunktet på det midtre skalet
  const axD: Pt = [-Math.sin(pinLok.phi), Math.cos(pinLok.phi)]

  // --- global plassering ---------------------------------------------------
  const s0 = plasser(thetas[0], pinLok, 0, 0)
  const off0 = offs[0]
  const sit0lok = { x: sitLok.x - off0 * -Math.sin(sitLok.phi) * -1, z: sitLok.z }
  void sit0lok
  const sitn: Pt = [-Math.sin(sitLok.phi), Math.cos(sitLok.phi)]
  const sitPt = s0.map(sitLok.x - off0 * sitn[0], sitLok.z - off0 * sitn[1])
  const nSit = s0.rot(sitn[0], sitn[1])
  const topp = (p.plyT / 2) * -nSit[1] + p.krone * nSit[1]
  const Gz = p.hogd - (sitPt[1] + topp)
  const Gx = -sitPt[0]
  // Sitjepunktet er definert og ikkje skanna: midt i setelaupet på det
  // ytste skalet, og oversida der. Då er høgda eksakt i éin omgang — ei
  // skanna høgd ville hoppa mellom to ruter og aldri sett seg.
  const sitX0 = 0
  const sitZ0 = p.hogd

  // --- skala ---------------------------------------------------------------
  const skal: Skal[] = []
  let minGap = Infinity
  let minRad = Infinity
  for (let i = 0; i < n; i++) {
    const o = offs[i]
    const T = plasser(thetas[i], pinLok, Gx, Gz)
    // Parallellkurva: same sving, radius pluss forskuvinga med forteikn
    // etter kva veg sona krøkjer. Ei sone som er rett vert verande rett.
    const kj: Sone[] = kjerne.map((z) => {
      if (Math.abs(z.turn) < 1e-9) return { ...z }
      const r = z.len / Math.abs(z.turn) + o * Math.sign(z.turn)
      return { ...z, len: Math.max(2, r) * Math.abs(z.turn) }
    })
    for (const z of kj) minRad = Math.min(minRad, soneR(z))
    const nStart: Pt = [-Math.sin(phi0), Math.cos(phi0)]
    const lp = kjede(kj, -o * nStart[0], -o * nStart[1], phi0)
    const lEnd = lp[lp.length - 1]
    const kLen2 = kj.reduce((a, z) => a + z.len, 0)

    const kb = (p.beinvri * RAD) / 100
    const kt = (p.halevri * RAD) / 100
    const start = T.map(lp[0].x, lp[0].z)
    const startPhi = phi0 + thetas[i]
    const slutt = T.map(lEnd.x, lEnd.z)
    const sluttPhi = lEnd.phi + thetas[i]

    const beinP = (L: number): [number, number, number] =>
      stig(start[0], start[1], startPhi, -L, -kb * L)
    const haleP = (L: number): [number, number, number] =>
      stig(slutt[0], slutt[1], sluttPhi, L, kt * L)

    // Kappet må ta omsyn til at enden ikkje er eit punkt: han er tjukna
    // kutta av eit skrått plan, og det er det LÅGASTE hjørnet hans som
    // står i golvet. Retninga i enden endrar seg med lengda når laupet er
    // bøygd, so senterlina si målhøgd vert justert i tre omgangar.
    let Lb = 0
    let Lt = 0
    let zb = 0
    let zt = 0
    for (let it = 0; it < 3; it++) {
      Lb = loysGolv(beinP, zb, feil, "bein")
      zb = -ringDz(beinP(Lb)[2], p.plyT, p.sale, 0)
    }
    for (let it = 0; it < 3; it++) {
      Lt = loysGolv(haleP, zt, feil, "hale")
      zt = -ringDz(haleP(Lt)[2], p.plyT, p.sale, 1)
    }

    const soner: Sone[] = [
      { id: "bein", label: "framebein", len: Lb, turn: kb * Lb, press: Math.abs(p.beinvri) > 0.2 },
      ...kj,
      { id: "hale", label: "hale", len: Lt, turn: kt * Lt, press: Math.abs(p.halevri) > 0.2 },
    ]
    const len = Lb + kLen2 + Lt
    const sSitS = Lb + kj[0].len + kj[1].len + 0.55 * kj[2].len

    // Stasjonane, sone for sone. Sonegrensene ER stasjonar: bøyelinene på
    // blanketten og skiljet mellom pressa og rett laup må falle nøyaktig
    // saman med eit punkt i nettet, elles ligg dei ein halv rute på skeive.
    const st: Stasjon[] = []
    const b0 = beinP(Lb)
    let px = b0[0]
    let pz = b0[1]
    let pphi = b0[2]
    let ps = 0
    const push = (si: number) => {
      st.push({
        s: ps,
        x: px,
        z: pz,
        tx: Math.cos(pphi),
        tz: Math.sin(pphi),
        nx: -Math.sin(pphi),
        nz: Math.cos(pphi),
        w: breidd(p, ps, len, sSitS),
        kr: krone(p, ps, Lb, len - Lt, len),
        sone: si,
      })
    }
    push(0)
    soner.forEach((so, si) => {
      const steg = Math.max(2, Math.round((d.ns * so.len) / Math.max(1, len)))
      for (let j2 = 1; j2 <= steg; j2++) {
        const [x, z, ph] = stig(px, pz, pphi, so.len / steg, so.turn / steg)
        px = x
        pz = z
        pphi = ph
        ps += so.len / steg
        push(si)
      }
    })

    skal.push({
      k: i,
      theta: thetas[i],
      delta: o,
      soner,
      st,
      len,
      sPin: Lb + sPinK,
      pin: [0, 0],
      cutA: kuttNormal(-st[0].tx, -st[0].tz, p.sale),
      cutB: kuttNormal(st[st.length - 1].tx, st[st.length - 1].tz, p.sale),
    })
  }

  // --- dybelen: éi rett line gjennom heile fanen --------------------------
  // Dybelen er ikkje bilete av eitt og same punkt i kvart skal. Han er ei
  // LINE, og han treffer kvart skal der lina kryssar det. Er fanen vridd,
  // vandrar den bogelengda gjennom stabelen — og går ho ut over enden på
  // eit skal, finst det ikkje gods å bore i lenger.
  const pinW: Pt = [pinLok.x + Gx, pinLok.z + Gz]
  for (const sk of skal) {
    const t = kryssLine(sk, pinW, axD)
    if (!t) {
      if (!feil.includes("dybel")) feil.push("dybel")
      const q = naerSt(sk.st, sk.sPin)
      sk.pin = [q.x, q.z]
      continue
    }
    sk.sPin = t.s
    sk.pin = [t.x, t.z]
  }

  // --- minste luft mellom naboskal ---------------------------------------
  for (let i = 0; i + 1 < skal.length; i++) {
    const g = gapMellom(skal[i], skal[i + 1], p.plyT)
    if (g < minGap) minGap = g
  }
  if (!Number.isFinite(minGap)) minGap = p.klaring

  // --- setet: målt på det som faktisk ligg øvst ---------------------------
  const sete = seteMaal(skal, p, sitX0, sitZ0)

  return {
    skal,
    pinP: pinW,
    pinD: axD,
    d0: offs[offs.length - 1],
    d1: offs[0],
    kjerne,
    minR: minRad,
    sitX: sitX0,
    sitZ: sitZ0,
    seteD: sete.seteD,
    seteW: sete.seteW,
    barande: sete.barande,
    seteZ0: sete.z0,
    minGap,
    feil,
  }
}

/** integrerer ei sonekjede frå eit startpunkt og ei startretning */
function kjede(
  soner: Sone[],
  x: number,
  z: number,
  phi: number,
): { x: number; z: number; phi: number; s: number }[] {
  const out = [{ x, z, phi, s: 0 }]
  let s = 0
  for (const so of soner) {
    const [nx, nz, np] = stig(x, z, phi, so.len, so.turn)
    x = nx
    z = nz
    phi = np
    s += so.len
    out.push({ x, z, phi, s })
  }
  return out
}

// =============================================================================
// HJELPARAR
// =============================================================================
function punktIKjerne(
  soner: Sone[],
  kp: { x: number; z: number; phi: number; s: number }[],
  s: number,
): { x: number; z: number; phi: number } {
  let i = 0
  while (i < soner.length - 1 && kp[i + 1].s < s) i++
  const rest = s - kp[i].s
  const so = soner[i]
  const f = so.len > 0 ? rest / so.len : 0
  const [x, z, phi] = stig(kp[i].x, kp[i].z, kp[i].phi, rest, so.turn * f)
  return { x, z, phi }
}

/** ei stiv rørsle: vri θ kring dybelpunktet og flytt heile fanen med G */
function plasser(theta: number, pin: { x: number; z: number }, Gx: number, Gz: number) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const ox = pin.x + Gx
  const oz = pin.z + Gz
  return {
    map: (x: number, z: number): [number, number] => {
      const dx = x - pin.x
      const dz = z - pin.z
      return [ox + dx * c - dz * s, oz + dx * s + dz * c]
    },
    rot: (x: number, z: number): [number, number] => [x * c - z * s, x * s + z * c],
  }
}

/**
 * Kappelengda mot golvet. Retninga snur seg undervegs når laupet er bøygd,
 * so talet vert funne ved halvering og ikkje ved deling — og eit laup som
 * ALDRI når golvet (det peikar oppover) er ein feil og ikkje eit tal.
 */
function loysGolv(
  f: (L: number) => [number, number, number],
  mal: number,
  feil: string[],
  namn: string,
): number {
  const LO = 6
  const HI = 780
  const zAt = (L: number) => f(L)[1] - mal
  if (zAt(LO) <= 0) return LO
  if (zAt(HI) > 0) {
    if (!feil.includes(namn)) feil.push(namn)
    return HI
  }
  let lo = LO
  let hi = HI
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2
    if (zAt(mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Kor djupt under senterlina det lågaste hjørnet i enderingen ligg. Med
 * saleskjeringa på null er kuttet tvert på skalet og hjørnet stikk ned med
 * halve tjukna gonger normalen si Z-komponent; med sale lik éin er kuttet
 * vassrett og heile endeflata ligg i golvet.
 */
function ringDz(phi: number, t: number, sale: number, ende: 0 | 1): number {
  const tx = Math.cos(phi)
  const tz = Math.sin(phi)
  const nx = -Math.sin(phi)
  const nz = Math.cos(phi)
  const ut: Pt = ende === 0 ? [-tx, -tz] : [tx, tz]
  const cut = kuttNormal(ut[0], ut[1], sale)
  const dot = ut[0] * cut[0] + ut[1] * cut[1]
  let lo = Infinity
  for (const sg of [-1, 1]) {
    const bx = nx * sg * (t / 2)
    const bz = nz * sg * (t / 2)
    const lam = Math.abs(dot) < 1e-6 ? 0 : (-bx * cut[0] - bz * cut[1]) / dot
    const zz = bz + ut[1] * lam
    if (zz < lo) lo = zz
  }
  return lo
}

/** kutteplanet i enden: 0 er tvert på skalet, 1 er flatt i golvet */
function kuttNormal(dx: number, dz: number, sale: number): Pt {
  const a = Math.atan2(dz, dx)
  const flat = -Math.PI / 2
  let d = flat - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  const b = a + d * Math.min(1, Math.max(0, sale))
  return [Math.cos(b), Math.sin(b)]
}

/**
 * SITJEFLATA, lesen av geometrien og ikkje av parametrane.
 *
 * Fanen er trappa bakover, so det ein sit på er ikkje eitt skal: det er
 * det som til kvar tid ligg ØVST langs x. Flata vert difor skanna: for
 * kvar x vert høgste oversida funnen, og sitjeflata er den samanhengande
 * strekninga kring sitjepunktet der flata både ligg nær toppen og er
 * flat nok til å sitje på. Under 28 grader er ho ei flate; over er ho ei
 * skråning, og ein sit ikkje i ei skråning.
 *
 * BERANDE SKAL er dei som når opp i det same bandet. Er fanen tett, er
 * dei fleire og dei deler lasta; er han open, ber det øvste skalet åleine.
 */
function seteMaal(skal: Skal[], p: Params, sitX: number, sitZ: number) {
  const NB = 64
  let x0 = Infinity
  let x1 = -Infinity
  for (const sk of skal) for (const q of sk.st) {
    if (q.x < x0) x0 = q.x
    if (q.x > x1) x1 = q.x
  }
  if (!Number.isFinite(x0)) return { seteD: 0, seteW: p.breidd, barande: 1, z0: sitZ }
  const dx = (x1 - x0) / NB
  const topZ = new Float64Array(NB + 1).fill(-Infinity)
  const topS = new Float64Array(NB + 1).fill(0)
  const topW = new Float64Array(NB + 1).fill(0)
  const les = (q: Stasjon) => ({
    x: q.x + q.nx * (-p.plyT / 2 + q.kr),
    z: q.z + q.nz * (-p.plyT / 2 + q.kr),
  })
  for (const sk of skal) {
    for (const q of sk.st) {
      const o = les(q)
      const j = Math.round((o.x - x0) / dx)
      if (j < 0 || j > NB) continue
      if (o.z > topZ[j]) {
        topZ[j] = o.z
        topS[j] = Math.abs(q.tz)
        topW[j] = 2 * q.w
      }
    }
  }
  // Tomme ruter mellom to fylte er ikkje hòl i møbelet, berre hòl i
  // skanninga — dei vert fylte med interpolasjon, elles ville sitjeflata
  // brotne i to av ein tilfeldig stasjonsavstand.
  for (let j = 1; j < NB; j++) {
    if (Number.isFinite(topZ[j])) continue
    let a = j - 1
    let b2 = j + 1
    while (b2 <= NB && !Number.isFinite(topZ[b2])) b2++
    if (a < 0 || b2 > NB || !Number.isFinite(topZ[a])) continue
    const f = (j - a) / (b2 - a)
    topZ[j] = topZ[a] + f * (topZ[b2] - topZ[a])
    topS[j] = topS[a] + f * (topS[b2] - topS[a])
    topW[j] = Math.min(topW[a], topW[b2])
  }
  let jTop = 0
  for (let j = 0; j <= NB; j++) if (topZ[j] > topZ[jTop]) jTop = j
  const zTop = topZ[jTop]
  const FLAT = Math.sin((28 * Math.PI) / 180)
  const BAND = 56
  const ok = (j: number) => Number.isFinite(topZ[j]) && topZ[j] > zTop - BAND && topS[j] <= FLAT
  // Toppunktet kan sjølv liggje i ei skråning; start skanninga i det
  // flataste punktet innanfor bandet i staden.
  let jStart = -1
  for (let j = 0; j <= NB; j++) if (ok(j) && (jStart < 0 || topS[j] < topS[jStart])) jStart = j
  if (jStart < 0) {
    return { seteD: 0, seteW: p.breidd, barande: 1, z0: zTop }
  }
  let ja = jStart
  let jb = jStart
  while (ja > 0 && ok(ja - 1)) ja--
  while (jb < NB && ok(jb + 1)) jb++
  const seteD = (jb - ja) * dx
  let wMin = Infinity
  let zLo = Infinity
  for (let j = ja; j <= jb; j++) {
    if (topW[j] < wMin) wMin = topW[j]
    if (topZ[j] < zLo) zLo = topZ[j]
  }
  // dei skala som når opp i det same bandet ved sitjepunktet
  let barande = 0
  for (const sk of skal) {
    let hi = -Infinity
    for (const q of sk.st) {
      const o = les(q)
      if (Math.abs(o.x - sitX) < dx * 1.6 && o.z > hi) hi = o.z
    }
    if (hi > sitZ - 26) barande++
  }
  return { seteD, seteW: wMin, barande: Math.max(1, barande), z0: zLo }
}

/** minste normalavstand mellom to naboskal sine senterliner, minus tjukna */
function gapMellom(a: Skal, b: Skal, t: number): number {
  let best = Infinity
  const step = Math.max(1, Math.floor(a.st.length / 42))
  for (let i = 0; i < a.st.length; i += step) {
    const q = a.st[i]
    let d = Infinity
    for (let j = 0; j < b.st.length; j += step) {
      const r = b.st[j]
      const dd = (q.x - r.x) ** 2 + (q.z - r.z) ** 2
      if (dd < d) d = dd
    }
    const g = Math.sqrt(d) - t
    if (g < best) best = g
  }
  return best
}

/**
 * Der ei rett line kryssar senterlina til eit skal. Teiknskiftet i den
 * vinkelrette avstanden er krysset; av fleire kryss vinn det som ligg
 * nærast punktet lina er lagd gjennom, av di det er DER dybelen sit.
 */
function kryssLine(sk: Skal, P: Pt, dir: Pt): { s: number; x: number; z: number } | null {
  const px = -dir[1]
  const pz = dir[0]
  let best: { s: number; x: number; z: number } | null = null
  let bd = Infinity
  let prev = (sk.st[0].x - P[0]) * px + (sk.st[0].z - P[1]) * pz
  for (let i = 1; i < sk.st.length; i++) {
    const q = sk.st[i]
    const d = (q.x - P[0]) * px + (q.z - P[1]) * pz
    if ((prev <= 0 && d >= 0) || (prev >= 0 && d <= 0)) {
      const f = Math.abs(d - prev) < 1e-9 ? 0 : -prev / (d - prev)
      const a = sk.st[i - 1]
      const x = a.x + f * (q.x - a.x)
      const z = a.z + f * (q.z - a.z)
      const dd = (x - P[0]) ** 2 + (z - P[1]) ** 2
      if (dd < bd) {
        bd = dd
        best = { s: a.s + f * (q.s - a.s), x, z }
      }
    }
    prev = d
  }
  return best
}

export function naerSt(st: Stasjon[], s: number): Stasjon {
  let best = st[0]
  let bd = Infinity
  for (const q of st) {
    const d = Math.abs(q.s - s)
    if (d < bd) {
      bd = d
      best = q
    }
  }
  return best
}

// =============================================================================
// SNITTET
// =============================================================================
/**
 * Motstandsmomentet i eit pressbøygd skal. Snittet er IKKJE eit rektangel:
 * krona på tvers gjer det til eit grunt renne, og eit renne har eit heilt
 * anna andrearealmoment enn ei plate av same tjukn. Krona ligg som ein
 * parabel over breidda, og middelkvadratet av avviket hennar er 0,0889
 * gonger krona i andre — det er den eine faktoren som gjer at eit skal på
 * sju millimeter kan bera nokon i det heile.
 */
export function snitt(p: Params, w: number) {
  const t = p.plyT
  const kr = p.krone
  const A = w * t
  const I = (w * t * t * t) / 12 + A * 0.0889 * kr * kr
  const c = (2 / 3) * Math.abs(kr) + t / 2
  return { A, I, W: I / Math.max(0.5, c) }
}

/** k_r etter NS-EN 1995-1-1 6.4.3 — eit bøygd felt taper bøyekapasitet,
 *  og det er tjukna på det EINSKILDE finérlaget som avgjer kor mykje */
export function krumFaktor(rInn: number, tLam: number): number {
  if (!Number.isFinite(rInn)) return 1
  return Math.min(1, 0.76 + (0.001 * rInn) / Math.max(0.2, tLam))
}

// =============================================================================
// FLATA
// =============================================================================
/**
 * Eit punkt på skalflata. v er −1 til 1 på tvers, sg er +1 for pressflata
 * som vender UT (den ein sit på) og −1 for den som vender inn.
 * Krona ligg langs normalen: midten søkk mot innsida, kantane står att.
 */
export function flatePunkt(
  q: Stasjon,
  v: number,
  sg: number,
  t: number,
): [number, number, number] {
  const off = sg * (t / 2) + q.kr * (1 - v * v)
  return [q.x + q.nx * off, v * q.w, q.z + q.nz * off]
}

/** same punktet, men skuve ut til kutteplanet i enden */
export function endePunkt(
  q: Stasjon,
  v: number,
  sg: number,
  t: number,
  cut: Pt,
  ut: Pt,
): [number, number, number] {
  const b = flatePunkt(q, v, sg, t)
  const dot = ut[0] * cut[0] + ut[1] * cut[1]
  if (Math.abs(dot) < 1e-6) return b
  const lam = ((q.x - b[0]) * cut[0] + (q.z - b[2]) * cut[1]) / dot
  return [b[0] + ut[0] * lam, b[1], b[2] + ut[1] * lam]
}

// =============================================================================
// BLANKETTEN — skalet rulla ut flatt
// =============================================================================
/**
 * Utrullinga er eksakt for eit einkrumt skal: bøyinga går kring ein akse
 * på tvers, og då er bogelengda langs senterlina uendra. Blanketten er
 * difor (s, v) rett fram — lengda langs, breidda på tvers, dybelhòlet der
 * hòlet sit. KRONA er det einaste som ikkje let seg rulle ut: ho er ei
 * dobbelkrumming, og ho må presset ta ved å strekkje finéren.
 */
export function blankett(sk: Skal, p: Params, steg = 2): { outline: Pt[]; holes: Pt[][] } {
  const top: Pt[] = []
  const bot: Pt[] = []
  for (let i = 0; i < sk.st.length; i += steg) {
    const q = sk.st[i]
    top.push([q.s, q.w])
    bot.push([q.s, -q.w])
  }
  const last = sk.st[sk.st.length - 1]
  top.push([last.s, last.w])
  bot.push([last.s, -last.w])
  const outline = bot.concat(top.reverse())
  const r = (p.pinnD + p.pinnhol) / 2
  const holes: Pt[][] = []
  const w = naerSt(sk.st, sk.sPin).w
  if (r > 0.5 && r < w * 0.8) {
    const ring: Pt[] = []
    for (let i = 15; i >= 0; i--) {
      const a = (i / 16) * Math.PI * 2
      ring.push([sk.sPin + r * Math.cos(a), r * Math.sin(a)])
    }
    holes.push(ring)
  }
  return { outline, holes }
}

/** bogelengdene der forma skiftar krumming — bøyelinene på blanketten */
export function boyeliner(sk: Skal): { s: number; label: string; r: number }[] {
  const out: { s: number; label: string; r: number }[] = []
  let s = 0
  for (const so of sk.soner) {
    s += so.len
    if (so === sk.soner[sk.soner.length - 1]) break
    out.push({ s, label: so.label, r: soneR(so) })
  }
  return out
}
