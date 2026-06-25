"use client";

import React from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraRigProps {
  orbitControls?: boolean;
  target?: [number, number, number];
}

export default function CameraRig({ orbitControls = false, target = [0, 1, 0] }: CameraRigProps) {
  const { camera } = useThree();

  // Default isometric view when no orbit controls
  React.useEffect(() => {
    if (!orbitControls) {
      camera.lookAt(new THREE.Vector3(...target));
    }
  }, [camera, orbitControls, target]);

  return orbitControls ? (
    <OrbitControls
      makeDefault
      target={target}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={3}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  ) : null;
}
