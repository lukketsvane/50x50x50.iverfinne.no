"use client"

import { useCallback, useMemo, useRef, useState, type JSX, type PointerEvent } from "react"
import {
  CUBE,
  GROUPS,
  MATERIALS,
  PARAM_RANGES,
  type Material,
  type ParamKey,
  type Params,
  type Range,
} from "@/lib/skal/params"
import type { Metrics } from "@/lib/skal/metrics"
import type { Rule } from "@/lib/skal/rules"
import type { Stack } from "@/lib/skal/laminae"

/**
 * SANDKASSE — kontrollflata.
 *
 * Panelet er ikkje eit skjema. Det er tabellen som står ved sida av
 * objektet, og skruane ligg under han: ein les fyrst kva ein fekk, og
 * skrur etterpå. Difor står måltavla alltid open og skyvarane alltid bak
 * ein utvidar, og ikkje omvendt.
 *
 * Ingen tal vert rekna ut her. Alt kjem frå `metrics` og `rules`, som har
 * målt det objektet som faktisk står på skjermen. Skulle panelet rekna
 * sjølv, ville tabellen og teikninga kunne kome i utakt — og då er heile
 * poenget med sandkassen borte.
 */

export type View = "flate" | "lag" | "kontur"

/** Dei tre lesemåtane. Same objekt, tre måtar å sjå det på — ikkje tre
 *  innstillingar, difor står dei øvst og ikkje inne i ein meny. */
const VIEWS: readonly { id: View; label: string; hint: string }[] = [
  { id: "flate", label: "flate", hint: "ytterflata slik ho står ferdig slipt" },
  { id: "lag", label: "lag", hint: "kvart finérlag som eigen kropp" },
  { id: "kontur", label: "kontur", hint: "lagkantane sedde rett ovanfrå" },
]

const EXPORTS: readonly { id: "stl" | "dxf" | "svg" | "ark"; label: string; hint: string }[] = [
  { id: "stl", label: "stl", hint: "flata som trekantnett, til rendering og 3D-print" },
  { id: "dxf", label: "dxf", hint: "alle delar som kurver, til fresen" },
  { id: "svg", label: "svg", hint: "konturkart av heile stabelen" },
  { id: "ark", label: "kuttark", hint: "delane nesta på plate" },
]

const DASH = "–"

const n0 = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : DASH)
const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : DASH)
const n2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : DASH)

/** Kor mange desimalar eit band fortener: steget seier det alt. */
const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3)

/** Skyvaren snappar sjølv til steget; dette kuttar berre bort flyttalsgruset. */
const snap = (v: number, r: Range) =>
  !Number.isFinite(v) ? r.min : r.int ? Math.round(v) : +v.toFixed(4)

/**
 * Params har berre talfelt utanom `material`, og ParamKey utelukkar nettopp
 * det feltet — indekseringa er difor trygg, men typane kjem ikkje fram til
 * det utan denne omvegen. Same grep som `setNum` i params.ts.
 */
function withParam(p: Params, k: ParamKey, v: number): Params {
  const next: Params = { ...p }
  ;(next as unknown as Record<ParamKey, number>)[k] = v
  return next
}

type Row = {
  label: string
  value: string
  unit: string
  /** kva regel som eig talet; bryt han, seier tavla frå her og ikkje berre nede i lista */
  rule?: string
}

/**
 * Måltavla. Rekkjefylgja er ikkje tilfeldig: fyrst det oppgåva spør om
 * (kuben), så det kroppen spør om (setet), så det golvet spør om (foten),
 * og til sist det verkstaden spør om (lag, delar, masse, utnytting).
 */
/** dei fire tala som avgjer om objektet i det heile er eit sitjemøbel */
const MOBILE_ROWS = new Set(["ytre mål", "setehøgd", "veltevinkel", "masse"])

