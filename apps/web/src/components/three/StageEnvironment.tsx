"use client";

import React from "react";
import { ContactShadows } from "@react-three/drei";

export default function StageEnvironment() {
  return (
    <>
      {/* Ambient light — very subtle base */}
      <ambientLight intensity={0.2} />
      
      {/* Directional light for general visibility */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={["#0a0c10", 15, 40]} />

      {/* Floor — grid pattern, dark */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0f1115"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Grid helper */}
      <gridHelper args={[30, 30, "#1e293b", "#1e293b"]} position={[0, 0.01, 0]} />

      {/* Truss line (visual only) */}
      <mesh position={[0, 5, -2]} castShadow>
        <boxGeometry args={[12, 0.2, 0.2]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Contact shadows for fixtures */}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.6}
        scale={20}
        blur={2}
        far={10}
      />
    </>
  );
}
