import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Send, 
  Settings as SettingsIcon, 
  Layers, 
  History, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon, 
  User, 
  Phone,
  Clock,
  Check,
  ShieldAlert,
  Megaphone,
  HelpCircle,
  TrendingUp,
  Sliders,
  Sparkles
} from "lucide-react";
import { db } from "@/src/lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from "firebase/firestore";
import { Card, Input, Select, Button, Modal, Tabs } from "@/src/components/UI";
import { useTelesalesLeads } from "@/src/hooks/useTelesalesLeads";
import { useSalesLeads } from "@/src/hooks/useSalesLeads";
import { useSettings } from "@/src/hooks/useSettings";
import { cn } from "@/src/lib/utils";
import axios from "axios";

// Standard Arabic RTL Localization Dictionary
const AR_STATUS_MAP: Record<string, string> = {
  pending: "قيد الانتظار",
  sending: "جاري الإرسال",
  paused: "متوقف مؤقتاً",
  completed: "مكتملة",
  sent: "تم الإرسال",
  failed: "فشل الإرسال"
};

export default function WhatsAppAutomation() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Global settings states
  const [apiUrl, setApiUrl] = useState<string>("https://wasenderapi.com/api/send-message");
  const [apiToken, setApiToken] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [connected, setConnected] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string>("");

  // Firestore collections states
  const [templates, setTemplates] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Form states - Template
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>("");
  const [tempType, setTempType] = useState<string>("text");
  const [tempContent, setTempContent] = useState<string>("");
  const [tempMediaUrl, setTempMediaUrl] = useState<string>("");
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);

  // Form states - Rule
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);
  const [ruleEditingId, setRuleEditingId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState<string>("");
  const [ruleTrigger, setRuleTrigger] = useState<string>("status_change_telesales");
  const [ruleTriggerValue, setRuleTriggerValue] = useState<string>("");
  const [ruleTemplateId, setRuleTemplateId] = useState<string>("");
  const [ruleDelayMinutes, setRuleDelayMinutes] = useState<number>(0);
  const [savingRule, setSavingRule] = useState<boolean>(false);

  // Form states - Campaign
  const [showCampaignModal, setShowCampaignModal] = useState<boolean>(false);
  const [campName, setCampName] = useState<string>("");
  const [campTarget, setCampTarget] = useState<string>("telesales");
  const [campFilterStatus, setCampFilterStatus] = useState<string>("جميع الحالات");
  const [campTemplateId, setCampTemplateId] = useState<string>("");
  const [campMessageText, setCampMessageText] = useState<string>("");
  const [campDelaySeconds, setCampDelaySeconds] = useState<number>(5);
  const [creatingCampaign, setCreatingCampaign] = useState<boolean>(false);

  // Leads for Campaigns
  const { leads: telesalesLeads, loading: loadingTelesales } = useTelesalesLeads();
  const { leads: salesLeads, loading: loadingSales } = useSalesLeads();
  const { settings: crmSettings } = useSettings();

  // Search/Filters inside tabs
  const [logSearch, setLogSearch] = useState<string>("all"); // 'all', 'sent', 'failed', 'pending', 'automation'
  const [templateSearch, setTemplateSearch] = useState<string>("");

  // Load WhatsApp credentials
  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await axios.get("/api/whatsapp/settings/get");
      if (res.data) {
        setApiUrl(res.data.apiUrl || "https://wasenderapi.com/api/send-message");
        setApiToken(res.data.apiToken || "");
        setPhoneNumber(res.data.phoneNumber || "");
        setActive(res.data.active !== undefined ? res.data.active : true);
        setConnected(res.data.connected || false);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Real-time Firestore subscriptions for templates, rules, campaigns, logs
  useEffect(() => {
    loadSettings();

    const unsubTemplates = onSnapshot(collection(db, "whatsapp_templates"), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setTemplates(list);
    });

    const unsubRules = onSnapshot(collection(db, "whatsapp_rules"), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setRules(list);
    });

    const unsubCampaigns = onSnapshot(
      query(collection(db, "whatsapp_campaigns"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: any[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setCampaigns(list);
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "whatsapp_logs"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: any[] = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setLogs(list);
        setLoadingData(false);
      }
    );

    return () => {
      unsubTemplates();
      unsubRules();
      unsubCampaigns();
      unsubLogs();
    };
  }, []);

  // Save Settings handler
  const handleSaveSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await axios.post("/api/whatsapp/settings/save", {
        apiUrl,
        apiToken,
        phoneNumber,
        active
      });
      if (res.data.success) {
        setConnected(res.data.settings.connected);
        alert("تم حفظ إعدادات الواتساب بنجاح! 🎉");
      }
    } catch (err: any) {
      alert("فشل حفظ الإعدادات: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingSettings(false);
    }
  };

  // Test Connection handler
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage("");
    try {
      const res = await axios.post("/api/whatsapp/test-connection", {
        apiUrl,
        apiToken
      });
      if (res.data.success) {
        setConnected(true);
        setConnectionMessage("اتصال بالخدمة فعال ومصادق عليه بنجاح! ✅");
      } else {
        setConnected(false);
        setConnectionMessage("فشل التحقق من الخدمة ❌");
      }
    } catch (err: any) {
      setConnected(false);
      setConnectionMessage("فشل الاتصال بالـ API: " + (err.response?.data?.error || err.message));
    } finally {
      setTestingConnection(false);
    }
  };

  // Save/Update Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !tempContent) {
      alert("الرجاء ملء اسم القالب ومحتواه");
      return;
    }

    setSavingTemplate(true);
    try {
      const templateData = {
        name: tempName,
        type: tempType,
        content: tempContent,
        mediaUrl: tempMediaUrl || "",
        createdAt: new Date().toISOString()
      };

      if (templateEditingId) {
        await setDoc(doc(db, "whatsapp_templates", templateEditingId), templateData, { merge: true });
      } else {
        const docRef = doc(collection(db, "whatsapp_templates"));
        await setDoc(docRef, { id: docRef.id, ...templateData });
      }

      setShowTemplateModal(false);
      setTemplateEditingId(null);
      setTempName("");
      setTempType("text");
      setTempContent("");
      setTempMediaUrl("");
    } catch (err: any) {
      alert("خطأ أثناء حفظ القالب: " + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا القالب؟")) return;
    try {
      await deleteDoc(doc(db, "whatsapp_templates", id));
    } catch (err: any) {
      alert("فشل الحذف: " + err.message);
    }
  };

  // Set Template form for editing
  const handleEditTemplate = (tmpl: any) => {
    setTemplateEditingId(tmpl.id);
    setTempName(tmpl.name);
    setTempType(tmpl.type);
    setTempContent(tmpl.content);
    setTempMediaUrl(tmpl.mediaUrl || "");
    setShowTemplateModal(true);
  };

  // Save/Update Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleTriggerValue || !ruleTemplateId) {
      alert("الرجاء ملء اسم القاعدة، قيمة التفعيل، وتحديد القالب");
      return;
    }

    setSavingRule(true);
    try {
      const ruleData = {
        name: ruleName,
        trigger: ruleTrigger,
        triggerValue: ruleTriggerValue,
        templateId: ruleTemplateId,
        delayMinutes: Number(ruleDelayMinutes) || 0,
        active: true,
        createdAt: new Date().toISOString()
      };

      if (ruleEditingId) {
        await setDoc(doc(db, "whatsapp_rules", ruleEditingId), ruleData, { merge: true });
      } else {
        const docRef = doc(collection(db, "whatsapp_rules"));
        await setDoc(docRef, { id: docRef.id, ...ruleData });
      }

      setShowRuleModal(false);
      setRuleEditingId(null);
      setRuleName("");
      setRuleTrigger("status_change_telesales");
      setRuleTriggerValue("");
      setRuleTemplateId("");
      setRuleDelayMinutes(0);
    } catch (err: any) {
      alert("خطأ أثناء حفظ القاعدة: " + err.message);
    } finally {
      setSavingRule(false);
    }
  };

  // Toggle Rule active status
  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, "whatsapp_rules", ruleId), { active: !currentActive });
    } catch (err: any) {
      alert("خطأ أثناء تعديل حالة القاعدة: " + err.message);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف قاعدة الأتمتة هذه؟")) return;
    try {
      await deleteDoc(doc(db, "whatsapp_rules", id));
    } catch (err: any) {
      alert("فشل الحذف: " + err.message);
    }
  };

  // Status triggers list helper based on trigger department selection
  const triggerStatusOptions = useMemo(() => {
    if (ruleTrigger === "status_change_telesales") {
      return crmSettings.telesalesForm?.responseOptions || [
        "لم يتم الرد",
        "لا يرد",
        "مهتم",
        "غير مهتم",
        "مجدول",
        "تم التواصل",
        "رقم خاطئ",
        "واتساب فقط"
      ];
    } else {
      return crmSettings.salesForm?.responseOptions || [
        "تم استلام الليد",
        "جاري التواصل",
        "مهتم وجاري المتابعة",
        "تم تقديم عرض سعر",
        "تم التعاقد",
        "مستبعد"
      ];
    }
  }, [ruleTrigger, crmSettings]);

  // Campaign Contacts List matching chosen filters
  const campaignMatchingContacts = useMemo(() => {
    const rawList = campTarget === "telesales" ? telesalesLeads : salesLeads;
    if (!rawList) return [];

    // Filter by response option
    if (campFilterStatus === "جميع الحالات") {
      return rawList.map((l: any) => ({
        id: l.id,
        name: l.clientName || "ليد مجهول",
        phone: l.phone || ""
      })).filter(c => c.phone);
    }

    return rawList
      .filter((l: any) => l.response === campFilterStatus)
      .map((l: any) => ({
        id: l.id,
        name: l.clientName || "ليد مجهول",
        phone: l.phone || ""
      }))
      .filter(c => c.phone);
  }, [campTarget, campFilterStatus, telesalesLeads, salesLeads]);

  // Setup chosen template content inside Campaign Custom Text Box on selection
  useEffect(() => {
    if (campTemplateId) {
      const selectedTmpl = templates.find(t => t.id === campTemplateId);
      if (selectedTmpl) {
        setCampMessageText(selectedTmpl.content);
      }
    }
  }, [campTemplateId, templates]);

  // Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName || campaignMatchingContacts.length === 0 || !campMessageText) {
      alert("يرجى ملء اسم الحملة وتحديد قائمة مستهدفة غير فارغة ومحتوى الرسالة");
      return;
    }

    setCreatingCampaign(true);
    try {
      const selectedTmpl = templates.find(t => t.id === campTemplateId);
      const mediaUrl = selectedTmpl?.mediaUrl || "";

      const payload = {
        name: campName,
        target: campTarget,
        filterStatus: campFilterStatus,
        templateId: campTemplateId || null,
        templateName: selectedTmpl?.name || "قالب مخصص",
        messageText: campMessageText,
        delaySeconds: Number(campDelaySeconds) || 5,
        clients: campaignMatchingContacts,
        sentBy: "مدير أتمتة مدار",
        mediaUrl: mediaUrl || null
      };

      const res = await axios.post("/api/whatsapp/campaigns/create", payload);
      if (res.data.success) {
        alert("تم إنشاء حملة الواتساب بنجاح! يمكنك الآن بدؤها من اللوحة.");
        setShowCampaignModal(false);
        setCampName("");
        setCampTemplateId("");
        setCampMessageText("");
        setCampDelaySeconds(5);
        setCampFilterStatus("جميع الحالات");
      }
    } catch (err: any) {
      alert("فشل إنشاء الحملة: " + (err.response?.data?.error || err.message));
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Start Campaign Processing
  const handleStartCampaign = async (campaignId: string) => {
    try {
      const res = await axios.post(`/api/whatsapp/campaigns/${campaignId}/start`);
      if (res.data.success) {
        // Success
      }
    } catch (err: any) {
      alert("فشل بدء إرسال الحملة: " + (err.response?.data?.error || err.message));
    }
  };

  // Pause Campaign Processing
  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const res = await axios.post(`/api/whatsapp/campaigns/${campaignId}/pause`);
      if (res.data.success) {
        // Success
      }
    } catch (err: any) {
      alert("فشل إيقاف الحملة: " + (err.response?.data?.error || err.message));
    }
  };

  // Retry sending single failed message
  const handleRetryMessage = async (logItem: any) => {
    try {
      alert("جاري إعادة الإرسال...");
      const payload = {
        to: logItem.phone,
        text: logItem.message,
        clientName: logItem.clientName,
        templateId: logItem.templateId,
        templateName: logItem.templateName,
        type: logItem.type,
        sentBy: "إعادة إرسال نظامية"
      };

      const res = await axios.post("/api/whatsapp/send-message", payload);
      if (res.data.success) {
        alert("تمت إعادة الإرسال بنجاح! ✅");
      }
    } catch (err: any) {
      alert("فشلت إعادة الإرسال: " + (err.response?.data?.error || err.message));
    }
  };

  // Metrics calculators
  const metrics = useMemo(() => {
    const totalSent = logs.filter(l => l.status === "sent").length;
    const totalFailed = logs.filter(l => l.status === "failed").length;
    const activeCampsCount = campaigns.filter(c => c.status === "sending").length;
    const pendingCount = logs.filter(l => l.status === "pending").length;

    return {
      totalSent,
      totalFailed,
      activeCampsCount,
      pendingCount,
      templatesCount: templates.length,
      rulesCount: rules.length
    };
  }, [logs, campaigns, templates, rules]);

  // Log filtered results list
  const filteredLogs = useMemo(() => {
    if (logSearch === "all") return logs;
    if (logSearch === "sent") return logs.filter(l => l.status === "sent");
    if (logSearch === "failed") return logs.filter(l => l.status === "failed");
    if (logSearch === "pending") return logs.filter(l => l.status === "pending");
    if (logSearch === "automation") return logs.filter(l => l.type === "automation");
    return logs;
  }, [logs, logSearch]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    return templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.content.toLowerCase().includes(templateSearch.toLowerCase()));
  }, [templates, templateSearch]);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header with Title and Connection Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.05] pb-6">
        <div>
          <h2 className="text-3xl font-black text-white text-shadow-sky tracking-tight flex items-center gap-3">
            <MessageSquare size={32} className="text-sky-400 animate-pulse" />
            أتمتة الواتساب Automation
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 font-bold">
            نظام متكامل لإرسال الرسائل الفردية والجماعية والحملات التسويقية التلقائية عبر بوابة WasenderAPI.
          </p>
        </div>

        {/* Quick Active Indicator Card */}
        <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
          <div className="relative flex h-3 w-3">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              connected && active ? "bg-emerald-400" : "bg-red-400"
            )}></span>
            <span className={cn(
              "relative inline-flex rounded-full h-3 w-3",
              connected && active ? "bg-emerald-500" : "bg-red-500"
            )}></span>
          </div>
          <span className="text-xs font-bold text-slate-350">
            بوابة الإرسال: <strong className={connected && active ? "text-emerald-400" : "text-red-400"}>
              {connected && active ? "نشطة ومتصلة" : "غير متصلة / معطلة"}
            </strong>
          </span>
        </div>
      </div>

      {/* Tabs list */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        dark
        tabs={[
          { id: "dashboard", label: "لوحة التحكم والاستجابة", icon: Sparkles },
          { id: "campaigns", label: "الحملات الإعلانية الجماعية", icon: Megaphone },
          { id: "rules", label: "قواعد الأتمتة والتفعيل", icon: Sliders },
          { id: "templates", label: "قوالب الرسائل الجاهزة", icon: FileText },
          { id: "logs", label: "سجل الإرسال والتقارير", icon: History },
          { id: "settings", label: "إعدادات الربط والـ API", icon: SettingsIcon },
        ]}
      />

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Bento Grid Analytics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 bg-slate-950/20 border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">مرسلة بنجاح</p>
                      <h3 className="text-3xl font-black text-emerald-400 mt-2 font-mono">
                        {metrics.totalSent}
                      </h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={22} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-bold text-slate-400">رسائل تم تسليمها بنجاح للعملاء</div>
                </Card>

                <Card className="p-6 bg-slate-950/20 border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">فشل الإرسال</p>
                      <h3 className="text-3xl font-black text-rose-400 mt-2 font-mono">
                        {metrics.totalFailed}
                      </h3>
                    </div>
                    <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                      <XCircle size={22} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-bold text-slate-400">أرقام خاطئة أو أخطاء مصادقة</div>
                </Card>

                <Card className="p-6 bg-slate-950/20 border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">حملات نشطة الآن</p>
                      <h3 className="text-3xl font-black text-sky-400 mt-2 font-mono">
                        {metrics.activeCampsCount}
                      </h3>
                    </div>
                    <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
                      <Megaphone size={22} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-bold text-slate-400">حملات إرسال جماعي مستمرة بالخلفية</div>
                </Card>

                <Card className="p-6 bg-slate-950/20 border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">مجدولة بالانتظار</p>
                      <h3 className="text-3xl font-black text-amber-400 mt-2 font-mono">
                        {metrics.pendingCount}
                      </h3>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                      <Clock size={22} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-bold text-slate-400">رسائل أتمتة تنتظر فترات التأخير</div>
                </Card>
              </div>

              {/* Connection Status Panel & Quick Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Connection Status Box */}
                <Card className="p-8 lg:col-span-2 space-y-6 bg-slate-950/30 border-white/[0.08]">
                  <h4 className="text-lg font-black text-white text-shadow-sky flex items-center gap-2">
                    <ShieldAlert size={20} className="text-sky-450" />
                    حالة الربط الفنية للواتساب
                  </h4>

                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400">عنوان بوابة الإرسال الحالية</p>
                        <p className="text-sm font-mono font-bold text-sky-400 mt-1">{apiUrl}</p>
                      </div>
                      <div className="text-left">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-black border",
                          connected && active 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        )}>
                          {connected && active ? "متصل بالكامل" : "غير مسجل / معطل"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.04] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400">الرقم المربوط النشط</p>
                        <p className="text-sm font-bold text-slate-200 mt-1">{phoneNumber || "لم يتم تعيين رقم"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={handleTestConnection}
                          disabled={testingConnection}
                        >
                          {testingConnection ? "جاري الفحص..." : "فحص جودة الاتصال"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {connectionMessage && (
                    <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-400">
                      {connectionMessage}
                    </div>
                  )}
                </Card>

                {/* Quick Variable Reference */}
                <Card className="p-8 space-y-6 bg-slate-950/30 border-white/[0.08]">
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <Sliders size={20} className="text-sky-400" />
                    المتغيرات الديناميكية المدعومة
                  </h4>
                  <p className="text-xs text-slate-400 font-bold leading-relaxed">
                    يمكنك كتابة هذه الكلمات داخل القوالب والرسائل ليتم استبدالها بشكل تلقائي ببيانات العميل الحقيقية عند الإرسال:
                  </p>

                  <div className="space-y-3 font-mono">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                      <span className="text-slate-300 font-bold">اسم العميل</span>
                      <span className="text-sky-450 font-black">{"{clientName}"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                      <span className="text-slate-300 font-bold">اسم الموظف المسؤول</span>
                      <span className="text-sky-450 font-black">{"{agentName}"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                      <span className="text-slate-300 font-bold">موعد المقابلة (إن وُجد)</span>
                      <span className="text-sky-450 font-black">{"{meetingDate}"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 text-xs">
                      <span className="text-slate-300 font-bold">المبلغ المتبقي</span>
                      <span className="text-sky-450 font-black">{"{remainingAmount}"}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <div className="space-y-8">
              {/* Header inside Tab */}
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-5">
                <div>
                  <h3 className="text-xl font-black text-white">إرسال حملات الواتساب الجماعية Campaigns</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">أنشئ حملات إرسال جماعية لقوائم العملاء المصنفة حسب حالتهم مع فترات انتظار ذكية لمنع الحظر.</p>
                </div>
                <Button variant="primary" onClick={() => setShowCampaignModal(true)}>
                  <Plus size={18} />
                  إنشاء حملة إرسال جديدة
                </Button>
              </div>

              {/* Active / Past Campaigns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {campaigns.length === 0 ? (
                  <div className="col-span-2 text-center p-16 rounded-3xl bg-slate-950/20 border border-white/5 text-slate-500">
                    <Megaphone size={48} className="mx-auto mb-4 text-slate-600 opacity-40" />
                    <p className="font-bold text-sm">لا توجد حملات مسجلة بعد.</p>
                    <p className="text-xs mt-1">اضغط على زر "إنشاء حملة" بالأعلى للبدء في تصفية ليداتك والإرسال.</p>
                  </div>
                ) : (
                  campaigns.map((camp) => {
                    const isProcessing = camp.status === "sending";
                    const isCompleted = camp.status === "completed";
                    const isPaused = camp.status === "paused";
                    const total = camp.totalContacts || 0;
                    const processed = (camp.sentCount || 0) + (camp.failedCount || 0);
                    const percent = camp.progress || (total > 0 ? Math.floor((processed / total) * 100) : 0);

                    return (
                      <Card key={camp.id} className="p-6 bg-slate-950/30 border-white/[0.08] flex flex-col justify-between space-y-6">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black border",
                              isProcessing && "bg-sky-500/10 text-sky-450 border-sky-500/25 animate-pulse",
                              isCompleted && "bg-emerald-500/10 text-emerald-450 border-emerald-500/25",
                              isPaused && "bg-amber-500/10 text-amber-450 border-amber-500/25",
                              camp.status === "pending" && "bg-slate-500/10 text-slate-400 border-slate-500/25"
                            )}>
                              {AR_STATUS_MAP[camp.status] || camp.status}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                              تأخير {camp.delaySeconds} ثانية
                            </span>
                          </div>

                          <h4 className="text-lg font-black text-white text-shadow-sky mt-3">{camp.name}</h4>
                          
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold text-slate-400">
                            <div>القسم المستهدف: <strong className="text-slate-300">{camp.target === "telesales" ? "تيلي سيلز" : "مبيعات"}</strong></div>
                            <div className="col-span-2">الحالة المصنفة: <strong className="text-slate-300">{camp.filterStatus}</strong></div>
                          </div>

                          {/* Progress bar container */}
                          <div className="mt-6 space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                              <span>نسبة تقدم الحملة:</span>
                              <span className="font-mono text-white">{percent}% ({processed} / {total})</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-white/[0.04] border border-white/5 overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  isCompleted ? "bg-emerald-500" : isPaused ? "bg-amber-500" : "bg-gradient-to-r from-sky-400 to-blue-500"
                                )} 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* Quick sub-stats */}
                          <div className="grid grid-cols-2 gap-4 mt-6 p-3 rounded-xl bg-white/[0.01] border border-white/5 text-center">
                            <div>
                              <p className="text-[10px] font-black text-slate-400">مرسلة بنجاح</p>
                              <p className="text-lg font-black text-emerald-400 mt-1 font-mono">{camp.sentCount || 0}</p>
                            </div>
                            <div className="border-r border-white/[0.05]">
                              <p className="text-[10px] font-black text-slate-400">فشلت</p>
                              <p className="text-lg font-black text-rose-400 mt-1 font-mono">{camp.failedCount || 0}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-3 border-t border-white/[0.04] pt-4">
                          {!isCompleted && (
                            <>
                              {isProcessing ? (
                                <Button 
                                  size="sm" 
                                  variant="danger" 
                                  onClick={() => handlePauseCampaign(camp.id)}
                                >
                                  <Pause size={14} />
                                  إيقاف مؤقت
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="primary" 
                                  onClick={() => handleStartCampaign(camp.id)}
                                  disabled={!connected}
                                >
                                  <Play size={14} />
                                  تشغيل / استئناف
                                </Button>
                              )}
                            </>
                          )}
                          {isCompleted && (
                            <span className="text-xs text-emerald-400 font-black flex items-center gap-1.5 p-2 bg-emerald-500/5 rounded-lg">
                              <CheckCircle2 size={16} />
                              اكتمل الإرسال بنجاح
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUTOMATION RULES */}
          {activeTab === "rules" && (
            <div className="space-y-8">
              {/* Header inside Tab */}
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-5">
                <div>
                  <h3 className="text-xl font-black text-white">قواعد الأتمتة التلقائية Automation Rules</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">اربط حالات العميل (مثال: مجدول، مهتم) بقوالب رسائل واتساب معينة ليتم إرسالها بشكل تلقائي.</p>
                </div>
                <Button variant="primary" onClick={() => setShowRuleModal(true)}>
                  <Plus size={18} />
                  إضافة قاعدة أتمتة جديدة
                </Button>
              </div>

              {/* Rules List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rules.length === 0 ? (
                  <div className="col-span-2 text-center p-16 rounded-3xl bg-slate-950/20 border border-white/5 text-slate-500">
                    <Sliders size={48} className="mx-auto mb-4 text-slate-600 opacity-40" />
                    <p className="font-bold text-sm">لا توجد قواعد أتمتة مضافة.</p>
                    <p className="text-xs mt-1">أضف قواعد لتبسيط متابعة الموظفين وإرسال تذكيرات فورية ومجدولة تلقائياً.</p>
                  </div>
                ) : (
                  rules.map((rule) => {
                    const tmpl = templates.find(t => t.id === rule.templateId);

                    return (
                      <Card key={rule.id} className="p-6 bg-slate-950/30 border-white/[0.08] flex flex-col justify-between space-y-6">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400">
                              {rule.trigger === "status_change_telesales" ? "تحديث ليد التيلي سيلز" : "تحديث ليد المبيعات"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">تفعيل القاعدة:</span>
                              <input 
                                type="checkbox" 
                                checked={rule.active} 
                                onChange={() => handleToggleRule(rule.id, rule.active)}
                                className="w-9 h-5 bg-slate-700 checked:bg-sky-500 rounded-full cursor-pointer appearance-none relative transition-all duration-300 before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:left-[18px] before:transition-all before:duration-300"
                              />
                            </div>
                          </div>

                          <h4 className="text-lg font-black text-white text-shadow-sky mt-4">{rule.name}</h4>
                          
                          <div className="mt-4 space-y-2 text-xs font-bold text-slate-400">
                            <div>الشرط: <strong className="text-slate-300">عند تغيير الحالة إلى "{rule.triggerValue}"</strong></div>
                            <div>القالب المستخدم: <strong className="text-sky-400">"{tmpl?.name || "قالب مفقود"}"</strong></div>
                            <div>تأخير الإرسال: <strong className="text-amber-400">{rule.delayMinutes === 0 ? "فوري" : `${rule.delayMinutes} دقيقة`}</strong></div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] pt-4">
                          <Button 
                            size="sm" 
                            variant="danger" 
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 size={14} />
                            حذف القاعدة
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MESSAGE TEMPLATES */}
          {activeTab === "templates" && (
            <div className="space-y-8">
              {/* Header inside Tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
                <div>
                  <h3 className="text-xl font-black text-white">قوالب الرسائل الجاهزة Templates</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">صمم قوالب رسائل نصية أو مدعومة بملفات لتسهيل الإرسال الجماعي والأتمتة.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input 
                    placeholder="ابحث عن قالب..." 
                    value={templateSearch} 
                    onChange={(e) => setTemplateSearch(e.target.value)} 
                    className="w-64"
                    dark
                  />
                  <Button variant="primary" onClick={() => {
                    setTemplateEditingId(null);
                    setTempName("");
                    setTempType("text");
                    setTempContent("");
                    setTempMediaUrl("");
                    setShowTemplateModal(true);
                  }}>
                    <Plus size={18} />
                    قالب جديد
                  </Button>
                </div>
              </div>

              {/* Templates List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.length === 0 ? (
                  <div className="col-span-3 text-center p-16 rounded-3xl bg-slate-950/20 border border-white/5 text-slate-500">
                    <FileText size={48} className="mx-auto mb-4 text-slate-600 opacity-40" />
                    <p className="font-bold text-sm">لا توجد قوالب رسائل مطابقة.</p>
                    <p className="text-xs mt-1">ابدأ بإنشاء قالب رسالة ترحيبية أو تذكير بالمواعيد لتسهيل أعمالك.</p>
                  </div>
                ) : (
                  filteredTemplates.map((tmpl) => (
                    <Card key={tmpl.id} className="p-6 bg-slate-950/30 border-white/[0.08] flex flex-col justify-between space-y-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-white/[0.04] text-slate-300 border border-white/5 uppercase">
                            {tmpl.type === "text" ? "نص فقط" : tmpl.type === "image" ? "صورة" : "مستند/ملف"}
                          </span>
                        </div>

                        <h4 className="text-md font-black text-white text-shadow-sky mt-3">{tmpl.name}</h4>
                        
                        <div className="mt-3 p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.04] text-xs text-slate-350 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {tmpl.content}
                        </div>

                        {tmpl.mediaUrl && (
                          <div className="mt-2.5 text-[10px] font-mono text-slate-400 truncate">
                            رابط المرفق: <a href={tmpl.mediaUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline">{tmpl.mediaUrl}</a>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] pt-4">
                        <button 
                          onClick={() => handleEditTemplate(tmpl)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MESSAGE LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-8">
              {/* Filter controls inside Tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
                <div>
                  <h3 className="text-xl font-black text-white">سجل المراسلات التفصيلي Logs</h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">تقارير لحظية عن جميع الرسائل الصادرة الفردية والتلقائية مع كشف أسباب الفشل.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">فرز النتائج:</span>
                  <Select 
                    value={logSearch} 
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="w-48"
                    dark
                  >
                    <option value="all">جميع الرسائل</option>
                    <option value="sent">المرسلة بنجاح</option>
                    <option value="failed">الفاشلة فقط</option>
                    <option value="pending">المجدولة المتبقية</option>
                    <option value="automation">الأتمتة التلقائية</option>
                  </Select>
                </div>
              </div>

              {/* Logs Table Grid */}
              <Card className="overflow-x-auto bg-slate-950/30 border-white/[0.08] rounded-3xl">
                <table className="w-full text-right border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.01] text-slate-400 font-black text-xs">
                      <th className="p-4">العميل</th>
                      <th className="p-4">رقم الجوال</th>
                      <th className="p-4">نص الرسالة</th>
                      <th className="p-4">النوع</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4">موعد الإرسال</th>
                      <th className="p-4 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02] text-xs">
                    {loadingData ? (
                      <tr>
                        <td colSpan={7} className="p-16 text-center text-slate-500">
                          <Loader2 className="animate-spin mx-auto text-sky-400 mb-2" size={24} />
                          جاري تحميل سجل المراسلات...
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-16 text-center text-slate-500">
                          لا توجد رسائل مسجلة مطابقة للفرز المحدد.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => {
                        const isSent = log.status === "sent";
                        const isFailed = log.status === "failed";
                        const isPending = log.status === "pending";

                        return (
                          <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-4 font-bold text-slate-200">{log.clientName || "عميل غير معروف"}</td>
                            <td className="p-4 font-mono font-bold text-slate-300">{log.phone}</td>
                            <td className="p-4 text-slate-400 max-w-xs truncate" title={log.message}>
                              {log.message}
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                                {log.type === "individual" ? "فردي" : log.type === "campaign" ? "حملة جماعية" : "أتمتة"}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black border",
                                isSent && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                isFailed && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                                isPending && "bg-amber-500/10 text-amber-450 border-amber-500/20"
                              )}>
                                {AR_STATUS_MAP[log.status] || log.status}
                              </span>
                              {log.failureReason && (
                                <p className="text-[10px] text-rose-400 font-bold mt-1 max-w-[150px] truncate" title={log.failureReason}>
                                  {log.failureReason}
                                </p>
                              )}
                            </td>
                            <td className="p-4 font-mono text-slate-400">
                              {log.scheduledAt ? (
                                <span className="text-amber-450 font-bold flex items-center gap-1">
                                  <Clock size={12} />
                                  مجدول: {new Date(log.scheduledAt).toLocaleString("ar-EG")}
                                </span>
                              ) : (
                                new Date(log.createdAt).toLocaleString("ar-EG")
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isFailed && (
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  onClick={() => handleRetryMessage(log)}
                                  className="h-8 px-2 text-[10px]"
                                >
                                  <RefreshCw size={10} className="ml-1" />
                                  إعادة إرسال
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <Card className="p-8 max-w-2xl mx-auto bg-slate-950/30 border-white/[0.08] space-y-6">
              <div className="border-b border-white/[0.05] pb-4">
                <h3 className="text-xl font-black text-white text-shadow-sky flex items-center gap-2">
                  <SettingsIcon size={22} className="text-sky-400" />
                  تهيئة اتصال WasenderAPI
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-bold">يرجى توفير معلومات بوابة الإرسال الخاصة بك بشكل آمن. يتم تشفير وتخزين الـ Token بالخلفية.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">عنوان الـ API Endpoint لـ Wasender</label>
                  <Input 
                    value={apiUrl} 
                    onChange={(e) => setApiUrl(e.target.value)} 
                    placeholder="https://wasenderapi.com/api/send-message"
                    dark
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">رمز مصادقة الخدمة API Token</label>
                  <Input 
                    type="password"
                    value={apiToken} 
                    onChange={(e) => setApiToken(e.target.value)} 
                    placeholder={connected ? "••••••••••••••••••••••••••••" : "أدخل الـ Token الممنوح لك"}
                    dark
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">رقم هاتف الإرسال المربوط</label>
                  <Input 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    placeholder="2010xxxxxxxx"
                    dark
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="active-setting"
                    checked={active} 
                    onChange={() => setActive(!active)}
                    className="w-5 h-5 bg-slate-700 checked:bg-sky-500 rounded cursor-pointer appearance-none relative transition-all duration-300 checked:before:content-['✓'] before:absolute before:text-white before:font-bold before:text-sm before:right-1 before:top-[-2px]"
                  />
                  <label htmlFor="active-setting" className="text-xs font-black text-slate-300 cursor-pointer">
                    تفعيل نظام المراسلات في السيستم بشكل عام
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
                <Button 
                  variant="secondary" 
                  onClick={handleTestConnection}
                  disabled={testingConnection || !apiToken}
                >
                  {testingConnection ? "جاري الاختبار..." : "اختبار الاتصال"}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleSaveSettings}
                  disabled={loadingSettings}
                >
                  {loadingSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* MODAL: CREATE/EDIT TEMPLATE */}
      <Modal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={templateEditingId ? "تعديل قالب رسالة" : "إنشاء قالب رسالة جديد"}>
        <form onSubmit={handleSaveTemplate} className="space-y-4 text-right" dir="rtl">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">اسم القالب</label>
            <Input 
              placeholder="مثال: رسالة المتابعة الأولى" 
              value={tempName} 
              onChange={(e) => setTempName(e.target.value)}
              dark
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">نوع المرفقات</label>
            <Select value={tempType} onChange={(e) => setTempType(e.target.value)} dark>
              <option value="text">نص فقط</option>
              <option value="image">صورة مرفقة</option>
              <option value="document">ملف / مستند</option>
            </Select>
          </div>

          {(tempType === "image" || tempType === "document") && (
            <div>
              <label className="block text-xs font-black text-slate-300 mb-2">رابط الملف / الصورة المرفقة</label>
              <Input 
                placeholder="https://example.com/image.jpg" 
                value={tempMediaUrl} 
                onChange={(e) => setTempMediaUrl(e.target.value)}
                dark
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">محتوى الرسالة</label>
            <textarea 
              rows={5} 
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500 leading-relaxed font-sans"
              placeholder={`أهلاً {clientName}، يسعدنا تواصلك معنا...`}
              value={tempContent}
              onChange={(e) => setTempContent(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowTemplateModal(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={savingTemplate}>
              {savingTemplate ? "جاري الحفظ..." : "حفظ القالب"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE AUTOMATION RULE */}
      <Modal isOpen={showRuleModal} onClose={() => setShowRuleModal(false)} title="إضافة قاعدة أتمتة جديدة">
        <form onSubmit={handleSaveRule} className="space-y-4 text-right" dir="rtl">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">اسم قاعدة الأتمتة</label>
            <Input 
              placeholder="مثال: رسالة ترحيبية فور ليد التيلي سيلز" 
              value={ruleName} 
              onChange={(e) => setRuleName(e.target.value)}
              dark
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">القسم المستهدف للتأثير</label>
            <Select value={ruleTrigger} onChange={(e) => setRuleTrigger(e.target.value)} dark>
              <option value="status_change_telesales">تحديث ليد التيلي سيلز (Telesales)</option>
              <option value="status_change_sales">تحديث ليد المبيعات (Sales Hub)</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">عند تغيير الحالة الاستجابية إلى:</label>
            <Select value={ruleTriggerValue} onChange={(e) => setRuleTriggerValue(e.target.value)} dark>
              <option value="">-- اختر قيمة الحالة لتفعيل الإرسال --</option>
              {triggerStatusOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">القالب الجاهز للإرسال</label>
            <Select value={ruleTemplateId} onChange={(e) => setRuleTemplateId(e.target.value)} dark>
              <option value="">-- حدد قالب المراسلة --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">تأخير الإرسال الزمني (بالدقائق)</label>
            <Input 
              type="number" 
              placeholder="0 تعني إرسال فوري" 
              value={ruleDelayMinutes} 
              onChange={(e) => setRuleDelayMinutes(Number(e.target.value))}
              dark
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowRuleModal(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={savingRule}>
              {savingRule ? "جاري الحفظ..." : "حفظ القاعدة وتفعيلها"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE CAMPAIGN */}
      <Modal isOpen={showCampaignModal} onClose={() => setShowCampaignModal(false)} title="إنشاء حملة إرسال جماعية">
        <form onSubmit={handleCreateCampaign} className="space-y-4 text-right" dir="rtl">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">اسم الحملة</label>
            <Input 
              placeholder="مثال: حملة المتابعة الصيفية للمهتمين" 
              value={campName} 
              onChange={(e) => setCampName(e.target.value)}
              dark
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-300 mb-2">مصدر القائمة المستهدفة</label>
              <Select value={campTarget} onChange={(e) => {
                setCampTarget(e.target.value);
                setCampFilterStatus("جميع الحالات");
              }} dark>
                <option value="telesales">ليدات قسم التيلي سيلز</option>
                <option value="sales">ليدات قسم المبيعات</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-300 mb-2">حسب الحالة الاستجابية:</label>
              <Select value={campFilterStatus} onChange={(e) => setCampFilterStatus(e.target.value)} dark>
                <option value="جميع الحالات">جميع العملاء في القسم</option>
                {(campTarget === "telesales" 
                  ? (crmSettings.telesalesForm?.responseOptions || ["لم يتم الرد", "لا يرد", "مهتم", "غير مهتم", "مجدول", "تم التواصل", "رقم خاطئ", "واتساب فقط"])
                  : (crmSettings.salesForm?.responseOptions || ["تم استلام الليد", "جاري التواصل", "مهتم وجاري المتابعة", "تم تقديم عرض سعر", "تم التعاقد", "مستبعد"])
                ).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Matches Counter Card */}
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-450 flex items-center justify-between">
            <span>عدد الليدات المطابقة للتصفية الحالية:</span>
            <span className="text-sm font-black font-mono">{campaignMatchingContacts.length} عميل مستهدف</span>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">اختر قالباً جاهزاً (أو اكتب مخصصاً بالأسفل)</label>
            <Select value={campTemplateId} onChange={(e) => setCampTemplateId(e.target.value)} dark>
              <option value="">-- قالب مخصص غير مسبق --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">نص الرسالة المرسلة</label>
            <textarea 
              rows={4} 
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500 leading-relaxed font-sans"
              placeholder={`محتوى الرسالة...`}
              value={campMessageText}
              onChange={(e) => setCampMessageText(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">فاصل الانتظار بين الرسائل (بالثواني)</label>
            <Input 
              type="number" 
              placeholder="مثال: 5 ثواني لمنع الحظر" 
              value={campDelaySeconds} 
              onChange={(e) => setCampDelaySeconds(Number(e.target.value))}
              dark
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowCampaignModal(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={creatingCampaign || campaignMatchingContacts.length === 0}>
              {creatingCampaign ? "جاري الإنشاء..." : "حفظ الحملة وجدولة البدء"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
