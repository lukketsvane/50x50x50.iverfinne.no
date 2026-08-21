/**
 * FLETT — reparasjonskaskaden.
 *
 * Terningen får kaste kva han vil. Men i denne typologien er nesten ingen
 * av dei viktige tala eit skyvartrykk: bøyeradien fylgjer av delinga,
 * delinga fylgjer av bandtalet og opninga, sigen fylgjer av tverrsnittet
 * og spennet, og trykket i ramma fylgjer av sigen. Ein fri trekning landar
 * difor nesten alltid utanfor — ikkje av di banda er dårleg valde, men av
 * di dei er BUNDNE til kvarandre.
 *
 * Kaskaden gjer det bindinga krev, i tre steg:
 *
 *   1  REKNESTYKKE   daudsonene, festet sitt gods, ryggen sin rette
 *                    bakkant. Reint aritmetiske, ingen geometri.
 *   2  VEVEN         delinga vert LØYST for den bandtjukna kastet valde,
 *                    i staden for å prøvast fram. Bøyekravet gjev ei
 *                    minste deling, delinga gjev bandtalet, bandtalet gjev
 *                    bandbreidda. Dette er kjernen: utan det slåst
 *                    bøyeregelen og sitjeflateregelen om det same talet og
 *                    brukar opp heile lykkja på det.
 *   3  MÅLT LYKKJE   byggjer veven, les den verkelege kurvaturen og den
 *                    verkelege sigen, og rettar det som står att. Kvar
 *                    gong tjukna, opninga eller flottlengda vert rørt,
 *                    vert steg 2 køyrt om att på dei nye tala.
 *
 * Kvart grep gjer objektet MINDRE ekstremt, aldri meir. Lykkja er
 * avgrensa: eit kast som ikkje let seg berge, får stå som det er og verta
 * raudt på skjermen — det er ærlegare enn å tvinge det.
 */
import {
  armToHull,
  capacities,
  hull,
  hullArea,
  poseBag,
  randomBag,
  type Material,
  type ParamBag,
} from "../core"
import { footprint, krefter, legSection, seatMean } from "./metrics"
import { SIG_MAX, SIG_MIN, SPRIK_MAX } from "./rules"
import { floats, makeWeave, type Weave } from "./weave"
import {
  DEFAULT_PARAMS,
  PARAM_KEYS,
  PARAM_RANGES,
  POSES,
  type Params,
} from "./params"

const DEG = Math.PI / 180
const LIM = 492
const LIM_Z = 494
/** dei to trygge sidene av fingerfella på 5–25 mm */
const TETT = 3.5
const OPE = 28
/**
 * Kor mykje meir enn det reine bøyekravet delinga skal ha. Krona et
 * resten: krumminga frå flata og krumminga frå flettinga legg seg saman,
 * so 1/R = 1/(MON·k·t) + 1/R_flate, og skal summen halde k·t, må flata ha
 * radius minst k·t·MON/(MON−1). Med MON = 2,4 er det 1,7 gonger kravet —
 * nok til ei ekte bule, og ikkje so mykje at veven vert eit grovt gitter.
 */
const MON = 2.4

/**
 * Ei øvre grense for omhyllinga, rekna av delane og ikkje av nettet.
 * Ho må vera KONSERVATIV: ei grense som er for snau let eit objekt gå
 * gjennom kaskaden og so falle på kuberegelen når nettet vert bygt.
 */
