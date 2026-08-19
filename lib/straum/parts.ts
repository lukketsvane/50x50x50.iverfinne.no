/**
 * STRAUM — dei flate delane.
 *
 * Objektet er éin kropp, men ingen del av det er krum. Skiveplana skjer
 * kroppen; kvart plan gjev ei flat finne, og der planet går ut av
 * kroppen på vegen ned vert finna delt i to stykke — det øvste heng i
 * kappa, det nedste står i sokkelen, og eit stykke som ikkje når nokon av
 * dei to vert kasta. Sokkelen og kappa er dei same snitta lagde vassrett.
 *
 * Alle delane er bygde av same maskineri: rader med material, band der det
 * er skore bort. Sjå `slabs.ts` for kvifor det held.
 */
import { MATERIALS, type Material, type Pt, type Vec3 } from "../core"
import { crossings, spans, type Body } from "./body"
import { makeSlab, type Band, type Placer, type Row, type Slab } from "./slabs"

/** monet som står att på emnet til fresinga av ytterkanten, mm */
const BLANK = 3
/**
 * Kor mange hjørne eit snitt vert lese med. Kurva er glatt og konveks, så
 * 128 hjørne gjev under ein tidels millimeter i pilhøgd på ein radius av
 * to hundre — og delane vert lesne fleire tusen gonger, så talet er den
 * einaste knappen som verkeleg kostar tid.
 */
const SEC = 128
/** materialet som må stå att mellom enden av eit spor og platekanten, mm */
const BRIDGE = 2.5
/** id-en ringhòlet i K2 får; spora tel frå null og oppover */
const RING_ID = -1

export type PartKind = "finne" | "sokkel" | "kappe"

export type Part = {
  id: string
  kind: PartKind
  /** ytre kontur i delen sitt eige plan, lukka, mm */
  outline: Pt[]
  /** hòl i delen: tomrommet i ei finne, spora i ein sokkel */
  holes: Pt[][]
  /** platetjukn, mm */
  t: number
  /** netto areal, mm² */
  area: number
  /** masse, kg */
  mass: number
  /** kva plan delen ligg i, for nettet */
  place: Placer
  slab: Slab
  /** kor mange bein tomrommet deler delen i der han er smalast */
  legs: number
  /** kva skiveplan finna ligg i; −1 for platene */
  plane: number
  /** står stykket i sokkelen? heng det i kappa? */
  holdLow: boolean
  holdHigh: boolean
  zLo: number
  zHi: number
  /** smalaste beinet i stykket, målt utanom dei frie endane, mm */
  narrow: number
}

export type Build = {
  parts: Part[]
  fins: Part[]
  plates: Part[]
  /** tal skiveplan som gav minst eitt brukbart stykke */
  usedPlanes: number
  /** kor mange stykke skiveplana gav som vart kasta */
  dropped: number
  /** kva skiveplan som fekk spor i sokkelen og i kappa */
  socketSlots: number[]
  capSlots: number[]
}

// =============================================================================
// FINNANE
// =============================================================================
/** rada i ei finne: ei vassrett line gjennom kroppen i skiveplanet */
type FinRow = { b: number; z: number; lo: number; hi: number; band: Band | null }

