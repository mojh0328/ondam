import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type User = {
  username: string;
  phone: string;
  role: "admin" | "user";
  createdAt: string;
};

type AuthContextType = {
  currentUser: User | null;
  register: (username: string, pass: string, phone: string) => boolean;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  getAllUsers: () => User[];
  updateAccount: (newUsername: string, newPass: string, newPhone: string) => boolean;
  deleteAccount: () => void;
  showAlert: (msg: string) => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("app_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [alertInfo, setAlertInfo] = useState({ message: "", isOpen: false });
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; isOpen: boolean; onConfirm: (() => void) | null }>({
    message: "",
    isOpen: false,
    onConfirm: null
  });

  const showAlert = (msg: string) => {
    setAlertInfo({ message: msg, isOpen: true });
  };

  const closeAlert = () => {
    setAlertInfo({ message: "", isOpen: false });
  };

  const showConfirm = (msg: string, onConfirm: () => void) => {
    setConfirmInfo({ message: msg, isOpen: true, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmInfo({ message: "", isOpen: false, onConfirm: null });
  };

  useEffect(() => {
    const users = JSON.parse(localStorage.getItem("app_users") || "[]");
    if (!users.some((u: any) => u.username === "admin")) {
      users.push({
        username: "admin",
        pass: "admin123",
        phone: "0400000000",
        role: "admin",
        createdAt: new Date().toISOString()
      });
      localStorage.setItem("app_users", JSON.stringify(users));
    }
  }, []);

  const register = (username: string, pass: string, phone: string) => {
    const users = JSON.parse(localStorage.getItem("app_users") || "[]");
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
      showAlert("This username is already taken.");
      return false;
    }

    const newUser = {
      username,
      pass,
      phone,
      role: username === "admin" ? "admin" : "user",
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem("app_users", JSON.stringify(users));
    
    const userObj = { username: newUser.username, phone: newUser.phone, role: newUser.role, createdAt: newUser.createdAt };
    setCurrentUser(userObj as User);
    localStorage.setItem("app_current_user", JSON.stringify(userObj));
    showAlert("Account created successfully!");
    return true;
  };

  const login = (username: string, pass: string) => {
    const users = JSON.parse(localStorage.getItem("app_users") || "[]");
    const found = users.find((u: any) => u.username === username && u.pass === pass);
    
    if (found) {
      const userObj = { username: found.username, phone: found.phone || "", role: found.role, createdAt: found.createdAt };
      setCurrentUser(userObj as User);
      localStorage.setItem("app_current_user", JSON.stringify(userObj));
      return true;
    } else {
      showAlert("Invalid username or password.");
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("app_current_user");
  };

  const getAllUsers = () => {
    const users = JSON.parse(localStorage.getItem("app_users") || "[]");
    return users.map((u: any) => ({ username: u.username, phone: u.phone || "-", role: u.role, createdAt: u.createdAt }));
  };

  const updateAccount = (newUsername: string, newPass: string, newPhone: string) => {
    if (!currentUser) return false;
    let users = JSON.parse(localStorage.getItem("app_users") || "[]");

    if (newUsername !== currentUser.username && users.some((u: any) => u.username.toLowerCase() === newUsername.toLowerCase())) {
      showAlert("This username is already taken.");
      return false;
    }

    users = users.map((u: any) => {
      if (u.username === currentUser.username) {
        return {
          ...u,
          username: newUsername,
          phone: newPhone,
          pass: newPass ? newPass : u.pass
        };
      }
      return u;
    });

    localStorage.setItem("app_users", JSON.stringify(users));

    const updatedUser: User = {
      ...currentUser,
      username: newUsername,
      phone: newPhone
    };

    setCurrentUser(updatedUser);
    localStorage.setItem("app_current_user", JSON.stringify(updatedUser));
    showAlert("Account updated successfully!");
    return true;
  };

  const deleteAccount = () => {
    if (!currentUser) return;
    
    const userPrefix = `_user_${currentUser.username}`;
    Object.keys(localStorage).forEach((key) => {
      if (key.includes(userPrefix) || key === "app_current_user") {
        localStorage.removeItem(key);
      }
    });

    const users = JSON.parse(localStorage.getItem("app_users") || "[]");
    const filteredUsers = users.filter((u: any) => u.username !== currentUser.username);
    localStorage.setItem("app_users", JSON.stringify(filteredUsers));

    logout();
    showAlert("Your account has been deleted successfully.");
  };

  return (
    <AuthContext.Provider value={{ currentUser, register, login, logout, getAllUsers, updateAccount, deleteAccount, showAlert, showConfirm }}>
      {children}
      
      {alertInfo.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
            <div className="text-6xl mb-2">✨</div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-800">Hello!</h3>
              <p className="text-sm text-slate-500 font-medium">{alertInfo.message}</p>
            </div>
            <button
              onClick={closeAlert}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl transition-all active:scale-95"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {confirmInfo.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
            <div className="text-6xl mb-2">🤔</div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-800">Wait a second!</h3>
              <p className="text-sm text-slate-500 font-medium">{confirmInfo.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={closeConfirm}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition-all active:scale-95"
              >
                No
              </button>
              <button
                onClick={() => {
                  if (confirmInfo.onConfirm) confirmInfo.onConfirm();
                  closeConfirm();
                }}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 shadow-lg shadow-rose-200"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};