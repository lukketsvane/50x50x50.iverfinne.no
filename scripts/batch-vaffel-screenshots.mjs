import { chromium } from "playwright"
import fs from "node:fs/promises"
import path from "node:path"

const COUNT = Number(process.env.COUNT ?? 320)
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3170/"
const OUT = process.env.OUT ?? "batch-vaffel"

await fs.mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
})
const context = await browser.newContext({
  viewport: { width: 1400, height: 1400 },
  deviceScaleFactor: 1,
  colorScheme: "light",
})
const page = await context.newPage()
page.setDefaultTimeout(90000)

await page.goto(BASE, { waitUntil: "load" })
await page.waitForSelector("canvas")
await page.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false")

// The site opens on VAFFEL already. Double-click the typology pill once so
// subsequent dice throws vary only the VAFFEL parameter space.
const typology = page.locator('button[aria-label^="typologi"]').first()
await typology.dblclick()
await page.waitForFunction(() => document.querySelector('button[aria-label^="typologi"]')?.getAttribute("aria-pressed") === "true")

const dice = page.locator('button[title="terning"]').first()
const canvas = page.locator("canvas").first()

const manifest = []
for (let i = 1; i <= COUNT; i++) {
  const before = await page.evaluate(() => location.hash)
  await dice.click()
  await page.waitForFunction((h) => location.hash !== h, before)
  await page.waitForFunction(() => document.querySelector("section")?.getAttribute("aria-busy") === "false")
  // allow camera fit + demand-render to settle after the new mesh arrives
  await page.waitForTimeout(220)

  const id = String(i).padStart(3, "0")
  const file = `vaffel_${id}.png`
  await canvas.screenshot({ path: path.join(OUT, file), type: "png" })
  const hash = await page.evaluate(() => location.hash)
  manifest.push({ id: i, file, hash })
  if (i % 20 === 0) console.log(`${i}/${COUNT}`)
}

await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2))
await browser.close()
console.log(`ferdig: ${COUNT} VAFFEL-bilete i ${OUT}`)
