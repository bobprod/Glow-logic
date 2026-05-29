"use client";

import React from "react";
import { Wand2, Loader2 } from "lucide-react";

interface AiSuggestButtonProps {
  onClick: () => void;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  tooltip?: string;
  disabled?: boolean;
}

export default function AiSuggestButton({
  onClick,
  loading = false,
  size = "sm",
  tooltip = "Demander à l'IA",
  disabled = false,
}: AiSuggestButtonProps) {
  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      title={tooltip}
      className={`
        ${sizeClasses[size]} rounded-lg 
        bg-gradient-to-r from-cyan-500/20 to-purple-500/20 
        hover:from-cyan-500/30 hover:to-purple-500/30 
        border border-cyan-500/30 
        text-cyan-400 hover:text-white 
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        group
      `}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Wand2
          className={`${iconSizes[size]} group-hover:scale-110 transition-transform`}
        />
      )}
    </button>
  );
}
