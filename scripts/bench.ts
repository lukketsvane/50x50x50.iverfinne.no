import { makeShell } from "../lib/skal/field.ts"
import { buildMesh, DETAIL } from "../lib/skal/surface.ts"
import { buildStack } from "../lib/skal/laminae.ts"
import { measure } from "../lib/skal/metrics.ts"
import { checkRules } from "../lib/skal/rules.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
const p = DEFAULT_PARAMS
const t = (s: string, f: () => unknown) => { const a = Date.now(); const r = f(); console.log(s.padEnd(26), (Date.now()-a)+" ms"); return r }
for (const d of ["lav","mid"] as const) {
  console.log("--- detalj " + d + " ---")
  const t0 = Date.now()
  const sh = t("makeShell", () => makeShell(p)) as ReturnType<typeof makeShell>
  const st = t("buildStack", () => buildStack(p, sh)) as ReturnType<typeof buildStack>
  const me = t("buildMesh", () => buildMesh(p, DETAIL[d], sh)) as ReturnType<typeof buildMesh>
  const m = t("measure (lånt)", () => measure(p, { shell: sh, mesh: me, stack: st })) as ReturnType<typeof measure>
  t("checkRules (lånt)", () => checkRules(p, m, sh))
  console.log("SUM".padEnd(26), (Date.now()-t0)+" ms")
  const a = Date.now(); measure(p); console.log("measure (utan lån)".padEnd(26), (Date.now()-a)+" ms")
}
