"use client"

import { useEffect, useMemo, useRef } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { BuildRes, View } from "@/lib/skal/worker"

/** millimeter til sceneeiningar: kuben på 500 mm vert 2 einingar brei */
export const MM = 1 / 250

/**
 * Objektet i scena. Modellen reknar i millimeter med Z opp, som er
 * verkstadens koordinatsystem; scena har Y opp. Omrekninga skjer her og
 * ingen annan stad, slik at ingen tal i motoren nokon gong er i
 * «sceneeiningar».
 */
export function SkalMesh({
  data,
  view,
  dark,
  onFit,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  onFit: (r: number, cy: number) => void
}) {
  const invalidate = useThree((s) => s.invalidate)
  const geom = useRef<THREE.BufferGeometry | null>(null)
  const thin = useRef<THREE.BufferGeometry | null>(null)
  const bold = useRef<THREE.BufferGeometry | null>(null)

  const built = useMemo(() => {
    if (!data) return null
    const g = new THREE.BufferGeometry()
    if (data.positions.length) {
      g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3))
      g.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3))
      g.computeBoundingSphere()
    }
    const mk = (a: Float32Array) => {
      const b = new THREE.BufferGeometry()
      if (a.length) b.setAttribute("position", new THREE.BufferAttribute(a, 3))
      return b
    }
    return { g, thin: mk(data.lines), bold: mk(data.heavy) }
  }, [data])

  useEffect(() => {
    const prev = { g: geom.current, t: thin.current, b: bold.current }
    geom.current = built?.g ?? null
    thin.current = built?.thin ?? null
    bold.current = built?.bold ?? null
    prev.g?.dispose()
    prev.t?.dispose()
    prev.b?.dispose()
    invalidate()
  }, [built, invalidate])

  // Auto-innramminga treng radius og senterhøgd i sceneeiningar. Storleiken
  // vert lesen av det som faktisk er bygd, ikkje av kuben — eit lite objekt
  // skal ikkje stå like langt unna som eit stort.
  const box = useMemo(() => {
    if (!data) return null
    const min = data.min
    const max = data.max
    const cx = (min[0] + max[0]) / 2
    const cy = (min[1] + max[1]) / 2
    const h = Math.max(1, max[2] - Math.min(0, min[2]))
    const w = Math.max(max[0] - min[0], max[1] - min[1])
    return { cx, cy, r: (Math.hypot(w, h) / 2) * MM, mid: (h / 2) * MM }
  }, [data])

  useEffect(() => {
    if (box) onFit(box.r, box.mid)
  }, [box, onFit])

  if (!built || !box) return null

  // Bjørk under kvitpigmentert olje: nesten kvit, ein anelse varm. I mørk
  // modus vert han dempa, elles brenn objektet hol i skjermen.
  const col = dark ? "#cfc7bb" : "#e8e1d4"

  return (
    <group
      rotation={[-Math.PI / 2, 0, 0]}
      scale={MM}
      position={[-box.cx * MM, 0, box.cy * MM]}
    >
      {view === "kontur" ? (
        <>
          <lineSegments geometry={built.thin}>
            <lineBasicMaterial color={dark ? "#8a8a8a" : "#9a9a9a"} transparent opacity={0.55} />
          </lineSegments>
          <lineSegments geometry={built.bold}>
            <lineBasicMaterial color={dark ? "#ffffff" : "#000000"} />
          </lineSegments>
        </>
      ) : (
        <mesh geometry={built.g} castShadow receiveShadow>
          <meshStandardMaterial
            color={col}
            roughness={view === "lag" ? 0.92 : 0.78}
            metalness={0}
            flatShading={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
