/**
 * VIKING — delane.
 *
 * Tre deltypar, og talet på dei er ikkje ei ulukke: eit klinkbygd skrog ER
 * mange like ting. Eit vikingskip har hundrevis av naglar, og det er
 * nettopp difor det kan byggjast utan lim og utan ei einaste skrue.
 *
 *   BORD (B)    n stykke, kvart ei flat stripe i sitt eige plan. Ingen av
 *               dei er like: breidda fylgjer skroget, so bordet i stamnen
 *               er smalt og det midtskips er breitt.
 *   SPANT (S)   to stykke, i kvar sitt loddrette plan på tvers av borda.
 *               Dei held vinkelen i lappane — utan dei er kvar lapp eit
 *               hengsle — og dei held fram under skroget og ned i golvet,
 *               so dei er òg beina.
 *   NAGLE (N)   n−1 stykke, ein i kvar lapp, MIDT MELLOM SPANTA. Der gjer
 *               han arbeidet: endane av bordet er alt haldne av spanta,
 *               og det som står att er at lappen gapar på midten under ein
 *               kropp. Han går gjennom begge borda, og han er den eine
 *               delen som skal kuttast i eit anna treslag — same rolla som
 *               kilen i LAFT, av di det er han som held.
 *
 * Fyrste utgåva hadde TO naglar i kvar lapp, ein ved kvart spant. Det var
 * seksten laust småtteri i ein flatpakke, og dei gjorde ingen ting spanta
 * ikkje alt gjorde. Éin nagle på midten er halve delelista og heile
 * arbeidet.
 */
import { MATERIALS, shoelace, type Pt } from "../core"
import { rekt, sporRing, type Gjest, type Plass } from "../plater"
import { reinsk } from "../platemesh"
import { bordPlass, byggSkrog, type Skrog } from "./skrog"
import { materialet, type Params } from "./params"

export type Del = {
  id: string
  kind: "bord" | "spant" | "nagle"
  outline: Pt[]
  holes: Pt[][]
  plass: Plass
  t: number
}

export type Part = {
  id: string
  outline: Pt[]
  holes: Pt[][]
  t: number
  area: number
  mass: number
}

export type PartList = { parts: Part[]; ids: string[]; area: number; mass: number }

const medKlokka = (r: Pt[]): Pt[] => (shoelace(r) > 0 ? [...r].reverse() : r)

function iRing(ring: Pt[], x: number, y: number): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}

/** ligg heile ringen godt inne i verten, med gods kring seg? */
function inneI(vert: Pt[], ring: Pt[]): boolean {
  let cx = 0
  let cy = 0
  for (const [x, y] of ring) {
    cx += x / ring.length
    cy += y / ring.length
  }
  // kvart hjørne, og eit stykke utanfor det, må vera inne
  for (const [x, y] of ring) {
    const ut = 10 / Math.max(1, Math.hypot(x - cx, y - cy))
    if (!iRing(vert, x + (x - cx) * ut, y + (y - cy) * ut)) return false
  }
  return true
}
const motKlokka = (r: Pt[]): Pt[] => (shoelace(r) > 0 ? r : [...r].reverse())

/**
 * BORDET.
 *
 * I sitt eige plan er u langs fasetten og v langs y. Bordet strekkjer seg
 * `lapp` millimeter BAK startpunktet sitt — det er overlappet — og heilt
 * fram til enden av fasetten. Breidda fylgjer skroget, so kanten er ei
 * kurve og ikkje ein rett strek.
 *
 * Ein ting til, og han er heile grunnen til at klink verkar: bordet ligg
 * ei TJUKN ut langs normalen i høve til det under. Difor er origo i
 * planet forskuva med plyT — borda trappar seg utover, og det er den
 * trappa auget les som klink.
 */
function bordDel(sk: Skrog, i: number, p: Params): Del {
  const n = sk.knute.length - 1
  const pl = bordPlass(sk, i)
  const a = sk.knute[i]
  const b = sk.knute[i + 1]
  const L = Math.hypot(b.x - a.x, b.z - a.z)
  // u = 0 er lappekanten; bordet går frå −lapp (inn under det førre) til L
  const u0 = i === 0 ? 0 : -p.lapp
  const u1 = L
  const M = 14
  const opp: Pt[] = []
  const ned: Pt[] = []
  for (let k = 0; k <= M; k++) {
    const u = u0 + ((u1 - u0) * k) / M
    // kvar u svarar til ein plass langs bogen, og breidda vert lesen der
    const s = (i + Math.max(0, u) / Math.max(1, L)) / n
    const w = sk.halvB(s)
    opp.push([u, w])
    ned.push([u, -w])
  }
  return {
    id: "B" + (i + 1),
    kind: "bord",
    outline: reinsk(motKlokka([...ned, ...opp.reverse()])),
    holes: [],
    // forskyvinga utover: bord nummer i ligg i·0 tjukner ut? Nei — kvart
    // bord ligg éi tjukn utanfor det under, men berre i lappen. Planet
    // sjølv ligg på skroglina; trappa kjem av at lappen ligg oppå.
    plass: pl,
    t: p.plyT,
  }
}

