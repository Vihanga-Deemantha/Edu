import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import AdminLayout from "./components/layout/AdminLayout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import VerifyOtpPage from "./pages/VerifyOtpPage.jsx";
import CompleteProfilePage from "./pages/CompleteProfilePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ChildAccountPage from "./pages/ChildAccountPage.jsx";
import BrowsePage from "./pages/BrowsePage.jsx";
import ListingDetailPage from "./pages/ListingDetailPage.jsx";
import TeacherProfilePage from "./pages/TeacherProfilePage.jsx";
import ProfileEditPage from "./pages/ProfileEditPage.jsx";
import VerificationPage from "./pages/VerificationPage.jsx";
import PostListingPage from "./pages/PostListingPage.jsx";
import MyListingsPage from "./pages/MyListingsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import InterestsPage from "./pages/InterestsPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import AvailabilityPage from "./pages/AvailabilityPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminVerificationPage from "./pages/admin/AdminVerificationPage.jsx";
import AdminReportsPage from "./pages/admin/AdminReportsPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import AdminListingsPage from "./pages/admin/AdminListingsPage.jsx";
import { ErrorState } from "./components/ui/index.jsx";

const guard = (element, allowedRoles) => <ProtectedRoute allowedRoles={allowedRoles}>{element}</ProtectedRoute>;

const App = () => (
  <>
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Auth — full-page split layout, no site header */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/complete-profile" element={<CompleteProfilePage />} />

      {/* Marketplace — header + footer shell */}
      <Route element={<AppShell />}>
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/teachers/:userId" element={<TeacherProfilePage />} />

        <Route path="/dashboard" element={guard(<DashboardPage />)} />
        <Route path="/profile/edit" element={guard(<ProfileEditPage />, ["teacher", "student", "parent"])} />
        <Route path="/verification" element={guard(<VerificationPage />, ["teacher"])} />
        <Route path="/listings/new" element={guard(<PostListingPage />, ["teacher", "student", "parent"])} />
        <Route path="/listings/:id/edit" element={guard(<PostListingPage />, ["teacher", "student", "parent"])} />
        <Route path="/listings/mine" element={guard(<MyListingsPage />, ["teacher", "student", "parent"])} />
        <Route path="/notifications" element={guard(<NotificationsPage />)} />
        <Route path="/interests" element={guard(<InterestsPage />, ["teacher", "student", "parent"])} />
        <Route path="/chat" element={guard(<ChatPage />)} />
        <Route path="/chat/:conversationId" element={guard(<ChatPage />)} />
        <Route path="/availability" element={guard(<AvailabilityPage />, ["teacher"])} />
        <Route path="/bookings" element={guard(<BookingsPage />, ["teacher", "student", "parent"])} />
        {/* Stripe Checkout returns here: /bookings/:bookingId?payment=success|cancelled */}
        <Route path="/bookings/:bookingId" element={guard(<BookingsPage />, ["teacher", "student", "parent"])} />
        <Route path="/children" element={guard(<ChildAccountPage />, ["parent"])} />
        <Route
          path="*"
          element={
            <ErrorState title="Page not found">
              The page you were looking for doesn't exist or has moved.
            </ErrorState>
          }
        />
      </Route>

      {/* Admin console — its own sidebar layout */}
      <Route path="/admin" element={guard(<AdminLayout />, ["admin"])}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="verification" element={<AdminVerificationPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="listings" element={<AdminListingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>

    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#161B3F",
          color: "#FFFFFF",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: 500,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          padding: "12px 16px",
          boxShadow: "0 20px 40px -16px rgba(22,27,63,.5)",
        },
        success: { iconTheme: { primary: "#7091E6", secondary: "#FFFFFF" } },
        error: { iconTheme: { primary: "#F2B8B5", secondary: "#161B3F" } },
      }}
    />
  </>
);

export default App;
