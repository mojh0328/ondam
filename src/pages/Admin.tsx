import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, ShieldCheck, Phone, UserCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DBUser = {
  id: string;
  username: string;
  store_name?: string;
  phone?: string;
  role?: string;
};

export default function Admin() {
  const { currentUser, showConfirm, showAlert } = useAuth();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Supabase에서 유저 목록 불러오기
  const fetchUsersFromSupabase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;

      if (data) {
        // 데이터가 없거나 admin 계정이 빠져있다면 기본 admin 포함
        const formatted = data.map((u: any) => ({
          id: String(u.id),
          username: u.username,
          store_name: u.store_name || "Ondam",
          phone: u.phone || "",
          role: u.username.toLowerCase() === "admin" ? "admin" : "user"
        }));

        // 만약 admin 계정이 DB에 없다면 리스트에 강제 포함
        if (!formatted.some(u => u.username.toLowerCase() === "admin")) {
          formatted.unshift({
            id: "default_admin",
            username: "admin",
            store_name: "Ondam",
            phone: "",
            role: "admin"
          });
        }

        setUsers(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch users from Supabase:", err);
      // 오류 발생 시 기본 관리자 계정 노출
      setUsers([{ id: "default_admin", username: "admin", store_name: "Ondam", phone: "", role: "admin" }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersFromSupabase();
  }, []);

  const handleDeleteUser = (username: string, id: string) => {
    if (username.toLowerCase() === "admin") {
      showAlert("You cannot delete the admin account.");
      return;
    }

    showConfirm(`Are you sure you want to delete user '${username}' from Supabase?`, async () => {
      try {
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw error;

        showAlert(`User '${username}' has been deleted successfully.`);
        fetchUsersFromSupabase(); // 목록 새로고침
      } catch (err) {
        console.error("Failed to delete user:", err);
        showAlert("Failed to delete user from database.");
      }
    });
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-500 font-bold">Admin access required.</p>
        <Link href="/"><Button>Go to Home</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/"><Button variant="outline" size="icon"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-blue-600" /> Admin User Management (Supabase)
            </h1>
            <p className="text-gray-500 text-sm">View and manage all registered staff and user accounts from database.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Users size={18} /> Registered Staff / Users ({users.length})
          </h2>
          <Button variant="outline" size="sm" onClick={fetchUsersFromSupabase}>Refresh</Button>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="py-6 text-center text-slate-400 text-sm">Loading users from Supabase...</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="py-4 flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700">
                    {u.username ? u.username[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      {u.username}
                      {u.role === "admin" && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">ADMIN</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {u.phone || "No phone"} • Store: {u.store_name}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <UserCheck size={14} /> Active
                  </span>
                  {u.username.toLowerCase() !== "admin" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteUser(u.username, u.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}

          {!loading && users.length === 0 && (
            <div className="py-6 text-center text-slate-400 text-sm">
              No registered users found in Supabase.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}