"use client";

import React, { useMemo, useRef } from "react";
import { Line, Text } from "@react-three/drei";
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

const PYRO_SAFE_ZONE = {
  minX: -10,
  maxX: -3,
  minY: 0,
  maxY: 5,
  minZ: 3,
  maxZ: 10,
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

function isInsidePyroSafeZone([x, y, z]: Point3) {
  return (
    x >= PYRO_SAFE_ZONE.minX &&
    x <= PYRO_SAFE_ZONE.maxX &&
    y >= PYRO_SAFE_ZONE.minY &&
    y <= PYRO_SAFE_ZONE.maxY &&
    z >= PYRO_SAFE_ZONE.minZ &&
    z <= PYRO_SAFE_ZONE.maxZ
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
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return pairs.map(([a, b]) => [corners[a], corners[b]]);
}

function buildPyroSafeZoneEdges(): Array<[Point3, Point3]> {
  const { minX, maxX, minY, maxY, minZ, maxZ } = PYRO_SAFE_ZONE;
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
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
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

function PyroSafeZone() {
  const edges = useMemo(() => buildPyroSafeZoneEdges(), []);

  return (
    <group>
      {edges.map(([start, end], index) => (
        <Line
          key={`pyro-safe-${index}`}
          points={[start, end]}
          color="#f59e0b"
          lineWidth={1}
          transparent
          opacity={0.25}
        />
      ))}
    </group>
  );
}

function LaserHead({ position, rotation, armed, color, beamOpacity }: {
  position: Point3;
  rotation: [number, number, number];
  armed: boolean;
  color: string;
  beamOpacity: number;
}) {
  const headRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!headRef.current) return;
    const t = clock.getElapsedTime();
    headRef.current.rotation.y = rotation[1] + Math.sin(t * 0.5) * 0.3;
    headRef.current.rotation.x = rotation[0] + Math.sin(t * 0.3) * 0.1;
    
    if (beamRef.current && armed) {
      const scale = 1 + Math.sin(t * 2) * 0.2;
      beamRef.current.scale.set(1, 1, scale);
    }
  });

  return (
    <group ref={headRef} position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* Head */}
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={armed ? 0.8 : 0.2} />
      </mesh>
      {/* Beam */}
      <mesh ref={beamRef} position={[0, 0, 2]}>
        <cylinderGeometry args={[0.02, 0.02, 4, 8]} />
        <meshBasicMaterial color={color} transparent opacity={beamOpacity} />
      </mesh>
      {/* Warning label */}
      {armed && (
        <Text
          position={[0, 0.4, 0]}
          fontSize={0.1}
          color="#f43f5e"
          anchorX="center"
          anchorY="middle"
        >
          LASER ARMED
        </Text>
      )}
    </group>
  );
}

