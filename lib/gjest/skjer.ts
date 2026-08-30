/**
 * GJEST — snittet gjennom trekantsuppa.
 *
 * Motorane i sandkassen les ribbeprofilen ut av eit FELT: dei veit kva
 * som er inne og kva som er ute i kvart punkt, so ei marsjerande rute
 * finn konturen. Ein importert mesh har ikkje eit felt. Han har flater,
 * og då er snittet ei anna rekning: kvar trekant som kryssar planet gjev
 * eitt linestykke, og linestykka skal kjedast til lukka konturar.
 *
 * Kjedinga er heile vanskane. To linestykke høyrer saman når endane
 * deira er same punkt — men dei er REKNA punkt, kvar av dei frå si eiga
 * interpolasjon, so dei er aldri bit-like. Difor vert endane kvantiserte
 * til eit rutenett før dei vert slegne saman: to endar i same rute ER
 * same punktet. Ruta er sett etter kor stort objektet er og ikkje etter
 * ein konstant, so ho tyder det same på ein krakk som på ein katedral.
 *
 * Ein mesh som ikkje er lukka gjev opne kjeder. Dei vert ikkje kasta —
 * dei vert LUKKA, med ei rett line frå enden til byrjinga, og talet på
 * dei vert meldt. Ein brukar som importerer eit skal utan botn skal få
 * eit møbel og ei melding, ikkje ein tom skjerm.
 */
import type { Pt } from "../core"
import type { Trekantar } from "./glb"

export type Snitt = {
  /** lukka konturar i (t, z): t er den aksen som ikkje er snittaksen */
  loops: Pt[][]
  /** kor mange kjeder som måtte lukkast med ei rett line */
  opne: number
}

/** akse 0 = snitt vinkelrett på X, akse 1 = vinkelrett på Y */
export type Akse = 0 | 1

/**
 * Snittet ved `pos` langs `akse`.
 *
 * Punkta kjem ut i (t, z), der t er den andre vassrette aksen. Det er
 * nøyaktig det koordinatet kuttfila og nettet brukar for ei ribbe i
 * VAFFEL, so ein gjesteprofil og ein vaffelprofil er same slaget ting.
 */
export function skjer(tri: Trekantar, akse: Akse, pos: number, rute: number): Snitt {
  const p = tri.pos
  // Endane vert kvantiserte til denne ruta før dei vert slegne saman.
  // For grov, og to skilde konturar smeltar; for fin, og ein lukka
  // kontur fell frå kvarandre. Ein tusendel av objektet er godt inne i
  // begge marginane.
  const q = Math.max(1e-4, rute)
  const nokkel = (x: number, y: number) =>
    `${Math.round(x / q)},${Math.round(y / q)}`

  type Kant = { a: Pt; b: Pt; ka: string; kb: string }
  const kantar: Kant[] = []

  const ut: number[] = []
  for (let i = 0; i < p.length; i += 9) {
    // avstanden frå kvart hjørne til planet, med forteikn
    const d0 = p[i + akse] - pos
    const d1 = p[i + 3 + akse] - pos
    const d2 = p[i + 6 + akse] - pos
    // heilt på éi side: ingen kryssing
    if ((d0 > 0 && d1 > 0 && d2 > 0) || (d0 < 0 && d1 < 0 && d2 < 0)) continue
    // Ein trekant som ligg HEILT i planet gjev ikkje eit linestykke —
    // han gjev ei flate, og ho ville lagt tre kantar oppå kvarandre.
    // Slike vert hoppa over; naboane deira gjev den same konturen.
    if (d0 === 0 && d1 === 0 && d2 === 0) continue

    ut.length = 0
    const par = (ia: number, da: number, ib: number, db: number) => {
      if ((da > 0 && db > 0) || (da < 0 && db < 0)) return
      if (da === db) return
      const t = da / (da - db)
      // t-aksen er den ANDRE vassrette aksen, z er alltid komponent 2
      const ta = akse === 0 ? 1 : 0
      ut.push(
        p[i + ia * 3 + ta] + (p[i + ib * 3 + ta] - p[i + ia * 3 + ta]) * t,
        p[i + ia * 3 + 2] + (p[i + ib * 3 + 2] - p[i + ia * 3 + 2]) * t,
      )
    }
    par(0, d0, 1, d1)
    par(1, d1, 2, d2)
    par(2, d2, 0, d0)
    if (ut.length < 4) continue
    const a: Pt = [ut[0], ut[1]]
    const b: Pt = [ut[2], ut[3]]
    const ka = nokkel(a[0], a[1])
    const kb = nokkel(b[0], b[1])
    if (ka === kb) continue // eit linestykke utan lengd
    kantar.push({ a, b, ka, kb })
  }

  if (!kantar.length) return { loops: [], opne: 0 }

  // kvar node peikar på dei kantane som endar i henne
  const ved = new Map<string, number[]>()
  for (let i = 0; i < kantar.length; i++) {
    for (const k of [kantar[i].ka, kantar[i].kb]) {
      const l = ved.get(k)
      if (l) l.push(i)
      else ved.set(k, [i])
    }
  }

  const brukt = new Uint8Array(kantar.length)
  const loops: Pt[][] = []
  let opne = 0

  for (let start = 0; start < kantar.length; start++) {
    if (brukt[start]) continue
    brukt[start] = 1
    const loop: Pt[] = [kantar[start].a, kantar[start].b]
    let ende = kantar[start].kb
    const startNokkel = kantar[start].ka
    let lukka = false
    // gå framover til kjeda kjem attende til starten eller tek slutt
    for (let steg = 0; steg < kantar.length + 4; steg++) {
      if (ende === startNokkel) {
        lukka = true
        break
      }
      const kand = ved.get(ende)
      let neste = -1
      if (kand) for (const c of kand) if (!brukt[c]) { neste = c; break }
      if (neste < 0) break
      brukt[neste] = 1
      const k = kantar[neste]
      if (k.ka === ende) {
        loop.push(k.b)
        ende = k.kb
      } else {
        loop.push(k.a)
        ende = k.ka
      }
    }
    if (!lukka) opne++
    if (loop.length >= 3) loops.push(loop)
  }

  return { loops, opne }
}

