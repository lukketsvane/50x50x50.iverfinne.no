/**
 * FLETT — nettet, i tre lesemåtar.
 *
 *   flate   vevflata som EIN glatt hud, med ramma slik ho ville sett ut om
 *           ho var eitt stykke. Den idealiserte forma banda tilnærmar.
 *   lag     objektet SLIK DET ER BYGT: kvart band for seg med sine ekte
 *           over- og under-gangar, ramma kutta i dei bogane
 *           rammelukkinga seier, beina, tverrbanda og ryggbogen.
 *   kontur  kvar bandstrimmel flat med si eigne kuttlengd, og
 *           rammedelane sine omriss ved sida av.
 *
 * Alt her er bygt av TO former: eit ROYR (ein lukka profil dregen langs ei
 * line) og ei PLATE (ei flate mellom to kantkurver, tjukna på begge sider).
 * Ingen av dei treng øyreklipping, og det er med vilje: øyreklipparen er
 * den einaste staden i sandkassen der eit lok kan verta ståande ope, og ein
 * vev har ikkje eitt einaste polygon som treng han.
 */
import { bbox, type Pt, type Vec3 } from "../core"
import { buildParts } from "./parts"
import { bowGeom, cross3, norm3, sub3, type Band, type Weave } from "./weave"

export const DETAIL = {
  lav: { k: 0.55 },
  mid: { k: 1 },
  hog: { k: 1.8 },
} as const

type Soup = { pos: number[]; nrm: number[]; kan: number[]; k: number }
const newSoup = (): Soup => ({ pos: [], nrm: [], kan: [], k: 1 })

function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz) || 1
  nx /= L; ny /= L; nz /= L
  s.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let i = 0; i < 3; i++) s.nrm.push(nx, ny, nz)
  s.kan.push(s.k, s.k, s.k)
}

const quad = (s: Soup, a: Vec3, b: Vec3, c: Vec3, d: Vec3) => {
  tri(s, a, b, c)
  tri(s, a, c, d)
}

/**
 * Lukkar eitt legeme og set det rett veg. Topologien er alt rett — kvar
 * retta kant har makkeren sin — men VINDINGA kan vera snudd av at ei
 * kurve kom inn med motsett laup. I staden for å resonnere om laupet i
 * kvart einaste kall, vert volumet rekna på det som nett vart lagt til, og
 * er det negativt, byter kvar trekant to hjørne. Det er billeg, og det gjer
 * «innsida-ut» umogleg per konstruksjon.
 */
function sealed(s: Soup, fn: () => void) {
  const from = s.pos.length
  fn()
  let v = 0
  for (let i = from; i < s.pos.length; i += 9) {
    const ax = s.pos[i], ay = s.pos[i + 1], az = s.pos[i + 2]
    const bx = s.pos[i + 3], by = s.pos[i + 4], bz = s.pos[i + 5]
    const cx = s.pos[i + 6], cy = s.pos[i + 7], cz = s.pos[i + 8]
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  if (v >= 0) return
  for (let i = from; i < s.pos.length; i += 9) {
    for (let c = 0; c < 3; c++) {
      const t = s.pos[i + 3 + c]
      s.pos[i + 3 + c] = s.pos[i + 6 + c]
      s.pos[i + 6 + c] = t
      s.nrm[i + c] = -s.nrm[i + c]
      s.nrm[i + 3 + c] = -s.nrm[i + 3 + c]
      s.nrm[i + 6 + c] = -s.nrm[i + 6 + c]
    }
  }
}

function soupToMesh(s: Soup) {
  const positions = new Float32Array(s.pos)
  const normals = new Float32Array(s.nrm)
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c]
      if (v < min[c]) min[c] = v
      if (v > max[c]) max[c] = v
    }
  }
  if (!Number.isFinite(min[0])) { min[0] = min[1] = min[2] = 0; max[0] = max[1] = max[2] = 1 }
  return {
    positions,
    normals,
    kant: new Float32Array(s.kan),
    tris: positions.length / 9,
    min,
    max,
  }
}

