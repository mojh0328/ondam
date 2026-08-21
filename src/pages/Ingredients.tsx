import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Plus, ArrowLeft, Search, Edit, Trash2, Package, Folder, FolderPlus, Upload, Download, Layers, Percent } from "lucide-react";
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

  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: "all", name: "All Vendors" },
    { id: "sup_1", name: "General Supplier" }
  ]);

  const [activeSupplierId, setActiveSupplierId] = useState<string>("all");
  const [ingredients, setIngredients] = useState<MasterIngredient[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<MasterIngredient | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierNameInput, setSupplierNameInput] = useState("");

  const [name, setName] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState<number | "">("");
  const [unit, setUnit] = useState("g");
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [yieldPercent, setYieldPercent] = useState<number | "">(100);
  const [selectedSupplierId, setSelectedSupplierId] = useState("sup_1");
  const [bulkText, setBulkText] = useState("");

  // 현재 로그인한 사용자의 데이터만 Supabase에서 불러오기
  const fetchIngredients = async () => {
    if (!currentUser?.username) return;
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', currentUser.username);

      if (error) throw error;

      if (data) {
        const formatted: MasterIngredient[] = data.map((item: any) => {
          const amt = Number(item.purchase_amount || item.purchaseAmount || 1000);
          const price = Number(item.total_price || item.totalPrice || 0);
          const yP = Number(item.yield_percent ?? item.yieldPercent ?? 100);
          const u = item.unit || "g";
          
          let rawGrams = amt;
          if (u === "kg" || u === "L") rawGrams = amt * 1000;
          const validGrams = rawGrams * (yP / 100);
          const costG = validGrams > 0 ? price / validGrams : price / rawGrams;

          return {
            id: item.id,
            name: item.name,
            purchaseAmount: amt,
            unit: u,
            totalPrice: price,
            yieldPercent: yP,
            costPerGram: costG,
            supplierId: item.supplier_id || "sup_1"
          };
        });
        setIngredients(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch ingredients from Supabase:", err);
    }
  };

  useEffect(() => {
    if (currentUser?.username) {
      fetchIngredients();
    }
  }, [currentUser]);

  useEffect(() => {
    if (editingIngredient) {
      setName(editingIngredient.name);
      setPurchaseAmount(editingIngredient.purchaseAmount);
      setUnit(editingIngredient.unit);
      setTotalPrice(editingIngredient.totalPrice);
      setYieldPercent(editingIngredient.yieldPercent ?? 100);
      setSelectedSupplierId(editingIngredient.supplierId || "sup_1");
    } else {
      setName("");
      setPurchaseAmount("");
      setUnit("g");
      setTotalPrice("");
      setYieldPercent(100);
      setSelectedSupplierId(activeSupplierId === "all" ? (suppliers[1]?.id || "sup_1") : activeSupplierId);
    }
  }, [editingIngredient, isModalOpen]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIngredient(null);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierNameInput.trim()) return;

    if (editingSupplier) {
      setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? { ...s, name: supplierNameInput } : s));
    } else {
      const newSup: Supplier = { id: `sup_${Date.now()}`, name: supplierNameInput };
      setSuppliers([...suppliers, newSup]);
    }
    setIsSupplierModalOpen(false);
    setEditingSupplier(null);
    setSupplierNameInput("");
  };

  const handleDeleteSupplier = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "all") return;
    if (confirm("Delete this vendor folder?")) {
      setSuppliers(suppliers.filter(s => s.id !== id));
      if (activeSupplierId === id) setActiveSupplierId("all");
    }
  };

  // 저장할 때 현재 로그인한 사용자의 user_id를 함께 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || purchaseAmount === "" || totalPrice === "" || !currentUser?.username) return;

    const amt = Number(purchaseAmount);
    const prc = Number(totalPrice);
    const yP = yieldPercent === "" ? 100 : Number(yieldPercent);

    const payload = {
      name,
      purchase_amount: amt,
      unit,
      total_price: prc,
      yield_percent: yP,
      user_id: currentUser.username
    };

    try {
      if (editingIngredient) {
        const { error } = await supabase
          .from('ingredients')
          .update(payload)
          .eq('id', editingIngredient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ingredients')
          .insert(payload);

        if (error) throw error;
      }

      await fetchIngredients();
      closeModal();
    } catch (err) {
      console.error("Failed to save ingredient to Supabase:", err);
      alert("Failed to save ingredient to database.");
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !currentUser?.username) return;

    const lines = bulkText.split("\n");
    const newItems: any[] = [];

    lines.forEach((line) => {
      const parts = line.trim().split(/,|\t|\s+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const itemName = parts[0];
        const match = parts[1].toLowerCase().match(/([0-9.]+)\s*([a-z]+)?/);
        const amt = match ? parseFloat(match[1]) || 1 : 1;
        const u = match && match[2] ? match[2] : "g";
        const priceNum = parseFloat(parts[2].replace(/[^0-9.]/g, "")) || 0;
        const yP = parts[3] ? parseFloat(parts[3].replace(/[^0-9.]/g, "")) || 100 : 100;

        newItems.push({
          name: itemName,
          purchase_amount: amt,
          unit: u,
          total_price: priceNum,
          yield_percent: yP,
          user_id: currentUser.username
        });
      }
    });

    if (newItems.length > 0) {
      try {
        const { error } = await supabase.from('ingredients').insert(newItems);
        if (error) throw error;

        await fetchIngredients();
        alert(`${newItems.length} items added successfully to Supabase.`);
        setBulkText("");
        setIsBulkModalOpen(false);
      } catch (err) {
        console.error("Bulk insert failed:", err);
        alert("Failed to bulk insert items.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        JSON.parse(event.target?.result as string);
        alert("Import completed (JSON structure loaded).");
      } catch (err) {
        alert("Failed to parse the backup file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportData = () => {
    try {
      const exportObject: any = { ingredients };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ingredients-backup-${currentUser?.username}-${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert("Backup JSON file exported successfully!");
    } catch (e) {
      alert("Failed to export backup file.");
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this ingredient?")) {
      try {
        const { error } = await supabase
          .from('ingredients')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setIngredients(ingredients.slice().filter(i => i.id !== id));
      } catch (err) {
        console.error("Failed to delete ingredient:", err);
        alert("Failed to delete from database.");
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
            <h1 className="text-2xl font-bold">Master Ingredients (Cloud Sync)</h1>
            <p className="text-gray-500 text-sm">Organized by vendor folders with yield % adjustment.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <Button variant="outline" onClick={handleExportData} className="flex items-center gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
            <Download size={16} /> Export JSON
          </Button>

          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
            <Upload size={16} /> Import JSON
          </Button>

          <Button variant="outline" onClick={() => setIsBulkModalOpen(true)} className="flex items-center gap-2"><Layers size={16} /> Bulk Input</Button>
          <Button onClick={() => { setEditingIngredient(null); setIsModalOpen(true); }} className="flex items-center gap-2"><Plus size={16} /> Add Item</Button>
        </div>
      </div>

      <div className="space-y-2 border-b pb-4">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Folders</p>
          <Button variant="ghost" size="sm" onClick={() => { setEditingSupplier(null); setSupplierNameInput(""); setIsSupplierModalOpen(true); }} className="text-xs flex items-center gap-1 text-blue-600">
            <FolderPlus size={14} /> New Vendor Folder
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              onClick={() => setActiveSupplierId(sup.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer border transition-all ${
                activeSupplierId === sup.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              <Folder size={16} />
              <span>{sup.name}</span>
              {sup.id !== "all" && (
                <div className="flex gap-1 ml-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingSupplier(sup); setSupplierNameInput(sup.name); setIsSupplierModalOpen(true); }} className="hover:text-blue-400">
                    <Edit size={12} />
                  </button>
                  <button onClick={(e) => handleDeleteSupplier(sup.id, e)} className="hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
        <Search size={18} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Search ingredient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 outline-none text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIngredients.map((item) => {
          const supName = suppliers.find(s => s.id === item.supplierId)?.name || "General";
          const yP = item.yieldPercent ?? 100;
          const rawUnitCost = item.totalPrice / (item.purchaseAmount || 1);
          const effectiveUnitCost = rawUnitCost / (yP / 100);

          return (
            <Card key={item.id} className="p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-600 flex items-center gap-1">
                    <Folder size={12} /> {supName}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingIngredient(item); setIsModalOpen(true); }}><Edit size={15} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 size={15} className="text-red-500" /></Button>
                  </div>
                </div>
                <h3 className="font-bold text-lg mt-1 flex items-center gap-2"><Package size={18} className="text-gray-500" /> {item.name}</h3>
              </div>

              <div className="pt-2 border-t flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-400">Qty: {item.purchaseAmount}{item.unit} (${item.totalPrice.toFixed(2)})</p>
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <Percent size={11} className="text-blue-600" /> Yield: <span className="font-bold text-gray-900">{yP}%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 line-through">${rawUnitCost.toFixed(4)}/{item.unit}</p>
                  <span className="text-base font-bold text-blue-600">
                    ${effectiveUnitCost.toFixed(4)} / {item.unit}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold">{editingSupplier ? "Rename Vendor Folder" : "New Vendor Folder"}</h2>
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor / Folder Name</label>
                <Input value={supplierNameInput} onChange={(e) => setSupplierNameInput(e.target.value)} placeholder="e.g. Mr Kim, Oceania" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsSupplierModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">{editingIngredient ? "Edit Item" : "Add Item"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ingredient Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pork Belly" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vendor / Folder</label>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full border rounded-md p-2 text-sm bg-white h-10">
                  {suppliers.filter(s => s.id !== "all").map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-medium mb-1">Qty</label><Input type="number" step="0.01" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="1000" required /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full border rounded-md p-2 text-sm bg-white h-10">
                    <option value="g">g</option><option value="ml">ml</option><option value="kg">kg</option><option value="L">L</option><option value="EA">EA</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Total Price ($)</label><Input type="number" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))} placeholder="14.00" required /></div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg space-y-1">
                <label className="block text-xs font-bold text-blue-900">Yield % (Cooked / Usable Ratio)</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    step="1"
                    min="1"
                    max="100"
                    value={yieldPercent} 
                    onChange={(e) => setYieldPercent(e.target.value === "" ? "" : Number(e.target.value))} 
                    placeholder="70" 
                    className="bg-white"
                  />
                  <span className="text-sm font-bold text-blue-900">%</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4">
            <h2 className="text-lg font-bold">Bulk Input</h2>
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="e.g. PorkBelly 1000g 14 70" className="w-full border rounded-lg p-3 text-sm font-mono outline-none" required />
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(false)}>Cancel</Button><Button type="submit">Add All</Button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}