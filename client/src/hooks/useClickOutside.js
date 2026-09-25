import { useEffect } from "react";

/** Calls `handler` on a pointer-down outside `ref`'s element (menus, popovers). */
const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler(e);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler]);
};

export default useClickOutside;
