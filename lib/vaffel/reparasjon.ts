/**
 * VAFFEL — reparasjonen etter terningkastet.
 *
 * Terningen får kaste kva han vil, men mange av krava er SUMAR og SNITT av
 * fleire tal — sitjehøgda av gropa og kanten, støtteflata av fot og
 * rutenett, heilskapen av midja mot den ytste ribba — og eit fritt kast
 * bryt dei oftare enn ikkje. Reparasjonen her flyttar kastet inn i det
 * lovlege med minst mogleg handlag: han rører berre ulåste skyvarar, alltid
 * innanfor banda, og han reknar med dei same formlane som body.ts reiser
 * kroppen med — eit tal her er det same talet som geometrien.
 *
 * Rekkjefylgja er lagd etter kva som styrer kva: høgda fyrst, so planet,
 * so rutenettet, so massen, so silhuetten mot den ytste ribba, og bogen til
 * slutt — for bogen les rutenett og silhuett, og skal difor rettast sist.
 */
import { CUBE, smooth, type Range } from "../core"
import type { Params } from "./params"

/** Marg til kuben — same tal som MARGIN i body.ts, so innpassinga her er
 *  den same rekninga som der. Planet vert klemt sidevegs mot HALF; høgda
 *  har ikkje noko som klemmer henne, so ho må haldast under TAK her. */
const TAK = CUBE - 14
const HALF = TAK / 2

/** Klokkekurva midja bit med — kopi av body.ts, av same grunn som resten. */
const bell = (u: number, c: number, w: number) => {
  const t = (u - c) / Math.max(1e-3, w)
  return Math.exp(-t * t)
}

