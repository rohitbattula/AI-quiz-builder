import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // e.g. http://localhost:4000/api
  headers: { "Content-Type": "application/json" },
});

// add token if it already exists (page refresh)
const t = localStorage.getItem("token");
if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;

export default api;
