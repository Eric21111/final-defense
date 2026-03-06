import { lazy, memo, Suspense, useCallback, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import PageTitle from "./components/shared/PageTitle";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import Sidebar from "./components/shared/Sidebar";
import { AuthProvider } from "./context/AuthContext";
import { DataCacheProvider } from "./context/DataCacheContext";
import { SidebarContext } from "./context/SidebarContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { API_ENDPOINTS } from "./config/api";

// Lazy load all pages for better performance
const StaffSelection = lazy(() => import("./pages/StaffSelection"));
const PinEntry = lazy(() => import("./pages/PinEntry"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Logs = lazy(() => import("./pages/logs"));
const Terminal = lazy(() => import("./pages/terminal"));
const Transaction = lazy(() => import("./pages/transaction"));
const Settings = lazy(() => import("./pages/Settings"));
const Dashboard = lazy(() => import("./pages/owner/Dashboard"));
const Reports = lazy(() => import("./pages/owner/Reports"));
const ManageEmployees = lazy(() => import("./pages/owner/ManageEmployees"));
const DiscountManagement = lazy(
  () => import("./pages/owner/DiscountManagement"),
);
const BrandPartners = lazy(() => import("./pages/owner/BrandPartners"));
const Categories = lazy(() => import("./pages/owner/Categories"));
const SetNewPin = lazy(() => import("./pages/SetNewPin"));
const OwnerOnboarding = lazy(() => import("./pages/OwnerOnboarding"));
const ManageData = lazy(() => import("./pages/ManageData"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B7355] mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const MainLayout = memo(({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme === "dark" ? "#1E1B18" : "#FFFFFF" }}
    >
      <SidebarContext.Provider value={{ isExpanded }}>
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
        <main
          className={`transition-all duration-300 px-6 py-4 ${isExpanded ? "ml-80" : "ml-20"}`}
        >
          {children}
        </main>
      </SidebarContext.Provider>
    </div>
  );
});

const LandingGate = () => {
  const { theme } = useTheme();
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    hasAccounts: false,
  });

  const checkEmployees = useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch(API_ENDPOINTS.employees);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to determine account status.");
      }

      setStatus({
        loading: false,
        error: "",
        hasAccounts: data.count > 0,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.message ||
          "Unable to reach the server. Please ensure the backend is running.",
        hasAccounts: false,
      });
    }
  }, []);

  useEffect(() => {
    checkEmployees();
  }, [checkEmployees]);

  if (status.loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-[#1F1F1F]" : "bg-[#FFFFFF]"}`}
      >
        <p
          className={`${theme === "dark" ? "text-white" : "text-[#8B7355]"} tracking-[0.3em] uppercase text-sm`}
        >
          Preparing CYSPOS...
        </p>
      </div>
    );
  }

  if (status.error) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-[#1F1F1F]" : "bg-[#FFFFFF]"} px-4 text-center gap-6`}
      >
        <div className="max-w-md">
          <p
            className={`${theme === "dark" ? "text-white" : "text-[#2D2D2D]"} text-lg font-semibold mb-2`}
          >
            Something went wrong
          </p>
          <p className="text-gray-400 text-sm">{status.error}</p>
        </div>
        <button
          onClick={checkEmployees}
          className="px-6 py-3 rounded-2xl bg-white text-[#1F1F1F] font-semibold shadow-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status.hasAccounts) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OwnerOnboarding onSetupComplete={checkEmployees} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <PinEntry />
    </Suspense>
  );
};

function App() {
  // Disable mouse wheel on number inputs globally
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.type === "number") {
        e.preventDefault();
      }
    };

    // Add event listener to prevent wheel events on number inputs
    document.addEventListener("wheel", handleWheel, { passive: false });

    // Also blur number inputs when they receive wheel events
    const handleNumberInputWheel = (e) => {
      if (document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    };

    document.addEventListener("wheel", handleNumberInputWheel);

    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("wheel", handleNumberInputWheel);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DataCacheProvider>
          <Router>
            <Toaster position="top-center" reverseOrder={false} />
            <PageTitle />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingGate />} />
                <Route
                  path="/pin"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PinEntry />
                    </Suspense>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <StaffSelection />
                    </Suspense>
                  }
                />
                <Route
                  path="/set-pin"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader />}>
                        <SetNewPin />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />

                {/* Owner-only routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute ownerOnly={true}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Dashboard />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requiredPermission="generateReports">
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Reports />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manage-employees"
                  element={
                    <ProtectedRoute ownerOnly={true}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <ManageEmployees />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Permission-based routes */}
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute requiredPermission="inventory">
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Inventory />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stock-movement"
                  element={
                    <ProtectedRoute requiredPermission="inventory">
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Logs />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/terminal"
                  element={
                    <ProtectedRoute requiredPermission="posTerminal">
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Terminal />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute requiredPermission="viewTransactions">
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Transaction />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute requiredPermission={null}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Settings />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manage-data"
                  element={
                    <ProtectedRoute requiredPermission={null}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <ManageData />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/discount-management"
                  element={
                    <ProtectedRoute requiredPermission={null}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <DiscountManagement />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/brand-partners"
                  element={
                    <ProtectedRoute requiredPermission={null}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <BrandPartners />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute requiredPermission={null}>
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Categories />
                        </Suspense>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </Router>
        </DataCacheProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
