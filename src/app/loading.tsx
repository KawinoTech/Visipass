import { Preloader } from "@/components/ui/Preloader";

export default function AppLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--vp-page-bg)",
      }}
    >
      <Preloader label="Loading page..." size="lg" />
    </main>
  );
}
