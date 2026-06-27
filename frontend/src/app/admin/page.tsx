"use client";

import { useState, useEffect, useCallback } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const API = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  description: string;
  in_stock: boolean;
};

type Order = {
  id: number;
  client_name: string;
  status: string;
  priority: string;
  total_boxes: number;
  destination_airport: string;
  flight_time: string;
  created_at: string;
  deposit_paid: boolean;
  source_inquiry_id: number | null;
};

type Stats = {
  total_orders: number;
  to_pack: number;
  packing_now: number;
  ready_for_qc: number;
  dispatched_today: number;
  open_inquiries: number;
  quoted_inquiries: number;
  pending_buyers: number;
};

type BuyerProfile = {
  id: number;
  user_id: number;
  username: string;
  email: string;
  company_name: string;
  business_registration_number: string;
  gstin_vat_number: string;
  importer_license_url: string | null;
  verification_status: string;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
};

type Inquiry = {
  id: number;
  buyer_id: number;
  buyer_name: string;
  company_name: string | null;
  status: string;
  quoted_total: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  admin_notes: string | null;
  created_at: string;
  quoted_at: string | null;
  expires_at: string | null;
  items: { product_id: number; product_name: string; quantity: number; unit: string }[];
};

type AuditEntry = {
  id: number;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string;
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 border-4 border-[#A16207] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

async function authFetch(path: string, options: RequestInit = {}) {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: "include" });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("dylaan_username");
    localStorage.removeItem("dylaan_role");
    window.location.href = "/admin";
  }
  return res;
}

