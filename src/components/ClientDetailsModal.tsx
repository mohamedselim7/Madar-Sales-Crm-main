import React, { useState, useEffect } from "react";
import { 
  Users, 
  ClipboardCheck,
  Plus,
  Trash2,
  Save,
  Link2,
  Edit3,
  DollarSign,
  UserCheck,
  X,
  History,
  ExternalLink,
  ChevronLeft,
  Target,
  CheckCircle2,
  Circle,
  Star
} from "lucide-react";
import { Card, Input, Select, Button, Tabs } from "./UI";
import { db, handleFirestoreError, OperationType, convertTimestamps } from "@/src/lib/firebase";
import { doc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import { Client, ImportantLink, MarketingStrategy } from "@/src/types";
import { formatCurrency, cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { sendSystemNotification } from "@/src/utils/notifications";
import { useClients } from "@/src/hooks/useClients";

const FIELD_TRANSLATIONS: Record<string, string> = {
  stage: "المرحلة",
  crData: "بيانات الـ CR",
  marketingData: "بيانات التسويق",
  workGroupName: "جروب العمل",
  accountManagerName: "رقم الأكونت مانجر",
  clientStatus: "حالة العميل",
  accountManagerBrief: "بريف الأكونت مانجر",
  notes: "ملاحظات إضافية",
  marketingManagerName: "مدير التسويق",
  clientInfo: "بيانات العميل الأساسية",
  contract: "بيانات التعاقد",
  clientName: "اسم العميل",
  businessName: "اسم البيزنس",
  serviceType: "نوع الخدمة",
  contractAmount: "مبلغ التعاقد",
  currency: "العملة",
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  paymentMethod: "طريقة الدفع",
  satisfactionRatings: "تقييمات رضا العميل",
};

const formatLogValue = (val: any): string => {
  if (val === null || val === undefined) return "—";
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "قائمة فارغة";
    
    const entries = Object.entries(val)
      .filter(([k, v]) => v !== null && v !== "" && v !== undefined && k !== 'id')
      .map(([k, v]) => {
        const label = FIELD_TRANSLATIONS[k] || k;
        let formattedVal = v;
        
        if (typeof v === 'object' && v !== null) {
          formattedVal = Object.entries(v)
            .filter(([nk, nv]) => nv !== null && nv !== "" && nv !== undefined)
            .map(([nk, nv]) => `${FIELD_TRANSLATIONS[nk] || nk}: ${nv}`)
            .join(", ");
        } else if (k === 'stage') {
          if (v === "received_from_sales") formattedVal = "تم الاستلام من المبيعات";
          if (v === "cr_received") formattedVal = "قيد التنفيذ في CR";
          if (v === "sent_to_marketing") formattedVal = "تم التوزيع للتسويق";
        }
        
        return `${label}: ${formattedVal}`;
      });

    return entries.length > 0 ? entries.join(" | ") : "بيانات فارغة";
  }
  
  if (val === "received_from_sales") return "تم الاستلام من المبيعات";
  if (val === "cr_received") return "قيد التنفيذ في CR";
  if (val === "sent_to_marketing") return "تم التوزيع للتسويق";
  
  return String(val);
};

export const ClientDetailsModal: React.FC<{ 
  client: Client | null, 
  isOpen: boolean, 
  onClose: () => void, 
  settings: any,
  mode?: "sales" | "cr" | "admin" | "marketing"
}> = ({ client, isOpen, onClose, settings, mode = "admin" }) => {
  const { updateClient } = useClients();
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [logFilter, setLogFilter] = useState<"ALL" | "SALES" | "CR" | "MARKETING">("ALL");
  const [showLogSidebar, setShowLogSidebar] = useState(false);
  const [strategy, setStrategy] = useState<MarketingStrategy | null>(null);

  useEffect(() => {
    if (client?.marketingData?.strategyId) {
      const unsub = onSnapshot(doc(db, "marketing_strategies", client.marketingData.strategyId), (docSnap) => {
        if (docSnap.exists()) {
          setStrategy(convertTimestamps<MarketingStrategy>({ id: docSnap.id, ...docSnap.data() }));
        } else {
          setStrategy(null);
        }
      });
      return () => unsub();
    } else {
      setStrategy(null);
    }
  }, [client?.marketingData?.strategyId]);

  useEffect(() => {
    if (client) {
      setFormData(client);
      setLinks(client.importantLinks || []);
      setIsEditing(false);
    }
  }, [client]);

  // Handle early return AFTER all hooks
  if (!client || !isOpen) return null;

  const handleUpdate = async () => {
    try {
      const clientRef = doc(db, "clients", client.id);
      
      const updatedFields: string[] = [];
      if (JSON.stringify(formData.clientInfo) !== JSON.stringify(client.clientInfo)) updatedFields.push("clientInfo");
      if (JSON.stringify(formData.contract) !== JSON.stringify(client.contract)) updatedFields.push("contract");
      if (JSON.stringify(formData.salesTeam) !== JSON.stringify(client.salesTeam)) updatedFields.push("salesTeam");
      if (JSON.stringify(formData.crData) !== JSON.stringify(client.crData)) updatedFields.push("crData");
      if (JSON.stringify(formData.marketingData) !== JSON.stringify(client.marketingData)) updatedFields.push("marketingData");
      if (JSON.stringify(formData.satisfactionRatings) !== JSON.stringify(client.satisfactionRatings)) updatedFields.push("satisfactionRatings");
      if (JSON.stringify(links) !== JSON.stringify(client.importantLinks)) updatedFields.push("importantLinks");

      if (updatedFields.length === 0) {
        setIsEditing(false);
        return;
      }

      const cleanData = JSON.parse(JSON.stringify({
        ...formData,
        importantLinks: links,
        updatedAt: new Date().toISOString(),
      }));

      const log: any = {
        date: new Date().toISOString(),
        action: "تحديث بيانات العميل",
        updatedFields,
        oldValue: { 
          clientInfo: client.clientInfo,
          contract: client.contract,
          crData: client.crData,
          marketingData: client.marketingData,
          satisfactionRatings: client.satisfactionRatings || []
        },
        newValue: {
          clientInfo: formData.clientInfo,
          contract: formData.contract,
          crData: formData.crData,
          marketingData: formData.marketingData,
          satisfactionRatings: formData.satisfactionRatings || []
        },
        department: mode === "sales" ? "SALES" : mode === "cr" ? "CR" : "MARKETING"
      };

      await updateClient(client.id, {
        ...cleanData,
        updateLog: [...(client.updateLog || []), log]
      });

      await sendSystemNotification({
        title: "تحديث ملف عميل! 📝✨",
        message: `تم تحديث بيانات العميل "${formData.clientInfo.clientName}" بنجاح في قسم "${mode === "sales" ? "المبيعات" : mode === "cr" ? "العلاقات العامة" : "التسويق"}".`,
        type: "client",
        category: "العملاء"
      });

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `clients/${client.id}`);
    }
  };

  const addLink = () => {
    if (links.length >= 10) return;
    if (newLink.title && newLink.url) {
      setLinks([...links, newLink]);
      setNewLink({ title: "", url: "" });
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const tabs = [
    { id: "basic", label: "البيانات الأساسية", icon: Users },
    { id: "contract", label: "التعاقد والماليات", icon: DollarSign, hidden: mode === "sales" || mode === "marketing" },
    { id: "sales", label: "فريق المبيعات", icon: UserCheck },
    { id: "cr", label: "بيانات الـ CR", icon: ClipboardCheck, hidden: mode === "sales" },
    { id: "marketing", label: "الخطة التسويقية", icon: Target, hidden: mode === "sales" },
    { id: "rating", label: "تقييم العميل", icon: Star, hidden: mode === "sales" },
    { id: "links", label: "روابط هامة", icon: Link2, hidden: mode === "sales" },
  ].filter(t => !t.hidden);

  const filteredLogs = (client.updateLog || [])
    .filter(log => logFilter === "ALL" || log.department === logFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <Card glass className="w-full max-w-6xl h-[90vh] overflow-hidden p-0 border-white/[0.08] shadow-2xl flex relative" dir="rtl">
        
        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">ملف العميل الإلكتروني</h3>
                <p className="text-sm text-slate-400 font-bold mt-1">
                  {formData.clientInfo?.clientName} 
                  <span className="mx-3 text-white/10">|</span> 
                  <span className="font-mono text-sky-400">{client.clientCode}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  className={cn("h-12 px-6", showLogSidebar ? "bg-sky-500 text-white" : "")}
                  onClick={() => setShowLogSidebar(!showLogSidebar)}
                >
                  <History className="ml-2" size={18} /> سجل التعديلات
                </Button>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="bg-sky-500 hover:bg-sky-400 h-12 px-6">
                    <Edit3 className="ml-2" size={18} /> تعديل البيانات
                  </Button>
                ) : (
                  <Button onClick={handleUpdate} className="bg-green-600 hover:bg-green-500 h-12 px-6">
                    <Save className="ml-2" size={18} /> حفظ التغييرات
                  </Button>
                )}
                <button 
                  onClick={onClose} 
                  className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-8 bg-black/20 border-b border-white/[0.05]">
              <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} dark className="bg-transparent border-none py-4" />
            </div>

            {/* Scrollable Content */}
            <div className="p-10 overflow-y-auto grow custom-scrollbar bg-gradient-to-b from-white/[0.01] to-transparent">
              {activeTab === "basic" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 animate-duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">بيانات التواصل</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">اسم العميل</label>
                          <Input dark value={formData.clientInfo?.clientName || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, clientName: e.target.value}})} readOnly={!isEditing} />
                        </div>
                        {mode !== "marketing" && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">رقم الهاتف</label>
                              <Input dark value={formData.clientInfo?.phone || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, phone: e.target.value}})} readOnly={!isEditing} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">رقم الهاتف الإضافي</label>
                              <Input dark value={formData.clientInfo?.additionalPhone || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, additionalPhone: e.target.value}})} readOnly={!isEditing} placeholder="لا يوجد رقم إضافي..." />
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">البريد الإلكتروني</label>
                          <Input dark value={formData.clientInfo?.email || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, email: e.target.value}})} readOnly={!isEditing} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">بيانات الخدمة</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">اسم البيزنس</label>
                          <Input dark value={formData.clientInfo?.businessName || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, businessName: e.target.value}})} readOnly={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">نوع الخدمة</label>
                          {isEditing ? (
                            <Select dark value={formData.clientInfo?.serviceType || ""} onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, serviceType: e.target.value}})}>
                              {settings.serviceTypes?.map((s: any) => <option key={s.id} value={s.name} className="bg-[#0f172a]">{s.name}</option>)}
                            </Select>
                          ) : (
                            <Input dark value={formData.clientInfo?.serviceType || ""} readOnly />
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">رابط الموقع / المتجر الإضافي</label>
                          <div className="flex gap-2">
                            <Input 
                              dark 
                              value={formData.clientInfo?.additionalStore || ""} 
                              onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, additionalStore: e.target.value}})} 
                              readOnly={!isEditing} 
                              placeholder="لا يوجد متجر إضافي..."
                              className="flex-1"
                            />
                            {formData.clientInfo?.additionalStore && (
                              <a 
                                href={formData.clientInfo.additionalStore}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 flex items-center justify-center bg-sky-500/10 text-sky-400 rounded-xl hover:bg-sky-500/20 transition-all border border-sky-500/10"
                                title="فتح المتجر الإضافي"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">بريف مبيعات (Sales Brief)</label>
                    <textarea 
                      className="w-full h-40 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-white p-6 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all disabled:opacity-50" 
                      value={formData.clientInfo?.salesBrief || ""}
                      onChange={(e) => setFormData({...formData, clientInfo: {...formData.clientInfo!, salesBrief: e.target.value}})}
                      readOnly={!isEditing}
                    />
                  </div>
                </div>
              )}

              {activeTab === "contract" && (
                <div className="space-y-10 animate-in fade-in animate-duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { label: "مبلغ التعاقد", value: formatCurrency(formData.contract?.contractAmount || 0, formData.contract?.currency || "EGP"), color: "text-white" },
                      { label: "المبلغ المحصل", value: formatCurrency(formData.contract?.paidAmount || 0, formData.contract?.currency || "EGP"), color: "text-green-400" },
                      { label: "المبلغ المتبقي", value: formatCurrency(formData.contract?.remainingAmount || 0, formData.contract?.currency || "EGP"), color: "text-red-400" },
                      { label: "القيمة الشهرية", value: formatCurrency(formData.contract?.monthlyValue || 0, formData.contract?.currency || "EGP"), color: "text-sky-400" },
                    ].map((stat, i) => (
                      <div key={i} className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={cn("text-xl font-black", stat.color)}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">المواعيد</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">تاريخ البداية</label>
                          <Input dark type="date" value={formData.contract?.startDate || ""} onChange={(e) => setFormData({...formData, contract: {...formData.contract!, startDate: e.target.value}})} readOnly={!isEditing} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">تاريخ الانتهاء</label>
                          <Input dark type="date" value={formData.contract?.endDate || ""} onChange={(e) => setFormData({...formData, contract: {...formData.contract!, endDate: e.target.value}})} readOnly={!isEditing} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">تفاصيل الدفع</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">طريقة الدفع</label>
                          {isEditing ? (
                            <Select dark value={formData.contract?.paymentMethod || ""} onChange={(e) => setFormData({...formData, contract: {...formData.contract!, paymentMethod: e.target.value}})}>
                              <option value="Cash" className="bg-[#0f172a]">كاش</option>
                              <option value="Bank Transfer" className="bg-[#0f172a]">تحويل بنكي</option>
                              <option value="InstaPay" className="bg-[#0f172a]">إنستا باي</option>
                              <option value="Vodafone Cash" className="bg-[#0f172a]">فودافون كاش</option>
                            </Select>
                          ) : (
                            <Input dark value={formData.contract?.paymentMethod || ""} readOnly />
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">العملة</label>
                          {isEditing ? (
                            <Select dark value={formData.contract?.currency || ""} onChange={(e) => setFormData({...formData, contract: {...formData.contract!, currency: e.target.value}})}>
                              <option value="EGP" className="bg-[#0f172a]">EGP</option>
                              <option value="SAR" className="bg-[#0f172a]">SAR</option>
                              <option value="USD" className="bg-[#0f172a]">USD</option>
                            </Select>
                          ) : (
                            <Input dark value={formData.contract?.currency || ""} readOnly />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "sales" && (
                <div className="space-y-8 animate-in fade-in animate-duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { label: "CSO", key: "cso", settingsKey: "csos" },
                      { label: "مدير المبيعات", key: "salesManager", settingsKey: "salesManagers" },
                      { label: "مسؤول المبيعات", key: "salesAgent", settingsKey: "salesAgents" },
                      { label: "مدير تلي سيلز", key: "teleSalesManager", settingsKey: "teleSalesManagers" },
                      { label: "مسؤول تلي سيلز", key: "teleSalesAgent", settingsKey: "teleSalesAgents" },
                    ].map((field) => (
                      <div key={field.key} className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{field.label}</label>
                        {isEditing ? (
                          <Select 
                            dark
                            value={(formData.salesTeam as any)?.[field.key] || ""} 
                            onChange={(e) => setFormData({
                              ...formData, 
                              salesTeam: { ...formData.salesTeam!, [field.key]: e.target.value }
                            })}
                          >
                            <option value="" className="bg-[#0f172a]">اختر...</option>
                            {(settings as any)[field.settingsKey]?.map((s: any) => <option key={s.id} value={s.name} className="bg-[#0f172a]">{s.name}</option>)}
                          </Select>
                        ) : (
                          <p className="text-base font-bold text-white">{(formData.salesTeam as any)?.[field.key] || "—"}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "cr" && (
                <div className="space-y-10 animate-in fade-in animate-duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Account Manager</label>
                        {isEditing ? (
                          <Select dark value={formData.crData?.accountManagerName || ""} onChange={(e) => setFormData({...formData, crData: {...formData.crData!, accountManagerName: e.target.value}})}>
                             <option value="" className="bg-[#0f172a]">اختر...</option>
                             {settings.accountManagers?.map((m: any) => <option key={m.id} value={m.name} className="bg-[#0f172a]">{m.name}</option>)}
                          </Select>
                        ) : (
                          <p className="text-base font-bold text-white">{formData.crData?.accountManagerName || "—"}</p>
                        )}
                      </div>
                      <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">جروب العمل (واتساب)</label>
                        <Input dark value={formData.crData?.workGroupName || ""} onChange={(e) => setFormData({...formData, crData: {...formData.crData!, workGroupName: e.target.value}})} readOnly={!isEditing} />
                      </div>
                      <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">حالة العميل</label>
                        {isEditing ? (
                          <Select dark value={formData.crData?.clientStatus || ""} onChange={(e) => setFormData({...formData, crData: {...formData.crData!, clientStatus: e.target.value}})}>
                             <option value="" className="bg-[#0f172a]">اختر الحالة</option>
                             {settings.clientStatuses?.map((s: any) => <option key={s.id} value={s.name} className="bg-[#0f172a]">{s.name}</option>)}
                          </Select>
                        ) : (
                          <p className="text-base font-bold text-white">{formData.crData?.clientStatus || "—"}</p>
                        )}
                      </div>
                   </div>
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">بريف الأكونت مانجر</label>
                     <textarea 
                        className="w-full h-40 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-white p-6 focus:ring-2 focus:ring-sky-500/50 outline-none" 
                        value={formData.crData?.accountManagerBrief || ""}
                        onChange={(e) => setFormData({...formData, crData: {...formData.crData!, accountManagerBrief: e.target.value}})}
                        readOnly={!isEditing}
                     />
                   </div>
                </div>
              )}

              {activeTab === "marketing" && (
                <div className="space-y-10 animate-in fade-in animate-duration-500">
                  {strategy ? (
                    <div className="space-y-8 text-right">
                       <div className="flex items-center justify-between p-6 bg-sky-500/5 rounded-3xl border border-sky-500/10">
                          <div>
                            <h4 className="text-xl font-black text-white">{strategy.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">تاريخ البدء: {new Date(strategy.createdAt).toLocaleDateString('ar-SA')}</p>
                          </div>
                          <div className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-xl text-xs font-black uppercase tracking-widest border border-sky-500/30">
                             قيد التنفيذ
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {strategy.categories.map(cat => (
                            <Card key={cat.id} glass className="p-6 border-white/[0.05] h-fit">
                               <h5 className="font-black text-white mb-6 flex items-center justify-between">
                                 {cat.title}
                                 <span className="text-[10px] text-slate-500 font-mono">
                                   {cat.items.filter(i => i.isCompleted).length}/{cat.items.length}
                                 </span>
                               </h5>
                               <div className="space-y-3">
                                  {cat.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-3">
                                       {item.isCompleted ? (
                                         <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                                       ) : (
                                         <Circle size={18} className="text-slate-700 shrink-0" />
                                       )}
                                       <span className={cn(
                                         "text-sm font-medium transition-all",
                                         item.isCompleted ? "text-slate-500 line-through" : "text-slate-300"
                                       )}>
                                         {item.text}
                                       </span>
                                    </div>
                                  ))}
                                  {cat.items.length === 0 && (
                                    <p className="text-[10px] text-slate-600 text-center py-4 uppercase tracking-widest">لا يوجد مهام حالياً</p>
                                  )}
                               </div>
                            </Card>
                          ))}
                       </div>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-3xl text-center">
                       <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mb-4 text-slate-600">
                          <Target size={32} />
                       </div>
                       <h3 className="text-xl font-bold text-white mb-2">لا يوجد خطة تسويقية مرتبطة</h3>
                       <p className="text-slate-500 text-sm max-w-xs">يمكنك إنشاء خطة وربطها بهذا العميل من خلال قسم "Strategy Checklist" في الشاشة الرئيسية.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rating" && (
                <div className="space-y-10 animate-in fade-in animate-duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">إضافة تقييم جديد</h4>
                         <Card glass className="p-8 border-white/[0.05] space-y-6">
                            <div className="space-y-4">
                               <label className="text-xs font-black text-slate-500 uppercase tracking-widest block text-center">مدى رضا العميل عن الفريق (1-10)</label>
                               <div className="flex justify-between items-center gap-2">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <button
                                      key={num}
                                      disabled={!isEditing}
                                      onClick={() => {
                                        const currentRatings = formData.satisfactionRatings || [];
                                        const newRating = {
                                          date: new Date().toISOString(),
                                          rating: num,
                                          comment: (formData as any).tempRatingComment || "",
                                          period: `Period ${Math.ceil(new Date().getDate() / 14)} - ${new Date().getMonth() + 1}/${new Date().getFullYear()}`
                                        };
                                        setFormData({
                                          ...formData,
                                          satisfactionRatings: [newRating, ...currentRatings]
                                        });
                                      }}
                                      className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all border",
                                        (formData.satisfactionRatings?.[0]?.rating === num && 
                                         new Date(formData.satisfactionRatings?.[0]?.date).toDateString() === new Date().toDateString())
                                          ? "bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/20 scale-110"
                                          : isEditing 
                                            ? "bg-white/5 border-white/10 text-slate-400 hover:border-sky-500/50 hover:text-sky-400"
                                            : "bg-white/[0.02] border-white/5 text-slate-600 cursor-not-allowed"
                                      )}
                                    >
                                      {num}
                                    </button>
                                  ))}
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">ملاحظات العميل</label>
                               <textarea 
                                 className="w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                                 placeholder="لماذا تم اختيار هذا التقييم؟"
                                 value={(formData as any).tempRatingComment || ""}
                                 onChange={(e) => setFormData({...formData, tempRatingComment: e.target.value} as any)}
                               />
                            </div>
                            <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl text-center">
                               <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">معدل التقييم يتم أخذه كل أسبوعين لقياس أداء الفريق</p>
                               {isEditing ? (
                                 <p className="text-[9px] text-sky-300/60 mt-1">اضغط على "حفظ التغييرات" بالأعلى لتأكيد التقييم</p>
                               ) : (
                                 <p className="text-[9px] text-rose-400 mt-1 font-bold">يجب تفعيل وضع التعديل (Edit) لتغيير التقييم</p>
                               )}
                            </div>
                         </Card>
                      </div>

                      <div className="space-y-6">
                         <h4 className="font-black text-white border-r-4 border-sky-500 pr-4 text-lg">سجل التقييمات</h4>
                         <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {(formData.satisfactionRatings || []).map((rating, idx) => (
                              <div key={idx} className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-start gap-4 hover:bg-white/[0.04] transition-all">
                                 <div className={cn(
                                   "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                                   rating.rating >= 8 ? "bg-green-500/10 border-green-500/20 text-green-400" :
                                   rating.rating >= 5 ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                                   "bg-red-500/10 border-red-500/20 text-red-400"
                                 )}>
                                    <span className="text-xl font-black">{rating.rating}</span>
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                       <p className="text-xs font-black text-white">{rating.period || "تقييم عام"}</p>
                                       <p className="text-[10px] text-slate-500 font-mono">{new Date(rating.date).toLocaleDateString('ar-SA')}</p>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed italic">{rating.comment || "لا يوجد تعليق"}</p>
                                 </div>
                              </div>
                            ))}
                            {(!formData.satisfactionRatings || formData.satisfactionRatings.length === 0) && (
                              <div className="py-20 text-center opacity-30">
                                 <Star size={48} className="mx-auto mb-4" />
                                 <p className="text-xs font-black uppercase tracking-widest">لا يوجد تقييمات سابقة</p>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {activeTab === "links" && (
                <div className="space-y-8 animate-in fade-in animate-duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {[
                        "رابط المتجر",
                        "رابط الفيس بوك",
                        "رابط انستجرام",
                        "رابط تيكتوك",
                        "رابط سناب شات"
                      ].map((title) => {
                        const link = links.find(l => l.title === title);
                        return (
                          <div key={title} className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-3xl space-y-3">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">{title}</label>
                            <div className="flex gap-3">
                              <Input 
                                dark 
                                placeholder="https://..." 
                                value={link?.url || ""} 
                                onChange={(e) => {
                                  const newUrl = e.target.value;
                                  const existing = links.find(l => l.title === title);
                                  if (existing) {
                                    setLinks(links.map(l => l.title === title ? { ...l, url: newUrl } : l));
                                  } else {
                                    setLinks([...links, { title, url: newUrl }]);
                                  }
                                }} 
                                readOnly={!isEditing}
                                className="flex-1"
                              />
                              {link?.url && (
                                <a 
                                  href={link.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-12 h-12 flex items-center justify-center bg-sky-500/10 text-sky-400 rounded-xl hover:bg-sky-500/20 transition-all border border-sky-500/20"
                                >
                                  <ExternalLink size={18} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                   </div>
                   
                   {/* Allow adding extra links if needed, or keep it strictly fixed? User said "fixed fields" */}
                   <div className="pt-10 border-t border-white/[0.05] space-y-6">
                      <h4 className="text-lg font-black text-white">روابط إضافية</h4>
                      <div className="bg-white/[0.02] p-8 rounded-3xl border border-white/[0.05] flex gap-4">
                        <Input 
                          dark 
                          placeholder="عنوان الرابط الإضافي" 
                          value={newLink.title} 
                          onChange={(e) => setNewLink({...newLink, title: e.target.value})} 
                          className="w-1/3"
                          disabled={!isEditing}
                        />
                        <Input 
                          dark 
                          placeholder="الرابط (URL)" 
                          value={newLink.url} 
                          onChange={(e) => setNewLink({...newLink, url: e.target.value})} 
                          className="flex-1"
                          disabled={!isEditing}
                        />
                        <Button onClick={addLink} icon={Plus} disabled={!isEditing}>إضافة</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {links
                          .filter(l => ![
                            "رابط المتجر",
                            "رابط الفيس بوك",
                            "رابط انستجرام",
                            "رابط تيكتوك",
                            "رابط سناب شات"
                          ].includes(l.title))
                          .map((link, idx) => (
                            <div key={idx} className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex items-center justify-between group">
                               <div className="flex items-center gap-3">
                                  <ExternalLink size={18} className="text-sky-400" />
                                  <div>
                                    <p className="text-sm font-bold text-white">{link.title}</p>
                                    <p className="text-[10px] text-slate-500 font-mono truncate max-w-xs">{link.url}</p>
                                  </div>
                               </div>
                               {isEditing && (
                                  <button onClick={() => setLinks(links.filter(l => l !== link))} className="p-2 text-slate-600 hover:text-red-400">
                                     <Trash2 size={16} />
                                  </button>
                               )}
                            </div>
                          ))}
                      </div>
                   </div>
                </div>
              )}
            </div>
        </div>

        {/* Log Sidebar Panel */}
        <AnimatePresence>
          {showLogSidebar && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="w-96 bg-[#020617] border-r border-white/10 p-6 flex flex-col h-full shadow-2xl relative z-20"
            >
               <div className="flex items-center justify-between mb-8">
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <History size={20} className="text-sky-400" />
                    سجل التعديلات
                  </h4>
                  <button onClick={() => setShowLogSidebar(false)} className="text-slate-500 hover:text-white">
                    <ChevronLeft size={24} />
                  </button>
               </div>

               <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                 {["ALL", "SALES", "CR", "MARKETING"].map(f => (
                   <button
                    key={f}
                    onClick={() => setLogFilter(f as any)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap border transition-all",
                      logFilter === f 
                        ? "bg-sky-500/20 text-sky-400 border-sky-500/30" 
                        : "bg-white/5 text-slate-500 border-transparent hover:text-slate-300"
                    )}
                   >
                     {f === "ALL" ? "الكل" : f}
                   </button>
                 ))}
               </div>

               <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                  {[...filteredLogs].reverse().map((log, idx) => (
                    <div key={idx} className="space-y-3 pb-6 border-b border-white/[0.05] last:border-0">
                       <div className="flex justify-between items-start">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest",
                            log.department === "SALES" ? "bg-green-500/10 text-green-400" : 
                            log.department === "CR" ? "bg-sky-500/10 text-sky-400" : 
                            "bg-purple-500/10 text-purple-400"
                          )}>
                            {log.department}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(log.date).toLocaleDateString('ar-SA')}</span>
                       </div>
                       <p className="text-xs font-bold text-white leading-relaxed">{log.action}</p>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-600 uppercase">الحقول:</p>
                          <div className="flex flex-wrap gap-1">
                             {log.updatedFields.map(f => (
                               <span key={f} className="text-[8px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                                 {FIELD_TRANSLATIONS[f] || f}
                               </span>
                             ))}
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-2 mt-4">
                          <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-700 uppercase">قبل</p>
                             <div className="text-[10px] text-slate-500 truncate bg-black/20 p-2 rounded border border-white/5">
                                {formatLogValue(log.oldValue)}
                             </div>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[8px] font-black text-sky-900 uppercase">بعد</p>
                             <div className="text-[10px] text-sky-400 truncate bg-sky-500/5 p-2 rounded border border-sky-500/10">
                                {formatLogValue(log.newValue)}
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                       <p className="text-slate-600 text-xs font-black uppercase tracking-widest">لا يوجد تعديلات مسجلة</p>
                    </div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};
