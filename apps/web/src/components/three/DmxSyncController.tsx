"use client";

import { useRef, useEffect } from "react";
import { socket } from "../../lib/socket";

// Global store: key = "universe:channel" → value = 0-255
export const dmxChannelStore = new Map<string, number>();

// Subscribers for reactivity
const subscribers = new Set<() => void>();

export function subscribeDmxStore(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getDmxChannel(universe: number, channel: number): number {
  return dmxChannelStore.get(`${universe}:${channel}`) ?? 0;
}

export function setDmxChannel(universe: number, channel: number, value: number) {
  dmxChannelStore.set(`${universe}:${channel}`, value);
  subscribers.forEach((fn) => fn());
}

export default function DmxSyncController() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const handleDmx = (data: { universe: number; channel: number; value: number }) => {
      setDmxChannel(data.universe, data.channel, data.value);
    };

    socket.on("dmx_sync", handleDmx);
    return () => {
      socket.off("dmx_sync", handleDmx);
    };
  }, []);

  return null;
}
