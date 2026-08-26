"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react"
import {
  MATERIALS,
  applyDrag,
  type EngineId,
  type Hovuddrag,
  type Material,
  type Metrics,
  type ParamBag,
  type Range,
  type Rule,
  type View,
} from "@/lib/core"
import { ENGINES, getEngine } from "@/lib/engines"
import { BEIS } from "./object-mesh"

/**
 * SANDKASSE — kontrollflata.
 *
 * Same kontrollspråk som parametric.iverfinne.no, med vilje: eit flytande
 * ark nedst med tre tilstandar. Lukka er det éi line — motoren, tre tal og
 * to knappar — og objektet eig heile skjermen.
 *
 * Halvope er hovudflata, og ho er bygd for folk som IKKJE kjenner
 * parameterromma: posane (namngjevne inngangar i rommet) og hovuddraga
 * (dei 3–6 kontrollane som verkeleg formar). Skyvarveggen med alle banda
 * finst framleis, men bak eit medvite «alt»-nivå — han er finstillinga,
 * ikkje fyrsteinntrykket. Tjueein til førtifem skyvarar er ikkje eit
 * grensesnitt; dei er eit arkiv.
 *
 * Det sandkassen legg til språket er tala: dei tre som avgjer om objektet
 * i det heile er eit sitjemøbel står i sjølve lina, alltid, og skiftar
 * farge når ein regel ryk. Ein leikegrind gøymer rekninga; ein reiskap
 * har henne i panna.
 *
 * Ingen tal vert rekna ut her. Alt kjem frå `metrics` og `rules`, som har
 * målt det objektet som faktisk står på skjermen.
 */

/** arket sine tre steg — tilstanden bur i studioen, av di scena treng henne */
export type SheetMode = "lukka" | "halv" | "full"

const VIEWS: readonly { id: View; label: string; hint: string }[] = [
  { id: "flate", label: "flate", hint: "flata objektet nærmar seg, ferdig" },
  { id: "lag", label: "lag", hint: "delane slik dei faktisk er, montert" },
  { id: "kontur", label: "kontur", hint: "dei flate kuttprofilane" },
]

const EXPORTS: readonly { id: "stl" | "dxf" | "svg" | "ark"; label: string; hint: string }[] = [
  { id: "stl", label: "stl", hint: "flata som trekantnett, til rendering og 3D-print" },
  { id: "dxf", label: "dxf", hint: "alle delar som kurver, til fresen" },
  { id: "svg", label: "svg", hint: "konturkart av delane" },
  { id: "ark", label: "ark", hint: "delane nesta på plate" },
]

/** Finértonar til materialprikkane. Fargen er ikkje pynt: han er den eine
 *  skilnaden mellom dei tre ein faktisk kan sjå på eit ferdig møbel. */
const WOOD: Record<Material, string> = {
  bjork: "#e9dcc0",
  bok: "#d9b48d",
  poppel: "#f2ead2",
}

const DASH = "–"
const nn = (v: number, d: number) =>
  Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : DASH
const n0 = (v: number) => nn(v, 0)
const n1 = (v: number) => nn(v, 1)
const n2 = (v: number) => nn(v, 2)

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3)
const snap = (v: number, r: Range) =>
  !Number.isFinite(v) ? r.min : r.int ? Math.round(v) : +v.toFixed(4)
const num = (p: ParamBag, k: string, fallback: number) =>
  typeof p[k] === "number" ? (p[k] as number) : fallback

// same kontrollspråk som parametric: hårliner, piller og to runde knappar
const HAIR: CSSProperties = { borderColor: "var(--rule)" }
const ICON_BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95"
const ICON_BTN_SOLID =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95"

function chipStyle(active: boolean): CSSProperties {
  return active
    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "transparent" }
    : { color: "var(--ink)", borderColor: "var(--rule)" }
}
const CHIP =
  "min-h-[30px] rounded-full border px-3 text-[11px] leading-none tracking-[0.04em] transition active:scale-95 disabled:opacity-30"

/** Ikona er strekar, teikna her i staden for henta frå eit bibliotek:
 *  fire ikon er ikkje verdt ein avhengnad. */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