function finRows(
  bd: Body,
  u: number,
  clip: (z: number) => [number, number] | null,
): FinRow[] {
  const p = bd.p
  const zBot = p.sokkelT
  const zTop = bd.H - 3 * p.kappeT
  const b0 = bd.bOf(u, zBot)
  const b1 = bd.bOf(u, zTop)
  const N = 120
  const { e1 } = bd.frame

  const at = (b: number): FinRow => {
    const z = bd.zOf(u, b)
    const o = bd.toWorld(u, 0, b)
    const out = spans(crossings(bd.sectionPoly(z, SEC, BLANK), o[0], o[1], e1[0], e1[1]))
    if (!out.length) return { b, z, lo: 0, hi: 0, band: null }
    let lo = out[0][0]
    let hi = out[out.length - 1][1]
    // TAPPEN. Sporet stoggar før platekanten, så det står att material
    // mellom enden av sporet og kanten av sokkelen. Der finna går gjennom
    // ei plate, vert ho difor kappa ned til nøyaktig den lengda sporet
    // har: dei tolv millimeterane inne i plata er ein tapp, og over dei
    // står finna i full breidd. Alternativet — eit spor som går heilt ut i
    // kanten — deler sokkelen i fire og tjue lause band som berre limet
    // held, og då er monteringsjiggen sjølv laus.
    const c = clip(z)
    if (c) {
      lo = Math.max(lo, c[0])
      hi = Math.min(hi, c[1])
      if (hi - lo < 0.5) return { b, z, lo: 0, hi: 0, band: null }
    }
    let band: Band | null = null
    const vp = bd.voidPoly(z, SEC)
    if (vp) {
      const inn = spans(crossings(vp, o[0], o[1], e1[0], e1[1]))
      if (inn.length) {
        const a = inn[0][0]
        const c = inn[inn.length - 1][1]
        // Eit tomrom som når heilt ut i kanten av finna deler henne i to
        // lause delar. Det gjer det ikkje i kroppen — veggen er alltid
        // tjukkare enn null — men eit endeleg rutenett kan lande slik at
        // det ser sånn ut i rada nærast der planet går ut. Då vert
        // tomrommet stengt att i den eine rada.
        if (a > lo + 1.5 && c < hi - 1.5) band = { id: 0, lo: a, hi: c }
      }
    }
    return { b, z, lo, hi, band }
  }

  // Rader nøyaktig på overkanten av sokkelen og underkanten av kappa:
  // det er der tappen sluttar, og eit steg som ligg mellom to rader er eit
  // steg som ligg i feil høgd.
  const bs: number[] = []
  for (let j = 0; j <= N; j++) bs.push(b0 + ((b1 - b0) * j) / N)
  for (const z of [2 * p.sokkelT, bd.H - 4 * p.kappeT]) {
    for (const d of [-0.05, 0.05]) {
      const b = bd.bOf(u, z + d)
      if (b > b0 && b < b1) bs.push(b)
    }
  }
  bs.sort((a, b) => a - b)
  const raw: FinRow[] = bs.map(at)
  // Randa der planet går ut av kroppen ligg mellom to rader. Ho vert
  // halvert fram og lagd inn som ei eiga rad — utan det kortar kvart stykke
  // av seg sjølv med opptil ei halv raddeling i kvar ende.
  const out: FinRow[] = []
  const solid = (r: FinRow) => r.hi - r.lo > 0.5
  for (let j = 0; j < raw.length; j++) {
    const cur = raw[j]
    const prev = j > 0 ? raw[j - 1] : null
    if (prev && solid(prev) !== solid(cur)) {
      let lo = prev.b
      let hi = cur.b
      const keep = solid(prev)
      for (let k = 0; k < 14; k++) {
        const m = (lo + hi) / 2
        if (solid(at(m)) === keep) lo = m
        else hi = m
      }
      // 0,05 mm inn på materialsida: ei rad med null breidd gjev
      // utarta trekantar, og eit utarta lokk er eit hòl i nettet.
      out.push(at(keep ? lo - 0.05 : hi + 0.05))
    }
    out.push(cur)
  }
  return out
}

/** samanhengande løp av rader med material */
function runs(rows: FinRow[]): FinRow[][] {
  const out: FinRow[][] = []
  let cur: FinRow[] = []
  for (const r of rows) {
    if (r.hi - r.lo > 0.5) cur.push(r)
    else if (cur.length) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out.filter((q) => q.length >= 4)
}

// =============================================================================
// PLATENE
// =============================================================================
/**
 * Emnet til ei plate er det breiaste snittet gjennom heile spennet henne,
 * pluss monet som fresen tek av ytterkanten etter oppliming. Difor er
 * plateomrisset alltid litt større enn det ferdige objektet — DXF-en viser
 * emne, og modellen viser det ferdige.
 */
function blankPoly(bd: Body, z0: number, z1: number, nth = SEC): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < nth; i++) {
    const th = (i / nth) * Math.PI * 2
    let r = 0
    let cx = 0
    let cy = 0
    for (let k = 0; k <= 4; k++) {
      const z = z0 + ((z1 - z0) * k) / 4
      const c = bd.ctr(z)
      const rr = bd.ro(th, z)
      const qx = c[0] + rr * Math.cos(th)
      const qy = c[1] + rr * Math.sin(th)
      const d = Math.hypot(qx, qy)
      if (d > r) {
        r = d
        cx = qx
        cy = qy
      }
    }
    out.push([cx + (BLANK * cx) / (r || 1), cy + (BLANK * cy) / (r || 1)])
  }
  return out
}

