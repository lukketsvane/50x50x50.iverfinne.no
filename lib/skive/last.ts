/**
 * SKIVE — lasta, målt PÅ flata.
 *
 * Modellen er den same som tavla les, evaluert langs kvar skive: puta frå
 * NS-EN 1728 er ~300 mm brei og står berre på dei skivene som ligg under
 * henne — resten av rekkja ber ingenting og står blå i kartet. Det er
 * ikkje ein feil i kartet; det er heile poenget med lufta mellom skivene.
 *
 * I kvar berande skive: setebandet over bogeopninga som fritt opplagd
 * bjelke med punktlast midt i — momentet veks lineært frå opplegga inn
 * mot midten, motstanden les den VERKELEGE banddjupna av konturen i
 * nøyaktig det punktet. Fiberen legg bøyespenninga der ho er: null i
 * nøytralaksen, full i ytterkant. Beina under ber sin halvdel i reint
 * trykk. Stavane er avstandshaldarar og står utan felt. Det kartet IKKJE
 * er: elementmetode — kvar skive ber for seg, og det seier det sjølv.
 */
import { SEAT_LOAD, capacities, type Material, type Pt } from "../core"
import type { Params } from "./params"
import type { Build, Slice } from "./profile"

const N = 48

/** vertikale materialintervall ved gjeve x — kryssingane med rollene bytte */
function zRunsAt(outline: Pt[], x: number): [number, number][] {
  const zs: number[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    if (a[0] === b[0]) continue
    if (x >= Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])) {
      zs.push(a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]))
    }
  }
  zs.sort((u, v) => u - v)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < zs.length; i += 2) {
    if (zs[i + 1] - zs[i] > 0.2) out.push([zs[i], zs[i + 1]])
  }
  return out
}

type SkiveFelt = {
  xL: number
  xR: number
  /** trykkutnyttinga i beina, konstant per skive */
  uc: number
  /** sampla over spennet: botn og topp av setebandet, og bøyeutnyttinga */
  z0: number[]
  z1: number[]
  um: number[]
}

function last(p: Params, b: Build) {
  // puta er ~300 mm brei og står på ceil(300 / (plyT + luft)) skiver —
  // aldri fleire enn det finst. Same skjøn som tavla, av di det ER tavla.
  const under = Math.max(1, Math.min(b.slices.length, Math.ceil(300 / (p.plyT + p.luft))))
  return { cap: capacities(p.material as Material), nLoad: SEAT_LOAD / under, under }
}

/** dei `under` skivene næraste setesenteret — det er dei puta står på */
function berande(b: Build, under: number): Set<number> {
  const rekkje = b.slices
    .map((sl, i) => ({ i, d: Math.abs(sl.y) }))
    .sort((u, v) => u.d - v.d)
  return new Set(rekkje.slice(0, under).map((q) => q.i))
}

function byggSkiveFelt(
  p: Params,
  cap: { capC: number; capM: number },
  nLoad: number,
  sl: Slice,
): SkiveFelt | null {
  // spennet: same skjøn som tavla — 0,8 av djupna, symmetrisk om senteret
  const xL = -p.djup * 0.4
  const xR = p.djup * 0.4
  if (xR - xL < 1) return null
  const legW = Math.min(p.frambein, p.bakbein) * 0.55
  const uc = nLoad / 2 / Math.max(1, legW * p.plyT) / cap.capC

  const z0: number[] = []
  const z1: number[] = []
  const um: number[] = []
  for (let i = 0; i <= N; i++) {
    const x = xL + (i / N) * (xR - xL)
    const runs = zRunsAt(sl.outline, x)
    if (!runs.length) {
      z0.push(0)
      z1.push(0)
      um.push(0)
      continue
    }
    // setebandet er det ØVSTE intervallet: alt under er boge, bein og luft
    const [b0, b1] = runs[runs.length - 1]
    const d = Math.max(1, b1 - b0)
    const W = (p.plyT * d * d) / 6
    const M = (nLoad / 2) * Math.min(x - xL, xR - x)
    z0.push(b0)
    z1.push(b1)
    um.push(M / W / cap.capM)
  }
  return { xL, xR, uc, z0, z1, um }
}

/**
 * Det verste punktet over alle berande skiver og alle snitt — same
 * modell, same tal. Tavla les DETTE, og maksimumet i lastkartet er per
 * konstruksjon det same: kartet og tavla kan ikkje seie kvar sitt.
 */
export function lastVerste(
  p: Params,
  b: Build,
): { util: number; sc: number; sm: number; z: number; A: number } {
  const { cap, nLoad, under } = last(p, b)
  const ber = berande(b, under)
  let best = { util: 0, sc: 0, sm: 0, z: 0, A: 0 }
  for (const i of ber) {
    const f = byggSkiveFelt(p, cap, nLoad, b.slices[i])
    if (!f) continue
    for (let k = 0; k < f.um.length; k++) {
      if (f.z1[k] <= f.z0[k]) continue
      const util = f.uc + f.um[k]
      if (util > best.util) {
        best = {
          util,
          sc: f.uc * cap.capC,
          sm: f.um[k] * cap.capM,
          z: f.z0[k],
          A: (f.z1[k] - f.z0[k]) * p.plyT,
        }
      }
    }
  }
  return best
}

/**
 * Feltet lagt på nettet: éin utnyttingsverdi per hjørne, 1,0 = kapasitet.
 * Hjørne i skiver puta ikkje står på, og i stavane, står på 0.
 */
export function feltPaMesh(
  p: Params,
  b: Build,
  positions: Float32Array,
): Float32Array {
  const { cap, nLoad, under } = last(p, b)
  const ber = berande(b, under)
  const ht = p.plyT / 2 + 0.5
  const skiver = b.slices.map((sl, i) => ({
    sl,
    ca: Math.cos(sl.rot),
    sa: Math.sin(sl.rot),
    f: ber.has(i) ? byggSkiveFelt(p, cap, nLoad, sl) : null,
  }))
  const nv = positions.length / 3
  const out = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    let v = 0
    for (const { sl, ca, sa, f } of skiver) {
      if (!f) continue
      // verds → skiveplan: same rotasjon som geometrien, snudd
      const off = -x * sa + y * ca - sl.y
      if (off > ht || off < -ht) continue
      const q0 = x * ca + y * sa
      if (q0 <= f.xL || q0 >= f.xR) {
        // utanfor spennet: bein og bakkant, reint trykk
        if (f.uc > v) v = f.uc
        continue
      }
      const s = ((q0 - f.xL) / (f.xR - f.xL)) * N
      const k = Math.min(N - 1, Math.floor(s))
      const a = s - k
      const b0 = f.z0[k] * (1 - a) + f.z0[k + 1] * a
      const b1 = f.z1[k] * (1 - a) + f.z1[k + 1] * a
      if (z < b0 || b1 <= b0) {
        // under bandet: boge og bein, reint trykk
        if (f.uc > v) v = f.uc
        continue
      }
      const d = Math.max(1, b1 - b0)
      // fiberen: null i nøytralaksen, full i ytterkant
      const fiber = Math.min(1, Math.abs((2 * (z - (b0 + b1) / 2)) / d))
      const um = f.um[k] * (1 - a) + f.um[k + 1] * a
      const q = f.uc + fiber * um
      if (q > v) v = q
    }
    out[i] = v
  }
  return out
}
