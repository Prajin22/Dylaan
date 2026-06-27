"use client";

import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:5000/api";

type Order = {
  id: number;
  client_name: string;
  status: string;
  priority: string;
  total_boxes: number;
  destination_airport: string;
  flight_time: string;
  created_at: string;
  awb_number: string | null;
};

type Stats = {
  total_orders: number;
  to_pack: number;
  packing_now: number;
  ready_for_qc: number;
  dispatched_today: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pending:   { bg: "bg-yellow-100",  text: "text-yellow-800",  border: "border-yellow-200",  label: "PENDING"    },
  packing:   { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-200",    label: "PACKING"    },
  qc:        { bg: "bg-purple-100",  text: "text-purple-800",  border: "border-purple-200",  label: "QC READY"   },
  shipped:   { bg: "bg-cyan-100",   text: "text-cyan-800",   border: "border-cyan-200",   label: "SHIPPED"    },
  delivered: { bg: "bg-teal-100",    text: "text-teal-800",    border: "border-teal-200",    label: "DELIVERED"  },
};

const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-orange-400",
  low:    "bg-gray-300",
};

const NEXT_STATUS: Record<string, string> = {
  pending: "packing",
  packing: "qc",
  qc: "shipped",
  shipped: "delivered",
};

const ACTION_LABEL: Record<string, string> = {
  pending: "Start Packing",
  packing: "Mark QC Ready",
  qc:      "Mark Shipped",
  shipped: "Confirm Delivered",
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function ProductionDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [isAuthed, setIsAuthed] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(res => { if (res.ok) return res.json(); throw new Error(); })
      .then(data => setIsAuthed(data.role === "packhouse"))
      .catch(() => setIsAuthed(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true); setLoginError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) return setLoginError(data.error);
      if (data.role !== "packhouse") return setLoginError("Access denied. Production credentials required.");
      setIsAuthed(true);
    } catch { setLoginError("Connection failed."); }
    finally { setLoginLoading(false); }
  };

  const loadData = useCallback(() => {
    if (!isAuthed) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/orders`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch orders.");
        return r.json();
      }),
      fetch(`${API}/stats`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch stats.");
        return r.json();
      }),
    ])
      .then(([ordersData, statsData]) => {
        if (!Array.isArray(ordersData)) throw new Error(ordersData.error || "Invalid response format");
        setOrders(ordersData);
        setStats(statsData);
        setError(null);
      })
      .catch((err) => setError(err.message || "Cannot connect to API."))
      .finally(() => setLoading(false));
  }, [isAuthed]);

  useEffect(() => {
    loadData();
    // Poll every 15 seconds for live updates
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStatusChange = async (order: Order) => {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;
    setUpdatingId(order.id);
    try {
      const res = await fetch(`${API}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      // Refresh stats
      fetch(`${API}/stats`, { credentials: "include" }).then((r) => r.json()).then(setStats);
    } catch {
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders
    .filter((o) => filterStatus === "all" || o.status === filterStatus)
    .filter((o) =>
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.id).includes(searchQuery) ||
      (o.awb_number || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-[#22c55e] rounded flex items-center justify-center font-bold text-teal-950 text-xl shadow-md">PR</div>
            <div>
              <h2 className="text-xl font-extrabold text-teal-800">Production Portal</h2>
              <p className="text-xs text-neutral-400">Packhouse staff access</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="Username" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:ring-2 focus:ring-[#22c55e]" />
            <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="Password" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:ring-2 focus:ring-[#22c55e]" />
            {loginError && <div className="text-red-600 text-sm">{loginError}</div>}
            <button type="submit" disabled={loginLoading} className="w-full bg-[#22c55e] text-teal-950 font-bold py-3.5 rounded-xl shadow-lg">{loginLoading ? "Authenticating..." : "Sign In"}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#021A1A] text-slate-300 flex-shrink-0 min-h-screen hidden md:flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-white/80">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[#22c55e] rounded flex items-center justify-center font-bold text-teal-950 text-sm shadow-md group-hover:scale-105 transition-transform">PR</div>
            <h2 className="text-lg font-extrabold text-white">Production</h2>
          </a>
        </div>
        <nav className="flex-1 p-4 space-y-1 mt-2">
          {[
            { label: "Active Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", active: true },
            { label: "Quality Control", icon: "M5 13l4 4L19 7", active: false },
            { label: "Shipment Prep", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", active: false },
          ].map((item) => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${item.active ? "bg-white/10 text-white font-bold border-l-4 border-[#22c55e]" : "text-teal-100/60 hover:bg-white/10 hover:text-white"}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-800 rounded-full flex items-center justify-center font-bold text-white text-sm">W1</div>
            <div>
              <p className="text-sm font-bold text-white">Warehouse 1</p>
              <p className="text-xs text-teal-200/60">Shift A · Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4">
            <a href="/" className="text-[#0F766E] font-bold md:hidden text-xl">←</a>
            <h1 className="text-xl font-bold text-teal-800">Order Fulfillment</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500" title="Refresh">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-full text-xs font-bold border border-cyan-200">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
              Live · Auto-refresh 15s
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">{error}</p>
                  <p className="text-red-400 text-xs mt-0.5">Run: <code className="font-mono">python backend/app.py</code></p>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "To Pack",        value: stats?.to_pack,         color: "text-red-600",       sub: "High Priority" },
                { label: "Packing Now",    value: stats?.packing_now,     color: "text-[#0F766E]",     sub: "In Progress"   },
                { label: "QC Ready",       value: stats?.ready_for_qc,    color: "text-purple-600",    sub: "Awaiting QC"   },
                { label: "Dispatched",     value: stats?.dispatched_today, color: "text-cyan-600",    sub: "Today"         },
                { label: "Total Orders",   value: stats?.total_orders,    color: "text-teal-800",     sub: "All Time"      },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-4 shadow-sm border border-black/5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">{kpi.label}</p>
                  <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value ?? "—"}</p>
                  <p className="text-xs text-neutral-400 mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Table Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-gray-100 gap-3">
                <div className="flex gap-2 flex-wrap">
                  {["all", "pending", "packing", "qc", "shipped", "delivered"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all border ${filterStatus === s ? "bg-teal-300 text-teal-950 border-[#0F766E]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0F766E]/40"}`}
                    >
                      {s === "all" ? "All" : (STATUS_COLORS[s]?.label ?? s)}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders..."
                    className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none w-48"
                  />
                </div>
              </div>

              {loading ? (
                <Spinner />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-neutral-500 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Volume</th>
                        <th className="px-4 py-3">Flight</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-neutral-400 text-sm">No orders found.</td>
                        </tr>
                      ) : filteredOrders.map((order) => {
                        const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
                        const dot = PRIORITY_DOT[order.priority] ?? "bg-gray-300";
                        const nextAction = ACTION_LABEL[order.status];
                        const isUpdating = updatingId === order.id;
                        return (
                          <tr key={order.id} className="hover:bg-cyan-50/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${dot}`}></div>
                            </td>
                            <td className="px-4 py-3 font-mono font-medium text-slate-700">ORD-{order.id}</td>
                            <td className="px-4 py-3 font-bold text-teal-800">{order.client_name}</td>
                            <td className="px-4 py-3 text-neutral-600">{order.total_boxes} boxes</td>
                            <td className="px-4 py-3 text-neutral-500 font-medium">{order.flight_time} {order.destination_airport}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>
                                {order.status === "packing" && <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {nextAction ? (
                                <button
                                  onClick={() => handleStatusChange(order)}
                                  disabled={isUpdating}
                                  className="text-teal-950 font-bold text-xs bg-teal-300 hover:bg-teal-700 px-4 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUpdating ? "..." : nextAction}
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-300 font-medium">Done</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
