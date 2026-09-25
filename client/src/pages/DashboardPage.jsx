import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import StudentHome from "./home/StudentHome.jsx";
import ParentHome from "./home/ParentHome.jsx";
import TeacherHome from "./home/TeacherHome.jsx";

/** /dashboard — each role gets its own Home (designs: Home, Home Parent, Home Teacher). */
const DashboardPage = () => {
  const { user } = useAuth();
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "teacher") return <TeacherHome />;
  if (user.role === "parent") return <ParentHome />;
  return <StudentHome />;
};

export default DashboardPage;