const IcoShuffle = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="M2 18h2.9a4 4 0 0 0 3.4-1.9l5.4-8.2A4 4 0 0 1 17.1 6H22" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 6h2.9a4 4 0 0 1 3.4 1.9l.5.8" />
    <path d="m14.6 14.5.5.8a4 4 0 0 0 3.4 1.9H22" />
    <path d="m18 14 4 4-4 4" />
  </svg>
)
const IcoAvl = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="M12 21v-8" />
    <path d="M12 13c0-4.2 3.2-7 8-7 0 4.2-3.2 7-8 7Z" />
    <path d="M12 16c0-3.2-2.6-5.2-6-5.2 0 3.2 2.6 5.2 6 5.2Z" />
  </svg>
)
const IcoSliders = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  </svg>
)
const IcoDown = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const IcoUp = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...STROKE}>
    <path d="m18 15-6-6-6 6" />
  </svg>
)
const IcoShare = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...STROKE}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
)

type TableRow = {
  label: string
  value: string
  unit: string
  /** kva reglar som eig talet — id-ane skil seg frå motor til motor */
  rules?: readonly string[]
}

/** Reglane som eig kvart tal, på tvers av dei fire motorane. Same tanke
 *  har ulik id frå motor til motor, og ei rad som berre kjende SKAL sine
 *  ville stå svart medan STRAUM braut seg. */
const R_KUBE = ["kube"]
const R_SIT = ["setehogd", "sitjehogd"]
const R_SETE = ["skal", "setebreidd", "setebaering", "sete"]
const R_FOT = ["bein", "golv", "stotte", "fotboge"]
const R_VELTE = ["velte", "velting"]
const R_MASSE = ["masse"]
const R_DELAR = ["lagtal", "finnetal", "plater", "plate", "platetal", "unike"]
const R_UTN = ["utnytting", "styrke"]
const R_PLATE = ["plateutnytting"]

function tableRows(m: Metrics | null): TableRow[] {
  if (!m) {
    const tom = (label: string, unit: string): TableRow => ({ label, value: DASH, unit })
    return [
      tom("ytre mål", "mm"),
      tom("klaring", "mm"),
      tom("setekant", "mm"),
      tom("sitjehøgd", "mm"),
      tom("sitjeflate", "mm"),
      tom("fotavtrykk", "mm"),
      tom("støtteflate", "cm²"),
      tom("veltevinkel", "°"),
      tom("masse", "kg"),
      tom("delar", "stk"),
      tom("plateutnytting", "%"),
      tom("utnytting", "%"),
    ]
  }
  return [
    { label: "ytre mål", value: `${n1(m.envX)} × ${n1(m.envY)} × ${n1(m.envZ)}`, unit: "mm", rules: R_KUBE },
    { label: "klaring", value: `${n1(m.clearX)} · ${n1(m.clearY)} · ${n1(m.clearZ)}`, unit: "mm", rules: R_KUBE },
    { label: "setekant", value: n0(m.seatZ), unit: "mm" },
    // Setekanten er ikkje der ein sit. På ei skål ligg dei tretti
    // millimeter frå kvarandre, og det er sitjehøgda regelen les.
    { label: "sitjehøgd", value: n0(m.sitZ), unit: "mm", rules: R_SIT },
    { label: "sitjeflate", value: `${n0(m.seatW)} × ${n0(m.seatD)}`, unit: "mm", rules: R_SETE },
    { label: "fotavtrykk", value: `${n0(m.footX)} × ${n0(m.footY)}`, unit: "mm", rules: R_FOT },
    { label: "støtteflate", value: n0(m.footArea / 100), unit: "cm²", rules: R_FOT },
    { label: "veltevinkel", value: n1(m.tipAngle), unit: "°", rules: R_VELTE },
    // ferdig masse, ikkje som kutta: slipemonet ligg att som støv på golvet
    { label: "masse", value: n2(m.mass), unit: "kg", rules: R_MASSE },
    { label: `${m.unitLabel} · delar`, value: `${n0(m.units)} · ${n0(m.parts)}`, unit: "stk", rules: R_DELAR },
    // avfallet på arket: kor stor del av den medgåtte plata som vert delar
    { label: `plateutnytting · ${n0(m.sheets)} pl.`, value: n0(m.sheetUtil * 100), unit: "%", rules: R_PLATE },
    { label: "utnytting", value: n0(m.util * 100), unit: "%", rules: R_UTN },
  ]
}

