"use client";

// Web Worker pour calculs lourds DMX
// Usage: new Worker(new URL('./dmxWorker.ts', import.meta.url))

export interface DmxWorkerMessage {
  type: 'calculate' | 'interpolate' | 'effect';
  payload: {
    channels?: number[];
    from?: number[];
    to?: number[];
    duration?: number;
    easing?: string;
    pattern?: string;
    params?: Record<string, number>;
  };
}

export interface DmxWorkerResponse {
  type: 'result' | 'error';
  data: number[];
  error?: string;
}

self.onmessage = (event: MessageEvent<DmxWorkerMessage>) => {
  const { type, payload } = event.data;
  
  try {
    let result: number[] = [];
    
    switch (type) {
      case 'calculate':
        result = payload.channels || [];
        break;
        
      case 'interpolate': {
        const { from, to, duration, easing } = payload;
        if (!from || !to || !duration) {
          throw new Error('Missing interpolation parameters');
        }
        
        const steps = Math.max(1, Math.floor(duration / 16.67)); // 60fps
        result = new Array(steps * from.length);
        
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const easedT = applyEasing(t, easing || 'linear');
          
          for (let j = 0; j < from.length; j++) {
            result[i * from.length + j] = Math.round(
              from[j] + (to[j] - from[j]) * easedT
            );
          }
        }
        break;
      }
      
      case 'effect': {
        const { pattern, params, channels } = payload;
        if (!channels || !pattern) {
          throw new Error('Missing effect parameters');
        }
        
        result = applyEffect(pattern, params || {}, channels);
        break;
      }
    }
    
    self.postMessage({ type: 'result', data: result } as DmxWorkerResponse);
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      data: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    } as DmxWorkerResponse);
  }
};

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - Math.pow(1 - t, 2);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'sCurve':
      return t * t * (3 - 2 * t);
    case 'snap':
      return t < 0.5 ? 0 : 1;
    default:
      return t;
  }
}

function applyEffect(pattern: string, params: Record<string, number>, channels: number[]): number[] {
  const result = [...channels];
  const speed = params.speed || 1;
  const size = params.size || 50;
  const time = performance.now() / 1000;
  
  switch (pattern) {
    case 'circle':
      for (let i = 0; i < channels.length; i += 2) {
        const angle = time * speed;
        result[i] = Math.round(127 + Math.sin(angle) * size);
        result[i + 1] = Math.round(127 + Math.cos(angle) * size);
      }
      break;
      
    case 'figure8':
      for (let i = 0; i < channels.length; i += 2) {
        const angle = time * speed;
        result[i] = Math.round(127 + Math.sin(angle * 2) * size);
        result[i + 1] = Math.round(127 + Math.sin(angle) * size);
      }
      break;
      
    case 'sweep':
      for (let i = 0; i < channels.length; i += 2) {
        const sweep = (Math.sin(time * speed) + 1) / 2;
        result[i] = Math.round(sweep * 255);
        result[i + 1] = Math.round(127);
      }
      break;
      
    case 'rainbow':
      for (let i = 0; i < channels.length; i++) {
        const hue = (time * speed + i / channels.length) % 1;
        result[i] = Math.round(hue * 255);
      }
      break;
      
    case 'pulse':
      const pulse = (Math.sin(time * speed) + 1) / 2;
      for (let i = 0; i < channels.length; i++) {
        result[i] = Math.round(channels[i] * pulse);
      }
      break;
      
    case 'random':
      for (let i = 0; i < channels.length; i++) {
        result[i] = Math.round(Math.random() * 255);
      }
      break;
      
    case 'strobe':
      const strobe = Math.sin(time * speed * 10) > 0 ? 255 : 0;
      for (let i = 0; i < channels.length; i++) {
        result[i] = strobe;
      }
      break;
  }
  
  return result;
}
