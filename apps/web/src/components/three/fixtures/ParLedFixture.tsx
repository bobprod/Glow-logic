"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useDmxFixtureState, useFixtureColor } from "../useDmxFixture";

interface ParLedFixtureProps {
  fixtureId: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  universe: number;
  startAddress: number;
  channels: { channel: number; type: string }[];
}

export default function ParLedFixture({
  position = [0, 5, 0],
  rotation = [Math.PI / 6, 0, 0],
  universe,
  startAddress,
  channels,
}: ParLedFixtureProps) {
  const state = useDmxFixtureState(universe, startAddress, channels);
  const lightRef = useRef<THREE.SpotLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const { color, intensity } = useFixtureColor(state);

  // Volumetric beam geometry
  const beamGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.6, 6, 32, 1, true);
    geo.translate(0, -3, 0);
    return geo;
  }, []);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.color.copy(color);
      lightRef.current.intensity = intensity;
      lightRef.current.angle = THREE.MathUtils.lerp(
        lightRef.current.angle,
        (state.zoom ?? 255) / 255 * 0.6 + 0.2,
        0.1
      );
    }
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(color);
      mat.emissiveIntensity = intensity / 20;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Fixture body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.4, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Emissive face */}
      <mesh ref={meshRef} position={[0, -0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 32]} />
        <meshStandardMaterial color="#000" emissive="#000" emissiveIntensity={0} />
      </mesh>

      {/* SpotLight */}
      <spotLight
        ref={lightRef}
        position={[0, -0.3, 0]}
        angle={0.5}
        penumbra={0.5}
        distance={20}
        castShadow
        shadow-mapSize={[512, 512]}
      />

      {/* Volumetric beam (semi-transparent cone) */}
      <mesh geometry={beamGeo} position={[0, -0.3, 0]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
