import React, { useState } from "react";

interface LogoProps {
  className?: string;
  size?: number;
  variant?: "colorful" | "white" | "glow" | "animated" | "static";
  isStatic?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 48, 
  variant = "animated",
  isStatic = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // Determine logo stroke color/gradient
  // Since the user requested the logo draft to be plain white while keeping the background aura animations:
  const strokeColor = "#FFFFFF";

  const isFrozen = isStatic || variant === "static";

  return (
    <div 
      className={`relative flex items-center justify-center select-none cursor-pointer ${className}`} 
      style={{ 
        width: size, 
        height: className.includes("h-auto") ? "auto" : size,
        transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      }}
      id="madar-logo-container"
      onMouseEnter={() => { if (!isFrozen) setIsHovered(true); }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsClicked(false);
      }}
      onMouseDown={() => { if (!isFrozen) setIsClicked(true); }}
      onMouseUp={() => setIsClicked(false)}
    >
      {/* 1. Fast Spinning Vibrant Background Aura (Behind transparent logo) */}
      <div 
        className={`absolute inset-[-15%] rounded-full opacity-70 pointer-events-none mix-blend-screen transition-all duration-300 ${
          isHovered ? "scale-125 opacity-90" : "scale-100"
        } ${isFrozen ? "" : "animate-fast-glow-spin"}`}
        style={{
          background: "radial-gradient(circle, rgba(0, 191, 255, 0.5) 0%, rgba(139, 92, 246, 0.45) 45%, rgba(244, 63, 94, 0.3) 75%, transparent 100%)",
          filter: "blur(12px)",
        }}
      />

      {/* 2. Rapid Pulsing Secondary Color-Glow Injector */}
      <div 
        className={`absolute inset-[-5%] rounded-full opacity-55 pointer-events-none mix-blend-screen transition-all duration-3s ${
          isHovered ? "opacity-75 blur-[10px]" : ""
        } ${isFrozen ? "" : "animate-rapid-glow-pulse"}`}
        style={{
          background: "linear-gradient(135deg, rgba(6, 182, 212, 0.4), rgba(168, 85, 247, 0.4), rgba(244, 63, 94, 0.35))",
          filter: "blur(15px)",
        }}
      />

      {/* 3. The Interactive Logo SVG Itself - Custom high-speed float animation & hover-reactive scaling */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full relative z-10 transition-transform duration-300 ${
          isClicked ? "scale-90" : isHovered ? "scale-110" : ""
        } ${isFrozen ? "" : "animate-fast-interactive-logo"}`}
      >
        <defs>
          {/* Pristine high-contrast static corporate gradient (No color shifting/pulsing stop lines) */}
          <linearGradient id="madar-logo-crisp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#00BFFF" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        <g stroke={strokeColor} strokeWidth="9.5" strokeLinecap="butt" strokeLinejoin="miter">
          {/* Path 1: Left Symmetrical Outer Circle Arc */}
          <path d="M 48 11.5 A 38.5 38.5 0 0 0 48 88.5" />
          
          {/* Path 2: Symmetrical Right Outer Circle Arc */}
          <path d="M 52 11.5 A 38.5 38.5 0 0 1 52 88.5" />

          {/* Path 3: Inner Arch (Inverted U) with connection to Left Arc and flat right leg */}
          <path d="M 35 76 L 35 50 A 15 15 0 0 1 65 50 L 65 71" />
        </g>
      </svg>
    </div>
  );
};