/** areal med forteikn — positivt er mot klokka */
export function areal(ring: Pt[]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    s += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
  }
  return s / 2
}

/**
 * Fjern konturar som er for små til å vera ein del.
 *
 * Ein mesh har alltid litt skrot: ein tupp som så vidt kryssar planet,
 * ein T-node, ei flate som ligg dobbelt. Kvar av dei gjev ein kontur på
 * nokre få kvadratmillimeter, og kvar av dei ville stått i kuttlista som
 * ein DEL. Grensa er relativ til den største konturen i snittet, so ho
 * tyder det same same kor stort objektet er.
 */
export function reinsk(loops: Pt[][], del = 0.01): Pt[][] {
  if (!loops.length) return loops
  const areal2 = loops.map((l) => Math.abs(areal(l)))
  const storst = Math.max(...areal2)
  if (storst <= 0) return []
  return loops.filter((_, i) => areal2[i] >= storst * del)
}

/**
 * Rett ut konturen: slå saman punkt som ligg nærare kvarandre enn `eps`,
 * og fjern punkt som ligg på lina mellom naboane sine.
 *
 * Eit snitt gjennom ein mesh med tjue tusen trekantar gjev ein kontur med
 * tusenvis av punkt, og dei aller fleste av dei seier ingenting: dei er
 * der av di mesh-en er finmaska, ikkje av di forma krev det. Ein
 * kuttfil med tusen punkt per ribbe er ei fil maskina brukar lang tid
 * på og som ingen kan lesa.
 */
export function forenkl(ring: Pt[], eps: number): Pt[] {
  if (ring.length < 4) return ring
  const ut: Pt[] = []
  for (const p of ring) {
    const q = ut[ut.length - 1]
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < eps) continue
    ut.push(p)
  }
  while (ut.length > 3) {
    const a = ut[0]
    const b = ut[ut.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= eps) break
    ut.pop()
  }
  if (ut.length < 4) return ut
  // so vekk med det som ligg på lina: avviket frå korda mellom naboane
  const halde: Pt[] = []
  for (let i = 0; i < ut.length; i++) {
    const a = ut[(i - 1 + ut.length) % ut.length]
    const b = ut[i]
    const c = ut[(i + 1) % ut.length]
    const ax = c[0] - a[0]
    const ay = c[1] - a[1]
    const len = Math.hypot(ax, ay)
    const av =
      len < 1e-9
        ? Math.hypot(b[0] - a[0], b[1] - a[1])
        : Math.abs(ax * (a[1] - b[1]) - ay * (a[0] - b[0])) / len
    if (av >= eps) halde.push(b)
  }
  return halde.length >= 3 ? halde : ut
}
