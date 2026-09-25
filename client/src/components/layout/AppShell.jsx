import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader.jsx";
import AppFooter from "./AppFooter.jsx";

/** Header + page + footer for every marketplace page (not landing/auth/admin). */
const AppShell = () => (
  <div className="flex min-h-screen flex-col">
    <AppHeader />
    <main className="flex flex-1 flex-col">
      <Outlet />
    </main>
    <AppFooter />
  </div>
);

export default AppShell;
