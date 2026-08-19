/**
 * SANDKASSE — kor kort lenkja kan bli.
 *
 * Hashen i dag er JSON. Han er lesbar, og det er verdt noko, men han
 * kodar «0.005» som fem teikn når bandet berre har 181 trinn. Denne
 * målinga seier kva ei fastordna, kvantisert koding faktisk ville kosta,
 * slik at valet mellom lesbar og kort kan takast på eit tal.
 */
import {
  DEFAULT_PARAMS,
  MATERIALS,
  PARAM_KEYS,
  PARAM_RANGES,
  randomParams,
  seeded,
} from "../lib/skal/params"

let bits = 0
let widest = { key: "", steps: 0 }
for (const k of PARAM_KEYS) {
  const r = PARAM_RANGES[k]
  const steps = Math.round((r.max - r.min) / r.step) + 1
  bits += Math.log2(steps)
  if (steps > widest.steps) widest = { key: k, steps }
}
// material og vising er små, faste val
bits += Math.log2(Object.keys(MATERIALS).length) + Math.log2(3)

const bytes = Math.ceil(bits / 8)
const b64 = Math.ceil(bytes / 3) * 4

const json = "#p=" + encodeURIComponent(JSON.stringify({ ...DEFAULT_PARAMS, view: "flate" }))

console.log("felt                ", PARAM_KEYS.length, "+ material + vising")
console.log("breiaste band       ", widest.key, "·", widest.steps, "trinn")
console.log("informasjon i alt   ", bits.toFixed(1), "bit =", bytes, "byte")
console.log("base64url           ", b64, "teikn + «#p=» =", b64 + 3)
console.log("JSON-hash i dag     ", json.length, "teikn")
console.log("faktor              ", (json.length / (b64 + 3)).toFixed(1), "×")

let worst = 0
for (let i = 0; i < 200; i++) {
  const q = randomParams(seeded("hash:" + i), DEFAULT_PARAMS)
  const h = "#p=" + encodeURIComponent(JSON.stringify({ ...q, view: "kontur" }))
  worst = Math.max(worst, h.length)
}
console.log("verste JSON-hash    ", worst, "teikn (200 tilfeldige punkt)")