/**
 * SPANTET.
 *
 * Omrisset er profilkurva forskuva INNOVER ei tjukn — spantet ligg inne i
 * skalet, slik eit spant gjer — og so ned til golvet med to føter. Kvart
 * bord går gjennom eit spor i det, og sporet vert rekna av bordet sin
 * eigen skugge og ikkje teikna.
 */
function spantDel(sk: Skrog, teikn: number, p: Params): Del {
  const kn = sk.knute
  const n = kn.length - 1
  const t = p.plyT
  const plass: Plass = {
    o: [0, teikn * sk.spantY, 0],
    u: [1, 0, 0],
    v: [0, 0, 1],
    n: [0, teikn, 0],
  }
  /**
   * Overkanten: skroglina forskuva UT.
   *
   * Men IKKJE heile vegen opp ryggen. Eit spant som fylgde skroget til
   * ryggtoppen og so gjekk ned til golvet ville vera ei heil sideplate —
   * eit halvt kvadratmeter finér som skjuler skalet det skal bera, og
   * dessutan same figuren som LAFT sine blad. Eit båtspant sluttar ved
   * essinga; det som held det som stikk over, er eit KNE. Difor stoppar
   * innerkanten litt oppe i ryggen og let resten av han vera boren av
   * skalet sjølv — som er heile poenget med eit klinkbygd skrog.
   *
   * Og han er forskuva UTOVER og ikkje innover. Eit ekte båtspant ligg
   * inne i huda, og borda vert klinka til kanten hans; her går borda
   * TVERS GJENNOM spantet, av di eit spor gjennom ei plate held ei anna
   * plate utan lim, og ein nagle i enden av eit bord ikkje gjer det.
   * Skal sporet ha gods kring seg, må plata rekke forbi bordet — difor
   * tjukna pluss eit gods. Spantet vert då ei sideplate som stikk fram
   * som ei essing, og det er ærleg nok: det er slik ein ser at borda er
   * tredde gjennom og ikkje limte på.
   */
  const spantGods = 26
  const kneTopp = p.hogd + p.skaal + Math.min(p.ryggH * 0.45, 130) * Math.cos((p.ryggV * Math.PI) / 180)
  const inner: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const pl = bordPlass(sk, Math.min(n - 1, i))
    const k = kn[i]
    if (i > 2 && k.z > kneTopp) break
    inner.push([k.x + pl.n[0] * (t + spantGods), k.z + pl.n[2] * (t + spantGods)])
  }
  // Ytterkanten går NED TIL GOLVET. Skroget når det ikkje sjølv — det
  // ligg i krybba — so spantet er heile beinet, og her er det ingen
  // strid om kven som står på bakken.
  //
  // Frå bakre enden av skroglina, ned langs ryggen si line til golvet,
  // fram langs golvet med ein boge mellom to føter, og opp att i baugen.
  // Innerkanten går frå framme og bakover, so ringen vert lukka ved å
  // gå den andre vegen langs botnen.
  const framX = inner[0][0]
  const bakX = inner[inner.length - 1][0]
  const framZ = inner[0][1]
  const bakZ = inner[inner.length - 1][1]
  const ring: Pt[] = [...inner]
  // rett ned frå bakre enden, med spantbreidda som gods
  const bakFot = bakX + p.fotbreidd * 0.5
  ring.push([bakX, Math.max(0, bakZ - p.spantB)])
  ring.push([bakFot - p.fotbreidd * 0.5, 0])
  ring.push([bakFot + p.fotbreidd * 0.5, 0])
  // bogen mellom føtene
  const framFot = framX - p.fotbreidd * 0.5
  const spenn = framFot - bakFot
  const bogeH = Math.max(20, Math.min(p.fotH, Math.abs(spenn) * 0.42))
  const NB = 20
  for (let i = 0; i <= NB; i++) {
    const q = i / NB
    ring.push([bakFot + p.fotbreidd * 0.5 + (spenn - p.fotbreidd) * q, bogeH * Math.sin(Math.PI * q) ** 1.35])
  }
  ring.push([framFot - p.fotbreidd * 0.5, 0])
  ring.push([framFot + p.fotbreidd * 0.5, 0])
  ring.push([framX, Math.max(0, framZ - p.spantB * 0.8)])

  const d: Del = {
    id: teikn > 0 ? "S1" : "S2",
    kind: "spant",
    outline: reinsk(motKlokka(ring)),
    holes: [],
    plass,
    t,
  }
  return d
}

