import { useState } from "react";

/**
 * The time the component mounted, as a stable value — keeps render pure
 * (no Date.now() during render) for "is this in the past / overdue" checks
 * that don't need to tick live.
 */
const useNow = () => useState(() => Date.now())[0];

export default useNow;
