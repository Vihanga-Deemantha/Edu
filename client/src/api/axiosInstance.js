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

// --- Response interceptor: silent token refresh on 401 ---
// Guard: track whether a refresh is already in flight so we only call it once
// even if multiple requests 401 simultaneously.
let isRefreshing = false;
let refreshQueue = []; // queued callbacks waiting for the refresh to resolve

const processQueue = (error, token = null) => {
  refreshQueue.forEach((cb) => (error ? cb.reject(error) : cb.resolve(token)));
  refreshQueue = [];
};

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
      if (isRefreshing) {
        // Another refresh is already in flight — queue this request
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosInstance.post("/auth/refresh");
        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        // Redirect to login — auth state will be cleared by AuthContext on mount failure
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
