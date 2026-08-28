/**
 * AVSTANDEN MELLOM POSANE.
 *
 * Fem posar som alle er «ein stol med litt ulike tal» er eit dårleg sett
 * same kor gjennomtenkt kvar av dei er. Men «ulike» er ei kjensle, og ei
 * kjensle kan ikkje samanliknast med den førre. Difor dette: avstanden
 * mellom to posar, målt i dei parametrane som verkeleg FORMAR, kvar
 * normalisert mot sitt eige band so ingen dominerer på tal åleine.
 *
 * Det som tel er ikkje gjennomsnittet — det er MINSTEAVSTANDEN. Eit sett
 * med fire vidt ulike stolar og to som liknar, er eit sett med fem der to
 * er den same.
 */
import { DEFAULT_PARAMS, PARAM_RANGES, POSES, clampParams } from "../lib/laft/params.ts"
import { measure } from "../lib/laft/metrics.ts"

/** dei som formar silhuetten, med vekt: kva ein SER frå fire meter */
const FORM: [string, number][] = [
  ["bakbukt", 1.2],
  ["hjorne", 1.2],
  ["hals", 1.0],
  ["bogeH", 0.9],
  ["holform", 0.8],
  ["holstorleik", 0.6],
  ["ryggH", 1.2],
  ["ryggT", 0.9],
  ["ryggdel", 1.4],
  ["ryggtopp", 0.6],
  ["ryggV", 0.8],
  ["setekile", 0.7],
  ["nase", 0.5],
  ["hogd", 1.0],
  ["fotX", 0.7],
  ["fotY", 0.9],
  ["grep", 0.5],
]

const NAMN = process.argv.slice(2)
const posar = POSES.map((q, i) => ({
  namn: NAMN[i] ?? "pose " + i,
  p: clampParams({ ...DEFAULT_PARAMS, ...q }, DEFAULT_PARAMS) as any,
}))

const avstand = (a: any, b: any) => {
  let s = 0
  let w = 0
  for (const [k, vekt] of FORM) {
    const r = PARAM_RANGES[k]
    if (!r) continue
    const d = (a[k] - b[k]) / (r.max - r.min)
    s += vekt * d * d
    w += vekt
  }
  return Math.sqrt(s / w)
}

console.log("måltal per pose:")
for (const q of posar) {
  const m = measure(q.p)
  console.log(
    `  ${q.namn.padEnd(11)} sit ${m.sitZ.toFixed(0)}  kube ${Math.max(m.envX, m.envY, m.envZ).toFixed(0)}` +
      `  sete ${m.seatW.toFixed(0)}×${m.seatD.toFixed(0)}  ${m.mass.toFixed(1)} kg` +
      `  ark ${(m.sheetUtil * 100).toFixed(0)} %  ${m.parts} delar  velte ${m.tipAngle.toFixed(0)}°`,
  )
}

console.log("\navstand (0 = same stol, 1 = motsette hjørne av rommet):")
let minste = Infinity
let par = ""
const N = posar.length
process.stdout.write("             " + posar.map((q) => q.namn.slice(0, 6).padStart(7)).join("") + "\n")
for (let i = 0; i < N; i++) {
  let rad = "  " + posar[i].namn.padEnd(11)
  for (let j = 0; j < N; j++) {
    if (i === j) { rad += "      ·"; continue }
    const d = avstand(posar[i].p, posar[j].p)
    rad += d.toFixed(3).padStart(7)
    if (j > i && d < minste) { minste = d; par = `${posar[i].namn}–${posar[j].namn}` }
  }
  console.log(rad)
}
console.log(`\nminsteavstand ${minste.toFixed(3)}  (${par})`)
console.log(
  minste >= 0.22
    ? "\x1b[32mfem ulike stolar\x1b[0m"
    : minste >= 0.15
      ? "\x1b[33mto av dei liknar for mykje\x1b[0m"
      : "\x1b[31mdette er ikkje fem stolar\x1b[0m",
)
