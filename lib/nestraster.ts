/**
 * Rasterpakking, felles for motorane. Flytt hit frå VAFFEL og
 * parameterisert: arkmål, luft og cellestorleik er no val, so same
 * pakkaren tener fresa (2500 × 1250, 8 mm luft) og laseren (600 × 400,
 * 2 mm) — og STRAUM og RIBBE, som før hadde kvar sin enklare pakkar
 * (hyllerader og frie rektangel) og betalte for det i utnytting.
 *
 * Plata er eit rutenett av celler på `cell` millimeter, og kvar del er
 * ei bitmaske av YTTERKONTUREN sin — ikkje av omrisset. Det er heile
 * skilnaden: bogen under kvar ribbe er eit stort, tomt og fullt brukbart
 * felt, og ei ribbe snudd 180° grip inn i naboen i staden for å leggje
 * seg oppå boksen hans. Kvar del vert prøvd i dei fire kvartrotasjonane
 * og lagd på den lågaste (og so venstraste) ledige plassen som gjev
 * lågast topp; det er lengda pakkinga når opp på plata som avgjer kor
 * mange plater ein må kjøpa. Store hòl i ein del er LEDIG plate: skrotet
 * i ringen sitt senter fell ut når hòlet vert kutta same kva, so neste
 * del kan liggje der — med full luft mot hòlranda.
 *
 * Maska er dilatert med éi celle på kvar side, og det er ikkje pynt: to
 * masker som ikkje deler celle er då garanterte å liggje minst `gap`
 * millimeter frå kvarandre, same kvar i cellene konturane ligg. (Provet
 * krev cell ≥ gap/2 — to punkt nærare enn gap kan då aldri hamne meir
 * enn to celleindeksar frå kvarandre.) Prisen er at lufta i praksis vert
 * ei celle eller to romslegare enn minstekravet; det er rasteret sin
 * natur, og han er billegare enn ei ny plate.
 *
 * Deterministisk: ingen slump og inga klokke — same delar inn gjev same
 * pakking ut. Like delar (same `part.id`) deler bitmasker og
 * søkjepeikar, so kvar maske skannar arket høgst éin gong i alt. Cella
 * på 6 mm er budsjettet for den LEVANDE målinga (verste terningkast
 * ~47 ms, under avlen sitt tak på 80 ms); eksporten, som skjer éin
 * gong, har råd til finare raster.
 */
import { bbox, type Pt } from "./core"

export type NestDel = {
  /** same id = same form — maskene vert delte */
  id: string
  outline: Pt[]
  holes: Pt[][]
  /** netto flatareal, mm² */
  area: number
}

/** rot er kvarte omdreiingar MOT klokka: 0, 90, 180, 270 grader */
export type Placed<P extends NestDel = NestDel> = {
  part: P
  x: number
  y: number
  rot: 0 | 1 | 2 | 3
}
export type Sheet<P extends NestDel = NestDel> = {
  w: number
  h: number
  placed: Placed<P>[]
  used: number
}
export type Nesting<P extends NestDel = NestDel> = {
  sheets: Sheet<P>[]
  sheetW: number
  sheetH: number
  util: number
}

export type NestVal = {
  sheetW: number
  sheetH: number
  /** luft mellom delane, mm */
  gap: number
  /** rastercella, mm. Må vera ≥ gap/2 for at dilateringa skal halde ord. */
  cell: number
  /** kva rekkjefylgje delane vert lagde i — store fyrst, på tre vis */
  sortering?: "areal" | "side" | "smal"
  /** eksportkvalitet: prøv alle sorteringane og ta den beste pakkinga.
   *  Kostar tre pakkingar; den levande målinga lèt det vera. */
  tett?: boolean
}

const SORTERINGAR: Record<
  NonNullable<NestVal["sortering"]>,
  (a: { d: { w: number; h: number } }, b: { d: { w: number; h: number } }) => number
> = {
  areal: (a, b) => b.d.w * b.d.h - a.d.w * a.d.h,
  side: (a, b) => Math.max(b.d.w, b.d.h) - Math.max(a.d.w, a.d.h),
  smal: (a, b) => Math.min(b.d.w, b.d.h) - Math.min(a.d.w, a.d.h),
}

const dims = (p: NestDel) => {
  const b = bbox(p.outline)
  return { w: b.x1 - b.x0, h: b.y1 - b.y0, x0: b.x0, y0: b.y0 }
}

type Mask = {
  /** my rader à mw ord; bit i i rad j er cella (i, j) */
  bits: Uint32Array
  mw: number
  my: number
  /** fotavtrykket i mm etter rotasjonen */
  rw: number
  rh: number
  /** lovlege plasseringar på grida, medrekna gap mot platekanten */
  giMin: number
  giMax: number
  gjMin: number
  gjMax: number
}

