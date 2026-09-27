import { LogOut } from "lucide-react";
import Link from "next/link";
import { NavLinks } from "./nav-links";

interface AppHeaderProps {
  studentName: string;
  studentId: string;
  termName: string;
  mockMode: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppHeader({ studentName, studentId, termName, mockMode }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4 sm:gap-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-zinc-900 font-mono text-[11px] font-bold text-white">
            S
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-zinc-900 sm:block">
            Course Registration
          </span>
        </Link>

        <div className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block" />

        <NavLinks />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {mockMode && (
            <span
              title="SDU_API_MODE=mock — data comes from the in-process fake SDU backend"
              className="hidden rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 md:inline"
            >
              Demo data
            </span>
          )}
          <span className="tnum rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">{termName}</span>
          <div className="flex items-center gap-2 pl-1">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white"
            >
              {initials(studentName)}
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block text-[13px] font-medium text-zinc-900">{studentName}</span>
              <span className="tnum block text-[11px] text-zinc-400">{studentId}</span>
            </span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
