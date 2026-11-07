import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./_core/trpc";
import { AuthProvider } from "./_core/useAuth";
import { GuestCartProvider } from "./_core/guest-cart";
import { ErrorBoundary } from "./_core/ErrorBoundary";
import { ToastProvider } from "./components/ui/toast";
import App from "./App";
import "./index.css";

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => makeTrpcClient());
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* GuestCartProvider sits inside AuthProvider so a page can ask for
              both: the signed-in cart from the server, the guest cart from
              localStorage. */}
          <GuestCartProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </GuestCartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
