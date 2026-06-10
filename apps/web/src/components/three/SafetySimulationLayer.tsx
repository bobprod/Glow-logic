"use client";

import React, { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LASER_MAX_POWER = 64;
const DRONE_GEOFENCE = {
  minX: -20,
  maxX: 20,
  minY: 0,
  maxY: 12,
  minZ: -20,
  maxZ: 20,
};

type Point3 = [number, number, number];

function isInsideGeofence([x, y, z]: Point3) {
  return (
    x >= DRONE_GEOFENCE.minX &&
    x <= DRONE_GEOFENCE.maxX &&
    y >= DRONE_GEOFENCE.minY &&
    y <= DRONE_GEOFENCE.maxY &&
    z >= DRONE_GEOFENCE.minZ &&
    z <= DRONE_GEOFENCE.maxZ
  );
}

function buildGeofenceEdges(): Array<[Point3, Point3]> {
  const { minX, maxX, minY, maxY, minZ, maxZ } = DRONE_GEOFENCE;
  const corners: Point3[] = [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
  const pairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  return pairs.map(([a, b]) => [corners[a], corners[b]]);
}

function GeofenceBox() {
  const edges = useMemo(() => buildGeofenceEdges(), []);

  return (
    <group>
      {edges.map(([start, end], index) => (
        <Line
          key={`geofence-${index}`}
          points={[start, end]}
          color="#22c55e"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </group>
  );
}

function LaserSimulation({ armed }: { armed: boolean }) {
  const beamOpacity = armed ? 0.55 : 0.16;
  const color = armed ? "#f43f5e" : "#64748b";
  const sources: Point3[] = [
    [-5, 5.4, -2],
    [0, 5.6, -2],
    [5, 5.4, -2],
  ];

  return (
    <group>
      {sources.map((source, index) => {
        const target: Point3 = [source[0] * 0.35, 0.04, 6 + index * 0.6];
        return (
          <group key={`laser-${index}`}>
            <Line points={[source, target]} color={color} lineWidth={armed ? 2 : 1} transparent opacity={beamOpacity} />
            <mesh position={source}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[6.4, 0.08, 6.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial
          color={armed ? "#f43f5e" : "#64748b"}
          transparent
          opacity={armed ? LASER_MAX_POWER / 255 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function DroneSimulation() {
  const droneRef = useRef<THREE.Mesh>(null);
  const path: Point3[] = useMemo(
    () => [
      [-8, 3, -4],
      [-3, 6, 2],
      [4, 7, 4],
      [9, 5, -3],
      [24, 8, 0],
    ],
    [],
  );
  const safePath = path.filter(isInsideGeofence);
  const blockedPoint = path.find((point) => !isInsideGeofence(point));

  useFrame(({ clock }) => {
    if (!droneRef.current || safePath.length === 0) return;
    const elapsed = clock.getElapsedTime() * 0.35;
    const index = Math.floor(elapsed) % safePath.length;
    const nextIndex = (index + 1) % safePath.length;
    const mix = elapsed - Math.floor(elapsed);
    const from = new THREE.Vector3(...safePath[index]);
    const to = new THREE.Vector3(...safePath[nextIndex]);
    droneRef.current.position.copy(from.lerp(to, mix));
    droneRef.current.rotation.y += 0.04;
  });

  return (
    <group>
      <Line points={safePath} color="#38bdf8" lineWidth={2} transparent opacity={0.75} />
      {blockedPoint && (
        <>
          <Line points={[safePath[safePath.length - 1], blockedPoint]} color="#ef4444" lineWidth={2} transparent opacity={0.7} dashed />
          <mesh position={blockedPoint}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color="#ef4444" wireframe />
          </mesh>
        </>
      )}
      <mesh ref={droneRef} position={safePath[0]}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0369a1" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function PyroSimulation({ armed }: { armed: boolean }) {
  const particles = useMemo<Point3[]>(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const radius = 0.45 + (index % 4) * 0.18;
        return [Math.cos(angle) * radius, 1.1 + (index % 6) * 0.24, Math.sin(angle) * radius];
      }),
    [],
  );

  return (
    <group position={[-6.5, 0.08, 5.8]}>
      <mesh>
        <cylinderGeometry args={[0.22, 0.28, 0.45, 16]} />
        <meshStandardMaterial color="#1f2937" emissive={armed ? "#f97316" : "#111827"} emissiveIntensity={armed ? 0.6 : 0.1} />
      </mesh>
      {particles.map((position, index) => (
        <mesh key={`pyro-${index}`} position={position}>
          <sphereGeometry args={[armed ? 0.07 : 0.035, 8, 8]} />
          <meshBasicMaterial color={armed ? (index % 2 === 0 ? "#facc15" : "#fb7185") : "#475569"} transparent opacity={armed ? 0.85 : 0.25} />
        </mesh>
      ))}
    </group>
  );
}

export default function SafetySimulationLayer({
  laserArmed,
  pyroArmed,
}: {
  laserArmed: boolean;
  pyroArmed: boolean;
}) {
  return (
    <group>
      <GeofenceBox />
      <LaserSimulation armed={laserArmed} />
      <DroneSimulation />
      <PyroSimulation armed={pyroArmed} />
    </group>
  );
}
