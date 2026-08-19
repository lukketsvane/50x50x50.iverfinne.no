/**
 * Vakta mot eit stumt produksjonsbrot.
 *
 * Turbopack kompilerer ikkje `new Worker(new URL("../lib/worker.ts", …))` —
 * han legg den RÅE TypeScript-fila i static/media og serverer henne som
 * video/mp2t. Arbeidaren døyr då lydlaust i nettlesaren: ingen geometri
 * kjem, og sida står «fryst» med prikken på. Lokalt bygde vi alltid med
 * --webpack og såg det aldri; produksjonen stod broten i dagevis.
 *
 * Difor: byggjeskriptet tvingar webpack, og denne fila NEKTAR å sleppe
 * gjennom eit bygg der worker-en ligg som .ts i media — same kva
 * buntar som laga det.
 */
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const media = join(".next", "static", "media")
const raw = existsSync(media)
  ? readdirSync(media).filter((f) => f.startsWith("worker") && f.endsWith(".ts"))
  : []
if (raw.length > 0) {
  console.error(
    `BYGGET ER BROTE: arbeidaren ligg som rå TypeScript i static/media (${raw.join(", ")}).\n` +
      "Det tyder at bygget gjekk gjennom Turbopack. Bygg med `next build --webpack`.",
  )
  process.exit(1)
}
console.log("worker-vakta: ok — ingen rå .ts i static/media")
