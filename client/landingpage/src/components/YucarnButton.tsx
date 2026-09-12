import type { AnchorHTMLAttributes, ReactNode } from "react";

type YucarnButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: "mint" | "ink" | "outline" | "light";
};

const variants = {
  mint: "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg",
  ink: "bg-foreground text-background hover:-translate-y-0.5 hover:shadow-lg",
  outline: "border border-foreground/20 text-foreground hover:bg-foreground hover:text-background",
  light: "border border-background/25 text-background hover:bg-background hover:text-foreground",
};

export function YucarnButton({ children, className = "", variant = "mint", ...props }: YucarnButtonProps) {
  return (
    <a
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}