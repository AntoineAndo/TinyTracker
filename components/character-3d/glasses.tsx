import { useGLTF } from '@react-three/drei/native';
import { BoxGeometry, CylinderGeometry, DoubleSide, MeshToonMaterial } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh, Object3D } from 'three';

import type { CharacterConfig } from '../character-avatar';

useGLTF.preload(require('./shell-glasses.glb'));

interface GlassesProps {
  type: CharacterConfig['glasses'];
  color: string;
}

const BRIDGE_Z = 0.97;
const EYE_Y = 0.05;

function ShellGlasses({ color }: { color: string }) {
  const gltf = useGLTF(require('./shell-glasses.glb'));
  const { scene } = Array.isArray(gltf) ? gltf[0] : gltf;
  const material = useRef(new MeshToonMaterial({ color, side: DoubleSide }));

  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj: Object3D) => {
      if ((obj as Mesh).isMesh) (obj as Mesh).material = material.current;
    });
    return c;
  }, [scene]);

  useEffect(() => {
    material.current.color.set(color);
    material.current.needsUpdate = true;
  }, [color]);

  return <primitive object={clone} />;
}

export function Glasses({ type, color }: GlassesProps) {
  const material = useMemo(() => new MeshToonMaterial({ color, side: DoubleSide }), [color]);
  const bridgeGeo = useMemo(() => new CylinderGeometry(0.02, 0.02, 0.3, 8), []);
  const templeGeo = useMemo(() => new CylinderGeometry(0.015, 0.015, 0.45, 8), []);
  const rectLensGeo = useMemo(() => new BoxGeometry(0.44, 0.28, 0.04), []);

  if (type === 'none') return null;

  if (type === 'round') {
    return <ShellGlasses color={color} />;
  }

  // Rectangle
  return (
    <group>
      {/* Lenses */}
      <mesh geometry={rectLensGeo} material={material} position={[-0.38, EYE_Y, BRIDGE_Z]} />
      <mesh geometry={rectLensGeo} material={material} position={[0.38, EYE_Y, BRIDGE_Z]} />
      {/* Bridge */}
      <mesh geometry={bridgeGeo} material={material} position={[0, EYE_Y, BRIDGE_Z]} rotation={[0, 0, Math.PI / 2]} />
      {/* Temples */}
      <mesh geometry={templeGeo} material={material} position={[-0.83, EYE_Y, BRIDGE_Z - 0.1]} rotation={[0, -0.4, 0]} />
      <mesh geometry={templeGeo} material={material} position={[0.83, EYE_Y, BRIDGE_Z - 0.1]} rotation={[0, 0.4, 0]} />
    </group>
  );
}
