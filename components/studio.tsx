"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_PARAMS,
  NUDGE_PARAMS,
  PARAM_RANGES,
  clampParams,
  randomParams,
  seeded,
  type ParamKey,
  type Params,
} from "@/lib/skal/params"
import type { BuildRes, DetailKey, Req, Res, View } from "@/lib/skal/worker"
import type { Metrics } from "@/lib/skal/metrics"
import type { Rule } from "@/lib/skal/rules"
import { Viewer, type LightDir } from "./viewer"
import { ControlsPanel } from "./controls-panel"
import type { NudgeAxis } from "./gesture-params"

/** kor mange piksel to-fingers-rulling må dra for å sveipe eit heilt band */
const NUDGE_RANGE_PX = 420

function useSystemDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => setDark(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return dark
}

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

export function Studio() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [view, setView] = useState<View>("flate")
  const [seed, setSeed] = useState("SKAL")
  const [locked, setLocked] = useState<ReadonlySet<ParamKey>>(new Set())
  const [hiDetail, setHiDetail] = useState(false)
  const [cube, setCube] = useState(true)
  const [light, setLight] = useState<LightDir>({ az: 0.62, el: 0.92 })
  const [data, setData] = useState<BuildRes | null>(null)
  const [busy, setBusy] = useState(true)
  const [mounted, setMounted] = useState(false)
  const dark = useSystemDark()
  const isDesktop = useIsDesktop()

  const worker = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const shown = useRef(0)

  // Hashen er ikkje til å stole på: kvart felt vert lese for seg og klemt
  // inn i sitt eige band av clampParams, så inga laga lenkje kan skyve
  // NaN eller fiendtlege verdiar inn i motoren.
  useEffect(() => {
    setMounted(true)
    try {
      const h = window.location.hash.slice(1)
      if (h.startsWith("p=")) {
        const obj = JSON.parse(decodeURIComponent(h.slice(2)))
        setParams((prev) => clampParams(obj, prev))
        const v = (obj as { view?: string }).view
        if (v === "lag" || v === "kontur" || v === "flate") setView(v)
      }
    } catch {
      // øydelagd hash — la standardobjektet stå
    }
  }, [])

  useEffect(() => {
    // ES-modul-worker: bundlaren treng type-flagget for å gje tråden sin
    // eigen modulgraf. Utan det peikar han på ein chunk som aldri vart skriven.
    const w = new Worker(new URL("../lib/skal/worker.ts", import.meta.url), {
      type: "module",
    })
    worker.current = w
    w.onmessage = (e: MessageEvent<Res>) => {
      const r = e.data
      if (r.kind === "build") {
        // eit svar som er eldre enn det sist viste er alltid forelda:
        // meldingane kjem ikkje nødvendigvis i den rekkjefylgja dei vart sende
        if (r.id < shown.current) return
        shown.current = r.id
        setData(r)
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
  }, [])

  const detail: DetailKey = hiDetail && isDesktop ? "hog" : isDesktop ? "mid" : "lav"

  // Bygginga vert utsett ein knapp ramme: ein skyvar som vert dregen
  // sender elles tjue førespurnader i sekundet, og motoren rekk berre
  // å kaste dei.
  useEffect(() => {
    if (!mounted) return
    setBusy(true)
    const t = window.setTimeout(() => {
      const id = ++reqId.current
      const msg: Req = { kind: "build", id, params, detail, view }
      worker.current?.postMessage(msg)
    }, 90)
    return () => window.clearTimeout(t)
  }, [params, detail, view, mounted])

  // URL-en kodar alltid det objektet som står på skjermen
  useEffect(() => {
    if (!mounted) return
    const t = window.setTimeout(() => {
      window.history.replaceState(
        null,
        "",
        "#p=" + encodeURIComponent(JSON.stringify({ ...params, view })),
      )
    }, 500)
    return () => window.clearTimeout(t)
  }, [params, view, mounted])

  const nudge = useCallback((axis: NudgeAxis, deltaPx: number) => {
    const key = NUDGE_PARAMS[axis]
    const r = PARAM_RANGES[key]
    const frac = deltaPx / NUDGE_RANGE_PX
    setParams((p) => {
      const v = Math.min(r.max, Math.max(r.min, p[key] + frac * (r.max - r.min)))
      return { ...p, [key]: +v.toFixed(4) }
    })
  }, [])

  const nudgeLight = useCallback((dx: number, dy: number) => {
    setLight((l) => ({
      az: l.az + dx * 0.012,
      el: Math.min(1.4, Math.max(0.12, l.el - dy * 0.008)),
    }))
  }, [])

  const shuffle = useCallback(() => {
    setParams((p) => randomParams(seeded(seed + ":" + Date.now()), p, locked))
  }, [seed, locked])

  // Frøet er ikkje ein terning: same tekst gjev alltid same objekt, så
  // «Iver» er eitt bestemt punkt i rommet og kan skrivast ned.
  useEffect(() => {
    if (!mounted || seed === "SKAL") return
    setParams((p) => randomParams(seeded(seed), p, locked))
    // frøet skal berre slå til når teksten endrar seg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const toggleLock = useCallback((k: ParamKey) => {
    setLocked((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }, [])

  const doExport = useCallback(
    (what: "stl" | "dxf" | "svg" | "ark") => {
      setBusy(true)
      const msg: Req = { kind: "export", id: ++reqId.current, params, what }
      worker.current?.postMessage(msg)
    },
    [params],
  )

  const share = useCallback(() => {
    const url = window.location.href
    if (navigator.share) void navigator.share({ url })
    else void navigator.clipboard?.writeText(url)
  }, [])

  const metrics: Metrics | null = data?.metrics ?? null
  const rules: Rule[] = useMemo(() => data?.rules ?? [], [data])

  return (
    <main className="fixed inset-0 overflow-hidden" style={{ background: "var(--paper)" }}>
      <div className="absolute inset-0">
        {mounted && (
          <Viewer
            data={data}
            view={view}
            dark={dark}
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
        params={params}
        metrics={metrics}
        rules={rules}
        stack={null}
        stat={data?.stat ?? null}
        view={view}
        seed={seed}
        locked={locked}
        hiDetail={hiDetail}
        isDesktop={isDesktop}
        busy={busy}
        onChange={setParams}
        onView={setView}
        onSeed={setSeed}
        onShuffle={shuffle}
        onReset={() => setParams(DEFAULT_PARAMS)}
        onToggleLock={toggleLock}
        onToggleDetail={() => setHiDetail((d) => !d)}
        onExport={doExport}
        onShare={share}
      />
    </main>
  )
}
