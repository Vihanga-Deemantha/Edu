import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async loader on mount (and whenever `deps` change), tracking
 * data / error / loading. `reload()` re-runs it; `setData` allows optimistic
 * local updates after a mutation. Stale responses from a superseded run are
 * dropped so a fast filter change never renders an older result.
 */
const useAsync = (loader, deps = [], { enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const runId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === runId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === runId.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })),
    []
  );

  return { ...state, reload: run, setData };
};

export default useAsync;
