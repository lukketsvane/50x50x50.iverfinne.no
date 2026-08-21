/**
 * FLETT — bandkartet.
 *
 * Éin strimmel per band, i den rekkjefylgja dei vert vevde, med kuttlengda
 * skriven på. Det er den einaste teikninga som svarar på spørsmålet
 * typologien reiser og ingen av dei andre gjer: kor mange ULIKE lengder er
 * dette? Planet er ei superellipse, so ytterbanda er kortare enn dei
 * midtre, og talet på ulike lengder er talet på gonger nokon må stille om
 * kappesaga.
 *
 * SVG-en er i millimeter med viewBox i millimeter, so eit uttak kan
 * målast rett av fila.
 */
import { nn } from "../core"
import type { Weave } from "./weave"

const f = (v: number) => (Math.round(v * 100) / 100).toString()

export function bandSvg(w: Weave): string {
  const GAP = 9
  const M = 30
  const alle = [...w.warp, ...w.weft]
  if (!alle.length) return "<svg xmlns='http://www.w3.org/2000/svg'/>"
  const lengst = alle.reduce((s, q) => Math.max(s, q.cut), 1)
  let H = M
  const rows: string[] = []
  let førre: 0 | 1 | -1 = -1
  for (const band of alle) {
    if (band.dir !== førre) {
      H += band.dir === 0 ? 0 : 22
      rows.push(
        `<text x="${f(M)}" y="${f(H - 8)}" font-family="sans-serif" font-size="13" fill="#111">` +
          `${band.dir === 0 ? "RENNING" : "INNSLAG"} — ${band.dir === 0 ? nn(w.p.renW, 1) : nn(w.p.innW, 1)} × ` +
          `${band.dir === 0 ? nn(w.p.renT, 1) : nn(w.p.innT, 1)} mm</text>`,
      )
      førre = band.dir
    }
    rows.push(
      `<rect x="${f(M)}" y="${f(H)}" width="${f(band.cut)}" height="${f(band.w)}" ` +
        `fill="#f2efe9" stroke="#111" stroke-width="0.8"/>`,
    )
    // Festetampen merkt av i raudt: alt utanfor merket er det som
    // forsvinn inn i ramma, og det er den lengda ein kappar for mykje om
    // ein les strimmelen som spennet.
    let vev = 0
    for (let i = band.tail0; i < band.pts.length - 1 - band.tail1; i++) {
      vev += Math.hypot(
        band.pts[i + 1][0] - band.pts[i][0],
        band.pts[i + 1][1] - band.pts[i][1],
        band.pts[i + 1][2] - band.pts[i][2],
      )
    }
    const tamp = (band.cut - vev) / 2
    for (const q of [tamp, band.cut - tamp]) {
      rows.push(
        `<line x1="${f(M + q)}" y1="${f(H)}" x2="${f(M + q)}" y2="${f(H + band.w)}" ` +
          `stroke="#c00" stroke-width="0.6" stroke-dasharray="4 3"/>`,
      )
    }
    rows.push(
      `<text x="${f(M + band.cut + 8)}" y="${f(H + band.w / 2 + 4)}" font-family="monospace" ` +
        `font-size="11" fill="#111">${nn(band.cut, 0)} mm · ${band.kryss} kryss</text>`,
    )
    H += band.w + GAP
  }
  const W = M + lengst + 130
  const HH = H + M
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(HH)}mm" viewBox="0 0 ${f(W)} ${f(HH)}">`,
    `<rect width="${f(W)}" height="${f(HH)}" fill="#fff"/>`,
    ...rows,
    `<text x="${f(M)}" y="${f(HH - 10)}" font-family="monospace" font-size="12" fill="#666">` +
      `FLETT · bandkart · raud strek = ramma si innerkant, alt utanfor er feste</text>`,
    `</svg>`,
  ].join("\n")
}
