/**
 * GODSPRØVA for LAFT — har kvart hòl noko å sitja i?
 *
 * Leddprøva i `laft-ledd.ts` spør om to delar deler materiale. Denne
 * spør om noko som ser like uskuldig ut på skjermen og som ingen annan
 * prøve fangar: om eit HÒL i det heile ligg inne i den delen det er
 * skore i.
 *
 * Eit spor vert rekna av gjesten sin skugge gjennom verten. Rekninga
 * bryr seg ikkje om verten har materiale der — ho legg berre ringen der
 * gjesten står. Er verten ei krum plate og gjesten ei brei list, kan
 * heile sporet hamne UTANFOR bakkanten. Trekantnettet teiknar det utan å
 * klage, av di eit hòl utanfor omrisset berre er eit hòl ingen ser, og
 * biletet vert ein stol med ein rygg som står i lufta.
 *
 * TO MÅL, av di eit hòl kan svikte på to måtar:
 *
 *   NYTTE   kor stor del av hòlet som ligg INNE i delen. Eit hakk skal
 *           gjerne skjera ut gjennom kanten — krysshalvinga er teikna med
 *           overskot nettopp for at hòlet skal opne seg — so eit hòl som
 *           stikk ut er ikkje i seg sjølv gale. Men eit hòl som knapt
 *           rører delen er ikkje eit spor; det er eit hòl i lufta, og
 *           gjesten har ingen ting å stå i.
 *   GODS    for hòl som ligg HEILT inne: kor nær kanten dei kjem. Eit
 *           spor tett i kanten sprekk fyrste gongen nokon set seg.
 *
 *   npx tsx scripts/laft-gods.ts          posane og terningen
 *   npx tsx scripts/laft-gods.ts 40       med eige tal terningkast
 */
import { DEFAULT_PARAMS, POSAR, POSES, clampParams } from "../lib/laft/params.ts"
import { LAFT } from "../lib/laft/engine.ts"
import { bygg, type Del } from "../lib/laft/profil.ts"
import type { Pt } from "../lib/core.ts"

const KAST = Number(process.argv[2] ?? 40)
/**
 * Minste gods mellom eit hòl som ligg heilt inne og kanten. Òg denne er
 * MÅLT og ikkje sett. Det trongaste staden i konstruksjonen er kilesporet
 * mot enden av tunga, og det talet fell ut av to reglar som alt finst:
 * tunga har eit hardt golv på 56 mm, og kilen står `plyT/cos + 20` under
 * setet med halve kilehøgda på 13 under seg att. Då står det 56 − 35 − 13
 * ≈ 7,6 mm gods under kilesporet når tunga er på sitt kortaste. Terskelen
 * ligg rett under det: alt trongare enn dette er noko anna enn den
 * planlagde trongaste staden.
 */
const GODS = 6
/**
 * Minste del av eit hòl som må liggje inne i delen. Terskelen er MÅLT og
 * ikkje sett: over posane og terningen ligg alt som er meint å vera der
 * mellom 91 og 100 prosent — krysshalvinga sitt hakk er nede på 91, av di
 * han med vilje er teikna med overskot ut gjennom overkanten. Under 85 er
 * det ikkje eit hakk lenger; det er eit spor som har rutsja av plata.
 */
const NYTTE = 0.85

const raud = (s: string) => `\x1b[31m${s}\x1b[0m`
const gron = (s: string) => `\x1b[32m${s}\x1b[0m`
const gul = (s: string) => `\x1b[33m${s}\x1b[0m`

function iRing(ring: Pt[], x: number, y: number): boolean {
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}

/** kortaste avstand frå eit punkt til ein ring — positiv inne, negativ ute */
function tilKant(ring: Pt[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const dx = xj - xi
    const dy = yj - yi
    const L = dx * dx + dy * dy
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / L)) : 0
    best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)))
  }
  return iRing(ring, x, y) ? best : -best
}

/** kor stor del av ringen sitt areal som ligg inne i verten, ved rutesampling */
function nytte(vert: Pt[], hol: Pt[]): number {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of hol) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const N = 26
  let inne = 0
  let ialt = 0
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const x = x0 + ((a + 0.5) * (x1 - x0)) / N
      const y = y0 + ((b + 0.5) * (y1 - y0)) / N
      if (!iRing(hol, x, y)) continue
      ialt++
      if (iRing(vert, x, y)) inne++
    }
  }
  return ialt > 0 ? inne / ialt : 1
}

