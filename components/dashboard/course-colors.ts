/**
 * Block colours for the timetable — soft, low-saturation tints so several
 * courses stay distinguishable without shouting. Deliberately avoids strong
 * emerald/red, which are reserved for status (open/passed vs full/conflict).
 */
export interface CourseColor {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

const PALETTE: CourseColor[] = [
  { bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3", dot: "#6366f1" }, // indigo
  { bg: "#ecfeff", border: "#a5f3fc", text: "#155e75", dot: "#06b6d4" }, // cyan
  { bg: "#fef3f2", border: "#fecdca", text: "#b42318", dot: "#f97066" }, // rose (muted, not the conflict red)
  { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" }, // amber
  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#22c55e" }, // green
  { bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6", dot: "#8b5cf6" }, // violet
  { bg: "#fdf2f8", border: "#fbcfe8", text: "#9d174d", dot: "#ec4899" }, // pink
  { bg: "#f8fafc", border: "#e2e8f0", text: "#334155", dot: "#64748b" }, // slate
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Each course gets its hash-preferred colour unless another staged course
 * already holds it, in which case it takes the next free slot. Stable for a
 * given plan and collision-free up to the palette size.
 */
export function assignCourseColors(courseCodes: string[]): Map<string, CourseColor> {
  const result = new Map<string, CourseColor>();
  const taken = new Set<number>();
  for (const code of courseCodes) {
    if (result.has(code)) continue;
    let index = hash(code) % PALETTE.length;
    for (let i = 0; i < PALETTE.length && taken.has(index); i++) index = (index + 1) % PALETTE.length;
    taken.add(index);
    result.set(code, PALETTE[index]);
  }
  return result;
}

export const PREVIEW_COLOR: CourseColor = {
  bg: "#eff4ff",
  border: "#2563eb",
  text: "#1d4ed8",
  dot: "#2563eb",
};
