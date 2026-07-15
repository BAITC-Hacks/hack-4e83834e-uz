import axios from "axios";
import { API_BASE } from "./constants";

const client = axios.create({ baseURL: API_BASE });

export const api = {
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
