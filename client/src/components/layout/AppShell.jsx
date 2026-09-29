import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "./AppHeader.jsx";
import AppFooter from "./AppFooter.jsx";

const AppShell = () => {
  const { pathname } = useLocation();
  const listingDetail = /^\/listings\/[^/]+$/.test(pathname) && !["/listings/new", "/listings/mine"].includes(pathname);
  const showFooter = pathname === "/dashboard" || pathname === "/browse" ||
    listingDetail || /^\/teachers\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {showFooter && <AppFooter />}
    </div>
  );
};

export default AppShell;
