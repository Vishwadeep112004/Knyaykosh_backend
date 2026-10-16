import axios from "axios";

const api = axios.create({
    baseURL: "http://127.0.0.1:8000"
});

api.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem("access");

    console.log("REQUEST:", config.method?.toUpperCase(), config.url);
    console.log("ACCESS TOKEN:", accessToken);

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status !== 401 ||
            originalRequest._retry ||
            originalRequest.url?.includes("/api/token/")
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        const refreshToken = localStorage.getItem("refresh");

        if (!refreshToken) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            return Promise.reject(error);
        }

        try {
            const response = await axios.post(
                "http://127.0.0.1:8000/api/token/refresh/",
                {
                    refresh: refreshToken
                }
            );

            const newAccessToken = response.data.access;

            localStorage.setItem("access", newAccessToken);

            originalRequest.headers.Authorization =
                `Bearer ${newAccessToken}`;

            return api(originalRequest);
        } catch (refreshError) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");

            return Promise.reject(refreshError);
        }
    }
);

export default api;