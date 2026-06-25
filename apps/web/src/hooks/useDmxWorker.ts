"use client";

import { useEffect, useRef, useCallback } from "react";

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
  id?: string;
}

export function useDmxWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, (response: DmxWorkerResponse) => void>>(new Map());
  
  useEffect(() => {
    // Create worker on mount
    const worker = new Worker(
      new URL('./dmxWorker.ts', import.meta.url)
    );
    
    worker.onmessage = (event: MessageEvent<DmxWorkerResponse>) => {
      const { type, data, error } = event.data;
      const id = event.data.id || 'default';
      
      const callback = callbacksRef.current.get(id);
      if (callback) {
        callback({ type, data, error });
        callbacksRef.current.delete(id);
      }
    };
    
    worker.onerror = (error) => {
      console.error('DmxWorker error:', error);
    };
    
    workerRef.current = worker;
    
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);
  
  const sendMessage = useCallback((message: DmxWorkerMessage, callback?: (response: DmxWorkerResponse) => void): Promise<DmxWorkerResponse> => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      
      const timeout = setTimeout(() => {
        callbacksRef.current.delete(id);
        reject(new Error('Worker timeout'));
      }, 5000);
      
      const handleResponse = (response: DmxWorkerResponse) => {
        clearTimeout(timeout);
        if (callback) callback(response);
        resolve(response);
      };
      
      callbacksRef.current.set(id, handleResponse);
      
      if (workerRef.current) {
        workerRef.current.postMessage({ ...message, id });
      } else {
        reject(new Error('Worker not initialized'));
      }
    });
  }, []);
  
  const interpolate = useCallback((from: number[], to: number[], duration: number, easing: string = 'linear'): Promise<number[]> => {
    return sendMessage({
      type: 'interpolate',
      payload: { from, to, duration, easing }
    }).then(response => {
      if (response.type === 'error') {
        throw new Error(response.error || 'Interpolation failed');
      }
      return response.data;
    });
  }, [sendMessage]);
  
  const calculateEffect = useCallback((pattern: string, params: Record<string, number>, channels: number[]): Promise<number[]> => {
    return sendMessage({
      type: 'effect',
      payload: { pattern, params, channels }
    }).then(response => {
      if (response.type === 'error') {
        throw new Error(response.error || 'Effect calculation failed');
      }
      return response.data;
    });
  }, [sendMessage]);
  
  return {
    sendMessage,
    interpolate,
    calculateEffect,
  };
}

export default useDmxWorker;
