/**
 * RIBBE — lasta, målt PÅ flata.
 *
 * Modellen er den same som tavla les, evaluert langs kvart blad: momentet
 * kjem ikkje frå lasta, men frå at bladet ikkje er rett — midja bular
 * innanfor korda mellom fot og sete, og det er den avstanden som lagar
 * bøyemomentet. Ei rett, kjegleforma ribbe hadde ikkje hatt det. Attåt
 * står trykket av bladlasta delt på veven i snittet.
 *
 * Fiberen legg bøyespenninga der ho faktisk er: null midt i veven, full i
 * ytterkantane. Band og sete står utan felt — dei held blada i vinkel og
 * ber setet, men lastvegen i modellen går gjennom blada, og eit kart som
 * farga dei ville dikte. Det kartet IKKJE er: elementmetode. Kvart blad
 * ber for seg; det er eit overslag, og det seier det sjølv.
 */
import { SEAT_LOAD, capacities } from "../core"
import type { Params } from "./params"
import type { Shell } from "./shell"
import type { Built } from "./mesh"

/**
 * Lasta som når éi ribbe. NS-EN 1728 gjev 1600 N konsentrert på setet;
 * står lasta ved kanten, tek ein firedel av ribbene om lag seksti prosent
 * av henne. Talet er eit skjøn og skal lesast som eit skjøn — men det er
 * det same skjønet i alle snitt, så samanlikninga mellom to objekt held.
 */
const EDGE_SHARE = 0.6

type BladFelt = {
  /** stasjonshøgdene, stigande */
  u: number[]
  /** vevkantane og midten i kvar stasjon */
  a: number[]
  b: number[]
  mid: number[]
  /** trykk- og bøyeutnyttinga i kvar stasjon (bøying før fiber) */
  uc: number[]
  um: number[]
}

/** lasta, kapasitetane og kontaktgrensa for eit gjeve objekt */
function last(sh: Shell, g: Built, p: Params) {
  const nRib = g.blades.length
  const nCarry = Math.max(3, Math.round(nRib / 4))
  return {
    cap: capacities(p.material),
    N: (SEAT_LOAD * EDGE_SHARE) / nCarry,
    // Under fotbogen er snittet ei kontaktflate og ikkje ei søyle: lasta
    // spreier seg inn i bladet over nokre få centimeter, og eit snitt
    // gjennom fotspissen måler kontakttrykket i staden for bereevna.
    arcTop: Math.min(p.footArc, sh.zBlade * 0.45),
  }
}

function byggBladFelt(
  sh: Shell,
  p: Params,
  cap: { capC: number; capM: number },
  N: number,
  bl: Built["blades"][number],
): BladFelt | null {
  const st = bl.st
  if (st.length < 2) return null
  const sFoot = (st[0].a + st[0].b) / 2
  const sist = st[st.length - 1]
  const sTop = (sist.a + sist.b) / 2

  const u: number[] = []
  const a: number[] = []
  const b: number[] = []
  const mid: number[] = []
  const uc: number[] = []
  const um: number[] = []
  for (const q of st) {
    const web = q.b - q.a
    u.push(q.u)
    a.push(q.a)
    b.push(q.b)
    mid.push((q.a + q.b) / 2)
    if (web <= 1) {
      uc.push(0)
      um.push(0)
      continue
    }
    const A = web * p.bladeT
    const W = (p.bladeT * web * web) / 6
    const chord = sFoot + ((sTop - sFoot) * q.u) / Math.max(1, sh.zBlade)
    const e = Math.abs((q.a + q.b) / 2 - chord)
    uc.push(N / A / cap.capC)
    um.push(((N * e) / W) / cap.capM)
  }
  return { u, a, b, mid, uc, um }
}

/**
 * Det verste punktet over alle blad og alle snitt — same modell, same tal.
 * Tavla les DETTE, og maksimumet i lastkartet er per konstruksjon det
 * same: kartet og tavla kan ikkje seie kvar sitt, av di dei spør same
 * funksjon.
 */
export function lastVerste(
  sh: Shell,
  g: Built,
  p: Params,
): { util: number; sc: number; sm: number; z: number; A: number } {
  const { cap, N, arcTop } = last(sh, g, p)
  let best = { util: 0, sc: 0, sm: 0, z: 0, A: 0 }
  for (const bl of g.blades) {
    const f = byggBladFelt(sh, p, cap, N, bl)
    if (!f) continue
    for (let i = 0; i < f.u.length; i++) {
      if (f.u[i] < arcTop) continue
      const util = f.uc[i] + f.um[i]
      if (util > best.util) {
        const web = f.b[i] - f.a[i]
        best = {
          util,
          sc: f.uc[i] * cap.capC,
          sm: f.um[i] * cap.capM,
          z: f.u[i],
          A: web * p.bladeT,
        }
      }
    }
  }
  return best
}

/**
 * Feltet lagt på nettet: éin utnyttingsverdi per hjørne, 1,0 = kapasitet.
 * Kvart hjørne vert prøvd mot alle blada; ligg det i fleire (nær navet),
 * gjeld den verste. Band- og setehjørne treffer ingen blad og står på 0.
 */
export function feltPaMesh(
  sh: Shell,
  g: Built,
  p: Params,
  positions: Float32Array,
): Float32Array {
  const { cap, N, arcTop } = last(sh, g, p)
  const ht = p.bladeT / 2 + 0.5
  const blad = g.blades.map((bl) => ({
    b: bl.b,
    f: byggBladFelt(sh, p, cap, N, bl),
  }))
  const nv = positions.length / 3
  const out = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    const dx0 = positions[i * 3]
    const dy0 = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    let v = 0
    for (const { b, f } of blad) {
      if (!f) continue
      const dx = dx0 - b.a[0]
      const dy = dy0 - b.a[1]
      const w = dx * b.n[0] + dy * b.n[1]
      if (w > ht || w < -ht) continue
      const s = dx * b.d[0] + dy * b.d[1]
      // stasjonane ligg stigande i høgd; finn spennet z ligg i
      const u = f.u
      if (z <= u[0] || z >= u[u.length - 1]) continue
      let k = 1
      while (k < u.length - 1 && u[k] < z) k++
      const t = (z - u[k - 1]) / Math.max(1e-6, u[k] - u[k - 1])
      const a = f.a[k - 1] * (1 - t) + f.a[k] * t
      const bb = f.b[k - 1] * (1 - t) + f.b[k] * t
      if (s < a - 1 || s > bb + 1) continue
      const uc = f.uc[k - 1] * (1 - t) + f.uc[k] * t
      // kontaktsona: berre trykk — sjå kommentaren i last()
      if (z < arcTop) {
        if (uc > v) v = uc
        continue
      }
      const um = f.um[k - 1] * (1 - t) + f.um[k] * t
      const web = Math.max(1, bb - a)
      // fiberen: null i nøytralaksen, full i ytterkant av veven
      const fiber = Math.min(1, Math.abs((2 * (s - (a + bb) / 2)) / web))
      const q = uc + fiber * um
      if (q > v) v = q
    }
    out[i] = v
  }
  return out
}
