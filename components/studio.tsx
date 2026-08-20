"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ENGINES, getEngine, isEngineId } from "@/lib/engines"
import type { EngineId, Metrics, ParamBag, Rule, View } from "@/lib/core"
import { seeded } from "@/lib/core"
import type { BuildRes, DetailKey, MaalRes, Req, Res } from "@/lib/worker"
import { Viewer, type LightDir } from "./viewer"
import { BEIS } from "./object-mesh"
import { ControlsPanel } from "./controls-panel"
import type { NudgeAxis } from "./gesture-params"

/** kor mange piksel to-fingers-rulling må dra for å sveipe eit heilt band */
const NUDGE_RANGE_PX = 420

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (min-width: 1024px)")
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return desktop
}

type Bags = Record<string, ParamBag>
type Locks = Record<string, ReadonlySet<string>>

const initialBags = (): Bags =>
  Object.fromEntries(ENGINES.map((e) => [e.id, { ...e.defaults }]))
const initialLocks = (): Locks =>
  Object.fromEntries(ENGINES.map((e) => [e.id, new Set<string>()]))

export function Studio() {
  // Kvar motor held på sitt eige punkt. Byter du frå SKAL til STRAUM og
  // attende, står SKAL-objektet der du forlét det — eit tal i eitt
  // parameterrom tyder ikkje noko i eit anna, så det finst ingen fornuftig
  // måte å ta med seg eit design over ei motorgrense på.
  const [engine, setEngine] = useState<EngineId>("skal")
  const [bags, setBags] = useState<Bags>(initialBags)
  const [locks, setLocks] = useState<Locks>(initialLocks)
  // «lag» fyrst: delane slik dei faktisk er, montert — det er dei som ER
  // objektet, og det er dei som skil typologiane frå kvarandre. Den slipte
  // flata er eit klikk unna.
  const [view, setView] = useState<View>("lag")
  const [seed, setSeed] = useState("")
  // beis er ferdig handsaming, som lakk: han bur i visinga og hashen, aldri
  // i parameterrommet — masse og styrke bryr seg ikkje om farge
  const [beis, setBeis] = useState("natur")
  const [hiDetail, setHiDetail] = useState(false)
  // kuben er kontrollen, ikkje scena — han skal hentast fram, ikkje bort
  const [cube, setCube] = useState(false)
  const [light, setLight] = useState<LightDir>({ az: 0.62, el: 0.92 })
  const [data, setData] = useState<BuildRes | null>(null)
  // Måltala kjem i eiga melding etter nettet, og berre for det siste
  // punktet: under eit drag står den førre tavla dimma til fingeren
  // stoggar, i staden for at kvart einaste mellombilete vert rekna på.
  const [tal, setTal] = useState<MaalRes | null>(null)
  const [busy, setBusy] = useState(true)
  const [mounted, setMounted] = useState(false)
  // svart, alltid — sjå globals.css
  const dark = true
  const isDesktop = useIsDesktop()

  const eng = getEngine(engine)
  const params = bags[engine] ?? eng.defaults
  const locked = locks[engine] ?? new Set<string>()

  const worker = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const shown = useRef(0)
  // Siste-vinn-porten: aldri meir enn eitt bygg i lufta. Ein skyvar som
  // vert dregen lagar punkt fortare enn motoren byggjer dei, og utan port
  // stiller kvart einaste mellombilete seg i kø i arbeidaren — som so
  // byggjer nett ingen kjem til å sjå. Med porten vert eit uteståande
  // punkt berre BYTT UT til bygget i lufta er ferdig, og draget går i
  // nøyaktig den takta maskina faktisk klarar.
  const inFlight = useRef(false)
  const pending = useRef<Req | null>(null)
  const pump = useCallback(() => {
    if (inFlight.current || !pending.current) return
    inFlight.current = true
    worker.current?.postMessage(pending.current)
    pending.current = null
  }, [])

  // Hashen er ikkje til å stole på: kvart felt vert lese for seg og klemt inn
  // i sitt eige band av motoren sin eigen clamp, så inga laga lenkje kan
  // skyve NaN eller framande verdiar inn i geometrien.
  useEffect(() => {
    setMounted(true)
    try {
      const h = window.location.hash.slice(1)
      if (!h.startsWith("p=")) return
      const obj = JSON.parse(decodeURIComponent(h.slice(2))) as Record<string, unknown>
      const id = isEngineId(obj.engine) ? obj.engine : "skal"
      const e = getEngine(id)
      setEngine(id)
      setBags((b) => ({ ...b, [id]: e.clamp(obj, b[id] ?? e.defaults) }))
      const v = obj.view
      if (v === "lag" || v === "kontur" || v === "flate") setView(v)
      if (typeof obj.beis === "string" && BEIS.some((b) => b.id === obj.beis)) {
        setBeis(obj.beis)
      }
    } catch {
      // øydelagd hash — lat standardobjektet stå
    }
  }, [])

  useEffect(() => {
    const w = new Worker(new URL("../lib/worker.ts", import.meta.url), {
      type: "module",
    })
    worker.current = w
    w.onmessage = (e: MessageEvent<Res>) => {
      const r = e.data
      if (r.kind === "build") {
        // porten opnar att, og eit venta punkt får gå
        inFlight.current = false
        pump()
        // Eit svar som er eldre enn det sist viste er alltid forelda:
        // meldingane kjem ikkje nødvendigvis i den rekkjefylgja dei vart sende.
        if (r.id < shown.current) return
        shown.current = r.id
        setData(r)
        return
      }
      if (r.kind === "maal") {
        setTal(r)
        // fyrst når rekninga for det siste punktet er inne, er motoren ferdig
        if (r.id >= reqId.current) setBusy(false)
        return
      }
      if (r.kind === "feil") {
        // bygget kasta: slepp porten fri og lat det førre objektet stå
        inFlight.current = false
        pump()
        if (r.id >= reqId.current) setBusy(false)
        return
      }
      const blob = r.text
        ? new Blob([r.text], { type: r.mime })
        : new Blob([r.data as ArrayBuffer], { type: r.mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = r.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setBusy(false)
    }
    return () => {
      w.terminate()
      worker.current = null
    }
    // pump er stabil (useCallback utan avhengnader)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detail: DetailKey = hiDetail && isDesktop ? "hog" : isDesktop ? "mid" : "lav"

  // To steg: eit grovt nett med det same, det fine når fingeren stoggar.
  // Under eit drag er det grove alt ein rekk å sjå, og det fine ville berre
  // stå i kø og gjere alt tregare. Vert punktet endra før det fine steget
  // fyrer, vert det avlyst av oppryddinga — det er heile logikken.
  useEffect(() => {
    if (!mounted) return
    setBusy(true)
    const enqueue = (d: DetailKey) => {
      const id = ++reqId.current
      pending.current = { kind: "build", id, engine, params, detail: d, view }
      pump()
    }
    const t1 = window.setTimeout(() => enqueue("lav"), 40)
    const t2 =
      detail !== "lav" ? window.setTimeout(() => enqueue(detail), 420) : null
    return () => {
      window.clearTimeout(t1)
      if (t2 !== null) window.clearTimeout(t2)
    }
  }, [engine, params, detail, view, mounted, pump])

  // URL-en kodar alltid det objektet som står på skjermen
  useEffect(() => {
    if (!mounted) return
    const t = window.setTimeout(() => {
      window.history.replaceState(
        null,
        "",
        "#p=" +
          encodeURIComponent(
            JSON.stringify(
              beis === "natur"
                ? { engine, ...params, view }
                : { engine, ...params, view, beis },
            ),
          ),
      )
    }, 500)
    return () => window.clearTimeout(t)
  }, [engine, params, view, beis, mounted])

  const setParams = useCallback(
    (p: ParamBag) => setBags((b) => ({ ...b, [engine]: p })),
    [engine],
  )

  const nudge = useCallback(
    (axis: NudgeAxis, deltaPx: number) => {
      const key = eng.nudge[axis]
      const r = eng.ranges[key]
      if (!r) return
      const frac = deltaPx / NUDGE_RANGE_PX
      setBags((b) => {
        const cur = b[engine] ?? eng.defaults
        const at = typeof cur[key] === "number" ? (cur[key] as number) : r.min
        const v = Math.min(r.max, Math.max(r.min, at + frac * (r.max - r.min)))
        return { ...b, [engine]: { ...cur, [key]: +v.toFixed(4) } }
      })
    },
    [engine, eng],
  )

  const nudgeLight = useCallback((dx: number, dy: number) => {
    setLight((l) => ({
      az: l.az + dx * 0.012,
      el: Math.min(1.4, Math.max(0.12, l.el - dy * 0.008)),
    }))
  }, [])

  // Terningen kryssar aldri ei motorgrense.
  const shuffle = useCallback(() => {
    setBags((b) => ({
      ...b,
      [engine]: eng.random(
        seeded(engine + ":" + seed + ":" + Date.now()),
        b[engine] ?? eng.defaults,
        locks[engine] ?? new Set<string>(),
      ),
    }))
  }, [engine, eng, seed, locks])

  // Frøet er ikkje ein terning: same tekst gjev alltid same objekt, så «Iver»
  // er eitt bestemt punkt i rommet og kan skrivast ned.
  useEffect(() => {
    if (!mounted || !seed) return
    setBags((b) => ({
      ...b,
      [engine]: eng.random(
        seeded(engine + ":" + seed),
        b[engine] ?? eng.defaults,
        locks[engine] ?? new Set<string>(),
      ),
    }))
    // frøet skal berre slå til når teksten eller motoren endrar seg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, engine])

  const toggleLock = useCallback(
    (k: string) => {
      setLocks((L) => {
        const cur = new Set(L[engine] ?? [])
        if (cur.has(k)) cur.delete(k)
        else cur.add(k)
        return { ...L, [engine]: cur }
      })
    },
    [engine],
  )

  const doExport = useCallback(
    (what: "stl" | "dxf" | "svg" | "ark") => {
      setBusy(true)
      // utanom porten: eit klikk, ikkje ein straum — og svaret slepp porten fri
      const msg: Req = { kind: "export", id: ++reqId.current, engine, params, what }
      worker.current?.postMessage(msg)
    },
    [engine, params],
  )

  const share = useCallback(() => {
    const url = window.location.href
    if (navigator.share) void navigator.share({ url })
    else void navigator.clipboard?.writeText(url)
  }, [])

  // Eit svar frå ein annan motor enn den som står på er forelda uansett kor
  // nytt det er: byter ein motor midt i ei bygging, skal ikkje det gamle
  // objektet bli ståande på scena med den nye tabellen ved sida av.
  const live = data && data.engine === engine ? data : null
  // Limfugene i visaren gjeld typologien der laga ER vassrette: SKAL sitt
  // «lag» er høgda delt på plata. For dei tre andre ligg platene kvar sin
  // veg per del, og ei global z-stripe ville lyge om materialet.
  const stripe =
    eng.unitLabel === "lag" && typeof params.plyT === "number" ? params.plyT : 0
  // Beisen gjeld ALLE typologiane: kvar motor merkjer sjølv kva som er
  // plateflate og kva som er kutt, so fargen sit rett same kva veg
  // platene ligg.
  const beisHex = BEIS.find((b) => b.id === beis)?.hex ?? ""
  const liveTal = tal && tal.engine === engine ? tal : null
  const metrics: Metrics | null = liveTal?.metrics ?? null
  const rules: Rule[] = useMemo(() => liveTal?.rules ?? [], [liveTal])

  return (
    <main className="fixed inset-0 overflow-hidden" style={{ background: "var(--paper)" }}>
      <div className="absolute inset-0">
        {mounted && (
          <Viewer
            data={live}
            view={view}
            dark={dark}
            stripePly={stripe}
            beis={beisHex}
            hiDetail={hiDetail && isDesktop}
            mobile={!isDesktop}
            cube={cube}
            light={light}
            onNudge={nudge}
            onLight={nudgeLight}
          />
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="text-[11px] leading-4" style={{ color: "var(--ink)" }}>
          <div className="tracking-[0.22em]">SANDKASSE</div>
          <div className="opacity-55">50 × 50 × 50 · sitjemøbel</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCube((c) => !c)}
            className="pointer-events-auto text-[11px] tracking-wide opacity-60 hover:opacity-100"
            style={{ color: "var(--ink)" }}
          >
            {cube ? "skjul kuben" : "vis kuben"}
          </button>
          <a
            href="https://iverfinne.no"
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto text-[11px] tracking-wide opacity-60 hover:opacity-100"
            style={{ color: "var(--ink)" }}
          >
            iverfinne.no
          </a>
        </div>
      </header>

      <ControlsPanel
        engine={engine}
        params={params}
        metrics={metrics}
        rules={rules}
        view={view}
        seed={seed}
        beis={beis}
        locked={locked}
        hiDetail={hiDetail}
        isDesktop={isDesktop}
        busy={busy}
        onEngine={setEngine}
        onChange={setParams}
        onView={setView}
        onSeed={setSeed}
        onBeis={setBeis}
        onShuffle={shuffle}
        onReset={() => setParams({ ...eng.defaults })}
        onToggleLock={toggleLock}
        onToggleDetail={() => setHiDetail((d) => !d)}
        onExport={doExport}
        onShare={share}
      />
    </main>
  )
}
