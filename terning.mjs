import { chromium } from "playwright"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  colorScheme: "dark", isMobile: true, hasTouch: true,
})
const pg = await ctx.newPage()
// CPU-strupe 6× — ein grov iPhone-proxy
const cdp = await ctx.newCDPSession(pg)
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 })
const errs = []
pg.on("pageerror", (e) => errs.push(String(e).slice(0, 140)))
await pg.goto("http://localhost:3170/", { waitUntil: "load" })
await pg.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false", null, { timeout: 60000 })
console.log("klar — trykkjer terningen fem gonger")
const dice = await pg.evaluate(() => {
  const el = [...document.querySelectorAll("section button")].find((q) => q.title === "terning")
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
for (let i = 1; i <= 5; i++) {
  const line0 = await pg.evaluate(() => document.querySelector("section")?.innerText.split("\n")[1])
  const t0 = Date.now()
  await pg.touchscreen.tap(dice.x, dice.y)
  // kor raskt svarar hovudtråden etter trykket?
  const t1 = Date.now()
  await pg.evaluate(() => 1 + 1)
  const responsiv = Date.now() - t1
  await pg.waitForFunction(
    (f) => document.querySelector("section")?.innerText.split("\n")[1] !== f,
    line0, { timeout: 30000 },
  ).catch(() => console.log(`  kast ${i}: TALA ENDRA SEG ALDRI`))
  const tTal = Date.now() - t0
  await pg.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false", null, { timeout: 30000 })
  console.log(`kast ${i}: hovudtråd svarte på ${responsiv} ms · nye tal etter ${tTal} ms · ferdig etter ${Date.now() - t0} ms`)
}
console.log(errs.length ? "FEIL: " + [...new Set(errs)].join(" | ") : "ingen sidefeil")
await b.close()
