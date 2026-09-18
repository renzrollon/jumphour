import type { ReactNode } from "react";

export const metadata = {
  title: "Jumphour",
};

// Bootstrap-only shell. Sign-in and the repository/discovery surface land in
// later tasks (3.x, 8.x) of this change.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
