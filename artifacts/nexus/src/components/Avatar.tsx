import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  storyRing?: boolean;
  online?: boolean;
}

const sizeMap = {
  xs:  "w-6 h-6 text-[10px]",
  sm:  "w-8 h-8 text-xs",
  md:  "w-10 h-10 text-sm",
  lg:  "w-12 h-12 text-base",
  xl:  "w-16 h-16 text-xl",
  "2xl": "w-20 h-20 text-2xl",
};

const onlineDotSize: Record<string, string> = {
  xs:  "w-2 h-2 border-[1.5px]",
  sm:  "w-2.5 h-2.5 border-2",
  md:  "w-3 h-3 border-2",
  lg:  "w-3.5 h-3.5 border-2",
  xl:  "w-4 h-4 border-[3px]",
  "2xl": "w-4 h-4 border-[3px]",
};

const GRADIENT_PAIRS = [
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-600",
  "from-indigo-400 to-violet-600",
  "from-cyan-400 to-blue-500",
];

function getGradient(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return GRADIENT_PAIRS[code % GRADIENT_PAIRS.length];
}

export function Avatar({ src, name = "?", size = "md", className, storyRing, online }: AvatarProps) {
  const initials = getInitials(name || "?");
  const sizeClass = sizeMap[size] ?? sizeMap.md;
  const gradient  = getGradient(name);

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      {storyRing ? (
        <div className={cn("rounded-full p-[2.5px] story-ring", sizeClass)}>
          <div className="w-full h-full rounded-full bg-background p-[2px] overflow-hidden">
            <AvatarInner src={src} initials={initials} gradient={gradient} />
          </div>
        </div>
      ) : (
        <div className={cn("rounded-full overflow-hidden", sizeClass)}>
          <AvatarInner src={src} initials={initials} gradient={gradient} />
        </div>
      )}

      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-green-500 border-background",
            onlineDotSize[size] ?? onlineDotSize.md,
            "shadow-sm"
          )}
          style={{ boxShadow: "0 0 6px rgba(74,222,128,0.6)" }}
        />
      )}
    </div>
  );
}

function AvatarInner({ src, initials, gradient }: { src?: string | null; initials: string; gradient: string }) {
  if (src) {
    return <img src={src} alt={initials} className="w-full h-full object-cover" />;
  }
  return (
    <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br font-bold text-white select-none", gradient)}>
      {initials}
    </div>
  );
}
