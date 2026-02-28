/**
 * ArchTerm Logo Components
 * Emerald theme — consistent with global primary color
 */

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Full ArchTerm Logo with animated elements
 * Use for splash screens, about pages, large displays
 */
export function ArchTermLogo({ className = '', size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gradient Definitions */}
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="logo-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer frame - refined brutalist corners */}
      <path
        d="M 15 15 L 15 30 M 15 15 L 30 15"
        stroke="url(#logo-gradient)"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path
        d="M 85 15 L 85 30 M 85 15 L 70 15"
        stroke="url(#logo-gradient)"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path
        d="M 15 85 L 15 70 M 15 85 L 30 85"
        stroke="url(#logo-gradient)"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path
        d="M 85 85 L 85 70 M 85 85 L 70 85"
        stroke="url(#logo-gradient)"
        strokeWidth="3"
        strokeLinecap="square"
      />

      {/* Terminal window container */}
      <rect
        x="25"
        y="30"
        width="50"
        height="45"
        rx="2"
        stroke="#10b981"
        strokeWidth="2"
        fill="none"
        opacity="0.6"
      />

      {/* Stylized "AT" monogram */}
      <text
        x="50"
        y="62"
        fontFamily="monospace"
        fontSize="28"
        fontWeight="700"
        fill="url(#logo-gradient)"
        textAnchor="middle"
        filter="url(#logo-glow)"
      >
        AT
      </text>

      {/* Animated cursor */}
      <rect
        x="64"
        y="48"
        width="2.5"
        height="14"
        fill="#34d399"
        rx="1"
      >
        <animate
          attributeName="opacity"
          values="1;0;1"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Connection indicator dots */}
      <circle cx="30" cy="25" r="1.5" fill="#10b981">
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="36" cy="25" r="1.5" fill="#10b981">
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur="2s"
          begin="0.3s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="42" cy="25" r="1.5" fill="#34d399">
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur="2s"
          begin="0.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

/**
 * Simple ArchTerm Logo - Clean geometric design
 * Use for navigation, headers, compact spaces
 */
export function ArchTermLogoSimple({ className = '', size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gradient Definition */}
      <defs>
        <linearGradient id="simple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {/* Modern geometric "A" shape */}
      <path
        d="M 35 75 L 50 30 L 65 75 M 42 57 L 58 57"
        stroke="url(#simple-gradient)"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Terminal bracket accent - left */}
      <path
        d="M 22 40 L 28 46 L 22 52"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
        opacity="0.7"
      />

      {/* Terminal bracket accent - right */}
      <path
        d="M 78 40 L 72 46 L 78 52"
        stroke="#34d399"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
        opacity="0.7"
      />

      {/* Corner accents - minimal refined brutalist style */}
      <rect x="20" y="20" width="2" height="8" fill="#10b981" opacity="0.5" />
      <rect x="20" y="20" width="8" height="2" fill="#10b981" opacity="0.5" />
      <rect x="78" y="20" width="2" height="8" fill="#34d399" opacity="0.5" />
      <rect x="72" y="20" width="8" height="2" fill="#34d399" opacity="0.5" />
    </svg>
  );
}

/**
 * Icon Logo - Compact terminal window design
 * Use for favicons, app icons, small UI elements
 */
export function ArchTermLogoIcon({ className = '', size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gradient Definition */}
      <defs>
        <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="glow-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Terminal window with gradient fill */}
      <rect
        x="15"
        y="25"
        width="70"
        height="55"
        rx="3"
        fill="#052e16"
        stroke="url(#icon-gradient)"
        strokeWidth="2.5"
      />

      {/* Glow effect inside */}
      <rect
        x="18"
        y="28"
        width="64"
        height="49"
        rx="2"
        fill="url(#glow-gradient)"
      />

      {/* Terminal header bar */}
      <rect
        x="15"
        y="25"
        width="70"
        height="12"
        fill="url(#icon-gradient)"
        opacity="0.15"
      />

      {/* Window control dots */}
      <circle cx="23" cy="31" r="2" fill="#10b981" />
      <circle cx="31" cy="31" r="2" fill="#34d399" />
      <circle cx="39" cy="31" r="2" fill="#10b981" opacity="0.5" />

      {/* Stylized "AT" monogram */}
      <text
        x="50"
        y="62"
        fontFamily="monospace"
        fontSize="24"
        fontWeight="700"
        fill="url(#icon-gradient)"
        textAnchor="middle"
      >
        AT
      </text>

      {/* Terminal prompt chevron */}
      <path
        d="M 28 68 L 33 73 L 28 78"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />

      {/* Cursor indicator */}
      <rect
        x="70"
        y="68"
        width="2"
        height="10"
        fill="#34d399"
        rx="1"
      />
    </svg>
  );
}

/**
 * Wordmark Logo - Full brand with text
 * Use for marketing, documentation, large headers
 */
export function ArchTermWordmark({ className = '', size = 120 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size * 0.35}
      viewBox="0 0 200 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gradient Definition */}
      <defs>
        <linearGradient id="wordmark-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {/* Icon part */}
      <rect
        x="5"
        y="12"
        width="30"
        height="22"
        rx="2"
        fill="#052e16"
        stroke="url(#wordmark-gradient)"
        strokeWidth="2"
      />
      <text
        x="20"
        y="29"
        fontFamily="monospace"
        fontSize="12"
        fontWeight="700"
        fill="url(#wordmark-gradient)"
        textAnchor="middle"
      >
        AT
      </text>

      {/* "ArchTerm" text */}
      <text
        x="45"
        y="35"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="28"
        fontWeight="600"
        fill="url(#wordmark-gradient)"
        letterSpacing="-0.5"
      >
        ArchTerm
      </text>

      {/* Tagline */}
      <text
        x="45"
        y="50"
        fontFamily="monospace"
        fontSize="10"
        fill="#A1A1AA"
        letterSpacing="1"
      >
        REFINED SSH CLIENT
      </text>
    </svg>
  );
}
