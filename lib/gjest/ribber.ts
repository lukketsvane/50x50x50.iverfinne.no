/**
 * GJEST — ribbene og ledda, lesne ut av eit FELT.
 *
 * BYGD PÅ SLICERMAN — lukketsvane/slicer.iverfinne.no, MIT, same forfattar.
 * Tilpassa: kroppen er ein importert mesh og ikkje ein parameterisert
 * kropp, hugsen er teken ut (sida reknar i ein memo), og stykka kjem ut
 * ferdig para med hòla sine.
 *
 * KVIFOR DENNE OG IKKJE DEN FØRRE
 *
 * Den fyrste GJEST snitta rett gjennom trekantsuppa: kvar trekant som
 * kryssa planet gav eit linestykke, og linestykka vart kjeda til konturar.
 * Det er ei rekning som berre kjenner KANTEN. Ho får aldri vita om eit
 * punkt er inne i objektet eller ute, og av det fylgde tre feil som ikkje
 * lét seg fikse der dei synte seg:
 *
 *   1  Ho måtte GJETTE kva ring som var ytterkonturen — han største — og
 *      kalle resten hòl. Ei ribbe som er delt i fleire stykke (ein stol
 *      med fire bein, sett på tvers) fekk då eitt stykke som ytterkant og
 *      dei tre andre TRUKNE FRÅ som om dei var hòl.
 *   2  Ho skar spora ETTERPÅ, ved å leie konturen langs sporveggene. Det
 *      er ein operasjon som kan mislukkast, og som mislukkast stille: ein
 *      kontur som kryssar seg sjølv pakkar fint og les som ein billeg del
 *      heilt til nokon kuttar plata.
 *   3  Ho visste ikkje om det var GODS i krysset. To ribber som møtest i
 *      lufta mellom to bein fekk eit ledd der det ikkje er noko å gripe i.
 *
 * Feltet svarar på alle tre utan å bli spurt. Spora står i feltet og ikkje
 * i polygonet etterpå — det er ikkje ein snarveg forbi ein boolsk
 * operasjon, det er den einaste måten kuttfila og nettet ikkje kan kome i
 * utakt på. Ein fres som fylgjer denne konturen skjer nøyaktig den ribba
 * biletet viser, spor og alt.
 *
 * FELTET
 * Nettet er ei skalvegg og ikkje ein kropp, so avstanden til overflata må
 * lesast med strålar. To familiar strålar gjer det: éin langs ribba for
 * kvar rad, og éin på tvers for kvar kolonne. Ei rad veit då nøyaktig kvar
 * kanten ligg vassrett, og ei kolonne nøyaktig kvar han ligg loddrett — og
 * det er dei to tala den marsjerande ruta interpolerer mellom. Difor ligg
 * konturen på overflata og ikkje på næraste rutepunkt, sjølv med ei grov
 * rute.
 *
 * LEDDA
 * Halvt om halvt. X-ribbene har spor opne oppover, Y-ribbene spor opne
 * nedover, og då kan ein leggje X-familien på bordet og senke Y-familien
 * ned i han. Det er heile monteringa, og det finst ikkje ein skrue.
 */
import { bbox, type Pt } from "../core"
import { contour, simplify } from "../vaffel/contour"
import type { Solid, Span } from "./solid"

/**
 * Minste stykke som er ein DEL, mm².
 *
 * Under fire kvadratcentimeter er det ein flis: fresen slit han laus,
 * laseren slepp han ned i bordet, og ingen finn han att i eska.
 */
export const MIN_AREAL = 400

/** ruter langs den lengste sida av objektet, per detaljnivå */
export const DETALJ = { lav: 90, mid: 150, hog: 240 } as const

export type GjestVal = {
  /** ribber på tvers av X, og på tvers av Y */
  nX: number
  nY: number
  /** platetjukn, mm */
  t: number
  /** sporet breiare enn plata, mm */
  klaring: number
  /** kor stort objektet vert i kuben, mm */
  maal: number
  /** kor mykje konturen får vike frå forma, mm — ein EKTE toleranse */
  glatt: number
  /** ruter langs den lengste sida: kor fint feltet vert lese */
  detalj: number
  /** kvar i overlappet delinga ligg; 0,5 er halvt om halvt */
  ledd: number
  /** kast stykke som ikkje heng i eit einaste ledd */
  kastLause: boolean
}

