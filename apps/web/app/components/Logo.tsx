import Link from "next/link";
import Image from "next/image";

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
        <Image
          src="/images/logo.webp"
          alt="Nuffle Arena"
          width={48}
          height={48}
          className="object-contain"
          priority
        />
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href="/" className={`${baseClasses} ${className}`}>
        <Image
          src="/images/logo.webp"
          alt="Nuffle Arena"
          width={40}
          height={40}
          className="object-contain"
          priority
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
      <Image
        src="/images/logo.webp"
        alt="Nuffle Arena"
        width={64}
        height={64}
        className="object-contain"
        priority
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

