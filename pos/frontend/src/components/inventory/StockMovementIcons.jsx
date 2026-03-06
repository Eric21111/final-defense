import React from 'react';

// Stock-In Icon: Green cube with green circle containing white plus sign
export const StockInIcon = ({ size = 20, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Isometric cube - top face (lightest) */}
      <path
        d="M8 8L12 6L16 8L12 10L8 8Z"
        fill="white"
        stroke="#22C55E"
        strokeWidth="1.5"
      />
      {/* Isometric cube - front face */}
      <path
        d="M8 8V14L12 16V10L8 8Z"
        fill="white"
        stroke="#22C55E"
        strokeWidth="1.5"
      />
      {/* Isometric cube - right face (darker) */}
      <path
        d="M16 8V14L12 16V10L16 8Z"
        fill="white"
        stroke="#22C55E"
        strokeWidth="1.5"
      />
      {/* Green circle with plus sign in bottom-right */}
      <circle
        cx="19"
        cy="19"
        r="3.5"
        fill="#22C55E"
      />
      <path
        d="M19 16.5V21.5M16.5 19H21.5"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

// Stock-Out Icon: Dark grey cube with red circle containing white minus sign
export const StockOutIcon = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Isometric cube - top face (lightest) */}
      <path
        d="M8 8L12 6L16 8L12 10L8 8Z"
        fill="white"
        stroke="#4B5563"
        strokeWidth="1.5"
      />
      {/* Isometric cube - front face */}
      <path
        d="M8 8V14L12 16V10L8 8Z"
        fill="white"
        stroke="#4B5563"
        strokeWidth="1.5"
      />
      {/* Isometric cube - right face (darker) */}
      <path
        d="M16 8V14L12 16V10L16 8Z"
        fill="white"
        stroke="#4B5563"
        strokeWidth="1.5"
      />
      {/* Red circle with minus sign in bottom-right */}
      <circle
        cx="19"
        cy="19"
        r="3.5"
        fill="#EF4444"
      />
      <path
        d="M16.5 19H21.5"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

// Pull-Out Icon: Same as Stock-Out (dark grey cube with red circle containing white minus sign)
export const PullOutIcon = ({ size = 24, className = '' }) => {
  return <StockOutIcon size={size} className={className} />;
};

