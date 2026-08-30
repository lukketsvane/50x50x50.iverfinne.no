/**
 * RIBBE — bladet.
 *
 * Eit blad er ein meridian i skalet: ein flat kontur i eit loddrett plan.
 * Står vridinga på null, går planet gjennom aksen og konturen er skalet
 * sitt snitt ved sin eigen vinkel. Står ho ikkje på null, er planet skuva
 * sidevegs — det tek tak i navet ved sin eigen vinkel og peikar ut i ein
 * annan. Bladet er framleis flatt, og det er heile poenget: eit vridd
 * objekt der kvar del framleis kan skjerast ut av ei plate.
 *
 * Difor reknar denne fila i bladet sitt eige koordinat `s`, avstanden ut
 * langs bladlina frå navet, og ikkje i radius. Radien langs lina er
 *
 *     ρ(s)² = rNav² + 2·(A·d)·s + s²
 *
 * ei andregradslikning som let seg snu båe vegar, så «kvar er radius 120»
 * er eit uttrykk og ikkje eit søk. Berre ytterkanten må leitast fram, av
 * di skalet sin radius der endrar seg med vinkelen lina passerer.
 */
import { smooth, type Pt } from "../core"
import type { Shell } from "./shell"
import type { Station } from "./solid"

/** kor lang den flate foten er, mm — objektet skal stå på ein fot og ikkje
 *  på ein spiss, og ein spiss gjev dessutan ei endeflate utan areal */
const FOOT_FLAT = 16

/** kor langt frå kvarandre dei to stasjonane i eit sprang står, mm */
const STEP_EPS = 0.01

export type Blade = {
  k: number
  /** vinkelen bladet tek tak i navet i */
  phi: number
  /** retninga bladlina peikar i */
  psi: number
  d: Pt
  n: Pt
  a: Pt
  /** A·d — halve fyrstegradsleddet i radiuslikninga */
  c: number
}

export function makeBlade(sh: Shell, k: number): Blade {
  const phi = sh.angles[k]
  const psi = phi + sh.tw
  const a: Pt = [sh.rHub * Math.cos(phi), sh.rHub * Math.sin(phi)]
  const d: Pt = [Math.cos(psi), Math.sin(psi)]
  return {
    k,
    phi,
    psi,
    d,
    n: [-Math.sin(psi), Math.cos(psi)],
    a,
    c: a[0] * d[0] + a[1] * d[1],
  }
}

/** punktet på bladlina, i verda */
export const bladePt = (b: Blade, s: number): Pt => [b.a[0] + s * b.d[0], b.a[1] + s * b.d[1]]

/** radius frå aksen ved s */
export const radAt = (b: Blade, rHub: number, s: number) =>
  Math.sqrt(Math.max(0, rHub * rHub + 2 * b.c * s + s * s))

/** s ved ein gjeven radius — den positive rota */
export const sAtRad = (b: Blade, rHub: number, rho: number) => {
  const disc = b.c * b.c + rho * rho - rHub * rHub
  return disc <= 0 ? 0 : Math.max(0, -b.c + Math.sqrt(disc))
}

export const angAt = (b: Blade, s: number) => {
  const q = bladePt(b, s)
  return Math.atan2(q[1], q[0])
}

/**
 * Ytterkanten ved høgda z. Lina kryssar bladkonturen der radien langs
 * henne møter bladradien i den vinkelen ho då står i, og båe sider veks,
 * så halveringa er den einaste som toler at planet står på skrå.
 *
 * `rBlade` og ikkje `rOuter`: bladet kan stikke fram forbi skalet, og då
 * er det tuppen og ikkje skalet som seier kvar bladet sluttar. Banda les
 * framleis skalet, so eit blad med tupp stikk fram FORBI ringen — det er
 * heile skilnaden på ein jamn kontur og ei vifte av frie tunger.
 */
