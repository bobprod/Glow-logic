"use client";

import React, { useEffect, useRef, useCallback } from "react";

export type VjShaderMode = "gradient" | "waves" | "strobe" | "laser" | "drone" | "pyro" | "gobo" | "prism";

export interface VjShaderConfig {
  mode: VjShaderMode;
  bpm: number;
  intensity: number;
  playing: boolean;
  colorShift: number;
  speed: number;
  scale: number;
  audioReactive: boolean;
  audioBandsRef: React.MutableRefObject<[number, number, number]>;
}

const MODE_TO_INDEX: Record<VjShaderMode, number> = {
  gradient: 0,
  waves: 1,
  strobe: 2,
  laser: 3,
  drone: 4,
  pyro: 5,
  gobo: 6,
  prism: 7,
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
uniform float u_colorShift;
uniform float u_speed;
uniform float u_scale;
uniform float u_audioReactive;

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
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p *= 2.04;
    amp *= 0.5;
  }
  return value;
}

vec3 palette(float t, float shift) {
  vec3 a = vec3(0.46, 0.42, 0.38);
  vec3 b = vec3(0.44, 0.36, 0.34);
  vec3 c = vec3(0.95 + shift * 0.1, 0.72 - shift * 0.2, 0.55 + shift * 0.3);
  vec3 d = vec3(0.03 + shift * 0.5, 0.28, 0.55 - shift * 0.3);
  return a + b * cos(6.28318 * (c * t + d));
}

float laserBeam(vec2 uv, float angle, float thickness, float t) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float dist = abs(dot(uv, vec2(-dir.y, dir.x)));
  float beam = smoothstep(thickness, 0.0, dist);
  float pulse = sin(t * 10.0) * 0.5 + 0.5;
  return beam * pulse;
}

float droneRing(vec2 uv, float radius, float t) {
  float dist = length(uv) - radius;
  float ring = smoothstep(0.02, 0.0, abs(dist));
  float pulse = sin(t * 3.0 + radius * 10.0) * 0.5 + 0.5;
  return ring * pulse;
}

float pyroExplosion(vec2 uv, float t, float seed) {
  float dist = length(uv);
  float explosion = smoothstep(0.3 + t * 0.5, 0.0, dist);
  float noiseVal = noise(uv * 5.0 + vec2(seed, t * 2.0));
  return explosion * noiseVal * (1.0 - t);
}

float goboPattern(vec2 uv, float t, int pattern) {
  float scale = 3.0 + sin(t) * 0.5;
  vec2 scaled = uv * scale;
  
  if (pattern == 0) {
    // Circle
    return smoothstep(0.3, 0.28, length(scaled));
  } else if (pattern == 1) {
    // Cross
    float cross = smoothstep(0.05, 0.0, abs(scaled.x)) + smoothstep(0.05, 0.0, abs(scaled.y));
    return clamp(cross, 0.0, 1.0);
  } else if (pattern == 2) {
    // Star
    float angle = atan(scaled.y, scaled.x);
    float star = smoothstep(0.3, 0.25, length(scaled)) * (sin(angle * 5.0) * 0.5 + 0.5);
    return star;
  } else {
    // Dots
    return smoothstep(0.1, 0.08, length(fract(scaled) - 0.5));
  }
}

