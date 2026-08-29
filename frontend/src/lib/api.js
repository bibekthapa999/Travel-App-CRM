import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (
      error.response?.status === 401 &&
      orig &&
      !orig._retry &&
      !orig.url.includes("/auth/login") &&
      !orig.url.includes("/auth/refresh")
    ) {
      orig._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(orig);
      } catch (e) {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return e?.message || "Something went wrong";
}

export default api;
