// Renders the character's hair mesh based on the selected style.
import { useGLTF } from '@react-three/drei/native';
import {
  BoxGeometry,
  DoubleSide,
  MeshToonMaterial,
  SphereGeometry,
} from 'three';
import { useEffect, useRef, useMemo } from 'react';
import type { Mesh, Object3D } from 'three';

import type { CharacterConfig } from '../character-avatar';

useGLTF.preload(require('./short-hair.glb'));

interface HairProps {
  style: CharacterConfig['hairStyle'];
  color: string;
}

function ShortHair({ color }: { color: string }) {
  const gltf = useGLTF(require('./short-hair.glb'));
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

export function Hair({ style, color }: HairProps) {
  const material = useMemo(() => new MeshToonMaterial({ color }), [color]);

  const capGeo = useMemo(() => new SphereGeometry(1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const sideGeoMedium = useMemo(() => new BoxGeometry(0.25, 0.6, 0.35), []);
  const sideGeoLong = useMemo(() => new BoxGeometry(0.28, 1.2, 0.3), []);

  if (style === 'bald') return null;

  if (style === 'short') {
    return <ShortHair color={color} />;
  }

  if (style === 'medium') {
    return (
      <group>
        <mesh geometry={capGeo} material={material} />
        <mesh geometry={sideGeoMedium} material={material} position={[-1.05, -0.1, 0]} />
        <mesh geometry={sideGeoMedium} material={material} position={[1.05, -0.1, 0]} />
      </group>
    );
  }

  // Long — cap + extended side panels
  return (
    <group>
      <mesh geometry={capGeo} material={material} />
      <mesh geometry={sideGeoLong} material={material} position={[-1.05, -0.5, 0]} />
      <mesh geometry={sideGeoLong} material={material} position={[1.05, -0.5, 0]} />
    </group>
  );
}
