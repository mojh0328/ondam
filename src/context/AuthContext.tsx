import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type User = {
  id?: string;
  username: string;
  password?: string;
  storeName?: string;
  role?: string;
  phone?: string;
};

interface AuthContextType {
  currentUser: User | null;
  registeredUsers: User[];
  login: (username: string, password?: string) => boolean;
  register: (username: string, password?: string, phone?: string) => Promise<boolean>;
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

  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem("registered_users_list");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((u: User) => ({
          ...u,
          password: u.password || "admin123"
        }));
      }
    } catch {}
    return [
      { id: "user_admin", username: "admin", password: "admin123", storeName: "Ondam", role: "admin", phone: "0400000000" }
    ];
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("current_auth_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("current_auth_user");
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("registered_users_list", JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  const showConfirm = (message: string, onConfirm: () => void) => {
    if (window.confirm(message)) {
      onConfirm();
    }
  };

  const register = async (username: string, password?: string, phone?: string): Promise<boolean> => {
    if (!username || !username.trim()) return false;
    const cleanUsername = username.trim();
    
    const exists = registeredUsers.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (exists) {
      alert("Username already exists!");
      return false;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      username: cleanUsername,
      password: password || "",
      storeName: "Ondam",
      role: cleanUsername.toLowerCase() === "admin" ? "admin" : "user",
      phone: phone || ""
    };

    const updatedUsers = [...registeredUsers, newUser];
    setRegisteredUsers(updatedUsers);
    setCurrentUser(newUser);

    try {
      const { error } = await supabase
        .from("users")
        .insert([{ username: cleanUsername, store_name: "Ondam", phone: phone || "" }]);
      
      if (error) {
        console.error("Supabase insert error:", error);
      }
    } catch (err) {
      console.warn("Supabase register warning:", err);
    }

    return true;
  };

  const login = (username: string, password?: string) => {
    if (!username || !username.trim()) {
      alert("Please enter a username.");
      return false;
    }
    const cleanUsername = username.trim();

    const foundUser = registeredUsers.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    
    if (!foundUser) {
      alert("User not found. Please check your username or register first.");
      return false;
    }

    if (foundUser.password && foundUser.password !== password) {
      alert("Incorrect password. Please try again.");
      return false;
    }

    setCurrentUser(foundUser);
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
    <AuthContext.Provider value={{ currentUser, registeredUsers, login, register, logout, signup, showConfirm }}>
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