// =============================================================================
// ROYR — ein lukka profil dregen langs ei line
// =============================================================================
/**
 * `sec` er ei rekkje like lange ringar. Sideflatene vert sydde ring mot
 * ring, og er lina open, vert begge endane lokka med profilen sin eigen
 * ring — ein gong framlengs og ein gong baklengs, so kvar retta kant i
 * loket møter makkeren sin i veggen.
 */
function tube(s: Soup, sec: Vec3[][], closed: boolean, kantOf: (e: number) => number) {
  const n = sec.length
  if (n < 2) return
  const m = sec[0].length
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const A = sec[i]
    const B = sec[(i + 1) % n]
    for (let e = 0; e < m; e++) {
      const e2 = (e + 1) % m
      s.k = kantOf(e)
      quad(s, A[e], A[e2], B[e2], B[e])
    }
  }
  if (closed) return
  s.k = 1
  const a = sec[0]
  const z = sec[n - 1]
  for (let e = 1; e + 1 < m; e++) {
    tri(s, a[0], a[m - e], a[m - e - 1])
    tri(s, z[0], z[e], z[e + 1])
  }
}

// =============================================================================
// PLATE — flata mellom to kantkurver, tjukna langs ein fast vektor
// =============================================================================
function slab(s: Soup, L: Vec3[], R: Vec3[], off: Vec3, kFace = 0, kEdge = 1) {
  const n = Math.min(L.length, R.length)
  if (n < 2) return
  const h: Vec3 = [off[0] / 2, off[1] / 2, off[2] / 2]
  const A = (p: Vec3): Vec3 => [p[0] + h[0], p[1] + h[1], p[2] + h[2]]
  const B = (p: Vec3): Vec3 => [p[0] - h[0], p[1] - h[1], p[2] - h[2]]
  s.k = kFace
  for (let i = 0; i + 1 < n; i++) {
    quad(s, A(L[i]), A(R[i]), A(R[i + 1]), A(L[i + 1]))
    quad(s, B(L[i]), B(L[i + 1]), B(R[i + 1]), B(R[i]))
  }
  s.k = kEdge
  for (let i = 0; i + 1 < n; i++) {
    quad(s, A(L[i]), A(L[i + 1]), B(L[i + 1]), B(L[i]))
    quad(s, A(R[i + 1]), A(R[i]), B(R[i]), B(R[i + 1]))
  }
  quad(s, A(R[0]), A(L[0]), B(L[0]), B(R[0]))
  quad(s, A(L[n - 1]), A(R[n - 1]), B(R[n - 1]), B(L[n - 1]))
}

// =============================================================================
// HUD — ei tjukk flate over eit rutenett
// =============================================================================
/** topp- og botnflate over eit (i, j)-rutenett, med vegg heile vegen rundt */
function gridSlab(
  s: Soup,
  NI: number,
  NJ: number,
  at: (i: number, j: number) => { top: Vec3; bot: Vec3 },
) {
  const T: Vec3[][] = []
  const B: Vec3[][] = []
  for (let i = 0; i <= NI; i++) {
    const rt: Vec3[] = []
    const rb: Vec3[] = []
    for (let j = 0; j <= NJ; j++) {
      const q = at(i, j)
      rt.push(q.top)
      rb.push(q.bot)
    }
    T.push(rt)
    B.push(rb)
  }
  s.k = 0
  for (let i = 0; i < NI; i++) {
    for (let j = 0; j < NJ; j++) {
      quad(s, T[i][j], T[i + 1][j], T[i + 1][j + 1], T[i][j + 1])
      quad(s, B[i][j], B[i][j + 1], B[i + 1][j + 1], B[i + 1][j])
    }
  }
  // Veggen rundt heile rutenettet. Kvar av dei fire kantane må gå MOTSETT
  // veg av flata han deler kant med — det er den regelen, og ikkje
  // normalane, som avgjer om huda er lukka.
  s.k = 1
  for (let i = 0; i < NI; i++) {
    quad(s, T[i + 1][0], T[i][0], B[i][0], B[i + 1][0])
    quad(s, T[i][NJ], T[i + 1][NJ], B[i + 1][NJ], B[i][NJ])
  }
  for (let j = 0; j < NJ; j++) {
    quad(s, T[0][j], T[0][j + 1], B[0][j + 1], B[0][j])
    quad(s, T[NI][j + 1], T[NI][j], B[NI][j], B[NI][j + 1])
  }
}

