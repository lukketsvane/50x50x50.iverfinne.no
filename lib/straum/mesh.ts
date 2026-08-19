/**
 * STRAUM — trekantsuppa.
 *
 * Ei lita samling som tek imot trekantar og gjev frå seg eit nett. Ho
 * held ingen indeks: nettet går rett i ein Float32Array som skal over
 * postMessage, og der er delte hjørne uansett borte.
 *
 * `tri` reknar flatenormalen sjølv. `triN` tek hjørnenormalar og er for
 * flater som skal lesast som krumme — ei sylinderflate med flate normalar
 * ser ut som ein blyantstubbe.
 */
import type { Vec3 } from "../core"

export class Soup {
  pos: number[] = []
  nor: number[] = []
  min: Vec3 = [Infinity, Infinity, Infinity]
  max: Vec3 = [-Infinity, -Infinity, -Infinity]

  vert(p: Vec3, n: Vec3) {
    this.pos.push(p[0], p[1], p[2])
    this.nor.push(n[0], n[1], n[2])
    for (let k = 0; k < 3; k++) {
      if (p[k] < this.min[k]) this.min[k] = p[k]
      if (p[k] > this.max[k]) this.max[k] = p[k]
    }
  }

  tri(a: Vec3, b: Vec3, c: Vec3) {
    const n = face(a, b, c)
    if (!n) return
    this.vert(a, n)
    this.vert(b, n)
    this.vert(c, n)
  }

  triN(a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3) {
    if (!face(a, b, c)) return
    this.vert(a, na)
    this.vert(b, nb)
    this.vert(c, nc)
  }

  /** firkant som to trekantar, med same vinding */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }

  done() {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nor),
      tris: this.pos.length / 9,
      min: this.min,
      max: this.max,
    }
  }
}

/** flatenormal, eller null når trekanten er utarta */
export function face(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz)
  if (!(L > 1e-9)) return null
  return [nx / L, ny / L, nz / L]
}
