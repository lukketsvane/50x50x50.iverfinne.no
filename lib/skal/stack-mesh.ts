/**
 * SANDKASSE — stabelen som mesh.
 *
 * Same objekt, andre lesemåte. Der `surface.ts` byggjer den ferdige,
 * slipte flata, byggjer denne fila objektet slik det kjem ut av fresen:
 * 31 flate lag med slipemon på ytterkanten. Skilnaden mellom dei to
 * meshane er nøyaktig det arbeidet som står att etter liming.
 *
 * Delane treng ingen ear-clipping. Kvar del er laga av eitt vinkelsvep,
 * så ytre og indre kant har like mange punkt og høyrer saman parvis —
 * `span` på delen held det paret. Ein triangulering som er gjeven av
 * korleis geometrien vart laga, kan ikkje slå feil på ein konkav kontur.
 */
import type { Layer, Part, Pt, Stack } from "./laminae"
import type { MeshData } from "./surface"
import type { Vec3 } from "./field"

type Soup = { pos: number[]; nor: number[]; min: Vec3; max: Vec3 }

const newSoup = (): Soup => ({
  pos: [],
  nor: [],
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
})

function put(s: Soup, p: Vec3, n: Vec3) {
  s.pos.push(p[0], p[1], p[2])
  s.nor.push(n[0], n[1], n[2])
  for (let k = 0; k < 3; k++) {
    if (p[k] < s.min[k]) s.min[k] = p[k]
    if (p[k] > s.max[k]) s.max[k] = p[k]
  }
}

function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3, n: Vec3) {
  put(s, a, n)
  put(s, b, n)
  put(s, c, n)
}

/** paret mellom ytre og indre kant, uttrykt som to like lange lister */
function pair(part: Part): { out: Pt[]; inn: Pt[]; closed: boolean } | null {
  const n = part.span
  if (part.ring) {
    const hole = part.holes[0]
    if (!hole || hole.length !== n || part.outline.length !== n) return null
    return { out: part.outline, inn: hole.slice().reverse(), closed: true }
  }
  if (part.outline.length !== 2 * n) return null
  return {
    out: part.outline.slice(0, n),
    inn: part.outline.slice(n).reverse(),
    closed: false,
  }
}

/** loddrett sideflate langs ei kurve, med normalen ut frå kurva si retning */
function wall(s: Soup, pts: Pt[], z0: number, z1: number, outward: boolean, loop: boolean) {
  const n = pts.length
  const last = loop ? n : n - 1
  for (let i = 0; i < last; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    let nx = b[1] - a[1]
    let ny = -(b[0] - a[0])
    const L = Math.hypot(nx, ny) || 1
    nx /= L
    ny /= L
    if (!outward) {
      nx = -nx
      ny = -ny
    }
    const nv: Vec3 = [nx, ny, 0]
    const A: Vec3 = [a[0], a[1], z0]
    const B: Vec3 = [b[0], b[1], z0]
    const C: Vec3 = [b[0], b[1], z1]
    const D: Vec3 = [a[0], a[1], z1]
    tri(s, A, B, C, nv)
    tri(s, A, C, D, nv)
  }
}

function caps(s: Soup, out: Pt[], inn: Pt[], z0: number, z1: number, closed: boolean) {
  const n = Math.min(out.length, inn.length)
  const up: Vec3 = [0, 0, 1]
  const dn: Vec3 = [0, 0, -1]
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % n
    const a = out[i]
    const b = out[j]
    const c = inn[j]
    const d = inn[i]
    tri(s, [a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1], up)
    tri(s, [a[0], a[1], z1], [c[0], c[1], z1], [d[0], d[1], z1], up)
    tri(s, [a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0], dn)
    tri(s, [a[0], a[1], z0], [d[0], d[1], z0], [c[0], c[1], z0], dn)
  }
}

/**
 * @param gap  luft mellom laga, mm. Null gjev stabelen slik han vert limt;
 *             ein liten verdi trekkjer han frå kvarandre og viser at kvart
 *             lag verkeleg er ein eigen flat del.
 */
export function stackMesh(stack: Stack, gap = 0): MeshData {
  const s = newSoup()
  for (const L of stack.layers) {
    const lift = gap * L.i
    const z0 = L.z0 + lift
    const z1 = L.z1 + lift
    for (const part of L.parts) {
      const pr = pair(part)
      if (!pr) continue
      wall(s, part.outline, z0, z1, true, part.ring || pr.closed === false)
      if (part.ring) for (const h of part.holes) wall(s, h, z0, z1, false, true)
      caps(s, pr.out, pr.inn, z0, z1, pr.closed)
    }
  }
  return {
    positions: new Float32Array(s.pos),
    normals: new Float32Array(s.nor),
    tris: s.pos.length / 9,
    min: s.min,
    max: s.max,
  }
}

/**
 * Konturkartet i tre dimensjonar: kvar del sin ytre kant lagd på si eiga
 * høgd. Det er den mest presise teikninga av eit objekt utan ein einaste
 * rett kant — det einaste som kan målast, er laga.
 */
export function contourLines(stack: Stack): { positions: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  for (const L of stack.layers) {
    const dst = L.i % 5 === 0 ? bold : thin
    for (const part of L.parts) {
      const rings: Pt[][] = [part.outline, ...part.holes]
      for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
          const a = r[i]
          const b = r[(i + 1) % r.length]
          dst.push(a[0], a[1], L.z1, b[0], b[1], L.z1)
        }
      }
    }
  }
  return { positions: new Float32Array(thin), heavy: new Float32Array(bold) }
}

export type { Layer, Part, Stack }
