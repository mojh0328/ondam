import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-fetch";
import { ShieldAlert, Users, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (user?.username !== "namoo group") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-xl font-display font-bold text-zinc-900">Access Denied</h1>
        <p className="text-zinc-500 text-sm max-w-xs">
          This page is restricted to the administrator account.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-700" />
            Registered Users
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            All accounts signed up in the service.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats badge */}
      {!isLoading && !error && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
          <Users className="w-3.5 h-3.5" />
          {users.length} user{users.length !== 1 ? "s" : ""} total
        </div>
      )}

      {/* Table card */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-zinc-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-zinc-100 rounded animate-pulse w-32" />
                  <div className="h-2.5 bg-zinc-50 rounded animate-pulse w-24" />
                </div>
                <div className="h-2.5 bg-zinc-100 rounded animate-pulse w-28" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 px-4">
            <ShieldAlert className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-red-500 text-sm font-medium">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Users className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No users found.</p>
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_1fr] gap-4 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <span>#</span>
              <span>Username</span>
              <span>Display name</span>
              <span>Signed up</span>
            </div>

            <div className="divide-y divide-zinc-100">
              {users.map((u, idx) => (
                <div
                  key={u.id}
                  className={`px-4 py-3 flex flex-col sm:grid sm:grid-cols-[2rem_1fr_1fr_1fr] sm:items-center gap-1 sm:gap-4 ${u.username === "namoo group" ? "bg-amber-50/60" : ""}`}
                >
                  {/* Row number */}
                  <span className="hidden sm:block text-xs text-zinc-400 font-mono">
                    {idx + 1}
                  </span>

                  {/* Username + mobile number */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0 sm:hidden">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="hidden sm:flex w-7 h-7 rounded-full bg-zinc-900 text-white items-center justify-center text-xs font-bold shrink-0">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-zinc-900 truncate">
                          {u.username}
                        </span>
                        {u.username === "namoo group" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                            Admin
                          </span>
                        )}
                      </div>
                      {/* Mobile: show date below username */}
                      <p className="text-[11px] text-zinc-400 sm:hidden mt-0.5">
                        {formatDate(u.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Display name */}
                  <span className="hidden sm:block text-sm text-zinc-500 truncate">
                    {u.fullName || <span className="text-zinc-300 italic">—</span>}
                  </span>

                  {/* Sign-up date (desktop only) */}
                  <span className="hidden sm:block text-sm text-zinc-400 tabular-nums">
                    {formatDate(u.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
