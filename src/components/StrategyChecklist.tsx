import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Pencil,
  ChevronDown, 
  ChevronUp, 
  Save, 
  PlusCircle,
  ClipboardList,
  User,
  Layout,
  Link2,
  Copy,
  AlertTriangle
} from "lucide-react";
import { Card, Input, Button, Modal, Select, Checkbox } from "./UI";
import { db, handleFirestoreError, OperationType, convertTimestamps } from "@/src/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc
} from "firebase/firestore";
import { MarketingStrategy, StrategyCategory, ChecklistItem, Client } from "@/src/types";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useClients } from "@/src/hooks/useClients";

const DEFAULT_STRATEGY_TEMPLATE: Omit<MarketingStrategy, "id" | "createdAt" | "updatedAt"> = {
  name: "استراتيجية افتراضية",
  categories: [
    {
      id: "1",
      title: "1) Market Research (دراسة السوق)",
      items: [
        { id: "1-1", text: "تحديد الـ Buyer Persona بدقة", isCompleted: false },
        { id: "1-2", text: "دراسة المنافسين (Competitor Analysis)", isCompleted: false },
        { id: "1-3", text: "تحديد الـ USP (الميزة التنافسية)", isCompleted: false },
        { id: "1-4", text: "تحليل SWOT (نقاط القوة والضعف)", isCompleted: false },
      ]
    },
    {
      id: "2",
      title: "2) Content Strategy (استراتيجية المحتوى)",
      items: [
        { id: "2-1", text: "تحديد الـ Content Pillars", isCompleted: false },
        { id: "2-2", text: "إعداد الـ Content Calendar", isCompleted: false },
        { id: "2-3", text: "تحديد الـ Tone of Voice", isCompleted: false },
        { id: "2-4", text: "تحديد أنواع المحتوى (Reels, Carousel, etc.)", isCompleted: false },
      ]
    },
    {
      id: "3",
      title: "3) Media Buying (الإعلانات الممولة)",
      items: [
        { id: "3-1", text: "تحديد الميزانية التسويقية", isCompleted: false },
        { id: "3-2", text: "تحديد المنصات الإعلانية المناسبة", isCompleted: false },
        { id: "3-3", text: "إعداد الـ Funnel (TOFU, MOFU, BOFU)", isCompleted: false },
        { id: "3-4", text: "تجهيز الـ Ad Creatives", isCompleted: false },
      ]
    },
    {
      id: "4",
      title: "4) SEO & SEM (محركات البحث)",
      items: [
        { id: "4-1", text: "البحث عن الكلمات المفتاحية (Keywords)", isCompleted: false },
        { id: "4-2", text: "تحسين الـ On-Page SEO", isCompleted: false },
        { id: "4-3", text: "إعداد حملات Google Ads", isCompleted: false },
      ]
    }
  ]
};

