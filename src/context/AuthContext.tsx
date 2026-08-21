import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type User = {
  id?: string;
  username: string;
  storeName?: string;
};

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, storeName?: string) => Promise<boolean>;
  logout: () => void;
  signup: (username: string, storeName?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("current_auth_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("current_auth_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("current_auth_user");
    }
  }, [currentUser]);

  // 회원가입: Supabase users 테이블에 저장
  const signup = async (username: string, storeName = "My Restaurant") => {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        alert("Username already exists. Please choose another or log in.");
        return false;
      }

      const { data, error } = await supabase
        .from("users")
        .insert([{ username, store_name: storeName }])
        .select()
        .single();

      if (error) throw error;

      const newUser: User = {
        id: data.id,
        username: data.username,
        storeName: data.store_name
      };

      setCurrentUser(newUser);
      return true;
    } catch (err) {
      console.error("Signup failed:", err);
      alert("Signup failed. Please check your connection.");
      return false;
    }
  };

  // 로그인: Supabase users 테이블에서 사용자 확인
  const login = async (username: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert("User not found. Please sign up first.");
        return false;
      }

      const loggedUser: User = {
        id: data.id,
        username: data.username,
        storeName: data.store_name
      };

      setCurrentUser(loggedUser);
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      alert("Login failed. Please check your connection.");
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("current_auth_user");
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, signup }}>
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