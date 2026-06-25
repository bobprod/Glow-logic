"use client";

import { useEffect } from "react";
import useStore from "../../store/useStore";

interface LibraryModalProps {
  onClose: () => void;
}

export function LibraryModal({ onClose }: LibraryModalProps) {
  const { setIsSidebarVisible, setSmartSidebarPanel } = useStore();

  useEffect(() => {
    setIsSidebarVisible(true);
    setSmartSidebarPanel("library");
    onClose();
  }, [onClose, setIsSidebarVisible, setSmartSidebarPanel]);

  return null;
}