/** Eitt hovuddrag: primæren gjev posisjonen og talet, fylgjarane går med.
 *  Ingen lås — draget styrer fleire band, og låsane høyrer banda til. */
function DragRow({
  drag,
  ranges,
  params,
  onChange,
}: {
  drag: Hovuddrag
  ranges: Record<string, Range>
  params: ParamBag
  onChange: (p: ParamBag) => void
}) {
  const [pk] = drag.keys[0]
  const r = ranges[pk]
  const value = num(params, pk, r.min)
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className="w-24 shrink-0 text-[10px] uppercase leading-[1.2] tracking-[0.14em]"
        style={{ color: "var(--ink)" }}
      >
        {drag.label}
      </span>
      <input
        type="range"
        className="pslider flex-1"
        min={r.min}
        max={r.max}
        step={r.step}
        value={value}
        aria-label={drag.label}
        onChange={(e) => onChange(applyDrag(drag, Number(e.target.value), params, ranges))}
      />
      <span className="tab w-14 shrink-0 text-right text-[11px]" style={{ color: "var(--ink)" }}>
        {value.toFixed(decimals(r.step)).replace(".", ",")}
        {r.unit && <span className="pl-0.5 opacity-45">{r.unit}</span>}
      </span>
    </div>
  )
}

/** Éin skyvar: etiketten er låsen, prikken seier om han er teken. */
function SliderRow({
  k,
  r,
  value,
  locked,
  onChange,
  onToggleLock,
}: {
  k: string
  r: Range
  value: number
  locked: boolean
  onChange: (k: string, raw: string) => void
  onToggleLock: (k: string) => void
}) {
  return (
    <div
      className="flex items-center gap-3 py-1.5 transition-opacity"
      style={{ opacity: locked ? 0.35 : 1 }}
    >
      <button
        type="button"
        aria-pressed={locked}
        title={locked ? "låst mot terningen — trykk for å låse opp" : "trykk for å låse mot terningen"}
        onClick={() => onToggleLock(k)}
        className="flex w-24 shrink-0 items-center gap-1.5 text-left text-[10px] uppercase leading-[1.2] tracking-[0.14em]"
        style={{ color: "var(--ink)" }}
      >
        <span
          aria-hidden="true"
          className="block h-[5px] w-[5px] shrink-0 rounded-full"
          style={{
            background: locked ? "var(--ink)" : "transparent",
            border: locked ? "none" : "1px solid color-mix(in srgb, var(--ink) 30%, transparent)",
          }}
        />
        <span className="min-w-0 flex-1">{r.label}</span>
      </button>
      <input
        type="range"
        className="pslider flex-1"
        min={r.min}
        max={r.max}
        step={r.step}
        value={value}
        aria-label={locked ? `${r.label}, låst` : r.label}
        onChange={(e) => onChange(k, e.target.value)}
      />
      <span className="tab w-14 shrink-0 text-right text-[11px]" style={{ color: "var(--ink)" }}>
        {value.toFixed(decimals(r.step)).replace(".", ",")}
        {r.unit && <span className="pl-0.5 opacity-45">{r.unit}</span>}
      </span>
    </div>
  )
}


