"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import StageEnvironment from "./StageEnvironment";
import CameraRig from "./CameraRig";
import DmxSyncController from "./DmxSyncController";

interface ThreeCanvasProps {
  children?: React.ReactNode;
  className?: string;
  cameraPosition?: [number, number, number];
  orbitControls?: boolean;
  style?: React.CSSProperties;
}

export default function ThreeCanvas({
  children,
  className = "",
  cameraPosition = [8, 8, 8],
  orbitControls = false,
  style,
}: ThreeCanvasProps) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <Canvas
        shadows
        camera={{
          position: cameraPosition,
          fov: 45,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <StageEnvironment />
        <CameraRig orbitControls={orbitControls} />
        <DmxSyncController />
        {children}
      </Canvas>
    </div>
  );
}
