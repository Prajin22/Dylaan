"use client";

import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  description: string;
  image_url: string | null;
  in_stock: boolean;
};

const CATEGORY_META: Record<string, { label: string; gradient: string; bg: string; text: string; btnBg: string; btnText: string; accent: string }> = {
  flower: {
    label: "🌸 Exotic Flowers",
    gradient: "from-pink-50 to-rose-50",
    bg: "bg-pink-100",
    text: "text-rose-900",
    btnBg: "bg-rose-50 group-hover:bg-[#0F766E]",
    btnText: "text-[#0F766E] group-hover:text-white",
    accent: "bg-rose-200",
  },
  leaf: {
    label: "🌿 Sacred Leaves",
    gradient: "from-yellow-50 to-orange-50",
    bg: "bg-yellow-100",
    text: "text-orange-900",
    btnBg: "bg-orange-50 group-hover:bg-[#A16207]",
    btnText: "text-[#A16207] group-hover:text-white",
    accent: "bg-yellow-200",
  },
  vegetable: {
    label: "🥬 Export Veggies",
    gradient: "from-green-100 to-emerald-50",
    bg: "bg-green-100",
    text: "text-green-900",
    btnBg: "bg-green-50 group-hover:bg-[#15803d]",
    btnText: "text-[#15803d] group-hover:text-white",
    accent: "bg-green-200",
  },
};

