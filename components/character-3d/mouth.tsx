import { MeshToonMaterial, QuadraticBezierCurve3, TubeGeometry, Vector3 } from 'three';
import { useMemo } from 'react';

export function Mouth() {
  const geometry = useMemo(() => {
    const curve = new QuadraticBezierCurve3(
      new Vector3(-0.22, -0.3, 0.97),
      new Vector3(0, -0.44, 0.97),
      new Vector3(0.22, -0.3, 0.97),
    );
    return new TubeGeometry(curve, 20, 0.025, 8, false);
  }, []);

  const material = useMemo(() => new MeshToonMaterial({ color: '#2d2d2d' }), []);

  return <mesh geometry={geometry} material={material} />;
}
