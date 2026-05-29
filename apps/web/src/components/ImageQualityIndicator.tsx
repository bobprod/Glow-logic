"use client";

import React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

interface ImageQuality {
  score: number;
  isBlurry: boolean;
  isTooDark: boolean;
  isTooLight: boolean;
  isAngled: boolean;
  resolution: { width: number; height: number };
  suggestions: string[];
}

interface ImageQualityIndicatorProps {
  quality: ImageQuality;
}

export default function ImageQualityIndicator({
  quality,
}: ImageQualityIndicatorProps) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTextColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getIcon = (score: number) => {
    if (score >= 80)
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (score >= 60)
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="space-y-3">
      {/* Score bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400 font-medium">
            Qualité de l'image
          </span>
          <span
            className={`text-xs font-bold ${getTextColor(quality.score)}`}
          >
            {quality.score}%
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getColor(quality.score)}`}
            style={{ width: `${quality.score}%` }}
          />
        </div>
      </div>

      {/* Resolution info */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span>
          Résolution: {quality.resolution.width}x{quality.resolution.height}
        </span>
        {quality.resolution.width >= 1200 && (
          <span className="text-green-400">✓</span>
        )}
      </div>

      {/* Issues */}
      {(quality.isBlurry || quality.isTooDark || quality.isTooLight || quality.isAngled) && (
        <div className="flex flex-wrap gap-1.5">
          {quality.isBlurry && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">
              Flou
            </span>
          )}
          {quality.isTooDark && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">
              Trop sombre
            </span>
          )}
          {quality.isTooLight && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">
              Trop clair
            </span>
          )}
          {quality.isAngled && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px]">
              Incliné
            </span>
          )}
        </div>
      )}

      {/* Suggestions */}
      {quality.suggestions.length > 0 && (
        <div className="space-y-1.5">
          {quality.suggestions.map((suggestion, i) => (
            <div key={i} className="flex items-start gap-2">
              {getIcon(quality.score)}
              <p className="text-[11px] text-slate-400">{suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
