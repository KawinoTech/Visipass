import type { ReactNode } from "react";
import AppHeader from "../../components/header/AppHeader";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <section>
      <AppHeader />
      {children}
    </section>
  );
}
