/**
 * STRAUM — objektet som konstruksjon.
 *
 * Same objekt, andre lesemåte. Der `surface.ts` byggjer den freste flata,
 * byggjer denne fila stabelen slik han står på benken før fresen har vore
 * borti han: sokkelen, dei fire og tjue finnane i kvart sitt spor, og
 * kappa senka ned over toppane. Skilnaden mellom dei to nett er nøyaktig
 * det arbeidet som står att etter oppliming.
 *
 * Det er difor spora er synlege her og ingen annan stad: dei er det einaste
 * leddet i heile møbelet, og eit ledd som ikkje kan sjåast kan heller ikkje
 * kontrollerast.
 */
import type { MeshData, Pt, Vec3 } from "../core"
import { Soup } from "./mesh"
import type { Build, Part } from "./parts"
import { slabMesh } from "./slabs"

export function assemblyMesh(build: Build): MeshData {
  const s = new Soup()
  for (const q of build.parts) slabMesh(q.slab, q.place, s)
  return s.done()
}

/**
 * Konturkartet: kvart finneemne og kvart plateomriss lagt ned i eitt og
 * same plan, oppå kvarandre. Det er den mest presise teikninga av eit
 * objekt utan ein einaste rett kant — det einaste som kan målast, er
 * profilane, og her ligg dei alle i same rute.
 *
 * Delane er skilde eit hår i høgda så to linjer som fell saman ikkje
 * flimrar mot kvarandre; det er ei teikning og ikkje ein stabel.
 */
export function contourLines(build: Build): {
  positions: Float32Array
  heavy: Float32Array
  min: Vec3
  max: Vec3
} {
  const thin: number[] = []
  const bold: number[] = []
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const put = (dst: number[], ring: Pt[], z: number) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      dst.push(a[0], a[1], z, b[0], b[1], z)
      for (const [k, v] of [[0, a[0]], [1, a[1]], [2, z]] as [number, number][]) {
        if (v < min[k]) min[k] = v
        if (v > max[k]) max[k] = v
      }
    }
  }
  const draw = (q: Part, z: number, heavy: boolean) => {
    put(heavy ? bold : thin, q.outline, z)
    // Spora og tomromma står tynt same kor tjukt omrisset står: det er
    // omrisset som fortel kva profilen er, og hòla som fortel kvar leddet
    // sit. To like tjukke strekar seier ingen ting om kva som er kva.
    for (const h of q.holes) put(thin, h, z)
  }
  // Finnane fyrst, kvar femte tjukk, så plateomrissa under: dei er den
  // ramma alle profilane står inni, og utan dei les kartet som eit knippe
  // lause kurver.
  build.fins.forEach((q, i) => draw(q, i * 1.2, i % 5 === 0))
  build.plates.forEach((q, i) => draw(q, -14 - i * 1.2, true))
  return { positions: new Float32Array(thin), heavy: new Float32Array(bold), min, max }
}

/** eit punkt i delen sitt plan, brukt av teikningane */
export function partPoint(q: Part, p: Pt): Vec3 {
  return q.place.at(p[0], p[1], 0)
}
