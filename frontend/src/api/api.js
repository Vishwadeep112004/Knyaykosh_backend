import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.request.use(
    (config) => {
        // Do NOT attach Authorization header for token endpoints or register endpoint
        const isAuthEndpoint =
            config.url?.includes("/api/token/") ||
            (config.url === "/users/" && config.method?.toLowerCase() === "post");

        if (!isAuthEndpoint) {
            const accessToken = localStorage.getItem("access");
            if (accessToken) {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        const isAuthEndpoint = originalRequest.url?.includes("/api/token/");

        // Avoid attempting token refresh for auth endpoints or if already retried
        if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                })
                .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem("refresh");

        if (!refreshToken) {
            isRefreshing = false;
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            localStorage.removeItem("user_info");
            window.dispatchEvent(new Event("nyaykosh_session_expired"));
            return Promise.reject(error);
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
                refresh: refreshToken
            });

            const newAccessToken = response.data.access;
            localStorage.setItem("access", newAccessToken);

            processQueue(null, newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            localStorage.removeItem("user_info");
            window.dispatchEvent(new Event("nyaykosh_session_expired"));
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
