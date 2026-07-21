import { Geist, Geist_Mono } from "next/font/google";

const heading = Geist({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const label = Geist({
  variable: "--font-label",
  subsets: ["latin"],
  display: "swap",
});

const code = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
});

const fonts = { heading, body, label, code };

const style = {
  theme: "dark" as const,
  neutral: "gray" as const,
  brand: "cyan" as const,
  accent: "emerald" as const,
  solid: "contrast" as const,
  solidStyle: "flat" as const,
  border: "playful" as const,
  surface: "translucent" as const,
  transition: "all" as const,
  scaling: "100" as const,
};

const dataStyle = {
  variant: "gradient" as const,
  mode: "divergent" as const,
  height: 24,
  axis: { stroke: "var(--neutral-alpha-weak)" },
  tick: { fill: "var(--neutral-on-background-weak)", fontSize: 11, line: false },
};

export { fonts, style, dataStyle };
