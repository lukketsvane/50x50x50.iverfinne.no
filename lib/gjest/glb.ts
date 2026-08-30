/**
 * GJEST — ei GLB-fil inn, ein trekantsuppe ut.
 *
 * Sandkassen byggjer geometrien sin sjølv. Denne fila er det einaste
 * unntaket: ho tek eit møbel NOKON ANDRE har teikna og gjer det om til
 * noko motorane kan snitte. Det er ikkje ein sjette typologi — det er ein
 * annan veg INN til dei same delane, det same kuttarket og den same
 * pakkinga.
 *
 * Ho les GLB og ikkje glTF, og det er eit vedtak: ei .glb er ÉI fil med
 * alt i, so det finst ingen sti å bomme på og ingen ekstern .bin å be om.
 * Formatet er dessutan lite nok til å lesast utan eit bibliotek — tolv
 * byte hovud, so ein JSON-bit og ein binærbit — og det er verdt meir enn
 * det kostar: parsaren køyrer uendra i noden, i nettlesaren og i
 * workeren, og han dreg ikkje inn ein loader som vil ha eit DOM.
 *
 * Det einaste som vert lese er POSITION, indeksar og nodetransformane.
 * Normalar, UV-ar, materiale, skinn og animasjon vert hoppa over med
 * vilje: eit snitt gjennom ein kropp bryr seg om kvar flatene ER, ikkje
 * om kva farge dei har.
 */

export type Trekantar = {
  /** 9 tal per trekant: tre hjørne à x, y, z — i verda, etter transform */
  pos: Float32Array
  /** tal trekantar */
  n: number
  /** omskriven boks, verdskoordinat */
  min: [number, number, number]
  max: [number, number, number]
}

const JSON_BIT = 0x4e4f534a
const BIN_BIT = 0x004e4942
const MAGIC = 0x46546c67

/** komponenttypane glTF har, og kor mange byte kvar av dei tek */
const KOMP: Record<number, { b: number; les: (d: DataView, o: number) => number }> = {
  5120: { b: 1, les: (d, o) => d.getInt8(o) },
  5121: { b: 1, les: (d, o) => d.getUint8(o) },
  5122: { b: 2, les: (d, o) => d.getInt16(o, true) },
  5123: { b: 2, les: (d, o) => d.getUint16(o, true) },
  5125: { b: 4, les: (d, o) => d.getUint32(o, true) },
  5126: { b: 4, les: (d, o) => d.getFloat32(o, true) },
}

const TAL: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
}

type Mat4 = Float64Array

const eining = (): Mat4 =>
  new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

/** a · b, begge kolonnevise som i glTF */
function gong(a: Mat4, b: Mat4): Mat4 {
  const ut = new Float64Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      ut[c * 4 + r] = s
    }
  }
  return ut
}

/** flytting, kvartnion og skalering → matrise, i den rekkjefylgja glTF seier */
function fraTRS(t?: number[], r?: number[], s?: number[]): Mat4 {
  const m = eining()
  const [x, y, z, w] = r ?? [0, 0, 0, 1]
  const [sx, sy, sz] = s ?? [1, 1, 1]
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  m[0] = (1 - (yy + zz)) * sx
  m[1] = (xy + wz) * sx
  m[2] = (xz - wy) * sx
  m[4] = (xy - wz) * sy
  m[5] = (1 - (xx + zz)) * sy
  m[6] = (yz + wx) * sy
  m[8] = (xz + wy) * sz
  m[9] = (yz - wx) * sz
  m[10] = (1 - (xx + yy)) * sz
  const [tx, ty, tz] = t ?? [0, 0, 0]
  m[12] = tx
  m[13] = ty
  m[14] = tz
  return m
}

type Gltf = {
  scenes?: { nodes?: number[] }[]
  scene?: number
  nodes?: {
    mesh?: number
    children?: number[]
    matrix?: number[]
    translation?: number[]
    rotation?: number[]
    scale?: number[]
  }[]
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[]
  accessors?: {
    bufferView?: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
  }[]
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[]
}

/**
 * Les ei .glb og gjev alle trekantane i scena, i verdskoordinat.
 *
 * Kastar med ei setning som seier kva som er gale, og ikkje med ein
 * stakk: dette er ei fil brukaren har valt, so feilen er noko han skal
 * kunne lesa og gjera noko med.
 */
