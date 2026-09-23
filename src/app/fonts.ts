// The only font declarations in the app. next/font/google self-hosts the faces
// at build time, so there is no runtime request to a Google domain.
// Imported only by src/app/layout.tsx, which puts `fontVariableClasses` on <html>;
// tokens.css reads the variables into --fontSans and --fontMono.
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
  fallback: ["system-ui", "sans-serif"],
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "monospace"],
});

/** Space-separated CSS-variable classes for the root element. */
export const fontVariableClasses = `${instrumentSans.variable} ${jetBrainsMono.variable}`;
