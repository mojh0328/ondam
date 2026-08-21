import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Plus, ArrowLeft, Search, Edit, Trash2, Package, Folder, Download, Upload, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type MasterIngredient = {
  id: string;
  name: string;
  purchaseAmount: number;
  unit: string;
  totalPrice: number;
  yieldPercent: number;
  costPerGram: number;
  supplierId: string;
};

export type Supplier = {
  id: string;
  name: string;
};

export default function Ingredients() {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeSupplierId, setActiveSupplierId] = useState<string>("all");
  
  const [ingredients, setIngredients] = useState<MasterIngredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<MasterIngredient | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const [name, setName] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState<number | "">("");
  const [unit, setUnit] = useState("g");
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [yieldPercent, setYieldPercent] = useState<number | "">(100);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  const currentUsername = currentUser?.username || 'default';
  const storageKey = `master_ingredients_${currentUsername}`;
  const supplierKey = `ingredient_suppliers_${currentUsername}`;

  const fetchIngredients = async () => {
    try {
      const savedLocal = localStorage.getItem(storageKey);
      const savedSuppliers = localStorage.getItem(supplierKey);

      if (savedSuppliers) {
        const parsedSuppliers = JSON.parse(savedSuppliers);
        setSuppliers(parsedSuppliers);
      } else {
        setSuppliers([]);
        setActiveSupplierId("all");
      }

      if (savedLocal) {
        setIngredients(JSON.parse(savedLocal));
      }

      let query = supabase.from('ingredients').select('*');
      if (currentUser?.username) {
        query = query.eq('user_id', currentUser.username);
      } else {
        query = query.eq('user_id', 'default');
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const formatted: MasterIngredient[] = data.map((item: any) => {
          const amt = Number(item.purchase_amount || 1000);
          const price = Number(item.total_price || 0);
          const yP = Number(item.yield_percent ?? 100);
          const u = item.unit || "g";
          
          let rawGrams = amt;
          if (u === "kg" || u === "L") rawGrams = amt * 1000;
          const validGrams = rawGrams * (yP / 100);
          const costG = validGrams > 0 ? price / validGrams : price / rawGrams;

          return {
            id: String(item.id),
            name: item.name,
            purchaseAmount: amt,
            unit: u,
            totalPrice: price,
            yieldPercent: yP,
            costPerGram: costG,
            supplierId: item.supplier_id || ""
          };
        });
        setIngredients(formatted);
        localStorage.setItem(storageKey, JSON.stringify(formatted));
      } else if (!savedLocal) {
        setIngredients([]);
      }
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, [currentUser?.username]);

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const newSup: Supplier = {
      id: `sup_${Date.now()}`,
      name: newSupplierName.trim()
    };

    const updatedSuppliers = [...suppliers, newSup];
    setSuppliers(updatedSuppliers);
    localStorage.setItem(supplierKey, JSON.stringify(updatedSuppliers));

    setNewSupplierName("");
    setIsSupplierModalOpen(false);
    
    if (activeSupplierId === "all" && updatedSuppliers.length === 1) {
      setActiveSupplierId(newSup.id);
    }
  };

  const handleDeleteSupplier = (supId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this vendor folder?")) {
      const updatedSuppliers = suppliers.filter(s => s.id !== supId);
      setSuppliers(updatedSuppliers);
      localStorage.setItem(supplierKey, JSON.stringify(updatedSuppliers));

      if (activeSupplierId === supId) {
        setActiveSupplierId("all");
      }
    }
  };

  const handleExportIngredients = () => {
    try {
      const exportData = { 
        ingredient_suppliers: suppliers,
        master_ingredients: ingredients 
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ingredients-backup-${currentUsername}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert("Ingredients exported successfully!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportIngredients = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (Array.isArray(json.ingredient_suppliers)) {
          setSuppliers(json.ingredient_suppliers);
          localStorage.setItem(supplierKey, JSON.stringify(json.ingredient_suppliers));
        }

        const rawItems = json.master_ingredients || [];
        if (Array.isArray(rawItems)) {
          const formattedImported: MasterIngredient[] = rawItems.map((item: any) => {
            const amt = Number(item.purchaseAmount || item.purchase_amount || 1000);
            const price = Number(item.totalPrice || item.total_price || 0);
            const yP = Number(item.yieldPercent ?? item.yield_percent ?? 100);
            const u = item.unit || "g";

            let rawGrams = amt;
            if (u === "kg" || u === "L") rawGrams = amt * 1000;
            const validGrams = rawGrams * (yP / 100);
            const costG = validGrams > 0 ? price / validGrams : price / rawGrams;

            return {
              id: String(item.id || Date.now() + Math.random()),
              name: item.name || "",
              purchaseAmount: amt,
              unit: u,
              totalPrice: price,
              yieldPercent: yP,
              costPerGram: costG,
              supplierId: item.supplierId || item.supplier_id || ""
            };
          });

          setIngredients(formattedImported);
          localStorage.setItem(storageKey, JSON.stringify(formattedImported));

          if (currentUser?.username) {
            await supabase.from('ingredients').delete().eq('user_id', currentUser.username);
            const rowsToInsert = formattedImported.map(item => ({
              user_id: currentUser.username,
              name: item.name,
              purchase_amount: item.purchaseAmount,
              unit: item.unit,
              total_price: item.totalPrice,
              yield_percent: item.yieldPercent,
              supplier_id: item.supplierId
            }));
            await supabase.from('ingredients').insert(rowsToInsert);
          }

          alert(`Successfully imported ${formattedImported.length} Master Ingredients!`);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse the backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || purchaseAmount === "" || totalPrice === "" || !selectedSupplierId) {
      alert("Please check all fields, including selecting a vendor folder.");
      return;
    }

    const amt = Number(purchaseAmount);
    const price = Number(totalPrice);
    const yP = yieldPercent === "" ? 100 : Number(yieldPercent);
    let rawGrams = amt;
    if (unit === "kg" || unit === "L") rawGrams = amt * 1000;
    const validGrams = rawGrams * (yP / 100);
    const costG = validGrams > 0 ? price / validGrams : price / rawGrams;

    const newItem: MasterIngredient = {
      id: editingIngredient ? editingIngredient.id : String(Date.now()),
      name,
      purchaseAmount: amt,
      unit,
      totalPrice: price,
      yieldPercent: yP,
      costPerGram: costG,
      supplierId: selectedSupplierId
    };

    const updated = editingIngredient ? ingredients.map(i => i.id === editingIngredient.id ? newItem : i) : [...ingredients, newItem];
    setIngredients(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    // 🌟 Supabase DB 실시간 저장 연동 보완
    if (currentUser?.username) {
      try {
        if (editingIngredient) {
          await supabase.from('ingredients').update({
            name,
            purchase_amount: amt,
            unit,
            total_price: price,
            yield_percent: yP,
            supplier_id: selectedSupplierId
          }).eq('id', editingIngredient.id);
        } else {
          await supabase.from('ingredients').insert([{
            user_id: currentUser.username,
            name,
            purchase_amount: amt,
            unit,
            total_price: price,
            yield_percent: yP,
            supplier_id: selectedSupplierId
          }]);
        }
      } catch (dbErr) {
        console.error("Supabase sync error:", dbErr);
      }
    }

    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIngredient(null);
    setName("");
    setPurchaseAmount("");
    setTotalPrice("");
    setYieldPercent(100);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this ingredient?")) {
      const updated = ingredients.filter(i => i.id !== id);
      setIngredients(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      try {
        await supabase.from('ingredients').delete().eq('id', id);
      } catch (err) {
        console.error("Failed to delete from Supabase:", err);
      }
    }
  };

  const filteredIngredients = ingredients.filter(item => {
    const matchesSupplier = activeSupplierId === "all" || item.supplierId === activeSupplierId;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSupplier && matchesSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/"><Button variant="outline" size="icon"><ArrowLeft size={16} /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Master Ingredients ({currentUser?.username || 'Guest'})</h1>
            <p className="text-gray-500 text-sm">Organized by vendor folders with yield %.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportIngredients} className="hidden" />
          <Button variant="outline" onClick={handleExportIngredients} className="bg-green-50 text-green-700 border-green-200"><Download size={16} /> Export</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-blue-50 text-blue-700 border-blue-200"><Upload size={16} /> Import</Button>
          <Button onClick={() => { setEditingIngredient(null); setSelectedSupplierId(suppliers[0]?.id || ""); setIsModalOpen(true); }} className="bg-slate-900 text-white"><Plus size={16} /> Add Item</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveSupplierId("all")}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
            activeSupplierId === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
          }`}
        >
          All Vendors
        </button>

        {suppliers.map(sup => (
          <div key={sup.id} className="flex items-center">
            <button
              onClick={() => setActiveSupplierId(sup.id)}
              className={`px-3 py-2 rounded-l-xl text-xs font-bold whitespace-nowrap border-y border-l transition-all ${
                activeSupplierId === sup.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {sup.name}
            </button>
            <button
              onClick={(e) => handleDeleteSupplier(sup.id, e)}
              className={`px-2 py-2 rounded-r-xl text-xs font-bold border-y border-r transition-all ${
                activeSupplierId === sup.id ? "bg-slate-800 text-red-300 border-slate-900" : "bg-white text-red-400 border-slate-200 hover:bg-red-50"
              }`}
              title="Delete Vendor Folder"
            >
              &times;
            </button>
          </div>
        ))}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsSupplierModalOpen(true)}
          className="rounded-xl border-dashed border-slate-300 text-slate-600 h-9 shrink-0"
        >
          <FolderPlus size={14} className="mr-1" /> Add Vendor
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200">
        <Search size={18} className="text-slate-400" />
        <input type="text" placeholder="Search ingredient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full outline-none text-sm bg-transparent" />
      </div>

      <div className="space-y-3">
        {filteredIngredients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            No ingredients found in this folder. Add a vendor or create an item to get started.
          </div>
        ) : (
          filteredIngredients.map((item) => {
            const supName = suppliers.find(s => s.id === item.supplierId)?.name || "General";
            const yP = item.yieldPercent ?? 100;
            const rawUnitCost = item.totalPrice / (item.purchaseAmount || 1);
            const effectiveUnitCost = rawUnitCost / (yP / 100);

            return (
              <div key={item.id} className="bg-white border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow transition-shadow">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                      <Folder size={10} className="inline mr-1" /> {supName}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                      Yield: {yP}%
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    <Package size={16} className="inline mr-1.5 text-slate-500" /> {item.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Purchase: {item.purchaseAmount}{item.unit} / <span className="font-bold text-slate-700">${item.totalPrice.toFixed(2)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Unit Cost</span>
                    <span className="text-sm font-bold text-blue-600">${effectiveUnitCost.toFixed(4)} / {item.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 border-l pl-3">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingIngredient(item); setName(item.name); setPurchaseAmount(item.purchaseAmount); setUnit(item.unit); setTotalPrice(item.totalPrice); setYieldPercent(item.yieldPercent); setSelectedSupplierId(item.supplierId); setIsModalOpen(true); }}><Edit size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={16} className="text-red-500" /></Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold">Add Vendor Folder</h2>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Vendor Name</label>
                <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="e.g., Mr Kim" required className="rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsSupplierModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white rounded-xl">Add</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">{editingIngredient ? "Edit Ingredient" : "Add Ingredient"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vendor</label>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} required className="w-full border rounded-xl p-2.5 text-sm bg-white h-11">
                  <option value="" disabled>Select a vendor folder</option>
                  {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-xs font-semibold mb-1">Qty</label><Input type="number" step="0.01" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value === "" ? "" : Number(e.target.value))} required className="rounded-xl" /></div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full border rounded-xl p-2.5 text-sm bg-white h-11">
                    <option value="g">g</option><option value="ml">ml</option><option value="kg">kg</option><option value="L">L</option><option value="EA">EA</option>
                  </select>
                </div>
                <div><label className="block text-xs font-semibold mb-1">Total ($)</label><Input type="number" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))} required className="rounded-xl" /></div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Yield %</label>
                <Input type="number" min="1" max="100" value={yieldPercent} onChange={(e) => setYieldPercent(e.target.value === "" ? "" : Number(e.target.value))} required className="rounded-xl" />
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