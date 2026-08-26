/**
 * Kontraktprøva.
 *
 * Fire motorar er berre fire motorar om dei svarar på det same. Skalet er
 * skrive éin gong og veit ingenting om kva som ligg under nedtrekket, så
 * kvar gong ein motor bryt kontrakten, er det skalet som knekk — og det
 * knekk i nettlesaren, ikkje her. Denne fila flyttar bruddet hit.
 *
 *   npx tsx scripts/typologies.ts          alle motorar
 *   npx tsx scripts/typologies.ts ribbe    berre éin
 *
 * Prøva byggjer ikkje ei fasit. Ho spør berre om motoren held sine eigne
 * lovnader: at nøklane finst, at terningen er determinert, at nettet er
 * lukka, at ingen tal er NaN, og at objektet står i kuben.
 */
import { CUBE, seeded, type EngineDef, type DetailKey, type ExportKind, type View } from "../lib/core.ts"
import { ALLE_MOTORAR as ENGINES } from "../lib/engines.ts"

const VIEWS: View[] = ["flate", "lag", "kontur"]
const DETAILS: DetailKey[] = ["lav", "mid", "hog"]
const KINDS: ExportKind[] = ["stl", "dxf", "svg", "ark"]

let fails = 0
const ok = (cond: boolean, what: string, detail = "") => {
  if (!cond) fails++
  const mark = cond ? "  ok  " : "  FEIL"
  console.log(`${mark} ${what}${detail ? "   " + detail : ""}`)
}

/** Retta kantar som ikkje finn makkeren sin, er hòl i skalet. */
function shellCheck(m: { positions: Float32Array; tris: number }) {
  const q = 1e3
  const vid = new Map<string, number>()
  const id = (i: number) => {
    const k = [0, 1, 2].map((c) => Math.round(m.positions[i * 3 + c] * q)).join(",")
    let v = vid.get(k)
    if (v === undefined) { v = vid.size; vid.set(k, v) }
    return v
  }
  const dir = new Map<string, number>()
  const key = (a: number, b: number) => `${a}|${b}`
  for (let t = 0; t < m.tris; t++) {
    const a = id(t * 3), b = id(t * 3 + 1), c = id(t * 3 + 2)
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      dir.set(key(u, v), (dir.get(key(u, v)) ?? 0) + 1)
    }
  }
  let border = 0, bad = 0, dup = 0
  for (const [k, n] of dir) {
    const [u, v] = k.split("|").map(Number)
    const back = dir.get(key(v, u)) ?? 0
    if (n > 1) dup++
    if (back === 0) border++
    else if (back !== n) bad++
  }
  return { border, bad, dup, verts: vid.size }
}

function finite(a: Float32Array) {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false
  return true
}