/** rader i ei vassrett plate: linene går på tvers av skiverekkja */
function plateRows(bd: Body, poly: Pt[], nv: number): Row[] {
  const { cosF, sinF } = bd.frame
  let v0 = Infinity
  let v1 = -Infinity
  for (const q of poly) {
    const v = -q[0] * sinF + q[1] * cosF
    if (v < v0) v0 = v
    if (v > v1) v1 = v
  }
  const rows: Row[] = []
  for (let j = 0; j <= nv; j++) {
    // rendene vert klemde eit hår innover: ei rad med null lengd er eit
    // utarta lokk, og eit utarta lokk er eit hòl i nettet
    const t = j / nv
    const v = v0 + 0.05 + (v1 - v0 - 0.1) * t
    const ox = -v * sinF
    const oy = v * cosF
    const cs = spans(crossings(poly, ox, oy, cosF, sinF))
    if (!cs.length) continue
    rows.push({ v, lo: cs[0][0], hi: cs[cs.length - 1][1], bands: [] })
  }
  return rows
}

/**
 * Kvar eit spor for kvart skiveplan kan liggja i ei plate, og over kva
 * rader. Planen vert rekna før finnane, av di det er han som avgjer kva
 * finnar som har noko å feste seg i — ei finne utan spor er eit avkapp.
 */
export type SlotRun = { w: number; js: number[]; v0: number; v1: number }

function slotPlan(bd: Body, rows: Row[], zMid: number): Map<number, SlotRun> {
  const p = bd.p
  const { cosA, sinA, cosF, sinF, zPivot } = bd.frame
  // Sporet er eit parallellogram og ikkje eit rektangel: finna står
  // `skraa` grader ut av loddrett, så breidda i planet er tjukna delt på
  // cosinus til vinkelen. Talet fell rett ut av vinkelen og er ikkje
  // skrive inn nokon stad.
  const hw = p.finneT / (2 * cosA) + p.pressfit / 2
  const sec = bd.sectionPoly(zMid, SEC)
  const out = new Map<number, SlotRun>()
  bd.planes.forEach((u, k) => {
    const w = (u - (zMid - zPivot) * sinA) / cosA
    // kor langt sporet rekk: nøyaktig så langt som finna er brei her
    const ox = w * cosF
    const oy = w * sinF
    const cs = spans(crossings(sec, ox, oy, -sinF, cosF))
    if (!cs.length) return
    const vLo = cs[0][0]
    const vHi = cs[cs.length - 1][1]
    const ok = (r: Row) =>
      r.v > vLo && r.v < vHi && r.lo < w - hw - BRIDGE && r.hi > w + hw + BRIDGE
    let best: number[] = []
    let cur: number[] = []
    for (let j = 0; j < rows.length; j++) {
      if (ok(rows[j])) cur.push(j)
      else {
        if (cur.length > best.length) best = cur
        cur = []
      }
    }
    if (cur.length > best.length) best = cur
    // eit løp må ha ei heil rad på kvar side; elles er plata delt i to
    if (best.length < 3 || best[0] === 0 || best[best.length - 1] === rows.length - 1) return
    out.set(k, { w, js: best, v0: rows[best[0]].v, v1: rows[best[best.length - 1]].v })
  })
  return out
}

/** skjer dei spora som verkeleg skal skjerast — dei som får ei finne */
function applySlots(
  bd: Body,
  rows: Row[],
  plan: Map<number, SlotRun>,
  allowed: ReadonlySet<number>,
): number[] {
  const p = bd.p
  const hw = p.finneT / (2 * bd.frame.cosA) + p.pressfit / 2
  const got: number[] = []
  for (const [k, run] of plan) {
    if (!allowed.has(k)) continue
    for (const j of run.js) rows[j].bands.push({ id: k, lo: run.w - hw, hi: run.w + hw })
    got.push(k)
  }
  return got
}

/** ringhòlet i K2: same omriss, trekt `d` millimeter inn i radien */
function cutRing(bd: Body, rows: Row[], poly: Pt[], d: number) {
  const { cosF, sinF } = bd.frame
  const inner: Pt[] = poly.map((q) => {
    const r = Math.hypot(q[0], q[1]) || 1
    const s = Math.max(0, r - d) / r
    return [q[0] * s, q[1] * s] as Pt
  })
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j]
    const ox = -r.v * sinF
    const oy = r.v * cosF
    const cs = spans(crossings(inner, ox, oy, cosF, sinF))
    if (!cs.length) continue
    const lo = cs[0][0]
    const hi = cs[cs.length - 1][1]
    if (lo > r.lo + BRIDGE && hi < r.hi - BRIDGE) r.bands.push({ id: RING_ID, lo, hi })
  }
  // stryk løpet om det når ut i fyrste eller siste rada
  const has = (j: number) => rows[j].bands.some((q) => q.id === RING_ID)
  if (has(0) || has(rows.length - 1)) {
    for (const r of rows) r.bands = r.bands.filter((q) => q.id !== RING_ID)
  }
}

