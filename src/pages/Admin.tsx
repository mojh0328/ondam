import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, ShieldCheck, Phone, UserCheck, Trash2 } from "lucide-react";

export default function Admin() {
  const { currentUser, getAllUsers, showConfirm, showAlert } = useAuth();
  const users = getAllUsers ? getAllUsers() : [];

  // 어드민 계정 삭제 로직 (어드민이 타 유저 삭제)
  const handleDeleteUser = (username: string) => {
    if (username === "admin") {
      showAlert("You cannot delete the admin account.");
      return;
    }
    showConfirm(`Are you sure you want to delete user '${username}'? All their data will be permanently removed.`, () => {
      // 1. 해당 사용자의 모든 데이터 삭제
      const userPrefix = `_user_${username}`;
      Object.keys(localStorage).forEach((key) => {
        if (key.includes(userPrefix)) {
          localStorage.removeItem(key);
        }
      });

      // 2. 사용자 목록에서 삭제
      const users = JSON.parse(localStorage.getItem("app_users") || "[]");
      const filteredUsers = users.filter((u: any) => u.username !== username);
      localStorage.setItem("app_users", JSON.stringify(filteredUsers));
      
      showAlert(`User '${username}' has been deleted.`);
      // 화면 갱신을 위해 새로고침
      window.location.reload();
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
              <ShieldCheck className="text-blue-600" /> Admin User Management
            </h1>
            <p className="text-gray-500 text-sm">View and manage all registered staff and user accounts.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Users size={18} /> Registered Staff / Users ({users.length})
          </h2>
        </div>

        <div className="divide-y">
          {users.map((u, i) => (
            <div key={i} className="py-4 flex justify-between items-center text-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700">
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-2">
                    {u.username}
                    {u.role === "admin" && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">ADMIN</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone size={12} /> {u.phone || "No phone"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <UserCheck size={14} /> Active
                </span>
                {u.username !== "admin" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteUser(u.username)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="py-6 text-center text-slate-400 text-sm">
              No registered users found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}