// =============================================================================
// BANDA
// =============================================================================
/**
 * Rammene langs ei line, med parallellflytting so bandet ikkje vrir seg.
 *
 * `hint` er kva veg bandet er BREITT: på tvers av sin eigen laup, i planet.
 * Han må gjevast utanfrå og kan ikkje reknast av lina, av di lina byrjar i
 * ein festetamp som peikar rett NED — og der er kryssproduktet med loddlina
 * null. Utan hintet fell breidderetninga tilbake på ein vilkårleg akse, og
 * eit band som er førti millimeter breitt legg seg då på høgkant heilt inn
 * i veven. Feilen syner seg berre i omhyllinga, og difor må ho stengjast
 * her og ikkje oppdagast der.
 */
function frames(pts: Vec3[], hint: Vec3): { T: Vec3; S: Vec3; N: Vec3 }[] {
  const n = pts.length
  const out: { T: Vec3; S: Vec3; N: Vec3 }[] = []
  let S: Vec3 = hint
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const T = norm3(sub3(b, a))
    if (i === 0) {
      const d0 = hint[0] * T[0] + hint[1] * T[1] + hint[2] * T[2]
      const proj: Vec3 = [hint[0] - d0 * T[0], hint[1] - d0 * T[1], hint[2] - d0 * T[2]]
      if (Math.hypot(proj[0], proj[1], proj[2]) > 0.15) S = norm3(proj)
      else {
        const c = cross3([0, 0, 1], T)
        S = Math.hypot(c[0], c[1], c[2]) > 0.15 ? norm3(c) : hint
      }
    }
    // Gram-Schmidt mot den førre: ei line som snur ned i eit feste ville
    // gjeve eit kollaps om S vart rekna av loddrett kvar gong.
    const d = S[0] * T[0] + S[1] * T[1] + S[2] * T[2]
    let s2: Vec3 = [S[0] - d * T[0], S[1] - d * T[1], S[2] - d * T[2]]
    if (Math.hypot(s2[0], s2[1], s2[2]) < 1e-6) s2 = [0, 1, 0]
    S = norm3(s2)
    out.push({ T, S, N: norm3(cross3(T, S)) })
  }
  return out
}

function bandSolid(s: Soup, band: Band, step: number) {
  const pts: Vec3[] = []
  const n = band.pts.length
  // tampane skal alltid vera med — det er dei som viser kva slag feste
  // dette er — so utglisinga rører berre den fletta midten
  for (let i = 0; i < n; i++) {
    const tamp = i <= band.tail0 || i >= n - 1 - band.tail1
    if (tamp || i % step === 0 || i === n - 1) pts.push(band.pts[i])
  }
  if (pts.length < 3) return
  // Renninga er brei på tvers av Y, innslaget på tvers av X.
  const fr = frames(pts, band.dir === 0 ? [0, 1, 0] : [1, 0, 0])
  const hw = band.w / 2
  const ht = band.t / 2
  const sec: Vec3[][] = pts.map((p, i) => {
    const { S, N } = fr[i]
    const c = (a: number, b: number): Vec3 => [
      p[0] + S[0] * a + N[0] * b,
      p[1] + S[1] * a + N[1] * b,
      p[2] + S[2] * a + N[2] * b,
    ]
    return [c(hw, ht), c(-hw, ht), c(-hw, -ht), c(hw, -ht)]
  })
  sealed(s, () => tube(s, sec, false, (e) => (e === 0 || e === 2 ? 0 : 1)))
}

