import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Store as StoreIcon, Trash2, Edit, Calculator, LogOut, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  name: string;
  description: string;
};

export default function Stores() {
  const { currentUser, logout, showConfirm } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Supabase에서 지점 목록 불러오기
  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*');

      if (error) throw error;
      if (data) {
        setStores(data.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || ""
        })));
      }
    } catch (err) {
      console.error("Failed to fetch stores from Supabase:", err);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleOpenModal = (store?: Store) => {
    if (store) {
      setEditingStore(store);
      setName(store.name);
      setDescription(store.description);
    } else {
      setEditingStore(null);
      setName("");
      setDescription("");
    }
    setIsModalOpen(true);
  };

  // Supabase에 지점 추가 또는 수정 (디버깅 팝업 포함)
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingStore) {
        const { error } = await supabase
          .from('stores')
          .update({ name, description })
          .eq('id', editingStore.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stores')
          .insert({ name, description });

        if (error) throw error;
      }

      await fetchStores();
      setIsModalOpen(false);
      alert("Store saved successfully to Supabase!");
    } catch (err: any) {
      console.error("Failed to save store to Supabase:", err);
      alert(`Store save failed: ${err.message || JSON.stringify(err)}`);
    }
  };

  // Supabase에서 지점 삭제
  const handleDeleteStore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm("Delete this store? All menu items inside will be removed.", async () => {
      try {
        const { error } = await supabase
          .from('stores')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setStores(stores.filter(s => s.id !== id));
      } catch (err: any) {
        console.error("Failed to delete store:", err);
        alert(`Failed to delete store: ${err.message || err}`);
      }
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* 상단 헤더 및 사용자 계정 메뉴 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Restaurant Costing System (Cloud Sync)</h1>
          <p className="text-gray-500 text-sm mt-1">Manage master ingredients, stores, and recipe food costs.</p>
        </div>

        {/* 사용자 정보 및 로그아웃/프로필 버튼 */}
        <div className="flex items-center gap-3 bg-white p-2 border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
              {currentUser?.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{currentUser?.username}</p>
              <p className="text-[10px] text-slate-400 uppercase">{currentUser?.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 border-l pl-3">
            {currentUser?.role === "admin" && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                  <ShieldCheck size={14} /> Admin
                </Button>
              </Link>
            )}
            <Link href="/profile">
              <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                <User size={14} /> Settings
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={logout} className="text-xs flex items-center gap-1">
              <LogOut size={14} /> Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Stores</h2>
          <p className="text-xs text-gray-500">Select a store to manage recipes and menu folders.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ingredients">
            <Button variant="outline" className="flex items-center gap-2">
              📦 Master Ingredients
            </Button>
          </Link>
          <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white">
            <Plus size={16} /> Add Store
          </Button>
        </div>
      </div>

      {/* 매장 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stores.map((store) => (
          <Card key={store.id} className="p-6 hover:shadow-md transition-all flex flex-col justify-between space-y-6 bg-white border rounded-xl">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="p-2 bg-slate-100 rounded-lg text-slate-800">
                  <StoreIcon size={22} />
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenModal(store)}>
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => handleDeleteStore(store.id, e)}>
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{store.name}</h3>
              <p className="text-sm text-gray-500">{store.description || "No description provided."}</p>
            </div>

            <Link href={`/stores/${store.id}/menu`}>
              <Button className="w-full flex justify-between items-center bg-slate-900 hover:bg-slate-800 text-white">
                <span className="flex items-center gap-2">
                  <Calculator size={16} /> Manage Recipes & Menu
                </span>
                <span>→</span>
              </Button>
            </Link>
          </Card>
        ))}
      </div>

      {/* 매장 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">{editingStore ? "Edit Store" : "Add New Store"}</h2>
            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Store Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ondam Doncaster"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Main branch location"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white">Save Store</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}