function envOf(w: Weave): { x: number; y: number; z: number; boge: boolean } {
  const p = w.p
  // X vert ført som to tal og ikkje som eitt: ryggbogen stikk ut BERRE
  // bakover, og ein symmetrisk konvolutt ville telje det spranget to
  // gonger. Ei grense som er dobbelt so streng som ho treng, gjer at
  // kaskaden skjer i ramma når det er ryggen som er for lang.
  let x1 = w.a + p.rammeH + p.renT
  let x0 = -x1
  let Y = w.b + p.rammeH + p.innT
  let Z = w.zRim(w.a + p.rammeH) + w.rimOff

  const fp = footprint(w)
  const rot = Math.min(p.rammeH * 1.7, Math.max(p.beinB * 1.35, p.beinB + 24))
  for (const leg of w.legs) {
    const r0 = w.innR(leg.th) + p.rammeH / 2
    const dR = Math.tan(p.spreie * DEG) * Math.max(0, fp.zTop0)
    const ct = Math.abs(Math.cos(leg.th))
    const st = Math.abs(Math.sin(leg.th))
    // Beinet er breiast ØVERST og står lengst ute NEDERST, so den ytste
    // radien er korkje i toppen eller i foten — han ligg ein stad imellom,
    // der spreiinga har flytta senteret og bogeforma enno ikkje har teke
    // breidda. Difor vert høgda skanna og ikkje prøvd i to punkt.
    for (let q = 0; q <= 12; q++) {
      const t = q / 12
      const hw =
        p.beinB / 2 +
        ((rot - p.beinB) / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, p.bogeN)), 1 / p.bogeN)
      const r = r0 + dR * t + hw
      const dx = r * ct + (p.rammeT / 2) * st
      if (dx > x1) { x1 = dx; x0 = -dx }
      Y = Math.max(Y, r * st + (p.rammeT / 2) * ct)
    }
  }
  let boge = false
  if (p.ryggH >= 30) {
    const topp = w.backAt(w.hVev + w.wBow / Math.max(0.35, Math.cos(w.vLean)), 0)
    const bak = topp[0] - p.rammeT
    if (bak < x0) { x0 = bak; boge = true }
    Z = Math.max(Z, topp[2] + p.rammeT)
  }
  return { x: x1 - x0, y: 2 * Y, z: Z, boge }
}

/** grovt masseoverslag utan å byggje nettet — ramma er nesten alt godset */
function grovMasse(w: Weave, p: Params): number {
  const ringA = Math.PI * (w.a + w.b) * 0.5 * p.rammeH * 2
  const bein = w.legs.length * p.beinB * 1.35 * Math.max(0, w.zRim(0) + w.rimOff)
  return ((ringA + bein) * p.rammeT * 720) / 1e9
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(
    rnd,
    prev as unknown as ParamBag,
    POSES as unknown as readonly Partial<Record<string, number | string>>[],
    DEFAULT_PARAMS as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    locked,
    // Veven er skjør kring delinga: eit stort jitter på bandtalet flyttar
    // bøyeradien meir enn nokon annan skyvar, so jitteret er varsamt.
    0.03,
  ) as unknown as Params | null
  const q =
    posed ??
    (randomBag(
      rnd,
      prev as unknown as ParamBag,
      PARAM_RANGES,
      PARAM_KEYS,
      locked,
    ) as unknown as Params)
  return fiks(q, locked)
}

