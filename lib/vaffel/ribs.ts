/**
 * VAFFEL — ribbene og ledda.
 *
 * Ei ribbe er eit plansnitt gjennom kroppen, minus bogen, med spor der ho
 * kryssar den andre familien. Profilen vert lesen ut av feltet med ei
 * marsjerande rute i staden for å skrivast ned, av di forma hennar er eit
 * spørsmål om kva grense som bit kvar — og svaret skifter frå ribbe til
 * ribbe i same objektet.
 *
 * Kvar profil ligg i sitt eige plan med (t, z): t er y for ei X-ribbe og x
 * for ei Y-ribbe. Det er same koordinat kuttfila brukar, så delen på plata
 * og delen i nettet er den same lista med punkt.
 *
 * Ledda er halvt om halvt. X-ribbene har spor opne oppover, Y-ribbene spor
 * opne nedover, og då kan ein leggje X-familien på bordet og senke
 * Y-familien ned i han. Det er heile monteringa, og det finst ikkje ein
 * skrue i møbelet.
 */
import { shoelace, type Pt } from "../core"
import type { Body } from "./body"
import { contour, simplify, type Loop } from "./contour"

export type Slot = {
  /** senter langs ribba, mm */
  t: number
  /** munnen på sporet */
  zMouth: number
  /** botnen i sporet */
  zEnd: number
  /** opnar sporet seg oppover? */
  fromTop: boolean
  /** sporbreidd, mm */
  w: number
  /** kor langt forbi munnen sporet må gå for å bryte gjennom over HEILE
   *  breidda si. Kanten ribba opnar seg i er krum, så eit spor som stoggar
   *  ved munnen midt i sporet står att med gods i kvar side — og eit spor
   *  med gods i botnen er ikkje eit spor, det er eit hòl. */
  zOut: number
}

export type Rib = {
  axis: "x" | "y"
  k: number
  /** kvar planet står, mm */
  pos: number
  /** ytterkantane. Meir enn éin tyder at ribba er delt i lause stykke. */
  outlines: Pt[][]
  holes: Pt[][]
  slots: Slot[]
  /** netto areal etter spor og hòl, mm² */
  area: number
  /** høgda på ribba, mm */
  height: number
  /** breidda ribba treng på plata, mm */
  width: number
  /** smalaste godset ribba har på tvers av lastvegen, mm */
  narrow: number
}

export type Grid = {
  b: Body
  ribs: Rib[]
  /** ledd som faktisk vart skorne */
  joints: number
  /** minste opning mellom to naboribber, mm */
  gapX: number
  gapY: number
}

const roundMin = (a: number, c: number, r: number) => {
  if (r <= 0) return Math.min(a, c)
  if (a >= r || c >= r) return Math.min(a, c)
  return r - Math.hypot(r - a, r - c)
}

/**
 * Ribbeprofilen som lukka polygon i (t, z) — med spora skorne.
 *
 * Spora står i FELTET og ikkje i polygonet etterpå. Det er ikkje ein
 * snarveg forbi ein boolsk operasjon: det er den einaste måten kuttfila og
 * nettet ikkje kan kome i utakt på. Ein fres som fylgjer denne konturen
 * skjer nøyaktig den ribba biletet viser, spor og alt.
 */