/**
 * NAGLEN.
 *
 * Ein liten kile som går gjennom begge borda i ein lapp. Han er teikna i
 * sitt eige plan — lappen sitt tverrplan — og han er den einaste delen i
 * kontrastvirke.
 */
function nagleRing(p: Params): Pt[] {
  const b = Math.max(8, p.plyT * 0.62)
  const L = p.plyT * 2.6 + 14
  return medKlokka([
    [-L / 2, -b / 2],
    [L / 2, -b / 2 + 1.6],
    [L / 2, b / 2 - 1.6],
    [-L / 2, b / 2],
  ])
}

export function byggDelar(p: Params): { sk: Skrog; delar: Del[] } {
  const sk = byggSkrog(p)
  const n = sk.knute.length - 1
  const t = p.plyT
  const fit = p.pressfit
  const delar: Del[] = []

  const bord: Del[] = []
  for (let i = 0; i < n; i++) bord.push(bordDel(sk, i, p))
  const spant = [spantDel(sk, 1, p), spantDel(sk, -1, p)]

  // --- spora i spanta: kvart bord sin eigen skugge -------------------------
  //
  // Men berre for dei borda spantet FAKTISK REKK. Spantet sluttar ved
  // kneet; borda over det er borne av skalet sjølv. Eit spor for eit bord
  // spantet ikkje rekk ville hamne utanfor plata — eit hòl i lufta, som
  // trekantnettet teiknar utan å klage og verkstaden ikkje kan kutte.
  // Difor vert kvart spor prøvd mot omrisset før det vert lagt inn.
  for (const s of spant) {
    for (const b of bord) {
      const g: Gjest = { plass: b.plass, outline: b.outline, t: b.t }
      const r = sporRing(s.plass, s.t, g, fit)
      if (r && r.length >= 3 && inneI(s.outline, r)) s.holes.push(reinsk(medKlokka(r)))
    }
  }

  // --- naglane: ein i kvar ende av kvar lapp -------------------------------
  const naglar: Del[] = []
  const nring = nagleRing(p)
  for (let i = 0; i + 1 < n; i++) {
    const over = bord[i + 1]
    // Midt i skroget, mellom spanta. Endane av bordet er alt haldne der
    // det går gjennom spantet; det som står att å halde er midten.
    const u = -p.lapp * 0.5
    const o = [
      over.plass.o[0] + over.plass.u[0] * u,
      0,
      over.plass.o[2] + over.plass.u[2] * u,
    ] as [number, number, number]
    const plass: Plass = {
      o,
      u: [over.plass.n[0], 0, over.plass.n[2]],
      v: [0, 1, 0],
      n: [-over.plass.u[0], 0, -over.plass.u[2]],
    }
    naglar.push({ id: "N" + (i + 1), kind: "nagle", outline: nring, holes: [], plass, t })
  }
  // hòla for naglane, i begge borda han går gjennom
  for (let i = 0; i + 1 < n; i++) {
    const nag = naglar[i]
    if (!nag) continue
    const g: Gjest = { plass: nag.plass, outline: nag.outline, t: nag.t }
    for (const vert of [bord[i], bord[i + 1]]) {
      const r = sporRing(vert.plass, vert.t, g, fit)
      if (r && r.length >= 3) vert.holes.push(reinsk(medKlokka(r)))
    }
  }
  void rekt

  delar.push(...bord, ...spant, ...naglar)
  return { sk, delar }
}

export function delAreal(d: Del): number {
  let a = Math.abs(shoelace(d.outline))
  for (const h of d.holes) a -= Math.abs(shoelace(h))
  return Math.max(0, a)
}

export function buildParts(p: Params): PartList {
  const { delar } = byggDelar(p)
  const rho = MATERIALS[materialet(p)].rho
  const parts: Part[] = delar.map((d) => {
    const area = delAreal(d)
    return {
      // naglane er alle like — éi maske, ein blankett
      id: d.kind === "nagle" ? "nagle" : d.id,
      outline: d.outline,
      holes: d.holes,
      t: d.t,
      area,
      mass: (area * d.t * rho) / 1e9,
    }
  })
  return {
    parts,
    ids: parts.map((q) => q.id),
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
