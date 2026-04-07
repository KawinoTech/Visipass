import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "../lib/theme/theme-store";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
