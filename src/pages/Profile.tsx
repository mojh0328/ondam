import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Lock, Save, Trash2 } from "lucide-react";

export default function Profile() {
  const { currentUser, updateAccount, logout, deleteAccount, showConfirm } = useAuth();
  
  const [username, setUsername] = useState(currentUser?.username || "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(currentUser?.phone || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount(username, password, phone);
    setPassword("");
  };

  const handleDeleteAccount = () => {
    showConfirm("Are you sure? All your data will be permanently deleted.", () => {
      deleteAccount();
    });
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
      </div>

      <Card className="p-6 space-y-6 bg-white shadow-sm rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Username</label>
            <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-3" required />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Phone</label>
            <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-3" required />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">New Password (Keep blank to skip)</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-3" />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2">
              <Save size={16} /> Save Changes
            </Button>
          </div>
        </form>

        <div className="pt-6 border-t flex justify-between items-center">
          <Button variant="ghost" onClick={handleDeleteAccount} className="text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 size={16} /> Delete Account
          </Button>
          <Button variant="destructive" onClick={logout}>Sign Out</Button>
        </div>
      </Card>
    </div>
  );
}