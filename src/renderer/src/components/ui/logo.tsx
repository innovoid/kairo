interface LogoProps {
  className?: string;
  size?: number;
}

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
      {/* Outer architectural frame */}
      <rect
        x="10"
        y="10"
        width="80"
        height="80"
        stroke="#C9A962"
        strokeWidth="2"
        fill="none"
      />

      {/* Inner terminal window */}
      <rect
        x="20"
        y="25"
        width="60"
        height="50"
        stroke="#C9A962"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Stylized "A" as terminal prompt */}
      <path
        d="M 35 55 L 45 40 L 55 55 M 40 48 L 50 48"
        stroke="#C9A962"
        strokeWidth="2.5"
        strokeLinecap="square"
        fill="none"
      />

      {/* Terminal cursor */}
      <rect
        x="58"
        y="45"
        width="2"
        height="10"
        fill="#C9A962"
      >
        <animate
          attributeName="opacity"
          values="1;0;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Connection dots */}
      <circle cx="25" cy="18" r="1.5" fill="#C9A962" />
      <circle cx="30" cy="18" r="1.5" fill="#C9A962" opacity="0.6" />
      <circle cx="35" cy="18" r="1.5" fill="#C9A962" opacity="0.3" />
    </svg>
  );
}

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
      {/* Minimalist A with terminal aesthetic */}
      <path
        d="M 30 80 L 50 25 L 70 80 M 38 58 L 62 58"
        stroke="#C9A962"
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Architectural corner brackets */}
      <path
        d="M 20 20 L 20 35 M 20 20 L 35 20"
        stroke="#C9A962"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M 80 20 L 80 35 M 80 20 L 65 20"
        stroke="#C9A962"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M 20 80 L 20 65 M 20 80 L 35 80"
        stroke="#C9A962"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M 80 80 L 80 65 M 80 80 L 65 80"
        stroke="#C9A962"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

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
      {/* Terminal window shape */}
      <rect
        x="15"
        y="25"
        width="70"
        height="55"
        rx="2"
        stroke="#C9A962"
        strokeWidth="2.5"
        fill="#0A0A0A"
      />

      {/* Terminal header bar */}
      <rect
        x="15"
        y="25"
        width="70"
        height="10"
        fill="#C9A962"
        opacity="0.15"
      />

      {/* Window control dots */}
      <circle cx="23" cy="30" r="1.5" fill="#C9A962" opacity="0.6" />
      <circle cx="29" cy="30" r="1.5" fill="#C9A962" opacity="0.6" />
      <circle cx="35" cy="30" r="1.5" fill="#C9A962" opacity="0.6" />

      {/* Command prompt symbol */}
      <path
        d="M 25 45 L 32 52 L 25 59"
        stroke="#C9A962"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Cursor line */}
      <line
        x1="38"
        y1="52"
        x2="52"
        y2="52"
        stroke="#C9A962"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* SSH connection indicator */}
      <path
        d="M 65 45 L 65 59 M 60 50 L 65 45 L 70 50"
        stroke="#C9A962"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}
