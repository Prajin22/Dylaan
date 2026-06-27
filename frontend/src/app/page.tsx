"use client";

import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:5000/api";

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string;
  image_url: string | null;
  in_stock: boolean;
};

type CartItem = Product & { quantity: number };

type InquiryItem = {
  product_name: string;
  quantity: number;
  unit: string;
};

type Inquiry = {
  id: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  quoted_total: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  items: InquiryItem[];
};

const CATEGORY_META: Record<string, { label: string; gradient: string; text: string; btnBg: string; btnText: string; accent: string }> = {
  flower: {
    label: "🌸 Exotic Flowers",
    gradient: "from-pink-500/20 to-rose-500/20",
    text: "text-rose-200",
    btnBg: "bg-rose-500/20 group-hover:bg-rose-500",
    btnText: "text-rose-100 group-hover:text-teal-950",
    accent: "bg-rose-400",
  },
  leaf: {
    label: "🌿 Sacred Leaves",
    gradient: "from-amber-500/20 to-orange-500/20",
    text: "text-amber-200",
    btnBg: "bg-amber-500/20 group-hover:bg-amber-500",
    btnText: "text-amber-100 group-hover:text-teal-950",
    accent: "bg-amber-400",
  },
  vegetable: {
    label: "🥬 Export Veggies",
    gradient: "from-teal-500/20 to-cyan-500/20",
    text: "text-teal-800",
    btnBg: "bg-teal-200/80 group-hover:bg-teal-500",
    btnText: "text-teal-900 group-hover:text-teal-950",
    accent: "bg-teal-400",
  },
};