export function nestRaster<P extends NestDel>(parts: P[], val: NestVal): Nesting<P> {
  // eksportkvalitet: same pakkaren tre gonger med kvar si sortering, og
  // den som gjev færrast ark — sekundært stuttast brukt stripe — vinn
  if (val.tett) {
    let beste: Nesting<P> | null = null
    for (const s of Object.keys(SORTERINGAR) as (keyof typeof SORTERINGAR)[]) {
      const ns = nestRaster(parts, { ...val, tett: false, sortering: s })
      const lengd = ns.sheets.reduce((q, a) => q + a.used, 0)
      const bLengd = beste ? beste.sheets.reduce((q, a) => q + a.used, 0) : Infinity
      if (
        !beste ||
        ns.sheets.length < beste.sheets.length ||
        (ns.sheets.length === beste.sheets.length && lengd < bLengd)
      ) {
        beste = ns
      }
    }
    return beste as Nesting<P>
  }
  const { sheetW, sheetH, gap, cell } = val
  /** dilatering, celler på kvar side av maska */
  const DIL = 1
  /** arkgrida: éi celle margin til dilateringa på kvar side, pluss slark */
  const GW = Math.ceil(sheetW / cell) + 2 * DIL + 1
  const GH = Math.ceil(sheetH / cell) + 2 * DIL + 1
  /** ord per rad i arkmaska — eitt ekstra so eit skifta maskeord aldri
   *  bles inn i rada under */
  const WPR = (GW >> 5) + 2

  /**
   * Bitmaska for éin del i éin rotasjon. Konservativ med vilje: kvar
   * celle konturen så mykje som strekar innom vert sett, og so vert alt
   * dilatert med éi celle. Ei ledig celle i denne maska er difor ei
   * celle ein trygt kan kutte ved. Returnerer null når delen ikkje får
   * plass på ei tom plate i denne leia.
   */
  const buildMask = (part: P, rot: 0 | 1 | 2 | 3): Mask | null => {
    const d = dims(part)
    const rw = rot & 1 ? d.h : d.w
    const rh = rot & 1 ? d.w : d.h
    const giMin = Math.ceil(gap / cell)
    const gjMin = giMin
    const nx = Math.max(1, Math.ceil(rw / cell))
    const ny = Math.max(1, Math.ceil(rh / cell))
    const mx = nx + 2 * DIL
    const my = ny + 2 * DIL
    const giMax = Math.min(Math.floor((sheetW - gap - rw) / cell), GW - mx)
    const gjMax = Math.min(Math.floor((sheetH - gap - rh) / cell), GH - my)
    if (giMax < giMin || gjMax < gjMin) return null

    // ringane inn i rotasjonsramma — same avbilding som placedRings.
    // HÒLA ER MED: eit stort hòl i ein del (ringen sitt senter, tomrommet
    // i ei finne) er ledig plate for NESTE del — skrotet der fell ut når
    // hòlet vert kutta same kva. Jamn/odde-fyllinga over alle ringane
    // gjev gods minus hòl; kantcellene til kvar ring vert merkte, so
    // dilateringa held luftkravet mot hòlranda òg.
    const ringar = [part.outline, ...part.holes]
    const tR: { tx: Float64Array; ty: Float64Array }[] = ringar.map((ring) => {
      const n = ring.length
      const tx = new Float64Array(n)
      const ty = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        const u = ring[i][0] - d.x0
        const v = ring[i][1] - d.y0
        if (rot === 1) {
          tx[i] = d.h - v
          ty[i] = u
        } else if (rot === 2) {
          tx[i] = d.w - u
          ty[i] = d.h - v
        } else if (rot === 3) {
          tx[i] = v
          ty[i] = d.w - u
        } else {
          tx[i] = u
          ty[i] = v
        }
      }
      return { tx, ty }
    })

    const cellArr = new Uint8Array(mx * my)
    const mark = (x: number, y: number) => {
      let i = Math.floor(x / cell)
      let j = Math.floor(y / cell)
      if (i < 0) i = 0
      else if (i >= nx) i = nx - 1
      if (j < 0) j = 0
      else if (j >= ny) j = ny - 1
      cellArr[(j + DIL) * mx + (i + DIL)] = 1
    }

    // flata fyrst: jamn/odde-fylling over ALLE ringane — hòl vert fri
    const xs: number[] = []
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * cell
      xs.length = 0
      for (const { tx, ty } of tR) {
        const n = tx.length
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n
          const ay = ty[i]
          const by = ty[k]
          if (ay > y === by > y) continue
          xs.push(tx[i] + ((y - ay) / (by - ay)) * (tx[k] - tx[i]))
        }
      }
      xs.sort((a, b) => a - b)
      const row = (j + DIL) * mx + DIL
      for (let q = 0; q + 1 < xs.length; q += 2) {
        let i0 = Math.floor(xs[q] / cell)
        let i1 = Math.floor(xs[q + 1] / cell)
        if (i0 < 0) i0 = 0
        if (i1 >= nx) i1 = nx - 1
        for (let i = i0; i <= i1; i++) cellArr[row + i] = 1
      }
    }

    // so kantane, over fyllinga: kvar celle nokon strek går gjennom er
    // gods — det gjeld hòlranda òg, so ingen legg seg PÅ kuttlina
    const step = cell / 2
    for (const { tx, ty } of tR) {
      const n = tx.length
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n
        const ax = tx[i]
        const ay = ty[i]
        const bx = tx[k]
        const by = ty[k]
        const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
        for (let s = 0; s <= m; s++) {
          const t = s / m
          mark(ax + (bx - ax) * t, ay + (by - ay) * t)
        }
      }
    }

    // dilater éi celle i kross og pakk radene til bit-ord i same vending
    const tmp = new Uint8Array(mx * my)
    for (let j = 0; j < my; j++) {
      const r0 = j * mx
      for (let i = 0; i < mx; i++) {
        if (!cellArr[r0 + i]) continue
        tmp[r0 + i] = 1
        if (i > 0) tmp[r0 + i - 1] = 1
        if (i + 1 < mx) tmp[r0 + i + 1] = 1
      }
    }
    const mw = (mx + 31) >> 5
    const bits = new Uint32Array(my * mw)
    for (let j = 0; j < my; j++) {
      const r0 = j * mx
      for (let i = 0; i < mx; i++) {
        const on =
          tmp[r0 + i] | (j > 0 ? tmp[r0 - mx + i] : 0) | (j + 1 < my ? tmp[r0 + mx + i] : 0)
        if (on) bits[j * mw + (i >> 5)] |= 1 << (i & 31)
      }
    }

    return { bits, mw, my, rw, rh, giMin, giMax, gjMin, gjMax }
  }

  type Ark = {
    sheet: Sheet<P>
    /** GH rader à WPR ord — cellene som alt er tekne, dilatering medrekna */
    occ: Uint32Array
    /** kvar den fyrste ledige plassen for kvar (del-id, rotasjon) sist
     *  var — arket vert berre fullare, so søket held fram der det slapp */
    resume: Map<string, number>
  }

  /** kolliderer maska med arket når ho ligg med hjørnet sitt i (gi, gj)? */
  const fits = (occ: Uint32Array, m: Mask, gi: number, gj: number): boolean => {
    const s = gi & 31
    const k0 = gi >> 5
    const bits = m.bits
    if (s === 0) {
      for (let j = 0; j < m.my; j++) {
        const so = (gj + j) * WPR + k0
        const po = j * m.mw
        for (let k = 0; k < m.mw; k++) if (occ[so + k] & bits[po + k]) return false
      }
    } else {
      const rs = 32 - s
      for (let j = 0; j < m.my; j++) {
        const so = (gj + j) * WPR + k0
        const po = j * m.mw
        let prev = 0
        for (let k = 0; k <= m.mw; k++) {
          const cur = k < m.mw ? bits[po + k] : 0
          const w = ((cur << s) | (prev >>> rs)) >>> 0
          if (w !== 0 && (occ[so + k] & w) !== 0) return false
          prev = cur
        }
      }
    }
    return true
  }

  /** legg maska inn i arket — same vandring som fits, men med ELLER */
  const stamp = (occ: Uint32Array, m: Mask, gi: number, gj: number) => {
    const s = gi & 31
    const k0 = gi >> 5
    const bits = m.bits
    if (s === 0) {
      for (let j = 0; j < m.my; j++) {
        const so = (gj + j) * WPR + k0
        const po = j * m.mw
        for (let k = 0; k < m.mw; k++) occ[so + k] |= bits[po + k]
      }
    } else {
      const rs = 32 - s
      for (let j = 0; j < m.my; j++) {
        const so = (gj + j) * WPR + k0
        const po = j * m.mw
        let prev = 0
        for (let k = 0; k <= m.mw; k++) {
          const cur = k < m.mw ? bits[po + k] : 0
          occ[so + k] |= ((cur << s) | (prev >>> rs)) >>> 0
          prev = cur
        }
      }
    }
  }

  /** fyrste ledige plass i radvis lesing, frå der same maske slapp sist;
   *  -1 når arket er uttømt for denne maska */
  const scan = (ark: Ark, m: Mask, key: string): number => {
    const from = ark.resume.get(key) ?? m.gjMin * GW + m.giMin
    let gj = Math.floor(from / GW)
    let gi = from - gj * GW
    if (gj < m.gjMin) {
      gj = m.gjMin
      gi = m.giMin
    }
    if (gi < m.giMin) gi = m.giMin
    for (; gj <= m.gjMax; gj++) {
      for (; gi <= m.giMax; gi++) {
        if (fits(ark.occ, m, gi, gj)) {
          const pos = gj * GW + gi
          ark.resume.set(key, pos)
          return pos
        }
      }
      gi = m.giMin
    }
    ark.resume.set(key, (m.gjMax + 1) * GW)
    return -1
  }

  /** prøv dei fire rotasjonane på dette arket og legg delen der toppen
   *  vert lågast — sekundært lågast rad, so lengst til venstre */
  const tryPlace = (ark: Ark, part: P, ms: (Mask | null)[]): boolean => {
    let best: Mask | null = null
    let bestRot = 0
    let bestGi = 0
    let bestGj = 0
    let bestTop = Infinity
    for (let r = 0; r < 4; r++) {
      const m = ms[r]
      if (!m) continue
      const pos = scan(ark, m, part.id + "|" + r)
      if (pos < 0) continue
      const gj = Math.floor(pos / GW)
      const gi = pos - gj * GW
      const top = gj * cell + m.rh
      if (
        top < bestTop ||
        (top === bestTop && (gj < bestGj || (gj === bestGj && gi < bestGi)))
      ) {
        best = m
        bestRot = r
        bestGi = gi
        bestGj = gj
        bestTop = top
      }
    }
    if (!best) return false
    stamp(ark.occ, best, bestGi, bestGj)
    ark.sheet.placed.push({
      part,
      x: bestGi * cell,
      y: bestGj * cell,
      rot: bestRot as 0 | 1 | 2 | 3,
    })
    if (bestTop > ark.sheet.used) ark.sheet.used = bestTop
    return true
  }

  const items = parts
    .map((p) => ({ p, d: dims(p) }))
    .sort(SORTERINGAR[val.sortering ?? "areal"])

  // like delar deler masker: `part.id` er same form, per bygg
  const memo = new Map<string, (Mask | null)[]>()
  const masksFor = (q: P) => {
    let ms = memo.get(q.id)
    if (!ms) {
      ms = [buildMask(q, 0), buildMask(q, 1), buildMask(q, 2), buildMask(q, 3)]
      memo.set(q.id, ms)
    }
    return ms
  }

  const arks: Ark[] = []
  const open = (): Ark => {
    const a: Ark = {
      sheet: { w: sheetW, h: sheetH, placed: [], used: 0 },
      occ: new Uint32Array(GH * WPR),
      resume: new Map(),
    }
    arks.push(a)
    return a
  }
  open()

  for (const it of items) {
    const ms = masksFor(it.p)
    if (!ms.some((m) => m !== null)) continue // større enn plata i alle leier
    let done = false
    for (let si = 0; si < arks.length && !done; si++) {
      done = tryPlace(arks[si], it.p, ms)
    }
    // ho får plass på ei tom plate — det sa maska sjølv
    if (!done) tryPlace(open(), it.p, ms)
  }

  const sheets = arks.map((a) => a.sheet)
  const area = parts.reduce((s, p) => s + p.area, 0)
  const usedArea = sheets.reduce((s, q) => s + q.used * sheetW, 0)
  return { sheets, sheetW, sheetH, util: usedArea > 0 ? area / usedArea : 0 }
}

/** delane skalerte til modellmål — laseren sitt spor: same form, kvar
 *  lengd gonga med s, arealet med s² */
export function skalerDelar<P extends NestDel>(parts: P[], s: number): P[] {
  if (s === 1) return parts
  const pt = (q: Pt): Pt => [q[0] * s, q[1] * s]
  return parts.map((p) => ({
    ...p,
    outline: p.outline.map(pt),
    holes: p.holes.map((h) => h.map(pt)),
    area: p.area * s * s,
  }))
}

/** delen sine konturar der han faktisk ligg på plata */
export function placedRings(q: Placed): { outline: Pt[]; holes: Pt[][] } {
  const d = dims(q.part)
  const map = (p: Pt): Pt => {
    const x = p[0] - d.x0
    const y = p[1] - d.y0
    if (q.rot === 1) return [q.x + d.h - y, q.y + x]
    if (q.rot === 2) return [q.x + d.w - x, q.y + d.h - y]
    if (q.rot === 3) return [q.x + y, q.y + d.w - x]
    return [q.x + x, q.y + y]
  }
  return { outline: q.part.outline.map(map), holes: q.part.holes.map((h) => h.map(map)) }
}
