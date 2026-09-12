interface FlowerIllustrationProps {
  className?: string;
}

export function FlowerIllustration({ className = "" }: FlowerIllustrationProps) {
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
          {/* Warm Petal Gradients */}
          <radialGradient id="bloomCoreWarm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.8" />
            <stop offset="35%" stopColor="#fb923c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="petalCoralPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="petalPeach" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#fb923c" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="petalRoseGold" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#fff1f2" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#fecdd3" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="stemSage" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="leafSage" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>

          {/* Soft blur for ambient aura */}
          <filter id="bloomAura" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>

        {/* Ambient Warm Golden Sunburst Glow */}
        <circle
          cx="330"
          cy="300"
          r="190"
          fill="url(#bloomCoreWarm)"
          filter="url(#bloomAura)"
          opacity="0.6"
        />

        {/* Organic Curving Stems & Foliage */}
        <g className="animate-flower-sway" style={{ transformOrigin: "330px 520px" }}>
          {/* Main graceful arching stem */}
          <path
            d="M 320 540 C 315 440, 360 380, 330 310"
            stroke="url(#stemSage)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Branch to left blossom */}
          <path
            d="M 326 430 C 270 410, 210 380, 180 320"
            stroke="url(#stemSage)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Branch to top right bud */}
          <path
            d="M 335 370 C 390 320, 440 260, 460 200"
            stroke="url(#stemSage)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Sculptural Organic Leaves */}
          <path
            d="M 322 460 C 260 480, 240 440, 260 425 C 290 410, 310 445, 322 460 Z"
            fill="url(#leafSage)"
            stroke="#059669"
            strokeWidth="1"
            opacity="0.85"
          />
          <path
            d="M 334 395 C 410 410, 420 370, 395 355 C 365 340, 345 375, 334 395 Z"
            fill="url(#leafSage)"
            stroke="#059669"
            strokeWidth="1"
            opacity="0.85"
          />
          <path
            d="M 195 340 C 150 350, 140 320, 160 310 C 180 300, 195 325, 195 340 Z"
            fill="url(#leafSage)"
            stroke="#059669"
            strokeWidth="0.8"
            opacity="0.8"
          />
        </g>

        {/* Blossom 2: Left expressive Poppy (Medium) */}
        <g
          className="animate-flower-breathe"
          style={{ transformOrigin: "180px 320px", animationDelay: "-1.5s" }}
        >
          {/* Back petals */}
          <circle cx="180" cy="320" r="42" fill="url(#petalPeach)" opacity="0.85" />
          <path
            d="M 180 320 Q 140 270 175 250 Q 220 270 180 320 Z"
            fill="url(#petalCoralPrimary)"
          />
          <path
            d="M 180 320 Q 130 330 140 370 Q 185 365 180 320 Z"
            fill="url(#petalRoseGold)"
          />
          <path
            d="M 180 320 Q 230 330 220 370 Q 180 360 180 320 Z"
            fill="url(#petalCoralPrimary)"
          />
          {/* Blossom Center */}
          <circle cx="180" cy="320" r="14" fill="#fbbf24" />
          <circle cx="180" cy="320" r="7" fill="#78350f" />
        </g>

        {/* Blossom 3: Upper-Right Sunlit Wildflower Bud (Small) */}
        <g
          className="animate-flower-sway"
          style={{ transformOrigin: "460px 200px", animationDelay: "-3s" }}
        >
          <path
            d="M 460 200 C 430 160, 480 140, 490 170 C 500 195, 475 210, 460 200 Z"
            fill="url(#petalPeach)"
            opacity="0.9"
          />
          <path
            d="M 460 200 C 470 150, 430 140, 420 175 C 420 205, 445 210, 460 200 Z"
            fill="url(#petalRoseGold)"
            opacity="0.9"
          />
          <circle cx="458" cy="188" r="8" fill="#f59e0b" />
        </g>

        {/* Blossom 1: Main Statement Peony / Lotus (Largest) */}
        <g
          className="animate-flower-breathe"
          style={{ transformOrigin: "330px 300px" }}
        >
          {/* Outer Layer Petals (6 large sweeping petals) */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <path
              key={`outer-petal-${deg}`}
              d="M 330 300 C 270 200, 390 200, 330 300 Z"
              fill={i % 2 === 0 ? "url(#petalCoralPrimary)" : "url(#petalPeach)"}
              transform={`rotate(${deg}, 330, 300) scale(1.35)`}
              opacity="0.82"
              stroke="#fff"
              strokeWidth="0.5"
              strokeOpacity="0.4"
            />
          ))}

          {/* Intermediate Layer Petals (Offset by 30 deg for rich volume) */}
          {[30, 90, 150, 210, 270, 330].map((deg, i) => (
            <path
              key={`mid-petal-${deg}`}
              d="M 330 300 C 285 225, 375 225, 330 300 Z"
              fill={i % 2 === 0 ? "url(#petalRoseGold)" : "url(#petalCoralPrimary)"}
              transform={`rotate(${deg}, 330, 300) scale(1.12)`}
              opacity="0.9"
              stroke="#fed7aa"
              strokeWidth="0.75"
              strokeOpacity="0.6"
            />
          ))}

          {/* Inner Cupped Petals */}
          {[15, 75, 135, 195, 255, 315].map((deg) => (
            <path
              key={`inner-petal-${deg}`}
              d="M 330 300 C 295 245, 365 245, 330 300 Z"
              fill="url(#petalRoseGold)"
              transform={`rotate(${deg}, 330, 300) scale(0.85)`}
              opacity="0.96"
            />
          ))}

          {/* Stamen Radiating Filaments */}
          {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 330 + 26 * Math.cos(rad);
            const y2 = 300 + 26 * Math.sin(rad);
            return (
              <g key={`stamen-${deg}`}>
                <line
                  x1="330"
                  y1="300"
                  x2={x2}
                  y2={y2}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx={x2} cy={y2} r="2.8" fill="#d97706" />
              </g>
            );
          })}

          {/* Central Golden Core / Stigma */}
          <circle cx="330" cy="300" r="15" fill="#fef08a" />
          <circle cx="330" cy="300" r="10" fill="#f59e0b" />
          <circle cx="330" cy="300" r="5" fill="#b45309" />
        </g>

        {/* Floating Spores & Delicate Petals Drifting in the breeze */}
        <g opacity="0.8">
          <path
            d="M 450 380 Q 480 370 470 395 Q 445 400 450 380 Z"
            fill="url(#petalRoseGold)"
            className="animate-flower-sway"
            style={{ transformOrigin: "460px 385px", animationDuration: "5s" }}
          />
          <path
            d="M 230 210 Q 250 190 260 215 Q 240 225 230 210 Z"
            fill="url(#petalPeach)"
            className="animate-flower-sway"
            style={{ transformOrigin: "245px 210px", animationDuration: "6s" }}
          />
          <circle cx="490" cy="320" r="2.5" fill="#f59e0b" opacity="0.6" />
          <circle cx="380" cy="180" r="3" fill="#fb923c" opacity="0.7" />
          <circle cx="270" cy="160" r="2" fill="#fda4af" opacity="0.5" />
          <circle cx="210" cy="460" r="2.5" fill="#6ee7b7" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
