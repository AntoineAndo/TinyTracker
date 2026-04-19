import { Canvas, useFrame } from '@react-three/fiber/native';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, View } from 'react-native';
import type { Group } from 'three';

import type { CharacterConfig } from '../character-avatar';
import { Eyes } from './eyes';
import { Glasses } from './glasses';
import { Hair } from './hair';
import { Head } from './head';
import { Mouth } from './mouth';

interface Velocity {
  x: number;
  y: number;
}

interface RotatingGroupProps {
  velocityRef: React.MutableRefObject<Velocity>;
  dragDeltaRef: React.MutableRefObject<Velocity>;
  idleRef: React.MutableRefObject<number>;
  children: React.ReactNode;
}

function RotatingGroup({ velocityRef, dragDeltaRef, idleRef, children }: RotatingGroupProps) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const hasDrag = dragDeltaRef.current.x !== 0 || dragDeltaRef.current.y !== 0;
    const hasVelocity = velocityRef.current.x !== 0 || velocityRef.current.y !== 0;

    // Apply direct drag delta (finger following)
    if (hasDrag) {
      groupRef.current.rotation.y += dragDeltaRef.current.x;
      groupRef.current.rotation.x = Math.max(
        -Math.PI / 4,
        Math.min(Math.PI / 4, groupRef.current.rotation.x + dragDeltaRef.current.y),
      );
      dragDeltaRef.current.x = 0;
      dragDeltaRef.current.y = 0;
      idleRef.current = Date.now();
    }

    // Apply inertia after release
    if (hasVelocity) {
      groupRef.current.rotation.y += velocityRef.current.x * delta;
      groupRef.current.rotation.x += velocityRef.current.y * delta;

      // Clamp X rotation to ±45°
      const limit = Math.PI / 4;
      if (groupRef.current.rotation.x > limit) {
        groupRef.current.rotation.x = limit;
        velocityRef.current.y = 0;
      } else if (groupRef.current.rotation.x < -limit) {
        groupRef.current.rotation.x = -limit;
        velocityRef.current.y = 0;
      }

      // Speed-dependent friction: stronger damping at low velocity so it stops cleanly
      const speed = Math.sqrt(velocityRef.current.x ** 2 + velocityRef.current.y ** 2);
      const decayRate = 3 + 6 * Math.exp(-speed * 2);
      const decay = Math.exp(-decayRate * delta);
      velocityRef.current.x *= decay;
      velocityRef.current.y *= decay;
      if (Math.abs(velocityRef.current.x) < 0.001) velocityRef.current.x = 0;
      if (Math.abs(velocityRef.current.y) < 0.001) velocityRef.current.y = 0;

      idleRef.current = Date.now();
    }

    // Return to center after 500ms of inactivity
    if (!hasDrag && !hasVelocity && Date.now() - idleRef.current > 500) {
      // Normalize Y to [-π, π] so we always take the shortest path back to 0
      const y = groupRef.current.rotation.y % (Math.PI * 2);
      groupRef.current.rotation.y = y > Math.PI ? y - Math.PI * 2 : y < -Math.PI ? y + Math.PI * 2 : y;

      const speed = 5;
      groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * speed * delta;
      groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * speed * delta;
      if (Math.abs(groupRef.current.rotation.x) < 0.001) groupRef.current.rotation.x = 0;
      if (Math.abs(groupRef.current.rotation.y) < 0.001) groupRef.current.rotation.y = 0;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// Fires once on the first rendered frame — signals that all Suspense has resolved
function OnFirstFrame({ onReady }: { onReady: () => void }) {
  const firedRef = useRef(false);
  useFrame(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onReady();
    }
  });
  return null;
}

interface CharacterSceneProps {
  config: CharacterConfig;
  size: number;
  interactive?: boolean;
}

export function CharacterScene({ config, size, interactive = false }: CharacterSceneProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  const velocityRef = useRef<Velocity>({ x: 0, y: 0 });
  const dragDeltaRef = useRef<Velocity>({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  const idleRef = useRef<number>(Date.now());

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onPanResponderGrant: (e) => {
          velocityRef.current = { x: 0, y: 0 };
          lastPosRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          idleRef.current = Date.now();
        },
        onPanResponderMove: (e) => {
          const dx = e.nativeEvent.pageX - lastPosRef.current.x;
          const dy = e.nativeEvent.pageY - lastPosRef.current.y;
          lastPosRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          dragDeltaRef.current.x += dx * 0.01;
          dragDeltaRef.current.y += dy * 0.01;
        },
        onPanResponderRelease: (_, gestureState) => {
          velocityRef.current = {
            x: gestureState.vx * 6,
            y: gestureState.vy * 6,
          };
        },
      }),
    [interactive],
  );

  return (
    <View style={{ width: size, height: size }}>
      <Canvas
        style={{ width: size, height: size }}
        orthographic
        camera={{ position: [0, 0, 5], zoom: size / 3.6, near: 0.1, far: 20 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[2, 3, 5]} intensity={1.5} />
          <directionalLight position={[-2, -1, 3]} intensity={0.4} />

          <RotatingGroup velocityRef={velocityRef} dragDeltaRef={dragDeltaRef} idleRef={idleRef}>
            <Head skinColor={config.skinColor} />
            <Hair style={config.hairStyle} color={config.hairColor} />
            <Mouth />
            <Eyes />
            <Glasses type={config.glasses} color={config.glassesColor} />
          </RotatingGroup>

          <OnFirstFrame onReady={onReady} />
        </Suspense>
      </Canvas>

      {!ready && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ActivityIndicator style={StyleSheet.absoluteFill} />
        </View>
      )}

      {/* Gesture overlay only active once the scene is ready */}
      {interactive && ready && (
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      )}
    </View>
  );
}