const NAV_LINKS = [
  { label: "Catalog", href: "#catalog" },
  { label: "Track Shipment", href: "#track" },
  { label: "Contact", href: "#contact" },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const meta = CATEGORY_META[product.category] ?? CATEGORY_META.flower;
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group rounded-3xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(15,118,110,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col">
      <div className={`h-44 bg-gradient-to-br ${meta.gradient} relative overflow-hidden p-5 flex flex-col justify-end`}>
        <div className={`absolute top-0 right-0 w-28 h-28 ${meta.accent} rounded-bl-full opacity-50 transition-transform group-hover:scale-125 duration-500`}></div>
        <span className={`text-xs font-bold uppercase tracking-widest ${meta.text} opacity-60 mb-1 z-10 relative`}>{product.category}</span>
        <h3 className={`text-xl font-bold ${meta.text} z-10 relative`}>{product.name}</h3>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-neutral-500 text-sm mb-4 line-clamp-2 flex-1">{product.description}</p>
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-semibold text-[#0F766E] bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
            Per {product.unit}
          </span>
          {product.in_stock ? (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">In Stock</span>
          ) : (
            <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">Out of Stock</span>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={!product.in_stock}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${meta.btnBg} ${meta.btnText} ${added ? "scale-95" : "scale-100"} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {added ? "✓ Added to Enquiry" : "Add to Enquiry"}
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
  onSuccess: (token: string, username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
      } else {
        onSuccess(data.token, data.username);
      }
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,20,0.65)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.18)] border border-white/60 overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-[#22c55e] to-[#A16207]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#0F766E] rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                🌱
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#134E4A]">Client Portal</h2>
                <p className="text-xs text-neutral-400 font-medium">AgriB2B Global</p>
              </div>
            </div>
            <button
              id="login-modal-close"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200"
              aria-label="Close login modal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-2xl font-extrabold text-[#134E4A] mb-1">Welcome back</h3>
            <p className="text-neutral-500 text-sm">Sign in to browse our product catalog.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-[#134E4A] mb-1.5 block" htmlFor="login-username">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm bg-gray-50/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[#134E4A] mb-1.5 block" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm bg-gray-50/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#0F766E] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F766E] hover:bg-teal-800 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In →"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-400 mt-6">
            Don&apos;t have an account? Contact your account manager.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Locked Catalog Placeholder ───────────────────────────────────────────────

function CatalogLocked({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-[#0F766E]/10 to-[#22c55e]/10 rounded-3xl flex items-center justify-center shadow-inner border border-[#0F766E]/10">
          <svg className="w-10 h-10 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#A16207] rounded-full flex items-center justify-center text-xs">🌿</div>
      </div>
      <h3 className="text-2xl font-extrabold text-[#134E4A] mb-3">Client Login Required</h3>
      <p className="text-neutral-500 max-w-sm mb-8 leading-relaxed text-sm">
        Our product catalog is exclusively available to registered B2B clients. Please log in to browse our full range of flowers and leaves.
      </p>
      <button
        id="catalog-login-btn"
        onClick={onLoginClick}
        className="bg-[#0F766E] hover:bg-teal-800 text-white px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-[0_8px_20px_rgba(15,118,110,0.25)] hover:shadow-[0_12px_28px_rgba(15,118,110,0.35)] hover:-translate-y-0.5 active:translate-y-0 duration-200"
      >
        Sign In to View Catalog →
      </button>
      <div className="mt-10 grid grid-cols-3 gap-4 max-w-xs mx-auto opacity-30 pointer-events-none select-none">
        {["🌸", "🌿", "🌺", "🍃", "🌼", "🌱"].map((emoji, i) => (
          <div key={i} className="h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center text-2xl border border-gray-200 blur-[2px]">
            {emoji}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
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

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("agrib2b_token");
    const username = localStorage.getItem("agrib2b_username");
    if (token && username) {
      setIsLoggedIn(true);
      setLoggedInUser(username);
    }
  }, []);

  // Fetch products when logged in
  const fetchProducts = useCallback(async () => {
    const token = localStorage.getItem("agrib2b_token");
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Token expired — log out
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      setProducts(data);
    } catch {
      setError("Could not connect to the server. Please start the Flask backend.");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoggedIn) {
      fetchProducts();
    }
  }, [isLoggedIn, fetchProducts]);

  const handleLoginSuccess = (token: string, username: string) => {
    localStorage.setItem("agrib2b_token", token);
    localStorage.setItem("agrib2b_username", username);
    setIsLoggedIn(true);
    setLoggedInUser(username);
    setShowLoginModal(false);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("agrib2b_token");
    if (token) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    localStorage.removeItem("agrib2b_token");
    localStorage.removeItem("agrib2b_username");
    setIsLoggedIn(false);
    setLoggedInUser("");
    setProducts([]);
  };

  const categories = ["all", "flower", "leaf", "vegetable"];

  const filteredProducts = products.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awbInput.trim()) return;
    setAwbResult(
      `AWB ${awbInput.toUpperCase()} — Status: In Transit · Last scanned: Bengaluru (BLR) Air Cargo Terminal · ETA: On Time`
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans" style={{ background: "var(--background)" }}>
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}

      {/* Aurora Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-[#0F766E] opacity-[0.12] blur-[120px] animate-pulse"></div>
        <div className="absolute top-[10%] right-[-10%] w-[40%] h-[60%] rounded-full bg-[#22c55e] opacity-[0.08] blur-[130px]"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] rounded-full bg-[#A16207] opacity-[0.07] blur-[100px]"></div>
      </div>

      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-[#0F766E] rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg group-hover:scale-105 transition-transform duration-300">
              🌱
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#134E4A]">AgriB2B <span className="text-[#0F766E]">Global</span></span>
          </a>

          <nav className="hidden md:flex gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="font-semibold text-[#134E4A]/80 hover:text-[#0F766E] transition-colors">{l.label}</a>
            ))}
          </nav>

          <div className="flex gap-3 items-center">
            <a href="/production" className="hidden md:block text-sm font-semibold text-neutral-500 hover:text-[#0F766E] transition-colors">Production</a>
            <a href="/admin" className="hidden md:block text-sm font-semibold text-neutral-500 hover:text-[#0F766E] transition-colors">Admin</a>

            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <span className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[#134E4A]">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                  {loggedInUser}
                </span>
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-full font-bold text-sm transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                id="header-login-btn"
                onClick={() => setShowLoginModal(true)}
                className="bg-[#0F766E] hover:bg-teal-800 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 duration-200"
              >
                Client Login
              </button>
            )}
            <button className="md:hidden p-2 text-[#134E4A]" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/30 bg-white/90 backdrop-blur-xl px-6 py-4 flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="font-semibold text-[#134E4A] hover:text-[#0F766E] py-1">{l.label}</a>
            ))}
            <hr className="border-gray-200"/>
            <a href="/production" className="font-semibold text-neutral-500 hover:text-[#0F766E] py-1">Production Dashboard</a>
            <a href="/admin" className="font-semibold text-neutral-500 hover:text-[#0F766E] py-1">Admin Portal</a>
            {isLoggedIn ? (
              <button onClick={handleLogout} className="text-left font-semibold text-red-500 hover:text-red-700 py-1">Logout</button>
            ) : (
              <button onClick={() => { setMenuOpen(false); setShowLoginModal(true); }} className="text-left font-semibold text-[#0F766E] py-1">Client Login</button>
            )}
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-20 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-[#0F766E]/20 text-[#0F766E] px-4 py-2 rounded-full text-sm font-bold mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Live · Season 2026 — Fresh Arrivals Daily
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-[#134E4A] mb-6 leading-[1.1] tracking-tight">
            Premium Agriculture,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F766E] to-[#22c55e]">
              Direct to Market
            </span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connecting world-class farms with premium global buyers. Real-time AWB tracking, climate-controlled logistics, and Grade-A produce.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="#catalog" className="bg-[#A16207] hover:bg-yellow-800 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_8px_20px_rgba(161,98,7,0.3)] hover:shadow-[0_12px_25px_rgba(161,98,7,0.4)] hover:-translate-y-1 transform">
              Explore Catalog
            </a>
            <a href="#track" className="bg-white/80 backdrop-blur-md border border-[#0F766E]/20 text-[#0F766E] px-8 py-4 rounded-full font-bold text-lg hover:bg-white transition-all shadow-sm">
              Track Shipment
            </a>
          </div>
        </section>

        {/* Trust Stats Bar */}
        <section className="bg-[#134E4A] text-white py-10">
          <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "42+", label: "Global Clients" },
              { value: "8 Countries", label: "Export Destinations" },
              { value: "1200+", label: "Shipments / Year" },
              { value: "99.1%", label: "On-Time Delivery" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-black text-[#4ade80]">{stat.value}</p>
                <p className="text-sm text-teal-200/70 mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Catalog Section */}
        <section id="catalog" className="container mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-[#134E4A]">Product Catalog</h2>
              <p className="text-neutral-500 mt-1">Browse our export-ready flowers and leaves</p>
            </div>
            {isLoggedIn && (
              <div className="relative w-full md:w-72">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-full bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none shadow-sm"
                />
              </div>
            )}
          </div>

          {!isLoggedIn ? (
            <CatalogLocked onLoginClick={() => setShowLoginModal(true)} />
          ) : (
            <>
              {/* Category Filter Tabs */}
              <div className="flex gap-3 mb-8 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 rounded-full font-bold text-sm capitalize transition-all duration-200 border ${
                      activeCategory === cat
                        ? "bg-[#0F766E] text-white border-[#0F766E] shadow-md"
                        : "bg-white text-[#134E4A] border-gray-200 hover:border-[#0F766E]/40 hover:text-[#0F766E]"
                    }`}
                  >
                    {cat === "all" ? "🌾 All Products" : cat === "flower" ? "🌸 Flowers" : cat === "leaf" ? "🌿 Leaves" : "🥬 Vegetables"}
                  </button>
                ))}
              </div>

              {loading ? (
                <Spinner />
              ) : error ? (
                <div className="text-center py-16 rounded-2xl bg-red-50 border border-red-100">
                  <p className="text-2xl mb-2">⚠️</p>
                  <p className="text-red-700 font-bold">{error}</p>
                  <p className="text-red-500 text-sm mt-1">Start the backend: <code className="font-mono bg-red-100 px-1 rounded">python backend/app.py</code></p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-semibold">No products match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* AWB Tracker Section */}
        <section id="track" className="bg-gradient-to-br from-[#134E4A] to-[#0F766E] py-20">
          <div className="container mx-auto px-6 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-white mb-3">Track Your Shipment</h2>
            <p className="text-teal-200 mb-8">Enter your Air Waybill number to get real-time flight and delivery status.</p>
            <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={awbInput}
                onChange={(e) => setAwbInput(e.target.value)}
                placeholder="e.g. AWB-2026-901"
                className="flex-1 px-5 py-4 rounded-full bg-white/10 border border-white/30 text-white placeholder-teal-300 focus:ring-2 focus:ring-white/50 outline-none font-medium backdrop-blur-md"
              />
              <button type="submit" className="bg-[#A16207] hover:bg-yellow-800 text-white px-8 py-4 rounded-full font-bold transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap">
                Track Now →
              </button>
            </form>
            {awbResult && (
              <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-left text-white animate-fade-in">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                  <p className="font-bold text-green-300 text-sm uppercase tracking-wider">Live Status</p>
                </div>
                <p className="font-semibold">{awbResult}</p>
              </div>
            )}
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="container mx-auto px-6 py-20 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-[#134E4A] mb-3">Get In Touch</h2>
            <p className="text-neutral-500">Start a bulk order inquiry or ask us anything.</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.05)] border border-white/50 p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-bold text-[#134E4A] mb-2 block">Your Name</label>
                <input type="text" placeholder="e.g. James Wilson" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-bold text-[#134E4A] mb-2 block">Company / Organisation</label>
                <input type="text" placeholder="e.g. London Florist Ltd" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-bold text-[#134E4A] mb-2 block">Email Address</label>
                <input type="email" placeholder="you@company.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-bold text-[#134E4A] mb-2 block">Products Interested In</label>
                <select className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm bg-white">
                  <option>Flowers</option>
                  <option>Leaves</option>
                  <option>Vegetables</option>
                  <option>Multiple / Mixed</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-bold text-[#134E4A] mb-2 block">Message</label>
                <textarea rows={4} placeholder="Describe your requirements, volume, destination..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent outline-none text-sm resize-none" />
              </div>
              <div className="md:col-span-2">
                <button className="w-full bg-[#0F766E] hover:bg-teal-800 text-white py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 duration-200">
                  Send Enquiry
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#134E4A] text-teal-100 py-14">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">🌱</span>
              <h2 className="text-xl font-extrabold text-white">AgriB2B Global</h2>
            </div>
            <p className="text-teal-200/60 max-w-xs mb-5 text-sm leading-relaxed">
              Connecting world-class farms with premium buyers globally. Excellence in every shipment since 2018.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#catalog" className="text-teal-200/60 hover:text-white transition-colors">Product Catalog</a></li>
              <li><a href="#track" className="text-teal-200/60 hover:text-white transition-colors">AWB Tracking</a></li>
              <li><a href="/production" className="text-teal-200/60 hover:text-white transition-colors">Production Dashboard</a></li>
              <li><a href="/admin" className="text-teal-200/60 hover:text-white transition-colors">Admin Portal</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-teal-200/60 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-teal-200/60 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#contact" className="text-teal-200/60 hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-6 mt-12 pt-6 border-t border-white/10 text-center text-teal-200/40 text-xs">
          <p>© 2026 AgriB2B Global. All rights reserved. | Designed with 🌿 in India</p>
        </div>
      </footer>
    </div>
  );
}
