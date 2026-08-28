/**
 * LAFT — lasta.
 *
 * Vegen lasta går er kort nok til å teiknast med ord: 1600 N på setet →
 * setplata bøyer seg mellom dei to bladene → bladene tek det i trykk ned
 * til golvet. Det er heile kjeda, og det er difor typologien har berre
 * dei to tala som betyr noko: SPENNET mellom bladene og OVERHENGET
 * utanfor dei.
 *
 * Setet er rekna som ein bjelke på to opplegg med utkraging i begge
 * endar, og modellen les to lastfall og tek det verste:
 *
 *   MIDT   ein sit midt på: M = P·L/4. Snittet ved v = 0 har mist sporet
 *          til ryggtunga, so berebreidda er djupna MINUS sporet.
 *   KANT   ein sit på ytterkanten: M = P·a der a er overhenget. Snittet
 *          ligg ved bladet, og DER har plata mist tappesporet — det er
 *          det verste snittet i heile møbelet, og det er ingen tilfeldig
 *          plass: ein bit alltid der lasta og hòlet møtest.
 *
 * Bladene tek P/2 kvar i trykk gjennom sitt smalaste snitt, funne ved å
 * skanne profilen — ikkje gissa.
 *
 * Ryggen ber ingen ting av SETELASTA, og kartet fargar han difor kaldt.
 * Det er ikkje ein feil i kartet: NS-EN 1728 sin setelast går ikkje
 * gjennom ryggen, og eit kart som farga han likevel ville dikte.
 */
import { SEAT_LOAD, capacities, type Pt } from "../core"
import { materialet, type Bygg, type Del } from "./profil"

export type Verste = {
  /** trykkspenning, MPa */
  sc: number
  /** bøyespenning, MPa */
  sm: number
  util: number
  /** det styrande snittet: areal og høgd */
  A: number
  z: number
}

export type Modell = {
  verste: Verste
  /** utnytting i setet som funksjon av avstanden frå midten, mm */
  sete(yAbs: number): number
  /** utnytting i bladet i høgd z */
  bein(z: number): number
  capC: number
  capM: number
}

/** materialbreidda i eit vassrett snitt av ein profil, mm */
function snittBreidd(outline: Pt[], holes: Pt[][], w: number): number {
  const xs: number[] = []
  for (const ring of [outline, ...holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      if (a[1] > w === b[1] > w) continue
      xs.push(a[0] + ((w - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
  }
  xs.sort((u, v) => u - v)
  let sum = 0
  for (let i = 0; i + 1 < xs.length; i += 2) sum += xs[i + 1] - xs[i]
  return sum
}

export function lastModell(b: Bygg): Modell {
  const p = b.p
  const { capC, capM } = capacities(materialet(p))
  const t = p.plyT
  const P = SEAT_LOAD

  // --- setet som bjelke ---------------------------------------------------
  const L = Math.max(1, p.spenn)
  const a = Math.max(0, b.overheng)
  // berebreiddene: djupna minus det hòlet som skjer snittet
  const sporB = (t + p.pressfit) / Math.cos(b.rv)
  const bMidt = Math.max(10, p.djup - sporB)
  const bStotte = Math.max(10, p.djup - p.hals)
  const W = (bredd: number) => (bredd * t * t) / 6

  const mMidt = (P * L) / 4
  const mKant = P * a
  const smMidt = mMidt / W(bMidt)
  const smKant = mKant / W(bStotte)
  const sm = Math.max(smMidt, smKant)

  // --- bladene i trykk ----------------------------------------------------
  // Smalaste snitt frå golvet opp til undersida av setet. Tappen er ikkje
  // med: han står i setet og ber ikkje bladet sin eigen last.
  const blad = b.delar.find((d) => d.kind === "bein") as Del
  const zTopp = b.seteUnder(0)
  let minW = Infinity
  let minZ = 0
  const NZ = 60
  for (let i = 1; i < NZ; i++) {
    const z = (i / NZ) * zTopp
    const w = snittBreidd(blad.outline, blad.holes, z)
    if (w > 1 && w < minW) {
      minW = w
      minZ = z
    }
  }
  if (!Number.isFinite(minW)) minW = Math.max(10, p.hals)
  const A = minW * t
  const sc = P / 2 / A

  const util = sc / capC + sm / capM

  return {
    verste: { sc, sm, util, A, z: minZ },
    // Momentet i setet fell lineært frå opplegget: midt imellom er det
    // størst under midtlasta, og ute i utkraginga størst ved bladet.
    sete: (yAbs: number) => {
      const uMidt =
        yAbs <= L / 2
          ? (smMidt * (1 - (2 * yAbs) / L)) / capM
          : 0
      const uKant =
        yAbs >= L / 2 && a > 0.5
          ? (smKant * Math.min(1, (yAbs - L / 2) / Math.max(1, a))) / capM
          : 0
      // ved opplegget møtest dei to lastfalla; det verste av dei gjeld
      const uOppl = yAbs > L / 2 - 20 && yAbs < L / 2 + 20 ? Math.max(smMidt, smKant) / capM : 0
      return Math.max(uMidt, uKant, uOppl)
    },
    bein: (z: number) => {
      if (z >= zTopp) return sc / capC
      const w = snittBreidd(blad.outline, blad.holes, Math.max(0.5, z))
      return w > 1 ? P / 2 / (w * t) / capC : 0
    },
    capC,
    capM,
  }
}

export const lastVerste = (b: Bygg): Verste => lastModell(b).verste

/** kva del eit punkt i verda høyrer til — nærmaste plateplan vinn */
function narmasteDel(b: Bygg, x: number, y: number, z: number): Del | null {
  let beste: Del | null = null
  let bestD = Infinity
  for (const d of b.delar) {
    const o = d.plass.o
    const n = d.plass.n
    const dx = x - o[0]
    const dy = y - o[1]
    const dz = z - o[2]
    const w = dx * n[0] + dy * n[1] + dz * n[2]
    // avstanden ut av planet, minus tjukna: eit punkt PÅ plata gjev 0
    const ut = Math.max(0, Math.abs(w - d.t / 2) - d.t / 2)
    if (ut < bestD) {
      bestD = ut
      beste = d
    }
  }
  return beste
}

/**
 * Feltet lagt på nettet. Kvart hjørne finn plata si, og får utnyttinga
 * modellen gjev DER: setet etter avstanden frå midten, bladet etter
 * snittet i si eiga høgd, ryggen og kilen kaldt.
 */
export function feltPaMesh(b: Bygg, positions: Float32Array): Float32Array {
  const m = lastModell(b)
  const nv = positions.length / 3
  const ut = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const d = narmasteDel(b, x, y, z)
    if (!d) continue
    if (d.kind === "sete") ut[i] = m.sete(Math.abs(y))
    else if (d.kind === "bein") ut[i] = m.bein(z)
    else ut[i] = 0
  }
  return ut
}
