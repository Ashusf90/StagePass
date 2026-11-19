import React from 'react';

interface EventArtworkProps {
  theme: 'symphony' | 'amphitheater' | 'summit' | 'theater';
  venueName?: string;
  className?: string;
}

export const EventArtwork: React.FC<EventArtworkProps> = ({
  theme,
  className = '',
}) => {
  if (theme === 'symphony') {
    return (
      <div
        className={`relative overflow-hidden bg-slate-900 select-none ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 300"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="sympBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="65%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <radialGradient id="sympGlow" cx="50%" cy="68%" r="55%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.42" />
              <stop offset="55%" stopColor="#d97706" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="300" fill="url(#sympBg)" />
          <rect width="400" height="300" fill="url(#sympGlow)" />
          {/* Acoustic shell arches */}
          {[180, 145, 110, 75].map((r, i) => (
            <path
              key={r}
              d={`M ${200 - r} 240 A ${r} ${r * 0.85} 0 0 1 ${200 + r} 240`}
              fill="none"
              stroke="#e2e8f0"
              strokeOpacity={0.09 + i * 0.05}
              strokeWidth="1.5"
            />
          ))}
          {/* Stage apron */}
          <ellipse cx="200" cy="246" rx="145" ry="24" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          {/* Vertical acoustic timber lines */}
          {Array.from({ length: 13 }).map((_, idx) => {
            const x = 56 + idx * 24;
            return (
              <line
                key={x}
                x1={x}
                y1="28"
                x2={x}
                y2="210"
                stroke="#f8fafc"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
    );
  }

  if (theme === 'amphitheater') {
    return (
      <div
        className={`relative overflow-hidden bg-slate-950 select-none ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 300"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="ampSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#090d16" />
              <stop offset="55%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#ampSky)" />
          {/* Light beams */}
          <polygon points="160,210 95,20 140,20 185,210" fill="url(#beam)" />
          <polygon points="200,210 182,10 218,10 212,210" fill="url(#beam)" />
          <polygon points="240,210 260,20 305,20 215,210" fill="url(#beam)" />
          {/* Canyon ridge silhouettes */}
          <path d="M0 190 L85 135 L145 170 L255 170 L325 130 L400 185 L400 300 L0 300 Z" fill="#0f172a" />
          {/* Tiered sandstone arcs */}
          {[0, 1, 2, 3, 4].map((step) => (
            <path
              key={step}
              d={`M 30 ${228 + step * 15} Q 200 ${202 + step * 15} 370 ${228 + step * 15}`}
              fill="none"
              stroke="#94a3b8"
              strokeOpacity={0.22 - step * 0.03}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (theme === 'summit') {
    return (
      <div
        className={`relative overflow-hidden bg-slate-900 select-none ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 300"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="sumBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#sumBg)" />
          {/* Architectural structural grid */}
          {Array.from({ length: 9 }).map((_, idx) => (
            <line
              key={`v-${idx}`}
              x1={40 + idx * 40}
              y1="24"
              x2={40 + idx * 40}
              y2="276"
              stroke="#334155"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 6 }).map((_, idx) => (
            <line
              key={`h-${idx}`}
              x1="40"
              y1={44 + idx * 42}
              x2="360"
              y2={44 + idx * 42}
              stroke="#334155"
              strokeWidth="1"
            />
          ))}
          {/* Keynote screen plane */}
          <rect
            x="92"
            y="62"
            width="216"
            height="118"
            rx="4"
            fill="#020617"
            stroke="#3b82f6"
            strokeOpacity="0.65"
            strokeWidth="1.5"
          />
          <line x1="120" y1="105" x2="245" y2="105" stroke="#60a5fa" strokeWidth="2" strokeOpacity="0.7" />
          <line x1="120" y1="126" x2="205" y2="126" stroke="#94a3b8" strokeWidth="1.5" strokeOpacity="0.45" />
          <rect x="64" y="218" width="272" height="36" fill="#020617" stroke="#475569" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-950 select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 300"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="thSpot" cx="50%" cy="22%" r="70%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill="#090d16" />
        <polygon points="200,14 90,248 310,248" fill="url(#thSpot)" />
        <ellipse cx="200" cy="242" rx="125" ry="22" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <path
          d="M 55 270 Q 200 228 345 270"
          fill="none"
          stroke="#64748b"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};
