"use client";

import React, { useMemo } from "react";
import { Node } from "reactflow";
import { NodeData } from "../../types/nodes";
import ParLedFixture from "./fixtures/ParLedFixture";
import MovingHeadFixture from "./fixtures/MovingHeadFixture";
import BarLedFixture from "./fixtures/BarLedFixture";
import StrobeFixture from "./fixtures/StrobeFixture";
import useStore from "../../store/useStore";
import { stagePlanToWorld, type StageGridPosition } from "../../lib/stagePlanMapping";
import * as THREE from "three";

// Simple heuristic to determine fixture type from node data
function guessFixtureType(data: NodeData): "par" | "movinghead" | "bar" | "strobe" {
  const label = String(data.label || data.fixtureName || "").toLowerCase();
  if (label.includes("moving") || label.includes("head")) return "movinghead";
  if (label.includes("bar") || label.includes("strip")) return "bar";
  if (label.includes("strobe")) return "strobe";
  return "par";
}

export default function FixtureRenderer({ nodes }: { nodes: Node[] }) {
  const { selectedFixtureId, selectedFixtureIds, selectedNode, selectFixture, toggleFixtureSelection, setSelectedNode, fixtures: patchedFixtures } = useStore();

  const fixtures = useMemo(() => {
    return nodes.filter((n) => n.type === "fixtureNode" || n.type === "dmxOutput");
  }, [nodes]);

  return (
    <>
      {fixtures.map((node, index) => {
        const data = node.data as NodeData;
        const type = guessFixtureType(data);
        
        // Aligner la position 3D sur le Plan de feu (position 2D ReactFlow)
        // Le centre du plan de feu est estimé à x=400, y=300. 100px = 2.5m en 3D (facteur 0.025)
        const patchedFixture = patchedFixtures.find((fixture) => String(fixture.nodeId) === node.id || String(fixture.id) === node.id);
        const gridPosition = patchedFixture?.gridPosition || (data as NodeData & { gridPosition?: StageGridPosition }).gridPosition;
        const world = stagePlanToWorld(gridPosition || { x: 50 + ((index % 4) - 1.5) * 16, y: 50 + Math.floor(index / 4) * 12, z: 5 });
        const pos: [number, number, number] = [world.x, world.y || 5, world.z];
        const universe = (data.universe as number) ?? 1;
        const startAddress = (data.startAddress as number) ?? 1;
        const channels = (patchedFixture?.channels || data.channels || []) as { channel: number; type: string }[];
        const isSelected = selectedFixtureIds.includes(node.id) || selectedFixtureId === node.id || selectedNode?.id === node.id;

        const element = (() => {
          switch (type) {
            case "movinghead":
              return <MovingHeadFixture fixtureId={node.id} position={pos} universe={universe} startAddress={startAddress} channels={channels} />;
            case "bar":
              return <BarLedFixture fixtureId={node.id} position={pos} universe={universe} startAddress={startAddress} channels={channels} />;
            case "strobe":
              return <StrobeFixture fixtureId={node.id} position={pos} universe={universe} startAddress={startAddress} channels={channels} />;
            default:
              return <ParLedFixture fixtureId={node.id} position={pos} universe={universe} startAddress={startAddress} channels={channels} />;
          }
        })();

        return (
          <group 
            key={node.id} 
            userData={{ fixtureId: node.id, nodeData: data }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(node);
              // Shift/Ctrl/Cmd → sélection additive partagée ; sinon sélection simple.
              const native = e.nativeEvent as MouseEvent | undefined;
              const additive = Boolean(native?.shiftKey || native?.ctrlKey || native?.metaKey);
              if (additive) {
                toggleFixtureSelection(node.id, true);
              } else {
                selectFixture(node.id);
              }
            }}
          >
            {element}

            {/* Anneau de sélection au sol (cyan lumineux) sous la lyre/projecteur sélectionné */}
            {isSelected && (
              <mesh position={[pos[0], 0.02, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 0.58, 32]} />
                <meshBasicMaterial color="#06b6d4" side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}
