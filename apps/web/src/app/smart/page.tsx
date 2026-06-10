'use client';

import React, { useEffect } from 'react';
import TopBar from '../../components/TopBar';
import SmartDashboard from '../../components/SmartDashboard';
import MacroTimeline from '../../components/MacroTimeline';
import MidiListener from "../../components/MidiListener";
import { ToastContainer } from "../../components/ui/ToastContainer";
import useStore from '../../store/useStore';

export default function SmartRoutePage() {
  const { setAppMode } = useStore();

  // Keep appMode in store synced to 'smart' when on this route
  useEffect(() => {
    setAppMode('smart');
  }, [setAppMode]);

  return (
    <div className="flex flex-col w-screen h-screen bg-black overflow-hidden relative select-none">
      <MidiListener />
      <ToastContainer />
      <TopBar />

      <div className="flex-1 flex overflow-hidden relative">
        <SmartDashboard />
      </div>
      <MacroTimeline />
    </div>
  );
}
