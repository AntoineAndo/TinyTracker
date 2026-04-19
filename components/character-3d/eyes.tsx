import { MeshToonMaterial, SphereGeometry } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { useFrame } from '@react-three/fiber/native';
import type { Mesh } from 'three';

import { useAnimationsEnabled } from '@/hooks/use-animations-enabled';

export function Eyes() {
  const animationsEnabled = useAnimationsEnabled();
  const eyeRy = useRef(new Animated.Value(1)).current;

  const eyeGeo = useMemo(() => new SphereGeometry(0.12, 16, 16), []);
  const highlightGeo = useMemo(() => new SphereGeometry(0.04, 8, 8), []);
  const eyeMat = useMemo(() => new MeshToonMaterial({ color: '#2d2d2d' }), []);
  const highlightMat = useMemo(() => new MeshToonMaterial({ color: '#ffffff' }), []);

  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const leftHlRef = useRef<Mesh>(null);
  const rightHlRef = useRef<Mesh>(null);

  // Blink scheduling (same logic as SVG version)
  useEffect(() => {
    let cancelled = false;
    const closeDuration = animationsEnabled ? 60 : 0;
    const openDuration = animationsEnabled ? 80 : 0;
    const holdDuration = animationsEnabled ? 0 : 60;

    function scheduleBlink() {
      const delay = 3000 + Math.random() * 1000;
      setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(eyeRy, { toValue: 0, duration: closeDuration, useNativeDriver: false }),
          Animated.delay(holdDuration),
          Animated.timing(eyeRy, { toValue: 1, duration: openDuration, useNativeDriver: false }),
        ]).start(() => { if (!cancelled) scheduleBlink(); });
      }, delay);
    }

    scheduleBlink();
    return () => { cancelled = true; };
  }, [eyeRy, animationsEnabled]);

  // Bridge Animated.Value → Three.js mesh scale each frame
  const eyeScaleRef = useRef(1);
  useEffect(() => {
    const id = eyeRy.addListener(({ value }) => { eyeScaleRef.current = value; });
    return () => eyeRy.removeListener(id);
  }, [eyeRy]);

  useFrame(() => {
    const s = eyeScaleRef.current;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = s;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = s;
    if (leftHlRef.current) {
      leftHlRef.current.scale.y = s;
      leftHlRef.current.position.y = 0.11 - (1 - s) * 0.06;
    }
    if (rightHlRef.current) {
      rightHlRef.current.scale.y = s;
      rightHlRef.current.position.y = 0.11 - (1 - s) * 0.06;
    }
  });

  return (
    <group>
      {/* Eyeballs */}
      <mesh ref={leftEyeRef} geometry={eyeGeo} material={eyeMat} position={[-0.35, 0.05, 0.93]} />
      <mesh ref={rightEyeRef} geometry={eyeGeo} material={eyeMat} position={[0.35, 0.05, 0.93]} />
      {/* Highlights */}
      <mesh ref={leftHlRef} geometry={highlightGeo} material={highlightMat} position={[-0.29, 0.11, 0.97]} />
      <mesh ref={rightHlRef} geometry={highlightGeo} material={highlightMat} position={[0.41, 0.11, 0.97]} />
    </group>
  );
}