// =============================================================================
// RAMMA
// =============================================================================
/** ein bogesektor av ramma, eller heile ringen når th1 − th0 er heile omdreiinga */
function rimSolid(s: Soup, w: Weave, th0: number, th1: number, nth: number, senk = 0, brei = 1) {
  const p = w.p
  const full = Math.abs(th1 - th0 - Math.PI * 2) < 1e-6
  let span = th1 - th0
  while (span <= 0) span += Math.PI * 2
  const N = Math.max(6, Math.round((nth * span) / (Math.PI * 2)))
  const sec: Vec3[][] = []
  for (let i = 0; i <= N; i++) {
    if (full && i === N) break
    const th = th0 + (span * i) / N
    const r = w.innR(th)
    const h = p.rammeH * brei
    const ri = r
    const ro = r + h
    const ct = Math.cos(th)
    const st = Math.sin(th)
    const zt = w.zRim(((ri + ro) / 2) * ct) + w.rimOff - senk
    const zb = zt - p.rammeT
    sec.push([
      [ri * ct, ri * st, zb],
      [ro * ct, ro * st, zb],
      [ro * ct, ro * st, zt],
      [ri * ct, ri * st, zt],
    ])
  }
  sealed(s, () => tube(s, sec, full, (e) => (e === 0 || e === 2 ? 0 : 1)))
}

/**
 * Eit bladbein: ei flat plate i planet som inneheld radien og loddlina.
 * Ho spriker utover med `spreie`, og breidda fell frå ei brei rot under
 * ramma til foten sin `beinB` etter bogeforma — det er den kurva som gjer
 * at silhuetten mellom beina les som ein boge og ikkje som eit gap.
 */
function legSolid(s: Soup, w: Weave, th: number, k: number) {
  const p = w.p
  const r0 = w.innR(th) + p.rammeH / 2
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const zTop = w.zRim(r0 * ct) + w.rimOff - p.rammeT + 1
  if (zTop < 40) return
  const rot = Math.min(p.rammeH * 1.7, Math.max(p.beinB * 1.35, p.beinB + 24))
  const dR = Math.tan(p.spreie * (Math.PI / 180)) * zTop
  const N = Math.max(8, Math.round(11 * k))
  const L: Vec3[] = []
  const R: Vec3[] = []
  const put = (t: number, shrink: number) => {
    const z = zTop * (1 - t)
    const c = dR * t
    const hw =
      p.beinB / 2 +
      ((rot - p.beinB) / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, p.bogeN)), 1 / p.bogeN) -
      shrink
    const rr = (d: number): Vec3 => [(r0 + c + d) * ct, (r0 + c + d) * st, z]
    L.push(rr(-hw))
    R.push(rr(hw))
  }
  for (let i = 0; i <= N; i++) put(i / N, 0)
  // fasen: dei siste to stega dreg foten inn, so han står på ein smalare
  // flate enn beinet er breitt — ein skarp fot flisar seg på fyrste flytt
  const fas = Math.min(p.fotfas, p.beinB / 2 - 6)
  if (fas > 0.5) {
    L.pop(); R.pop()
    put(1 - fas / Math.max(1, zTop), 0)
    put(1, fas)
  }
  const off: Vec3 = [-st * p.rammeT, ct * p.rammeT, 0]
  sealed(s, () => slab(s, L, R, off))
}

/** eit rett tverrband under ramma — det som ber renningsstrekket når
 *  ringen er kløyvd framme og bak */
