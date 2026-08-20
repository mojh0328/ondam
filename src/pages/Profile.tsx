import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { AuthUser } from "@workspace/api-client-react";

// ── helpers ──────────────────────────────────────────────────────────────────

async function parseApiError(res: Response): Promise<string> {
  try {
    const d = await res.json();
    if (typeof d?.error === "string") return d.error;
  } catch { /* ignore */ }
  return `Request failed (${res.status})`;
}

interface StatusMsg { ok: boolean; text: string }

function StatusBanner({ msg }: { msg: StatusMsg }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm ${
      msg.ok
        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : "bg-red-50 border border-red-200 text-red-600"
    }`}>
      {msg.ok
        ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
        : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="leading-snug">{msg.text}</span>
    </div>
  );
}

function PasswordInput({
  id, value, onChange, placeholder, autoComplete,
}: {
  id: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, updateUser } = useAuth();

  // Username form state
  const [newUsername, setNewUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<StatusMsg | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<StatusMsg | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Submit: change username ───────────────────────────────────────────────
  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameStatus(null);
    if (!newUsername.trim()) return;

    setUsernameLoading(true);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername }),
      });
      if (!res.ok) {
        setUsernameStatus({ ok: false, text: await parseApiError(res) });
        return;
      }
      const data = (await res.json()) as { user: AuthUser };
      updateUser(data.user);
      setNewUsername("");
      setUsernameStatus({ ok: true, text: `Username updated to "${data.user.username}".` });
    } catch {
      setUsernameStatus({ ok: false, text: "Network error — please try again." });
    } finally {
      setUsernameLoading(false);
    }
  }

  // ── Submit: change password ───────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({ ok: false, text: "Enter your current password." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ ok: false, text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ ok: false, text: "New passwords do not match." });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setPasswordStatus({ ok: false, text: await parseApiError(res) });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({ ok: true, text: "Password changed successfully." });
    } catch {
      setPasswordStatus({ ok: false, text: "Network error — please try again." });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900">Account Settings</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Update your login credentials.</p>
      </div>

      {/* ── Change Username ── */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900">Change Username</h2>
              <p className="text-xs text-zinc-500">
                Current: <span className="font-medium text-zinc-700">{user?.username}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleUsernameSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="new-username" className="text-xs font-medium text-zinc-600">
                New username
              </label>
              <input
                id="new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username (min 3 chars)"
                autoComplete="username"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {usernameStatus && <StatusBanner msg={usernameStatus} />}

            <Button
              type="submit"
              disabled={usernameLoading || !newUsername.trim()}
              className="w-full sm:w-auto"
            >
              {usernameLoading ? "Saving…" : "Update username"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Change Password ── */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900">Change Password</h2>
              <p className="text-xs text-zinc-500">You must enter your current password to set a new one.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-xs font-medium text-zinc-600">
                Current password
              </label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Your current password"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-medium text-zinc-600">
                New password <span className="text-zinc-400 font-normal">(min 6 characters)</span>
              </label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-zinc-600">
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
            </div>

            {passwordStatus && <StatusBanner msg={passwordStatus} />}

            <Button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              {passwordLoading ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
