"use client";

import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useDmxFixtureState, useFixtureColor } from "../useDmxFixture";

interface BarLedFixtureProps {
  fixtureId: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  universe: number;
  startAddress: number;
  channels: { channel: number; type: string }[];
  segments?: number;
}

export default function BarLedFixture({
  position = [0, 5, 0],
  rotation = [0, 0, 0],
  universe,
  startAddress,
  channels,
  segments = 8,
}: BarLedFixtureProps) {
  const state = useDmxFixtureState(universe, startAddress, channels);
  const lightsRef = useRef<THREE.SpotLight[]>([]);
  const meshRef = useRef<THREE.Mesh>(null);

  const { color, intensity } = useFixtureColor(state);

  useFrame(() => {
    lightsRef.current.forEach((light) => {
      if (light) {
        light.color.copy(color);
        light.intensity = intensity / segments;
      }
    });
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(color);
      mat.emissiveIntensity = intensity / 30;
    }
  });

  const barLength = segments * 0.5;

  return (
    <group position={position} rotation={rotation}>
      {/* Bar body */}
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[barLength, 0.15, 0.15]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} emissive="#000" />
      </mesh>

      {/* Individual LED segments */}
      {Array.from({ length: segments }).map((_, i) => {
        const x = (i - (segments - 1) / 2) * 0.5;
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.35, 0.05, 0.12]} />
              <meshStandardMaterial
                color="#000"
                emissive={color}
                emissiveIntensity={intensity / 20}
              />
            </mesh>
            <spotLight
              ref={(el) => {
                if (el) lightsRef.current[i] = el;
              }}
              position={[0, -0.15, 0]}
              angle={0.8}
              penumbra={1}
              distance={10}
              intensity={intensity / segments}
              color={color}
            />
          </group>
        );
      })}
    </group>
  );
}