// ─── Nav Items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Overview",     icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z", tab: "overview" },
  { label: "Products",     icon: "M4 6h16M4 10h16M4 14h16M4 18h16", tab: "products" },
  { label: "Orders",       icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", tab: "orders" },
  { label: "Inquiries",    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", tab: "inquiries" },
  { label: "Buyers",       icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", tab: "buyers" },
  { label: "Staff Accounts", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", tab: "staff" },
  { label: "Audit Log",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", tab: "audit" },
  { label: "S3 Media Sync",icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12", tab: "media" },
];

// ─── Status badge colors ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  open: "bg-blue-100 text-blue-700",
  quoted: "bg-purple-100 text-purple-700",
  deposit_pending: "bg-orange-100 text-orange-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
  packing: "bg-blue-100 text-blue-700",
  qc: "bg-purple-100 text-purple-700",
  shipped: "bg-cyan-100 text-cyan-700",
  delivered: "bg-cyan-100 text-cyan-700",
  approved: "bg-cyan-100 text-cyan-700",
  rejected: "bg-red-100 text-red-600",
};

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // Admin login state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // New product form
  const [form, setForm] = useState({ name: "", category: "flower", price: "", unit: "bundle", description: "" });
  const [formStatus, setFormStatus] = useState<string | null>(null);

  // Quote form
  const [quoteForm, setQuoteForm] = useState({ quoted_total: "", deposit_percentage: "20", admin_notes: "" });

  // Staff form
  const [staffForm, setStaffForm] = useState({ username: "", password: "", role: "packhouse" });
  const [staffFormStatus, setStaffFormStatus] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Not authed");
      })
      .then(data => {
        if (data.role === "admin") {
          setIsAuthed(true);
        } else {
          setIsAuthed(false);
        }
      })
      .catch(() => setIsAuthed(false));
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Login failed.");
        return;
      }
      if (data.role !== "admin") {
        setLoginError("Access denied. Admin credentials required.");
        return;
      }
      localStorage.setItem("dylaan_username", data.username);
      localStorage.setItem("dylaan_role", data.role);
      setIsAuthed(true);
    } catch {
      setLoginError("Cannot connect to server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes, ordersRes, buyersRes, inquiriesRes, auditRes] = await Promise.all([
        authFetch("/stats"),
        authFetch("/products"),
        authFetch("/orders"),
        authFetch("/admin/buyers"),
        authFetch("/inquiries"),
        authFetch("/admin/audit-log?per_page=100"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (buyersRes.ok) setBuyers(await buyersRes.json());
      if (inquiriesRes.ok) setInquiries(await inquiriesRes.json());
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.entries || []);
      }
      setError(null);
    } catch {
      setError("Cannot reach Flask API on port 5000.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) loadAll();
  }, [isAuthed, loadAll]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus(null);
    try {
      const res = await authFetch("/products", {
        method: "POST",
        body: JSON.stringify({ ...form, price: parseFloat(form.price), in_stock: true }),
      });
      if (!res.ok) throw new Error();
      setFormStatus("success");
      setForm({ name: "", category: "flower", price: "", unit: "bundle", description: "" });
      const productsRes = await authFetch("/products");
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch {
      setFormStatus("error");
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormStatus(null);
    try {
      const res = await authFetch("/admin/staff", {
        method: "POST",
        body: JSON.stringify(staffForm),
      });
      if (!res.ok) throw new Error();
      setStaffFormStatus("success");
      setStaffForm({ username: "", password: "", role: "packhouse" });
    } catch {
      setStaffFormStatus("error");
    }
  };

  const handleVerifyBuyer = async (profileId: number, action: "approve" | "reject") => {
    try {
      const res = await authFetch(`/admin/buyers/${profileId}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason: action === "reject" ? "Documents insufficient." : undefined }),
      });
      if (res.ok) {
        const buyersRes = await authFetch("/admin/buyers");
        if (buyersRes.ok) setBuyers(await buyersRes.json());
      }
    } catch { /* ignore */ }
  };

  const handleQuoteInquiry = async (inquiryId: number) => {
    const total = parseFloat(quoteForm.quoted_total);
    if (!total || total <= 0) return;
    try {
      const res = await authFetch(`/admin/inquiries/${inquiryId}/quote`, {
        method: "PATCH",
        body: JSON.stringify({
          quoted_total: total,
          deposit_percentage: parseFloat(quoteForm.deposit_percentage) || 20,
          admin_notes: quoteForm.admin_notes,
        }),
      });
      if (res.ok) {
        setQuoteForm({ quoted_total: "", deposit_percentage: "20", admin_notes: "" });
        const inquiriesRes = await authFetch("/inquiries");
        if (inquiriesRes.ok) setInquiries(await inquiriesRes.json());
      }
    } catch { /* ignore */ }
  };

  const handleConfirmDeposit = async (inquiryId: number) => {
    try {
      const res = await authFetch(`/admin/inquiries/${inquiryId}/confirm-deposit`, {
        method: "POST",
        body: JSON.stringify({ priority: "medium" }),
      });
      if (res.ok) {
        await loadAll();
      }
    } catch { /* ignore */ }
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await authFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const ordersRes = await authFetch("/orders");
        if (ordersRes.ok) setOrders(await ordersRes.json());
      }
    } catch { /* ignore */ }
  };

  const revenue = orders.reduce((acc, o) => acc + o.total_boxes * 250, 0);

  // ─── Admin Login Gate ─────────────────────────────────────────────────────

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#A16207] via-[#D97706] to-[#F59E0B]" />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 bg-gradient-to-br from-[#A16207] to-yellow-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                <svg className="w-6 h-6 text-teal-950" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-teal-800">Admin Portal</h2>
                <p className="text-xs text-neutral-400">Secure access required</p>
              </div>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-teal-800 mb-1.5 block">Username</label>
                <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="Admin username" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A16207] outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-bold text-teal-800 mb-1.5 block">Password</label>
                <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Admin password" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A16207] outline-none text-sm" />
              </div>
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{loginError}</div>
              )}
              <button type="submit" disabled={loginLoading}
                className="w-full bg-[#A16207] hover:bg-yellow-800 text-teal-950 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-60">
                {loginLoading ? "Authenticating..." : "Sign In to Admin Portal"}
              </button>
            </form>
            <p className="text-center text-xs text-neutral-400 mt-6">
              <a href="/" className="text-[#0F766E] hover:underline">← Back to storefront</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Authenticated Admin Portal ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#021A1A] text-slate-300 flex-shrink-0 min-h-screen hidden md:flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-white/80">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-gradient-to-br from-[#A16207] to-yellow-600 rounded-lg flex items-center justify-center font-bold text-teal-950 text-lg shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white leading-tight">Admin<span className="text-[#A16207]">Pro</span></h2>
              <p className="text-xs text-teal-200/70">JWT-Secured · Role: Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${activeTab === item.tab ? "bg-white/10 text-white font-bold border-l-4 border-[#A16207]" : "text-teal-100/60 hover:bg-white/10 hover:text-white"}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
              {item.tab === "buyers" && stats?.pending_buyers ? (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{stats.pending_buyers}</span>
              ) : null}
              {item.tab === "inquiries" && stats?.open_inquiries ? (
                <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{stats.open_inquiries}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/80">
          <a href="/" className="flex items-center gap-2 text-sm text-teal-100/60 hover:text-white transition-colors font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Storefront
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-extrabold text-teal-800 tracking-tight">
            {NAV_ITEMS.find((n) => n.tab === activeTab)?.label ?? "Admin"}
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={loadAll} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Refresh">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <div className="w-9 h-9 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center text-[#A16207] font-bold cursor-pointer">
              AD
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div><p className="font-bold">{error}</p><p className="text-red-400 text-xs mt-0.5">Run: <code className="font-mono">python backend/app.py</code></p></div>
            </div>
          )}

          {/* ── Overview ─────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Est. Revenue",     value: `₹${(revenue / 1000).toFixed(1)}k`, sub: "Based on all orders",  bg: "bg-teal-50",   icon_color: "text-[#0F766E]", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                  { label: "Active Orders",    value: stats ? String(stats.total_orders) : "—", sub: `${stats?.to_pack ?? 0} pending`,  bg: "bg-blue-50",   icon_color: "text-blue-600", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
                  { label: "Open Inquiries",   value: stats ? String(stats.open_inquiries) : "—", sub: `${stats?.quoted_inquiries ?? 0} quoted`,  bg: "bg-purple-50", icon_color: "text-purple-600", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
                  { label: "Pending Buyers",   value: stats ? String(stats.pending_buyers) : "—", sub: "Awaiting verification",  bg: "bg-orange-50", icon_color: "text-orange-500", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-24 h-24 ${kpi.bg} rounded-bl-full opacity-50 group-hover:scale-110 transition-transform`}></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</h3>
                      <span className={`p-2 ${kpi.bg} ${kpi.icon_color} rounded-lg`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.icon} /></svg>
                      </span>
                    </div>
                    <p className="text-4xl font-black text-teal-800 tracking-tight">{kpi.value}</p>
                    <p className="mt-2 text-xs text-neutral-400">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-teal-800">Recent Orders</h3>
                  <button onClick={() => setActiveTab("orders")} className="text-sm font-bold text-[#0F766E] hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">View All</button>
                </div>
                {loading ? <Spinner /> : (
                  <div className="divide-y divide-gray-50">
                    {orders.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-[#0F766E] font-bold text-sm">#{o.id}</div>
                          <div>
                            <p className="font-bold text-teal-800 text-sm">{o.client_name}</p>
                            <p className="text-xs text-neutral-400">ORD-{o.id} · {o.total_boxes} boxes · {o.destination_airport}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}>
                          {o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Products ─────────────────────────────────── */}
          {activeTab === "products" && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-teal-800 mb-5">Add New Product</h3>
                <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Product Name *</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jasmine Garland" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Category *</label>
                    <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0F766E] outline-none">
                      <option value="flower">Flower</option>
                      <option value="leaf">Leaf</option>
                      <option value="vegetable">Vegetable</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Price (₹) *</label>
                    <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Unit</label>
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0F766E] outline-none">
                      <option value="bundle">bundle</option>
                      <option value="kg">kg</option>
                      <option value="piece">piece</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Description</label>
                    <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product description..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E] outline-none resize-none" />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-4">
                    <button type="submit" className="bg-teal-300 text-teal-950 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-sm">Add Product</button>
                    {formStatus === "success" && <p className="text-cyan-600 text-sm font-bold">✓ Product added!</p>}
                    {formStatus === "error" && <p className="text-red-500 text-sm font-bold">✗ Failed.</p>}
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100"><h3 className="font-bold text-teal-800">All Products ({products.length})</h3></div>
                {loading ? <Spinner /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-xs uppercase text-neutral-400 border-b border-gray-100">
                        <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3">Stock</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {products.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-bold text-teal-800">{p.name}</td>
                            <td className="px-5 py-3 capitalize text-neutral-500">{p.category}</td>
                            <td className="px-5 py-3 font-bold text-[#0F766E]">₹{p.price}</td>
                            <td className="px-5 py-3 text-neutral-500">{p.unit}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.in_stock ? "bg-cyan-100 text-cyan-700" : "bg-red-100 text-red-700"}`}>
                                {p.in_stock ? "In Stock" : "Out"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Orders ───────────────────────────────────── */}
          {activeTab === "orders" && (
            <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100"><h3 className="font-bold text-teal-800">All Confirmed Orders ({orders.length})</h3></div>
              {loading ? <Spinner /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-neutral-400 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3">Order ID</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Boxes</th>
                        <th className="px-5 py-3">Dest</th><th className="px-5 py-3">Deposit</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-600">ORD-{o.id}</td>
                          <td className="px-5 py-3 font-bold text-teal-800">{o.client_name}</td>
                          <td className="px-5 py-3 text-neutral-600">{o.total_boxes}</td>
                          <td className="px-5 py-3 font-medium text-neutral-600">{o.destination_airport}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${o.deposit_paid ? "bg-cyan-100 text-cyan-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {o.deposit_paid ? "Paid" : "Pending"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={o.status}
                              onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-[#0F766E] outline-none"
                            >
                              {["pending", "packing", "qc", "shipped", "delivered"].map((s) => (
                                <option key={s} value={s}>{s.toUpperCase()}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Inquiries ─────────────────────────────────── */}
          {activeTab === "inquiries" && (
            <div className="max-w-7xl mx-auto space-y-6">
              {loading ? <Spinner /> : inquiries.length === 0 ? (
                <div className="text-center py-16 text-neutral-400"><p className="text-4xl mb-3">📩</p><p className="font-semibold">No inquiries yet.</p></div>
              ) : (
                inquiries.map((inq) => (
                  <div key={inq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-teal-800">INQ-{inq.id}</h3>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_COLORS[inq.status] || "bg-gray-100 text-gray-600"}`}>{inq.status}</span>
                        </div>
                        <p className="text-sm text-neutral-500">{inq.company_name || inq.buyer_name} · Submitted {new Date(inq.created_at).toLocaleDateString()}</p>
                        {inq.expires_at && <p className="text-xs text-neutral-400 mt-1">Expires: {new Date(inq.expires_at).toLocaleString()}</p>}
                      </div>
                      {inq.quoted_total && (
                        <div className="text-right">
                          <p className="text-2xl font-black text-teal-800">₹{inq.quoted_total.toLocaleString()}</p>
                          <p className="text-xs text-neutral-400">Deposit: ₹{inq.deposit_amount?.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-xs font-bold text-neutral-500 uppercase mb-2">Items Requested</p>
                      <div className="space-y-1">
                        {inq.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-teal-800">{item.product_name}</span>
                            <span className="text-neutral-500">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {inq.status === "open" && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-bold text-neutral-500 uppercase mb-3">Set Quote</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input type="number" placeholder="Total (₹)" value={quoteForm.quoted_total} onChange={(e) => setQuoteForm({ ...quoteForm, quoted_total: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#A16207] outline-none" />
                          <input type="number" placeholder="Deposit %" value={quoteForm.deposit_percentage} onChange={(e) => setQuoteForm({ ...quoteForm, deposit_percentage: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#A16207] outline-none" />
                          <button onClick={() => handleQuoteInquiry(inq.id)}
                            className="bg-[#A16207] text-teal-950 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-800 transition-colors">
                            Send Quote
                          </button>
                        </div>
                      </div>
                    )}

                    {inq.status === "quoted" && !inq.deposit_paid && (
                      <div className="border-t border-gray-100 pt-4 flex gap-3">
                        <button onClick={() => handleConfirmDeposit(inq.id)}
                          className="bg-cyan-600 text-teal-950 px-6 py-2 rounded-lg font-bold text-sm hover:bg-cyan-700 transition-colors">
                          Confirm Deposit Received → Create Order
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Buyers ────────────────────────────────────── */}
          {activeTab === "buyers" && (
            <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100"><h3 className="font-bold text-teal-800">Buyer Verification ({buyers.length})</h3></div>
              {loading ? <Spinner /> : (
                <div className="divide-y divide-gray-50">
                  {buyers.map((b) => (
                    <div key={b.id} className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-[#0F766E] font-bold text-sm">
                          {b.company_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-teal-800">{b.company_name}</p>
                          <p className="text-xs text-neutral-400">{b.username} · {b.email}</p>
                          <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                            {b.business_registration_number && <span>Reg: {b.business_registration_number}</span>}
                            {b.gstin_vat_number && <span>GST/VAT: {b.gstin_vat_number}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_COLORS[b.verification_status] || "bg-gray-100 text-gray-600"}`}>
                          {b.verification_status}
                        </span>
                        {b.verification_status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => handleVerifyBuyer(b.id, "approve")}
                              className="bg-cyan-600 text-teal-950 px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-cyan-700 transition-colors">
                              Approve
                            </button>
                            <button onClick={() => handleVerifyBuyer(b.id, "reject")}
                              className="bg-red-50 text-red-600 border border-red-200 px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Staff Accounts ───────────────────────────── */}
          {activeTab === "staff" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-teal-800 mb-5">Create New Staff Account</h3>
                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Username *</label>
                    <input required value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Password *</label>
                    <input required type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Role *</label>
                    <select required value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0F766E] outline-none">
                      <option value="packhouse">Production / Packhouse</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 mt-6">
                    <button type="submit" className="bg-teal-300 text-teal-950 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-sm">Create Account</button>
                    {staffFormStatus === "success" && <p className="text-cyan-600 text-sm font-bold">✓ Account created!</p>}
                    {staffFormStatus === "error" && <p className="text-red-500 text-sm font-bold">✗ Failed to create.</p>}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Audit Log ─────────────────────────────────── */}
          {activeTab === "audit" && (
            <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100"><h3 className="font-bold text-teal-800">Audit Log ({auditLogs.length} entries)</h3></div>
              {loading ? <Spinner /> : auditLogs.length === 0 ? (
                <div className="text-center py-16 text-neutral-400"><p className="text-4xl mb-3">📋</p><p className="font-semibold">No audit entries yet. Actions will appear here once admin operations are performed.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-neutral-400 border-b border-gray-100">
                      <tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Resource</th><th className="px-5 py-3">Changes</th><th className="px-5 py-3">IP</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-xs text-neutral-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-5 py-3 font-bold text-teal-800">{log.username} <span className="text-xs text-neutral-400 font-normal">({log.role})</span></td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold text-[#A16207] bg-amber-50 px-2 py-0.5 rounded-full">{log.action}</span>
                          </td>
                          <td className="px-5 py-3 text-neutral-500">{log.resource_type} {log.resource_id ? `#${log.resource_id}` : ""}</td>
                          <td className="px-5 py-3 text-xs text-neutral-400 max-w-xs truncate">
                            {log.old_values && <span className="text-red-400 line-through mr-2">{JSON.stringify(log.old_values)}</span>}
                            {log.new_values && <span className="text-cyan-600">{JSON.stringify(log.new_values)}</span>}
                          </td>
                          <td className="px-5 py-3 text-xs text-neutral-400 font-mono">{log.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── S3 Media Sync ────────────────────────────── */}
          {activeTab === "media" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <h3 className="text-xl font-bold text-teal-800 mb-2">AWS S3 Media Sync</h3>
                <p className="text-neutral-500 text-sm mb-8 max-w-sm mx-auto">Upload high-resolution product images. This feature will be connected to AWS in the next phase.</p>
                <div className="border-2 border-dashed border-teal-200 rounded-2xl p-12 hover:bg-teal-50/50 hover:border-[#0F766E] transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-white shadow-sm border border-teal-100 text-[#0F766E] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:-translate-y-1 transition-transform">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="font-bold text-teal-800">Drop files here or click to upload</p>
                  <p className="text-sm text-neutral-400 mt-1">JPEG, PNG up to 50MB per file</p>
                </div>
                <div className="mt-6 text-left bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-yellow-800 mb-1">⚠️ AWS Integration Pending</p>
                  <p className="text-xs text-yellow-700">Connect your AWS credentials and S3 bucket name to enable media uploads.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
