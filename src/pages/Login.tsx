import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, User, Phone, UserPlus, LogIn } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    if (isRegisterMode) {
      if (!phone.trim()) {
        alert("Please enter your phone number.");
        return;
      }
      if (register(username, password, phone)) {
        alert("Account created successfully!");
        setLocation("/");
      }
    } else {
      if (login(username, password)) {
        setLocation("/");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-xl bg-white rounded-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isRegisterMode ? "Create New Account" : "Recipe Costing Sign In"}
          </h1>
          <p className="text-xs text-slate-500">
            {isRegisterMode ? "Enter your details to sign up." : "Enter your username and password to log in."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Username</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="pl-9"
                required
              />
            </div>
          </div>

          {isRegisterMode && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
                <Input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0400-000-000"
                  className="pl-9"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pl-9"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg flex items-center justify-center gap-2">
            {isRegisterMode ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isRegisterMode ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        <div className="pt-4 border-t text-center">
          <button
            type="button"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            {isRegisterMode ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </Card>
    </div>
  );
}