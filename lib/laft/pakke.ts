/**
 * PAKKEN — og han er ikkje eit brett.
 *
 * Fyrste utgåva av denne fila søkte fram det minste rektangelet som tok
 * alle delane NESTA ved sida av kvarandre, og skar ei hank i avkappet.
 * Referansane seier at det er feil spørsmål. Tre av dei fem syner den
 * flatpakka tilstanden, og alle tre syner det same: platene ligg FLATE
 * MOT KVARANDRE i ein stabel som står oppreist på sine eigne føter.
 * Ikkje eitt av bileta syner eit brett med delane nesta side ved side.
 *
 * Skilnaden er ikkje kosmetisk, han er tre ting:
 *
 *   FORMA   Pakken har ikkje ei eiga form. Ytterkonturen ER den største
 *           delen — med sine eigne runda hjørne, sitt eige hòl og sitt
 *           eige kutt i underkanten. Dei mindre platene ligg inne i den
 *           konturen og trappar seg innover. Eit runda rektangel kring
 *           delane er ei innpakning, og ei innpakning er ikkje møbel.
 *   TALET   Eit brett er to tal og ein prosent. Ein stabel er TRE tal —
 *           lengd, breidd og tjukn — og utnyttinga er hundre prosent, av
 *           di alt ein ber er stol. Brettet på 925 × 841 for
 *           standardstolen bar fire kilo finér som ikkje var møbel: meir
 *           enn stolen sjølv vog.
 *   GRENSA  Og då kan pakken målast mot den SAME kuben som stolen. Det er
 *           den einaste grensa oppgåva gjev, og det er den einaste grensa
 *           ein pakke kan bryte.
 *
 * Ein ting bileta gjer som denne motoren ikkje kan love: kilen som låser
 * stabelen. Der står han driven gjennom heile bunten. LAFT sine spor
 * møtest ikkje når platene ligg oppå kvarandre — tappespora sit der
 * bladtoppane står, ryggsporet bakerst i setet — so ein slik lås måtte
 * PEIKAST UT og ikkje reknast fram. Han er ikkje her, og det er ærlegare
 * enn å teikne ein kile som ikkje ville gått gjennom noko.
 */
import type { Pt } from "../core"
import type { Part } from "./parts"

/** ein del lagd flat i stabelen: omrisset snudd og flytt på plass */
export type Lag = {
  part: Part
  outline: Pt[]
  holes: Pt[][]
  /** delen sine mål etter snuinga */
  w: number
  h: number
}

export type Stabel = {
  /** dei tre måla: lengste del, breiaste del, summen av tjuknene */
  L: number
  B: number
  D: number
  /** delen som gjev omrisset — pakken har ingen eigen form */
  omslag: Lag
  /** dei andre, størst fyrst, slik dei ligg bak omslaget */
  bak: Lag[]
  /** hòlet ein ber etter: eit hòl i omslaget som ingen annan del dekkjer */
  hank: Pt[] | null
  /** kor mange av dei andre delane som står heilt inne i omslaget */
  inni: number
}

/**
 * Minste omskrivne rektangel, ved roterande kaliper. Ein del kan snuast
 * fritt i stabelen — det er ingen fiberretning å ta omsyn til når han
 * ligg i ein bunt — so det er DETTE rektangelet som er delen sine mål, og
 * ikkje det aksefaste. Skilnaden er ikkje liten: eit blad som ligg på
 * skrå i sitt eige plan måler tjue prosent meir aksefast enn det gjer i
 * røynda.
 */
function minRekt(pts: Pt[]): { w: number; h: number; th: number } {
  let best = { w: Infinity, h: Infinity, th: 0 }
  for (let d = 0; d < 90; d += 1) {
    const th = (d * Math.PI) / 180
    const c = Math.cos(th)
    const s = Math.sin(th)
    let u0 = Infinity
    let u1 = -Infinity
    let v0 = Infinity
    let v1 = -Infinity
    for (const [x, y] of pts) {
      const u = x * c + y * s
      const v = -x * s + y * c
      if (u < u0) u0 = u
      if (u > u1) u1 = u
      if (v < v0) v0 = v
      if (v > v1) v1 = v
    }
    if ((u1 - u0) * (v1 - v0) < best.w * best.h) best = { w: u1 - u0, h: v1 - v0, th }
  }
  return best
}

/**
 * Legg ein del flat: snudd so den lange sida ligg vassrett, og flytt so
 * MIDTEN AV UNDERKANTEN ligg i origo. Botnjustering og ikkje
 * senterjustering, av di stabelen står på golvet på sine eigne føter, og
 * det er underkantane som møtest.
 */
function leggFlat(part: Part): Lag {
  const r = minRekt(part.outline)
  const th = r.w >= r.h ? r.th : r.th + Math.PI / 2
  const c = Math.cos(th)
  const s = Math.sin(th)
  const snu = (ring: Pt[]): Pt[] => ring.map(([x, y]) => [x * c + y * s, -x * s + y * c] as Pt)
  const o = snu(part.outline)
  let u0 = Infinity
  let u1 = -Infinity
  let v0 = Infinity
  let v1 = -Infinity
  for (const [u, v] of o) {
    if (u < u0) u0 = u
    if (u > u1) u1 = u
    if (v < v0) v0 = v
    if (v > v1) v1 = v
  }
  const dx = -(u0 + u1) / 2
  const dy = -v0
  const flytt = (ring: Pt[]): Pt[] => ring.map(([u, v]) => [u + dx, v + dy] as Pt)
  return {
    part,
    outline: flytt(o),
    holes: part.holes.map((h) => flytt(snu(h))),
    w: u1 - u0,
    h: v1 - v0,
  }
}