function LaserSimulation({ armed }: { armed: boolean }) {
  const beamOpacity = armed ? 0.55 : 0.16;
  const color = armed ? "#f43f5e" : "#64748b";
  const sources: { position: Point3; rotation: [number, number, number] }[] = [
    { position: [-5, 5.4, -2], rotation: [0, 0, 0] },
    { position: [0, 5.6, -2], rotation: [0, 0.5, 0] },
    { position: [5, 5.4, -2], rotation: [0, -0.5, 0] },
  ];

  return (
    <group>
      {sources.map((source, index) => (
        <LaserHead
          key={`laser-head-${index}`}
          position={source.position}
          rotation={source.rotation}
          armed={armed}
          color={color}
          beamOpacity={beamOpacity}
        />
      ))}
      <mesh position={[6.4, 0.08, 6.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial
          color={armed ? "#f43f5e" : "#64748b"}
          transparent
          opacity={armed ? LASER_MAX_POWER / 255 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Warning zone */}
      {armed && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshBasicMaterial color="#f43f5e" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function DroneModel({ position, path = [] }: { position: Point3; path?: Point3[] }) {
  const droneRef = useRef<THREE.Group>(null);
  const propellerRefs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    if (!droneRef.current) return;
    const t = clock.getElapsedTime();
    
    // Animate propellers
    propellerRefs.current.forEach((prop, index) => {
      if (prop) {
        prop.rotation.y = t * 10 + index * Math.PI / 2;
      }
    });
    
    if (path.length > 1) {
      const elapsed = t * 0.35;
      const index = Math.floor(elapsed) % path.length;
      const nextIndex = (index + 1) % path.length;
      const mix = elapsed - Math.floor(elapsed);
      const from = new THREE.Vector3(...path[index]);
      const to = new THREE.Vector3(...path[nextIndex]);
      droneRef.current.position.copy(from.lerp(to, mix));
      droneRef.current.rotation.y += 0.04;
      return;
    }

    droneRef.current.position.set(position[0], position[1] + Math.sin(t * 2) * 0.1, position[2]);
  });

  return (
    <group ref={droneRef} position={position}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.3, 0.1, 0.3]} />
        <meshStandardMaterial color="#1e3a5f" emissive="#0d2137" emissiveIntensity={0.3} />
      </mesh>
      {/* Arms */}
      {[
        [0.25, 0, 0.25],
        [-0.25, 0, 0.25],
        [0.25, 0, -0.25],
        [-0.25, 0, -0.25],
      ].map((armPos, index) => (
        <group key={`arm-${index}`} position={armPos as Point3}>
          {/* Arm */}
          <mesh>
            <boxGeometry args={[0.15, 0.02, 0.02]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          {/* Propeller */}
          <mesh ref={(el) => { if (el) propellerRefs.current[index] = el; }} position={[0, 0.05, 0]}>
            <boxGeometry args={[0.2, 0.01, 0.02]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>
      ))}
      {/* Camera */}
      <mesh position={[0, -0.05, 0.1]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* LED indicator */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
}

function DroneSimulation() {
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
          <Text
            position={[blockedPoint[0], blockedPoint[1] + 1, blockedPoint[2]]}
            fontSize={0.2}
            color="#ef4444"
            anchorX="center"
            anchorY="middle"
          >
            GEOFENCE BREACH!
          </Text>
        </>
      )}
      <DroneModel position={safePath[0] || [0, 0, 0]} path={safePath} />
    </group>
  );
}

function PyroExplosion({ position, armed }: { position: Point3; armed: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 50;
  
  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.5;
      const speed = Math.random() * 0.1 + 0.05;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = speed * 2;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
      
      colors[i * 3] = 1;
      colors[i * 3 + 1] = Math.random() * 0.5 + 0.5;
      colors[i * 3 + 2] = 0;
    }
    
    return { positions, velocities, colors };
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current || !armed) return;
    const t = clock.getElapsedTime();
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const life = (Math.sin(t * 3 + i) * 0.5 + 0.5) * 0.5;
      
      positions[idx] = particles.positions[idx] + particles.velocities[idx] * t * life;
      positions[idx + 1] = particles.positions[idx + 1] + particles.velocities[idx + 1] * t * life;
      positions[idx + 2] = particles.positions[idx + 2] + particles.velocities[idx + 2] * t * life;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!armed) return null;

  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function PyroSimulation({ armed }: { armed: boolean }) {
  const launcherPosition: Point3 = [-6.5, 0.08, 5.8];
  const inSafeZone = isInsidePyroSafeZone(launcherPosition);
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
    <group position={launcherPosition}>
      <mesh>
        <cylinderGeometry args={[0.22, 0.28, 0.45, 16]} />
        <meshStandardMaterial color="#1f2937" emissive={armed && inSafeZone ? "#f97316" : "#111827"} emissiveIntensity={armed && inSafeZone ? 0.6 : 0.1} />
      </mesh>
      {particles.map((position, index) => (
        <mesh key={`pyro-${index}`} position={position}>
          <sphereGeometry args={[armed ? 0.07 : 0.035, 8, 8]} />
          <meshBasicMaterial color={armed && inSafeZone ? (index % 2 === 0 ? "#facc15" : "#fb7185") : "#475569"} transparent opacity={armed && inSafeZone ? 0.85 : 0.25} />
        </mesh>
      ))}
      {/* Warning label */}
      {armed && inSafeZone && (
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.15}
          color="#f97316"
          anchorX="center"
          anchorY="middle"
        >
          PYRO ARMED
        </Text>
      )}
      <PyroExplosion position={[0, 1.5, 0]} armed={armed && inSafeZone} />
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
      <PyroSafeZone />
      <LaserSimulation armed={laserArmed} />
      <DroneSimulation />
      <PyroSimulation armed={pyroArmed} />
    </group>
  );
}
