"use client";

import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";

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
};

type Stats = {
  total_orders: number;
  to_pack: number;
  packing_now: number;
  ready_for_qc: number;
  dispatched_today: number;
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 border-4 border-[#A16207] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Overview",       icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z", tab: "overview" },
  { label: "Products",       icon: "M4 6h16M4 10h16M4 14h16M4 18h16", tab: "products" },
  { label: "Orders",         icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", tab: "orders" },
  { label: "S3 Media Sync",  icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12", tab: "media" },
];

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New product form
  const [form, setForm] = useState({ name: "", category: "flower", price: "", unit: "bundle", description: "" });
  const [formStatus, setFormStatus] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/stats`).then((r) => r.json()),
      fetch(`${API}/products`).then((r) => r.json()),
      fetch(`${API}/orders`).then((r) => r.json()),
    ])
      .then(([s, p, o]) => {
        setStats(s);
        setProducts(p);
        setOrders(o);
        setError(null);
      })
      .catch(() => setError("Cannot reach Flask API on port 5000."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus(null);
    try {
      const res = await fetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), in_stock: true }),
      });
      if (!res.ok) throw new Error();
      setFormStatus("success");
      setForm({ name: "", category: "flower", price: "", unit: "bundle", description: "" });
      // Reload products
      fetch(`${API}/products`).then((r) => r.json()).then(setProducts);
    } catch {
      setFormStatus("error");
    }
  };

  const revenue = orders.reduce((acc, o) => acc + o.total_boxes * 250, 0); // ₹250 estimated per box

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#021A1A] text-slate-300 flex-shrink-0 min-h-screen hidden md:flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-gradient-to-br from-[#A16207] to-yellow-600 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-md">🌱</div>
            <div>
              <h2 className="text-lg font-extrabold text-white leading-tight">Admin<span className="text-[#A16207]">Pro</span></h2>
              <p className="text-xs text-teal-400/70">System Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${activeTab === item.tab ? "bg-white/10 text-white font-bold border-l-4 border-[#A16207]" : "text-teal-100/60 hover:bg-white/5 hover:text-white"}`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <a href="/" className="flex items-center gap-2 text-sm text-teal-200/60 hover:text-white transition-colors font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Storefront
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-extrabold text-[#134E4A] tracking-tight">
            {NAV_ITEMS.find((n) => n.tab === activeTab)?.label ?? "Admin"}
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={loadAll} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Refresh">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center text-[#0F766E] font-bold cursor-pointer hover:shadow-md transition-shadow">
              AM
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
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Est. Revenue",     value: `₹${(revenue / 1000).toFixed(1)}k`,  sub: "Based on all orders",    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",    trend: "+14.2% this month", trendUp: true,  bg: "bg-teal-50",   icon_color: "text-[#0F766E]" },
                  { label: "Active Orders",    value: stats ? String(stats.total_orders) : "—", sub: `${stats?.to_pack ?? 0} pending, ${stats?.packing_now ?? 0} packing`, icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", trend: null,           trendUp: false, bg: "bg-blue-50",   icon_color: "text-blue-600"   },
                  { label: "Products Listed",  value: String(products.length),             sub: "In catalog",             icon: "M4 6h16M4 10h16M4 14h16M4 18h16",                                                                                                                                           trend: null,           trendUp: false, bg: "bg-green-50",  icon_color: "text-green-600"  },
                  { label: "To Pack Today",    value: stats ? String(stats.to_pack) : "—", sub: "Needs attention",        icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",                                                                                                        trend: null,           trendUp: false, bg: "bg-orange-50", icon_color: "text-orange-500" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-24 h-24 ${kpi.bg} rounded-bl-full opacity-50 group-hover:scale-110 transition-transform`}></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</h3>
                      <span className={`p-2 ${kpi.bg} ${kpi.icon_color} rounded-lg`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.icon} /></svg>
                      </span>
                    </div>
                    <p className="text-4xl font-black text-[#134E4A] tracking-tight">{kpi.value}</p>
                    <p className="mt-2 text-xs text-neutral-400">{kpi.sub}</p>
                    {kpi.trend && <p className="mt-2 text-xs font-bold text-green-600 flex items-center gap-1">↑ {kpi.trend}</p>}
                  </div>
                ))}
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-[#134E4A]">Recent Orders</h3>
                  <button onClick={() => setActiveTab("orders")} className="text-sm font-bold text-[#0F766E] hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">View All</button>
                </div>
                {loading ? <Spinner /> : (
                  <div className="divide-y divide-gray-50">
                    {orders.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-[#0F766E] font-bold text-sm">#{o.id}</div>
                          <div>
                            <p className="font-bold text-[#134E4A] text-sm">{o.client_name}</p>
                            <p className="text-xs text-neutral-400">ORD-{o.id} · {o.total_boxes} boxes · {o.destination_airport}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${o.status === "shipped" || o.status === "delivered" ? "bg-green-100 text-green-700" : o.status === "packing" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
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
              {/* Add Product Form */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-[#134E4A] mb-5">Add New Product</h3>
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
                    <button type="submit" className="bg-[#0F766E] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors shadow-sm">
                      Add Product
                    </button>
                    {formStatus === "success" && <p className="text-green-600 text-sm font-bold">✓ Product added successfully!</p>}
                    {formStatus === "error"   && <p className="text-red-500 text-sm font-bold">✗ Failed to add product.</p>}
                  </div>
                </form>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-[#134E4A]">All Products ({products.length})</h3>
                </div>
                {loading ? <Spinner /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-xs uppercase text-neutral-400 border-b border-gray-100">
                        <tr>
                          <th className="px-5 py-3">Name</th>
                          <th className="px-5 py-3">Category</th>
                          <th className="px-5 py-3">Price</th>
                          <th className="px-5 py-3">Unit</th>
                          <th className="px-5 py-3">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {products.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-bold text-[#134E4A]">{p.name}</td>
                            <td className="px-5 py-3 capitalize text-neutral-500">{p.category}</td>
                            <td className="px-5 py-3 font-bold text-[#0F766E]">₹{p.price}</td>
                            <td className="px-5 py-3 text-neutral-500">{p.unit}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.in_stock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {p.in_stock ? "In Stock" : "Out of Stock"}
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
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-[#134E4A]">All Orders ({orders.length})</h3>
              </div>
              {loading ? <Spinner /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-neutral-400 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3">Order ID</th>
                        <th className="px-5 py-3">Client</th>
                        <th className="px-5 py-3">Boxes</th>
                        <th className="px-5 py-3">Destination</th>
                        <th className="px-5 py-3">Flight</th>
                        <th className="px-5 py-3">Priority</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-600">ORD-{o.id}</td>
                          <td className="px-5 py-3 font-bold text-[#134E4A]">{o.client_name}</td>
                          <td className="px-5 py-3 text-neutral-600">{o.total_boxes}</td>
                          <td className="px-5 py-3 font-medium text-neutral-600">{o.destination_airport}</td>
                          <td className="px-5 py-3 text-neutral-500">{o.flight_time}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${o.priority === "high" ? "bg-red-100 text-red-700" : o.priority === "medium" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                              {o.priority}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${o.status === "shipped" || o.status === "delivered" ? "bg-green-100 text-green-700" : o.status === "packing" ? "bg-blue-100 text-blue-700" : o.status === "qc" ? "bg-purple-100 text-purple-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {o.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-neutral-400 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
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
                <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">☁️</div>
                <h3 className="text-xl font-bold text-[#134E4A] mb-2">AWS S3 Media Sync</h3>
                <p className="text-neutral-500 text-sm mb-8 max-w-sm mx-auto">Upload high-resolution product images to your S3 bucket for global CDN delivery. This feature will be connected to AWS in the next phase.</p>
                <div className="border-2 border-dashed border-teal-200 rounded-2xl p-12 hover:bg-teal-50/50 hover:border-[#0F766E] transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-white shadow-sm border border-teal-100 text-[#0F766E] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:-translate-y-1 transition-transform">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="font-bold text-[#134E4A]">Drop files here or click to upload</p>
                  <p className="text-sm text-neutral-400 mt-1">JPEG, PNG up to 50MB per file</p>
                </div>
                <div className="mt-6 text-left bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-yellow-800 mb-1">⚠️ AWS Integration Pending</p>
                  <p className="text-xs text-yellow-700">Connect your AWS credentials and S3 bucket name to enable media uploads. See the implementation plan for Phase 2 instructions.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
