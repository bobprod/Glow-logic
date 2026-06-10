"use client";

import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useDmxFixtureState, useFixtureColor } from "../useDmxFixture";

interface StrobeFixtureProps {
  fixtureId: string;
  position?: [number, number, number];
  universe: number;
  startAddress: number;
  channels: { channel: number; type: string }[];
}

export default function StrobeFixture({
  position = [0, 5, 0],
  universe,
  startAddress,
  channels,
}: StrobeFixtureProps) {
  const state = useDmxFixtureState(universe, startAddress, channels);
  const lightRef = useRef<THREE.PointLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const { color, intensity } = useFixtureColor(state);
  const strobeSpeed = state.strobe ?? 0; // 0-255
  const isFlashing = strobeSpeed > 10;
  const flashInterval = isFlashing ? 1000 / (strobeSpeed / 255 * 20 + 1) : 0;

  useFrame(({ clock }) => {
    if (!lightRef.current || !meshRef.current) return;

    if (isFlashing) {
      const now = clock.getElapsedTime() * 1000;
      const flash = Math.floor(now / flashInterval) % 2 === 0;
      const flashIntensity = flash ? intensity * 2 : 0;
      lightRef.current.intensity = flashIntensity;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flashIntensity / 10;
    } else {
      lightRef.current.intensity = intensity;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity / 20;
    }

    lightRef.current.color.copy(color);
    (meshRef.current.material as THREE.MeshStandardMaterial).emissive.copy(color);
  });

  return (
    <group position={position}>
      {/* Fixture body */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.3, 0.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Emissive face */}
      <mesh ref={meshRef} position={[0, 0, 0.11]}>
        <planeGeometry args={[0.4, 0.2]} />
        <meshStandardMaterial color="#000" emissive="#000" emissiveIntensity={0} />
      </mesh>

      {/* Point light for flash effect */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.2]}
        distance={15}
        decay={2}
        intensity={0}
      />
    </group>
  );
}
