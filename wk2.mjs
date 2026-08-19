import { webkit, devices } from "playwright"
const OUT = "/tmp/claude-0/-home-user/06a4d9af-f3f0-59ab-8cd5-eb0837e91bec/scratchpad"
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" })
const pg = await ctx.newPage()
const logs = []
pg.on("pageerror", (e) => logs.push("PAGEERROR: " + String(e)))
await pg.goto("http://localhost:3150/", { waitUntil: "load" })
await pg.waitForTimeout(3500)

// 1) rotasjon: eitt-finger-drag over lerretet — frys hovudtråden?
const t0 = Date.now()
await pg.touchscreen.tap(195, 400)
for (let i = 0; i <= 10; i++) {
  await pg.touchscreen.tap(150 + i * 8, 400) // grov rørsle-proxy
}
console.log("touch-taps svarte på", Date.now() - t0, "ms")

// 2) opne panelet og dra ein skyvar med ekte touch
await pg.evaluate(() => {
  [...document.querySelectorAll("section button")].find((q) => q.getAttribute("aria-expanded") !== null)?.click()
})
await pg.waitForTimeout(400)
await pg.evaluate(() => {
  [...document.querySelectorAll("button")].find((q) => q.textContent.includes("alle skruane"))?.click()
})
await pg.waitForTimeout(400)
const box = await pg.evaluate(() => {
  const el = document.querySelector('input[type="range"]')
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y + r.height / 2, w: r.width }
})
console.log("skyvar:", JSON.stringify(box))
const t1 = Date.now()
// simuler eit drag over skyvaren med ei rekkje endringar
await pg.evaluate(async () => {
  const el = document.querySelector('input[type="range"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
  const min = +el.min, max = +el.max
  for (let i = 1; i <= 15; i++) {
    set.call(el, String(min + (i / 16) * (max - min)))
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    await new Promise((r) => setTimeout(r, 60))
  }
})
console.log("skyvardrag (15 steg à 60 ms) tok", Date.now() - t1, "ms — jank = differansen frå 900")
await pg.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false", null, { timeout: 30000 })
console.log("tala sette seg etter", Date.now() - t1, "ms totalt")
await pg.screenshot({ path: `${OUT}/wk-etter-drag.png` })
console.log("--- feil ---"); for (const l of [...new Set(logs)]) console.log(l)
if (!logs.length) console.log("ingen")
await b.close()
