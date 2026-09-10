import type { CSSProperties } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inference: "m13 2-9 12h7l-1 8 10-12h-7z",
  load: "M3 17V9 M9 17V3 M15 17v-6 M21 17V5 M2 21h20",
  lab: "M9 3h6 M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3 M8 14h8",
  requests: "M8 3h12v18H4V7z M8 3v4H4 M8 12h8 M8 16h6",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  pulse: "M2 12h5l3-8 4 16 3-8h5",
  layers: "m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