export function lesGlb(buf: ArrayBuffer): Trekantar {
  const d = new DataView(buf)
  if (buf.byteLength < 20 || d.getUint32(0, true) !== MAGIC) {
    throw new Error("Dette er ikkje ei GLB-fil — dei fire fyrste bytane skal vera «glTF».")
  }
  let json: Gltf | null = null
  let bin: Uint8Array | null = null
  let o = 12
  while (o + 8 <= buf.byteLength) {
    const len = d.getUint32(o, true)
    const type = d.getUint32(o + 4, true)
    const start = o + 8
    if (start + len > buf.byteLength) break
    if (type === JSON_BIT) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len))) as Gltf
    } else if (type === BIN_BIT) {
      bin = new Uint8Array(buf, start, len)
    }
    o = start + len + ((4 - (len % 4)) % 4)
  }
  if (!json) throw new Error("GLB-fila manglar JSON-biten.")
  if (!json.meshes?.length) throw new Error("GLB-fila har ingen mesh i seg.")

  const les = (idx: number): Float64Array => {
    const a = json!.accessors?.[idx]
    if (!a) throw new Error(`Manglar accessor ${idx}.`)
    const komp = KOMP[a.componentType]
    if (!komp) throw new Error(`Ukjend komponenttype ${a.componentType}.`)
    const n = TAL[a.type] ?? 1
    const ut = new Float64Array(a.count * n)
    if (a.bufferView === undefined) return ut // sparse/tom: nullar er rett
    const bv = json!.bufferViews?.[a.bufferView]
    if (!bv) throw new Error(`Manglar bufferView ${a.bufferView}.`)
    if (!bin) throw new Error("GLB-fila manglar binærbiten.")
    const stride = bv.byteStride || komp.b * n
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
    for (let i = 0; i < a.count; i++) {
      for (let k = 0; k < n; k++) ut[i * n + k] = komp.les(dv, base + i * stride + k * komp.b)
    }
    return ut
  }

  const ut: number[] = []
  const nodes = json.nodes ?? []

  const gaa = (ni: number, foreldre: Mat4, djup: number) => {
    if (djup > 64) return // ein syklisk nodegraf er ikkje vår oppgåve å løyse
    const nd = nodes[ni]
    if (!nd) return
    const eiga = nd.matrix
      ? (new Float64Array(nd.matrix) as Mat4)
      : fraTRS(nd.translation, nd.rotation, nd.scale)
    const m = gong(foreldre, eiga)
    if (nd.mesh !== undefined) {
      const me = json!.meshes?.[nd.mesh]
      for (const pr of me?.primitives ?? []) {
        if (pr.mode !== undefined && pr.mode !== 4) continue // berre trekantar
        const pi = pr.attributes?.POSITION
        if (pi === undefined) continue
        const p = les(pi)
        const idx = pr.indices !== undefined ? les(pr.indices) : null
        const antal = idx ? idx.length : p.length / 3
        for (let i = 0; i + 2 < antal; i += 3) {
          for (let k = 0; k < 3; k++) {
            const v = (idx ? idx[i + k] : i + k) * 3
            const x = p[v], y = p[v + 1], z = p[v + 2]
            ut.push(
              m[0] * x + m[4] * y + m[8] * z + m[12],
              m[1] * x + m[5] * y + m[9] * z + m[13],
              m[2] * x + m[6] * y + m[10] * z + m[14],
            )
          }
        }
      }
    }
    for (const c of nd.children ?? []) gaa(c, m, djup + 1)
  }

  const scene = json.scenes?.[json.scene ?? 0]
  const rot = scene?.nodes ?? nodes.map((_, i) => i)
  for (const r of rot) gaa(r, eining(), 0)

  if (!ut.length) throw new Error("Fann ingen trekantar i GLB-fila.")

  const pos = new Float32Array(ut)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pos[i + k] < min[k]) min[k] = pos[i + k]
      if (pos[i + k] > max[k]) max[k] = pos[i + k]
    }
  }
  return { pos, n: pos.length / 9, min, max }
}

/**
 * Passar trekantane inn i oppgåva sin kube: snu Y opp til Z (glTF er
 * Y-opp, sandkassen er Z-opp), sentrer i planet, set botnen på golvet og
 * skaler ned so det største målet er `mål` millimeter.
 *
 * Berre NED. Ber nokon om eit større objekt enn kuben, er det eit val og
 * ikkje ein feil — men her er kuben oppgåva, so alt vert klemt inn i han.
 */
export function iKuben(t: Trekantar, maal: number): Trekantar {
  const pos = new Float32Array(t.pos.length)
  // glTF: +Y opp, −Z framover. Sandkassen: +Z opp, +X framover.
  for (let i = 0; i < t.pos.length; i += 3) {
    pos[i] = -t.pos[i + 2]
    pos[i + 1] = t.pos[i]
    pos[i + 2] = t.pos[i + 1]
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pos[i + k] < min[k]) min[k] = pos[i + k]
      if (pos[i + k] > max[k]) max[k] = pos[i + k]
    }
  }
  const spenn = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const s = maal / Math.max(1e-6, Math.max(spenn[0], spenn[1], spenn[2]))
  const cx = (min[0] + max[0]) / 2
  const cy = (min[1] + max[1]) / 2
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - cx) * s
    pos[i + 1] = (pos[i + 1] - cy) * s
    pos[i + 2] = (pos[i + 2] - min[2]) * s
  }
  return {
    pos,
    n: t.n,
    min: [-(spenn[0] * s) / 2, -(spenn[1] * s) / 2, 0],
    max: [(spenn[0] * s) / 2, (spenn[1] * s) / 2, spenn[2] * s],
  }
}
