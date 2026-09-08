import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import VerifyOtpPage from "./pages/VerifyOtpPage.jsx";
import CompleteProfilePage from "./pages/CompleteProfilePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ChildAccountPage from "./pages/ChildAccountPage.jsx";

const App = () => {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/children"
            element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <ChildAccountPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#FFFFFF",
            color: "#172554", /* text-main */
            border: "1px solid #E2E8F0",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            boxShadow: "0 4px 12px -2px rgba(23, 37, 84, 0.06), 0 2px 6px -1px rgba(23, 37, 84, 0.04)",
          },
          success: {
            iconTheme: { primary: "#34B77A", secondary: "#FFFFFF" },
          },
          error: {
            iconTheme: { primary: "#EF4444", secondary: "#FFFFFF" },
          },
        }}
      />
    </>
  );
};

export default App;
