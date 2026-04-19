import { useGLTF } from '@react-three/drei/native';
import { DoubleSide, MeshToonMaterial } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';

useGLTF.preload(require('./head.glb'));

interface HeadProps {
  skinColor: string;
}

export function Head({ skinColor }: HeadProps) {
  const { scene } = useGLTF(require('./head.glb'));
  const material = useRef(new MeshToonMaterial({ color: skinColor, side: DoubleSide }));

  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      if ((obj as Mesh).isMesh) (obj as Mesh).material = material.current;
    });
    return c;
  }, [scene]);

  useEffect(() => {
    material.current.color.set(skinColor);
    material.current.needsUpdate = true;
  }, [skinColor]);

  return <primitive object={clone} />;
}