function probe(e: EngineDef) {
  console.log(`\n\x1b[1m${e.id.toUpperCase()}\x1b[0m — ${e.label}`)
  console.log(`  ${e.note}`)

  // --- nøklane heng saman ---------------------------------------------------
  const inGroups = e.groups.flatMap((g) => g.keys)
  const dupKeys = inGroups.filter((k, i) => inGroups.indexOf(k) !== i)
  ok(dupKeys.length === 0, "kvar nøkkel i høgst éi gruppe", dupKeys.join(","))
  const missRange = inGroups.filter((k) => !e.ranges[k])
  ok(missRange.length === 0, "kvar gruppenøkkel har eit spenn", missRange.join(","))
  const missDef = e.keys.filter((k) => e.defaults[k] === undefined)
  ok(missDef.length === 0, "kvar nøkkel har ein standardverdi", missDef.join(","))
  const orphan = Object.keys(e.ranges).filter((k) => !inGroups.includes(k))
  ok(orphan.length === 0, "ingen skyvar utan gruppe", orphan.join(","))

  // --- posane og hovuddraga peikar berre inn i rommet som finst ------------
  const poseMiss = e.poses.flatMap((p) =>
    Object.keys(p.bag).filter((k) => k !== "material" && !e.ranges[k]),
  )
  ok(poseMiss.length === 0, "kvar pose held seg til banda", poseMiss.join(","))
  ok(e.poses.every((p) => p.namn.length > 0), "kvar pose har eit namn")
  const dragMiss = e.hovuddrag.flatMap((d) => d.keys.filter(([k]) => !e.ranges[k]).map(([k]) => k))
  ok(dragMiss.length === 0, "kvart hovuddrag held seg til banda", dragMiss.join(","))
  ok(e.hovuddrag.every((d) => d.keys.length > 0 && d.keys[0][1] === 1),
    "kvart hovuddrag har ein primær med vekt 1")
  const nudgeMiss = Object.values(e.nudge).filter((k) => !e.ranges[k])
  ok(nudgeMiss.length === 0, "gestane peikar på band som finst", nudgeMiss.join(","))

  // --- standarden ligg inne i sitt eige spenn ------------------------------
  const outside = Object.entries(e.ranges).filter(([k, r]) => {
    const v = e.defaults[k]
    return typeof v === "number" && (v < r.min - 1e-9 || v > r.max + 1e-9)
  }).map(([k]) => k)
  ok(outside.length === 0, "standarden ligg i spennet", outside.join(","))

  // --- klemminga er idempotent ---------------------------------------------
  const c1 = e.clamp(e.defaults, e.defaults)
  const c2 = e.clamp(c1, c1)
  ok(JSON.stringify(c1) === JSON.stringify(c2), "klemminga er idempotent")
  const drift = e.keys.filter((k) => c1[k] !== e.defaults[k])
  ok(drift.length === 0, "standarden overlever klemminga", drift.join(","))

  // --- terningen er determinert --------------------------------------------
  const a = e.random(seeded("krakk"), e.defaults, new Set())
  const b = e.random(seeded("krakk"), e.defaults, new Set())
  ok(JSON.stringify(a) === JSON.stringify(b), "same frø gjev same objekt")
  const lockKey = e.keys.find((k) => typeof e.defaults[k] === "number")!
  const l = e.random(seeded("laas"), e.defaults, new Set([lockKey]))
  ok(l[lockKey] === e.defaults[lockKey], `laasen held (${lockKey})`)

  // --- måltala er tal -------------------------------------------------------
  const m = e.measure(e.defaults)
  const nanKeys = Object.entries(m).filter(
    ([, v]) => typeof v === "number" && !Number.isFinite(v),
  ).map(([k]) => k)
  ok(nanKeys.length === 0, "ingen måltal er NaN", nanKeys.join(","))
  ok(m.list.length > 0 && m.list.every((x) => typeof x.text === "string"),
    `${m.list.length} måltal er ferdig formaterte`)

  // --- kuben ----------------------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  ok(big <= CUBE + 0.5, `står i kuben`, `${big.toFixed(1)} av ${CUBE}`)

  // --- sitjehøgda etter NS-EN 1729 -----------------------------------------
  ok(m.sitZ >= 380 && m.sitZ <= 480, "sitjehøgda i bandet", `${m.sitZ.toFixed(0)} mm`)

  // --- reglane --------------------------------------------------------------
  const r = e.rules(e.defaults, m)
  const broken = r.filter((x) => !x.ok)
  ok(r.length > 0, `${r.length} reglar, ${r.filter((x) => x.hard).length} harde`)
  ok(broken.length === 0, "standarden held alle reglane",
    broken.map((x) => x.id).join(","))

  // --- nettet ---------------------------------------------------------------
  for (const view of VIEWS) {
    for (const detail of DETAILS) {
      const o = e.build(e.defaults, detail, view)
      const tag = `${view}/${detail}`
      // Konturvisninga er ei teikning, ikkje eit legeme: ho leverer liner og
      // ingen trekantar, og det er ikkje eit brot — det er kva ho er.
      if (view === "kontur") {
        ok(o.lines.length > 0 && o.lines.length % 6 === 0, `${tag}: konturliner`,
          `${o.lines.length / 6} strek`)
        ok(finite(o.lines), `${tag}: ingen NaN i linene`)
      } else {
        ok(o.tris > 0, `${tag}: nett`, `${o.tris} trekantar`)
      }
      ok(o.positions.length === o.tris * 9, `${tag}: rett lengd`)
      ok(finite(o.positions) && finite(o.normals), `${tag}: ingen NaN i nettet`)
      if (detail === "mid" && view === "flate") {
        const s = shellCheck(o)
        ok(s.border === 0 && s.bad === 0 && s.dup === 0, `${tag}: lukka skal`,
          `kant ${s.border} · ueinig ${s.bad} · dobbel ${s.dup} · ${s.verts} hjørne`)
      }
    }
  }

  // --- kva det kostar -------------------------------------------------------
  // Skyvaren slepper, og workeren byggjer flate/mid. Går det over ei drøy
  // tidel, kjenner fingeren det som at verktøyet nølte.
  {
    const t0 = performance.now()
    e.build(e.defaults, "mid", "flate")
    const dt = performance.now() - t0
    const t1 = performance.now()
    e.measure(e.defaults)
    const dm = performance.now() - t1
    // Grensa er ikkje eit mål, ho er der fingeren sluttar å tru på verktøyet.
    // Etappe 2 og 3 i PLAN.md skal ta dette ned; her fangar vi berre ein
    // motor som er så treg at skyvaren ikkje lèt seg bruke i det heile.
    ok(dt + dm < 2000, "workeren rekk over eit skyvarslepp",
      `bygg ${dt.toFixed(0)} + mål ${dm.toFixed(0)} = ${(dt + dm).toFixed(0)} ms`)
  }

  // --- eksport --------------------------------------------------------------
  for (const kind of KINDS) {
    const f = e.exportFile(e.defaults, kind)
    const n = f.text ? f.text.length : (f.data?.byteLength ?? 0)
    ok(n > 200 && f.name.length > 0, `eksport ${kind}`, `${f.name} · ${n} b`)
  }

  // --- terningen over rommet ------------------------------------------------
  // Eit rom der terningen stort sett gjev noko ulovleg er ikkje eit rom ein
  // kan gå inn i. Talet skal stå i mappa, ikkje gøymast.
  let hard = 0, all = 0
  const N = 40
  for (let i = 0; i < N; i++) {
    const p = e.random(seeded("terning" + i), e.defaults, new Set())
    const mm = e.measure(p)
    const rr = e.rules(p, mm)
    if (rr.filter((x) => x.hard).every((x) => x.ok)) hard++
    if (rr.every((x) => x.ok)) all++
  }
  console.log(`       terningen: ${Math.round((hard / N) * 100)} % held dei harde, ` +
    `${Math.round((all / N) * 100)} % held alle`)
}

const only = process.argv[2]
const list = only ? ENGINES.filter((e) => e.id === only) : ENGINES
if (!list.length) { console.error(`ukjend motor: ${only}`); process.exit(2) }
for (const e of list) probe(e)
console.log(fails ? `\n\x1b[31m${fails} brot på kontrakten\x1b[0m` : "\n\x1b[32malle held kontrakten\x1b[0m")
process.exit(fails ? 1 : 0)
