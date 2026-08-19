"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import type { BuildRes, View } from "@/lib/skal/worker"
import { MM, SkalMesh } from "./skal-mesh"
import { GestureParams, type NudgeAxis } from "./gesture-params"

export type LightDir = { az: number; el: number }

const FIT_MARGIN = 1.35
const GROUND_Y = -0.9
/** Golvlina står i same skjermhøgd same kor stort objektet er: målet
 *  stig i takt med kameraavstanden, så vinkelen ned mot golvet er fast. */
const FLOOR_TAN = 0.1637

function FitCamera({
  fit,
  lift,
}: {
  fit: { r: number; cy: number } | null
  lift: number
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update?: () => void }
    | null
  const invalidate = useThree((s) => s.invalidate)
  const lastR = useRef(0)
  useEffect(() => {
    if (!fit || !controls) return
    if (lastR.current && Math.abs(fit.r - lastR.current) / lastR.current < 0.1) return
    lastR.current = fit.r
    const persp = camera as THREE.PerspectiveCamera
    const vHalf = ((persp.fov ?? 30) * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * (persp.aspect || 1))
    const dist = Math.min(15, Math.max(3.2, (fit.r * FIT_MARGIN) / Math.tan(Math.min(vHalf, hHalf))))
    // Golvpinninga held golvlina i same skjermhøgd, men berre så lenge
    // ho ikkje kastar sikta over objektet. På eit høgt og smalt lerret
    // vert avstanden stor, og då ville målet flyge opp i lause lufta med
    // krakken langt nede. Difor eit tak på objektet si eiga midje — og
    // på mobilen eit lyft til, av di panelet et den nedste tredelen.
    const mid = GROUND_Y + fit.cy
    controls.target.set(0, Math.min(GROUND_Y + dist * FLOOR_TAN, mid) - lift * fit.cy, 0)
    const dir = camera.position.clone().sub(controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(2.4, 1.7, 6.4)
    camera.position.copy(controls.target).add(dir.setLength(dist))
    controls.update?.()
    invalidate()
  }, [fit, lift, controls, camera, invalidate])
  return null
}

/** Kuben oppgåva gjev: 500 mm på kvar kant, teikna som tolv strekar. */
function CubeCage({ show, dark }: { show: boolean; dark: boolean }) {
  const geo = useMemo(() => {
    const s = 500 * MM
    const g = new THREE.BoxGeometry(s, s, s)
    return new THREE.EdgesGeometry(g)
  }, [])
  if (!show) return null
  return (
    <lineSegments geometry={geo} position={[0, (250 * MM), 0]}>
      <lineBasicMaterial
        color={dark ? "#ffffff" : "#000000"}
        transparent
        opacity={0.16}
      />
    </lineSegments>
  )
}

export function Viewer({
  data,
  view,
  dark,
  hiDetail,
  mobile,
  cube,
  light,
  onNudge,
  onLight,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  hiDetail: boolean
  mobile: boolean
  cube: boolean
  light: LightDir
  onNudge: (axis: NudgeAxis, deltaPx: number) => void
  onLight: (dxPx: number, dyPx: number) => void
}) {
  const bg = dark ? "#0a0a0a" : "#ffffff"
  const shadow = hiDetail ? 4096 : 2048
  // Éin styrbar hovudlyskjelde på ein fast kuppel, pluss to svake fyll.
  // Ingen omgjevingskart og ingen mjuk kontaktflekk: eit møbel skal kaste
  // éin hard skugge, slik det gjer i eit verkstadlys.
  const lightPos = useMemo<[number, number, number]>(() => {
    const R = 8.6
    const h = R * Math.cos(light.el)
    return [h * Math.cos(light.az), R * Math.sin(light.el), h * Math.sin(light.az)]
  }, [light])
  const [fit, setFit] = useState<{ r: number; cy: number } | null>(null)

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={hiDetail ? [1, 3] : [1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [2.4, 2.1, 6.4], fov: 30 }}
      className="touch-none"
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 15, 36]} />

      <directionalLight
        key={shadow}
        position={lightPos}
        intensity={2.2}
        castShadow
        shadow-mapSize={[shadow, shadow]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.05}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
      />
      <directionalLight position={[-6, 3, -2]} intensity={0.45} />
      <directionalLight position={[2, 1.5, 7]} intensity={0.3} />

      <Suspense fallback={null}>
        <group position={[0, GROUND_Y, 0]}>
          <SkalMesh
            data={data}
            view={view}
            dark={dark}
            onFit={(r, cy) => setFit({ r, cy })}
          />
          <CubeCage show={cube} dark={dark} />
          {!dark && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[60, 60]} />
              <shadowMaterial transparent opacity={0.2} />
            </mesh>
          )}
        </group>
      </Suspense>

      <FitCamera fit={fit} lift={mobile ? 0.95 : 0} />
      <GestureParams onNudge={onNudge} onLight={onLight} />
      <OrbitControls
        target={[0, 0.35, 0]}
        enablePan={false}
        enableZoom
        minDistance={2.4}
        maxDistance={16}
        rotateSpeed={0.9}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 + 0.3}
        makeDefault
      />
    </Canvas>
  )
}
