import React from "react";

interface GearProps {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  toothDepth?: number;
  innerRadius?: number;
  className?: string;
  speedClass?: string;
  strokeColor?: string;
  fillColor?: string;
  accentTicks?: boolean;
}

function makeGearPath(
  cx: number,
  cy: number,
  r: number,
  teeth: number,
  toothDepth: number
): string {
  const outerR = r + toothDepth;
  const innerR = r - toothDepth * 0.4;
  const numPoints = teeth * 4;
  const angleStep = (Math.PI * 2) / numPoints;

  let path = "";
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep;
    const mod = i % 4;
    const currentR = mod === 0 || mod === 1 ? outerR : innerR;
    const x = cx + currentR * Math.cos(angle);
    const y = cy + currentR * Math.sin(angle);

    if (i === 0) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  path += " Z";
  return path;
}

export function GearUnit({
  cx,
  cy,
  radius,
  teeth,
  toothDepth = 8,
  innerRadius,
  speedClass = "animate-spin-cw-slow",
  strokeColor = "#38bdf8",
  fillColor = "rgba(15, 23, 42, 0.4)",
  accentTicks = true,
}: GearProps) {
  const innerR = innerRadius ?? radius * 0.45;
  const gearPath = makeGearPath(cx, cy, radius, teeth, toothDepth);

  return (
    <g
      className={`origin-center ${speedClass}`}
      style={{
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      {/* Outer Pitch Diameter Ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius + toothDepth * 1.5}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.75"
        strokeDasharray="2 4"
        opacity="0.3"
      />

      {/* Main Gear Teeth & Body */}
      <path
        d={gearPath}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity="0.8"
      />

      {/* Structural Inner Ring */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="rgba(10, 15, 29, 0.7)"
        stroke={strokeColor}
        strokeWidth="1"
        strokeOpacity="0.6"
      />

      {/* Central Hub Axle */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR * 0.35}
        fill={strokeColor}
        fillOpacity="0.35"
        stroke={strokeColor}
        strokeWidth="1.25"
      />

      {/* Center Pin */}
      <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" opacity="0.9" />

      {/* Mechanical Spokes */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + innerR * 0.35 * Math.cos(rad);
        const y1 = cy + innerR * 0.35 * Math.sin(rad);
        const x2 = cx + innerR * Math.cos(rad);
        const y2 = cy + innerR * Math.sin(rad);
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth="1"
            strokeOpacity="0.5"
          />
        );
      })}

      {/* Subtle Precision Ticks */}
      {accentTicks &&
        [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const r1 = radius + toothDepth * 1.8;
          const r2 = radius + toothDepth * 2.1;
          return (
            <line
              key={`tick-${deg}`}
              x1={cx + r1 * Math.cos(rad)}
              y1={cy + r1 * Math.sin(rad)}
              x2={cx + r2 * Math.cos(rad)}
              y2={cy + r2 * Math.sin(rad)}
              stroke={strokeColor}
              strokeWidth="0.75"
              strokeOpacity="0.4"
            />
          );
        })}
    </g>
  );
}

interface GearIllustrationProps {
  className?: string;
}

export function GearIllustration({ className = "" }: GearIllustrationProps) {
  return (
    <div
      className={`pointer-events-none relative select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 600 600"
        className="h-full w-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="gearCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="traceLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Ambient Glow */}
        <circle cx="260" cy="280" r="220" fill="url(#gearCoreGlow)" />

        {/* Subtle Architectural Blueprint Grid & Crosshairs */}
        <g stroke="#38bdf8" strokeOpacity="0.12" strokeWidth="0.75">
          <line x1="40" y1="280" x2="520" y2="280" strokeDasharray="3 6" />
          <line x1="260" y1="40" x2="260" y2="520" strokeDasharray="3 6" />
          <circle cx="260" cy="280" r="240" strokeDasharray="2 8" />
          <circle cx="260" cy="280" r="160" strokeDasharray="4 8" />
          {/* Coordinate cross marks */}
          <path d="M 250 280 H 270 M 260 270 V 290" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M 430 180 H 450 M 440 170 V 190" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M 130 390 H 150 M 140 380 V 400" strokeOpacity="0.3" strokeWidth="1" />
        </g>

        {/* Data / Signal Traces connecting components */}
        <path
          d="M 60 140 H 180 L 260 210 V 280"
          stroke="url(#traceLineGrad)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <path
          d="M 260 280 L 380 340 H 520"
          stroke="url(#traceLineGrad)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <circle cx="180" cy="140" r="3" fill="#38bdf8" fillOpacity="0.6" />
        <circle cx="380" cy="340" r="3" fill="#818cf8" fillOpacity="0.6" />

        {/* Gear 1: Central Primary Machinery Gear (Largest) */}
        <GearUnit
          cx={260}
          cy={280}
          radius={110}
          teeth={16}
          toothDepth={12}
          strokeColor="#38bdf8"
          fillColor="rgba(15, 23, 42, 0.55)"
          speedClass="animate-spin-cw-slow"
        />

        {/* Gear 2: Upper Interlocking API Cog (Medium) */}
        <GearUnit
          cx={410}
          cy={180}
          radius={70}
          teeth={10}
          toothDepth={9}
          strokeColor="#60a5fa"
          fillColor="rgba(15, 23, 42, 0.65)"
          speedClass="animate-spin-ccw-mid"
        />

        {/* Gear 3: Lower Data Processing Pinion */}
        <GearUnit
          cx={140}
          cy={390}
          radius={62}
          teeth={9}
          toothDepth={8}
          strokeColor="#818cf8"
          fillColor="rgba(15, 23, 42, 0.6)"
          speedClass="animate-spin-ccw-slow"
        />

        {/* Gear 4: High-frequency Satellite Pinion */}
        <GearUnit
          cx={390}
          cy={390}
          radius={44}
          teeth={7}
          toothDepth={6}
          strokeColor="#93c5fd"
          fillColor="rgba(15, 23, 42, 0.7)"
          speedClass="animate-spin-cw-mid"
          accentTicks={false}
        />

        {/* Gear 5: Micro sync wheel */}
        <GearUnit
          cx={160}
          cy={180}
          radius={32}
          teeth={6}
          toothDepth={5}
          strokeColor="#38bdf8"
          fillColor="rgba(15, 23, 42, 0.75)"
          speedClass="animate-spin-cw-slow"
          accentTicks={false}
        />

        {/* Technical Data Readout Markers */}
        <g
          fontFamily="var(--font-mono)"
          fontSize="8"
          fill="#94a3b8"
          letterSpacing="0.1em"
          opacity="0.65"
        >
          <text x="270" y="160">SYS_TORQUE // 99.98%</text>
          <text x="70" y="440">CLOCK_SYNC: 48.00 MHz</text>
          <text x="360" y="450">PIPELINE_IO // 0x7E3F</text>
        </g>
      </svg>
    </div>
  );
}
