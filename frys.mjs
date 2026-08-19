import { chromium } from "playwright"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  colorScheme: "dark", isMobile: true, hasTouch: true,
})
const pg = await ctx.newPage()
const cdp = await ctx.newCDPSession(pg)
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 })
await cdp.send("Debugger.enable")
const scripts = new Map()
cdp.on("Debugger.scriptParsed", (e) => scripts.set(e.scriptId, e.url))
await pg.goto("http://localhost:3170/", { waitUntil: "load" })
await pg.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false", null, { timeout: 90000 })
const dice = await pg.evaluate(() => {
  const el = [...document.querySelectorAll("section button")].find((q) => q.title === "terning")
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log("trykkjer terningen …")
const paused = new Promise((res) => cdp.once("Debugger.paused", res))
await pg.touchscreen.tap(dice.x, dice.y).catch(() => {})
await new Promise((r) => setTimeout(r, 6000))
console.log("pausar den (truleg) frosne tråden …")
await cdp.send("Debugger.pause")
const ev = await Promise.race([paused, new Promise((r) => setTimeout(() => r(null), 8000))])
if (!ev) console.log("fekk ikkje pausa — tråden svarar kanskje likevel")
else {
  for (const f of ev.callFrames.slice(0, 12)) {
    console.log(`  ${f.functionName || "(anonym)"} @ ${String(scripts.get(f.location.scriptId)).slice(-50)}:${f.location.lineNumber}`)
  }
}
await cdp.send("Debugger.resume").catch(() => {})
await b.close()