function tableRows(m: Metrics | null, layers: number, parts: number): Row[] {
  if (!m) {
    const tom = (label: string, unit: string, rule?: string): Row => ({
      label,
      value: DASH,
      unit,
      rule,
    })
    return [
      tom("ytre mål", "mm", "kube"),
      tom("klaring", "mm", "kube"),
      tom("setehøgd", "mm", "setehogd"),
      tom("brukbar skål", "mm", "skal"),
      tom("skåldjupn", "mm", "skaldjupn"),
      tom("fotavtrykk", "mm", "bein"),
      tom("støtteflate", "cm²", "bein"),
      tom("veltevinkel", "°", "velte"),
      tom("masse", "kg"),
      tom("lag · delar", "stk", "lagtal"),
      tom("utnytting", "%", "utnytting"),
    ]
  }
  return [
    {
      label: "ytre mål",
      value: `${n1(m.envX)} × ${n1(m.envY)} × ${n1(m.envZ)}`,
      unit: "mm",
      rule: "kube",
    },
    {
      label: "klaring",
      value: `${n1(m.clearX)} · ${n1(m.clearY)} · ${n1(m.clearZ)}`,
      unit: "mm",
      rule: "kube",
    },
    { label: "setehøgd", value: n0(m.seatZ), unit: "mm", rule: "setehogd" },
    { label: "brukbar skål", value: `${n0(m.dishW)} × ${n0(m.dishD)}`, unit: "mm", rule: "skal" },
    { label: "skåldjupn", value: n1(m.dishDepth), unit: "mm", rule: "skaldjupn" },
    { label: "fotavtrykk", value: `${n0(m.footX)} × ${n0(m.footY)}`, unit: "mm", rule: "bein" },
    { label: "støtteflate", value: n0(m.footArea / 100), unit: "cm²", rule: "bein" },
    { label: "veltevinkel", value: n1(m.tipAngle), unit: "°", rule: "velte" },
    // ferdig masse, ikkje som kutta: slipemonet ligg att som støv på golvet
    { label: "masse", value: n2(m.mass), unit: "kg" },
    { label: "lag · delar", value: `${n0(layers)} · ${n0(parts)}`, unit: "stk", rule: "lagtal" },
    { label: "utnytting", value: n0(m.util * 100), unit: "%", rule: "utnytting" },
  ]
}

