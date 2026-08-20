import { Link, useLocation } from "wouter";
import { Store, ChefHat, LayoutDashboard, LogIn, LogOut, User, Menu, X, Download, Upload, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const res = await apiFetch("/api/backup", { credentials: "include" });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rcc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent – failure is obvious from no download
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;

    if (!window.confirm("Restoring will replace ALL your current stores, ingredients, and recipes with the backup file. This cannot be undone. Proceed?")) return;

    setRestoreLoading(true);
    setRestoreMsg(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await apiFetch("/api/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Restore failed");
      }
      await queryClient.invalidateQueries();
      setRestoreMsg({ ok: true, text: "Restore complete — data updated." });
    } catch (err) {
      setRestoreMsg({ ok: false, text: err instanceof Error ? err.message : "Restore failed" });
    } finally {
      setRestoreLoading(false);
    }
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const isAdmin = user?.username === "namoo group";

  const navItems = [
    { href: "/stores", label: "Stores", icon: Store },
    { href: "/ingredients", label: "Master Ingredients", icon: ChefHat },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  const SidebarContent = () => (
    <>
      <div className="h-16 md:h-20 flex items-center px-6 border-b border-zinc-100 shrink-0">
        <div className="font-display font-bold text-xl tracking-tight flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          Restaurant Cost Calculator
        </div>
      </div>
      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href) || (location === "/" && item.href === "/stores");
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            )}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 pb-6 border-t border-zinc-100 pt-4 shrink-0 space-y-3">
        {isAuthenticated && user && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Backup & Restore</p>
            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200 disabled:opacity-50"
            >
              {backupLoading ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
              Export backup
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={restoreLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200 disabled:opacity-50"
            >
              {restoreLoading ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Upload className="w-3.5 h-3.5 shrink-0" />}
              Restore backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleRestoreFile}
            />
            {restoreMsg && (
              <p className={cn("px-3 text-[11px] leading-snug", restoreMsg.ok ? "text-emerald-600" : "text-red-500")}>
                {restoreMsg.text}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-zinc-100 pt-3">
          {isLoading ? (
            <div className="h-10 rounded-xl bg-zinc-50 animate-pulse" />
          ) : isAuthenticated && user ? (
            <div className="space-y-2">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <User className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-zinc-700 truncate leading-tight flex-1">
                  {user.fullName || user.username}
                </span>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-600 shrink-0">Edit</span>
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              Sign in
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-background font-sans text-zinc-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 bg-white flex-col shadow-sm z-10 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out md:hidden",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b border-zinc-200 bg-white flex items-center px-4 shrink-0 justify-between z-10">
          <div className="font-display font-bold text-lg flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center">
              <LayoutDashboard className="w-3 h-3" />
            </div>
            Restaurant Cost Calculator
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -mr-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
