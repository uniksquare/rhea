import React from "react";

// Common googly eye sub-component
export function GooglyEyes({ className = "" }: { className?: string }) {
  return (
    <g className={`transition-transform duration-300 ease-out group-hover:scale-105 ${className}`}>
      {/* Left Eye */}
      <circle cx="40" cy="50" r="12" fill="white" stroke="#272727" strokeWidth="2.5" />
      <circle cx="42" cy="52" r="5" fill="#272727" className="transition-all duration-300 group-hover:translate-x-1 group-hover:translate-y-[-1px]" />
      
      {/* Right Eye */}
      <circle cx="68" cy="50" r="12" fill="white" stroke="#272727" strokeWidth="2.5" />
      <circle cx="66" cy="52" r="5" fill="#272727" className="transition-all duration-300 group-hover:translate-x-[-1px] group-hover:translate-y-[-1px]" />
    </g>
  );
}

// Smile sub-component
export function Smile({ className = "" }: { className?: string }) {
  return (
    <path
      d="M48 68 Q54 74 60 68"
      stroke="#272727"
      strokeWidth="3.5"
      strokeLinecap="round"
      fill="none"
      className={`transition-all duration-300 group-hover:d-M44 66 Q54 78 64 66 ${className}`}
    />
  );
}

// 3D Play-Doh Green Sphere - Evan
export function EvanMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group cursor-pointer select-none transition-transform duration-500 hover:scale-105 ${className}`}
    >
      <defs>
        <radialGradient id="evanGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="40%" stopColor="#10b981" />
          <stop offset="90%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064e3b" />
        </radialGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Body Sphere */}
      <circle cx="54" cy="54" r="46" fill="url(#evanGrad)" filter="url(#shadow)" />
      
      {/* Face elements */}
      <g className="translate-y-1">
        <GooglyEyes />
        <Smile />
      </g>
    </svg>
  );
}

// 3D Play-Doh Blue Cylinder - Atlas
export function AtlasMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group cursor-pointer select-none transition-transform duration-500 hover:scale-105 ${className}`}
    >
      <defs>
        <linearGradient id="atlasSide" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="25%" stopColor="#60a5fa" />
          <stop offset="70%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id="atlasTop" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>
      
      {/* Body Cylinder */}
      <g filter="url(#shadow)">
        {/* Main Pillar Body */}
        <path d="M24 32 C24 40, 84 40, 84 32 L84 80 C84 88, 24 88, 24 80 Z" fill="url(#atlasSide)" />
        {/* Top Cap */}
        <ellipse cx="54" cy="32" rx="30" ry="12" fill="url(#atlasTop)" stroke="#2563eb" strokeWidth="1" />
      </g>

      {/* Face elements positioned on the side */}
      <g className="translate-y-[8px]">
        <GooglyEyes />
        <Smile />
      </g>
    </svg>
  );
}

// 3D Play-Doh Yellow Pyramid / Cone - Nico
export function NicoMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group cursor-pointer select-none transition-transform duration-500 hover:scale-105 ${className}`}
    >
      <defs>
        <radialGradient id="nicoGrad" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="90%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#713f12" />
        </radialGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Body Pyramid/Cone */}
      <path
        d="M54 12 L92 86 C92 94, 16 94, 16 86 Z"
        fill="url(#nicoGrad)"
        filter="url(#shadow)"
        strokeLinejoin="round"
      />
      {/* Face elements */}
      <g className="translate-y-[16px]">
        <GooglyEyes className="scale-95 origin-center" />
        <Smile />
      </g>
    </svg>
  );
}

// 3D Play-Doh Teal Pentagon - Nova
export function NovaMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group cursor-pointer select-none transition-transform duration-500 hover:scale-105 ${className}`}
    >
      <defs>
        <radialGradient id="novaGrad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#99f6e4" />
          <stop offset="45%" stopColor="#0d9488" />
          <stop offset="85%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#115e59" />
        </radialGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Body Pentagon */}
      <polygon
        points="54,16 92,44 78,88 30,88 16,44"
        fill="url(#novaGrad)"
        filter="url(#shadow)"
      />
      {/* Face elements */}
      <g className="translate-y-[6px]">
        <GooglyEyes className="scale-[0.9] origin-center" />
        <Smile />
      </g>
    </svg>
  );
}

// 3D Play-Doh Pink/Magenta Teardrop - Iris
export function IrisMascot({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`group cursor-pointer select-none transition-transform duration-500 hover:scale-105 ${className}`}
    >
      <defs>
        <radialGradient id="irisGrad" cx="35%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="40%" stopColor="#ec4899" />
          <stop offset="85%" stopColor="#be185d" />
          <stop offset="100%" stopColor="#831843" />
        </radialGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Body Teardrop */}
      <path
        d="M54 12 C68 34, 88 56, 88 74 C88 92, 72 100, 54 100 C36 100, 20 92, 20 74 C20 56, 40 34, 54 12 Z"
        fill="url(#irisGrad)"
        filter="url(#shadow)"
      />
      {/* Face elements */}
      <g className="translate-y-[14px]">
        <GooglyEyes className="scale-[0.88] origin-center" />
        <Smile />
      </g>
    </svg>
  );
}

// Mascot Row Display (containing all 5)
export function MascotRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-end justify-center gap-1.5 sm:gap-3 p-4 ${className}`}>
      <EvanMascot size={72} className="-rotate-6 hover:-rotate-12 transition-transform" />
      <AtlasMascot size={74} className="hover:-translate-y-1.5 transition-transform" />
      <NicoMascot size={78} className="rotate-3 hover:rotate-12 transition-transform" />
      <NovaMascot size={74} className="-rotate-3 hover:-rotate-6 transition-transform" />
      <IrisMascot size={72} className="rotate-6 hover:rotate-12 transition-transform" />
    </div>
  );
}
