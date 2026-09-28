import axios from "axios";
import { API_BASE } from "./constants";
import { auth } from "./firebase";

const client = axios.create({ baseURL: API_BASE });

// Attach Firebase ID token to outgoing requests when signed in.
// Gates mutating endpoints like POST /reports and POST /defects/:id/review.
client.interceptors.request.use(async (config) => {
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn("Failed to retrieve Firebase ID token", err);
  }
  return config;
});

export const api = {
  checkAdmin: (email) => client.get("/auth/check-admin", { params: { email } }).then((r) => r.data),
  getQueue: (params) => client.get("/queue", { params }).then((r) => r.data),
  getDefects: (params) => client.get("/defects", { params }).then((r) => r.data),
  getDefect: (id) => client.get(`/defects/${id}`).then((r) => r.data),
  reviewDefect: (id, body) => client.post(`/defects/${id}/review`, body).then((r) => r.data),
  getHistory: (id) => client.get(`/defects/${id}/history`).then((r) => r.data),
  getSegments: () => client.get("/segments").then((r) => r.data),
  submitReport: (formData) =>
    client.post("/reports", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  uploadDetect: (formData) =>
    client.post("/defects/detect", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  detectPreview: (formData) =>
    client.post("/detect/preview", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  analyticsSummary: () => client.get("/analytics/summary").then((r) => r.data),
  analyticsByType: () => client.get("/analytics/by-type").then((r) => r.data),
  analyticsByDistrict: () => client.get("/analytics/by-district").then((r) => r.data),
  analyticsTrend: () => client.get("/analytics/trend").then((r) => r.data),
  analyticsApprovalFunnel: () => client.get("/analytics/approval-funnel").then((r) => r.data),
};

export function mediaUrl(path) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}
