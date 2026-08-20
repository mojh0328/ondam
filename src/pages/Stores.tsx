import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Store as StoreIcon, ArrowRight, Edit, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { 
  useListStores, 
  useCreateStore, 
  useUpdateStore, 
  useDeleteStore,
  getListStoresQueryKey,
  type Store 
} from "@workspace/api-client-react";

export default function Stores() {
  const queryClient = useQueryClient();
  const { data: stores, isLoading } = useListStores();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { mutate: createStore, isPending: isCreating } = useCreateStore({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
        closeModal();
      }
    }
  });

  const { mutate: updateStore, isPending: isUpdating } = useUpdateStore({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
        closeModal();
      }
    }
  });

  const { mutate: deleteStore } = useDeleteStore({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() })
    }
  });

  useEffect(() => {
    if (editingStore) {
      setName(editingStore.name);
      setDescription(editingStore.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [editingStore]);

  const openNewStore = () => {
    setEditingStore(null);
    setIsModalOpen(true);
  };

  const openEditStore = (store: Store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStore(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingStore) {
      updateStore({ id: editingStore.id, data: { name, description } });
    } else {
      createStore({ data: { name, description } });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this store? All menu items will be lost.")) {
      deleteStore({ id });
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900">Stores</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Manage your restaurant locations and specific menus.</p>
        </div>
        <Button onClick={openNewStore} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Add Store
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 sm:h-48 rounded-2xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      ) : stores?.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-white border border-zinc-200 border-dashed rounded-2xl">
          <StoreIcon className="w-9 h-9 sm:w-12 sm:h-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-900">No stores found</h3>
          <p className="text-zinc-500 mt-1 mb-4 text-sm">Create your first store to start managing menus.</p>
          <Button onClick={openNewStore} variant="outline">Create Store</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {stores?.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex flex-col h-full hover:shadow-md hover:border-zinc-300 transition-all duration-300 group">
                <div className="p-4 sm:p-5 flex-1">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-zinc-100 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                    <StoreIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-display font-bold text-zinc-900 leading-tight">{store.name}</h3>
                  <p className="text-zinc-500 text-xs sm:text-sm mt-1.5 line-clamp-2">{store.description || 'No description provided.'}</p>
                </div>
                <div className="px-4 sm:px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between rounded-b-2xl">
                  <Link href={`/stores/${store.id}/menu`} className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors flex items-center">
                    Manage Menu <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => openEditStore(store)} className="h-8 w-8 text-zinc-500">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingStore ? "Edit Store" : "Create New Store"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Store Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Downtown Branch" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Description (Optional)</label>
            <Input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Brief details about this location" 
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingStore ? "Save Changes" : "Create Store"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
