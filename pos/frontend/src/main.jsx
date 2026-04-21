import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initializeApiInterceptor } from './config/api';

const isProd = import.meta.env.PROD;

const showConsoleSafetyBanner = () => {
  try {
    // Mirror the well-known devtools safety warning style.
    console.log(
      "%cStop!",
      "color:#ff0000;font-size:72px;font-weight:700;line-height:1;"
    );
    console.log(
      "%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' someone's account, it is a scam and will give them access to your account.",
      "font-size:34px;color:#ffffff;background:#1f2937;padding:8px 12px;"
    );
  } catch {
    // no-op
  }
};

const suppressConsoleErrorsInProd = () => {
  if (!isProd) return;
  const originalError = console.error;
  console.error = (...args) => {
    const first = String(args?.[0] || "");
    // Keep truly critical unhandled runtime errors visible.
    if (
      first.includes("Uncaught") ||
      first.includes("Unhandled Promise Rejection")
    ) {
      originalError(...args);
    }
  };
};

showConsoleSafetyBanner();
suppressConsoleErrorsInProd();

initializeApiInterceptor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);