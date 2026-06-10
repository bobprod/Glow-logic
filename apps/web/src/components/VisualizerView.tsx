"use client";

import React, { useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import ThreeCanvas from "./three/ThreeCanvas";
import FixtureRenderer from "./three/FixtureRenderer";
import SafetySimulationLayer from "./three/SafetySimulationLayer";
import useStore from "../store/useStore";

// Raycaster for clicking fixtures
function FixtureClickHandler({ onSelect }: { onSelect: (fixtureId: string) => void }) {
  const { camera, scene, gl } = useThree();
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const mouse = React.useMemo(() => new THREE.Vector2(), []);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        // Traverse up to find fixture group with userData.fixtureId
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.fixtureId) {
            onSelect(obj.userData.fixtureId);
            return;
          }
          obj = obj.parent;
        }
      }
    },
    [camera, gl, mouse, onSelect, raycaster, scene.children]
  );

  React.useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl.domElement, handleClick]);

  return null;
}

export default function VisualizerView() {
  const { laserArmed, nodes, pyroArmed, setSelectedFixtureId, setIsBottomPanelVisible } = useStore();

  const handleSelect = useCallback((fixtureId: string) => {
    setSelectedFixtureId(fixtureId);
    setIsBottomPanelVisible(true);
  }, [setSelectedFixtureId, setIsBottomPanelVisible]);

  return (
    <div className="w-full h-full bg-[#0a0c10] relative overflow-hidden">
      {/* 3D Canvas */}
      <ThreeCanvas
        cameraPosition={[10, 8, 10]}
        orbitControls={true}
        className="w-full h-full"
      >
        <FixtureClickHandler onSelect={handleSelect} />
        <FixtureRenderer nodes={nodes} />
        <SafetySimulationLayer laserArmed={laserArmed} pyroArmed={pyroArmed} />
      </ThreeCanvas>

      {/* Bottom hint bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 backdrop-blur-sm border-t border-white/5 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          Click-drag = orbiter · Molette = zoom · Double-click = reset · Click fixture = contrôler
        </span>
        <span className="text-[10px] text-cyan-500 font-mono">
          {nodes.filter((n) => n.type === "fixtureNode" || n.type === "dmxOutput").length} fixtures
        </span>
      </div>
    </div>
  );
}