export const STANDARD: GjestVal = {
  nX: 9,
  nY: 9,
  t: 9,
  klaring: 0.2,
  maal: 470,
  // 0,25 mm, same toleransen VAFFEL brukar. Han TYDER no det han seier:
  // `simplify` prøver kvart kasta punkt mot den lina som faktisk vert
  // teikna. Den gamle GJEST stod på 1,2 mm mot ei rutine som ikkje heldt
  // toleransen sin — 1,2 der kunne tyde fleire millimeter i fila.
  glatt: 0.25,
  detalj: DETALJ.mid,
  ledd: 0.5,
  kastLause: true,
}

export type Spor = {
  /** senter langs ribba, mm */
  t: number
  /** munnen på sporet */
  zMunn: number
  /** botnen i sporet */
  zEnd: number
  /** opnar sporet seg oppover? */
  ovanfra: boolean
  /** sporbreidd, mm */
  w: number
  /**
   * Kor langt forbi munnen sporet må gå for å bryte gjennom over HEILE
   * breidda si. Kanten ribba opnar seg i er krum, so eit spor som stoggar
   * ved munnen midt i sporet står att med gods i kvar side.
   */
  zUt: number
}

/**
 * Eitt samanhengande stykke plate.
 *
 * Ei ribbe treng ikkje vera eitt stykke: ein stol med fire bein, snitta på
 * tvers nede, er fire. Kvart stykke er sin eigen DEL i kuttlista og si
 * eiga brikke på plata, og hòla fylgjer stykket dei ligg i.
 */
export type Stykke = {
  outline: Pt[]
  holes: Pt[][]
  /** netto areal etter hòl, mm² */
  area: number
  w: number
  h: number
  /** kor mange spor som fell innanfor dette stykket */
  spor: number
}

export type GjestRibbe = {
  akse: 0 | 1
  k: number
  /** kvar planet står, mm */
  pos: number
  stykke: Stykke[]
  spor: Spor[]
  /** smalaste godset som er att gjennom eit spor, mm */
  smalast: number
  /** kuttlengd for heile ribba, mm */
  kuttLengd: number
}

export type Vev = {
  ribber: GjestRibbe[]
  /** kryss som gav eit ledd */
  ledd: number
  /** stykke som vart kasta av di dei ikkje hang i eit einaste ledd */
  kasta: number
  /** stykke som står att UTAN ledd — berre når `kastLause` er av */
  lause: number
  /** kor stort objektet vart, mm */
  boks: [number, number, number]
  xs: number[]
  ys: number[]
  sporW: number
}

/** ligg punktet inne i ringen? stråle mot høgre, tel kryssingar */
export function iRingen(ring: Pt[], p: Pt): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      if (p[0] < x) inne = !inne
    }
  }
  return inne
}

/** omkrinsen av ein ring — kuttlengda hans */
function omkrins(ring: Pt[]): number {
  let L = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    L += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return L
}

/** areal med forteikn */
const snorAreal = (poly: Pt[]) => {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const b = poly[(i + 1) % poly.length]
    a += poly[i][0] * b[1] - b[0] * poly[i][1]
  }
  return a / 2
}

/**
 * Signert avstand langs éin akse, lesen av stykka strålen fann.
 *
 * Positivt inne, negativt ute, og talet er avstanden til NÆRASTE kant
 * langs den aksen — ikkje til næraste punkt på flata. Nett det er poenget:
 * den marsjerande ruta interpolerer berre langs rutekantar, og langs ein
 * rutekant er dette talet eksakt.
 */
function akseAvstand(spans: Span[], t: number): number {
  if (!spans.length) return -1e9
  let best = -Infinity
  for (const [a, b] of spans) {
    const d =
      t >= a && t <= b
        ? Math.min(t - a, b - t)
        : -Math.min(Math.abs(t - a), Math.abs(t - b))
    if (d > best) best = d
  }
  return best
}

