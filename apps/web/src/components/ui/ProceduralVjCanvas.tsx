"use client";

import React, { useEffect, useRef } from "react";

export type VjShaderMode = "gradient" | "waves" | "strobe";

interface ProceduralVjCanvasProps {
  mode: VjShaderMode;
  bpm: number;
  intensity: number;
  playing: boolean;
  audioBandsRef: React.MutableRefObject<[number, number, number]>;
  className?: string;
}

const MODE_TO_INDEX: Record<VjShaderMode, number> = {
  gradient: 0,
  waves: 1,
  strobe: 2,
};

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bpm;
uniform float u_intensity;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_playing;
uniform int u_mode;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    value += noise(p) * amp;
    p *= 2.04;
    amp *= 0.5;
  }
  return value;
}

vec3 palette(float t) {
  vec3 a = vec3(0.46, 0.42, 0.38);
  vec3 b = vec3(0.44, 0.36, 0.34);
  vec3 c = vec3(0.95, 0.72, 0.55);
  vec3 d = vec3(0.03, 0.28, 0.55);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.x, u_resolution.y);
  float beatPhase = fract(u_time * max(u_bpm, 30.0) / 60.0);
  float beatPulse = smoothstep(0.0, 0.12, beatPhase) * (1.0 - smoothstep(0.16, 0.48, beatPhase));
  float energy = clamp((u_bass * 0.55 + u_mid * 0.30 + u_high * 0.15) / 255.0, 0.0, 1.0);
  float drive = mix(0.35, 1.0, u_playing) * u_intensity;
  vec3 color;

  if (u_mode == 1) {
    float waveA = sin((centered.x * 8.0) + u_time * (1.2 + energy * 2.2));
    float waveB = sin((centered.y * 11.0) - u_time * (0.8 + u_mid / 180.0));
    float rings = sin(length(centered) * (18.0 + u_bass / 18.0) - u_time * 3.5);
    float mask = smoothstep(0.12, 0.95, abs(waveA + waveB + rings) * 0.38);
    color = mix(vec3(0.02, 0.06, 0.08), vec3(0.0, 0.82, 0.95), mask);
    color += vec3(0.95, 0.24, 0.42) * pow(max(0.0, waveA), 4.0) * (0.35 + energy);
    color += vec3(1.0, 0.78, 0.22) * beatPulse * 0.22;
  } else if (u_mode == 2) {
    float bars = step(0.5, fract((uv.x + uv.y * 0.16) * 12.0 + beatPulse * 3.0));
    float scan = smoothstep(0.03, 0.0, abs(fract(uv.y * 4.0 - u_time * 0.6) - 0.5));
    float flash = max(beatPulse, smoothstep(0.72, 1.0, energy));
    color = mix(vec3(0.0), vec3(1.0), bars * flash);
    color += vec3(0.0, 0.45, 1.0) * scan * (0.4 + u_high / 255.0);
    color += vec3(1.0, 0.05, 0.16) * flash * 0.35;
  } else {
    vec2 drift = vec2(u_time * 0.05, -u_time * 0.035);
    float field = fbm(centered * (2.4 + energy * 1.5) + drift);
    float grain = noise(gl_FragCoord.xy * 0.75 + u_time);
    color = palette(field + energy * 0.25 + beatPulse * 0.08);
    color *= 0.55 + field * 0.65;
    color += vec3(0.0, 0.32, 0.45) * grain * 0.16;
    color += vec3(0.95, 0.22, 0.36) * beatPulse * 0.18;
  }

  float vignette = smoothstep(1.05, 0.18, length(centered));
  gl_FragColor = vec4(color * vignette * (0.4 + drive * 0.95), 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Shader creation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Program creation failed");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export default function ProceduralVjCanvas({
  mode,
  bpm,
  intensity,
  playing,
  audioBandsRef,
  className = "",
}: ProceduralVjCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ mode, bpm, intensity, playing });

  useEffect(() => {
    propsRef.current = { mode, bpm, intensity, playing };
  }, [bpm, intensity, mode, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let frameId = 0;
    let disposed = false;
    const program = createProgram(gl);
    const buffer = gl.createBuffer();
    if (!buffer) return;

    const position = gl.getAttribLocation(program, "a_position");
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      bpm: gl.getUniformLocation(program, "u_bpm"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      bass: gl.getUniformLocation(program, "u_bass"),
      mid: gl.getUniformLocation(program, "u_mid"),
      high: gl.getUniformLocation(program, "u_high"),
      playing: gl.getUniformLocation(program, "u_playing"),
      mode: gl.getUniformLocation(program, "u_mode"),
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const render = (now: number) => {
      if (disposed) return;
      resize();
      const { mode: currentMode, bpm: currentBpm, intensity: currentIntensity, playing: currentPlaying } = propsRef.current;
      const [bass, mid, high] = audioBandsRef.current;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, now / 1000);
      gl.uniform1f(uniforms.bpm, currentBpm);
      gl.uniform1f(uniforms.intensity, currentIntensity);
      gl.uniform1f(uniforms.bass, bass);
      gl.uniform1f(uniforms.mid, mid);
      gl.uniform1f(uniforms.high, high);
      gl.uniform1f(uniforms.playing, currentPlaying ? 1 : 0);
      gl.uniform1i(uniforms.mode, MODE_TO_INDEX[currentMode]);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [audioBandsRef]);

  return <canvas ref={canvasRef} className={`block h-full w-full bg-black ${className}`} />;
}