type Funn = { del: string; hol: number; gods: number; nytte: number; punkt: Pt }

/** kvart hòl i kvar del: kor mykje av det som ligg inne, og kor nær kanten */
function prov(p: Record<string, number | string>): Funn[] {
  const ut: Funn[] = []
  for (const d of bygg(p as never).delar as Del[]) {
    d.holes.forEach((h, i) => {
      let verst = Infinity
      let kvar: Pt = [0, 0]
      for (const [x, y] of h) {
        const g = tilKant(d.outline, x, y)
        if (g < verst) {
          verst = g
          kvar = [x, y]
        }
      }
      ut.push({ del: d.id, hol: i, gods: verst, nytte: nytte(d.outline, h), punkt: kvar })
    })
  }
  return ut
}

const seeded = (s: string) => {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 1e6) / 1e6
  }
}

const punkt: [string, Record<string, number | string>][] = [
  ["standard", DEFAULT_PARAMS as never],
  ...POSES.map((q, i): [string, Record<string, number | string>] => [
    POSAR[i]?.namn ?? `pose ${i + 1}`,
    clampParams({ ...DEFAULT_PARAMS, ...q }, DEFAULT_PARAMS) as never,
  ]),
  ...Array.from({ length: KAST }, (_, i): [string, Record<string, number | string>] => [
    `kast ${i}`,
    LAFT.random(seeded("gods" + i), LAFT.defaults, new Set()) as never,
  ]),
]

console.log(`GODSPRØVA — ${punkt.length} punkt, minstegods ${GODS} mm\n`)

let brot = 0
let knapt = 0
let lagstNytte = 1
let lagstNamn = ""
for (const [namn, p] of punkt) {
  const funn = prov(p)
  // NYTTE fyrst: eit hòl som knapt rører delen er ein annan og verre feil
  // enn eit hòl som ligg litt for nær kanten.
  const tynn = funn.reduce((a, b) => (b.nytte < a.nytte ? b : a))
  const tynne = funn.filter((f) => f.nytte < NYTTE)
  // GODS berre for dei som ligg heilt inne — eit hakk som med vilje skjer
  // ut gjennom kanten har negativ avstand og skal ikkje målast slik.
  const lukka = funn.filter((f) => f.nytte > 0.985)
  const nær = lukka.length ? lukka.reduce((a, b) => (b.gods < a.gods ? b : a)) : null

  if (tynn.nytte < lagstNytte) {
    lagstNytte = tynn.nytte
    lagstNamn = namn
  }

  const knappe = lukka.filter((f) => f.gods < GODS)
  if (tynne.length || knappe.length) {
    brot++
    for (const f of tynne) {
      console.log(
        raud(`  BROT ${namn.padEnd(10)}`) +
          ` ${f.del} hòl ${f.hol}: berre ${(f.nytte * 100).toFixed(0)} % av sporet ligg i delen` +
          ` (x ${f.punkt[0].toFixed(0)} y ${f.punkt[1].toFixed(0)})`,
      )
    }
    for (const f of knappe) {
      console.log(
        raud(`  BROT ${namn.padEnd(10)}`) +
          ` ${f.del} hòl ${f.hol}: lukka hòl berre ${f.gods.toFixed(0)} mm frå kanten`,
      )
    }
  } else if (tynn.nytte < 0.9 || (nær && nær.gods < GODS * 2)) {
    knapt++
    console.log(
      gul(`  knapt ${namn.padEnd(9)}`) +
        ` nytte ${(tynn.nytte * 100).toFixed(0)} %` +
        (nær ? ` · gods ${nær.gods.toFixed(0)} mm` : ""),
    )
  }
}

console.log(
  `\ntynnaste sporet: ${lagstNamn} med ${(lagstNytte * 100).toFixed(0)} % inne` +
    (knapt ? ` · ${knapt} punkt er knappe` : ""),
)
if (brot) {
  console.log(raud(`${brot} av ${punkt.length} punkt har eit hòl utan gods kring seg`))
  process.exit(1)
}
console.log(gron(`alle ${punkt.length} punkta har gods kring kvart hòl`))