type Boks = { t: number; halv: number; zlo: number; zhi: number }

/** sporet som ein boks med forteikn */
function boksAv(q: Spor): Boks {
  return {
    t: q.t,
    halv: q.w / 2,
    zlo: q.ovanfra ? Math.min(q.zEnd, q.zMunn) : q.zUt,
    zhi: q.ovanfra ? q.zUt : Math.max(q.zEnd, q.zMunn),
  }
}

function profilAv(
  s: Solid,
  akse: 0 | 1,
  pos: number,
  spor: Spor[],
  steg: number,
) {
  // Ruta må dekkje HEILE profilen med litt mon: ein kontur som vert klipt
  // av kanten på ruta er ei open kjede og ikkje eit polygon.
  const PAD = Math.max(4, steg * 2)
  const ti = akse === 0 ? 1 : 0
  const t0 = s.min[ti] - PAD
  const t1 = s.max[ti] + PAD
  const z0 = s.min[2] - PAD
  const z1 = s.max[2] + PAD
  const nt = Math.max(24, Math.min(520, Math.ceil((t1 - t0) / steg)))
  const nz = Math.max(24, Math.min(520, Math.ceil((z1 - z0) / steg)))
  const dt = (t1 - t0) / nt
  const dz = (z1 - z0) / nz

  // Éin stråle per rad og éin per kolonne. Det er heile kostnaden ved ei
  // ribbe — resten er aritmetikk på ei tabell som alt ligg i minnet.
  const rader: Span[][] = new Array(nz + 1)
  for (let j = 0; j <= nz; j++) {
    const z = z0 + j * dz
    rader[j] = akse === 0 ? s.runs(1, z, pos) : s.runs(0, pos, z)
  }
  const kolonnar: Span[][] = new Array(nt + 1)
  for (let i = 0; i <= nt; i++) {
    const t = t0 + i * dt
    kolonnar[i] = akse === 0 ? s.runs(2, pos, t) : s.runs(2, t, pos)
  }

  const boksar = spor.map(boksAv)
  const g = new Float64Array((nt + 1) * (nz + 1))
  for (let j = 0; j <= nz; j++) {
    const z = z0 + j * dz
    const rad = rader[j]
    for (let i = 0; i <= nt; i++) {
      const t = t0 + i * dt
      const dh = akseAvstand(rad, t)
      const dv = akseAvstand(kolonnar[i], z)
      // Forteiknet er SNITTET av dei to prøvene — er dei usamde, står vi
      // på ein knivsegg og skal reknast som luft. Storleiken er avstanden
      // til den næraste av dei to kantane, og aldri den fjernaste: eit
      // punkt ti millimeter frå ein kant og to frå ein annan er to
      // millimeter frå flata.
      const mag = Math.min(Math.abs(dh), Math.abs(dv))
      let v = dh > 0 && dv > 0 ? mag : -mag
      for (const q of boksar) {
        if (v <= 0) break
        const d = Math.max(Math.abs(t - q.t) - q.halv, q.zlo - z, z - q.zhi)
        if (d < v) v = d
      }
      g[j * (nt + 1) + i] = v
    }
  }
  return contour(g, t0, dt, nt, z0, dz, nz)
}

/**
 * Kor mange spor som fell innanfor EITT stykke av ei ribbe.
 *
 * Ei ribbe kan vera delt: eit dyr med fire bein gjev ei tverribbe i fire
 * stykke, og at RIBBA har spor seier ingenting om at akkurat dette stykket
 * har det. Sporet ligg i stykket sitt eige omriss, med munnen på kanten av
 * det og botnen inne i det.
 */
function sporI(spor: Spor[], outline: Pt[]): number {
  const b = bbox(outline)
  let n = 0
  for (const q of spor) {
    if (
      q.t >= b.x0 - 0.6 &&
      q.t <= b.x1 + 0.6 &&
      q.zEnd >= b.y0 - 0.6 &&
      q.zEnd <= b.y1 + 0.6
    ) {
      n++
    }
  }
  return n
}

