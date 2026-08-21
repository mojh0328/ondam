import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { Plus, ArrowLeft, Edit, Trash2, Calculator, Folder, Download, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type MenuItem = { 
  id: string; 
  name: string; 
  price: number; 
  folderId: string;
};

type MenuFolder = {
  id: string;
  name: string;
};

export default function StoreMenu() {
  const [, params] = useRoute("/stores/:id/menu");
  const storeId = params?.id || "13";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const [folders, setFolders] = useState<MenuFolder[]>([
    { id: "fld_4", name: "Stove" },
    { id: "fld_5", name: "Wok" },
    { id: "fld_6", name: "Base Sauce" },
    { id: "fld_7", name: "Extra" },
    { id: "fld_8", name: "Cold" },
    { id: "fld_9", name: "Deep Fried" }
  ]);

  const [activeFolderId, setActiveFolderId] = useState<string>("fld_4");
  const [searchTerm, setSearchTerm] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("fld_4");

  const storageKey = `store_menu_${storeId}_${currentUser?.username || 'default'}`;

  const fetchRecipes = async () => {
    try {
      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        setMenuItems(JSON.parse(savedLocal));
        return;
      }

      let query = supabase.from('recipes').select('*');
      if (currentUser?.username) {
        query = query.or(`store_id.eq.${storeId},user_id.eq.${currentUser.username}`);
      }
      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const formattedItems: MenuItem[] = data.map((item: any) => ({
          id: item.id,
          name: item.title,
          price: Number(item.selling_price || 0),
          folderId: item.folder_id || "fld_4"
        }));
        setMenuItems(formattedItems);
        localStorage.setItem(storageKey, JSON.stringify(formattedItems));
      }
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [storeId, currentUser]);

  const handleExportRecipes = () => {
    try {
      const exportData: any = { storeId, folders, menuItems };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `recipes-backup-${currentUser?.username || 'ondam'}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Recipes exported successfully!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportRecipes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json.folders) && json.folders.length > 0) {
          setFolders(json.folders);
          setActiveFolderId(json.folders[0].id);
        }

        // 파일 내 store_menu 데이터 우선 파싱
        const itemsToImport = json.store_menu_13 || json.menuItems || [];
        if (Array.isArray(itemsToImport) && itemsToImport.length > 0) {
          const formattedImportedItems: MenuItem[] = itemsToImport.map((item: any) => ({
            id: String(item.id || Date.now() + Math.random()),
            name: item.name || item.title || "",
            price: Number(item.price || item.selling_price || 0),
            folderId: item.folderId || "fld_4"
          }));
          
          setMenuItems(formattedImportedItems);
          localStorage.setItem(storageKey, JSON.stringify(formattedImportedItems));

          if (currentUser?.username) {
            const rowsToInsert = formattedImportedItems.map(item => ({
              user_id: currentUser.username,
              store_id: storeId,
              title: item.name,
              selling_price: item.price,
              folder_id: item.folderId
            }));
            await supabase.from('recipes').delete().eq('user_id', currentUser.username);
            await supabase.from('recipes').insert(rowsToInsert);
          }

          alert("Recipes imported and synced successfully!");
        } else {
          alert("No menu items found in this file.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to import backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

    const newItem: MenuItem = {
      id: editingItem ? editingItem.id : String(Date.now()),
      name,
      price: Number(price),
      folderId: selectedFolderId
    };

    const updated = editingItem ? menuItems.map(i => i.id === editingItem.id ? newItem : i) : [...menuItems, newItem];
    setMenuItems(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setName("");
    setPrice("");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this menu item?")) {
      const updated = menuItems.filter(item => item.id !== id);
      setMenuItems(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesFolder = item.folderId === activeFolderId;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/"><Button variant="outline" size="icon"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Recipe & Menu Folders</h1>
            <p className="text-gray-500 text-sm">Organize recipes with cloud sync & backup.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportRecipes} className="hidden" />
          <Button variant="outline" onClick={handleExportRecipes} className="bg-green-50 text-green-700 border-green-200"><Download size={16} /> Export</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-blue-50 text-blue-700 border-blue-200"><Upload size={16} /> Import</Button>
          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-slate-900 text-white"><Plus size={16} /> Add Recipe</Button>
        </div>
      </div>

      <div className="space-y-2 border-b pb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {folders.map((fld) => (
            <div
              key={fld.id}
              onClick={() => setActiveFolderId(fld.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer border transition-all ${
                activeFolderId === fld.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <Folder size={16} />
              <span>{fld.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200">
        <Search size={18} className="text-slate-400" />
        <input type="text" placeholder="Search recipe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full outline-none text-sm bg-transparent" />
      </div>

      <div className="space-y-3">
        {filteredMenuItems.map((item) => (
          <div key={item.id} className="bg-white border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-base font-black text-slate-900">{item.name}</h3>
              <p className="text-xs text-slate-500">Selling: <span className="font-bold text-slate-900">${(item.price || 0).toFixed(2)} AUD</span></p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/menu-items/${item.id}`}><Button className="bg-slate-900 text-white w-10 h-10 p-0 rounded-xl"><Calculator size={18} /></Button></Link>
              <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setName(item.name); setPrice(item.price); setSelectedFolderId(item.folderId); setIsModalOpen(true); }}><Edit size={16} /></Button>
              <Button variant="ghost" size="icon" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={16} className="text-red-500" /></Button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">{editingItem ? "Edit Recipe" : "Add Recipe"}</h2>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Recipe Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Folder</label>
                <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} className="w-full border rounded-xl p-2.5 text-sm bg-white h-11">
                  {folders.map(fld => <option key={fld.id} value={fld.id}>{fld.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Selling Price ($ AUD)</label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} required className="rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white rounded-xl">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}