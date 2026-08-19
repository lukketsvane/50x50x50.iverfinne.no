import { webkit, devices } from "playwright"
const OUT = "/tmp/claude-0/-home-user/06a4d9af-f3f0-59ab-8cd5-eb0837e91bec/scratchpad"
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" })
const pg = await ctx.newPage()
const logs = []
pg.on("pageerror", (e) => logs.push("PAGEERROR: " + String(e)))
pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text().slice(0, 200)) })
const t0 = Date.now()
await pg.goto("http://localhost:3150/", { waitUntil: "load", timeout: 30000 }).catch((e) => logs.push("GOTO: " + e))
console.log("load etter", Date.now() - t0, "ms")
for (const s of [3000, 6000, 12000, 20000]) {
  await pg.waitForTimeout(s === 3000 ? 3000 : s - (s === 6000 ? 3000 : s === 12000 ? 6000 : 12000))
  const st = await pg.evaluate(() => ({
    busy: document.querySelector("section")?.getAttribute("aria-busy"),
    tekst: document.querySelector("section")?.innerText.split("\n").slice(0, 3).join(" | "),
    canvas: !!document.querySelector("canvas"),
  })).catch((e) => "EVAL-HANG: " + e)
  console.log(`${s} ms:`, JSON.stringify(st))
  await pg.screenshot({ path: `${OUT}/wk-${s}.png` }).catch(() => {})
}
console.log("--- loggar ---"); for (const l of [...new Set(logs)]) console.log(l)
await b.close()
