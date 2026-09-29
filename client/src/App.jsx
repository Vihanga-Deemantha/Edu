import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import AdminLayout from "./components/layout/AdminLayout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import { ErrorState, PageLoader } from "./components/ui/index.jsx";

const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.jsx"));
const VerifyOtpPage = lazy(() => import("./pages/VerifyOtpPage.jsx"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const ChildAccountPage = lazy(() => import("./pages/ChildAccountPage.jsx"));
const BrowsePage = lazy(() => import("./pages/BrowsePage.jsx"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage.jsx"));
const TeacherProfilePage = lazy(() => import("./pages/TeacherProfilePage.jsx"));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage.jsx"));
const VerificationPage = lazy(() => import("./pages/VerificationPage.jsx"));
const PostListingPage = lazy(() => import("./pages/PostListingPage.jsx"));
const MyListingsPage = lazy(() => import("./pages/MyListingsPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const InterestsPage = lazy(() => import("./pages/InterestsPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const AvailabilityPage = lazy(() => import("./pages/AvailabilityPage.jsx"));
const BookingsPage = lazy(() => import("./pages/BookingsPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage.jsx"));
const AdminVerificationPage = lazy(() => import("./pages/admin/AdminVerificationPage.jsx"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage.jsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage.jsx"));
const AdminListingsPage = lazy(() => import("./pages/admin/AdminListingsPage.jsx"));

const guard = (element, allowedRoles) => <ProtectedRoute allowedRoles={allowedRoles}>{element}</ProtectedRoute>;

const App = () => (
  <>
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>

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