export function applyFix(
  q: Params,
  locked: ReadonlySet<string>,
  R: Record<string, Range>,
): Params {
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = R[k]
    const c = Math.min(r.max, Math.max(r.min, +v.toFixed(3)))
    ;(q as Record<string, number | string>)[k] = r.int ? Math.round(c) : c
  }

  const rhoOf = (u: number) =>
    (q.fot + (q.skulder - q.fot) * smooth(u)) * (1 - q.midje * bell(u, q.midjeZ, q.midjeW))
  const profile = () => {
    let rhoMax = 0
    let rhoLo = Infinity
    let uLo = 0
    for (let i = 0; i <= 120; i++) {
      const u = i / 120
      const r = rhoOf(u)
      if (r > rhoMax) rhoMax = r
      if (r < rhoLo) {
        rhoLo = r
        uLo = u
      }
    }
    // same innpassing som body.ts: sige tek plass i djupna, so han står i
    // nemnaren der òg
    const s = Math.min(
      1,
      HALF / (q.planA * rhoMax + Math.abs(q.lut) / 2),
      HALF / (q.planB * rhoMax),
    )
    return { rhoMax, rhoLo, uLo, A: q.planA * s, B: q.planB * s }
  }
  const shoulder = () => (q.ribbT + q.pressfit) / 2 + 10
  const inset = () => q.ribbT / 2 + 20
  const grid = () => {
    const { rhoMax, rhoLo, uLo, A, B } = profile()
    const Ax = Math.max(q.ribbT, A * rhoMax - inset())
    const By = Math.max(q.ribbT, B * rhoMax - inset())
    return {
      rhoMax, rhoLo, uLo, A, B, Ax, By,
      axr: Ax * (1 - 1 / q.ribbX),
      byr: By * (1 - 1 / q.ribbY),
      pitchX: (2 * Ax) / q.ribbX,
      pitchY: (2 * By) / q.ribbY,
    }
  }

  // Massen, estimert av godset med bogekuttet trekt frå. Ryggen tel med som
  // ei HØGD: stiginga bak legg gods på kvar einaste ribbe, og middelet av
  // henne over planet er 0,1625 av rygg — integralet av smooth-kurva over
  // dei siste 65 prosentane av setedjupna.
  const RYGGSNITT = 0.1625
  const trimMass = () => {
    const g = grid()
    let rbar = 0
    for (let k = 0; k <= 60; k++) rbar += rhoOf(k / 60)
    rbar /= 61
    const rho0 = rhoOf(0)
    const ah = q.bogeH * q.hogd
    const awx = q.bogeBX * g.A * rho0
    const awy = q.bogeBY * g.B * rho0
    const RHO = 680 * 1e-9
    const hEff = q.hogd + RYGGSNITT * q.rygg
    const f1 = q.ribbT * hEff * 2 * rbar * (q.ribbX * g.B + q.ribbY * g.A) * RHO
    const f2 = q.ribbT * ah * (q.ribbX * awy + q.ribbY * awx) * RHO
    const est = 0.69 * f1 - 1.601 * f2
    if (est <= 10.3) return
    const tMin = Math.max(R.ribbT.min, q.hogd / 74) // slank-regelen
    fix("ribbT", Math.max(tMin, q.ribbT * (10.3 / est)))
    // om tjukna ikkje strekk til: ta ribber bort i staden
    const f1b = q.ribbT * hEff * 2 * rbar * (q.ribbX * g.B + q.ribbY * g.A) * RHO
    const f2b = q.ribbT * ah * (q.ribbX * awy + q.ribbY * awx) * RHO
    const est2 = 0.69 * f1b - 1.601 * f2b
    if (est2 > 10.9) {
      const cut = 10.9 / est2
      fix("ribbX", Math.max(R.ribbX.min, Math.floor(q.ribbX * cut)))
      fix("ribbY", Math.max(R.ribbY.min, Math.floor(q.ribbY * cut)))
    }
  }

  // --- sitjehøgda: gropa og lårletta dreg middelet under bandet -------------
  const sitEst = () => q.hogd - 0.8 * q.sokk - 0.1 * q.framkant
  if (sitEst() < 383) fix("hogd", 383 + 0.8 * q.sokk + 0.1 * q.framkant)
  if (sitEst() < 383) fix("sokk", Math.max(0, (q.hogd - 383 - 0.1 * q.framkant) / 0.8))

  // --- ryggen står OVER setekanten, og kuben måler toppen ------------------
  // Sidevegs vert planet klemt ned av innpassinga; oppover finst det inga
  // slik klemme, so summen av høgda og ryggen må haldast under taket her.
  if (q.hogd + q.rygg > TAK) fix("rygg", Math.max(0, TAK - q.hogd))

  // Tre gjennomgangar og ikkje to. Silhuett-leddet er det siste som rører
  // fot og skulder, og ein feitare silhuett er meir gods: utan ein
  // gjennomgang til vert vekta rekna på ein kropp som ikkje står der lenger.
  for (let pass = 0; pass < 3; pass++) {
    // --- setet: brukbar sitjeflate over 320 på den korte leia ---------------
    {
      const { A, B } = profile()
      const rSeat = rhoOf(0.95)
      if (2 * B * rSeat < 334 && q.planB < R.planB.max) fix("planB", q.planB * (334 / (2 * B * rSeat)))
      if (2 * A * rSeat < 334 && q.planA < R.planA.max) fix("planA", q.planA * (334 / (2 * A * rSeat)))
      const { A: A2, B: B2 } = profile()
      const short = Math.min(2 * A2 * rSeat, 2 * B2 * rSeat)
      if (short < 334) fix("skulder", q.skulder * (334 / short))
    }

    // --- støtteflata: åttekanten av føtene skal halde 900 cm² ---------------
    for (let it = 0; it < 6; it++) {
      const g = grid()
      const n = q.planN
      const rho0 = rhoOf(0)
      const tF = (pos: number, Ext: number, PerpExt: number) =>
        Ext * Math.pow(Math.max(0, Math.pow(rho0, n) - Math.pow(pos / PerpExt, n)), 1 / n)
      const rectX = g.axr + q.ribbT / 2
      const rectY = g.byr + q.ribbT / 2
      const cutX = Math.max(0, rectX - tF(g.byr, g.A, g.B))
      const cutY = Math.max(0, rectY - tF(g.axr, g.B, g.A))
      const est = 1.26 * (4 * rectX * rectY - 2 * cutX * cutY)
      if (est >= 103000) break
      if (locked.has("fot") || q.fot >= R.fot.max) break
      fix("fot", q.fot * 1.06)
    }

    // --- klemfare: opninga mellom ribbene ut av fingerbandet 5–25 -----------
    {
      const g = grid()
      const adj = (kN: "ribbX" | "ribbY", Axl: number) => {
        const n = q[kN]
        const gap = (2 * Axl) / n - q.ribbT
        if (!(gap >= 5 && gap < 25)) return
        const r = R[kN]
        const nOpen = Math.floor((2 * Axl) / (q.ribbT + 26.5))
        const nTight = Math.ceil((2 * Axl) / (q.ribbT + 3.5))
        const cOpen = nOpen >= r.min ? Math.min(r.max, nOpen) : null
        const cTight = nTight <= r.max ? Math.max(r.min, nTight) : null
        const pick =
          cOpen !== null && (cTight === null || Math.abs(cOpen - n) <= Math.abs(cTight - n))
            ? cOpen
            : cTight
        if (pick !== null && pick !== n) fix(kN, pick)
      }
      adj("ribbX", g.Ax)
      adj("ribbY", g.By)
    }

    // --- massen: estimert av godset, med bogekuttet trekt frå ---------------
    trimMass()

    // --- ytste ribba i kroppen i alle høgder, og HJØRNET anten heilt med
    // --- eller heilt ute: midjeluka skal aldri byrje inne i eit hjørneledd
    for (let it = 0; it < 14; it++) {
      const g = grid()
      const sh = shoulder()
      const n = q.planN
      const gAt = (x: number, y: number) =>
        Math.pow(Math.pow(Math.max(0, x) / g.A, n) + Math.pow(Math.max(0, y) / g.B, n), 1 / n)
      // ytste ribba treng minst TO ledd: skulderbandet ved dei inste kryssa
      // hennar må vera i kroppen i alle høgder — med heile krysspunktet, ikkje
      // berre aksen: ved låg planN blør hjørnet inn i g
      const pXin = q.ribbX % 2 ? g.pitchX : g.pitchX / 2
      const pYin = q.ribbY % 2 ? g.pitchY : g.pitchY / 2
      // Sige flyttar planet inntil |lut|/2 vekk frå ribba i X. Ribba står
      // stille, so det er PLANET som må vera stort nok til å halde henne
      // inne i den verste høgda — elles står den ytste X-ribba utanfor
      // kroppen ved golvet og har korkje fot eller ledd.
      const drag = Math.abs(q.lut) / 2
      const needAxis = Math.max(
        gAt(g.axr + drag + sh + 2, Math.min(pYin, g.byr)),
        gAt(Math.min(pXin, g.axr) + drag, g.byr + sh + 2),
      )
      const swm = (q.ribbT + q.pressfit) / 2 + 8
      const sroom = (q.ribbT + q.pressfit) / 2 + 12
      // hjørnet heilt med: luka byrjar først GODT forbi hjørneleddet
      const rhoUp = Math.max(gAt(g.axr, g.byr + swm), gAt(g.axr + swm, g.byr))
      // hjørnet heilt ute: luka har alt ete skulderbandet til hjørneleddet …
      const dnHi = Math.min(gAt(g.axr, g.byr - sroom), gAt(g.axr - sroom, g.byr))
      // … men ikkje nabo-leddet innanfor
      const dnLo = Math.max(
        gAt(g.axr, g.byr - g.pitchY + swm),
        gAt(g.axr - g.pitchX + swm, g.byr),
      )
      let need = needAxis
      const cornerOk = g.rhoLo >= rhoUp || (g.rhoLo >= dnLo && g.rhoLo <= dnHi - 0.005)
      if (!cornerOk) {
        const downValid = dnLo <= dnHi - 0.02 && dnHi - 0.01 >= needAxis
        if (downValid && g.rhoLo < dnLo) {
          // under det daude vindauga: lyft rhoLo inn i det
          need = Math.max(needAxis, dnLo + 0.005)
        } else if (
          downValid &&
          g.rhoLo > dnHi - 0.005 &&
          rhoUp - g.rhoLo > g.rhoLo - (dnHi - 0.01) &&
          !locked.has("midje")
        ) {
          // over vindauga, og det er nærare enn full solid: senk med midja
          const target = Math.max(needAxis, dnLo + 0.005, Math.min(dnHi - 0.015, g.rhoLo))
          const base = q.fot + (q.skulder - q.fot) * smooth(q.midjeZ)
          const want = 1 - target / Math.max(1e-6, base) // bell=1 i senteret
          if (want > q.midje + 0.004) {
            fix("midje", want)
            continue
          }
          need = Math.max(needAxis, rhoUp + 0.004)
        } else {
          need = Math.max(needAxis, rhoUp + 0.004)
        }
      }
      if (g.rhoLo >= need) break
      const inWaist = Math.abs(g.uLo - q.midjeZ) <= Math.max(0.05, q.midjeW)
      if (inWaist && q.midje > 0.005 && !locked.has("midje")) {
        const base = q.fot + (q.skulder - q.fot) * smooth(g.uLo)
        const want =
          (1 - need / Math.max(1e-6, base)) / Math.max(1e-6, bell(g.uLo, q.midjeZ, q.midjeW))
        fix("midje", Math.max(0, Math.min(q.midje, want - 0.005)))
        continue
      }
      const denom = 1 - q.midje * bell(g.uLo, q.midjeZ, q.midjeW)
      if (g.uLo < 0.5) {
        const wantFot = need / Math.max(1e-6, denom)
        if (!locked.has("fot") && q.fot < R.fot.max) {
          fix("fot", Math.max(q.fot, wantFot + 0.005))
          if (rhoOf(g.uLo) >= need) continue
        }
        if (!locked.has("skulder")) {
          fix("skulder", q.skulder - 0.02)
          continue
        }
      } else {
        const wantSk = need / Math.max(1e-6, denom)
        if (!locked.has("skulder") && q.skulder < R.skulder.max) {
          fix("skulder", Math.max(q.skulder, wantSk + 0.005))
          if (rhoOf(g.uLo) >= need) continue
        }
        if (!locked.has("fot")) {
          fix("fot", q.fot - 0.02)
          continue
        }
      }
      break
    }

    // --- bogen: brei nok til å sleppe ledda, smal nok til å gje føter -------
    // Kvar lei har sitt eige vindauga no som breidda er delt i to: platået
    // må nå forbi den fyrste kryssringen pluss skulderbandet, og den ytste
    // ribba må ha minst tretti millimeter fot att utanfor kvelvinga.
    if (q.bogeH > 0.02 && q.bogeBX > 0.005 && q.bogeBY > 0.005) {
      const g = grid()
      const sh = shoulder()
      const rho0 = rhoOf(0)
      // fyrste kryssringen står i heil pitch for odde tal, halv for like
      const wxMin = (q.ribbX % 2 ? g.pitchX : g.pitchX / 2) + sh + 4
      const wyMin = (q.ribbY % 2 ? g.pitchY : g.pitchY / 2) + sh + 4
      const FOOT = 30
      // Foten på den ytste ribba ligg i HJØRNET av planet, og der er planet
      // smalare enn på aksen: X-ribba ved x = axr har berre kordelengda si i
      // Y å setje foten i, ikkje heile breidda. Sig planet, står ho endå
      // lenger ute ved golvet — og då er foten hennar ein flis mellom
      // kvelvinga og plankanten, som ber som ein flis.
      const nP = q.planN
      const chord = (pos: number, Ext: number, Perp: number) =>
        Ext * Math.pow(Math.max(0, Math.pow(rho0, nP) - Math.pow(pos / Perp, nP)), 1 / nP)
      const drag = Math.abs(q.lut) / 2
      const bMinX = wxMin / (g.A * rho0)
      const bMaxX = (Math.min(g.axr, chord(g.byr, g.A, g.B)) - FOOT) / (g.A * rho0)
      const bMinY = wyMin / (g.B * rho0)
      const bMaxY = (Math.min(g.byr, chord(g.axr + drag, g.B, g.A)) - FOOT) / (g.B * rho0)
      if (bMinX > bMaxX || bMinY > bMaxY || bMaxX <= 0.05 || bMaxY <= 0.05) {
        fix("bogeH", 0)
      } else {
        let raised = false
        if (q.bogeBX > bMaxX) fix("bogeBX", bMaxX)
        if (q.bogeBY > bMaxY) fix("bogeBY", bMaxY)
        if (q.bogeBX < bMinX) {
          fix("bogeBX", bMinX)
          raised = true
        }
        if (q.bogeBY < bMinY) {
          fix("bogeBY", bMinY)
          raised = true
        }
        if (raised) {
          // ein smal boge som vart tvinga breiare skal ikkje òg vera ein
          // SPISS: høgda vert halden under to gonger den smalaste breidda
          const awMin = Math.min(q.bogeBX * g.A * rho0, q.bogeBY * g.B * rho0)
          if (q.bogeH * q.hogd > 2 * awMin) fix("bogeH", (2 * awMin) / q.hogd)
        }
      }
      const maxH = (q.hogd - q.sokk - 60) / q.hogd
      if (q.bogeH > maxH) fix("bogeH", Math.max(0, maxH))

      // toppspora møter bogeflanken: sporbotnen må liggje GODT over bogen
      // ved sporet sin indre kant, elles vert bandet over kvelvinga ei øy
      for (let it = 0; it < 8 && q.bogeH > 0.02; it++) {
        const g2 = grid()
        const rho2 = rhoOf(0)
        const aw = q.bogeBY * g2.B * rho2
        if (aw <= 1e-3) break
        const ah2 = q.bogeH * q.hogd
        const m = q.bogeN
        const one = (v: number) => {
          const qq = Math.abs(v) / aw
          return qq >= 1 ? 0 : Math.pow(1 - Math.pow(qq, m), 1 / m)
        }
        const hiEst = q.hogd - q.sokk
        const slotW = q.ribbT + q.pressfit
        let bad = false
        for (let j = 0; j < q.ribbY; j++) {
          const t = Math.abs(-g2.By + (j + 0.5) * g2.pitchY)
          const lo = ah2 * one(t)
          const zEnd = lo + q.lapp * (hiEst - lo)
          const loIn = ah2 * one(Math.max(0, t - slotW / 2 - 2))
          if (loIn > zEnd - 15) {
            bad = true
            break
          }
        }
        if (!bad) break
        if (q.bogeH * 0.85 < 0.06) fix("bogeH", 0)
        else fix("bogeH", q.bogeH * 0.85)
      }
    }
  }

  // --- fresen må ned i sporet (til slutt: ribbT kan ha minka) ---------------
  if (q.fresD > q.ribbT + q.pressfit - 0.05) fix("fresD", q.ribbT + q.pressfit - 0.05)

  return q
}
