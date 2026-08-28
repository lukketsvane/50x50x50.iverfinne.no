/**
 * VIKING — nettet, i tre lesemåtar.
 *
 *   lag     alle platene slik dei står: bord, spant og naglar.
 *   flate   BERRE borda. Det er den eine lesemåten der VIKING seier noko
 *           dei andre motorane ikkje kan: flata er ikkje ei tilnærming
 *           til noko krumt — ho ER dei n plana kroppen kviler på, og dei
 *           er der, som flate. Skilnaden på «flate» og «lag» er difor
 *           berre spanta og naglane, altså produksjonen.
 *   kontur  kuttprofilane lagde flatt.
 */
import type { Pt, Vec3 } from "../core"
import { newSoup, plateMesh, plateSolid, soupToMesh } from "../platemesh"
import { byggDelar, type Del } from "./parts"
import type { Params } from "./params"

export function lagMesh(delar: readonly Del[]) {
  return plateMesh(delar)
}

/** berre skalet: den flata kroppen faktisk møter */
export function flateMesh(delar: readonly Del[]) {
  const s = newSoup()
  for (const d of delar) {
    if (d.kind !== "bord") continue
    // utan hòl: det ein kjenner mot kroppen, reinska for produksjon
    plateSolid(s, { outline: d.outline, holes: [], plass: d.plass, t: d.t })
  }
  return soupToMesh(s)
}

/**
 * Kuttprofilane, lagde flatt i rader. Same tanken som i LAFT: VIKING har
 * mange delar, og ei einaste line ville vorte fire meter brei.
 */
export function contourLines(p: Params): { lines: Float32Array; heavy: Float32Array } {
  const { delar } = byggDelar(p)
  const lines: number[] = []
  const heavy: number[] = []
  const boks = (r: Pt[]) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const [x, y] of r) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    return { x0, x1, y0, y1 }
  }
  const maal = delar.map((d) => boks(d.outline))
  const breidd = Math.max(...maal.map((m) => m.x1 - m.x0))
  const perRad = Math.max(1, Math.ceil(Math.sqrt(delar.length)))
  let x = 0
  let y = 0
  let radH = 0
  delar.forEach((d, i) => {
    const m = maal[i]
    if (i > 0 && i % perRad === 0) {
      x = 0
      y -= radH + 24
      radH = 0
    }
    const dx = x - m.x0
    const dy = y - m.y1
    const put = (arr: number[], r: Pt[]) => {
      for (let k = 0; k < r.length; k++) {
        const a = r[k]
        const b = r[(k + 1) % r.length]
        arr.push(a[0] + dx, 0, a[1] + dy, b[0] + dx, 0, b[1] + dy)
      }
    }
    put(heavy, d.outline)
    for (const h of d.holes) put(lines, h)
    x += m.x1 - m.x0 + 24
    radH = Math.max(radH, m.y1 - m.y0)
    void breidd
  })
  return { lines: new Float32Array(lines), heavy: new Float32Array(heavy) }
}

export type { Vec3 }
