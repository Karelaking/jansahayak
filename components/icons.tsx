import type { HazardIconName } from "@/lib/site";

export function ArrowUpRight({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 13 13 3M5 3h8v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ArrowRight({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GlobeIcon({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="10" cy="10" rx="3.2" ry="7.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 7.5h14M3 12.5h14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M3 6h14M3 10h14M3 14h14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GoogleIcon({ className }: { className?: string } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function HazardIcon({ type }: { type: HazardIconName }) {
  if (type === "path") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="m5 18 5-5 3 3 6-7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 9h3v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "crossing") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 8h16M4 12h16M4 16h16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M8 9h8M8 15h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