/**
 * Kor mykje gods ribba har att på det tynnaste, målt loddrett gjennom
 * sporet. Det er dette talet som avgjer om ho knekk når nokon tek i — ikkje
 * høgda hennar, og ikkje breidda. Eit spor som opnar seg oppover et frå
 * toppen, so det som ber er det som ligg UNDER sporbotnen; eit spor
 * nedanfrå et motsett veg.
 */
function smalastAv(spor: Spor[], span: (s: Spor) => Span | null): number {
  let verst = Infinity
  for (const s of spor) {
    const q = span(s)
    if (!q) continue
    const att = s.ovanfra ? s.zEnd - q[0] : q[1] - s.zEnd
    if (att < verst) verst = att
  }
  return Number.isFinite(verst) ? verst : 0
}

export function byggVev(s: Solid, v: GjestVal): Vev {
  const spennX = s.max[0] - s.min[0]
  const spennY = s.max[1] - s.min[1]
  const spennZ = s.max[2] - s.min[2]
  const steg = Math.max(spennX, spennY, spennZ, 1) / v.detalj
  const sporW = v.t + v.klaring

  // Ribbene står i CELLESENTER og ikkje på cellekantar. Ei ribbe på kanten
  // av omrisset er ei ribbe med null breidd: ho ville telje som ein del,
  // stå i kuttlista og ikkje bera noko.
  const pitchX = spennX / v.nX
  const pitchY = spennY / v.nY
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < v.nX; i++) xs.push(s.min[0] + (i + 0.5) * pitchX)
  for (let j = 0; j < v.nY; j++) ys.push(s.min[1] + (j + 0.5) * pitchY)

  // Same søyla vert spurd om att og om att: éin gong per kryss frå kvar
  // familie, og éin gong til av kvart spor si skuldermåling. Strålen er
  // den dyraste einskildoperasjonen, so svaret vert hugsa for dette bygget.
  const hugs = new Map<string, Span[]>()
  const runsZ = (x: number, y: number): Span[] => {
    const nokkel = x.toFixed(3) + "," + y.toFixed(3)
    let r = hugs.get(nokkel)
    if (!r) {
      r = s.runsZ(x, y)
      hugs.set(nokkel, r)
    }
    return r
  }
  const godsVed = (x: number, y: number, z: number) => {
    for (const [lo, hi] of runsZ(x, y)) if (z >= lo && z <= hi) return true
    return false
  }

  // --- ledda fyrst ---------------------------------------------------------
  // Eit ledd finst berre der begge ribbene har gods i same høgd. På eit
  // importert nett er det ikkje sjølvsagt: ein stol med to bein har søyler
  // som er tomme mellom beina, og eit spor skore der er eit spor i lause
  // lufta. Ledda må reknast FØR profilane, av di det er dei som skal
  // skjerast i profilen.
  const sporX: Spor[][] = xs.map(() => [])
  const sporY: Spor[][] = ys.map(() => [])
  let ledd = 0
  const minLapp = Math.max(2, v.t)

  // Skulderen er kor mykje gods leddet må ha på kvar side av sporet.
  //
  // Det er ikkje eit styrkekrav — det er eit krav om at sporet skal GRIPE
  // og ikkje kappe av ein flis langs kanten. Difor er han nokre få
  // millimeter og ikkje ei heil platetjukn: eit tak på seks, av di ein
  // skulder på seks millimeter og ein på seksten held nøyaktig like godt,
  // medan kravet om seksten kastar heile den ytste ribba ut av rutenettet
  // på eit stort objekt — og ei ribbe utan eit einaste ledd er ei laus
  // plate i eska.
  const skulder = sporW / 2 + Math.min(6, Math.max(2, v.t / 2))

  const rom = (akse: 0 | 1, rpos: number, t: number, zPrøve: number) => {
    const S = 7
    for (let q = -S; q <= S; q++) {
      const tt = t + (q / S) * skulder
      const ok =
        akse === 0 ? godsVed(rpos, tt, zPrøve) : godsVed(tt, rpos, zPrøve)
      if (!ok) return false
    }
    return true
  }

  /**
   * Kor langt sporet må gå for å koma UT på den krumme kanten.
   *
   * Kanten ribba opnar seg i er krum, so eit spor som stoggar nøyaktig ved
   * munnen står att med gods i kvar side: munnen er målt midt i sporet, og
   * kanten ligg lenger ute eit par millimeter til sidene. Difor vert kanten
   * lesen tre stader tvers over sporbreidda, og sporet går til den ytste av
   * dei, pluss tre millimeter.
   *
   * MEN DET MÅ ALDRI NÅ INN I NABOSTYKKET.
   *
   * Ei søyle kan treffe kroppen fleire gonger: ein stol har eit sete over
   * eit bein, ein torus som står har ein nedre og ein øvre boge. Og tvers
   * over sporbreidda kan topologien BYTE — ein millimeter til sida kan dei
   * to stykka ha runne saman til eitt. Les ein då ytterkanten av den søyla,
   * får eit ledd i det eine stykket eit spor som går heilt gjennom det
   * andre, og ribba vert saga i to i staden for å få eit hakk.
   *
   * Difor er svaret klemt inn i LUFTA mellom stykka: sporet får gå til midt
   * i glipa og ikkje ein millimeter lenger. Gjennom luft skjer det
   * ingenting — det er nabostykket det ikkje har noko i å gjere.
   */
  const ut = (
    akse: 0 | 1,
    rpos: number,
    t: number,
    opp: boolean,
    fall: number,
  ) => {
    let e = opp ? -Infinity : Infinity
    for (let q = -1; q <= 1; q++) {
      const tt = t + q * (sporW / 2)
      const rr = akse === 0 ? runsZ(rpos, tt) : runsZ(tt, rpos)
      if (!rr.length) continue
      const val = opp ? rr[rr.length - 1][1] : rr[0][0]
      e = opp ? Math.max(e, val) : Math.min(e, val)
    }
    if (!Number.isFinite(e)) e = fall
    e = opp ? e + 3 : e - 3

    // Glipa over eller under leddet sitt eige stykke, i leddet si eiga
    // søyle. `fall` er munnen, so stykket som inneheld han er stykket.
    const eiga = akse === 0 ? runsZ(rpos, t) : runsZ(t, rpos)
    let grense = opp ? Infinity : -Infinity
    for (let i = 0; i < eiga.length; i++) {
      const [lo, hi] = eiga[i]
      if (fall < lo - 0.6 || fall > hi + 0.6) continue
      const nabo = opp ? eiga[i + 1] : eiga[i - 1]
      if (nabo) grense = opp ? (hi + nabo[0]) / 2 : (lo + nabo[1]) / 2
      break
    }
    return opp ? Math.min(e, grense) : Math.max(e, grense)
  }

  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < ys.length; j++) {
      // X-ribba si søyle ved t = y og Y-ribba si ved t = x er den SAME
      // søyla (x, y). Difor eitt oppslag og ikkje to, og overlappet av eit
      // stykke med seg sjølv er stykket.
      for (const [lo, hi] of runsZ(xs[i], ys[j])) {
        if (hi - lo < minLapp) continue
        const zm = lo + v.ledd * (hi - lo)
        // Leddet treng gods på BEGGE sider av sporet, i begge ribbene, i
        // den høgda sporet står i. Utan det kappar sporet av ein flis langs
        // kanten, og ein flis er ikkje eit grep.
        if (!rom(0, xs[i], ys[j], (zm + hi) / 2)) continue
        if (!rom(1, ys[j], xs[i], (lo + zm) / 2)) continue
        sporX[i].push({
          t: ys[j],
          zMunn: hi,
          zEnd: zm,
          ovanfra: true,
          w: sporW,
          zUt: ut(0, xs[i], ys[j], true, hi),
        })
        sporY[j].push({
          t: xs[i],
          zMunn: lo,
          zEnd: zm,
          ovanfra: false,
          w: sporW,
          zUt: ut(1, ys[j], xs[i], false, lo),
        })
        ledd++
      }
    }
  }
  for (const l of sporX) l.sort((a, b) => a.t - b.t)
  for (const l of sporY) l.sort((a, b) => a.t - b.t)

  let kasta = 0
  let lause = 0

  const lag = (akse: 0 | 1, k: number, pos: number, spor: Spor[]): GjestRibbe => {
    const loops = profilAv(s, akse, pos, spor, steg)
    let ytre: Pt[][] = []
    let hol: Pt[][] = []
    for (const l of loops) {
      const q = simplify(l.pts, v.glatt) as Pt[]
      if (q.length < 3) continue
      // Forteiknet frå den marsjerande ruta seier kva som er kva. Den
      // gamle GJEST sorterte etter STORLEIK og kalla den største
      // ytterkanten — og då vart tre av fire bein til hòl.
      if (l.area > 0) ytre.push(q)
      else hol.push(q)
    }

    /**
     * KVA SOM IKKJE SKAL VERA MED.
     *
     * To ting, og begge vert avgjorde HER — i feltet, ikkje i kuttlista.
     * Blir dei avgjorde seinare, står det att stykke i biletet som aldri
     * kjem i fila, og då er ikkje biletet lenger eit svar på kva maskina
     * gjer.
     *
     *   FLIS    under `MIN_AREAL`. Går alltid bort.
     *   LAUST   eit stykke utan eit einaste spor. Det heng ikkje i noko.
     *           `kastLause` avgjer om det skal skjerast likevel.
     */
    const holaTil = (o: Pt[]) =>
      ytre.length === 1 ? hol : hol.filter((h) => iRingen(o, h[0]))
    const netto = (o: Pt[]) => {
      let a = Math.abs(snorAreal(o))
      for (const h of holaTil(o)) a -= Math.abs(snorAreal(h))
      return a
    }
    const heil = ytre.filter((o) => {
      if (netto(o) < MIN_AREAL) return false
      if (sporI(spor, o) === 0) {
        if (v.kastLause) {
          kasta++
          return false
        }
        lause++
      }
      return true
    })
    if (heil.length !== ytre.length) {
      hol = hol.filter((h) => heil.some((o) => iRingen(o, h[0])))
      ytre = heil
    }

    let kuttLengd = 0
    const stykke: Stykke[] = ytre.map((o) => {
      const mine = holaTil(o)
      const b = bbox(o)
      let a = Math.abs(snorAreal(o))
      kuttLengd += omkrins(o)
      for (const h of mine) {
        a -= Math.abs(snorAreal(h))
        kuttLengd += omkrins(h)
      }
      return {
        outline: o,
        holes: mine,
        area: Math.max(0, a),
        w: b.x1 - b.x0,
        h: b.y1 - b.y0,
        spor: sporI(spor, o),
      }
    })

    return {
      akse,
      k,
      pos,
      stykke,
      spor,
      kuttLengd,
      smalast: smalastAv(spor, (q) => {
        // Stykket sporet står i, ikkje heile ribba: eit spor i ryggen skal
        // ikkje målast mot foten som ligg under ei luke. Munnen på sporet
        // ligg per definisjon på kanten av sitt eige stykke.
        const rr = akse === 0 ? runsZ(pos, q.t) : runsZ(q.t, pos)
        for (const run of rr) {
          if (q.zMunn >= run[0] - 0.6 && q.zMunn <= run[1] + 0.6) return run
        }
        return rr.length ? rr[rr.length - 1] : null
      }),
    }
  }

  const ribber: GjestRibbe[] = []
  for (let i = 0; i < xs.length; i++) ribber.push(lag(0, i, xs[i], sporX[i]))
  for (let j = 0; j < ys.length; j++) ribber.push(lag(1, j, ys[j], sporY[j]))

  return {
    ribber,
    ledd,
    kasta,
    lause,
    boks: [spennX, spennY, spennZ],
    xs,
    ys,
    sporW,
  }
}