export function sOuterAt(sh: Shell, b: Blade, z: number): number {
  let lo = 0
  let hi = 4 * sh.R + sh.rHub
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (radAt(b, sh.rHub, m) < sh.rBlade(angAt(b, m), z)) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** eitt kryssholdt ledd mot eit band, i bladet sitt koordinat */
export type Slot = {
  j: number
  /** høgda bandet ligg i, mm */
  z: number
  /** spora si nedre og øvre kant, med klaring */
  z0: number
  z1: number
  /** kor langt inn sporet er skore */
  sRoot: number
  /** ytterkanten der sporet byrjar */
  sOut: number
  /** radiane leddet ligg mellom */
  rRoot: number
  rOut: number
}

/**
 * Leddet er kryssholdt: overlappen mellom bandet og bladet vert delt, og
 * kvar av dei tek sin part. Overlappen er `bandbreidd − bandutstikk` same
 * kvar på ringen ein står, av di båe er målte frå den same ytre kanten —
 * difor er dette eit uttrykk og ikkje ei tabell.
 *
 * `bandLapp` seier KVAR i overlappen delinga ligg. Halvt om halvt er det
 * gamle, og for ein ring er det rett: båe delane er like breie og skal
 * missa like mykje. For ei HYLLE er det feil. Overlappen er då mest heile
 * plata, og halvt om halvt ville skore hundre millimeter inn i eit blad
 * som er hundre og femti breitt — bladet vert kappa av leddet sitt eige
 * ledd. Ei hylle er difor ei plate med DJUPE spor som fell ned over blad
 * med GRUNNE hakk, og det er nøyaktig det ein bygg i verkstaden òg.
 */
export function bladeSlots(sh: Shell, b: Blade): Slot[] {
  const p = sh.p
  const out: Slot[] = []
  const half = p.bandT / 2 + p.fit
  for (let j = 0; j < sh.bandZ.length; j++) {
    const z = sh.bandZ[j]
    const sOut = sOuterAt(sh, b, z)
    const rOut = radAt(b, sh.rHub, sOut)
    const lap = p.bandW - p.bandOut
    const rRoot = rOut - Math.max(0, lap) * p.bandLapp
    out.push({
      j,
      z,
      z0: z - half,
      z1: z + half,
      sRoot: sAtRad(b, sh.rHub, rRoot),
      sOut,
      rRoot,
      rOut,
    })
  }
  return out
}

export type BladeGeom = {
  b: Blade
  slots: Slot[]
  st: Station[]
  /** dei indre hjørna i spora, i (s, z) — avlastinga vert bora her */
  corners: Pt[]
  /** mortisen for kila over øvste bandet, om han får plass */
  mortise: Pt[] | null
  /** smalaste vev mellom ytre og indre kant, mm */
  web: number
  /** kor langt ut foten står, mm */
  footR: number
}

/**
 * Stasjonane bladet vert bygd av: for kvar høgd, kva band av `s` som er
 * material. Spora er sprang — to stasjonar på same høgd med ulikt band —
 * og det er nett difor nettet kan ha eit spor i seg og framleis vera lukka.
 */
export function bladeGeom(sh: Shell, k: number, nz: number): BladeGeom {
  const p = sh.p
  const b = makeBlade(sh, k)
  const slots = bladeSlots(sh, b)
  const zB = sh.zBlade
  const cr = Math.min(p.corner, zB * 0.1)

  const sTop = sOuterAt(sh, b, zB)
  const sBot = sOuterAt(sh, b, 0)
  const aTop = sAtRad(b, sh.rHub, sh.rInner(zB))

  /** ytterkanten, med hjørneradius i topp og botn. Bogen er lagd som ein
   *  sirkel mot ein loddrett kant; er kanten på skrå, er avviket mindre
   *  enn fresen sin eigen radius og difor ikkje verdt å løysa eksakt. */
  const bFull = (z: number) => {
    let s = sOuterAt(sh, b, z)
    if (cr > 0.05) {
      if (z > zB - cr) s = Math.min(s, sTop - cr + Math.sqrt(Math.max(0, cr * cr - (z - (zB - cr)) ** 2)))
      if (z < cr) s = Math.min(s, sBot - cr + Math.sqrt(Math.max(0, cr * cr - (z - cr) ** 2)))
    }
    return s
  }

  // fotbogen: botnkanten stig innover mot navet, så objektet står på
  // ytterendane og ikkje på ei vifte av vassrette kantar
  const arc = Math.min(p.footArc, zB * 0.45)
  const sIn0 = sAtRad(b, sh.rHub, sh.rInner(0))
  const sFlat = Math.max(sIn0 + 1, sBot - FOOT_FLAT - cr)
  const footInv = (z: number) => {
    if (arc <= 0.01 || z >= arc) return -Infinity
    let lo = sIn0
    let hi = sFlat
    for (let i = 0; i < 28; i++) {
      const m = (lo + hi) / 2
      if (arc * smooth((sFlat - m) / (sFlat - sIn0)) > z) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }

  const aFull = (z: number) => {
    let s = Math.max(sAtRad(b, sh.rHub, sh.rInner(z)), footInv(z))
    if (cr > 0.05 && z > zB - cr) {
      s = Math.max(s, aTop + cr - Math.sqrt(Math.max(0, cr * cr - (z - (zB - cr)) ** 2)))
    }
    return s
  }

  const bAt = (z: number) => {
    let s = bFull(z)
    for (const q of slots) if (z > q.z0 && z < q.z1) s = Math.min(s, q.sRoot)
    return s
  }

  // merkene er dei høgdene geometrien gjer noko ved: golv, sporkantar,
  // fotbogen sin topp og undersida av setet
  const marks = new Set<number>([0, zB])
  for (const q of slots) {
    if (q.z0 > 0.5 && q.z0 < zB - 0.5) marks.add(q.z0)
    if (q.z1 > 0.5 && q.z1 < zB - 0.5) marks.add(q.z1)
  }
  const ms = [...marks].sort((x, y) => x - y)

  const st: Station[] = []
  const put = (z: number, s: number) => {
    const bb = s
    const aa = Math.min(aFull(z), bb - 3)
    st.push({ u: z, a: Math.max(0, aa), b: bb })
  }
  for (let i = 0; i + 1 < ms.length; i++) {
    const z0 = ms[i]
    const z1 = ms[i + 1]
    const e = (z1 - z0) * 1e-6
    const steps = Math.max(2, Math.round((nz * (z1 - z0)) / zB))
    // Fyrste stasjonen i strekket er den andre halvdelen av spranget ved
    // z0. Spranget står ikkje på nøyaktig same høgd, men ein hundredels
    // millimeter under: to stasjonar på nøyaktig same u gjev ein T-skøyt i
    // topp- og botnflata — ei sliver med null areal, som ingen ser, men
    // som let seks kantar per spor stå att utan motpart. Hundredelen er
    // tjue gonger under sporklaringa og fem gonger over det Float32 kan
    // skilje på denne storleiken.
    put(z0, bAt(z0 + e))
    for (let q = 1; q < steps; q++) put(z0 + ((z1 - z0) * q) / steps, bAt(z0 + ((z1 - z0) * q) / steps))
    put(i + 2 < ms.length ? z1 - STEP_EPS : z1, bAt(z1 - e))
  }

  /**
   * Vevdjupna er avstanden mellom dei to KANTANE, ikkje breidda på det
   * bandet stasjonane held. Fotbogen og hjørneradien snevrar inn bandet i
   * endane utan at veven er smalare der — måler ein på stasjonane, får ein
   * lengda på fotflata i staden for djupna på veven, og det er eit heilt
   * anna tal.
   */
  let web = Infinity
  for (let i = 0; i <= nz; i++) {
    const z = (zB * i) / nz
    web = Math.min(web, sOuterAt(sh, b, z) - sAtRad(b, sh.rHub, sh.rInner(z)))
  }

  const corners: Pt[] = []
  for (const q of slots) {
    corners.push([q.sRoot, q.z0], [q.sRoot, q.z1])
  }

  // Kila står over øvste bandet og dreg det ned mot sporbotnen. Mortisen
  // får berre plass om bandet sin eigen tunge er lang nok; er han ikkje
  // det, er det ingen kile, og regelen seier frå.
  const top = slots[slots.length - 1]
  let mortise: Pt[] | null = null
  if (top) {
    const run = top.sOut - top.sRoot
    const len = Math.min(run - 4, p.bladeT)
    const hgt = Math.max(10, p.bladeT * 1.2)
    if (len >= 8 && top.z1 + hgt + 6 < zB) {
      const s0 = top.sRoot + (run - len) / 2
      mortise = [
        [s0, top.z1],
        [s0 + len, top.z1],
        [s0 + len, top.z1 + hgt],
        [s0, top.z1 + hgt],
      ]
    }
  }

  return { b, slots, st, corners, mortise, web, footR: radAt(b, sh.rHub, sBot) }
}
