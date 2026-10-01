import * as React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Datum Small Logo Mark (replaces the 'R' mark in the sidebar)
 * Sharp, high-contrast, black & white cartographic geometric 'D' with datum zero-line.
 */
export function DatumLogoSmall({ size = 20, className = "", ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-text ${className}`}
      {...props}
    >
      {/* Geometric D outer silhouette */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 3H13C17.9706 3 22 7.02944 22 12C22 16.9706 17.9706 21 13 21H3V3ZM6.5 6.5V10.5H13C13.8284 10.5 14.5 11.1716 14.5 12C14.5 12.8284 13.8284 13.5 13 13.5H6.5V17.5H13C16.0376 17.5 18.5 15.0376 18.5 12C18.5 8.96243 16.0376 6.5 13 6.5H6.5Z"
        fill="currentColor"
      />
      {/* Horizontal Datum Zero Reference Line cutting through */}
      <rect x="1" y="11" width="10" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Datum Full Logo (Mark + Typography Wordmark)
 * Clean, modern black & white branding.
 */
export function DatumLogoFull({ size = 20, className = "", ...props }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <DatumLogoSmall size={size} {...props} />
      <span className="font-bold tracking-wider text-text text-sm font-sans uppercase">
        DATUM
      </span>
    </div>
  );
}