function iRing(ring: Pt[], x: number, y: number): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}

/**
 * HANKEN ER FRAMLEIS FUNNEN OG IKKJE SKOREN — men no i møbelet, ikkje i
 * avkappet. I bileta er hòlet ein ber pakken etter nøyaktig det same
 * hòlet ein seinare ber stolen etter: same form, same plass, same del.
 * Den førre utgåva skar eit ANDRE hòl i skrotet, so eksporten hadde to
 * hankar — den ekte der nestaren tilfeldigvis la ryggen, og ein oppdikta
 * ein ved sida av.
 *
 * Spørsmålet er difor berre: har omslaget eit hòl høgt nok oppe til at ei
 * hand kjem til, og som ingen av dei andre platene dekkjer når dei ligg
 * bak? Finst det ikkje, har pakken ingen hank, og tavla seier frå.
 */
function finnHank(omslag: Lag, bak: Lag[]): Pt[] | null {
  let beste: Pt[] | null = null
  let bestH = -Infinity
  for (const h of omslag.holes) {
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const [x, y] of h) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    // ei hand treng eit hòl på minst hundre gonger tjuefem
    if (x1 - x0 < 100 || y1 - y0 < 25) continue
    // og det må sitje i den øvre halvdelen: ein ber ovanfrå
    const cy = (y0 + y1) / 2
    if (cy < omslag.h * 0.5) continue
    // ingen annan plate får liggje i det
    const prov: Pt[] = [
      [x0 + 4, cy],
      [x1 - 4, cy],
      [(x0 + x1) / 2, cy],
    ]
    const sperra = bak.some((l) =>
      prov.some(([x, y]) => iRing(l.outline, x, y) && !l.holes.some((q) => iRing(q, x, y))),
    )
    if (sperra) continue
    if (cy > bestH) {
      bestH = cy
      beste = h
    }
  }
  return beste
}

export function stabel(parts: Part[]): Stabel {
  const lag = parts.map(leggFlat).sort((a, b) => b.w * b.h - a.w * a.h)
  const omslag = lag[0]
  const bak = lag.slice(1)
  let L = 0
  let B = 0
  let D = 0
  for (const l of lag) {
    if (l.w > L) L = l.w
    if (l.h > B) B = l.h
    D += l.part.t
  }
  // Kor mange av dei andre som står HEILT inne i omslaget. I bileta er
  // svaret alle — det er difor pakken der ser ut som éi plate, og det er
  // eit mål på om delane er i slekt med kvarandre i storleik.
  const inni = bak.filter((l) => l.outline.every(([x, y]) => iRing(omslag.outline, x, y))).length
  return { L, B, D, omslag, bak, hank: finnHank(omslag, bak), inni }
}

/** kuben oppgåva gjev, i mm */
const KUBE = 500

/**
 * Står stabelen i kuben? Ei plate på L × B × D med B under kubesida får
 * plass anten beint fram, eller lagd på SKRÅ: eit rektangel på L × D står
 * i eit kvadrat på 500 når (L + D)/√2 ≤ 500, altså L + D ≤ 707. Det er
 * ikkje ein teknikalitet — det er slik ein faktisk legg ei lang plate i
 * ein kasse — og skilnaden mellom «beint» og «på skrå» er verd å melde.
 */
export function iKuben(s: Stabel): "beint" | "på skrå" | "nei" {
  if (s.B > KUBE || s.D > KUBE) return "nei"
  if (s.L <= KUBE) return "beint"
  return s.L + s.D <= KUBE * Math.SQRT2 ? "på skrå" : "nei"
}

/**
 * Pakken som teikning: omslaget heilt, dei andre bak seg i minkande
 * storleik, og hanken merkt med tjukk strek. Målestokken er millimeter,
 * som i alle dei andre arka her, so eit uttak kan målast rett av fila.
 */
export function stabelSvg(s: Stabel): string {
  const M = 24
  const W = s.L + 2 * M
  const H = s.B + 2 * M
  const bane = (ring: Pt[]) =>
    ring.map(([x, y], i) => `${i ? "L" : "M"}${(x + W / 2).toFixed(1)},${(H - M - y).toFixed(1)}`).join("") + "Z"
  const ut: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">`,
  ]
  // bakarst fyrst, so omslaget legg seg over dei
  for (let i = s.bak.length - 1; i >= 0; i--) {
    const l = s.bak[i]
    ut.push(`<path d="${bane(l.outline)}" fill="#ffffff" stroke="#111" stroke-width="0.9" opacity="0.45"/>`)
    for (const h of l.holes) {
      ut.push(`<path d="${bane(h)}" fill="none" stroke="#111" stroke-width="0.7" opacity="0.45"/>`)
    }
  }
  ut.push(`<path d="${bane(s.omslag.outline)}" fill="#ffffff" fill-opacity="0.88" stroke="#111" stroke-width="1.5"/>`)
  for (const h of s.omslag.holes) {
    ut.push(`<path d="${bane(h)}" fill="#ffffff" stroke="#111" stroke-width="1.1"/>`)
  }
  if (s.hank) ut.push(`<path d="${bane(s.hank)}" fill="none" stroke="#111" stroke-width="2.6"/>`)
  ut.push("</svg>")
  return ut.join("")
}