float prismSplit(vec2 uv, float t) {
  float split = sin(t * 2.0) * 0.3;
  float offset = fract(uv.x + split) - 0.5;
  return smoothstep(0.05, 0.0, abs(offset));
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(u_resolution.x, u_resolution.y);
  float t = u_time * u_speed;
  float beatPhase = fract(t * max(u_bpm, 30.0) / 60.0);
  float beatPulse = smoothstep(0.0, 0.12, beatPhase) * (1.0 - smoothstep(0.16, 0.48, beatPhase));
  float energy = clamp((u_bass * 0.55 + u_mid * 0.30 + u_high * 0.15) / 255.0, 0.0, 1.0);
  float drive = mix(0.35, 1.0, u_playing) * u_intensity;
  float audioFactor = mix(1.0, energy, u_audioReactive);
  vec3 color;

  if (u_mode == 0) {
    // Gradient
    vec2 drift = vec2(t * 0.05, -t * 0.035);
    float field = fbm(centered * (u_scale + energy * 1.5) + drift);
    float grain = noise(gl_FragCoord.xy * 0.75 + t);
    color = palette(field + energy * 0.25 + beatPulse * 0.08, u_colorShift);
    color *= 0.55 + field * 0.65;
    color += vec3(0.0, 0.32, 0.45) * grain * 0.16;
    color += vec3(0.95, 0.22, 0.36) * beatPulse * 0.18;
  } else if (u_mode == 1) {
    // Waves
    float waveA = sin((centered.x * 8.0 * u_scale) + t * (1.2 + energy * 2.2));
    float waveB = sin((centered.y * 11.0 * u_scale) - t * (0.8 + u_mid / 180.0));
    float rings = sin(length(centered) * (18.0 + u_bass / 18.0) - t * 3.5);
    float mask = smoothstep(0.12, 0.95, abs(waveA + waveB + rings) * 0.38);
    color = mix(vec3(0.02, 0.06, 0.08), vec3(0.0, 0.82, 0.95), mask);
    color += vec3(0.95, 0.24, 0.42) * pow(max(0.0, waveA), 4.0) * (0.35 + energy);
    color += vec3(1.0, 0.78, 0.22) * beatPulse * 0.22;
  } else if (u_mode == 2) {
    // Strobe
    float bars = step(0.5, fract((uv.x + uv.y * 0.16) * 12.0 * u_scale + beatPulse * 3.0));
    float scan = smoothstep(0.03, 0.0, abs(fract(uv.y * 4.0 - t * 0.6) - 0.5));
    float flash = max(beatPulse, smoothstep(0.72, 1.0, energy));
    color = mix(vec3(0.0), vec3(1.0), bars * flash);
    color += vec3(0.0, 0.45, 1.0) * scan * (0.4 + u_high / 255.0);
    color += vec3(1.0, 0.05, 0.16) * flash * 0.35;
  } else if (u_mode == 3) {
    // Laser
    float beam1 = laserBeam(centered, t * 0.5, 0.005, t);
    float beam2 = laserBeam(centered, t * 0.5 + 1.57, 0.005, t);
    float beam3 = laserBeam(centered, t * 0.5 + 3.14, 0.005, t);
    float fan = laserBeam(centered, sin(t * 0.3) * 2.0, 0.008, t);
    
    color = vec3(0.0, 0.0, 0.05);
    color += vec3(0.0, 0.8, 0.2) * beam1 * (0.5 + energy * 0.5);
    color += vec3(0.0, 0.8, 0.2) * beam2 * (0.5 + energy * 0.5);
    color += vec3(0.0, 0.8, 0.2) * beam3 * (0.5 + energy * 0.5);
    color += vec3(0.0, 1.0, 0.3) * fan * (0.3 + energy * 0.7);
    color += vec3(0.0, 0.6, 0.1) * beatPulse * 0.3;
  } else if (u_mode == 4) {
    // Drone
    float ring1 = droneRing(centered, 0.15 + sin(t * 0.5) * 0.05, t);
    float ring2 = droneRing(centered, 0.25 + cos(t * 0.3) * 0.05, t);
    float ring3 = droneRing(centered, 0.35 + sin(t * 0.7) * 0.05, t);
    float trail = smoothstep(0.02, 0.0, abs(length(centered) - 0.2 + sin(t * 2.0) * 0.1));
    
    color = vec3(0.02, 0.02, 0.05);
    color += vec3(0.0, 0.5, 0.8) * ring1 * (0.5 + energy * 0.5);
    color += vec3(0.0, 0.4, 0.7) * ring2 * (0.4 + energy * 0.4);
    color += vec3(0.0, 0.3, 0.6) * ring3 * (0.3 + energy * 0.3);
    color += vec3(0.0, 0.7, 1.0) * trail * (0.3 + energy * 0.7);
    color += vec3(0.0, 0.4, 0.8) * beatPulse * 0.2;
  } else if (u_mode == 5) {
    // Pyro
    float explosion1 = pyroExplosion(centered, fract(t * 0.3), 1.0);
    float explosion2 = pyroExplosion(centered + vec2(0.3, 0.2), fract(t * 0.3 + 0.33), 2.0);
    float explosion3 = pyroExplosion(centered - vec2(0.2, 0.3), fract(t * 0.3 + 0.66), 3.0);
    float sparks = noise(centered * 10.0 + t * 5.0) * smoothstep(0.5, 0.0, length(centered));
    
    color = vec3(0.05, 0.02, 0.0);
    color += vec3(1.0, 0.6, 0.0) * explosion1 * (0.5 + energy * 0.5);
    color += vec3(1.0, 0.4, 0.0) * explosion2 * (0.4 + energy * 0.4);
    color += vec3(1.0, 0.5, 0.1) * explosion3 * (0.3 + energy * 0.3);
    color += vec3(1.0, 0.8, 0.2) * sparks * (0.3 + energy * 0.7);
    color += vec3(1.0, 0.3, 0.0) * beatPulse * 0.3;
  } else if (u_mode == 6) {
    // Gobo
    float pattern = goboPattern(centered, t, int(mod(t * 0.5, 4.0)));
    float rotation = sin(t * 0.5) * 0.3;
    float zoom = 0.5 + sin(t * 0.3) * 0.2;
    
    color = vec3(0.02, 0.02, 0.02);
    color += vec3(0.9, 0.9, 0.8) * pattern * (0.5 + energy * 0.5);
    color += vec3(0.8, 0.7, 0.5) * rotation * 0.3;
    color += vec3(0.7, 0.6, 0.4) * zoom * 0.2;
    color += vec3(1.0, 0.9, 0.7) * beatPulse * 0.15;
  } else if (u_mode == 7) {
    // Prism
    float split = prismSplit(centered, t);
    float rainbow = sin(centered.x * 5.0 + t * 2.0) * 0.5 + 0.5;
    float rotation = sin(t * 0.5) * 0.5;
    
    color = vec3(0.02, 0.02, 0.05);
    color += vec3(1.0, 0.0, 0.0) * split * (0.3 + energy * 0.3);
    color += vec3(0.0, 1.0, 0.0) * split * rainbow * (0.3 + energy * 0.3);
    color += vec3(0.0, 0.0, 1.0) * split * (1.0 - rainbow) * (0.3 + energy * 0.3);
    color += vec3(0.5, 0.0, 0.5) * rotation * 0.2;
    color += vec3(0.8, 0.2, 0.8) * beatPulse * 0.2;
  }

  float vignette = smoothstep(1.05, 0.18, length(centered));
  gl_FragColor = vec4(color * vignette * (0.4 + drive * 0.95) * audioFactor, 1.0);
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
  colorShift,
  speed,
  scale,
  audioReactive,
  audioBandsRef,
  className = "",
}: VjShaderConfig & { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ mode, bpm, intensity, playing, colorShift, speed, scale, audioReactive });

  useEffect(() => {
    propsRef.current = { mode, bpm, intensity, playing, colorShift, speed, scale, audioReactive };
  }, [mode, bpm, intensity, playing, colorShift, speed, scale, audioReactive]);

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
      colorShift: gl.getUniformLocation(program, "u_colorShift"),
      speed: gl.getUniformLocation(program, "u_speed"),
      scale: gl.getUniformLocation(program, "u_scale"),
      audioReactive: gl.getUniformLocation(program, "u_audioReactive"),
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
      const {
        mode: currentMode,
        bpm: currentBpm,
        intensity: currentIntensity,
        playing: currentPlaying,
        colorShift: currentColorShift,
        speed: currentSpeed,
        scale: currentScale,
        audioReactive: currentAudioReactive,
      } = propsRef.current;
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
      gl.uniform1f(uniforms.colorShift, currentColorShift);
      gl.uniform1f(uniforms.speed, currentSpeed);
      gl.uniform1f(uniforms.scale, currentScale);
      gl.uniform1f(uniforms.audioReactive, currentAudioReactive ? 1 : 0);

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

export function useVjShaderDefaults() {
  return useCallback((): VjShaderConfig => ({
    mode: "gradient",
    bpm: 120,
    intensity: 0.8,
    playing: true,
    colorShift: 0,
    speed: 1,
    scale: 1,
    audioReactive: true,
    audioBandsRef: { current: [0, 0, 0] },
  }), []);
}
