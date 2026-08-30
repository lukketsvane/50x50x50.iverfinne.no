/**
 * RIBBE — bandet.
 *
 * Ein ring som ligg UTANPÅ blada og stikk fram forbi dei. Det er ikkje ein
 * detalj: låg ringen i flukt med blada, ville sporet i bladet stått fram
 * som ei sagtann heile vegen rundt, og silhuetten i den høgda ville vore
 * teikna av tjueto endeflater i staden for av éin ring.
 *
 * Sporet i ringen er ikkje eit hakk med to skarpe kantar. Bladet står på
 * skrå gjennom ringen når vridinga ikkje er null, så opninga er ein
 * parallellogram — og i polarkoordinatar er han ein kurve. Fila reknar den
 * kurva ut av strålen sin veg gjennom bladet sitt eige band, og difor
 * passar sporet like godt på eit vridd objekt som på eit uvridd.
 */
import { wrapPi } from "../core"
import type { Shell } from "./shell"
import { bladeSlots, makeBlade, type Blade } from "./blade"
import type { Station } from "./solid"

export type BandGeom = {
  j: number
  /** midthøgda, mm */
  z: number
  z0: number
  z1: number
  st: Station[]
  /** kor djupt sporet er skore inn frå innerkanten, mm */
  cutDepth: number
  /** overlappen mellom band og blad, mm */
  lap: number
}

type Cut = { psi: number; c: number; q: number; hw: number; sRoot: number; th: number }

export function bandGeom(sh: Shell, j: number, nt: number): BandGeom {
  const p = sh.p
  const z = sh.bandZ[j]
  const hw = p.bladeT / 2 + p.fit

  // kvart blad gjev eitt spor; alt sporet treng å vita om bladet er kvar
  // lina ligg og kor langt inn han er skore
  const cuts: Cut[] = []
  for (let k = 0; k < sh.angles.length; k++) {
    const b: Blade = makeBlade(sh, k)
    const sl = bladeSlots(sh, b)[j]
    cuts.push({
      psi: b.psi,
      c: b.c,
      q: sh.rHub * Math.sin(sh.tw),
      hw,
      sRoot: sl.sRoot,
      th: Math.atan2(b.a[1] + sl.sOut * b.d[1], b.a[0] + sl.sOut * b.d[0]),
    })
  }

  const rOutAt = (th: number) => sh.bandOuter(th, j)
  const rInBase = (th: number) => sh.bandInner(th, j)

  /**
   * Innerkanten ved vinkelen θ. Strålen skjer bladet sitt band i eit
   * intervall; ligg det innanfor ringen sin eigen innerkant, er sporet
   * ope innanfrå og kan skjerast. Byrjar det utanfor, ville sporet vore ei
   * øy midt i ringen — det er ikkje eit spor, og då står ringen heil.
   */
  const rInAt = (th: number) => {
    const base = rInBase(th)
    let r = base
    for (const q of cuts) {
      if (Math.abs(wrapPi(th - q.th)) > 0.9) continue
      const m = Math.sin(th - q.psi)
      let e0: number
      let e1: number
      if (Math.abs(m) < 1e-9) {
        if (Math.abs(q.q) > q.hw) continue
        e0 = 0
        e1 = Infinity
      } else {
        const x0 = (q.q - q.hw) / m
        const x1 = (q.q + q.hw) / m
        e0 = Math.min(x0, x1)
        e1 = Math.max(x0, x1)
      }
      if (e1 <= base || e0 > base + 0.01) continue
      // sporbotnen er lina tvers på bladet, ikkje ein sirkelboge
      const cosd = Math.cos(th - q.psi)
      const bottom = Math.abs(cosd) < 1e-6 ? Infinity : (q.sRoot + q.c) / cosd
      const cut = Math.min(e1, bottom > 0 ? bottom : Infinity)
      if (cut > r) r = cut
    }
    return Math.min(r, rOutAt(th) - 2)
  }

  // Grovt sveip pluss tette punkt der sporet står: kurva er samanhengande
  // heile vegen rundt, så tettleiken er eit spørsmål om nøyaktigheit og
  // ikkje om nettet held saman.
  const ths: number[] = []
  for (let i = 0; i < nt; i++) ths.push((i / nt) * Math.PI * 2)
  for (const q of cuts) {
    const w = 3 * Math.asin(Math.min(0.9, q.hw / Math.max(40, rInBase(q.th))))
    for (let i = 0; i <= 24; i++) ths.push(q.th - w + (2 * w * i) / 24)
  }
  const sorted = ths
    .map((t) => ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t - arr[i - 1] > 1e-7)

  const st: Station[] = sorted.map((th) => ({ u: th, a: rInAt(th), b: rOutAt(th) }))

  return {
    j,
    z,
    z0: z - p.bandT / 2,
    z1: z + p.bandT / 2,
    st,
    cutDepth: Math.max(0, p.bandW - p.bandOut) * (1 - p.bandLapp),
    lap: Math.max(0, p.bandW - p.bandOut),
  }
}
