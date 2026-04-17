import { lazy, memo, Suspense, useCallback, useEffect, useState, Component } from "react";
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


const lazyWithRetry = (componentImport) => {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {

        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return { default: () => null };
      }

      throw error;
    }
  });
};


class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    window.sessionStorage.removeItem('page-has-been-force-refreshed');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">The page failed to load. This usually happens after an update.</p>
            <button
              onClick={this.handleRetry}
              className="px-6 py-3 bg-[#AD7F65] text-white rounded-lg hover:bg-[#8B6B4F] transition-colors font-semibold">

              Refresh Page
            </button>
          </div>
        </div>);

    }

    return this.props.children;
  }
}


const StaffSelection = lazyWithRetry(() => import("./pages/StaffSelection"));
const PinEntry = lazyWithRetry(() => import("./pages/PinEntry"));
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const Logs = lazyWithRetry(() => import("./pages/logs"));
const Terminal = lazyWithRetry(() => import("./pages/terminal"));
const Transaction = lazyWithRetry(() => import("./pages/transaction"));
const CashRemittance = lazyWithRetry(() => import("./pages/CashRemittance"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Dashboard = lazyWithRetry(() => import("./pages/owner/Dashboard"));
const Reports = lazyWithRetry(() => import("./pages/owner/Reports"));
const ManageEmployees = lazyWithRetry(() => import("./pages/owner/ManageEmployees"));
const DiscountManagement = lazyWithRetry(
  () => import("./pages/owner/DiscountManagement")
);
const BrandPartners = lazyWithRetry(() => import("./pages/owner/BrandPartners"));
const Categories = lazyWithRetry(() => import("./pages/owner/Categories"));
const SetNewPin = lazyWithRetry(() => import("./pages/SetNewPin"));
const OwnerOnboarding = lazyWithRetry(() => import("./pages/OwnerOnboarding"));
const ManageData = lazyWithRetry(() => import("./pages/ManageData"));


const PageLoader = () =>
  <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B7355] mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>;


const MainLayout = memo(({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme === "dark" ? "#1E1B18" : "#FFFFFF" }}>

      <SidebarContext.Provider value={{ isExpanded }}>
        <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
        <main
          className={`transition-all duration-300 px-6 py-4 ${isExpanded ? "ml-80" : "ml-20"}`}>

          {children}
        </main>
      </SidebarContext.Provider>
    </div>);

});

const LandingGate = () => {
  const { theme } = useTheme();
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    hasAccounts: false
  });

  const checkEmployees = useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      loading: true,
      error: ""
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
        hasAccounts: data.count > 0
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.message ||
          "Unable to reach the server. Please ensure the backend is running.",
        hasAccounts: false
      });
    }
  }, []);

  useEffect(() => {
    checkEmployees();
  }, [checkEmployees]);

  if (status.loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-[#1F1F1F]" : "bg-[#FFFFFF]"}`}>

        <p
          className={`${theme === "dark" ? "text-white" : "text-[#8B7355]"} tracking-[0.3em] uppercase text-sm`}>

          Preparing CYSPOS...
        </p>
      </div>);

  }

  if (status.error) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-[#1F1F1F]" : "bg-[#FFFFFF]"} px-4 text-center gap-6`}>

        <div className="max-w-md">
          <p
            className={`${theme === "dark" ? "text-white" : "text-[#2D2D2D]"} text-lg font-semibold mb-2`}>

            Something went wrong
          </p>
          <p className="text-gray-400 text-sm">{status.error}</p>
        </div>
        <button
          onClick={checkEmployees}
          className="px-6 py-3 rounded-2xl bg-white text-[#1F1F1F] font-semibold shadow-lg">

          Retry
        </button>
      </div>);

  }

  if (!status.hasAccounts) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OwnerOnboarding onSetupComplete={checkEmployees} />
      </Suspense>);

  }

  return (
    <Suspense fallback={<PageLoader />}>
      <PinEntry />
    </Suspense>);

};

function App() {

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.type === "number") {
        e.preventDefault();
      }
    };


    document.addEventListener("wheel", handleWheel, { passive: false });


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
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DataCacheProvider>
            <Router>
              <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{ style: { zIndex: 99999 } }}
              />
              <Toaster
                toasterId="terminal"
                position="bottom-right"
                reverseOrder={false}
                toastOptions={{ style: { zIndex: 99999 } }}
              />
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
                    } />

                  <Route
                    path="/staff"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <StaffSelection />
                      </Suspense>
                    } />

                  <Route
                    path="/set-pin"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageLoader />}>
                          <SetNewPin />
                        </Suspense>
                      </ProtectedRoute>
                    } />


                  { }
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
                    } />

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
                    } />

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
                    } />


                  { }
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
                    } />

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
                    } />

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
                    } />

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
                    } />

                  <Route
                    path="/cash-remittance"
                    element={
                      <ProtectedRoute ownerOnly={true}>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <CashRemittance />
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

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
                    } />

                  <Route
                    path="/manage-data"
                    element={
                      <ProtectedRoute ownerOnly={true}>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <ManageData />
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                  <Route
                    path="/discount-management"
                    element={
                      <ProtectedRoute ownerOnly={true}>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <DiscountManagement />
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                  <Route
                    path="/brand-partners"
                    element={
                      <ProtectedRoute ownerOnly={true}>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <BrandPartners />
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                  <Route
                    path="/categories"
                    element={
                      <ProtectedRoute ownerOnly={true}>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <Categories />
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                </Routes>
              </Suspense>
            </Router>
          </DataCacheProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>);

}

export default App;