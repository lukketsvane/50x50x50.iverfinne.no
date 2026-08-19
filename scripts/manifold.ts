import { buildMesh, DETAIL } from "../lib/skal/surface.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
const m = buildMesh(DEFAULT_PARAMS, DETAIL.mid)
const key = (a: number, b: number) => `${a}|${b}`
const q = 1e3
const vid = new Map<string, number>()
const id = (i: number) => {
  const k = [0,1,2].map(c => Math.round(m.positions[i*3+c]*q)).join(",")
  let v = vid.get(k); if (v === undefined) { v = vid.size; vid.set(k, v) } return v
}
const dir = new Map<string, number>()
for (let t = 0; t < m.tris; t++) {
  const a = id(t*3), b = id(t*3+1), c = id(t*3+2)
  for (const [u,v] of [[a,b],[b,c],[c,a]] as [number,number][]) {
    dir.set(key(u,v), (dir.get(key(u,v)) ?? 0) + 1)
  }
}
let bad = 0, border = 0, dup = 0
for (const [k, n] of dir) {
  const [u,v] = k.split("|").map(Number)
  const back = dir.get(key(v,u)) ?? 0
  if (n > 1) dup++
  if (back === 0) border++
  else if (back !== n) bad++
}
// signert volum
let vol = 0
for (let t = 0; t < m.tris; t++) {
  const p = (i: number) => [m.positions[(t*3+i)*3], m.positions[(t*3+i)*3+1], m.positions[(t*3+i)*3+2]]
  const [a,b,c] = [p(0),p(1),p(2)]
  vol += (a[0]*(b[1]*c[2]-b[2]*c[1]) - a[1]*(b[0]*c[2]-b[2]*c[0]) + a[2]*(b[0]*c[1]-b[1]*c[0]))/6
}
console.log(`trekantar ${m.tris}  retta kantar ${dir.size}  utan motpart ${border}  ueinig retning ${bad}  duplikat ${dup}`)
console.log(`signert volum ${(vol/1e6).toFixed(2)} dm³`)
