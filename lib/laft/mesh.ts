/**
 * LAFT — nettet, i tre lesemåtar.
 *
 *   lag     platene slik dei står, med tappar i spor. Dette ER objektet.
 *   flate   dei to flatene kroppen møter: setet og ryggen. LAFT nærmar
 *           seg ikkje ei krum flate — han seier at ei plate er ei plate —
 *           so «flate» her er dei to plana, og skilnaden på dei og «lag»
 *           er nettopp typologien sitt svar.
 *   kontur  dei fem kuttprofilane lagde flatt ved sida av kvarandre.
 *
 * Prismet er felles for alle platene: konturen som lok i begge endar og
 * ein vegg kring kvar ring. Lokket er PLATEFLATE (tek beis), veggen er
 * KUTT (rå finér) — merkinga fylgjer med som attributt, so materialet i
 * framsyninga veit kva som er kva utan å gisse.
 */
import type { Pt, Vec3 } from "../core"
import { bygg as byggProfil, tilVerda, type Bygg, type Del } from "./profil"
import { earClip, newSoup, plateSolid, soupToMesh, tri, vegg, type Soup } from "../platemesh"
import type { Params } from "./params"

/** platene slik dei står */
export function lagMesh(b: Bygg) {
  const s = newSoup()
  for (const d of b.delar) plateSolid(s, d)
  return soupToMesh(s)
}

/**
 * Dei to flatene kroppen møter. Ikkje ein tilnærma krum flate — LAFT har
 * ingen — men setet og ryggen som dei plana dei ER, utan spor og utan
 * hòl: det ein kjenner mot kroppen, reinska for produksjon.
 */
export function flateMesh(b: Bygg) {
  const s = newSoup()
  s.k = 0
  for (const d of b.delar) {
    if (d.kind !== "sete" && d.kind !== "rygg") continue
    const at = (q: Pt, w: number) => tilVerda(d.plass, q, w)
    const n = d.plass.n
    const bak: Vec3 = [-n[0], -n[1], -n[2]]
    for (const [a, c, e] of earClip(d.outline)) {
      tri(s, at(a, d.t), at(e, d.t), at(c, d.t), n)
      tri(s, at(a, 0), at(c, 0), at(e, 0), bak)
    }
    vegg(s, d, d.outline)
  }
  return soupToMesh(s)
}

/**
 * Dei flate kuttprofilane.
 *
 * Dei andre motorane legg profilane sine på EI line, og det gjeng bra der
 * delane er mange og små. LAFT har fem delar og dei er store: ei line
 * vert to meter brei og ti centimeter høg, og innramminga — som reknar
 * avstand av halvdiagonalen — dyttar kameraet så langt bak at ho slår i
 * taket sitt og kuttar teikninga i begge endar. Difor bryt LAFT lina i
 * rader: målet er ei teikning som er om lag like brei som høg, av di det
 * er den forma eit lerret har.
 */
export function contourLines(b: Bygg): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const GAP = 40
  const boks = b.delar.map((d) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const q of d.outline) {
      if (q[0] < x0) x0 = q[0]
      if (q[0] > x1) x1 = q[0]
      if (q[1] < y0) y0 = q[1]
      if (q[1] > y1) y1 = q[1]
    }
    return { x0, y0, w: x1 - x0, h: y1 - y0 }
  })
  const sumB = boks.reduce((s, q) => s + q.w + GAP, -GAP)
  const maxH = boks.reduce((s, q) => Math.max(s, q.h), 1)
  // så mange rader at rekkja vert om lag kvadratisk
  const rader = Math.max(1, Math.min(boks.length, Math.round(Math.sqrt(sumB / maxH))))
  const maalB = sumB / rader
  let x = 0
  let y = 0
  let radH = 0
  let breidd = 0
  b.delar.forEach((d, i) => {
    const q = boks[i]
    if (x > 0 && x + q.w > maalB) {
      y += radH + GAP
      x = 0
      radH = 0
    }
    const dst = i === 0 ? bold : thin
    const seg = (a: Pt, c: Pt) =>
      dst.push(x - q.x0 + a[0], 0, y + a[1] - q.y0, x - q.x0 + c[0], 0, y + c[1] - q.y0)
    for (const ring of [d.outline, ...d.holes]) {
      for (let k = 0; k < ring.length; k++) seg(ring[k], ring[(k + 1) % ring.length])
    }
    x += q.w + GAP
    if (x - GAP > breidd) breidd = x - GAP
    if (q.h > radH) radH = q.h
  })
  const skift = -breidd / 2
  for (const arr of [thin, bold]) {
    for (let i = 0; i < arr.length; i += 3) arr[i] += skift
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}

export const bygg = byggProfil
export type { Bygg, Params }