function tieSolid(s: Soup, w: Weave, x: number, k: number) {
  const p = w.p
  const Y = w.b * 0.94
  const h = p.rammeH * 0.8
  const zt = w.zRim(x) + w.rimOff - p.rammeT * 0.9
  const zb = zt - p.rammeT
  const sec: Vec3[][] = []
  const N = Math.max(2, Math.round(3 * k))
  for (let i = 0; i <= N; i++) {
    const y = -Y + (2 * Y * i) / N
    const xi = x - (x > 0 ? 1 : -1) * h
    sec.push([
      [x, y, zb],
      [xi, y, zb],
      [xi, y, zt],
      [x, y, zt],
    ])
  }
  sealed(s, () => tube(s, sec, false, (e) => (e === 0 || e === 2 ? 0 : 1)))
}

// =============================================================================
// RYGGBOGEN
// =============================================================================
function bowSolid(s: Soup, w: Weave, k: number) {
  const p = w.p
  if (p.ryggH < 30) return
  const g = bowGeom(w)
  const N = Math.max(10, Math.round(24 * k))
  const L: Vec3[] = []
  const R: Vec3[] = []
  for (let i = 0; i <= N; i++) {
    const y = -g.bwE + (2 * g.bwE * i) / N
    const A = g.arch(y)
    L.push(g.at(y, Math.max(6, g.tVev * A)))
    R.push(g.at(y, Math.max(18, g.tTop * A)))
  }
  const off: Vec3 = [Math.cos(g.v) * p.rammeT, 0, Math.sin(g.v) * p.rammeT]
  sealed(s, () => slab(s, L, R, off))
  // To stolpar frå ramma opp i bogen. Det er DEI som ber bogen: veven dreg
  // han framover, ikkje bakover, so bogen kan ikkje henge i banda sine.
  const wid = p.rammeH * 0.42
  const nx = Math.cos(g.v)
  const nz = Math.sin(g.v)
  for (const sgn of [-1, 1]) {
    const y = sgn * g.bwE * 0.8
    const tt = Math.max(24, g.tTop * g.arch(y))
    const M = Math.max(5, Math.round(9 * k))
    const IL: Vec3[] = []
    const IR: Vec3[] = []
    for (let i = 0; i <= M; i++) {
      const t = -p.rammeT + ((tt + p.rammeT) * i) / M
      const q = g.at(y, Math.max(0, t))
      const dz = t < 0 ? t : 0
      IL.push([q[0] - nx * wid * 0.5, q[1], q[2] - nz * wid * 0.5 + dz])
      IR.push([q[0] + nx * wid * 0.5, q[1], q[2] + nz * wid * 0.5 + dz])
    }
    sealed(s, () => slab(s, IL, IR, [0, p.rammeT, 0]))
  }
}

// =============================================================================
// LAG — objektet slik det er bygt
// =============================================================================
export function lagMesh(w: Weave, k: number) {
  const s = newSoup()
  const p = w.p
  const step = Math.max(1, Math.round(2 / k))
  for (const band of w.warp) bandSolid(s, band, step)
  for (const band of w.weft) bandSolid(s, band, step)
  const nth = Math.max(40, Math.round(120 * k))
  for (const [t0, t1] of w.arcs) rimSolid(s, w, t0, t1, nth)
  if (p.rammetype === 1) {
    tieSolid(s, w, w.a + p.rammeH * 0.5, k)
    tieSolid(s, w, -w.a - p.rammeH * 0.5, k)
  }
  for (const leg of w.legs) legSolid(s, w, leg.th, k)
  bowSolid(s, w, k)
  return soupToMesh(s)
}

