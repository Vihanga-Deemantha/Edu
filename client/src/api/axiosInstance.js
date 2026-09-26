import axios from "axios";

// --- In-memory access token store ---
// The access token NEVER touches localStorage/sessionStorage — XSS-safety.
// Lives here (module scope) so the interceptors can read/write it.
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

// --- Axios instance ---
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // REQUIRED: sends the httpOnly refresh cookie automatically
});

// --- Request interceptor: attach Bearer token ---
axiosInstance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// --- Refresh, deduplicated ---
// Every caller that might need a fresh access token goes through this one
// function: the response interceptor below (reacting to some request's 401)
// AND AuthContext's own bootstrap-on-mount call (context/AuthContext.jsx).
// That second caller is exactly why this has to be shared rather than
// private to the interceptor — without it, a page load's initial render
// commonly fires both AuthContext's bootstrap refresh AND some other
// component's data fetch (which 401s, since there's no access token yet,
// and independently triggers the interceptor's own refresh) at the same
// time. Both would call POST /auth/refresh with the same not-yet-rotated
// refresh cookie; the backend correctly rotates the refresh token on every
// use, so only the first of the two actually succeeds — the second gets a
// legitimate 401, and if that happened to be the call AuthContext's
// bootstrap was awaiting, a user with a perfectly valid session got
// spuriously logged out by nothing more than a direct navigation or a
// plain page reload to a protected route. Routing every refresh through
// this single in-flight-deduplicated function closes that race: whichever
// caller asks first performs the real request, everyone else queues behind
// it and receives that same result.
let isRefreshing = false;
let refreshQueue = []; // queued callbacks waiting for the refresh to resolve

const processQueue = (error, token = null) => {
  refreshQueue.forEach((cb) => (error ? cb.reject(error) : cb.resolve(token)));
  refreshQueue = [];
};

export const refreshAccessToken = async () => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const { data } = await axiosInstance.post("/auth/refresh");
    const newToken = data.data.accessToken;
    setAccessToken(newToken);
    processQueue(null, newToken);
    return newToken;
  } catch (refreshError) {
    processQueue(refreshError, null);
    clearAccessToken();
    throw refreshError;
  } finally {
    isRefreshing = false;
  }
};

// --- Response interceptor: silent token refresh on 401 ---
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and NEVER if the failing request itself was
    // /auth/refresh or /auth/login — that would cause an infinite loop.
    const isRefreshUrl = originalRequest.url?.includes("/auth/refresh");
    const isLoginUrl = originalRequest.url?.includes("/auth/login");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshUrl &&
      !isLoginUrl
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Redirect to login — auth state will be cleared by AuthContext on mount failure
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
