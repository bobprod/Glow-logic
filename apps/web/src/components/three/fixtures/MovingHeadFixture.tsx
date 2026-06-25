"use client";

import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useDmxFixtureState, useFixtureColor } from "../useDmxFixture";
import GoboProjector from "../GoboProjector";

interface MovingHeadFixtureProps {
  fixtureId: string;
  position?: [number, number, number];
  universe: number;
  startAddress: number;
  channels: { channel: number; type: string }[];
}

export default function MovingHeadFixture({
  position = [0, 5, 0],
  universe,
  startAddress,
  channels,
}: MovingHeadFixtureProps) {
  const state = useDmxFixtureState(universe, startAddress, channels);
  const headRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  const { color, intensity } = useFixtureColor(state);

  // DMX pan/tilt: 0-255 → degrees
  const panDeg = ((state.pan ?? 127) / 255) * 540 - 270; // -270 to +270
  const tiltDeg = ((state.tilt ?? 127) / 255) * 270 - 135; // -135 to +135

  // Map DMX zoom channel (0-255) to spotlight angle. Standard range: 0.15 (narrow) to 1.2 (wide)
  const zoomVal = state.zoom ?? 127;
  const beamAngle = 0.15 + (zoomVal / 255) * 1.05;

  // Map DMX gobo value to GoboProjector shapes
  const goboVal = state.gobo ?? 0;
  let goboType: "circle" | "triangle" | "star" | "cross" | "wave" | "ring" | "rings" | "flower" = "circle";
  if (goboVal >= 10 && goboVal < 20) {
    goboType = "triangle";
  } else if (goboVal >= 20 && goboVal < 30) {
    goboType = "star";
  } else if (goboVal >= 30 && goboVal < 40) {
    goboType = "cross";
  } else if (goboVal >= 40 && goboVal < 50) {
    goboType = "wave";
  } else if (goboVal >= 50 && goboVal < 60) {
    goboType = "ring";
  } else if (goboVal >= 60 && goboVal < 70) {
    goboType = "rings";
  } else if (goboVal >= 70) {
    goboType = "flower";
  }

  useFrame(() => {
    if (headRef.current) {
      const targetPan = (panDeg * Math.PI) / 180;
      const targetTilt = (tiltDeg * Math.PI) / 180;
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        targetPan,
        0.08
      );
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        targetTilt,
        0.08
      );
    }
    if (lightRef.current) {
      lightRef.current.color.copy(color);
      lightRef.current.intensity = intensity;
      lightRef.current.angle = beamAngle;
    }
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(color);
      mat.emissiveIntensity = intensity / 20;
    }
    if (beamRef.current) {
      const scaleVal = beamAngle / 0.7; // standard angle reference is 0.7
      beamRef.current.scale.set(scaleVal, 1, scaleVal);
    }
  });

  return (
    <group position={position}>
      {/* Base (fixed) */}
      <mesh position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.6, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Yoke */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.6, 0.1, 0.6]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Rotating head group */}
      <group ref={headRef} position={[0, 0.5, 0]}>
        {/* Head body */}
        <mesh castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Emissive face */}
        <mesh ref={meshRef} position={[0, 0, 0.28]}>
          <circleGeometry args={[0.2, 32]} />
          <meshStandardMaterial color="#000" emissive="#000" emissiveIntensity={0} />
        </mesh>

        {/* SpotLight inside head */}
        <spotLight
          ref={lightRef}
          position={[0, 0, 0.3]}
          angle={beamAngle}
          penumbra={0.3}
          distance={25}
          castShadow
          shadow-mapSize={[512, 512]}
        >
          <GoboProjector goboType={goboType} color={color} prism={state.prism ?? 0} />
        </spotLight>

        {/* Beam cone */}
        <mesh ref={beamRef} position={[0, 0, -2.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.9, 5, 32, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