// =============================================================================
// HEILE BYGGET
// =============================================================================
/** Same kropp gjev alltid same delar — og med kroppen hugsa er dette
 *  oppslaget på identitet, ikkje på innhald. */
const DELAR_HUGS = new WeakMap<Body, Build>()
export function buildParts(bd: Body): Build {
  const hit = DELAR_HUGS.get(bd)
  if (hit) return hit
  const v = buildPartsRaw(bd)
  DELAR_HUGS.set(bd, v)
  return v
}

function buildPartsRaw(bd: Body): Build {
  const p = bd.p
  const rho = MATERIALS[(p.material as Material) in MATERIALS ? (p.material as Material) : "bjork"].rho
  const { n, cosF, sinF } = bd.frame
  const zBot = p.sokkelT
  const zTop = bd.H - 3 * p.kappeT

  const mk = (
    id: string,
    kind: PartKind,
    rows: Row[],
    t: number,
    place: Placer,
    extra: Partial<Part>,
  ): Part => {
    const sl = makeSlab(rows)
    return {
      id,
      kind,
      outline: sl.rings.outline,
      holes: sl.rings.holes,
      t,
      area: sl.area,
      mass: (sl.area * t * rho) / 1e9,
      place,
      slab: sl,
      legs: 1,
      plane: -1,
      holdLow: false,
      holdHigh: false,
      zLo: 0,
      zHi: 0,
      narrow: Infinity,
      ...extra,
    }
  }

  // --- platene, fyrste omgang: kvar eit spor kan liggja ------------------
  type Blank = { z0: number; z1: number; poly: Pt[]; rows: Row[] }
  const blank = (z0: number, z1: number): Blank => {
    const poly = blankPoly(bd, z0, z1)
    return { z0, z1, poly, rows: plateRows(bd, poly, 132) }
  }
  const S1 = blank(0, p.sokkelT)
  const S2 = blank(p.sokkelT, 2 * p.sokkelT)
  const K1 = blank(bd.H - 4 * p.kappeT, bd.H - 3 * p.kappeT)
  const K2 = blank(bd.H - 3 * p.kappeT, bd.H - 2 * p.kappeT)
  const K3 = blank(bd.H - 2 * p.kappeT, bd.H - p.kappeT)
  const K4 = blank(bd.H - p.kappeT, bd.H)
  const planLow = slotPlan(bd, S2.rows, (S2.z0 + S2.z1) / 2)
  const planHigh = slotPlan(bd, K1.rows, (K1.z0 + K1.z1) / 2)

  // --- finnane ------------------------------------------------------------
  const fins: Part[] = []
  let usedPlanes = 0
  let dropped = 0
  const zS2 = [p.sokkelT, 2 * p.sokkelT]
  const zK1 = [bd.H - 4 * p.kappeT, bd.H - 3 * p.kappeT]
  bd.planes.forEach((u, k) => {
    const lowRun = planLow.get(k)
    const highRun = planHigh.get(k)
    const clip = (z: number): [number, number] | null => {
      if (lowRun && z >= zS2[0] - 0.01 && z <= zS2[1] + 0.01) return [lowRun.v0, lowRun.v1]
      if (highRun && z >= zK1[0] - 0.01 && z <= zK1[1] + 0.01) return [highRun.v0, highRun.v1]
      return null
    }
    const all = runs(finRows(bd, u, clip))
    const kept: Row[][] = []
    let used = false
    all.forEach((run) => {
      // Eit stykke som korkje står i sokkelen eller heng i kappa har ingen
      // ting å feste seg i. Det vert kasta — og det er slik flensen ved
      // golvet og under setet oppstår. Eit stykke som er kortare enn to og
      // ein halv platetjukn vert kasta med: det stikk ikkje opp av sporet
      // sitt og er eit avkapp med eit nummer på.
      const holdLow = Math.abs(run[0].z - zBot) < 1.5 && planLow.has(k)
      const holdHigh = Math.abs(run[run.length - 1].z - zTop) < 1.5 && planHigh.has(k)
      const tall = run[run.length - 1].z - run[0].z
      if (!holdLow && !holdHigh) {
        dropped++
        return
      }
      if (tall < 2.5 * (holdLow ? p.sokkelT : p.kappeT)) {
        dropped++
        return
      }
      const rows: Row[] = run.map((r, i) => ({
        v: r.b,
        lo: r.lo,
        hi: r.hi,
        bands: i === 0 || i === run.length - 1 || !r.band ? [] : [r.band],
      }))
      if (rows.length < 4) {
        dropped++
        return
      }
      // Det smalaste beinet, målt utanom dei frie endane: ei finne går mot
      // null der planet går ut av kroppen, og det talet seier ingen ting om
      // kor sterk ho er. Femten millimeter inn frå ein fri ende er langt
      // nok til å vera forbi spissen og kort nok til å vera i han.
      let legs = 1
      let total = Infinity
      let narrow = Infinity
      let widest = 0
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const b = r.bands[0]
        const w = r.hi - r.lo - (b ? b.hi - b.lo : 0)
        if (w < total) {
          total = w
          legs = r.bands.length + 1
        }
        const one = b ? Math.min(b.lo - r.lo, r.hi - b.hi) : w
        if (one > widest) widest = one
        const zHere = bd.zOf(u, r.v)
        const freeLo = !holdLow && zHere < run[0].z + 15
        const freeHi = !holdHigh && zHere > run[run.length - 1].z - 15
        if (freeLo || freeHi) continue
        if (one < narrow) narrow = one
      }
      const place: Placer = {
        at: (c, v, s) => bd.toWorld(u + s, c, v),
        dir: n,
        t: p.finneT,
      }
      // Kvar finne har eit unikt nummer frest inn i nedkanten, og eit plan
      // som er delt gjev a og b. Ei finne kan berre gå ned i sitt eige spor.
      kept.push(rows)
      fins.push(
        mk(`R${String(k + 1).padStart(2, "0")}`, "finne", rows, p.finneT, place, {
          legs,
          plane: k,
          holdLow,
          holdHigh,
          zLo: run[0].z,
          zHi: run[run.length - 1].z,
          narrow: Number.isFinite(narrow) ? narrow : widest,
        }),
      )
      used = true
    })
    if (used) usedPlanes++
    if (kept.length > 1) {
      for (let i = 0; i < kept.length; i++) {
        fins[fins.length - kept.length + i].id += String.fromCharCode(97 + i)
      }
    }
  })

  // --- platene, andre omgang: berre dei spora som får ei finne -----------
  const wantLow = new Set(fins.filter((q) => q.holdLow).map((q) => q.plane))
  const wantHigh = new Set(fins.filter((q) => q.holdHigh).map((q) => q.plane))
  const socketSlots = applySlots(bd, S2.rows, planLow, wantLow)
  const capSlots = applySlots(bd, K1.rows, planHigh, wantHigh)
  // Ringen ligg i K2 og ikkje i K1: eit spor som kryssa ringkanten ville
  // dele berestykket i lause bogar, og ein boge som berre er limt fast er
  // ikkje eit ledd. Ringbreidda fylgjer setet og er ikkje eit tal for seg.
  cutRing(bd, K2.rows, K2.poly, Math.min(bd.ax(1), bd.ay(1)) * 0.5)

  const plates: Part[] = []
  const put = (id: string, q: Blank) => {
    if (q.rows.length < 4) return
    const zMid = (q.z0 + q.z1) / 2
    const place: Placer = {
      at: (c, v, s) => [c * cosF - v * sinF, c * sinF + v * cosF, zMid + s] as Vec3,
      dir: [0, 0, 1],
      t: q.z1 - q.z0,
    }
    plates.push(
      mk(id, id[0] === "S" ? "sokkel" : "kappe", q.rows, q.z1 - q.z0, place, {
        zLo: q.z0,
        zHi: q.z1,
      }),
    )
  }
  // S1 er massiv og er samstundes monteringsjigg — det er han som held S2
  // saman etter at spora har skore henne i band.
  put("S1", S1)
  put("S2", S2)
  put("K1", K1)
  put("K2", K2)
  put("K3", K3)
  put("K4", K4)

  return { parts: [...fins, ...plates], fins, plates, usedPlanes, dropped, socketSlots, capSlots }
}