const NAV_LINKS = [
  { label: "Catalog", href: "#catalog" },
  { label: "Track Shipment", href: "#track" },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const meta = CATEGORY_META[product.category] ?? CATEGORY_META.flower;
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group rounded-3xl overflow-hidden bg-white/60 backdrop-blur-3xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:border-teal-400/40 hover:shadow-[0_16px_48px_rgba(45,212,191,0.15)] hover:-translate-y-2 transition-all duration-300 flex flex-col">
      <div className={`h-44 bg-gradient-to-br ${meta.gradient} relative overflow-hidden p-5 flex flex-col justify-end border-b border-white/5`}>
        <div className={`absolute top-0 right-0 w-28 h-28 ${meta.accent} rounded-bl-full opacity-30 transition-transform group-hover:scale-125 duration-500 blur-xl`}></div>
        <span className={`text-xs font-bold uppercase tracking-widest ${meta.text} opacity-80 mb-1 z-10 relative drop-shadow-md`}>{product.category}</span>
        <h3 className={`text-xl font-bold text-teal-950 z-10 relative drop-shadow-md`}>{product.name}</h3>
      </div>
      <div className="p-5 flex flex-col flex-1 relative z-10">
        <p className="text-teal-900/70 text-sm mb-4 line-clamp-2 flex-1">{product.description}</p>
        <div className="flex justify-between items-center mb-5">
          <span className="text-xs font-bold text-teal-800 bg-teal-100/60 border border-teal-700/50 px-3 py-1.5 rounded-full shadow-inner">
            Per {product.unit}
          </span>
          {product.in_stock ? (
            <span className="text-xs font-bold text-teal-700 bg-teal-100/60 border border-teal-700/50 px-3 py-1.5 rounded-full">In Stock</span>
          ) : (
            <span className="text-xs font-bold text-rose-300 bg-rose-900/50 border border-rose-700/50 px-3 py-1.5 rounded-full">Out of Stock</span>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={!product.in_stock}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${meta.btnBg} ${meta.btnText} ${added ? "scale-95" : "scale-100"} disabled:opacity-30 disabled:cursor-not-allowed shadow-lg`}
        >
          {added ? "✓ Added to Draft" : "Add to Draft"}
        </button>
      </div>
    </div>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (token: string, username: string, verificationStatus?: string) => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError("Enter username and password."); return; }
    setLoading(true); setError(null); setSuccessMsg(null);
    try {
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Login failed.");
      else onSuccess(data.token, data.username, data.verification_status);
    } catch { setError("Connection failed."); } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep < 3) {
      if (registerStep === 1 && (!username.trim() || !password.trim() || !email.trim())) { setError("Fill all account fields."); return; }
      if (registerStep === 2 && (!companyName.trim())) { setError("Fill company details."); return; }
      setError(null);
      setRegisterStep(registerStep + 1);
      return;
    }
    
    if (!username.trim() || !password.trim() || !email.trim() || !companyName.trim()) { setError("Fill all required fields."); return; }
    setLoading(true); setError(null); setSuccessMsg(null);
    try {
      const res = await fetch(`${API}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, password, email, company_name: companyName, gstin_vat_number: gstin }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Registration failed.");
      else { setSuccessMsg(data.message || "Success! You can now sign in."); setTab("login"); setPassword(""); }
    } catch { setError("Connection failed."); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(2,15,12,0.8)", backdropFilter: "blur(12px)" }}>
      <div className="relative w-full max-w-md bg-teal-50/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_0_80px_rgba(20,184,166,0.15)] border border-teal-500/20 overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-teal-100/50 to-teal-200/50 pointer-events-none"></div>
        <div className="p-8 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-200/60 border border-teal-500/30 rounded-2xl flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(20,184,166,0.3)]">🌱</div>
              <div>
                <h2 className="text-2xl font-extrabold text-teal-950 tracking-tight">Client Portal</h2>
                <p className="text-sm text-teal-700/70 font-medium">Dylaan International</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/60 hover:bg-white/10 flex items-center justify-center text-teal-800 hover:text-teal-950 transition-all border border-white/70">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex bg-white/50 p-1.5 rounded-xl mb-6 border border-white/70 shadow-inner">
            <button className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "login" ? "bg-teal-600 text-teal-950 shadow-lg shadow-teal-900/50" : "text-teal-600/60 hover:text-teal-800"}`} onClick={() => { setTab("login"); setError(null); setSuccessMsg(null); setRegisterStep(1); }}>Sign In</button>
            <button className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "register" ? "bg-teal-600 text-teal-950 shadow-lg shadow-teal-900/50" : "text-teal-600/60 hover:text-teal-800"}`} onClick={() => { setTab("register"); setError(null); setSuccessMsg(null); }}>Register</button>
          </div>
          {tab === "register" && (
            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-col items-center relative z-10 w-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${registerStep >= step ? "bg-teal-500 text-cyan-950 shadow-[0_0_10px_rgba(20,184,166,0.5)]" : "bg-white/50 text-teal-800/50 border border-white/70"}`}>
                    {registerStep > step ? "✓" : step}
                  </div>
                  {step < 3 && <div className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 ${registerStep > step ? "bg-teal-400" : "bg-white/50"}`}></div>}
                </div>
              ))}
            </div>
          )}
          {successMsg && <div className="mb-5 flex items-center gap-3 bg-teal-100/80 border border-teal-500/30 text-teal-800 text-sm px-4 py-3 rounded-xl backdrop-blur-2xl"><span>✓</span> {successMsg}</div>}
          {error && <div className="mb-5 flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm px-4 py-3 rounded-xl backdrop-blur-2xl"><span>⚠</span> {error}</div>}
          <form onSubmit={tab === "login" ? handleLogin : handleRegister} className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
            {tab === "register" ? (
              <>
                {registerStep === 1 && (
                  <div className="space-y-4 animate-fade-in">
                    <div><label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Username *</label><input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" /></div>
                    <div><label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Email *</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" /></div>
                    <div>
                      <label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Password *</label>
                      <div className="relative">
                        <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-600/50 hover:text-teal-700 p-1">👁</button>
                      </div>
                    </div>
                  </div>
                )}
                {registerStep === 2 && (
                  <div className="space-y-4 animate-fade-in">
                    <div><label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Company Name *</label><input required type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" /></div>
                    <div><label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">GSTIN / VAT Number</label><input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" /></div>
                  </div>
                )}
                {registerStep === 3 && (
                  <div className="text-center py-6 animate-fade-in">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-teal-400">📝</div>
                    <h3 className="text-lg font-extrabold text-teal-950 mb-2">Almost Done</h3>
                    <p className="text-sm text-teal-700/80">Submit your registration to begin the compliance check and unlock wholesale access.</p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  {registerStep > 1 && (
                    <button type="button" onClick={() => setRegisterStep(registerStep - 1)} className="w-1/3 bg-white/50 hover:bg-white/80 text-teal-900 py-4 rounded-xl font-bold transition-all border border-white/70">Back</button>
                  )}
                  <button type="submit" disabled={loading} className="flex-1 bg-teal-500 hover:bg-teal-400 text-cyan-950 py-4 rounded-xl font-extrabold shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center">
                    {loading ? "Processing…" : registerStep < 3 ? "Continue" : "Submit Registration"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 animate-fade-in">
                  <div><label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Username *</label><input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" /></div>
                  <div>
                    <label className="text-xs font-bold text-teal-800/80 mb-2 block uppercase tracking-wider">Password *</label>
                    <div className="relative">
                      <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3 rounded-xl border border-teal-500/20 bg-white/50 text-teal-950 focus:ring-2 focus:ring-teal-400 outline-none text-sm shadow-inner" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-600/50 hover:text-teal-700 p-1">👁</button>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-400 text-cyan-950 mt-6 py-4 rounded-xl font-extrabold text-[15px] transition-all shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:-translate-y-0.5 duration-200 disabled:opacity-50 flex items-center justify-center uppercase tracking-wide">
                  {loading ? "Processing…" : "Secure Sign In"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function CatalogLocked({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/80 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100/80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-100/80 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
      
      <div className="relative mb-8 z-10">
        <div className="w-24 h-24 bg-teal-100/60 backdrop-blur-2xl rounded-3xl flex items-center justify-center shadow-inner border border-teal-500/30">
          <svg className="w-10 h-10 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="absolute -top-2 -right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-sm shadow-lg shadow-amber-500/30 border border-amber-300">🌿</div>
      </div>
      <h3 className="text-3xl font-extrabold text-teal-950 mb-4 tracking-tight z-10">Exclusive B2B Access</h3>
      <p className="text-teal-900/70 max-w-md mb-10 leading-relaxed z-10 text-lg">
        Our live product catalog and pricing is exclusively available to verified global buyers. Sign in to explore.
      </p>
      <button
        onClick={onLoginClick}
        className="bg-teal-400 hover:bg-teal-300 text-cyan-950 px-10 py-4 rounded-full font-extrabold text-[15px] transition-all shadow-[0_0_30px_rgba(45,212,191,0.3)] hover:shadow-[0_0_40px_rgba(45,212,191,0.5)] hover:-translate-y-1 active:translate-y-0 duration-200 z-10 uppercase tracking-wide"
      >
        Sign In to View Catalog
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [awbInput, setAwbInput] = useState("");
  const [awbResult, setAwbResult] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  useEffect(() => {
    const username = localStorage.getItem("dylaan_username");
    const vStatus = localStorage.getItem("dylaan_verification_status");
    if (username) {
      setIsLoggedIn(true);
      setLoggedInUser(username);
      setVerificationStatus(vStatus);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/products`, { credentials: "include" });
      if (res.status === 401) return handleLogout();
      if (res.status === 403) {
        setVerificationStatus("pending");
        localStorage.setItem("dylaan_verification_status", "pending");
        setLoading(false); return;
      }
      if (!res.ok) throw new Error("API unavailable");
      setProducts(await res.json());
    } catch { setError("Backend disconnected."); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await fetch(`${API}/inquiries`, { credentials: "include" });
      if (res.ok) setInquiries(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isLoggedIn) { fetchProducts(); fetchInquiries(); }
  }, [isLoggedIn, fetchProducts, fetchInquiries]);

  const handleLoginSuccess = (token: string, username: string, vStatus?: string) => {
    localStorage.setItem("dylaan_username", username);
    if (vStatus) localStorage.setItem("dylaan_verification_status", vStatus);
    setIsLoggedIn(true); setLoggedInUser(username); setVerificationStatus(vStatus || null); setShowLoginModal(false);
  };

  const handleLogout = async () => {
    try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
    localStorage.removeItem("dylaan_username"); localStorage.removeItem("dylaan_verification_status");
    setIsLoggedIn(false); setLoggedInUser(""); setVerificationStatus(null); setProducts([]); setInquiries([]); setShowDashboard(false);
  };

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === p.id);
      if (existing) return prev.map((item) => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const updateCartQty = (id: number, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(0, item.quantity + delta) };
      return item;
    }).filter(item => item.quantity > 0));
  };

  const submitInquiry = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetch(`${API}/inquiries`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ items: cart.map((c) => ({ product_id: c.id, quantity: c.quantity })) })
      });
      if (res.ok) { setCart([]); setIsCartOpen(false); fetchInquiries(); setShowDashboard(true); }
      else alert("Failed to submit inquiry. Check limit (max 3 open).");
    } catch { alert("Network error."); }
  };

  const categories = ["all", "flower", "leaf", "vegetable"];
  const filteredProducts = products.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awbInput.trim()) return;
    setAwbResult(`AWB ${awbInput.toUpperCase()} — In Transit · ETA: On Time`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-transparent text-teal-50 selection:bg-teal-500/30">
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />}

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-cyan-950/90 backdrop-blur-3xl h-full shadow-2xl flex flex-col animate-fade-in border-l border-teal-500/20">
            <div className="p-6 border-b border-teal-500/20 flex justify-between items-center bg-teal-100/60">
              <h2 className="text-xl font-bold text-teal-950 flex items-center gap-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Inquiry Draft
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-teal-600/60 hover:text-teal-950 transition-colors p-2 bg-white/60 rounded-full hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center py-24 text-teal-500/50">
                  <p className="text-5xl mb-4 opacity-50">🛒</p>
                  <p className="font-bold text-lg text-teal-800">Your draft is empty</p>
                  <p className="text-sm mt-2 text-teal-600/60">Add items from the catalog to request a quote.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 p-4 rounded-2xl border border-white/70 bg-white/50 shadow-inner group">
                    <div className="w-16 h-16 rounded-xl bg-teal-200/60 border border-teal-500/20 flex items-center justify-center text-2xl shadow-md">🌱</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-teal-950 text-sm leading-tight mb-1">{item.name}</h4>
                      <p className="text-xs text-teal-700/60 mb-3 uppercase tracking-wider">{item.unit}</p>
                      <div className="flex items-center gap-3 bg-black/30 w-fit rounded-lg p-1 border border-white/70">
                        <button onClick={() => updateCartQty(item.id, -1)} className="w-7 h-7 rounded-md bg-white/60 flex items-center justify-center text-teal-950 font-bold hover:bg-white/20 transition-colors">-</button>
                        <span className="text-sm font-bold w-6 text-center text-teal-950">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} className="w-7 h-7 rounded-md bg-white/60 flex items-center justify-center text-teal-950 font-bold hover:bg-white/20 transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 border-t border-teal-500/20 bg-teal-900/30 backdrop-blur-2xl">
                <button onClick={submitInquiry} className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 py-4 rounded-xl font-extrabold text-[15px] transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] uppercase tracking-wide">
                  Submit Draft for Quote
                </button>
                <p className="text-xs text-center text-teal-600/50 mt-4 font-medium uppercase tracking-wider">No payment required until approved</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deep Sea Glassmorphism Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-teal-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[70vw] rounded-full bg-teal-100/80 blur-[130px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] left-[10%] w-[70vw] h-[50vw] rounded-full bg-cyan-700/20 blur-[150px] mix-blend-screen"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
      </div>

      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-50 backdrop-blur-3xl bg-cyan-950/40 border-b border-white/80 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-teal-200/80 border border-teal-400/30 rounded-xl flex items-center justify-center font-bold text-teal-950 text-xl shadow-[0_0_15px_rgba(45,212,191,0.2)] group-hover:scale-105 transition-transform duration-300">🌱</div>
            <span className="text-2xl font-extrabold tracking-tight text-teal-950">Dylaan <span className="text-teal-600">International</span></span>
          </a>

          <nav className="hidden md:flex gap-8 items-center">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="font-semibold text-teal-900 hover:text-teal-950 transition-colors">{l.label}</a>
            ))}
            {isLoggedIn && verificationStatus === "approved" && (
              <button onClick={() => setShowDashboard(!showDashboard)} className="font-extrabold text-amber-300 hover:text-amber-100 bg-amber-500/10 px-4 py-2 rounded-xl transition-colors border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                {showDashboard ? "View Catalog" : "My Inquiries"}
              </button>
            )}
          </nav>

          <div className="flex gap-4 items-center">


            {isLoggedIn ? (
              <div className="flex items-center gap-4 border-l border-white/80 pl-4 ml-2">
                {verificationStatus === "approved" && (
                  <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 text-teal-900 bg-white/60 hover:bg-white/10 rounded-xl transition-colors border border-white/70 shadow-sm">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-amber-950 text-[11px] font-extrabold flex items-center justify-center rounded-full shadow-md border border-amber-300">{cart.reduce((a,b)=>a+b.quantity,0)}</span>}
                  </button>
                )}
                <div className="flex items-center gap-4 bg-white/50 pr-1 pl-4 py-1 rounded-full border border-white/70">
                  <span className="hidden md:flex items-center gap-2 text-sm font-bold text-teal-950 tracking-wide">
                    <span className={`w-2 h-2 rounded-full ${verificationStatus === "approved" ? "bg-teal-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"} animate-pulse`} />
                    {loggedInUser}
                  </span>
                  <button onClick={handleLogout} className="bg-white/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 px-4 py-1.5 rounded-full font-bold text-xs transition-all duration-200 uppercase tracking-wider">
                    Exit
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="bg-teal-400 hover:bg-teal-300 text-cyan-950 px-6 py-2.5 rounded-full font-extrabold text-sm transition-all shadow-[0_0_20px_rgba(45,212,191,0.4)] uppercase tracking-wider">
                Sign In
              </button>
            )}
            <button className="md:hidden p-2 text-teal-950 bg-white/60 rounded-lg border border-white/80" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {showDashboard ? (
          <section className="container mx-auto px-6 py-16 max-w-5xl animate-fade-in">
            <h2 className="text-4xl font-extrabold text-teal-950 mb-10 tracking-tight">My Operations Dashboard</h2>
            {inquiries.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-3xl rounded-[2rem] border border-white/80 p-16 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-100/80 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <p className="text-6xl mb-6 opacity-80 drop-shadow-lg">📭</p>
                  <h3 className="text-2xl font-extrabold text-teal-950 mb-3">No Active Operations</h3>
                  <p className="text-teal-800/70 mb-8 max-w-sm mx-auto text-lg">Browse the catalog and submit a draft to begin the export process.</p>
                  <button onClick={() => setShowDashboard(false)} className="bg-teal-500 hover:bg-teal-400 text-cyan-950 px-8 py-3.5 rounded-full font-extrabold shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all uppercase tracking-wide">Enter Catalog</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {inquiries.map(inq => (
                  <div key={inq.id} className="bg-white/60 backdrop-blur-3xl rounded-3xl border border-white/80 shadow-2xl overflow-hidden group hover:border-teal-500/30 transition-colors">
                    <div className="p-6 border-b border-white/70 flex flex-col md:flex-row justify-between items-start md:items-center bg-white/50">
                      <div className="mb-4 md:mb-0">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="font-extrabold text-xl text-teal-950 tracking-wider">INQ-{inq.id}</h3>
                          <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-md uppercase tracking-widest border ${
                            inq.status === 'open' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]' :
                            inq.status === 'quoted' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' :
                            inq.status === 'confirmed' ? 'bg-teal-100/80 text-teal-700 border-teal-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-white/60 text-teal-950/50 border-white/80'
                          }`}>{inq.status}</span>
                        </div>
                        <p className="text-xs text-teal-600/50 uppercase tracking-widest font-medium">Filed: {new Date(inq.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-left md:text-right bg-white/60 p-4 rounded-2xl border border-white/70 min-w-[200px]">
                        {inq.quoted_total ? (
                          <>
                            <p className="text-xs text-teal-800/60 uppercase tracking-wider mb-1 font-bold">Total Quote</p>
                            <p className="text-3xl font-black text-teal-950 drop-shadow-md mb-2">₹{inq.quoted_total.toLocaleString()}</p>
                            <p className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded inline-block border border-amber-500/20">Deposit: ₹{inq.deposit_amount?.toLocaleString()}</p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 h-full justify-center md:justify-end text-teal-700/60">
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                            <p className="text-sm font-bold uppercase tracking-wide">Awaiting Quote</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-8 grid md:grid-cols-2 gap-8 relative">
                      {inq.status === 'confirmed' && (
                        <div className="absolute inset-0 bg-teal-900/10 backdrop-blur-[2px] z-0 pointer-events-none"></div>
                      )}
                      <div className="relative z-10">
                        <p className="text-xs font-bold text-teal-600/50 uppercase mb-4 tracking-widest flex items-center gap-2"><span className="w-4 h-[1px] bg-teal-500/30"></span> Manifest</p>
                        <ul className="space-y-3">
                          {inq.items.map((it, idx) => (
                            <li key={idx} className="flex justify-between text-sm border-b border-white/70 pb-3">
                              <span className="font-bold text-teal-50">{it.product_name}</span>
                              <span className="text-teal-800/70 font-medium bg-white/50 px-2 py-0.5 rounded border border-white/70">{it.quantity} {it.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col justify-center relative z-10">
                        {inq.status === 'quoted' && !inq.deposit_paid && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-center shadow-[0_0_30px_rgba(245,158,11,0.1)] backdrop-blur-2xl">
                            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400 text-xl shadow-inner">💳</div>
                            <p className="text-sm text-amber-200 font-medium mb-5 leading-relaxed">Quote approved by Admin. Secure your export pipeline by paying the mandatory deposit.</p>
                            <button className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 py-3.5 rounded-xl font-extrabold text-[15px] shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all hover:scale-[1.02] uppercase tracking-wide">
                              Transfer ₹{inq.deposit_amount?.toLocaleString()}
                            </button>
                          </div>
                        )}
                        {inq.status === 'confirmed' && (
                          <div className="bg-teal-100/80 border border-teal-500/30 rounded-2xl p-8 text-center flex items-center justify-center flex-col h-full shadow-[0_0_30px_rgba(16,185,129,0.1)] backdrop-blur-2xl">
                            <div className="w-16 h-16 bg-teal-200/80 border border-teal-500/40 text-teal-600 rounded-full flex items-center justify-center mb-4 text-3xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">✓</div>
                            <p className="text-xl text-teal-900 font-extrabold tracking-tight">Supply Confirmed</p>
                            <p className="text-sm text-teal-700/80 mt-2 font-medium">Entering production queue.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Landing & Catalog view */}
            <section className="container mx-auto px-6 pt-28 pb-24 text-center relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-100/80 rounded-full blur-[100px] pointer-events-none"></div>
              
              <div className="inline-flex items-center gap-3 bg-white/60 backdrop-blur-3xl border border-white/80 text-teal-800 px-5 py-2.5 rounded-full text-sm font-extrabold mb-10 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
                <span className="uppercase tracking-widest text-[11px]">Season 2026 Direct</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-black text-teal-950 mb-8 leading-[1.05] tracking-tighter drop-shadow-md">
                Global Agriculture<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-800 to-teal-950">Redefined</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-teal-950 font-medium max-w-3xl mx-auto mb-14 leading-relaxed">
                Secure enterprise-grade procurement of premium florals and foliage. Direct from source, climate-controlled, worldwide.
              </p>
            </section>

            <section id="catalog" className="container mx-auto px-6 py-16 relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                <div>
                  <h2 className="text-4xl font-black text-teal-950 tracking-tight drop-shadow-md">Global Exchange</h2>
                  <p className="text-teal-800/60 mt-2 text-lg">Real-time inventory for verified partners</p>
                </div>
                {isLoggedIn && verificationStatus === "approved" && (
                  <div className="relative w-full md:w-80">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-600/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search commodities..." className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/50 backdrop-blur-2xl border border-white/80 text-teal-950 placeholder-teal-400/40 focus:ring-2 focus:ring-teal-400 focus:bg-white/70 outline-none shadow-inner transition-all font-medium" />
                  </div>
                )}
              </div>

              {!isLoggedIn ? (
                <CatalogLocked onLoginClick={() => setShowLoginModal(true)} />
              ) : verificationStatus === "pending" ? (
                <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/80 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="relative mb-8 z-10">
                    <div className="w-24 h-24 bg-amber-900/30 backdrop-blur-2xl rounded-3xl flex items-center justify-center shadow-inner border border-amber-500/30">
                      <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  </div>
                  <h3 className="text-3xl font-extrabold text-teal-950 mb-4 tracking-tight z-10">Verification Pending</h3>
                  <p className="text-amber-900 max-w-md mb-4 leading-relaxed text-lg z-10 font-medium">Compliance and KYC checks are currently running. You will be notified once clearance is granted.</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-4 mb-10 flex-wrap">
                    {categories.map((cat) => (
                      <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-2.5 rounded-full font-extrabold text-sm capitalize transition-all duration-300 border backdrop-blur-2xl shadow-lg tracking-wide ${activeCategory === cat ? "bg-teal-500 text-cyan-950 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.4)]" : "bg-white/60 text-teal-900 border-white/80 hover:bg-white/10 hover:border-teal-400/40"}`}>
                        {cat === "all" ? "🌾 View All" : cat === "flower" ? "🌸 Exotics" : cat === "leaf" ? "🌿 Foliage" : "🥬 Produce"}
                      </button>
                    ))}
                  </div>

                  {loading ? <Spinner /> : filteredProducts.length === 0 ? (
                    <div className="text-center py-24 text-teal-500/40 bg-white/50 rounded-[2rem] border border-white/70 shadow-inner">
                      <p className="text-5xl mb-4 opacity-50">🔍</p>
                      <p className="font-bold text-xl text-teal-800/70">No commodities matched.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      {filteredProducts.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* Deep Track Section */}
        <section id="track" className="relative py-28 mt-20 border-t border-white/70 overflow-hidden">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-3xl -z-10"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-teal-500/5 rounded-[100%] blur-[100px] pointer-events-none -z-10"></div>
          
          <div className="container mx-auto px-6 max-w-3xl text-center relative z-10">
            <h2 className="text-4xl font-black text-teal-950 mb-4 tracking-tight drop-shadow-lg">Global Logistics Radar</h2>
            <p className="text-teal-800/60 mb-10 text-lg">Input AWB for live satellite tracking of your shipment.</p>
            <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-4 justify-center bg-white/60 p-4 rounded-3xl border border-white/80 shadow-2xl backdrop-blur-3xl">
              <input type="text" value={awbInput} onChange={(e) => setAwbInput(e.target.value)} placeholder="ENTER AWB ID (e.g. AWB-2026)" className="flex-1 px-6 py-4 rounded-2xl bg-black/30 border border-white/70 text-teal-950 placeholder-teal-500/40 focus:ring-2 focus:ring-teal-500 outline-none font-bold uppercase tracking-widest text-sm shadow-inner" />
              <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-cyan-950 px-10 py-4 rounded-2xl font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] uppercase tracking-widest text-sm">Track Shipment</button>
            </form>
            {awbResult && (
              <div className="mt-8 bg-white/70 backdrop-blur-3xl border border-teal-500/30 rounded-3xl p-8 text-left text-teal-950 animate-fade-in shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]"></span>
                  <p className="font-extrabold text-teal-700 text-xs uppercase tracking-widest">Active Radar Link</p>
                </div>
                <p className="font-bold text-lg text-teal-50">{awbResult}</p>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative bg-black/60 border-t border-white/80 text-teal-900/60 py-16 backdrop-blur-3xl z-20">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6 opacity-50">
            <span className="text-2xl filter grayscale">🌱</span>
            <h2 className="text-xl font-extrabold text-teal-950 tracking-widest uppercase">Dylaan International</h2>
          </div>
          <p className="text-sm font-medium tracking-wider uppercase opacity-50">© 2026 Earth Link Systems</p>
        </div>
      </footer>
    </div>
  );
}