// =============================================================================
// FLATE — vevflata som éin glatt hud
// =============================================================================
export function flateMesh(w: Weave, k: number) {
  const s = newSoup()
  const p = w.p
  const sTot = w.sSeat + w.hVev
  const NI = Math.max(18, Math.round(52 * k))
  const NJ = Math.max(14, Math.round(38 * k))
  const half = w.stakk / 2 + 0.6
  const pt = (i: number, j: number): { top: Vec3; bot: Vec3 } => {
    const sg = (sTot * i) / NI
    const Y = Math.max(8, w.spanAt(sg))
    const v = -1 + (2 * j) / NJ
    const c = w.srf(sg, v * Y)
    // normalen av differansar: hudens tjukn skal stå normalt på flata,
    // og bak på ryggbogen står flata nesten loddrett
    const e = 1.5
    const dS = sub3(w.srf(Math.min(sTot, sg + e), v * Y), w.srf(Math.max(0, sg - e), v * Y))
    const dY = sub3(w.srf(sg, v * Y + e), w.srf(sg, v * Y - e))
    let n = cross3(dY, dS)
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) n = [0, 0, 1]
    n = norm3(n)
    if (n[2] < 0) n = [-n[0], -n[1], -n[2]]
    return {
      top: [c[0] + n[0] * half, c[1] + n[1] * half, c[2] + n[2] * half],
      bot: [c[0] - n[0] * half, c[1] - n[1] * half, c[2] - n[2] * half],
    }
  }
  sealed(s, () => gridSlab(s, NI, NJ, pt))
  const nth = Math.max(48, Math.round(140 * k))
  rimSolid(s, w, 0, Math.PI * 2, nth)
  for (const leg of w.legs) legSolid(s, w, leg.th, k)
  if (p.ryggH >= 30) bowSolid(s, w, k)
  return soupToMesh(s)
}

// =============================================================================
// KONTUR — bandstrimlane flate, og rammedelane ved sida av
// =============================================================================
export function konturLines(w: Weave): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const seg = (dst: number[], a: Pt, b: Pt) => dst.push(a[0], 0, a[1], b[0], 0, b[1])
  const ring = (dst: number[], pts: Pt[], dx: number, dy: number) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      seg(dst, [a[0] + dx, a[1] + dy], [b[0] + dx, b[1] + dy])
    }
  }

  const GAP = 26
  const pl = buildParts(w)

  // --- øvst: rammedelane, side om side slik dei ligg på plata -------------
  let x = 0
  let rammeH = 0
  for (const part of pl.ramme.parts) {
    const b = bbox(part.outline)
    ring(bold, part.outline, x - b.x0, -b.y0)
    x += b.x1 - b.x0 + GAP
    rammeH = Math.max(rammeH, b.y1 - b.y0)
  }
  const rammeW = Math.max(1, x - GAP)

  // --- under: kvar bandstrimmel flat, med festetampen merkt av ------------
  // Dette er teikninga typologien sin eigen kuttliste treng: bandet er eit
  // REKTANGEL før det vert vevd, og lengda er den vevde veglengda. Merket
  // står der ramma si innerkant sit, so ein ser kva som er vev og kva som
  // er feste.
  let y = -GAP * 2
  let bandW = 0
  for (const band of [...w.warp, ...w.weft]) {
    const dst = band.k === 0 ? bold : thin
    const h = band.w
    y -= h
    ring(dst, [[0, y], [band.cut, y], [band.cut, y + h], [0, y + h]], 0, 0)
    let vev = 0
    for (let i = band.tail0; i < band.pts.length - 1 - band.tail1; i++) {
      vev += Math.hypot(
        band.pts[i + 1][0] - band.pts[i][0],
        band.pts[i + 1][1] - band.pts[i][1],
        band.pts[i + 1][2] - band.pts[i][2],
      )
    }
    const tamp = Math.max(0, (band.cut - vev) / 2)
    for (const q of [tamp, band.cut - tamp]) {
      if (q > 0.5 && q < band.cut - 0.5) seg(thin, [q, y], [q, y + h])
    }
    bandW = Math.max(bandW, band.cut)
    y -= 7
  }

  // midtstill det heile kring origo
  const W = Math.max(rammeW, bandW)
  const H = rammeH - y
  for (const arr of [thin, bold]) {
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] -= W / 2
      arr[i + 2] += H / 2 - rammeH
    }
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}
