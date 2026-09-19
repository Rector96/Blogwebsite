import { StrictMode, Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RWDNEWS] React render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#071a2d",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <section style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
          <img
            src="/rwdnews-logo.svg"
            alt="RWDNEWS"
            style={{ width: "min(82vw, 320px)", margin: "0 auto 24px" }}
          />
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>RWDNEWS hit a problem</h1>
          <p style={{ opacity: 0.78, lineHeight: 1.6, margin: "0 0 20px" }}>
            Refresh once to retry.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "12px 20px",
              fontWeight: 800,
              cursor: "pointer",
              background: "#f59e0b",
              color: "#071a2d",
            }}
          >
            Reload RWDNEWS
          </button>
        </section>
      </main>
    );
  }
}

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(160deg, #071a2d 0%, #0b3d4a 45%, #0f172a 100%)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: 24 }}>
        <img
          src="/rwdnews-logo.svg"
          alt="RWDNEWS"
          style={{
            width: "min(78vw, 280px)",
            height: "auto",
            filter: "brightness(0) invert(1)",
            animation: "rwd-fade 1.1s ease",
          }}
        />
        <p
          style={{
            marginTop: 18,
            fontSize: 12,
            letterSpacing: "0.22em",
            fontWeight: 800,
            textTransform: "uppercase",
            color: "#fbbf24",
          }}
        >
          Loading the wire
        </p>
        <div
          style={{
            margin: "18px auto 0",
            width: 120,
            height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "40%",
              borderRadius: 999,
              background: "#f59e0b",
              animation: "rwd-slide 1s ease infinite",
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes rwd-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes rwd-slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
      `}</style>
    </div>
  );
}

function Boot() {
  const [ready, setReady] = useState(false);
  return (
    <>
      {!ready ? <Splash onDone={() => setReady(true)} /> : null}
      <div style={{ opacity: ready ? 1 : 0, transition: "opacity 0.35s ease" }}>
        <App />
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("RWDNEWS root element is missing");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <Boot />
    </AppErrorBoundary>
  </StrictMode>,
);
