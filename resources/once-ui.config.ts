import { Lato, Fira_Code } from "next/font/google";

const heading = Lato({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const body = Lato({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const label = Lato({
  variable: "--font-label",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const code = Fira_Code({
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