export function ControlsPanel(props: {
  engine: EngineId
  params: ParamBag
  metrics: Metrics | null
  rules: Rule[]
  view: View
  beis: string
  /** flatene som bilete (SVG-tekst), generert automatisk av arbeidaren */
  syn: string | null
  /** terningen låst til den valde modulen (dobbelttrykk på veljaren) */
  engineLock: boolean
  locked: ReadonlySet<string>
  hiDetail: boolean
  isDesktop: boolean
  busy: boolean
  /** arket sitt steg — lyft opp i studioen so scena kan lyfte objektet fri */
  mode: SheetMode
  onMode: (m: SheetMode) => void
  onEngine: (e: EngineId) => void
  onToggleEngineLock: () => void
  onChange: (p: ParamBag) => void
  onView: (v: View) => void
  onBeis: (b: string) => void
  onShuffle: () => void
  /** avlen: same objekt, mindre plate — søket held dei harde reglane */
  onAvl: () => void
  /** kvar avlen står, eller null når ingen går */
  avlGang: { steg: number; total: number } | null
  onReset: () => void
  onToggleLock: (k: string) => void
  onToggleDetail: () => void
  onExport: (kind: "stl" | "dxf" | "svg" | "ark") => void
  onShare: () => void
}): JSX.Element {
  const {
    engine,
    params,
    metrics,
    rules,
    view,
    beis,
    syn,
    engineLock,
    locked,
    hiDetail,
    isDesktop,
    busy,
    mode,
    onMode,
    onEngine,
    onToggleEngineLock,
    onChange,
    onView,
    onBeis,
    onShuffle,
    onAvl,
    avlGang,
    onReset,
    onToggleLock,
    onToggleDetail,
    onExport,
    onShare,
  } = props

  // lukka → halv (posar, hovuddrag, lesemåtar, eksport) → full («alt»)
  const open = mode !== "lukka"

  // Modulveljaren: eitt trykk vil opne menyen, to raske vil låse. Det
  // fyrste trykket VENTAR difor eit lite vindauga (260 ms) på tvillingen
  // sin — kjem han, er det ein lås og ingen meny.
  const [menuOpen, setMenuOpen] = useState(false)
  const tapWait = useRef<number | null>(null)
  const onEngineTap = useCallback(() => {
    if (tapWait.current !== null) {
      window.clearTimeout(tapWait.current)
      tapWait.current = null
      onToggleEngineLock()
      return
    }
    tapWait.current = window.setTimeout(() => {
      tapWait.current = null
      setMenuOpen((o) => !o)
    }, 260)
  }, [onToggleEngineLock])

  // Arket er eit iOS-ark: dra i grepet eller hovudlina, opp for meir og
  // ned for mindre. Fingeren får eit lite gummiband som svar medan han
  // dreg, og slepp han forbi terskelen, byter arket steg.
  const MODES = ["lukka", "halv", "full"] as const
  const stepMode = useCallback(
    (dir: 1 | -1) => {
      onMode(MODES[Math.min(2, Math.max(0, MODES.indexOf(mode) + dir))])
      // MODES er ein konstant
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [mode, onMode],
  )
  const dragging = useRef<{ y0: number; id: number } | null>(null)
  const [pull, setPull] = useState(0)
  const onSheetDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return
    dragging.current = { y0: e.clientY, id: e.pointerId }
  }
  const onSheetMove = (e: React.PointerEvent) => {
    const d = dragging.current
    if (!d || e.pointerId !== d.id) return
    const dy = e.clientY - d.y0
    setPull(Math.max(-26, Math.min(26, dy * 0.3)))
  }
  // eit drag skal ikkje OGSÅ vera eit trykk: kryssa fingeren terskelen,
  // vert klikket som elles ville fylgt svelgt
  const swallowClick = useRef(false)
  const onSheetUp = (e: React.PointerEvent) => {
    const d = dragging.current
    if (!d || e.pointerId !== d.id) return
    dragging.current = null
    setPull(0)
    const dy = e.clientY - d.y0
    swallowClick.current = Math.abs(dy) > 12
    if (dy < -34) stepMode(1)
    else if (dy > 34) stepMode(-1)
  }

  const eng = getEngine(engine)

  // Arket skal alltid opne på toppen — posane er fyrsteinntrykket, ikkje
  // der ein sist var. Same når motoren byter: nytt rom, ny topp.
  const sheetScroll = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    sheetScroll.current?.scrollTo({ top: 0 })
  }, [engine, open])

  const broken = useMemo(() => {
    const hard = new Set<string>()
    const soft = new Set<string>()
    for (const r of rules) if (!r.ok) (r.hard ? hard : soft).add(r.id)
    return { hard, soft }
  }, [rules])
  const failed = useMemo(() => rules.filter((r) => !r.ok), [rules])
  const isHard = (ids: readonly string[]) => ids.some((id) => broken.hard.has(id))
  const isSoft = (ids: readonly string[]) => ids.some((id) => broken.soft.has(id))

  const rows = useMemo(() => tableRows(metrics), [metrics])

  const setParam = useCallback(
    (k: string, raw: string) =>
      onChange({ ...params, [k]: snap(Number(raw), eng.ranges[k]) }),
    [params, onChange, eng],
  )

  // Ein pose er eit hopp, ikkje eit kast: nøyaktig det handdesigna punktet,
  // med materialet ein alt står i — posane eig form, ikkje finér.
  const gotoPose = useCallback(
    (bag: Readonly<Partial<Record<string, number | string>>>) =>
      onChange(
        eng.clamp(
          { ...eng.defaults, ...bag, material: bag.material ?? params.material },
          params,
        ),
      ),
    [eng, params, onChange],
  )

  // Kva pose står ein i? Chipen skal lyse når punktet ER posen — ikkje når
  // det liknar. Materialet tel ikkje med: posane eig form, ikkje finér.
  const atPose = useMemo(() => {
    const same = (target: ParamBag) => eng.keys.every((k) => params[k] === target[k])
    return {
      standard: same(eng.clamp(eng.defaults, eng.defaults)),
      idx: eng.poses.findIndex((p) =>
        same(eng.clamp({ ...eng.defaults, ...p.bag }, eng.defaults)),
      ),
    }
  }, [eng, params])

  /** Dei tre tala som avgjer om det er eit sitjemøbel, i sjølve lina.
   *  Panelet kan lukkast; rekninga kan ikkje. */
  // heiltal i vinkelen: desimalen høyrer tavla til, og på ein smal telefon
  // er han skilnaden på tre tal og to og eit halvt
  const headline: { text: string; ids: readonly string[] }[] = metrics
    ? [
        { text: `${n1(metrics.mass)} kg`, ids: R_MASSE },
        { text: `${n0(metrics.tipAngle)}°`, ids: R_VELTE },
        { text: `${n0(metrics.util * 100)} %`, ids: R_UTN },
      ]
    : []

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <section
        aria-label="kontrollar"
        aria-busy={busy}
        className="pointer-events-auto w-full max-w-md rounded-3xl border"
        style={{
          ...HAIR,
          background: "var(--paper)",
          color: "var(--ink)",
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: dragging.current ? undefined : "transform 180ms ease",
        }}
      >
        {/* dragsona: grepet og hovudlina. Fingeren dreg arket mellom dei
            tre stega; knappane verkar som før av di eit trykk utan drag
            ikkje kryssar terskelen. */}
        <div
          onPointerDown={onSheetDown}
          onPointerMove={onSheetMove}
          onPointerUp={onSheetUp}
          onPointerCancel={onSheetUp}
          onClickCapture={(e) => {
            if (swallowClick.current) {
              swallowClick.current = false
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          style={{ touchAction: "none" }}
        >
          {open && (
            <div className="flex justify-center pt-1.5" aria-hidden="true">
              <div
                className="h-1 w-9 rounded-full"
                style={{ background: "color-mix(in srgb, var(--ink) 22%, transparent)" }}
              />
            </div>
          )}
          {/* hovudlina — motoren, rekninga, terningen og opnaren */}
          <div className="flex items-center gap-1.5 p-2.5">
          {/* Modulveljaren: eitt trykk opnar menyen (etter eit lite
              vindauga), DOBBELTTRYKK låser terningen til den valde
              modulen. Låst står pilla svart med prikk — same språket som
              låsane på skyvarane. */}
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={engineLock ? "typologi — låst, dobbelttrykk låser opp" : "typologi — dobbelttrykk låser"}
              aria-pressed={engineLock}
              aria-expanded={menuOpen}
              onClick={onEngineTap}
              className="flex h-9 items-center gap-1.5 rounded-full border pl-3 pr-2.5 text-[11px] uppercase tracking-[0.18em] transition active:scale-95"
              style={
                engineLock
                  ? { background: "var(--ink)", color: "var(--paper)", borderColor: "transparent" }
                  : { ...HAIR, color: "var(--ink)" }
              }
            >
              {engineLock && (
                <span
                  aria-hidden="true"
                  className="block h-[5px] w-[5px] rounded-full"
                  style={{ background: "var(--paper)" }}
                />
              )}
              {eng.label}
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="lukk menyen"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  // Ni motorar er høgare enn rommet over pilla på ein liten
                  // telefon, og utan tak renn den fyrste ut over toppen av
                  // skjermen. Rommet er IKKJE ein del av høgda: arket under
                  // menyen er om lag like høgt same kor stor skjermen er,
                  // so taket er høgda MINUS det arket — kring 385 px målt,
                  // med litt mon. Rullinga held seg i menyen so ho ikkje
                  // dreg arket med seg.
                  className="absolute bottom-full left-0 z-20 mb-2 max-h-[max(132px,calc(100dvh-400px))] min-w-32 overflow-y-auto overscroll-contain rounded-2xl border p-1"
                  style={{ ...HAIR, background: "var(--paper)" }}
                >
                  {ENGINES.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={engine === e.id}
                      onClick={() => {
                        setMenuOpen(false)
                        onEngine(e.id)
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] uppercase tracking-[0.18em] transition active:scale-[0.98]"
                      style={
                        engine === e.id
                          ? { background: "var(--ink)", color: "var(--paper)" }
                          : { color: "var(--ink)" }
                      }
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="tab min-w-0 flex-1 truncate pl-1.5 text-[11px] tracking-[0.06em]">
            {headline.length === 0 ? (
              <span className="opacity-40">reknar …</span>
            ) : (
              headline.map((h, i) => (
                <span key={h.ids[0]}>
                  {i > 0 && <span className="px-1 opacity-30">·</span>}
                  <span
                    style={{
                      color: isHard(h.ids) ? "var(--warn)" : undefined,
                      opacity: isHard(h.ids) ? 1 : 0.62,
                      textDecoration: isSoft(h.ids) ? "underline dotted" : undefined,
                      textUnderlineOffset: 3,
                    }}
                  >
                    {h.text}
                  </span>
                </span>
              ))
            )}
          </span>

          {/* prikken har fast plass, så lina står i ro medan motoren reknar */}
          <span
            aria-hidden="true"
            className="block h-[5px] w-[5px] shrink-0 rounded-full"
            style={{
              background: "var(--ink)",
              opacity: busy ? 0.8 : 0.12,
              transition: "opacity 200ms ease",
            }}
          />

          <button
            type="button"
            onClick={onAvl}
            disabled={avlGang !== null}
            aria-label="avl — same objekt, mindre plate: søket held dei harde reglane og minimerer materialet gjennom maskina"
            title="avl — tåle mest, bruke minst"
            className={ICON_BTN}
            style={{ ...HAIR, color: "var(--ink)" }}
          >
            {avlGang ? (
              <span className="text-[9px] tabular-nums">{avlGang.steg}</span>
            ) : (
              IcoAvl
            )}
          </button>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="terning — nye tal innanfor grensene, låste skruar står"
            title="terning"
            className={ICON_BTN_SOLID}
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {IcoShuffle}
          </button>
          <button
            type="button"
            onClick={() => onMode(open ? "lukka" : "halv")}
            aria-label={open ? "gøym kontrollane" : "vis kontrollane"}
            aria-expanded={open}
            className={ICON_BTN}
            style={{ ...HAIR, color: "var(--ink)" }}
          >
            {open ? IcoDown : IcoSliders}
          </button>
          </div>
        </div>

        {/* det utvidbare arket */}
        {open && (
          <div
            ref={sheetScroll}
            className="rise max-h-[56vh] overflow-y-auto overscroll-contain px-3 pb-3"
          >
            {/* Posane: namngjevne inngangar i parameterrommet — der ein
                startar, ikkje der ein finstiller. «Standard» er
                referansepunktet sjølv. Dei same punkta jittrar terningen
                kring; her står dei med namn. */}
            {eng.poses.length > 0 && (
              <div className="noscroll -mx-3 overflow-x-auto px-3">
                <div className="flex w-max items-center gap-1.5 py-1">
                  <button
                    type="button"
                    onClick={onReset}
                    aria-pressed={atPose.standard}
                    title="referansepunktet — standardobjektet"
                    className={CHIP}
                    style={chipStyle(atPose.standard)}
                  >
                    standard
                  </button>
                  {eng.poses.map((p, i) => (
                    <button
                      key={p.namn}
                      type="button"
                      onClick={() => gotoPose(p.bag)}
                      aria-pressed={atPose.idx === i}
                      className={CHIP}
                      style={chipStyle(atPose.idx === i)}
                    >
                      {p.namn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hovuddraga: dei få kontrollane som verkeleg formar. Kvart
                drag styrer eitt eller fleire band saman; veggen med alle
                banda står bak «alt». */}
            {eng.hovuddrag.length > 0 && (
              <div className="pb-1">
                {eng.hovuddrag.map((d) => (
                  <DragRow
                    key={d.id}
                    drag={d}
                    ranges={eng.ranges}
                    params={params}
                    onChange={onChange}
                  />
                ))}
              </div>
            )}

            {/* lesemåtane — tre ord held; kva dei tyder ligg i title */}
            <div className="flex flex-wrap items-center gap-1.5 py-1">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  title={v.hint}
                  aria-pressed={view === v.id}
                  onClick={() => onView(v.id)}
                  className={CHIP}
                  style={chipStyle(view === v.id)}
                >
                  {v.label}
                </button>
              ))}
              {isDesktop && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={hiDetail}
                  onClick={onToggleDetail}
                  title="fleire trekantar i flata; tyngre å rekne"
                  className={CHIP + " ml-auto"}
                  style={chipStyle(hiDetail)}
                >
                  fint nett
                </button>
              )}
            </div>

            {/* materialet og beisen i EI rad: fargen ER etiketten, namna
                ligg i title. Beisen sit på plateflatene; kutta står som rå
                finér — kvar motor merkjer sjølv kva som er kva. */}
            <div className="flex flex-wrap items-center gap-1.5 py-1.5">
              {(Object.keys(MATERIALS) as Material[]).map((mk) => (
                <button
                  key={mk}
                  type="button"
                  aria-pressed={params.material === mk}
                  aria-label={`materiale: ${MATERIALS[mk].label}`}
                  title={MATERIALS[mk].label}
                  onClick={() => onChange({ ...params, material: mk })}
                  className="h-6 w-6 rounded-full border transition active:scale-90"
                  style={{
                    backgroundColor: WOOD[mk],
                    borderColor: params.material === mk ? "var(--ink)" : "var(--rule)",
                    boxShadow: params.material === mk ? "0 0 0 1px var(--ink)" : undefined,
                  }}
                />
              ))}
              <span aria-hidden="true" className="mx-1 h-4 w-px" style={{ background: "var(--rule)" }} />
              {BEIS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={beis === b.id}
                  aria-label={`beis: ${b.label}`}
                  title={b.label}
                  onClick={() => onBeis(b.id)}
                  className="h-6 w-6 rounded-full border transition active:scale-90"
                  style={{
                    backgroundColor: b.hex || "#cfc7bb",
                    borderColor: beis === b.id ? "var(--ink)" : "var(--rule)",
                    boxShadow: beis === b.id ? "0 0 0 1px var(--ink)" : undefined,
                  }}
                />
              ))}
            </div>

            {/* reglane som ryk: éi line kvar, grunngjevinga i title. Panelet
                seier KVA som er gale; KVIFOR ligg eit fingertrykk unna. */}
            {failed.length > 0 && (
              <ul className="space-y-1 py-1">
                {failed.map((r) => (
                  <li
                    key={r.id}
                    title={r.why}
                    className="flex items-baseline justify-between gap-3 text-[11px] leading-4"
                    style={{
                      color: r.hard ? "var(--warn)" : undefined,
                      opacity: r.hard ? 1 : 0.65,
                    }}
                  >
                    <span className="tracking-[0.06em]">
                      {r.hard ? "bryt" : "merk"} · {r.label}
                    </span>
                    <span className="tab shrink-0">{r.value}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* flatene, automatisk: kvar del slik han ligg på plata. Det
                ein før måtte laste ned ein SVG for å sjå, står i menyen og
                fylgjer kvar einaste parameterendring. */}
            {syn && (
              <div
                className="my-1.5 overflow-hidden rounded-2xl border p-2"
                style={{ ...HAIR, background: "#ffffff" }}
              >
                {/* Arket ber talet sitt sjølv: kor stor del av den medgåtte
                    plata som vert delar, og kor mange plater det tek. Det
                    er den eine aksen i avfallsrekninga, rett på biletet av
                    henne. */}
                <div className="flex items-baseline justify-between px-1 pb-1 text-[10px]">
                  <span className="uppercase tracking-[0.24em] opacity-35">arket</span>
                  {metrics && (
                    <span
                      className="tab"
                      style={{
                        color: isHard(R_PLATE) ? "var(--warn)" : "var(--ink)",
                        opacity: isHard(R_PLATE) ? 1 : 0.6,
                        textDecoration: isSoft(R_PLATE) ? "underline dotted" : undefined,
                        textUnderlineOffset: 3,
                      }}
                    >
                      {n0(metrics.sheetUtil * 100)} % · {n0(metrics.sheets)}{" "}
                      {metrics.sheets === 1 ? "plate" : "plater"}
                    </span>
                  )}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(syn)}`}
                  alt="alle flatene, slik dei ligg på plata"
                  className="max-h-40 w-full object-contain"
                  style={{ opacity: busy ? 0.5 : 1, transition: "opacity 200ms ease" }}
                />
              </div>
            )}

            {/* eksporten og verktøya i EI rad: fire filformat, attende til
                standard, del lenkja */}
            <div className="flex flex-wrap items-center gap-1.5 py-1">
              {EXPORTS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  title={x.hint}
                  disabled={busy}
                  onClick={() => onExport(x.id)}
                  className={CHIP + " uppercase tracking-[0.1em]"}
                  style={chipStyle(false)}
                >
                  {x.label}
                </button>
              ))}
              {/* «standard»-chipen i poserada er vegen attende; her står
                  berre delinga att */}
              <button
                type="button"
                onClick={onShare}
                aria-label="del — lenkja ber heile objektet"
                title="del — lenkja ber heile objektet"
                className={CHIP + " ml-auto"}
                style={chipStyle(false)}
              >
                {IcoShare}
              </button>
            </div>

            {/* «Alt»-nivået: måltavla og veggen med alle banda. Ordet står
                på knappen med vilje — det som ligg bak er alt, ikkje meir
                av det same. */}
            <button
              type="button"
              aria-expanded={mode === "full"}
              aria-label={mode === "full" ? "gøym måltavla og alle banda" : "alt — måltavla og alle banda"}
              onClick={() => onMode(mode === "full" ? "halv" : "full")}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border py-1.5 opacity-60 transition active:scale-[0.99]"
              style={HAIR}
            >
              <span className="text-[10px] uppercase leading-none tracking-[0.24em]">alt</span>
              {mode === "full" ? IcoUp : IcoDown}
            </button>

            {mode === "full" && (
              <>
            <h3 className="mt-3 pb-0.5 text-[10px] uppercase leading-none tracking-[0.24em] opacity-35">
              måltavla
            </h3>
            <dl
              style={{ opacity: busy ? 0.5 : 1, transition: "opacity 200ms ease" }}
            >
              {rows.map((row) => {
                const hard = row.rules !== undefined && isHard(row.rules)
                const soft = row.rules !== undefined && isSoft(row.rules)
                return (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 py-[2px] text-[11px] leading-4"
                  >
                    <dt className="shrink-0 opacity-50">{row.label}</dt>
                    <dd
                      className="tab truncate text-right"
                      style={{
                        color: hard ? "var(--warn)" : undefined,
                        // eit mjukt brot er eit val og ikkje ein feil: det
                        // skal merkast, men ikkje rope
                        textDecoration: soft ? "underline dotted" : undefined,
                        textDecorationColor: soft
                          ? "color-mix(in srgb, var(--ink) 45%, transparent)"
                          : undefined,
                        textUnderlineOffset: 3,
                      }}
                    >
                      {row.value}
                      <span className="pl-1 opacity-45">{row.unit}</span>
                    </dd>
                  </div>
                )
              })}
            </dl>
              </>
            )}

            {mode === "full" &&
              eng.groups.map((g) => (
                <div key={g.id} className="pt-3">
                  <h3 className="pb-0.5 text-[10px] uppercase leading-none tracking-[0.24em] opacity-35">
                    {g.label}
                  </h3>
                  {g.keys.map((k) => (
                    <SliderRow
                      key={k}
                      k={k}
                      r={eng.ranges[k]}
                      value={num(params, k, eng.ranges[k].min)}
                      locked={locked.has(k)}
                      onChange={setParam}
                      onToggleLock={onToggleLock}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
