import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })

async function run(name, viewport, dsf, cpuThrottle) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: viewport.width < 600 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message))
  const cdp = await ctx.newCDPSession(p)
  if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle })
  const t0 = Date.now()
  await p.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 60000 })
  const tCanvas = Date.now() - t0
  // vent til fyrste mesh og fyrste tal står på skjermen
  await p.waitForFunction(() => /mm/.test(document.body.innerText), null, { timeout: 60000 })
  const tFirst = Date.now() - t0
  await p.waitForTimeout(4000)

  // opne skruane
  await p.click('[aria-controls="sandkasse-skruar"]:not(.lg\\:hidden)').catch(() => {})
  const inputs = await p.$$('#sandkasse-skruar input[type=range]')

  // tid frå skyvar til nytt tal, median av fem drag
  const lat = []
  for (let n = 0; n < 5 && inputs.length; n++) {
    const el = inputs[10 % inputs.length]
    const before = await p.evaluate(() => document.querySelector('table')?.innerText ?? document.body.innerText)
    const t1 = Date.now()
    await el.evaluate((node, k) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const min = Number(node.min), max = Number(node.max)
      set.call(node, String(min + ((max - min) * (0.2 + k * 0.12))))
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
    }, n)
    try {
      await p.waitForFunction(
        (b) => (document.querySelector('table')?.innerText ?? document.body.innerText) !== b,
        before, { timeout: 30000 })
      lat.push(Date.now() - t1)
    } catch { lat.push(-1) }
    await p.waitForTimeout(400)
  }
  lat.sort((a, b) => a - b)

  // rammerate under samanhengande orbit
  const box = await p.evaluate(() => {
    const c = document.querySelector('canvas')
    const r = c.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height * 0.3 }
  })
  await p.evaluate(() => { window.__f = 0; const t = () => { window.__f++; requestAnimationFrame(t) }; requestAnimationFrame(t) })
  await p.mouse.move(box.x, box.y)
  await p.mouse.down()
  const start = Date.now()
  let i = 0
  while (Date.now() - start < 4000) {
    i++
    await p.mouse.move(box.x + Math.sin(i / 6) * 140, box.y + Math.cos(i / 9) * 40)
    await p.waitForTimeout(16)
  }
  await p.mouse.up()
  const frames = await p.evaluate(() => window.__f)
  const fps = frames / ((Date.now() - start) / 1000)

  const hash = await p.evaluate(() => location.hash.length)
  console.log(
    `${name}\n  canvas ${tCanvas} ms · fyrste tal ${tFirst} ms · skyvar→nytt tal median ${lat[lat.length >> 1]} ms ` +
    `(${lat.join('/')}) · orbit ${fps.toFixed(1)} fps (programvare-GL) · hash ${hash} teikn · feil ${errs.length}`)
  if (errs.length) console.log('   ', errs.slice(0, 3).join(' | '))
  await ctx.close()
}

await run('desktop 1440×900, dsf 2', { width: 1440, height: 900 }, 2, 1)
await run('mobil 430×932, dsf 3, cpu ÷4', { width: 430, height: 932 }, 3, 4)
await b.close()
