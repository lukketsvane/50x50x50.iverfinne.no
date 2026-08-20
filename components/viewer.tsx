"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import type { BuildRes } from "@/lib/worker"
import type { View } from "@/lib/core"
import { MM, ObjectMesh } from "./object-mesh"
import { GestureParams, type NudgeAxis } from "./gesture-params"

export type LightDir = { az: number; el: number }

const FIT_MARGIN = 1.35
const GROUND_Y = -0.9
/** Golvlina står i same skjermhøgd same kor stort objektet er:
 *  siktepunktet stig i takt med kameraavstanden, så vinkelen ned mot
 *  golvet er fast. */
const FLOOR_TAN = 0.1637

function FitCamera({
  fit,
  lift,
  reframe,
}: {
  fit: { r: number; cy: number } | null
  lift: number
  /** teljar frå dobbelttrykket: kvart hopp rammar inn på nytt, utansett */
  reframe: number
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update?: () => void }
    | null
  const invalidate = useThree((s) => s.invalidate)
  const lastR = useRef(0)
  const lastReframe = useRef(0)
  useEffect(() => {
    if (!fit || !controls) return
    // Dobbelttrykk: nullstill vaktene so innramminga alltid vert gjord om,
    // og legg kameraet heim i standardvinkelen — trykket TYDER «kom heim».
    const homing = lastReframe.current !== reframe
    if (homing) {
      lastReframe.current = reframe
      lastR.current = 0
    }
    if (lastR.current && Math.abs(fit.r - lastR.current) / lastR.current < 0.1) return
    lastR.current = fit.r
    const persp = camera as THREE.PerspectiveCamera
    const vHalf = ((persp.fov ?? 30) * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * (persp.aspect || 1))
    const dist = Math.min(15, Math.max(3.2, (fit.r * FIT_MARGIN) / Math.tan(Math.min(vHalf, hHalf))))
    // Golvpinninga held golvlina i same skjermhøgd, men berre så lenge
    // ho ikkje kastar sikta over objektet. På eit høgt og smalt lerret
    // vert avstanden stor, og då ville siktepunktet flyge opp i lause
    // lufta med krakken langt nede. Difor eit tak på objektet si eiga
    // midje — og på mobilen eit lite lyft til, av di kontrollina ligg
    // over den nedste kanten.
    const mid = GROUND_Y + fit.cy
    controls.target.set(0, Math.min(GROUND_Y + dist * FLOOR_TAN, mid) - lift * fit.cy, 0)
    const dir = homing
      ? new THREE.Vector3(2.4, 1.7, 6.4)
      : camera.position.clone().sub(controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(2.4, 1.7, 6.4)
    camera.position.copy(controls.target).add(dir.setLength(dist))
    controls.update?.()
    invalidate()
  }, [fit, lift, reframe, controls, camera, invalidate])
  return null
}

export function Viewer({
  data,
  view,
  dark,
  stripePly,
  beis,
  hiDetail,
  mobile,
  light,
  onNudge,
  onLight,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  /** platetjukn for limfugene; 0 slår dei av */
  stripePly: number
  /** beis-hex for plateflatene; tom streng er natur */
  beis: string
  hiDetail: boolean
  mobile: boolean
  light: LightDir
  onNudge: (axis: NudgeAxis, deltaPx: number) => void
  onLight: (dxPx: number, dyPx: number) => void
}) {
  const bg = dark ? "#000000" : "#ffffff"
  const shadow = hiDetail ? 4096 : 2048
  // Éi styrbar hovudlyskjelde på ein fast kuppel, pluss to svake fyll.
  // Ingen omgjevingskart og ingen mjuk kontaktflekk: eit møbel skal kaste
  // éin hard skugge, slik det gjer i eit verkstadlys.
  const lightPos = useMemo<[number, number, number]>(() => {
    const R = 8.6
    const h = R * Math.cos(light.el)
    return [h * Math.cos(light.az), R * Math.sin(light.el), h * Math.sin(light.az)]
  }, [light])
  const [fit, setFit] = useState<{ r: number; cy: number } | null>(null)
  // Stabil identitet heile vegen, elles går scena i sjølvsving: ein
  // onFit-lambda laga på nytt per teikning fyrer ObjectMesh sin effekt på
  // nytt, effekten lagar eit nytt fit-objekt, det nye objektet teiknar
  // Viewer på nytt — og løkkja et heile hovudtråden, for alltid. På ein
  // rask maskin merkast det som varme; på ein telefon som at sida frys.
  // Same verdiar gjev difor same objekt att, og då stoggar React runden.
  const handleFit = useCallback((r: number, cy: number) => {
    setFit((prev) => (prev && prev.r === r && prev.cy === cy ? prev : { r, cy }))
  }, [])
  // dobbelttrykk på lerretet: ramm inn på nytt, heim i standardvinkelen
  const [reframe, setReframe] = useState(0)
  const handleDoubleTap = useCallback(() => setReframe((n) => n + 1), [])

  return (
    <Canvas
      shadows="soft"
      frameloop="demand"
      // aldri over 2: tre gonger skjermtettleik er ni gonger fragmentkost,
      // og på ein 4K-skjerm er skilnaden usynleg på armlengds avstand
      dpr={[1, 2]}
      // Neutral i staden for ACES: ACES dreg metta fargar mot raudbrunt og
      // mørkna heile beisen — Neutral er laga for å halde fargen sann
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.NeutralToneMapping,
      }}
      camera={{ position: [2.4, 2.1, 6.4], fov: 30 }}
      className="touch-none"
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 15, 36]} />

      <directionalLight
        key={shadow}
        position={lightPos}
        intensity={2.3}
        castShadow
        shadow-mapSize={[shadow, shadow]}
        shadow-radius={5}
        shadow-bias={-0.0002}
        shadow-normalBias={0.05}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
      />
      {/* Ikkje noko omgjevnadslys og ikkje noko ambient: fyllet er KORT,
          som i eit ekte studio — kvite flater som kastar retningsbestemt
          lys attende. Golvspretten når opp under bogane; utan han er
          kvar underside beksvart. */}
      <directionalLight position={[-6, 3, -2]} intensity={0.55} />
      <directionalLight position={[6, 2, 1]} intensity={0.4} />
      <directionalLight position={[2, 1.5, 7]} intensity={0.35} />
      <directionalLight position={[0.5, -3, 2]} intensity={0.3} />

      <Suspense fallback={null}>
        <group position={[0, GROUND_Y, 0]}>
          <ObjectMesh
            data={data}
            view={view}
            dark={dark}
            stripePly={stripePly}
            beis={beis}
            onFit={handleFit}
          />
          {!dark && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[60, 60]} />
              <shadowMaterial transparent opacity={0.24} />
            </mesh>
          )}
        </group>
      </Suspense>

      {/* Panelet er no ei lukka line nedst, ikkje eit halvt ark: lyftet
          skal berre sleppe objektet fri frå den lina, ikkje ein tredel av
          skjermen. */}
      <FitCamera fit={fit} lift={mobile ? 0.3 : 0} reframe={reframe} />
      <GestureParams onNudge={onNudge} onLight={onLight} onDoubleTap={handleDoubleTap} />
      <OrbitControls
        target={[0, 0.35, 0]}
        enablePan={false}
        enableZoom
        minDistance={2.4}
        maxDistance={16}
        rotateSpeed={0.9}
        // demping: rotasjonen glid til ro i staden for å stogge daudt.
        // change-hendinga held demand-løkkja i live til dempinga konvergerer,
        // so det kostar berre bilete medan noko faktisk rører seg.
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 + 0.3}
        makeDefault
      />
    </Canvas>
  )
}
