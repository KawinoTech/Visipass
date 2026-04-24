import type { ReactNode } from "react";
import AppHeader from "../../components/header/AppHeader";
import IdleLogoutGuard from "../../components/auth/IdleLogoutGuard";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <section>
      <IdleLogoutGuard />
      <AppHeader />
      {children}
    </section>
  );
}
