/**
 * SANDKASSE — STL ut.
 *
 * Binær STL, millimeter, éin sekvens av lause trekantar utan indeksar.
 * Formatet er dumt med vilje: det er det einaste alle slicerar og alle
 * 3D-trykkjarar les likt.
 *
 * To fallgruver er handterte her. Den eine er hovudet: byrjar dei 80 fyrste
 * teikna på «solid», les mange program fila som ASCII og får berre søppel.
 * Den andre er vindinga: kvar trekant har både ein normal i fila og ei
 * rekkjefylgje på hjørna, og dei to skal seie det same. Nettet vårt ber
 * mjuke hjørnenormalar frå parametriseringa; her vert flatenormalen rekna
 * på nytt av geometrien, og hjørna bytte om når dei to peikar kvar sin veg.
 */
import { CUBE, PARAM_KEYS, type Params } from "./params"
import type { MeshData } from "./surface"

export function meshToStl(mesh: MeshData, name = "skal"): Uint8Array {
  const n = mesh.tris
  const buf = new ArrayBuffer(84 + n * 50)
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)

  const head = ascii(`SANDKASSE ${name} - mm - ${n} trekantar`)
  for (let i = 0; i < 80; i++) u8[i] = i < head.length ? head.charCodeAt(i) : 32
  dv.setUint32(80, n, true)

  const P = mesh.positions
  const N = mesh.normals
  for (let t = 0; t < n; t++) {
    const o = t * 9
    let ax = P[o]
    let ay = P[o + 1]
    let az = P[o + 2]
    let bx = P[o + 3]
    let by = P[o + 4]
    let bz = P[o + 5]
    let cx = P[o + 6]
    let cy = P[o + 7]
    let cz = P[o + 8]

    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

    // snittet av dei tre hjørnenormalane seier kva veg flata skal vende
    const wx = N[o] + N[o + 3] + N[o + 6]
    const wy = N[o + 1] + N[o + 4] + N[o + 7]
    const wz = N[o + 2] + N[o + 5] + N[o + 8]
    if (nx * wx + ny * wy + nz * wz < 0) {
      const tx = bx
      const ty = by
      const tz = bz
      bx = cx
      by = cy
      bz = cz
      cx = tx
      cy = ty
      cz = tz
      nx = -nx
      ny = -ny
      nz = -nz
    }

    // Degenererte trekantar får normalen frå skyggjinga i staden. Å skrive
    // (0,0,0) er lovleg, men nokre slicerar tolkar det som ei feilflate.
    const L = Math.hypot(nx, ny, nz)
    if (L > 1e-12) {
      nx /= L
      ny /= L
      nz /= L
    } else {
      const M = Math.hypot(wx, wy, wz) || 1
      nx = wx / M
      ny = wy / M
      nz = wz / M
    }

    const q = 84 + t * 50
    dv.setFloat32(q, nx, true)
    dv.setFloat32(q + 4, ny, true)
    dv.setFloat32(q + 8, nz, true)
    dv.setFloat32(q + 12, ax, true)
    dv.setFloat32(q + 16, ay, true)
    dv.setFloat32(q + 20, az, true)
    dv.setFloat32(q + 24, bx, true)
    dv.setFloat32(q + 28, by, true)
    dv.setFloat32(q + 32, bz, true)
    dv.setFloat32(q + 36, cx, true)
    dv.setFloat32(q + 40, cy, true)
    dv.setFloat32(q + 44, cz, true)
    dv.setUint16(q + 48, 0, true)
  }
  return u8
}

/**
 * Filnamnet ber punktet i parameterrommet, ikkje eit løpenummer. To
 * nedlastingar av same objekt får då same namn og skriv over kvarandre i
 * staden for å hopa seg opp som «skal (3).stl». Hashen les alle skyvarane,
 * men han er 32 bit: to ulike objekt kan i prinsippet møtast i same namn,
 * og det krev titusenvis av filer i same mappa før det er verd å tenkje på.
 */
export function stlFilename(p: Params): string {
  const rec = p as unknown as Record<string, number>
  const parts = PARAM_KEYS.map((k) => `${k}=${rec[k]}`)
  parts.push(`material=${p.material}`)
  const h = fnv1a(parts.join(";")).toString(16).padStart(8, "0")
  return `skal-${CUBE}-sete${Math.round(p.seatZ)}-finer${num(p.plyT)}-${p.material}-${h}.stl`
}

/** desimalkomma i eit filnamn er bråk; 12,5 mm vert «12p5» */
const num = (v: number) => String(+v.toFixed(2)).replace(".", "p")

/** Hovudet er byte, ikkje tekst. Ein «é» skrive med charCodeAt vert
 *  avkorta til éin byte og kjem ut som søppel, så alt utanom ASCII går. */
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "-")

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
