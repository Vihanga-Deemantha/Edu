import { createContext } from "react";

/**
 * The raw React context object for auth state.
 * Kept in a separate file so that AuthProvider (a component) can live in
 * AuthContext.jsx without violating Fast Refresh's "one file, one export type"
 * rule.
 */
export const AuthContext = createContext(null);
