/**
 * SANDKASSE — kor stort det brukbare rommet er.
 *
 * Terningen trekkjer uniformt i eit rom på 45 aksar. Spørsmålet ingen
 * har svart på er kor stor del av det rommet som faktisk er eit møbel.
 * Svaret avgjer om terningen skal trekkje på nytt, eller om han skal
 * projisere trekket tilbake i det som held — og det er ei avgjerd som
 * høyrer heime i planen, ikkje i ei kjensle.
 */
import { measure } from "../lib/skal/metrics"
import { checkRules } from "../lib/skal/rules"
import { DEFAULT_PARAMS, randomParams, seeded } from "../lib/skal/params"

const N = 60
const fail = new Map<string, number>()
const failSoft = new Map<string, number>()
let allHardOk = 0
let allOk = 0

for (let i = 0; i < N; i++) {
  const q = randomParams(seeded("felt:" + i), DEFAULT_PARAMS)
  const rs = checkRules(q, measure(q))
  let hardOk = true
  let softOk = true
  for (const r of rs) {
    if (r.ok) continue
    if (r.hard) {
      hardOk = false
      fail.set(r.id, (fail.get(r.id) ?? 0) + 1)
    } else {
      softOk = false
      failSoft.set(r.id, (failSoft.get(r.id) ?? 0) + 1)
    }
  }
  if (hardOk) allHardOk++
  if (hardOk && softOk) allOk++
}

console.log(`${N} uniforme trekk`)
console.log("held alle harde reglar:", allHardOk, `(${((allHardOk / N) * 100).toFixed(0)} %)`)
console.log("held alt, òg mjukt:    ", allOk, `(${((allOk / N) * 100).toFixed(0)} %)`)
console.log()
console.log("harde brot per regel:")
for (const [id, n] of [...fail].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(12)} ${n} · ${((n / N) * 100).toFixed(0)} %`)
}
console.log("mjuke brot per regel:")
for (const [id, n] of [...failSoft].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(12)} ${n} · ${((n / N) * 100).toFixed(0)} %`)
}

// standardobjektet til samanlikning
const base = checkRules(DEFAULT_PARAMS, measure(DEFAULT_PARAMS))
console.log()
console.log("standardobjektet:")
for (const r of base) {
  if (!r.ok) console.log(`  BRYT ${r.hard ? "hard" : "mjuk"} ${r.id}: ${r.value}`)
}
console.log("  brot i alt:", base.filter((r) => !r.ok).length, "av", base.length)
