/**
 * FORMLÆRE / FORSØK 01: dokumentert kandidatmanifest frå 50×50×50-motorane.
 * Køyr: npx tsx scripts/formlaere-forsok01.ts > formlaere-kandidatar.json
 * Skriptet skriv berre JSON til stdout, ikkje til kjeldemappene.
 * Kandidatar er ikkje observerte menneskeval eller sertifiserte møbel.
 */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { ENGINES } from "../lib/engines.ts"
import { seeded, type ParamBag } from "../lib/core.ts"

const STUDY = "formlaere-50x50x50-pilot01"
const BASE_COMMIT = "7e03fd3398031b88c63581dbff0c078763943b5a"
const SEED = "formlaere-forsok01-20261107"
const N = Number(process.env.FORMLAERE_SETS ?? 8)
if (!Number.isInteger(N) || N < 5 || N > 24) {
  throw new Error("FORMLAERE_SETS skal vere heiltal 5..24")
}
if (ENGINES.length !== 4) {
  throw new Error("Føreset fire publiserte typologiar, elles må protokollen endrast")
}
type Option = {
  option_id: string
  source_engine: string
  source_pose: string
  params: ParamBag
  metrics: {
    env_mm: [number, number, number]
    sitZ_mm: number
    mass_kg: number
    material_area_mm2: number
    load_utilization_model: number
    parts: number
    sheets: number
    sheet_utilization: number
  }
  hard_rule_flags: string[]
  soft_rule_flags: string[]
  preview_url: string
  candidate_sha256: string
}

const sha = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex")
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
function currentSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}
const rejected: { engine: string; pose: string; reason: string }[] = []
const pools = ENGINES.map((engine) => {
  const poses = [
    { label: "standard", bag: {} as Readonly<Partial<ParamBag>> },
    ...engine.poses.map((pose) => ({ label: pose.namn, bag: pose.bag })),
  ]
  const options: Option[] = []
  for (const pose of poses) {
    try {
      const params = copy(engine.clamp({ ...engine.defaults, ...pose.bag }, engine.defaults))
      const metrics = engine.measure(params)
      const rules = engine.rules(params, metrics)
      const hard = rules.filter((r) => r.hard && !r.ok).map((r) => r.id)
      const soft = rules.filter((r) => !r.hard && !r.ok).map((r) => r.id)
      if (hard.length) {
        rejected.push({ engine: engine.id, pose: pose.label, reason: hard.join(",") })
        continue
      }
      const basics = {
        option_id: engine.id + ":" + pose.label,
        source_engine: engine.id,
        source_pose: pose.label,
        params,
        metrics: {
          env_mm: [metrics.envX, metrics.envY, metrics.envZ] as [number,number,number],
          sitZ_mm: metrics.sitZ,
          mass_kg: metrics.mass,
          material_area_mm2: metrics.plyArea,
          load_utilization_model: metrics.util,
          parts: metrics.parts,
          sheets: metrics.sheets,
          sheet_utilization: metrics.sheetUtil,
        },
        hard_rule_flags: hard,
        soft_rule_flags: soft,
        preview_url: "https://50x50x50.iverfinne.no/#p=" +
          encodeURIComponent(JSON.stringify({ engine: engine.id, ...params, view: "lag" })),
      }
      const numbers = Object.values(basics.metrics)
        .flatMap((x) => Array.isArray(x) ? x : [x])
      if (numbers.some((x) => !Number.isFinite(x))) {
        throw new Error("Uendeleg eller manglande motormåltal")
      }
      options.push({ ...basics, candidate_sha256: sha(basics) })
    } catch (err) {
      rejected.push({
        engine: engine.id, pose: pose.label,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
  if (!options.length) throw new Error("Ingen lovlege kandidatar i " + engine.id)
  return { engine: engine.id, options }
})
const rnd = seeded(SEED)
const shuffled = pools.map((pool) => {
  const arr = [...pool.options]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return { engine: pool.engine, options: arr }
})
const sets = Array.from({ length: N }, (_, i) => {
  const candidates = shuffled.map((pool) => pool.options[i % pool.options.length])
  for (let j = candidates.length - 1; j > 0; j--) {
    const k = Math.floor(rnd() * (j + 1))
    const tmp = candidates[j]; candidates[j] = candidates[k]; candidates[k] = tmp
  }
  return {
    case_id: STUDY + ":" + String(i + 1).padStart(2, "0"),
    randomized_presentation: true,
    weights: i % 2 === 0
      ? { agent1: 0.75, agent2: 0.25 }
      : { agent1: 0.25, agent2: 0.75 },
    options: candidates.map((c, j) => ({
      ...c, display_code: "ABCD"[j], mu: 0.25,
    })),
  }
})
const payload = {
  schema_version: "formlaere-pilot-manifest-v1",
  study_id: STUDY,
  generator_repo: "lukketsvane/50x50x50.iverfinne.no",
  generator_base_commit: BASE_COMMIT,
  generator_checkout_commit: currentSha(),
  seed: SEED,
  created_by: "deterministic-curated-pose-sampler",
  prior_kind: "uniform-by-presentation-design; NOT measured natural mu_SG",
  candidate_status: "computer-rule-feasible; NOT physically load-tested",
  notes: [
    "Dette er 50x50x50-sandkassa, ikkje automatisk Knappen-kandidatar.",
    "Vurderingar og val må kome seinare frå menneske, uavhengig av denne koden.",
    "Dei fire motortypologiane er stratifiserte; mu=1/4 gjeld presentasjonen.",
    "Mekanisk modellverdi erstattar aldri fysisk tryggingsprøve.",
  ],
  rejected_poses: rejected,
  sets,
}
process.stdout.write(JSON.stringify({
  ...payload, manifest_sha256: sha(payload),
}, null, 2) + "\n")