export function ControlsPanel(props: {
  params: Params
  metrics: Metrics | null
  rules: Rule[]
  stack: Stack | null
  /** same tala som stabelen, når studioet berre har fått samandraget frå tråden */
  stat?: { layers: number; parts: number; area: number; mass: number } | null
  view: View
  seed: string
  locked: ReadonlySet<ParamKey>
  hiDetail: boolean
  isDesktop: boolean
  busy: boolean
  onChange: (p: Params) => void
  onView: (v: View) => void
  onSeed: (s: string) => void
  onShuffle: () => void
  onReset: () => void
  onToggleLock: (k: ParamKey) => void
  onToggleDetail: () => void
  onExport: (kind: "stl" | "dxf" | "svg" | "ark") => void
  onShare: () => void
}): JSX.Element {
  const {
    params,
    metrics,
    rules,
    stack,
    stat,
    view,
    seed,
    locked,
    hiDetail,
    isDesktop,
    busy,
    onChange,
    onView,
    onSeed,
    onShuffle,
    onReset,
    onToggleLock,
    onToggleDetail,
    onExport,
    onShare,
  } = props

  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<{ y: number; live: boolean }>({ y: 0, live: false })
  const from = useRef<number | null>(null)
  const dragY = useRef(0)
  const moved = useRef(false)

  // Ein broten regel skal farge tabellrada si, ikkje berre stå i lista
  // nedanfor: det er talet ein les, og det er talet som er gale.
  const broken = useMemo(() => {
    const hard = new Set<string>()
    const soft = new Set<string>()
    for (const r of rules) if (!r.ok) (r.hard ? hard : soft).add(r.id)
    return { hard, soft }
  }, [rules])

  const failed = useMemo(() => rules.filter((r) => !r.ok), [rules])

  const layers = stack?.count ?? stat?.layers ?? metrics?.layers ?? NaN
  const parts = stack?.parts ?? stat?.parts ?? metrics?.parts ?? NaN
  const allRows = useMemo(() => tableRows(metrics, layers, parts), [metrics, layers, parts])
  // På mobilen tek arket halve skjermen om heile tavla står open, og då er
  // det objektet som forsvinn — som er det einaste ein eigentleg er her for
  // å sjå. Samanlagt viser vi difor berre dei tala som kan gjere ein
  // parameter ugyldig; resten kjem opp saman med skyvarane.
  const rowsOut = useMemo(
    () =>
      isDesktop || open
        ? allRows
        : allRows.filter((r) => MOBILE_ROWS.has(r.label)),
    [allRows, isDesktop, open],
  )

  const setParam = useCallback(
    (k: ParamKey, raw: string) => onChange(withParam(params, k, snap(Number(raw), PARAM_RANGES[k]))),
    [params, onChange],
  )

  // Arket nedst på mobilen. Draget og klikket deler same knapp, så eit drag
  // må hugsast: elles slår klikket som fylgjer etter fingeren utvidaren
  // tilbake med det same.
  const gripDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    from.current = e.clientY
    moved.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const gripMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (from.current === null) return
      const dy = e.clientY - from.current
      if (Math.abs(dy) > 6) moved.current = true
      // opp er berre eit knapt kikk når arket alt er nede, og omvendt:
      // gesten skal seie kva veg han går, ikkje flytte panelet ut av syne
      const y = open ? Math.min(200, Math.max(-24, dy)) : Math.max(-72, Math.min(24, dy))
      dragY.current = y
      setDrag({ y, live: true })
    },
    [open],
  )

  const gripUp = useCallback(() => {
    if (from.current === null) return
    from.current = null
    // avgjerda vert lesen av ein ref og ikkje inne i ein set-oppdaterar:
    // ei tilstandsendring skal ikkje liggja gøymd i utrekninga av ei anna
    const y = dragY.current
    dragY.current = 0
    setDrag({ y: 0, live: false })
    if (y < -28) setOpen(true)
    else if (y > 48) setOpen(false)
  }, [])

  const btn =
    "shrink-0 rounded-none px-1.5 py-1 text-[11px] leading-none tracking-[0.06em] transition-opacity disabled:cursor-default"

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <section
        aria-label="kontrollar for sandkassen"
        aria-busy={busy}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col border-t px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1 backdrop-blur-md lg:inset-x-auto lg:bottom-5 lg:left-5 lg:max-h-[calc(100svh-8rem)] lg:w-[21.5rem] lg:border lg:pb-3 lg:pt-3"
        style={{
          color: "var(--ink)",
          borderColor: "var(--rule)",
          background: "color-mix(in srgb, var(--paper) 86%, transparent)",
          transform: drag.y ? `translateY(${drag.y}px)` : undefined,
          transition: drag.live ? "none" : "transform 180ms ease",
        }}
      >
        {/* Grepet i arket. Berre på mobil — på desktop ligg panelet stille. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="sandkasse-skruar"
          onPointerDown={gripDown}
          onPointerMove={gripMove}
          onPointerUp={gripUp}
          onPointerCancel={gripUp}
          onClick={() => {
            if (moved.current) {
              moved.current = false
              return
            }
            setOpen((o) => !o)
          }}
          className="mx-auto mb-1 flex h-6 w-24 shrink-0 items-center justify-center lg:hidden"
          style={{ touchAction: "none" }}
        >
          <span className="sr-only">dra arket opp eller ned</span>
          <span
            aria-hidden="true"
            className="block h-px w-9"
            style={{ background: "color-mix(in srgb, var(--ink) 45%, transparent)" }}
          />
        </button>

        {/* --- dei tre lesemåtane -------------------------------------- */}
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-3" role="group" aria-label="lesemåte">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                title={v.hint}
                aria-pressed={view === v.id}
                onClick={() => onView(v.id)}
                className="text-[12px] leading-none tracking-[0.14em] transition-opacity"
                style={{
                  opacity: view === v.id ? 1 : 0.38,
                  borderBottom:
                    view === v.id ? "1px solid var(--ink)" : "1px solid transparent",
                  paddingBottom: 3,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          {/* Prikken har alltid same plass, så tavla står i ro medan motoren reknar. */}
          <span
            aria-hidden="true"
            className="block h-[5px] w-[5px] rounded-full"
            style={{
              background: "var(--ink)",
              opacity: busy ? 0.85 : 0.14,
              transition: "opacity 200ms ease",
            }}
          />
        </div>

        {/* --- måltavla ------------------------------------------------- */}
        <h2 className="mt-3 shrink-0 text-[10px] uppercase leading-none tracking-[0.24em] opacity-40">
          mål · {CUBE}-kuben
        </h2>
        <dl
          className="mt-2 shrink-0"
          style={{ opacity: busy ? 0.5 : 1, transition: "opacity 200ms ease" }}
        >
          {rowsOut.map((row) => {
            const hard = row.rule !== undefined && broken.hard.has(row.rule)
            const soft = row.rule !== undefined && broken.soft.has(row.rule)
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
                    // eit mjukt brot er eit val og ikkje ein feil: det skal
                    // merkast, men ikkje rope
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

        {/* --- reglane som ikkje er oppfylte ---------------------------- */}
        {failed.length > 0 && (
          <ul
            className="mt-3 shrink-0 space-y-2 border-t pt-3"
            style={{ borderColor: "var(--rule)" }}
          >
            {failed.map((r) => (
              <li key={r.id}>
                <div
                  className="flex items-baseline justify-between gap-3 text-[11px] leading-4"
                  style={{ color: r.hard ? "var(--warn)" : undefined }}
                >
                  <span className="tracking-[0.06em]">
                    <span className="opacity-60">{r.hard ? "bryt" : "merk"} · </span>
                    {r.label}
                  </span>
                  <span className="tab shrink-0 opacity-80">{r.value}</span>
                </div>
                <p className="mt-[3px] text-[10px] leading-[1.5] opacity-50">{r.why}</p>
              </li>
            ))}
          </ul>
        )}

        {/* --- utvidaren ------------------------------------------------ */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="sandkasse-skruar"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex shrink-0 items-baseline justify-between gap-3 border-t pt-3 text-[10px] uppercase leading-none tracking-[0.24em] transition-opacity"
          style={{ borderColor: "var(--rule)", opacity: open ? 0.8 : 0.45 }}
        >
          <span>skruane</span>
          <span className="tab tracking-normal normal-case">
            {locked.size > 0 && (
              <span className="pr-2 opacity-70">
                {locked.size} {locked.size === 1 ? "låst" : "låste"}
              </span>
            )}
            {open ? "lukk" : "opne"}
          </span>
        </button>

        {open && (
          <div
            id="sandkasse-skruar"
            className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1"
          >
            {GROUPS.map((g) => (
              <div key={g.id} className="mb-4">
                <h3 className="mb-2 text-[10px] uppercase leading-none tracking-[0.24em] opacity-35">
                  {g.label}
                </h3>
                {g.keys.map((k) => {
                  const r = PARAM_RANGES[k]
                  const isLocked = locked.has(k)
                  return (
                    <div key={k} className="mb-2">
                      <div className="flex items-baseline justify-between gap-3">
                        {/* Etiketten er låsen. Ein parameter ein er nøgd med skal
                            kunne stå i ro medan terningen kastar resten. */}
                        <button
                          type="button"
                          aria-pressed={isLocked}
                          title={isLocked ? "lås opp mot terningen" : "lås mot terningen"}
                          onClick={() => onToggleLock(k)}
                          className="flex items-baseline gap-1 text-[11px] leading-4 tracking-[0.04em] transition-opacity"
                          style={{ opacity: isLocked ? 0.95 : 0.5 }}
                        >
                          <span
                            aria-hidden="true"
                            className="block h-[5px] w-[5px] shrink-0 translate-y-[-1px]"
                            style={{
                              background: isLocked ? "var(--ink)" : "transparent",
                              border: isLocked
                                ? "none"
                                : "1px solid color-mix(in srgb, var(--ink) 26%, transparent)",
                            }}
                          />
                          {r.label}
                        </button>
                        <span
                          className="tab shrink-0 text-[11px] leading-4"
                          style={{ opacity: isLocked ? 0.55 : 0.85 }}
                        >
                          {params[k].toFixed(decimals(r.step))}
                          <span className="pl-1 opacity-45">{r.unit ?? ""}</span>
                        </span>
                      </div>
                      <input
                        type="range"
                        className={isLocked ? "pslider locked mt-[6px]" : "pslider mt-[6px]"}
                        min={r.min}
                        max={r.max}
                        step={r.step}
                        value={params[k]}
                        aria-label={isLocked ? `${r.label}, låst` : r.label}
                        onChange={(e) => setParam(k, e.target.value)}
                      />
                    </div>
                  )
                })}
                {/* Materialet høyrer til bygget, men er ikkje eit tal og kan
                    difor ikkje vera ein skyvar — det er masse og fastleik. */}
                {g.id === "bygg" && (
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="text-[11px] leading-4 tracking-[0.04em] opacity-50">
                      materiale
                    </span>
                    <span className="flex items-baseline gap-3">
                      {(Object.keys(MATERIALS) as Material[]).map((mk) => (
                        <button
                          key={mk}
                          type="button"
                          aria-pressed={params.material === mk}
                          onClick={() => onChange({ ...params, material: mk })}
                          className="text-[11px] leading-4 transition-opacity"
                          style={{ opacity: params.material === mk ? 1 : 0.35 }}
                        >
                          {MATERIALS[mk].label}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* --- frøet og terningen --------------------------------------- */}
        <div
          className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: "var(--rule)" }}
        >
          <label className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.24em] opacity-40">frø</span>
            <input
              type="text"
              value={seed}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onSeed(e.target.value)}
              className="tab w-full min-w-0 border-b bg-transparent pb-[2px] text-[11px] leading-4 tracking-[0.08em] outline-none focus-visible:opacity-100"
              style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
            />
          </label>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onShuffle}
              title="nye tal innanfor grensene; låste skruar står"
              className={btn + " opacity-80 hover:opacity-100"}
            >
              terning
            </button>
            <button
              type="button"
              onClick={onReset}
              title="tilbake til SKAL, objektet i mappa"
              className={btn + " opacity-50 hover:opacity-100"}
            >
              nullstill
            </button>
            <button
              type="button"
              onClick={onShare}
              title="lenkja ber heile objektet i hashen"
              className={btn + " opacity-50 hover:opacity-100"}
            >
              del
            </button>
          </div>
        </div>

        {/* --- eksport -------------------------------------------------- */}
        <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3" role="group" aria-label="eksport">
            {EXPORTS.map((x) => (
              <button
                key={x.id}
                type="button"
                title={x.hint}
                disabled={busy}
                onClick={() => onExport(x.id)}
                className={btn + " uppercase tracking-[0.14em]"}
                style={{ opacity: busy ? 0.25 : 0.6 }}
              >
                {x.label}
              </button>
            ))}
          </div>
          {isDesktop && (
            <button
              type="button"
              aria-pressed={hiDetail}
              onClick={onToggleDetail}
              title="fleire trekantar i flata; tyngre å rekne"
              className={btn}
              style={{ opacity: hiDetail ? 0.9 : 0.4 }}
            >
              fin
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
