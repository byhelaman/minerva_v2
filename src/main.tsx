import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "./components/theme-provider";
import { SettingsProvider } from "./components/settings-provider";
import { AuthProvider } from "./components/auth-provider";
import { BugReportButton } from "./features/docs/components/BugReportForm";
import "./lib/i18n";
import "./index.css";



import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./config/authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL and Handle Redirect
msalInstance.initialize().then(() => {
  // Default to first account if available
  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }

  // Optional: Event callback
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      // @ts-ignore
      const account = event.payload.account;
      msalInstance.setActiveAccount(account);
    }
  });

  // Handle the redirect response (required for loginRedirect)
  msalInstance.handleRedirectPromise().then((authResult) => {
    if (authResult && authResult.account) {
      msalInstance.setActiveAccount(authResult.account);
    }

    // Render the App only after MSAL is ready
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <AuthProvider>
              <BrowserRouter>
                <SettingsProvider>
                  <App />
                  <BugReportButton />
                  <Toaster />
                </SettingsProvider>
              </BrowserRouter>
            </AuthProvider>
          </ThemeProvider>
        </MsalProvider>
      </React.StrictMode>,
    );
  }).catch(error => console.error("MSAL Redirect Error:", error));
});
