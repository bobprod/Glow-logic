"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface GoboProjectorProps {
  goboType?: "circle" | "triangle" | "star" | "cross" | "wave" | "ring" | "rings" | "flower";
  color?: THREE.Color;
  prism?: number; // DMX value (0-255)
}

export default function GoboProjector({
  goboType = "circle",
  prism = 0,
}: GoboProjectorProps) {
  const textureRef = useRef<THREE.CanvasTexture>(null);

  // Re-draw canvas only when goboType or prism state changes
  const goboTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Transparent background
    ctx.clearRect(0, 0, 256, 256);

    const isPrismActive = prism >= 128;

    const drawShape = (cx: number, cy: number, scale: number) => {
      ctx.fillStyle = "white";
      ctx.strokeStyle = "white";

      switch (goboType) {
        case "triangle":
          ctx.beginPath();
          ctx.moveTo(cx, cy - 80 * scale);
          ctx.lineTo(cx + 80 * scale, cy + 60 * scale);
          ctx.lineTo(cx - 80 * scale, cy + 60 * scale);
          ctx.closePath();
          ctx.fill();
          break;
        case "star":
          drawStar(ctx, cx, cy, 5, 80 * scale, 32 * scale);
          break;
        case "cross": {
          const w = 45 * scale;
          const h = 150 * scale;
          ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
          ctx.fillRect(cx - h / 2, cy - w / 2, h, w);
          break;
        }
        case "wave":
          ctx.beginPath();
          const startX = cx - 80 * scale;
          ctx.moveTo(startX, cy);
          for (let i = 0; i <= 160; i += 10) {
            ctx.lineTo(startX + i * scale, cy + Math.sin(i * 0.05) * 30 * scale);
          }
          ctx.lineTo(cx + 80 * scale, cy + 15 * scale);
          ctx.lineTo(cx + 80 * scale, cy - 15 * scale);
          for (let i = 160; i >= 0; i -= 10) {
            ctx.lineTo(startX + i * scale, cy + Math.sin(i * 0.05) * 30 * scale - 15 * scale);
          }
          ctx.closePath();
          ctx.fill();
          break;
        case "ring":
          ctx.beginPath();
          ctx.arc(cx, cy, 80 * scale, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(2, 10 * scale);
          ctx.stroke();
          break;
        case "rings":
          ctx.lineWidth = Math.max(1, 5 * scale);
          for (let r = 25; r <= 85; r += 30) {
            ctx.beginPath();
            ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        case "flower":
          // Outer ring of 12 flowers
          for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI * 2) / 12;
            const x = cx + Math.cos(angle) * 75 * scale;
            const y = cy + Math.sin(angle) * 75 * scale;
            drawStar(ctx, x, y, 5, 12 * scale, 5 * scale);
          }
          // Inner ring of 6 flowers
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const x = cx + Math.cos(angle) * 38 * scale;
            const y = cy + Math.sin(angle) * 38 * scale;
            drawStar(ctx, x, y, 5, 10 * scale, 4 * scale);
          }
          break;
        default: {
          // Sharp solid circle (cercle uni) - slightly smaller radius to avoid canvas boundary clipping
          const r1 = 115 * scale;
          const r2 = 120 * scale;
          const gradient = ctx.createRadialGradient(cx, cy, r1, cx, cy, r2);
          gradient.addColorStop(0, "white");
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(cx, cy, r2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (isPrismActive) {
      // 7-beam splitting: 1 center + 6 circular copies
      // If the gobo is open/circle, use larger scale and tighter spacing to blend them into a large unified beam
      const scaleVal = goboType === "circle" ? 0.65 : 0.35;
      const distance = goboType === "circle" ? 45 : 70;
      
      drawShape(128, 128, scaleVal);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = 128 + Math.cos(angle) * distance;
        const y = 128 + Math.sin(angle) * distance;
        drawShape(x, y, scaleVal);
      }
    } else {
      drawShape(128, 128, 1.0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    // Use ClampToEdgeWrapping to prevent spotlight projections from repeating/tiling into grid patterns
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, [goboType, prism]);

  // Real-time Prism rotation
  useFrame((state) => {
    if (textureRef.current && prism >= 157) {
      // Rotate based on time. Speed increases with DMX value (157 to 255)
      const speedFactor = ((prism - 157) / (255 - 157)) * 1.5 + 0.3;
      textureRef.current.center.set(0.5, 0.5);
      textureRef.current.rotation = state.clock.getElapsedTime() * speedFactor;
    } else if (textureRef.current) {
      // Reset rotation when not in rotation mode
      textureRef.current.rotation = 0;
    }
  });

  return <primitive ref={textureRef} object={goboTexture} attach="map" />;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}
