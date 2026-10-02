import { Link } from "react-router-dom";
import { useLanguage } from "../../context/languageContext.js";

/** Compact footer for marketplace browsing and home pages. */
const AppFooter = () => {
  const { t } = useLanguage();
  return (
    <footer className="mt-auto bg-ink text-white">
      <div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-[18px] py-7">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="serif text-[22px] font-bold">
            Edu<span className="text-blue">Link</span>
          </span>
          <span className="text-[13px] text-lavender">© {new Date().getFullYear()} EduLink</span>
        </div>
        <nav className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-sm font-medium" aria-label="Footer">
          <Link to="/browse" className="text-lavender hover:text-white">{t("Browse")}</Link>
          <Link to="/register?role=teacher" className="text-lavender hover:text-white">{t("Teach")}</Link>
          <a href="mailto:safety@edulink.lk" className="font-bold text-white hover:text-blue">{t("Report a problem")}</a>
          <a href="mailto:hello@edulink.lk" className="text-lavender hover:text-white">{t("Contact")}</a>
        </nav>
      </div>
    </footer>
  );
};

export default AppFooter;
