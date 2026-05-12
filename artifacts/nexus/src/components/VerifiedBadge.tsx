import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export function VerifiedBadge({ size = "sm", className }: VerifiedBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center flex-shrink-0", sizes[size], className)}
      title="Verified Vibes ✅"
    >
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="rizz-verified-grad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Starburst / shield shape */}
        <path
          d="M10 1.5L12.1 4.2L15.4 3.3L15.8 6.7L18.8 8.1L17.2 11L18.8 13.9L15.8 15.3L15.4 18.7L12.1 17.8L10 20.5L7.9 17.8L4.6 18.7L4.2 15.3L1.2 13.9L2.8 11L1.2 8.1L4.2 6.7L4.6 3.3L7.9 4.2Z"
          fill="url(#rizz-verified-grad)"
        />
        {/* Checkmark */}
        <path
          d="M6.5 10.5L8.8 12.8L13.5 8"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