export function fiks(q: Params, locked: ReadonlySet<string>): Params {
  const rec = q as unknown as Record<string, number | string>
  const fix = (k: keyof Params, v: number): boolean => {
    if (locked.has(k as string)) return false
    if (!Number.isFinite(v)) return false
    const r = PARAM_RANGES[k as string]
    const c = Math.min(r.max, Math.max(r.min, r.int ? Math.round(v) : +v.toFixed(3)))
    if (Math.abs((rec[k as string] as number) - c) < 1e-6) return false
    rec[k as string] = c
    return true
  }
  const free = (k: keyof Params) => !locked.has(k as string)

  // =========================================================================
  // STEG 1 — reine reknestykke
  // =========================================================================
  // Ein ryggboge under tretti millimeter er ikkje ein boge, han er ei
  // leppe: det finst ikkje gods til eit bandfeste i han. Kastet må velje
  // side — anten krakk, eller boge med noko å feste i.
  if (q.ryggH > 0 && q.ryggH < 30) fix("ryggH", q.ryggH < 16 ? 0 : 34)

  const klatrar = () => {
    const wB = Math.min(90, Math.max(30, q.ryggH * (1 - q.ryggDekk)))
    return q.ryggH >= 30 && q.ryggH - wB >= 40
  }
  // Klatrar veven, må bakkanten vera rett: eit rakt band kan ikkje
  // leggjast langs ei kurve i sitt eige plan.
  if (klatrar() && q.bakflat < 0.55) fix("bakflat", 0.62)

  const godsFix = () => {
    const tB = Math.max(q.renT, q.innT)
    if (q.feste === 1) {
      // Omslaget bøyer bandet kring ramma sin ytterkant, og den radien er
      // HALVE rammetjukna. Kravet er seks gonger bandtjukna på radien,
      // altso tolv gonger på tjukna — og over 2,3 mm band finst det inga
      // ramme som er tjukk nok. Då er omslaget ikkje eit val.
      if (q.rammeT < 12 * tB) {
        if (free("rammeT") && 12 * tB <= PARAM_RANGES.rammeT.max) fix("rammeT", 12 * tB)
        else fix("feste", 0)
      }
    }
    if (q.feste !== 1 && q.kant > q.rammeH - 12.4) {
      if (q.rammeH - 12.5 >= PARAM_RANGES.kant.min) fix("kant", q.rammeH - 12.5)
      else fix("rammeH", q.kant + 12.5)
    }
  }
  godsFix()

  // =========================================================================
  // STEG 2 — veven vert LØYST, ikkje prøvd fram
  // =========================================================================
  /**
   * Bøyekravet gjev ei minste DELING. Utleiinga står i regelen: bandet
   * fylgjer ei bylgje med amplitude t/2 og bylgjelengd 2·flott·deling, so
   *
   *     R = 2·flott²·deling² / (π²·t)   ≥   MON · bøyetal · t
   *
   * som løyst for delinga er
   *
   *     deling ≥ (π·t / flott) · √(MON · bøyetal / 2)
   *
   * Resten er rekning: opninga og delinga gjev bandtalet, bandtalet og
   * lufta gjev bandbreidda. MON er mon for KRONA — flata si eiga krumming
   * legg seg til flettinga si, og utan mon ville kvar einaste bule i setet
   * gjere veven ubyggjeleg.
   */
  const vevFix = (Linn: number): boolean => {
    const fl = floats(q.flott, q.skift)
    // Renninga bøyer seg kring INNSLAGET, so det er innslagsdelinga som
    // avgjer radien hennar — og motsett. Difor har kvar retning sitt eige
    // krav, og dei to er ikkje like når skiftet bryt flotta på tvers.
    const base = Math.PI * Math.sqrt(q.renT * q.innT) * Math.sqrt((MON * q.boygtal) / 2)
    let rørt = false
    const one = (
      L: number,
      nK: "renN" | "innN",
      wK: "renW" | "innW",
      fK: "renFall" | "innFall",
    ) => {
      const pReq = base / (nK === "innN" ? fl.renning : fl.innslag)
      const wR = PARAM_RANGES[wK]
      const nR = PARAM_RANGES[nK]
      const n0 = Math.max(3, Math.round(q[nK]))
      const w0 = q[wK]
      const g0 = (L - n0 * w0) / (n0 + 1)
      // Vidopent flett et 2·28 mm av sitjeflata i luft. Toler ikkje
      // opninga det, er det tette flettet einaste sida av fella som
      // framleis gjev eit sete.
      const g = g0 >= 20 && L - 2 * OPE >= 328 ? OPE : TETT
      const pNow = (L + w0) / (n0 + 1)
      let n = n0
      let bw = w0
      if (pNow < pReq * 0.999 || Math.abs(g0 - g) > 0.6) {
        const p = Math.max(pReq, g + wR.min)
        // GOLV og ikkje avrunding: delinga er (L − luft)/n, so eitt band
        // for mykje gjer henne mindre enn kravet — og eit einaste band for
        // mykje er nok til at heile veven bryt bøyeregelen.
        n = Math.min(nR.max, Math.max(3, Math.floor((L - g) / p)))
        bw = (L - (n + 1) * g) / n
        if (bw > wR.max) {
          n = Math.min(nR.max, Math.max(3, Math.ceil((L - g) / (wR.max + g))))
          bw = (L - (n + 1) * g) / n
        }
        if (bw < wR.min) {
          n = Math.max(3, Math.floor((L - g) / (wR.min + g)))
          bw = (L - (n + 1) * g) / n
        }
        bw = Math.min(wR.max, Math.max(wR.min, bw))
      }
      if (fix(nK, n)) rørt = true
      if (fix(wK, bw)) rørt = true
      if (g < 20 && fix(fK, 0)) rørt = true
      // Er delinga framleis for knapp etter at bandtalet har botna på tre,
      // er det opninga som er for lita for den tjukna — og då må bandet bli
      // tynnare. Kravet og delinga går begge med tjukna, so forholdet
      // mellom dei er DET som må rettast, ikkje det eine talet.
      const pEnd = (L + q[wK]) / (Math.max(3, Math.round(q[nK])) + 1)
      if (pEnd < pReq * 0.97) {
        // Kravet går med produktet av dei to tjuknene, so eit felles
        // nedslag på kvadratrota av forholdet treffer nett.
        const skal = Math.max(0.45, Math.pow(pEnd / pReq, 2))
        if (fix("renT", q.renT * skal)) rørt = true
        if (fix("innT", q.innT * skal)) rørt = true
      }
    }
    one(q.breidd, "renN", "renW", "renFall")
    one(Linn, "innN", "innW", "innFall")
    return rørt
  }
  vevFix(q.djup)

  // =========================================================================
  // STEG 3 — den målte lykkja
  // =========================================================================
  for (let pass = 0; pass < 60; pass++) {
    godsFix()
    let w: Weave
    try {
      w = makeWeave(q)
    } catch {
      break
    }
    if (vevFix(w.sSeat)) continue
    const p = q
    const kr = krefter(p, w)
    const cap = capacities(p.material as Material)
    const sec = legSection(w)
    const fp = footprint(w)
    const hl = hull(fp.feet)
    const sitZ = seatMean(w) - kr.sig
    const e = envOf(w)
    const tB = Math.max(p.renT, p.innT)
    const utilBand = kr.sigmaBand / cap.capM
    const utilRamme = kr.sigmaRimC / cap.capC + kr.sigmaRimM / cap.capM
    const utilBein = 1600 / sec.area / cap.capC
    const tipArm = Math.max(0, armToHull(hl, 0, 0))
    const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI
    const rom = LIM - Math.max(e.x, e.y)
    const romH = p.rammeH + rom / 2
    let rørt = false
    const T = (b: boolean) => {
      if (b) rørt = true
      return b
    }

    // --- kuben et fyrst -----------------------------------------------------
    // Ramma legg breidda si utanpå opninga heile vegen rundt, og beina
    // spriker vidare enn ramma. Difor betaler spreiinga fyrst — ho er den
    // einaste av dei som ikkje er noko anna òg — so rammebreidda, so
    // fotbreidda, og opninga sist: ho er sjølve setet.
    if (rom < 0) {
      const d = -rom + 1
      // Er det RYGGEN som stikk ut bakover, er det ryggen som må vike:
      // fyrst bukta, so leninga, so høgda. Å skjere i ramma for ein rygg
      // som er for lang, ville gjere møbelet dårlegare på begge vis.
      if (e.boge && e.x > LIM) {
        if (p.ryggB > 1 && free("ryggB")) T(fix("ryggB", Math.max(0, p.ryggB - d)))
        else if (p.ryggV > 2 && free("ryggV")) T(fix("ryggV", p.ryggV - 3))
        else if (free("ryggH")) T(fix("ryggH", p.ryggH - d < 30 ? 0 : p.ryggH - d))
        if (rørt) continue
      }
      if (p.spreie > 0 && free("spreie")) {
        const ned = (d / (1.42 * Math.max(60, fp.zTop0))) * (180 / Math.PI)
        T(fix("spreie", Math.max(0, p.spreie - Math.max(1, ned))))
      } else if (p.rammeH > PARAM_RANGES.rammeH.min && free("rammeH")) {
        T(fix("rammeH", p.rammeH - d / 2))
      } else if (p.beinB > PARAM_RANGES.beinB.min && free("beinB")) {
        T(fix("beinB", p.beinB - d * 1.42))
      } else {
        if (e.x > LIM) T(fix("djup", p.djup - (e.x - LIM) - 1))
        if (e.y > LIM) T(fix("breidd", p.breidd - (e.y - LIM) - 1))
      }
      if (rørt) continue
    }
    if (e.z > LIM_Z) {
      const over = e.z - LIM_Z + 1
      if (p.ryggH >= 30 && free("ryggH")) {
        T(fix("ryggH", p.ryggH - over < 30 ? 0 : p.ryggH - over))
      } else {
        T(fix("hogd", p.hogd - over))
      }
      if (rørt) continue
    }

    // --- knekken over bakkanten ---------------------------------------------
    // Veven klatrar berre om ramma er brei nok til at bandet kan svinge
    // kring bakkanten hennar. Er ho ikkje det, er det ryggen som må vike:
    // ein rygg som knekk banda er ikkje ein rygg.
    if (w.hVev > 0 && w.Rk < 6 * tB) {
      const vil = (6 * tB) / 0.45
      if (vil <= romH && vil <= PARAM_RANGES.rammeH.max && free("rammeH")) {
        T(fix("rammeH", vil))
      } else if (free("ryggH")) {
        T(fix("ryggH", 0))
      }
      if (rørt) continue
    }

    // --- flettverket må finnast --------------------------------------------
    if (w.warp.length < 4 || w.weft.length < 4) {
      // Eit spisst plan gjer ytterbanda so korte at dei fell ut. Ei meir
      // rektangulær superellipse gjev dei kryss att.
      if (p.planN < 6 && free("planN")) T(fix("planN", p.planN + 1))
      else if (w.warp.length < 4 && free("renN")) T(fix("renN", p.renN + 1))
      else if (w.weft.length < 4 && free("innN")) T(fix("innN", p.innN + 1))
      if (rørt) continue
    }

    // --- ramma: sprik og utnytting ------------------------------------------
    // Ein kutta ring tek bandstrekket i BØYING, og både spriket og
    // spenninga går med rammebreidda i høg potens: spriket i tredje (I =
    // t·h³/12), spenninga i andre (W = t·h²/6). Difor vert den naudsynte
    // breidda rekna ut i eitt steg.
    //
    // FØRESPENNET kjem fyrst når det er han som ber krafta. Eit band som
    // er spent til 0,15 % tøying dreg åtte MPa før nokon har sett seg, og
    // den krafta står der heile døgeret — ho er dyrare for ramma enn lasta
    // sjølv. Difor er han den fyrste spaken og ikkje den siste.
    if (kr.sprik > SPRIK_MAX || utilRamme > 0.9) {
      const eps0E = p.spenn * 0.0015 * w.E
      const fS = kr.sprik > SPRIK_MAX ? Math.cbrt((kr.sprik * 1.2) / SPRIK_MAX) : 1
      const fU = utilRamme > 0.9 ? Math.sqrt(utilRamme / 0.78) : 1
      const vil = p.rammeH * Math.max(fS, fU)
      if (eps0E > 0.35 * kr.sigmaBand && p.spenn > 0.03 && free("spenn")) {
        T(fix("spenn", p.spenn * 0.4))
      } else if (vil <= romH && p.rammeH < PARAM_RANGES.rammeH.max && free("rammeH")) {
        T(fix("rammeH", Math.max(p.rammeH + 3, vil)))
      } else if (p.rammetype !== 0 && free("rammetype")) {
        T(fix("rammetype", 0))
      } else if (p.rammeT < PARAM_RANGES.rammeT.max && free("rammeT")) {
        T(fix("rammeT", p.rammeT * Math.min(1.6, Math.max(fS, fU))))
      } else if (p.spenn > 0.02 && free("spenn")) {
        T(fix("spenn", p.spenn * 0.4))
      }
      if (rørt) continue
    }
    if (utilBein > 0.9) {
      if (p.beinB < PARAM_RANGES.beinB.max && free("beinB")) {
        T(fix("beinB", p.beinB * Math.min(1.8, utilBein / 0.7)))
      } else if (p.rammeT < PARAM_RANGES.rammeT.max && free("rammeT")) {
        T(fix("rammeT", p.rammeT * 1.3))
      }
      if (rørt) continue
    }

    // --- strekket i bandet --------------------------------------------------
    // σ = ε0·E + 8E·δ²/3L², og δ fell med samla tverrsnitt opphøgd i ein
    // tredel. Difor er σ_dyn ∝ A^(−2/3), og den tjukna som trengst kan
    // reknast rett ut. Tjukna dreg delinga med seg, so steg 2 køyrer om att
    // med det same.
    if (utilBand > 0.9) {
      const eps0E = p.spenn * 0.0015 * w.E
      const mal = 0.76 * cap.capM
      if (eps0E > 0.4 * mal && p.spenn > 0.02 && free("spenn")) {
        T(fix("spenn", p.spenn * 0.45))
      } else {
        const dyn = Math.max(0.05, kr.sigmaBand - eps0E)
        const malDyn = Math.max(0.05, mal - Math.min(eps0E, 0.6 * mal))
        const f = Math.min(2.2, Math.pow(dyn / malDyn, 1.5))
        if (tB < PARAM_RANGES.renT.max - 0.05) {
          T(fix("renT", p.renT * f))
          T(fix("innT", p.innT * f))
        } else if (p.spenn > 0.01 && free("spenn")) {
          T(fix("spenn", p.spenn * 0.5))
        }
      }
      if (rørt) continue
    }

    // --- BØYERADIUS ---------------------------------------------------------
    // Steg 2 har alt gjeve delinga mon nok til sjølve flettinga. Står det
    // likevel att eit avvik, er det FLATA SI EIGA KRUMMING som et det —
    // kantfallet, krona og ryggbukta. Dei vert dregne ned ein tredel om
    // gongen, aldri heilt til null: eit flatt sete er ikkje eit betre sete.
    if (kr.rmin < kr.rKrav * 1.03) {
      const trong = (kr.rKrav * 1.05) / Math.max(1, kr.rmin)
      // Krumminga er lineær i kvart av desse tala, so eit kutt på nett
      // `trong` treffer i eitt steg. Ei halvering ville skyte forbi og
      // gjere flata flatare enn regelen bad om — og det er flata som er
      // møbelet.
      const kutt = (v: number) => Math.max(v / trong, v * 0.4)
      if (p.ryggB > 1 && w.hVev > 0 && free("ryggB")) T(fix("ryggB", kutt(p.ryggB)))
      else if (p.vulst > 1.5 && free("vulst")) T(fix("vulst", kutt(p.vulst)))
      else if (p.kroneTvers > 3 && free("kroneTvers")) T(fix("kroneTvers", kutt(p.kroneTvers)))
      else if (Math.abs(p.kroneLangs) > 3 && free("kroneLangs"))
        T(fix("kroneLangs", Math.sign(p.kroneLangs) * kutt(Math.abs(p.kroneLangs))))
      else if (p.boygtal > PARAM_RANGES.boygtal.min && free("boygtal")) {
        // Siste utveg, og ein ærleg ein: eit lågare bøyetal er eit MJUKARE
        // band — færre og tynnare finérsjikt — og ikkje ein slakkare regel.
        T(fix("boygtal", p.boygtal / trong))
      }
      if (rørt) continue
    }

    // --- sigen --------------------------------------------------------------
    if (kr.sig > SIG_MAX) {
      if (p.spenn < 0.92 && free("spenn")) T(fix("spenn", p.spenn + 0.25))
      else {
        T(fix("renT", p.renT * 1.3))
        T(fix("innT", p.innT * 1.3))
      }
      if (rørt) continue
    }
    if (kr.sig < SIG_MIN) {
      // For lite sig tyder at veven er ei plate: anten er han spent
      // stivare enn han treng, eller banda er for tjukke for spennet.
      if (p.spenn > 0.02 && free("spenn")) T(fix("spenn", p.spenn * 0.4))
      else {
        T(fix("renT", p.renT * 0.8))
        T(fix("innT", p.innT * 0.8))
      }
      if (rørt) continue
    }

    // --- sitjehøgda ---------------------------------------------------------
    if (sitZ < 384) {
      T(fix("hogd", p.hogd + (384 - sitZ) + 1))
      if (rørt) continue
    }
    if (sitZ > 476) {
      T(fix("hogd", p.hogd - (sitZ - 476) - 1))
      if (rørt) continue
    }

    // --- velting ------------------------------------------------------------
    if (tipAngle < 12.8 && rom > 4) {
      if (p.spreie < PARAM_RANGES.spreie.max && free("spreie")) T(fix("spreie", p.spreie + 3))
      else if (p.beinB < PARAM_RANGES.beinB.max && free("beinB")) T(fix("beinB", p.beinB + 16))
      if (rørt) continue
    }

    // --- dei mjuke ----------------------------------------------------------
    if (hullArea(hl) < 94000 && rom > 8) {
      if (p.spreie < PARAM_RANGES.spreie.max && free("spreie")) T(fix("spreie", p.spreie + 2.5))
      else if (p.beinB < PARAM_RANGES.beinB.max && free("beinB")) T(fix("beinB", p.beinB + 12))
      if (rørt) continue
    }
    {
      // Sitjeflata er opninga MINUS dei to ytterste lukene. Med tett flett
      // er dei to lukene sju millimeter til saman, so ei opning på 331
      // held; med vidope flett et dei femtiseks, og då har steg 2 alt valt
      // tett om opninga ikkje toler det.
      const seatW = w.ys.length ? w.ys[w.ys.length - 1] - w.ys[0] + p.renW : 0
      const seteS = w.stasjonar.filter((z) => !z.bak)
      const seatD = seteS.length ? seteS[seteS.length - 1].s - seteS[0].s + p.innW : 0
      // Rommet er PER AKSE. Eit møbel kan stå heilt ut mot kuben på tvers
      // og ha femti millimeter att fram og attende, og då skal setedjupna
      // få veksa sjølv om breidda ikkje kan.
      const romX = LIM - e.x
      const romY = LIM - e.y
      if (seatW < 324 && free("breidd")) {
        if (romY > 6) T(fix("breidd", p.breidd + Math.min(romY - 2, 324 - seatW + 4)))
        else if (p.rammeH > PARAM_RANGES.rammeH.min && free("rammeH")) {
          // Ramma er berre eit feste; setet er sjølve møbelet. Er kuben
          // full, er det rammebreidda som skal gje frå seg plassen.
          T(fix("rammeH", p.rammeH - 6))
        }
      } else if (seatD < 324 && free("djup")) {
        if (romX > 6) T(fix("djup", p.djup + Math.min(romX - 2, 324 - seatD + 4)))
        else if (p.rammeH > PARAM_RANGES.rammeH.min && free("rammeH")) {
          T(fix("rammeH", p.rammeH - 6))
        }
      }
      if (rørt) continue
    }
    if (grovMasse(w, p) > 11.5) {
      if (p.rammeT > PARAM_RANGES.rammeT.min && free("rammeT")) {
        T(fix("rammeT", p.rammeT * 0.85))
      } else if (p.rammeH > PARAM_RANGES.rammeH.min && free("rammeH")) {
        T(fix("rammeH", p.rammeH * 0.88))
      }
      if (rørt) continue
    }

    if (!rørt) break
  }

  // Konvolutten kan ha krympa opninga, og opninga er sjølve arma både
  // festet og delinga bur i. Difor vert reknestykka køyrde ein gong til
  // på det som faktisk står att.
  godsFix()
  return q
}