export const StrategyChecklist: React.FC = () => {
  const { clients } = useClients();
  const [strategies, setStrategies] = useState<MarketingStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStrategy, setActiveStrategy] = useState<MarketingStrategy | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [strategyToDeleteId, setStrategyToDeleteId] = useState<string | null>(null);
  const [strategyToEdit, setStrategyToEdit] = useState<MarketingStrategy | null>(null);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [editStrategyName, setEditStrategyName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("default");
  const [isTemplateCreation, setIsTemplateCreation] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const templates = strategies.filter(s => s.isTemplate);
  const clientStrategies = strategies.filter(s => !s.isTemplate);

  useEffect(() => {
    const q = query(collection(db, "marketing_strategies"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => convertTimestamps<MarketingStrategy>({ id: doc.id, ...doc.data() }));
      setStrategies(data);
      
      // Keep active strategy in sync with data
      if (activeStrategy) {
        const current = data.find(s => s.id === activeStrategy.id);
        if (current) {
          setActiveStrategy(current);
        }
      } else if (data.length > 0) {
        setActiveStrategy(data[0]);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "marketing_strategies");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeStrategy?.id]);

  const handleCreateStrategy = async () => {
    if (!newStrategyName.trim()) return;
    try {
      const now = new Date().toISOString();
      const selectedClient = clients.find(c => c.id === selectedClientId);
      
      let baseCategories = DEFAULT_STRATEGY_TEMPLATE.categories;
      if (selectedTemplateId && selectedTemplateId !== "default") {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          baseCategories = JSON.parse(JSON.stringify(template.categories));
        }
      }

      const newStrategyData: any = {
        name: newStrategyName,
        isTemplate: isTemplateCreation,
        categories: baseCategories,
        createdAt: now,
        updatedAt: now
      };

      if (selectedClientId && !isTemplateCreation) {
        newStrategyData.clientId = selectedClientId;
        if (selectedClient?.clientInfo.clientName) {
          newStrategyData.clientName = selectedClient.clientInfo.clientName;
        }
      }
      
      const docRef = await addDoc(collection(db, "marketing_strategies"), newStrategyData);
      
      if (selectedClientId && !isTemplateCreation) {
        await updateDoc(doc(db, "clients", selectedClientId), {
          "marketingData.strategyId": docRef.id,
          "marketingData.lastStrategyUpdate": now,
          updatedAt: now
        });
      }
      
      setIsCreateModalOpen(false);
      setNewStrategyName("");
      setSelectedClientId("");
      setSelectedTemplateId("default");
      setIsTemplateCreation(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "marketing_strategies");
    }
  };

  const updateFinalLink = async (link: string) => {
    if (!activeStrategy) return;
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, "marketing_strategies", activeStrategy.id), {
        finalStrategyLink: link,
        updatedAt: now
      });
      // Small local update for state if needed, though onSnapshot will handle it
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `marketing_strategies/${activeStrategy.id}`);
    }
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const syncWithClient = async (strategyId: string, clientId?: string) => {
    if (!clientId) return;
    try {
      await updateDoc(doc(db, "clients", clientId), {
        "marketingData.strategyId": strategyId,
        "marketingData.lastStrategyUpdate": new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to sync strategy with client:", err);
    }
  };

  const toggleItem = async (catId: string, itemId: string) => {
    if (!activeStrategy) return;
    
    const updatedCategories = activeStrategy.categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.map(item => 
            item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
          )
        };
      }
      return cat;
    });

    await updateStrategyLocalAndRemote(updatedCategories);
  };

  const openDeleteConfirmation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStrategyToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteStrategy = async () => {
    if (!strategyToDeleteId) return;
    try {
      const strategyToDelete = strategies.find(s => s.id === strategyToDeleteId);
      if (strategyToDelete?.clientId) {
        await updateDoc(doc(db, "clients", strategyToDelete.clientId), {
          "marketingData.strategyId": null,
          updatedAt: new Date().toISOString()
        });
      }

      await deleteDoc(doc(db, "marketing_strategies", strategyToDeleteId));
      if (activeStrategy?.id === strategyToDeleteId) {
        setActiveStrategy(strategies.find(s => s.id !== strategyToDeleteId) || null);
      }
      setIsDeleteModalOpen(false);
      setStrategyToDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketing_strategies/${strategyToDeleteId}`);
    }
  };

  const openEditStrategy = (strategy: MarketingStrategy, e: React.MouseEvent) => {
    e.stopPropagation();
    setStrategyToEdit(strategy);
    setEditStrategyName(strategy.name);
    setEditClientId(strategy.clientId || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateStrategyInfo = async () => {
    if (!strategyToEdit || !editStrategyName.trim()) return;
    const now = new Date().toISOString();
    try {
      const selectedClient = clients.find(c => c.id === editClientId);
      const updateData: any = {
        name: editStrategyName,
        updatedAt: now
      };

      if (!strategyToEdit.isTemplate) {
        updateData.clientId = editClientId || null;
        updateData.clientName = selectedClient?.clientInfo.clientName || null;
      }

      await updateDoc(doc(db, "marketing_strategies", strategyToEdit.id), updateData);
      
      // Update link in client record if needed
      if (editClientId && editClientId !== strategyToEdit.clientId && !strategyToEdit.isTemplate) {
        // Remove from old client if exists
        if (strategyToEdit.clientId) {
          await updateDoc(doc(db, "clients", strategyToEdit.clientId), {
            "marketingData.strategyId": null,
            updatedAt: now
          });
        }
        // Add to new client
        await updateDoc(doc(db, "clients", editClientId), {
          "marketingData.strategyId": strategyToEdit.id,
          "marketingData.lastStrategyUpdate": now,
          updatedAt: now
        });
      }

      setIsEditModalOpen(false);
      setStrategyToEdit(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `marketing_strategies/${strategyToEdit.id}`);
    }
  };

  const addCategory = async () => {
    if (!activeStrategy) return;
    const newCat: StrategyCategory = {
      id: Date.now().toString(),
      title: "قسم جديد",
      items: []
    };
    const updatedCategories = [...activeStrategy.categories, newCat];
    
    // Auto expand the new category
    setExpandedCategories(prev => ({ ...prev, [newCat.id]: true }));
    
    await updateStrategyLocalAndRemote(updatedCategories);
  };

  const deleteCategory = async (catId: string) => {
    if (!activeStrategy) return;
    const updatedCategories = activeStrategy.categories.filter(c => c.id !== catId);
    updateStrategyLocalAndRemote(updatedCategories);
  };

  const updateCategoryTitle = async (catId: string, title: string) => {
    if (!activeStrategy) return;
    const updatedCategories = activeStrategy.categories.map(c => 
      c.id === catId ? { ...c, title } : c
    );
    updateStrategyLocalAndRemote(updatedCategories);
  };

  const addItem = async (catId: string) => {
    if (!activeStrategy) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: "خطوة جديدة",
      isCompleted: false
    };
    const updatedCategories = activeStrategy.categories.map(c => 
      c.id === catId ? { ...c, items: [...c.items, newItem] } : c
    );
    updateStrategyLocalAndRemote(updatedCategories);
  };

  const updateItemText = async (catId: string, itemId: string, text: string) => {
    if (!activeStrategy) return;
    const updatedCategories = activeStrategy.categories.map(c => 
      c.id === catId ? {
        ...c,
        items: c.items.map(i => i.id === itemId ? { ...i, text } : i)
      } : c
    );
    updateStrategyLocalAndRemote(updatedCategories);
  };

  const deleteItem = async (catId: string, itemId: string) => {
    if (!activeStrategy) return;
    const updatedCategories = activeStrategy.categories.map(c => 
      c.id === catId ? {
        ...c,
        items: c.items.filter(i => i.id !== itemId)
      } : c
    );
    updateStrategyLocalAndRemote(updatedCategories);
  };

  const updateStrategyLocalAndRemote = async (categories: StrategyCategory[]) => {
    if (!activeStrategy) return;
    const now = new Date().toISOString();
    const updatedStrategy = { 
      ...activeStrategy, 
      categories,
      updatedAt: now
    };
    setActiveStrategy(updatedStrategy);
    try {
      await updateDoc(doc(db, "marketing_strategies", activeStrategy.id), {
        categories,
        updatedAt: now
      });

      // Update linked client if exists
      if (activeStrategy.clientId) {
        await updateDoc(doc(db, "clients", activeStrategy.clientId), {
          "marketingData.lastStrategyUpdate": now,
          updatedAt: now
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `marketing_strategies/${activeStrategy.id}`);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400">
              <ClipboardList size={28} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Marketing Strategy Checklist</h2>
              <p className="text-slate-400 text-sm font-medium">خطوات وإجراءات الاستراتيجية التسويقية الاحترافية</p>
           </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
            onClick={() => {
              setIsTemplateCreation(true);
              setIsCreateModalOpen(true);
            }} 
          >
            <Layout size={20} className="ml-2" /> إنشاء قالب جديد
          </Button>
          <Button 
            onClick={() => {
              setIsTemplateCreation(false);
              setIsCreateModalOpen(true);
            }} 
            className="bg-sky-500 hover:bg-sky-400"
          >
            <Plus size={20} className="ml-2" /> إنشاء خطة عميل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Strategy List */}
        <div className="lg:col-span-1 space-y-8">
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Layout size={12} /> القوالب الافتراضية
              </h3>
              <div className="space-y-2">
                 {templates.map(s => (
                   <div
                     key={s.id}
                     onClick={() => setActiveStrategy(s)}
                     className={cn(
                       "w-full p-4 rounded-2xl text-right transition-all group border flex items-center justify-between cursor-pointer",
                       activeStrategy?.id === s.id 
                         ? "bg-sky-500/10 border-sky-500/30 text-white shadow-lg shadow-sky-500/5 transition-all" 
                         : "bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                     )}
                   >
                     <span className="font-bold truncate ml-2 text-right">{s.name}</span>
                     <div className="flex items-center gap-2">
                       {activeStrategy?.id === s.id && <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />}
                       <button 
                         onClick={(e) => openEditStrategy(s, e)}
                         className="p-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-all"
                       >
                         <Pencil size={12} />
                       </button>
                       <button 
                         onClick={(e) => openDeleteConfirmation(s.id, e)}
                         className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-all"
                       >
                         <Trash2 size={12} />
                       </button>
                     </div>
                   </div>
                 ))}
                 {templates.length === 0 && (
                   <div className="p-4 text-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-xl">
                      <p className="text-[10px] text-slate-600">لا يوجد قوالب</p>
                   </div>
                 )}
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <User size={12} /> خطط العملاء
              </h3>
              <div className="space-y-2">
                 {clientStrategies.map(s => (
                   <div
                     key={s.id}
                     onClick={() => setActiveStrategy(s)}
                     className={cn(
                       "w-full p-4 rounded-2xl text-right transition-all group border flex items-center justify-between cursor-pointer",
                       activeStrategy?.id === s.id 
                         ? "bg-sky-500/10 border-sky-500/30 text-white shadow-lg shadow-sky-500/5" 
                         : "bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                     )}
                   >
                     <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                        <span className="font-bold truncate w-full text-right">{s.name}</span>
                        {s.clientName && <span className="text-[10px] text-slate-500 truncate w-full text-right">{s.clientName}</span>}
                     </div>
                     <div className="flex items-center gap-2">
                       {activeStrategy?.id === s.id && <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />}
                       <button 
                         onClick={(e) => openEditStrategy(s, e)}
                         className="p-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-all"
                       >
                         <Pencil size={12} />
                       </button>
                       <button 
                         onClick={(e) => openDeleteConfirmation(s.id, e)}
                         className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-all"
                       >
                         <Trash2 size={12} />
                       </button>
                     </div>
                   </div>
                 ))}
                 {clientStrategies.length === 0 && (
                   <div className="p-4 text-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-xl">
                      <p className="text-[10px] text-slate-600 text-center">لا يوجد خطط</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* Main Content: Checklist */}
        <div className="lg:col-span-3 space-y-6">
          {activeStrategy ? (
            <div className="space-y-6">
               <div className="flex flex-col gap-6 bg-white/[0.02] border border-white/[0.05] p-6 rounded-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{activeStrategy.name}</h3>
                        {activeStrategy.isTemplate && (
                          <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-tighter rounded-md border border-sky-500/20">قالب</span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">آخر تحديث: {new Date(activeStrategy.updatedAt).toLocaleDateString('ar-SA')}</p>
                    </div>
                    <Button variant="secondary" onClick={addCategory} icon={PlusCircle} size="sm">إضافة قسم</Button>
                  </div>

                  {/* Final Link Field */}
                  <div className="pt-6 border-t border-white/[0.05]">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">رابط الاستراتيجية النهائي (Google Drive / PDF)</label>
                     <div className="flex gap-2">
                        <div className="relative flex-1">
                           <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                           <Input 
                            dark 
                            placeholder="ضع رابط ملف الاستراتيجية هنا..." 
                            className="pr-10"
                            value={activeStrategy.finalStrategyLink || ""}
                            onChange={(e) => updateFinalLink(e.target.value)}
                           />
                        </div>
                        {activeStrategy.finalStrategyLink && (
                          <a 
                            href={activeStrategy.finalStrategyLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center border border-sky-500/20 transition-colors"
                          >
                            <Copy size={16} />
                          </a>
                        )}
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeStrategy.categories.map(cat => (
                    <Card key={cat.id} glass className="p-0 overflow-hidden border-white/[0.05]">
                      <div className="p-2 border-b border-white/[0.05]">
                         <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors group">
                           <div className="flex items-center gap-3 flex-1">
                              <button 
                                onClick={() => toggleCategory(cat.id)}
                                className="text-slate-500 hover:text-white transition-colors"
                              >
                                 {expandedCategories[cat.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </button>
                              <input 
                                value={cat.title || ""}
                                onChange={(e) => updateCategoryTitle(cat.id, e.target.value)}
                                className="bg-transparent border-none text-white font-black p-0 focus:ring-0 w-full"
                              />
                           </div>
                           <div className="flex items-center gap-2 transition-all">
                              <button 
                                onClick={() => addItem(cat.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                              >
                                <Plus size={16} />
                              </button>
                              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => deleteCategory(cat.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 size={16} />
                              </button>
                           </div>
                         </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expandedCategories[cat.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 space-y-2">
                               {cat.items.map(item => (
                                 <div 
                                  key={item.id} 
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-xl transition-all border group/item",
                                    item.isCompleted 
                                      ? "bg-green-500/5 border-green-500/10 text-slate-400" 
                                      : "bg-white/[0.02] border-white/[0.05] text-slate-200"
                                  )}
                                 >
                                    <div className="flex items-center gap-3 flex-1">
                                       <button onClick={() => toggleItem(cat.id, item.id)}>
                                          {item.isCompleted ? (
                                            <CheckCircle2 size={18} className="text-green-500" />
                                          ) : (
                                            <Circle size={18} className="text-slate-600 hover:text-sky-400 transition-colors" />
                                          )}
                                       </button>
                                       <input 
                                        value={item.text || ""}
                                        onChange={(e) => updateItemText(cat.id, item.id, e.target.value)}
                                        className={cn(
                                          "bg-transparent border-none p-0 focus:ring-0 text-sm font-medium w-full",
                                          item.isCompleted && "line-through opacity-50"
                                        )}
                                       />
                                    </div>
                                    <div className="flex items-center gap-2 transition-all">
                                       <button className="text-amber-500 hover:text-amber-400 transition-colors">
                                          <Pencil size={12} />
                                       </button>
                                       <button 
                                         onClick={() => deleteItem(cat.id, item.id)}
                                         className="text-red-400 hover:text-red-300 transition-colors"
                                       >
                                          <Trash2 size={14} />
                                       </button>
                                    </div>
                                 </div>
                               ))}
                               {cat.items.length === 0 && (
                                 <div className="py-4 text-center">
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest">لا يوجد عناصر حالياً</p>
                                 </div>
                               )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  ))}
               </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-3xl text-center">
               <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mb-4 text-slate-600">
                  <ClipboardList size={32} />
               </div>
               <h3 className="text-xl font-bold text-white mb-2">اختر استراتيجية للبدء</h3>
               <p className="text-slate-500 text-sm max-w-xs">يمكنك اختيار خطة من القائمة الجانبية أو البدء بإنشاء خطة تسويقية جديدة تماماً</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title={isTemplateCreation ? "إعداد قالب تسويقي جديد" : "إنشاء استراتيجية عميل جديدة"}
      >
        <div className="space-y-6">
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">اسم {isTemplateCreation ? "القالب" : "الخطة"}</label>
              <Input 
                dark 
                placeholder={isTemplateCreation ? "مثال: قالب المطاعم، قالب العقارات..." : "مثال: Q2 Marketing Strategy"} 
                value={newStrategyName}
                onChange={(e) => setNewStrategyName(e.target.value)}
              />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">
                {isTemplateCreation ? "نسخ البيانات من قالب موجود (اختياري)" : "بدءاً من (اختر قالب)"}
              </label>
              <Select 
                dark 
                value={selectedTemplateId} 
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="default" className="bg-[#0f172a]">
                  {isTemplateCreation ? "قالب فارغ (بدء من الصفر)" : "الخيار الافتراضي (فارغ تقريباً)"}
                </option>
                {templates.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#0f172a]">{t.name}</option>
                ))}
              </Select>
           </div>

           {!isTemplateCreation && (
             <div className="pt-2">
               <Checkbox 
                label="حفظ كقالب افتراضي أيضاً" 
                checked={isTemplateCreation}
                onChange={(e) => setIsTemplateCreation(e.target.checked)}
                dark
               />
             </div>
           )}

           {!isTemplateCreation && (
             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400">ارتباط بالعميل (اختياري)</label>
                <Select 
                  dark 
                  value={selectedClientId} 
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="" className="bg-[#0f172a]">خطة عامة (بدون عميل)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.clientInfo.clientName} - {c.clientCode}</option>
                  ))}
                </Select>
             </div>
           )}

           <div className="flex gap-3">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setIsCreateModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 bg-sky-500 hover:bg-sky-400" 
                onClick={handleCreateStrategy}
                disabled={!newStrategyName.trim()}
              >
                {isTemplateCreation ? "حفظ القالب" : "إنشاء الخطة"}
              </Button>
           </div>
        </div>
      </Modal>

      {/* Edit Strategy Info Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="تعديل معلومات الخطة"
      >
        <div className="space-y-6">
           <div className="space-y-2 text-right">
              <label className="text-xs font-bold text-slate-400">اسم الخطة</label>
              <Input 
                dark 
                value={editStrategyName}
                onChange={(e) => setEditStrategyName(e.target.value)}
                className="text-right"
              />
           </div>

           {strategyToEdit && !strategyToEdit.isTemplate && (
             <div className="space-y-2 text-right">
                <label className="text-xs font-bold text-slate-400">العميل المرتبط</label>
                <Select 
                  dark 
                  value={editClientId} 
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="text-right"
                >
                  <option value="" className="bg-[#0f172a]">خطة عامة (بدون عميل)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a] text-right">{c.clientInfo.clientName}</option>
                  ))}
                </Select>
             </div>
           )}

           <div className="flex gap-3">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setIsEditModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-white" 
                onClick={handleUpdateStrategyInfo}
                disabled={!editStrategyName.trim()}
              >
                حفظ التغييرات
              </Button>
           </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="space-y-6 text-center">
           <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle size={32} />
           </div>
           <div>
              <h4 className="text-lg font-bold text-white mb-2">هل أنت متأكد من الحذف؟</h4>
              <p className="text-slate-400 text-sm">سيتم حذف هذه الاستراتيجية وجميع بياناتها نهائياً. لا يمكن التراجع عن هذا الإجراء.</p>
           </div>
           <div className="flex gap-3 pt-4">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setIsDeleteModalOpen(false)}
              >
                تراجع
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-500 text-white" 
                onClick={confirmDeleteStrategy}
              >
                تأكيد الحذف
              </Button>
           </div>
        </div>
      </Modal>
    </div>
  );
};