function profileOf(
  b: Body,
  axis: "x" | "y",
  pos: number,
  step: number,
  slots: Slot[],
): Loop[] {
  const p = b.p
  const n = p.planN
  // Ruta må dekkje HEILE profilen: sige flyttar planet inntil |lut|/2 til
  // kvar side, og ein kontur som vert klipt av kanten på ruta er ei open
  // kjede og ikkje eit polygon. Høgda går til toppen av materialet, som er
  // over setekanten når setet stig bak.
  const lim = (axis === "x" ? b.B * b.rhoMax : b.A * b.rhoMax) + 8 + Math.abs(p.lut)
  const nt = Math.max(48, Math.ceil((2 * lim) / step))
  const nz = Math.max(48, Math.ceil((b.zHigh + 12) / step))
  const t0 = -lim
  const dt = (2 * lim) / nt
  const z0 = -6
  const dz = (b.zHigh + 12) / nz

  // Alt som berre avheng av kolonnen, éin gong per kolonne.
  const perp = axis === "x" ? Math.abs(pos) / b.A : Math.abs(pos) / b.B
  const cPerp = Math.pow(perp, n)
  const tScale = axis === "x" ? b.B : b.A
  const scale = (b.A + b.B) / 2
  const tPow = new Float64Array(nt + 1)
  const seatCol = new Float64Array(nt + 1)
  const archCol = new Float64Array(nt + 1)
  for (let i = 0; i <= nt; i++) {
    const t = t0 + i * dt
    tPow[i] = Math.pow(Math.abs(t) / tScale, n)
    seatCol[i] = axis === "x" ? b.seatSurf(pos, t) : b.seatSurf(t, pos)
    archCol[i] = axis === "x" ? b.arch(pos, t) : b.arch(t, pos)
  }
  // …og alt som berre avheng av rada, éin gong per rad.
  const rhoRow = new Float64Array(nz + 1)
  const sigRow = new Float64Array(nz + 1)
  for (let j = 0; j <= nz; j++) {
    const u = (z0 + j * dz) / b.zTop
    rhoRow[j] = b.rho(u)
    sigRow[j] = b.sig(u)
  }

  // Planleddet, ferdig utrekna per rute.
  //
  // Står planet stille HEILE vegen opp — korkje sig eller ryggfall — er
  // feltet skiljeleg og tabellen er den gamle kolonnetabellen: same tal,
  // ein potens mindre per rute. Flyttar planet seg, er det ikkje
  // skiljeleg lenger, og dei to familiane har kvar sin kostnad:
  // X-ribba står i eit fast x-plan, so sige er eit RAD-ledd hjå henne,
  // medan Y-ribba har sige langs sin eigen t-akse og må reknast per rute.
  const gCell = new Float64Array((nt + 1) * (nz + 1))
  if (b.flatPlan) {
    for (let i = 0; i <= nt; i++) {
      const gc = Math.pow(cPerp + tPow[i], 1 / n)
      for (let j = 0; j <= nz; j++) gCell[j * (nt + 1) + i] = gc
    }
  } else if (axis === "x") {
    for (let j = 0; j <= nz; j++) {
      const cp = Math.pow(Math.abs(pos - sigRow[j]) / b.A, n)
      for (let i = 0; i <= nt; i++) gCell[j * (nt + 1) + i] = Math.pow(cp + tPow[i], 1 / n)
    }
  } else {
    for (let j = 0; j <= nz; j++) {
      const sh = sigRow[j]
      for (let i = 0; i <= nt; i++) {
        gCell[j * (nt + 1) + i] =
          Math.pow(cPerp + Math.pow(Math.abs(t0 + i * dt - sh) / b.A, n), 1 / n)
      }
    }
  }

  // Sporet som eit rektangel med forteikn. Munnen vert dregen fem
  // millimeter forbi kanten, så han bryt gjennom same kvar kanten ligg.
  const boxes = slots.map((q) => {
    const zlo = q.fromTop ? Math.min(q.zEnd, q.zMouth) : q.zOut
    const zhi = q.fromTop ? q.zOut : Math.max(q.zEnd, q.zMouth)
    return { t: q.t, half: q.w / 2, zlo, zhi }
  })

  const g = new Float64Array((nt + 1) * (nz + 1))
  for (let j = 0; j <= nz; j++) {
    const z = z0 + j * dz
    const rr = rhoRow[j]
    for (let i = 0; i <= nt; i++) {
      const t = t0 + i * dt
      const fPlan = (rr - gCell[j * (nt + 1) + i]) * scale
      const fSeat = seatCol[i] - z
      let v = Math.min(roundMin(fSeat, fPlan, p.kantR), z, z - archCol[i])
      for (const q of boxes) {
        if (v <= 0) break
        const d = Math.max(Math.abs(t - q.t) - q.half, q.zlo - z, z - q.zhi)
        if (d < v) v = d
      }
      g[j * (nt + 1) + i] = v
    }
  }
  return contour(g, t0, dt, nt, z0, dz, nz)
}

/** Alle loddrette stykke med material i ei søyle, med bogen teken bort. */
function ribRuns(b: Body, axis: "x" | "y", pos: number, t: number): [number, number][] {
  return axis === "x" ? b.runsAt(pos, t) : b.runsAt(t, pos)
}

