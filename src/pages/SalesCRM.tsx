import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  UserPlus, 
  Save, 
  Trash2, 
  Edit3,
  Link2,
  TrendingUp,
  DollarSign,
  Users as UsersIcon,
  Search,
  Filter
} from "lucide-react";
import { Card, Tabs, Input, Select, Button } from "@/src/components/UI";
import { useSettings } from "@/src/hooks/useSettings";
import { useClients } from "@/src/hooks/useClients";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ClientStage, Client } from "@/src/types";
import { cn, generateClientCode, calculateMonths, formatCurrency } from "@/src/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";

import { ClientDetailsModal } from "@/src/components/ClientDetailsModal";

// --- Tab 1: Client Entry ---
const ClientEntryTab: React.FC<{ settings: any, clients: Client[], onSuccess?: () => void }> = ({ settings, clients, onSuccess }) => {
  const { addClient } = useClients();
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    contractAmount: 0,
    currency: "SAR",
    paymentMethod: "",
    paidAmount: 0,
    clientName: "",
    phone: "",
    additionalPhone: "",
    email: "",
    businessName: "",
    websiteStatus: "not_available" as any,
    websiteUrl: "",
    additionalStore: "",
    // Social Links
    storeLink: "",
    facebookLink: "",
    instagramLink: "",
    tiktokLink: "",
    snapchatLink: "",
    salesBrief: "",
    serviceType: "",
    cso: "",
    salesManager: "",
    salesAgent: "",
    teleSalesManager: "",
    teleSalesAgent: "",
  });

  const [dateType, setDateType] = useState("today");
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    if (dateType === "today") setFormData(prev => ({ ...prev, startDate: new Date().toISOString().split('T')[0] }));
    else if (dateType === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setFormData(prev => ({ ...prev, startDate: d.toISOString().split('T')[0] }));
    } else if (dateType === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setFormData(prev => ({ ...prev, startDate: d.toISOString().split('T')[0] }));
    } else if (dateType === "custom") {
      setFormData(prev => ({ ...prev, startDate: customDate }));
    }
  }, [dateType, customDate]);

  const remainingAmount = formData.contractAmount - formData.paidAmount;
  const contractMonths = (formData.startDate && formData.endDate) ? calculateMonths(formData.startDate, formData.endDate) : 1;
  const monthlyValue = formData.contractAmount / contractMonths;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.phone || formData.contractAmount <= 0) {
      alert("الرجاء ملء الحقول المطلوبة (اسم العميل، رقم الهاتف، مبلغ التعاقد)");
      return;
    }

    try {
      const clientCode = generateClientCode(clients.length);
      const newClient = {
        clientCode,
        stage: ClientStage.SALES_RECEIVED,
        contract: {
          startDate: formData.startDate,
          endDate: formData.endDate,
          contractAmount: Number(formData.contractAmount),
          currency: formData.currency,
          paymentMethod: formData.paymentMethod,
          paidAmount: Number(formData.paidAmount),
          remainingAmount: Number(remainingAmount),
          contractMonths,
          monthlyValue,
        },
        clientInfo: {
          clientName: formData.clientName,
          phone: formData.phone,
          additionalPhone: formData.additionalPhone,
          email: formData.email,
          businessName: formData.businessName,
          websiteStatus: formData.websiteStatus,
          websiteUrl: formData.websiteUrl,
          additionalStore: formData.additionalStore,
          salesBrief: formData.salesBrief,
          serviceType: formData.serviceType,
        },
        salesTeam: {
          cso: formData.cso,
          salesManager: formData.salesManager,
          salesAgent: formData.salesAgent,
          teleSalesManager: formData.teleSalesManager,
          teleSalesAgent: formData.teleSalesAgent,
        },
        importantLinks: [
          { title: "رابط المتجر", url: formData.storeLink },
          { title: "رابط الفيس بوك", url: formData.facebookLink },
          { title: "رابط انستجرام", url: formData.instagramLink },
          { title: "رابط تيكتوك", url: formData.tiktokLink },
          { title: "رابط سناب شات", url: formData.snapchatLink },
        ].filter(l => l.url),
        updateLog: [{
          date: new Date().toISOString(),
          action: "تم تسجيل العميل وتوزيع المهام",
          updatedFields: ["clientInfo", "contract", "salesTeam"],
          oldValue: null,
          newValue: {
            clientName: formData.clientName,
            businessName: formData.businessName,
            contractAmount: Number(formData.contractAmount)
          },
          department: "SALES" as const
        }],
      };

      await addClient(newClient);
      
      // Reset form
      setFormData({
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        contractAmount: 0,
        currency: "SAR",
        paymentMethod: "",
        paidAmount: 0,
        clientName: "",
        phone: "",
        additionalPhone: "",
        email: "",
        businessName: "",
        websiteStatus: "not_available",
        websiteUrl: "",
        additionalStore: "",
        storeLink: "",
        facebookLink: "",
        instagramLink: "",
        tiktokLink: "",
        snapchatLink: "",
        salesBrief: "",
        serviceType: "",
        cso: "",
        salesManager: "",
        salesAgent: "",
        teleSalesManager: "",
        teleSalesAgent: "",
      });

      // Simple success feedback
      const toast = document.createElement("div");
      toast.className = "fixed bottom-8 right-8 bg-green-500 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4 font-bold text-lg";
      toast.innerText = "تم تسجيل العميل بنجاح";
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("animate-out", "fade-out", "slide-out-to-bottom-4");
        setTimeout(() => toast.remove(), 500);
      }, 3000);

      if (onSuccess) onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "clients");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Financial Section */}
        <Card glass className="p-10 relative group overflow-hidden border-white/[0.05]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-3xl rounded-full" />
          <h3 className="text-2xl font-black mb-8 text-white flex items-center gap-3">
            <DollarSign className="text-sky-400" />
            بيانات التعاقد والماليات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">تاريخ بداية التعاقد</label>
              <div className="flex gap-3">
                 <Select dark value={dateType} onChange={(e) => setDateType(e.target.value)} className="w-1/2">
                    <option value="yesterday">أمس</option>
                    <option value="today">اليوم</option>
                    <option value="tomorrow">غدًا</option>
                    <option value="custom">تاريخ محدد</option>
                 </Select>
                 {dateType === "custom" && (
                   <Input dark type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="w-1/2" />
                 )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">تاريخ نهاية التعاقد</label>
              <Input dark type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} required />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">مبلغ التعاقد</label>
              <div className="flex gap-3">
                <Input dark type="number" placeholder="المبلغ" value={formData.contractAmount} onChange={(e) => setFormData({...formData, contractAmount: Number(e.target.value)})} required />
                <Select dark value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-1/3">
                  {settings.currencies.map((c: any) => <option key={c.id} value={c.name} className="bg-[#020617]">{c.name}</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</label>
              <Select dark value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} required>
                <option value="" className="bg-[#020617]">اختر الطريقة</option>
                {settings.paymentMethods.map((p: any) => <option key={p.id} value={p.name} className="bg-[#020617]">{p.name}</option>)}
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">ما تم دفعه</label>
              <Input dark type="number" value={formData.paidAmount} onChange={(e) => setFormData({...formData, paidAmount: Number(e.target.value)})} />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">المتبقي</label>
              <Input dark type="number" value={remainingAmount} disabled className="bg-red-500/5 border-red-500/20 text-red-400 font-black" />
            </div>
          </div>
          
          <div className="mt-10 p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] flex justify-between items-center group-hover:bg-white/[0.04] transition-all">
             <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
               <span className="text-sm text-slate-300 font-bold">مدة التعاقد: {contractMonths} شهر</span>
             </div>
             <div className="flex items-center gap-3">
               <span className="text-sm text-sky-400 font-black">القيمة الشهرية: {formatCurrency(monthlyValue, formData.currency)}</span>
             </div>
          </div>
        </Card>

        {/* Client Info Section */}
        <Card glass className="p-10 relative group overflow-hidden border-white/[0.05]">
          <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full" />
          <h3 className="text-2xl font-black mb-8 text-white flex items-center gap-3">
            <UserPlus className="text-sky-400" />
            بيانات العميل
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم العميل</label>
              <Input dark value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} placeholder="الاسم الكامل" required />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</label>
              <Input dark value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="00966..." required />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رقم هاتف إضافي (اختياري)</label>
              <Input dark value={formData.additionalPhone} onChange={(e) => setFormData({...formData, additionalPhone: e.target.value})} placeholder="00966..." />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">الإيميل</label>
              <Input dark type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="example@mail.com" />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">اسم البيزنس / المتجر</label>
              <Input dark value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} placeholder="اسم النشاط التجاري" />
            </div>
            <div className="space-y-3 md:col-span-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رابط الموقع / المتجر</label>
              <div className="flex gap-3">
                <Select dark value={formData.websiteStatus} onChange={(e) => setFormData({...formData, websiteStatus: e.target.value})} className="w-1/3">
                  <option value="exists" className="bg-[#020617]">موجود</option>
                  <option value="create" className="bg-[#020617]">إنشاء</option>
                  <option value="not_available" className="bg-[#020617]">غير متوفر</option>
                </Select>
                {formData.websiteStatus === "exists" && (
                  <Input dark value={formData.websiteUrl} onChange={(e) => setFormData({...formData, websiteUrl: e.target.value})} placeholder="https://..." className="flex-1" />
                )}
                {formData.websiteStatus === "create" && (
                   <div className="flex-1 flex items-center px-6 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-2xl text-sm font-black">
                     يحتاج إنشاء موقع/متجر
                   </div>
                )}
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">رابط الموقع / المتجر الإضافي (اختياري)</label>
              <Input dark value={formData.additionalStore || ""} onChange={(e) => setFormData({...formData, additionalStore: e.target.value})} placeholder="https://..." />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">نوع الخدمة / الاشتراك</label>
              <Select dark value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} required>
                <option value="" className="bg-[#020617]">اختر الخدمة</option>
                {settings.serviceTypes.map((s: any) => <option key={s.id} value={s.name} className="bg-[#020617]">{s.name}</option>)}
              </Select>
            </div>
          </div>
          
          <div className="mt-10 pt-10 border-t border-white/[0.05] space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
               <Link2 className="text-sky-400" />
               الروابط المهمة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "رابط المتجر", key: "storeLink" },
                { label: "رابط الفيس بوك", key: "facebookLink" },
                { label: "رابط انستجرام", key: "instagramLink" },
                { label: "رابط تيكتوك", key: "tiktokLink" },
                { label: "رابط سناب شات", key: "snapchatLink" },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">{field.label}</label>
                  <Input 
                    dark 
                    value={(formData as any)[field.key]} 
                    onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} 
                    placeholder="https://..." 
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Sales Team Section */}
        <Card glass className="p-10 lg:col-span-2 relative group overflow-hidden border-white/[0.05]">
          <h3 className="text-2xl font-black mb-10 text-white flex items-center gap-3 border-r-4 border-sky-500 pr-5">
            بيانات فريق السيلز و التيلي سيلز
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8">
            {[
              { label: "CSO", key: "cso", settingsKey: "csoList" },
              { label: "Sales Manager", key: "salesManager", settingsKey: "salesManagers" },
              { label: "Sales Agent", key: "salesAgent", settingsKey: "salesAgents" },
              { label: "Tele Sales Manager", key: "teleSalesManager", settingsKey: "teleSalesManagers" },
              { label: "Tele Sales Agent", key: "teleSalesAgent", settingsKey: "teleSalesAgents" },
            ].map((field) => (
              <div key={field.key} className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{field.label}</label>
                <Select 
                  dark 
                  value={(formData as any)[field.key]} 
                  onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                >
                  <option value="" className="bg-[#020617]">اختر</option>
                  {(settings as any)[field.settingsKey]?.map((i: any) => <option key={i.id} value={i.name} className="bg-[#020617]">{i.name}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-10 space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">بريف السيلز (Sales Brief)</label>
              <textarea 
                className="w-full h-40 rounded-3xl border border-white/[0.08] bg-white/[0.03] text-white p-6 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all placeholder:text-slate-600 leading-relaxed font-medium"
                placeholder="أدخل بريف السيلز هنا بكل التفاصيل الهامة..."
                value={formData.salesBrief}
                onChange={(e) => setFormData({...formData, salesBrief: e.target.value})}
              />
          </div>
          <div className="mt-12 flex justify-center">
            <Button 
              type="submit" 
              className="h-20 px-16 text-xl rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-[0_10px_40px_rgba(2,132,199,0.3)] border-none group transition-all duration-500"
            >
               <UserPlus className="ml-3 group-hover:scale-110 transition-transform" size={24} />
               تسليم العميل إلى Account Manager
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
};

// --- Tab 2: Clients List ---
const ClientListTab: React.FC<{ clients: Client[], onClientClick: (client: Client) => void }> = ({ clients, onClientClick }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(c => 
    c.clientInfo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientInfo.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Card glass className="p-8 border-white/[0.05]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <h3 className="text-2xl font-black text-white">قائمة جميع العملاء</h3>
          <div className="relative w-full md:w-[400px]">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <Input 
               dark
               placeholder="البحث بالاسم، الكود، أو اسم البيزنس..." 
               className="pr-12 bg-white/[0.02]"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-separate border-spacing-y-3">
            <thead>
              <tr className="text-slate-500 uppercase tracking-widest text-[10px] font-black">
                <th className="pb-4 px-6">كود العميل</th>
                <th className="pb-4 px-6">اسم العميل</th>
                <th className="pb-4 px-6">البيزنس</th>
                <th className="pb-4 px-6 text-center">مبلغ التعاقد</th>
                <th className="pb-4 px-6 text-center">المحصل</th>
                <th className="pb-4 px-6">الحالة</th>
                <th className="pb-4 px-6">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.clientCode} className="group hover:scale-[1.01] transition-all duration-300">
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-r border-white/[0.05] rounded-r-2xl text-sm font-mono font-bold">
                    <button 
                      onClick={() => onClientClick(c)}
                      className="text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      {c.clientCode}
                    </button>
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-white/[0.05] text-sm font-bold text-white">
                    {c.clientInfo.clientName}
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-white/[0.05] text-sm text-slate-400">
                    {c.clientInfo.businessName || "—"}
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-white/[0.05] text-sm font-black text-white text-center">
                    {formatCurrency(c.contract.contractAmount, c.contract.currency)}
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-white/[0.05] text-sm font-black text-green-400 text-center">
                    {formatCurrency(c.contract.paidAmount, c.contract.currency)}
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-white/[0.05]">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                      c.stage === ClientStage.SALES_RECEIVED ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" : "bg-white/5 text-slate-400 border border-white/10"
                    )}>
                      {c.stage}
                    </span>
                  </td>
                  <td className="py-5 px-6 bg-white/[0.02] border-y border-l border-white/[0.05] rounded-l-2xl text-sm text-slate-500">
                    {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-32 text-center text-slate-500 font-bold italic">
                    <div className="flex flex-col items-center gap-4">
                       <Search size={48} className="opacity-10" />
                       لا يوجد عملاء مطابقين للبحث
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// --- Tab 3: Sales Settings ---
const SettingsItemEditor: React.FC<{ title: string, docId: string, items: any[] }> = ({ title, docId, items }) => {
  const [newValue, setNewValue] = useState("");
  
  const handleAdd = async () => {
    if (!newValue) return;
    try {
      const updatedItems = [...items, { id: Date.now().toString(), name: newValue }];
      await setDoc(doc(db, "settings", docId), { items: updatedItems });
      setNewValue("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/${docId}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const updatedItems = items.filter(i => i.id !== id);
      await setDoc(doc(db, "settings", docId), { items: updatedItems });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `settings/${docId}`);
    }
  };

  return (
    <Card glass className="p-8 border-white/[0.05] group">
      <h4 className="font-black text-white mb-6 border-r-4 border-sky-500 pr-4">{title}</h4>
      <div className="flex gap-3 mb-6">
        <Input dark placeholder="إضافة جديد..." value={newValue} onChange={(e) => setNewValue(e.target.value)} />
        <Button onClick={handleAdd} size="sm" className="h-12 w-12 p-0 shrink-0 bg-sky-500 hover:bg-sky-400">
           <Plus size={20} />
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-3 custom-scrollbar pr-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl group/item hover:bg-white/[0.05] transition-all">
             <span className="text-sm font-bold text-slate-300">{item.name}</span>
             <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all border border-transparent hover:border-red-500/10">
               <Trash2 size={16} />
             </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-500 text-center py-8 font-bold italic">لا توجد بيانات مسجلة</p>}
      </div>
    </Card>
  );
};

const SalesSettingsTab: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-500">
      <SettingsItemEditor title="أنواع الخدمة / الاشتراك" docId="serviceTypes" items={settings.serviceTypes} />
      <SettingsItemEditor title="طرق الدفع" docId="paymentMethods" items={settings.paymentMethods} />
      <SettingsItemEditor title="العملات" docId="currencies" items={settings.currencies} />
      <SettingsItemEditor title="فريق CSO" docId="csoList" items={settings.csoList} />
      <SettingsItemEditor title="مدراء المبيعات" docId="salesManagers" items={settings.salesManagers} />
      <SettingsItemEditor title="موظفي المبيعات" docId="salesAgents" items={settings.salesAgents} />
      <SettingsItemEditor title="مدراء التيلي سيلز" docId="teleSalesManagers" items={settings.teleSalesManagers} />
      <SettingsItemEditor title="موظفي التيلي سيلز" docId="teleSalesAgents" items={settings.teleSalesAgents} />
      
      <Card glass className="p-10 lg:col-span-2 border-white/[0.05] relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-3xl rounded-full" />
         <h4 className="font-black text-2xl text-white mb-6">إعدادات عمولة الفريق</h4>
         <p className="text-slate-400 mb-8 leading-relaxed font-medium">هذا القسم مخصص للتحكم الكامل في نسب العمولات لكل دور وظيفي. النظام حالياً في مرحلة الربط البرمجي المتقدم لضمان دقة العمليات.</p>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-3xl flex flex-col items-center justify-center text-center gap-3">
               <TrendingUp className="text-sky-500 opacity-20" size={40} />
               <span className="text-slate-500 font-black text-xs uppercase tracking-widest">تتبع الأداء</span>
            </div>
            <div className="p-6 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-3xl flex flex-col items-center justify-center text-center gap-3">
               <DollarSign className="text-sky-500 opacity-20" size={40} />
               <span className="text-slate-500 font-black text-xs uppercase tracking-widest">التحصيل المالي</span>
            </div>
         </div>

         <div className="mt-8 text-center">
            <span className="inline-block px-6 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-xs font-black animate-pulse uppercase tracking-widest">
               قيد التطوير - Coming Soon
            </span>
         </div>
      </Card>
    </div>
  );
};

// --- Tab 3: Dashboard ---
const SalesDashboardTab: React.FC<{ clients: Client[], onClientClick: (client: Client) => void }> = ({ clients, onClientClick }) => {
  const totalSales = clients.reduce((sum, c) => sum + c.contract.contractAmount, 0);
  const totalPaid = clients.reduce((sum, c) => sum + c.contract.paidAmount, 0);
  const totalRemaining = totalSales - totalPaid;
  const clientCount = clients.length;
  const avgClientValue = clientCount > 0 ? totalSales / clientCount : 0;

  // Monthly Average
  const totalMonthlyValue = clients.reduce((sum, c) => sum + (c.contract.monthlyValue || 0), 0);
  const avgMonthlyValue = clientCount > 0 ? totalMonthlyValue / clientCount : 0;

  const summaryCards = [
    { label: "إجمالي المبيعات", value: formatCurrency(totalSales), icon: DollarSign, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    { label: "إجمالي المبيعات المحصلة", value: formatCurrency(totalPaid), icon: TrendingUp, color: "bg-green-500/10 text-green-400 border-green-500/20" },
    { label: "إجمالي المبيعات المتبقية", value: formatCurrency(totalRemaining), icon: DollarSign, color: "bg-red-500/10 text-red-400 border-red-500/20" },
    { label: "عدد العملاء", value: clientCount, icon: UsersIcon, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    { label: "متوسط قيمة العميل", value: formatCurrency(avgClientValue), icon: TrendingUp, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    { label: "متوسط العملاء الشهري", value: formatCurrency(avgMonthlyValue), icon: BarChart, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  ];

  // Data for Charts
  const salesByAgent = clients.reduce((acc: any, client) => {
    const agent = client.salesTeam.salesAgent || "غير محدد";
    acc[agent] = (acc[agent] || 0) + client.contract.contractAmount;
    return acc;
  }, {});

  const chartData = Object.keys(salesByAgent).map(agent => ({
    name: agent,
    sales: salesByAgent[agent]
  }));

  const COLORS = ['#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#818cf8'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {summaryCards.map((card, i) => (
          <Card key={i} glass className={cn("p-6 flex flex-col items-center gap-4 group hover:scale-105 transition-all duration-500 border-white/[0.05]", card.color)}>
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", card.color, "bg-white/[0.05] border-white/[0.1]")}>
              <card.icon size={28} className="group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{card.label}</p>
              <p className="text-xl font-black text-white">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card glass className="p-10 border-white/[0.05]">
          <h3 className="text-xl font-black mb-8 text-white flex items-center gap-3">
             <BarChart className="text-sky-400" />
             المبيعات حسب Sales Agent
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="sales" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} barSize={44}>
                   <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stopColor="#38bdf8" />
                         <stop offset="100%" stopColor="#0284c7" />
                      </linearGradient>
                   </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card glass className="p-10 border-white/[0.05]">
          <h3 className="text-xl font-black mb-8 text-white flex items-center gap-3">
             <PieChart className="text-sky-400" />
             توزيع المبيعات
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  fill="#8884d8"
                  paddingAngle={8}
                  dataKey="sales"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card glass className="p-10 border-white/[0.05]">
        <h3 className="text-xl font-black mb-10 text-white flex items-center justify-between">
           آخر العملاء المسجلين
           <Button size="sm" className="bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10">مشاهدة الكل</Button>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-white/[0.05] text-slate-500 text-[11px] font-black uppercase tracking-widest">
                <th className="pb-6 px-4">البوزيشن</th>
                <th className="pb-6 px-4">الاسم</th>
                <th className="pb-6 px-4">إجمالي المبيعات</th>
                <th className="pb-6 px-4">المحصل</th>
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map((c, i) => (
                <tr key={i} className="group hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => onClientClick(c)}>
                  <td className="py-5 px-4 text-sm font-black text-slate-500">{c.salesTeam.salesAgent || "غير محدد"}</td>
                  <td className="py-5 px-4 text-sm font-black text-white group-hover:text-sky-400 transition-colors">{c.clientInfo.clientName}</td>
                  <td className="py-5 px-4 text-sm font-black text-sky-400">{formatCurrency(c.contract.contractAmount, c.contract.currency)}</td>
                  <td className="py-5 px-4 text-sm font-black text-green-400">{formatCurrency(c.contract.paidAmount, c.contract.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export const SalesCRMPage: React.FC<{ section?: string, setSection?: (s: string) => void }> = ({ section = "main", setSection }) => {
  const [activeTab, setActiveTab] = useState("entry");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { settings, loading: settingsLoading } = useSettings();
  const { clients, loading: clientsLoading } = useClients();

  useEffect(() => {
    if (section === "reports") setActiveTab("dashboard");
    else if (section === "settings") setActiveTab("settings");
    else if (section === "main" && (activeTab === "dashboard" || activeTab === "settings")) {
      setActiveTab("entry");
    }
  }, [section]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (!setSection) return;
    
    if (tab === "dashboard") setSection("reports");
    else if (tab === "settings") setSection("settings");
    else setSection("main");
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setIsDetailsModalOpen(true);
  };

  const tabs = [
    { id: "entry", label: "تسجيل عميل جديد ✍️", icon: UserPlus },
    { id: "list", label: "دفتر وكلائنا وعملائنا 📁", icon: UsersIcon },
    { id: "settings", label: "ظبط مكنة السيلز ⚙️", icon: SettingsIcon },
    { id: "dashboard", label: "لوحة الأرقام والتقارير 📊", icon: LayoutDashboard },
  ];

  if (settingsLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            لوحة المبيعات (Sales CRM) 📈
          </h1>
          <p className="text-slate-400 font-medium">تابع عقود عملاؤك، دفعاتهم، وعمولات الفريق بكل روقان وسهولة</p>
        </div>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} dark className="bg-white/[0.02]" />
      </div>

      <div className="relative z-10 transition-all duration-500">
        {activeTab === "entry" && <ClientEntryTab settings={settings} clients={clients} onSuccess={() => setActiveTab("list")} />}
        {activeTab === "list" && <ClientListTab clients={clients} onClientClick={handleClientClick} />}
        {activeTab === "settings" && <SalesSettingsTab settings={settings} />}
        {activeTab === "dashboard" && <SalesDashboardTab clients={clients} onClientClick={handleClientClick} />}
      </div>

      <ClientDetailsModal 
        client={selectedClient}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        settings={settings}
        mode="sales"
      />
    </div>
  );
};
