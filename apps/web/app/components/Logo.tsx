import Link from "next/link";

interface LogoProps {
  variant?: "default" | "compact" | "icon";
  className?: string;
  showText?: boolean;
  textColor?: string;
}

export default function Logo({ variant = "default", className = "", showText = true, textColor }: LogoProps) {
  const baseClasses = "flex items-center gap-3";
  const textColorClass = textColor || "text-nuffle-anthracite";
  
  if (variant === "icon") {
    return (
      <Link href="/" className={`${baseClasses} ${className}`}>
        <img
          src="/images/logo.png"
          alt="Nuffle Arena"
          className="w-12 h-12 object-contain"
        />
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href="/" className={`${baseClasses} ${className}`}>
        <img
          src="/images/logo.png"
          alt="Nuffle Arena"
          className="w-10 h-10 object-contain"
        />
        {showText && (
          <span className={`font-logo ${textColorClass} text-xl tracking-wider`}>
            NUFFLE ARENA
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link href="/" className={`${baseClasses} ${className}`}>
      <img
        src="/images/logo.png"
        alt="Nuffle Arena"
        className="w-16 h-16 object-contain"
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-logo ${textColorClass} text-2xl md:text-3xl tracking-wider`}>
            NUFFLE ARENA
          </span>
          <span className="font-subtitle text-nuffle-bronze text-xs md:text-sm mt-0.5">
            Formez vos équipes. Défiez le destin.
          </span>
        </div>
      )}
    </Link>
  );
}