/**
 * Kor mykje gods ribba har att på det tynnaste, målt loddrett gjennom
 * sporet. Det er dette talet som avgjer om ho knekk når nokon set seg —
 * ikkje høgda hennar, og ikkje breidda. Eit spor som opnar seg oppover et
 * frå toppen, så det som ber er det som ligg UNDER sporbotnen; eit spor
 * nedanfrå et motsett veg.
 */
function narrowOf(r: Rib, span: (s: Slot) => [number, number] | null): number {
  let worst = Infinity
  for (const s of r.slots) {
    const q = span(s)
    if (!q) continue
    const left = s.fromTop ? s.zEnd - q[0] : q[1] - s.zEnd
    if (left < worst) worst = left
  }
  return Number.isFinite(worst) ? worst : r.height
}

/** Rutenettet er det dyraste mellombygget i motoren. Kroppen er hugsa på
 *  innhald, so same punkt gjev same kropps-instans — og då held eit
 *  identitetsoppslag her: bygg, mål og reglar les det same rutenettet. */
const NETT_HUGS = new WeakMap<Body, Map<number, Grid>>()
export function buildGrid(b: Body, step = 2.6): Grid {
  let per = NETT_HUGS.get(b)
  if (!per) {
    per = new Map()
    NETT_HUGS.set(b, per)
  }
  const hit = per.get(step)
  if (hit) return hit
  const v = buildGridRaw(b, step)
  per.set(step, v)
  return v
}

