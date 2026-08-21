import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type User = {
  id?: string;
  username: string;
  storeName?: string;
  role?: string;
  phone?: string;
};

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password?: string) => boolean;
  register: (username: string, password?: string, phone?: string) => boolean;
  logout: () => void;
  signup: (username: string, storeName?: string) => Promise<boolean>;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("current_auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("current_auth_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("current_auth_user");
    }
  }, [currentUser]);

  const showConfirm = (message: string, onConfirm: () => void) => {
    if (window.confirm(message)) {
      onConfirm();
    }
  };

  const register = (username: string, password?: string, phone?: string) => {
    if (!username || !username.trim()) return false;
    const cleanUsername = username.trim();
    const newUser: User = {
      id: `user_${Date.now()}`,
      username: cleanUsername,
      storeName: "Ondam",
      role: cleanUsername.toLowerCase() === "admin" ? "admin" : "user",
      phone: phone || ""
    };

    try {
      supabase
        .from("users")
        .insert([{ username: cleanUsername, store_name: "Ondam" }])
        .select()
        .maybeSingle();
    } catch (err) {
      console.warn("Supabase register warning:", err);
    }

    setCurrentUser(newUser);
    return true;
  };

  const login = (username: string, password?: string) => {
    if (!username || !username.trim()) return false;
    const cleanUsername = username.trim();
    const loggedUser: User = {
      id: `user_${Date.now()}`,
      username: cleanUsername,
      storeName: "Ondam",
      role: cleanUsername.toLowerCase() === "admin" ? "admin" : "user"
    };

    try {
      supabase
        .from("users")
        .select("*")
        .eq("username", cleanUsername)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            loggedUser.id = data.id;
            loggedUser.storeName = data.store_name || "Ondam";
          }
        });
    } catch (err) {
      console.warn("Supabase login warning:", err);
    }

    setCurrentUser(loggedUser);
    return true;
  };

  const signup = async (username: string, storeName = "Ondam") => {
    return register(username, "", "");
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("current_auth_user");
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, signup, showConfirm }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}