function buildGridRaw(b: Body, step = 2.6): Grid {
  const p = b.p
  const slotW = p.ribbT + p.pressfit
  const ribs: Rib[] = []
  // Same søyle vert spurd om att og om att: éin gong per kryss frå kvar
  // familie, éin gong til av kvart spor si skuldermåling. runsAt er den
  // dyraste einskildoperasjonen i heile motoren, so svaret vert hugsa for
  // dette eine bygget.
  const runsHugs = new Map<string, [number, number][]>()
  const runs = (axis: "x" | "y", pos: number, t: number): [number, number][] => {
    const x = axis === "x" ? pos : t
    const y = axis === "x" ? t : pos
    const key = x + "," + y
    let v = runsHugs.get(key)
    if (!v) {
      v = b.runsAt(x, y)
      runsHugs.set(key, v)
    }
    return v
  }
  const mk = (axis: "x" | "y", k: number, pos: number, slots: Slot[]): Rib => {
    const loops = profileOf(b, axis, pos, step, slots)
    const outlines: Pt[][] = []
    const holes: Pt[][] = []
    for (const l of loops) {
      const s = simplify(l.pts, 0.25) as Pt[]
      if (s.length < 3) continue
      if (l.area > 0) outlines.push(s)
      else holes.push(s)
    }
    let area = 0
    for (const o of outlines) area += Math.abs(shoelace(o))
    for (const h of holes) area -= Math.abs(shoelace(h))
    let zMax = 0
    let tMin = Infinity
    let tMax = -Infinity
    for (const o of outlines) {
      for (const q of o) {
        if (q[1] > zMax) zMax = q[1]
        if (q[0] < tMin) tMin = q[0]
        if (q[0] > tMax) tMax = q[0]
      }
    }
    return {
      axis,
      k,
      pos,
      outlines,
      holes,
      slots,
      area,
      height: zMax,
      width: Number.isFinite(tMin) ? tMax - tMin : 0,
      narrow: 0,
    }
  }

  // --- ledda fyrst -----------------------------------------------------------
  // Eit ledd finst berre der begge ribbene har gods i same høgd. Under midja
  // kan den eine familien vera ute av kroppen medan den andre står i han, og
  // eit spor skore der er eit spor i lause lufta. Ledda må reknast FØR
  // profilane, av di det er dei som skal skjerast i profilen.
  const slotsX: Slot[][] = b.xs.map(() => [])
  const slotsY: Slot[][] = b.ys.map(() => [])
  let joints = 0
  for (let i = 0; i < b.xs.length; i++) {
    for (let j = 0; j < b.ys.length; j++) {
      // Med felles kvelving er over- og underkanten den same for begge
      // ribbene i krysset: X-ribba si søyle ved t = y og Y-ribba si ved
      // t = x er den SAME søyla (x, y). Difor eitt oppslag, ikkje to —
      // og overlappet av eit stykke med seg sjølv er stykket.
      const a = runs("x", b.xs[i], b.ys[j])
      for (const [lo, hi] of a) {
        {
          if (hi - lo < 8) continue
          // Skulder: leddet treng gods på BEGGE sider av sporet, i begge
          // ribbene, over heile den høgda sporet går i. Utan det kappar
          // sporet av ein flis langs kanten.
          const zm0 = lo + p.lapp * (hi - lo)
          // Sporet stoggar midt i overlappet, og over botnen hans er ribba
          // heil. Difor kan eit ledd ikkje kappe noko laust, og skulderen
          // treng berre målast der ribba er open — ved munnen. Det er den
          // felles kvelvinga som gjer dette sant: har kvar ribbe sin eigen
          // boge, byrjar dei to i ulik høgd, og då må det eine sporet gå
          // heilt ut til underkanten på ribba.
          //
          // Skulderen er eit spørsmål om gods i eit lite band kring
          // sporet, ikkje om heile snittet: i staden for å marsjere over
          // heile ribba vert berre bandet [t−skulder, t+skulder] prøvd —
          // heng det saman, har leddet skulder på begge sider.
          const shoulder = slotW / 2 + 10
          const room = (axis: "x" | "y", rpos: number, t: number, zTest: number) => {
            const S = 9
            for (let q = -S; q <= S; q++) {
              const tt = t + (q / S) * shoulder
              const solid = (axis === "x" ? b.F(rpos, tt, zTest) : b.F(tt, rpos, zTest)) > 0
              if (!solid) return false
            }
            return true
          }
          if (!room("x", b.xs[i], b.ys[j], (zm0 + hi) / 2)) continue
          if (!room("y", b.ys[j], b.xs[i], (lo + zm0) / 2)) continue

          const zm = zm0
          // Kor langt sporet må gå for å koma ut på den krumme kanten.
          // Tre prøver held: kanten er glatt over sporbreidda, so ekstremet
          // ligg i ein ende eller på midten — og zOut har alt tre
          // millimeter mon utanpå det som vert funne.
          const clear = (axis: "x" | "y", pos: number, t: number, up: boolean) => {
            let e = up ? -Infinity : Infinity
            for (let q = -1; q <= 1; q++) {
              const tt = t + q * (slotW / 2)
              const rr = runs(axis, pos, tt)
              if (!rr.length) continue
              const pick = up ? rr[rr.length - 1][1] : rr[0][0]
              e = up ? Math.max(e, pick) : Math.min(e, pick)
            }
            if (!Number.isFinite(e)) e = up ? hi : lo
            return up ? e + 3 : e - 3
          }
          slotsX[i].push({
            t: b.ys[j], zMouth: hi, zEnd: zm, fromTop: true, w: slotW,
            zOut: clear("x", b.xs[i], b.ys[j], true),
          })
          slotsY[j].push({
            t: b.xs[i], zMouth: lo, zEnd: zm, fromTop: false, w: slotW,
            zOut: clear("y", b.ys[j], b.xs[i], false),
          })
          joints++
        }
      }
    }
  }
  for (const l of slotsX) l.sort((u, v) => u.t - v.t)
  for (const l of slotsY) l.sort((u, v) => u.t - v.t)

  for (let i = 0; i < b.xs.length; i++) ribs.push(mk("x", i, b.xs[i], slotsX[i]))
  for (let j = 0; j < b.ys.length; j++) ribs.push(mk("y", j, b.ys[j], slotsY[j]))

  for (const r of ribs) {
    // Stykket sporet står i, ikkje heile ribba: eit spor i setestykket skal
    // ikkje målast mot foten som ligg under midjeluka. Munnen på sporet
    // ligg per definisjon på kanten av sitt eige stykke.
    const span = (q: Slot): [number, number] | null => {
      const runs = ribRuns(b, r.axis, r.pos, q.t)
      for (const run of runs) {
        if (q.zMouth >= run[0] - 0.6 && q.zMouth <= run[1] + 0.6) return run
      }
      return runs.length ? runs[runs.length - 1] : null
    }
    r.narrow = narrowOf(r, span)
  }

  return {
    b,
    ribs,
    joints,
    gapX: b.pitchX - p.ribbT,
    gapY: b.pitchY - p.ribbT,
  }
}
