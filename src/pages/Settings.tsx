import React, { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Globe, 
  Target,
  Users, 
  ShieldAlert, 
  Bell, 
  History, 
  Cpu, 
  Save,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Facebook,
  Music2,
  BarChart,
  FileSpreadsheet,
  Mail,
  Zap,
  Terminal,
  Layers,
  UserPlus,
  Edit3,
  Trash2,
  Plus,
  Check,
  Lock,
  ShieldCheck,
  User,
  X,
  UserCheck,
  Briefcase,
  Quote,
  Sparkles
} from "lucide-react";
import { Card, Input, Button, Tabs, Select } from "@/src/components/UI";
import { useSettings, DEFAULT_TELESALES_FORM } from "@/src/hooks/useSettings";
import { useVersions } from "@/src/hooks/useVersions";
import { TeamMember, TaskDepartment } from "@/src/types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { SettingsTelesales } from "@/src/components/SettingsTelesales";
import { SettingsSales } from "@/src/components/SettingsSales";
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { sendSystemNotification } from "@/src/utils/notifications";

export const SettingsPage: React.FC = () => {
  const { settings, loading, saveSettings } = useSettings();
  const { versions, loading: formatsLoading } = useVersions();
  const [activeTab, setActiveTab] = useState("general");

  // General settings states
  const [agencyName, setAgencyName] = useState("");
  const [timezone, setTimezone] = useState("UTC+3");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [newUserAlertsEnabled, setNewUserAlertsEnabled] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Targets settings states
  const [telesalesDeptTarget, setTelesalesDeptTarget] = useState<number>(0);
  const [salesDeptTarget, setSalesDeptTarget] = useState<number>(0);
  const [salesAgentMonthlyTarget, setSalesAgentMonthlyTarget] = useState<number>(0);
  const [telesalesAgentMonthlyTarget, setTelesalesAgentMonthlyTarget] = useState<number>(0);
  const [isSavingTargets, setIsSavingTargets] = useState(false);

  React.useEffect(() => {
    if (settings?.targets) {
      setTelesalesDeptTarget(settings.targets.telesalesDeptTarget || 0);
      setSalesDeptTarget(settings.targets.salesDeptTarget || 0);
      setSalesAgentMonthlyTarget(settings.targets.salesAgentMonthlyTarget || 0);
      setTelesalesAgentMonthlyTarget(settings.targets.telesalesAgentMonthlyTarget || 0);
    }
  }, [settings?.targets]);

  const handleSaveTargets = async () => {
    setIsSavingTargets(true);
    const updatedTargets = {
      telesalesDeptTarget: Number(telesalesDeptTarget) || 0,
      salesDeptTarget: Number(salesDeptTarget) || 0,
      salesAgentMonthlyTarget: Number(salesAgentMonthlyTarget) || 0,
      telesalesAgentMonthlyTarget: Number(telesalesAgentMonthlyTarget) || 0,
    };
    try {
      await saveSettings("targets", updatedTargets);
      showFeedback("تم حفظ مستهدفات الأداء والتارجت بنجاح! 🎉");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ مستهدفات الأداء.");
    } finally {
      setIsSavingTargets(false);
    }
  };

  React.useEffect(() => {
    if (settings?.generalSettings) {
      setAgencyName(settings.generalSettings.agencyName || "MADAR SALES CRM");
      setTimezone(settings.generalSettings.timezone || "UTC+3");
      setDateFormat(settings.generalSettings.dateFormat || "YYYY-MM-DD");
      setNewUserAlertsEnabled(settings.generalSettings.newUserAlertsEnabled ?? true);
    }
  }, [settings?.generalSettings]);

  const handleSaveGeneral = async () => {
    setIsSavingGeneral(true);
    const updatedGeneral = {
      ...(settings.generalSettings || {}),
      agencyName,
      timezone,
      dateFormat,
      newUserAlertsEnabled,
    };
    try {
      await saveSettings("generalSettings", updatedGeneral);
      showFeedback("تم حفظ الإعدادات العامة بنجاح!");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ الإعدادات العامة.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Daily messages state
  const [dailyMessages, setDailyMessages] = useState<string[]>(Array(30).fill(""));
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [isSavingMsgs, setIsSavingMsgs] = useState(false);

  // Load daily messages
  React.useEffect(() => {
    if (activeTab === "daily_messages") {
      setIsMsgLoading(true);
      const loadMsgs = async () => {
        try {
          const docSnap = await getDoc(doc(db, "settings", "dailyMessages"));
          if (docSnap.exists() && Array.isArray(docSnap.data().items)) {
            const items = docSnap.data().items;
            const fullMsgs = Array(30).fill("").map((_, i) => items[i] || "");
            setDailyMessages(fullMsgs);
          } else {
            setDailyMessages(Array(30).fill(""));
          }
        } catch (err: any) {
          const msg = err?.message || err?.error || String(err);
          const isQuota = msg.includes("Quota exceeded") || msg.includes("quota") || err?.code === "resource-exhausted";
          if (isQuota) {
            console.warn("Daily messages loading quota warning (handled):", err);
          } else {
            console.error(err);
          }
        } finally {
          setIsMsgLoading(false);
        }
      };
      loadMsgs();
    }
  }, [activeTab]);

  const handleSaveDailyMessages = async () => {
    setIsSavingMsgs(true);
    try {
      await setDoc(doc(db, "settings", "dailyMessages"), { items: dailyMessages });
      showFeedback("تم حفظ الـ 30 رسالة لليوم بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ رسائل الشهر.");
    } finally {
      setIsSavingMsgs(false);
    }
  };

  // Permissions state indicators
  const [editingMember, setEditingMember] = useState<(TeamMember & { previousDepartment?: string }) | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states for adding or editing
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Member");
  const [formDepartment, setFormDepartment] = useState<string>("Ads");
  const [formAllowedPages, setFormAllowedPages] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dropdown list states for editing
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [responseOptions, setResponseOptions] = useState<string[]>([]);
  const [meetingStatuses, setMeetingStatuses] = useState<string[]>([]);
  const [contactTypes, setContactTypes] = useState<string[]>([]);

  // Draft input states
  const [newDataSource, setNewDataSource] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [newMeetingStatus, setNewMeetingStatus] = useState("");
  const [newContactType, setNewContactType] = useState("");

  const [isSavingFormDropdowns, setIsSavingFormDropdowns] = useState(false);

  // Load departments from database with high-contrast beautiful fallbacks
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isSavingDepartments, setIsSavingDepartments] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    type: "member" | "department";
  } | null>(null);

  const [allUsers, setAllUsers] = useState<{ uid: string; email: string; displayName?: string; photoURL?: string; lastLogin?: string }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ uid: string; email: string; name: string } | null>(null);

  React.useEffect(() => {
    if (settings?.telesalesForm) {
      setDataSources(settings.telesalesForm.dataSources || []);
      setResponseOptions(settings.telesalesForm.responseOptions || []);
      setMeetingStatuses(settings.telesalesForm.meetingStatuses || []);
      setContactTypes(settings.telesalesForm.contactTypes || []);
    }
  }, [settings?.telesalesForm]);

  React.useEffect(() => {
    if (settings?.departments && settings.departments.length > 0) {
      setDepartments(settings.departments);
    } else {
      setDepartments([
        { id: "Ads", name: "إعلانات وميديا باينج (Ads)" },
        { id: "SEO", name: "أرشفة الويب ومحركات البحث (SEO)" },
        { id: "Content", name: "صناعة المحتوى وريدرز (Content)" },
        { id: "Design", name: "تصميم جرافيك وهوية بصريّة (Design)" },
        { id: "Editor", name: "مونتاج وبوست برودكشن (Editor)" },
      ]);
    }
  }, [settings?.departments]);

  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleSaveTelesalesDropdowns = async () => {
    setIsSavingFormDropdowns(true);
    const updatedForm = {
      ...(settings?.telesalesForm || DEFAULT_TELESALES_FORM),
      dataSources,
      responseOptions,
      meetingStatuses,
      contactTypes,
    };
    try {
      await saveSettings("telesalesForm", updatedForm);
      showFeedback("تم تحديث وحفظ خيارات القوائم المنسدلة للتيلي سيلز بنجاح!");
    } catch (error) {
      console.error("Error saving drop downs:", error);
      alert("حدث خطأ أثناء إجراء المزامنة على الخادم.");
    } finally {
      setIsSavingFormDropdowns(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("Member");
    setFormDepartment("Ads");
    setFormAllowedPages([]);
    setFormActive(true);
    setEditingMember(null);
    setIsAdding(false);
  };

  const startEdit = (member: TeamMember & { department?: string }) => {
    setEditingMember({
      ...member,
      previousDepartment: member.department,
    });
    setFormName(member.name);
    setFormEmail(member.email || "");
    setFormRole(member.role || "Member");
    setFormDepartment(member.department || "Ads");
    setFormAllowedPages((member.allowedPages || []).map(p => p === "sales" ? "sales_agent" : p));
    setFormActive(member.active ?? true);
    setIsAdding(true); // Open the interactive drawer
  };

  const getTeamKeyFromDepartment = (dept?: string): string => {
    if (!dept) return "adsTeam";
    const dLower = dept.toLowerCase();
    if (dLower === "ads" || dLower === "taskdepartment.ads") return "adsTeam";
    if (dLower === "seo" || dLower === "taskdepartment.seo") return "seoTeam";
    if (dLower === "content" || dLower === "taskdepartment.content") return "contentTeam";
    if (dLower === "design" || dLower === "taskdepartment.design") return "designTeam";
    if (dLower === "editor" || dLower === "taskdepartment.editor") return "editorTeam";
    return `${dLower}Team`;
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      alert("الرجاء إدخال اسم الموظف وبريده الإلكتروني المصرح به.");
      return;
    }

    const currentTeamSettings = settings.teamSettings || {};
    const isNewMember = !editingMember;

    // Construct member info
    const id = editingMember ? editingMember.id : `member_${Date.now()}`;
    
    const finalAllowedPages = [...formAllowedPages];
    const deptLower = formDepartment.toLowerCase().trim();
    if (deptLower === "telesales" && !finalAllowedPages.includes("telesales_agent")) {
      finalAllowedPages.push("telesales_agent");
    }

    const memberData: TeamMember = {
      id,
      name: formName,
      email: formEmail,
      role: formRole,
      department: formDepartment as any,
      active: formActive,
      allowedPages: finalAllowedPages,
      joinDate: editingMember?.joinDate || new Date().toISOString().split("T")[0],
    };

    // Clean up current references across all teams to ensure no duplication by ID or Email
    const updatedTeamSettings = { ...currentTeamSettings };
    Object.keys(updatedTeamSettings).forEach((key) => {
      if (Array.isArray((updatedTeamSettings as any)[key])) {
        (updatedTeamSettings as any)[key] = (updatedTeamSettings as any)[key].filter(
          (m: any) => m.id !== id && m.email?.toLowerCase().trim() !== formEmail.toLowerCase().trim()
        );
      }
    });

    // Add to newly selected department
    const teamKey = getTeamKeyFromDepartment(formDepartment);
    if (teamKey) {
      if (!(updatedTeamSettings as any)[teamKey]) {
        (updatedTeamSettings as any)[teamKey] = [];
      }
      (updatedTeamSettings as any)[teamKey].push(memberData);
    }

    try {
      await saveSettings("teamSettings", updatedTeamSettings);
      showFeedback(editingMember ? "تم تحديث الصلاحيات والبيانات للموظف بنجاح!" : "تمت إضافة الموظف بنجاح وتفعيل حسابه للمزامنة العاجلة!");
      
      if (isNewMember) {
        // Trigger system notification
        await sendSystemNotification({
          title: "إضافة وتفعيل موظف جديد",
          message: `تم إضافة وتفعيل الموظف الجديد "${formName}" في قسم "${formDepartment}" وتعيين دوره كـ "${formRole || 'عضو'}" بنجاح.`,
          type: "system",
          category: "general",
          triggeredBy: "إدارة النظام"
        });
      }

      resetForm();
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء المزامنة على الخادم.");
    }
  };

  const handleDeleteMember = (id: string, name: string) => {
    setDeleteConfirm({ id, name, type: "member" });
  };

  const executeDeleteMember = async (id: string) => {
    const currentTeamSettings = settings.teamSettings || {};
    const updatedTeamSettings = { ...currentTeamSettings };

    Object.keys(updatedTeamSettings).forEach((key) => {
      if (Array.isArray((updatedTeamSettings as any)[key])) {
        (updatedTeamSettings as any)[key] = (updatedTeamSettings as any)[key].filter((m: any) => m.id !== id);
      }
    });

    try {
      await saveSettings("teamSettings", updatedTeamSettings);
      showFeedback("تم سحب وإلغاء صلاحيات الموظف بنجاح.");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إلغاء صلاحيات الموظف.");
    }
  };

  const executeDeleteDepartment = async (id: string) => {
    const updated = departments.filter((d) => d.id !== id);
    try {
      await saveSettings("departments", { items: updated });
      setDepartments(updated);
      showFeedback("تم حذف القسم بنجاح.");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء عملية الحذف.");
    }
  };

  // Memoized consolidated list for table display
  const allMembersList = React.useMemo(() => {
    const currentTeamSettings = settings.teamSettings || {};
    const list: (TeamMember & { departmentKey: string })[] = [];
    const addedIds = new Set<string>();
    
    departments.forEach(dept => {
      const key = getTeamKeyFromDepartment(dept.id);
      const team = (currentTeamSettings as any)[key];
      if (Array.isArray(team)) {
        team.forEach(m => {
          if (m && m.id && !addedIds.has(m.id)) {
            list.push({ 
              ...m, 
              departmentKey: key, 
              department: m.department || (dept.id as any) 
            });
            addedIds.add(m.id);
          }
        });
      }
    });

    // Fallback: search ALL arrays inside teamSettings for any other registered members (safeguards against renamed/deleted departments)
    Object.keys(currentTeamSettings).forEach(key => {
      const team = (currentTeamSettings as any)[key];
      if (Array.isArray(team)) {
        team.forEach(m => {
          if (m && m.id && !addedIds.has(m.id)) {
            let inferredDept = m.department || "";
            if (!inferredDept) {
              const suffixIndex = key.indexOf("Team");
              if (suffixIndex > 0) {
                const prefix = key.substring(0, suffixIndex);
                inferredDept = prefix.charAt(0).toUpperCase() + prefix.slice(1);
              } else {
                inferredDept = key;
              }
            }
            list.push({
              ...m,
              departmentKey: key,
              department: inferredDept as any
            });
            addedIds.add(m.id);
          }
        });
      }
    });
    
    return list;
  }, [settings.teamSettings, departments]);

  // Load registered users from "users" and match them
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const usersList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as any[];
      setAllUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "employees") {
      fetchUsers();
    }
  }, [activeTab]);

  const pendingUsers = React.useMemo(() => {
    const registeredEmails = new Set(allMembersList.map(m => m.email?.toLowerCase().trim()).filter(Boolean));
    return allUsers.filter(u => {
      if (!u.email) return false;
      const emailLower = u.email.toLowerCase().trim();
      if (emailLower === "abdelrahmanahmed011147@gmail.com") return false;
      return !registeredEmails.has(emailLower);
    });
  }, [allUsers, allMembersList]);

  const handleActivatePendingUser = (userReq: typeof allUsers[0]) => {
    setFormName(userReq.displayName || userReq.email.split("@")[0]);
    setFormEmail(userReq.email);
    setFormRole("Member");
    setFormDepartment("Ads");
    setFormAllowedPages([]);
    setFormActive(true);
    setEditingMember(null);
    setIsAdding(true);

    // Scroll smoothly to the form
    setTimeout(() => {
      const formEl = document.getElementById("member-form-section");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const executeDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, "users", uid));
      showFeedback("تم حذف طلب التسجيل بنجاح.");
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إجراء عملية الحذف.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-24 left-6 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={24} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Premium Luxury Glassy Header Banner */}
      <div className="relative p-6 md:p-8 rounded-[2rem] bg-gradient-to-br from-slate-950/40 via-slate-900/30 to-slate-950/50 backdrop-blur-3xl border border-white/[0.08] shadow-2xl overflow-hidden text-right" dir="rtl">
        {/* Glow Spheres */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-sky-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-[80px]" />
        
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 rounded-[1.5rem] border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.15)] shrink-0 transition-transform duration-700 hover:rotate-45">
            <SettingsIcon size={32} />
          </div>
          <div className="space-y-1.5 text-right">
            <h1 className="text-3xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">الإعدادات (Settings)</h1>
            <p className="text-slate-400 font-bold text-xs md:text-sm">تحكَّم في إعدادات الوكالة، الـ 30 رسالة ملهمة للشهر، كادر الموظفين والأقسام بكل بساطة!</p>
          </div>
        </div>
      </div>

      <Tabs 
        tabs={[
          { id: "general", label: "إعدادات عامة", icon: Globe },
          { id: "daily_messages", label: "الـ 30 رسالة ملهمة", icon: Quote },
          { id: "employees", label: "كادر الموظفين والصلاحيات", icon: Users },
          { id: "telesales", label: "استمارات التيلي", icon: MessageSquare },
          { id: "sales_opt", label: "استمارات المبيعات", icon: Briefcase },
          { id: "targets", label: "تحديد التارجت", icon: Target },
          { id: "versions", label: "تاريخ التحديثات والنسخ", icon: Layers },
        ]} 
        activeTab={activeTab} 
        onChange={setActiveTab} 
        dark
        className="mb-8"
      />

      <AnimatePresence mode="wait">
        {activeTab === "general" && (
          <motion.div
            key="general"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card glass className="p-8 max-w-2xl text-right" dir="rtl">
              <h3 className="text-xl font-bold text-white mb-6">الإعدادات العامة</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">اسم الوكالة</label>
                  <Input 
                    dark 
                    value={agencyName} 
                    onChange={(e) => setAgencyName(e.target.value)} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-1 text-right">
                    <label className="text-xs font-bold text-slate-500 block">المنطقة الزمنية</label>
                    <Select 
                      dark 
                      value={timezone} 
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      <option value="UTC+3">Riyadh (UTC+3)</option>
                      <option value="UTC+2">Cairo (UTC+2)</option>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-1 text-right">
                    <label className="text-xs font-bold text-slate-500 block">تنسيق التاريخ</label>
                    <Select 
                      dark 
                      value={dateFormat} 
                      onChange={(e) => setDateFormat(e.target.value)}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleSaveGeneral} 
                  disabled={isSavingGeneral}
                  className="w-full bg-sky-500 hover:bg-sky-600 font-bold"
                >
                  {isSavingGeneral ? "جاري حفظ الإعدادات العامة..." : "حفظ الإعدادات العامة"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === "daily_messages" && (
          <motion.div
            key="daily_messages"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card glass className="p-8 max-w-5xl text-right" dir="rtl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/[0.05] pb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Quote className="text-sky-400" size={20} />
                    <span>بنك الرسائل اليومية للشهر (30 رسالة)</span>
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold">
                    يمكنك كتابة رسالة مخصصة لكل يوم من أيام الشهر (من 1 إلى 30) لتظهر تلقائياً للموظفين في الصفحة الرئيسية.
                  </p>
                </div>
                <Button
                  onClick={handleSaveDailyMessages}
                  disabled={isSavingMsgs}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-11 px-6 flex items-center gap-2 self-start md:self-auto"
                  icon={Save}
                >
                  {isSavingMsgs ? "جاري الحفظ..." : "حفظ كل الرسائل"}
                </Button>
              </div>

              {isMsgLoading ? (
                <div className="py-12 text-center text-slate-400 font-bold">جاري تحميل الرسائل...</div>
              ) : (
                <div className="space-y-6">
                  {/* Grid of 30 days inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array(30).fill(0).map((_, i) => (
                      <div key={i} className="space-y-1.5 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                            <Sparkles size={12} />
                            <span>رسالة اليوم {i + 1}</span>
                          </label>
                          <span className="text-[10px] text-slate-500 font-extrabold font-mono">Day {i + 1}</span>
                        </div>
                        <textarea
                          rows={2}
                          className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none transition-all text-right"
                          placeholder={`اكتب رسالة محفزة ومميزة لليوم ${i + 1} من الشهر...`}
                          value={dailyMessages[i] || ""}
                          onChange={(e) => {
                            const updated = [...dailyMessages];
                            updated[i] = e.target.value;
                            setDailyMessages(updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/[0.05]">
                    <Button
                      onClick={handleSaveDailyMessages}
                      disabled={isSavingMsgs}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-12 px-8 flex items-center gap-2 shadow-lg"
                      icon={Save}
                    >
                      {isSavingMsgs ? "جاري الحفظ..." : "حفظ الحقول وبنك الرسائل"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === "employees" && (
          <motion.div
            key="employees"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {pendingUsers.length > 0 && (
              <Card glass className="p-6 border-amber-500/20 bg-amber-950/5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500 text-right" dir="rtl">
                {/* Visual top bar glow */}
                <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-l from-amber-500 via-yellow-500 to-transparent" />
                
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="text-amber-400 animate-pulse" size={20} />
                  <h4 className="text-sm font-black text-white">
                    طلبات تفعيل حساب جديدة معلقة ({pendingUsers.length})
                  </h4>
                </div>
                
                <p className="text-xs text-slate-400 mb-5 leading-relaxed font-bold">
                  لقد قام الموظفون التالية أسماؤهم بتسجيل الدخول إلى النظام باستخدام حساب Google الخاص بهم، وهم بانتظار تفعيل حساباتهم وتحديد أقسامهم ومهامهم وصلاحياتهم لبدء العمل:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map((userReq) => (
                    <div 
                      key={userReq.uid} 
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {userReq.photoURL ? (
                          <img 
                            src={userReq.photoURL} 
                            alt={userReq.displayName} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover border border-white/10" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/10 to-yellow-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-400 text-sm flex-shrink-0">
                            {userReq.displayName ? userReq.displayName.charAt(0) : userReq.email.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-1 min-w-0">
                          <h5 className="text-xs font-black text-white truncate">{userReq.displayName || "مستخدم جديد"}</h5>
                          <p className="text-[10px] font-mono text-slate-500 break-all truncate">{userReq.email}</p>
                          {userReq.lastLogin && (
                            <p className="text-[9px] text-slate-600">
                              آخر محاولة دخول: {new Date(userReq.lastLogin).toLocaleString("ar-EG")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          onClick={() => handleActivatePendingUser(userReq)}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] h-9 rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <UserPlus size={14} />
                          تفعيل وصلاحيات
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmUser({ uid: userReq.uid, email: userReq.email, name: userReq.displayName || "" })}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/10 shrink-0"
                          title="حذف الطلب المعلق"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Employee Management Form & Teammates List */}
            <div className="space-y-6" dir="rtl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.05] text-right">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="text-sky-400" size={22} />
                    <span>إعدادات الموظفين وصلاحيات الوصول للسيستم</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">سجل وأضف إيميلات موظفي الوكالة وحدد صفحات النظام التي يحق لهم تصفحها والعمل عليها.</p>
                </div>

                {!isAdding && (
                  <Button 
                    onClick={() => { resetForm(); setIsAdding(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-11 px-5 flex items-center gap-2 self-start"
                    icon={UserPlus}
                  >
                    إضافة موظف جديد وتحديد الصلاحية
                  </Button>
                )}
              </div>

              {/* Interactive Adding/Editing Form Card */}
              {isAdding && (
                <Card id="member-form-section" glass className="p-6 border-indigo-500/20 bg-indigo-950/5 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 text-right">
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      <User className="text-indigo-400" size={18} />
                      <span>{editingMember ? `تعديل صلاحيات الموظف: ${editingMember.name}` : "تسجيل موظف جديد في نظام الوكالة"}</span>
                    </h4>
                    <button 
                      type="button"
                      onClick={resetForm}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveMember} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-right">
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">اسم الموظف الكامل *</label>
                        <Input 
                          dark 
                          placeholder="مثال: أحمد محمد علي" 
                          required 
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">البريد الإلكتروني جـيمـيـل (Gmail) *</label>
                        <Input 
                          dark 
                          placeholder="example@gmail.com" 
                          type="email" 
                          required 
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500 font-bold">يجب أن يتطابق مع الإيميل الذي سيستخدمه الموظف لتسجيل الدخول بـ Google.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">الدور العام ومجموع القوانين</label>
                        <Select 
                          dark 
                          value={formRole} 
                          onChange={(e) => setFormRole(e.target.value)}
                        >
                          <option value="Member">موظف عادي (Member)</option>
                          <option value="Admin">مدير للنظام (Admin - وصول كامل وتعديل فرق)</option>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">القسم / الجناح الوظيفي</label>
                        <Select 
                          dark 
                          value={formDepartment} 
                          onChange={(e) => setFormDepartment(e.target.value)}
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">حالة الحساب وتأثيرها</label>
                        <Select 
                          dark 
                          value={formActive ? "true" : "false"} 
                          onChange={(e) => setFormActive(e.target.value === "true")}
                        >
                          <option value="true">نشط ومصرح له بالدخول</option>
                          <option value="false">معطل مؤقتاً (موقوف)</option>
                        </Select>
                      </div>

                    </div>

                    {/* Allowed Pages Checkboxes Matrix */}
                    <div className="space-y-3 pt-4 border-t border-white/[0.05] text-right">
                      <h5 className="text-xs font-black text-slate-300">الصفحات والأنظمة المصرح للموظف بفتحها:</h5>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          { id: "sales_agent", name: "مساحة عمل السيلز" },
                          { id: "telesales", name: "إدارة قسم التيلي سيلز" },
                          { id: "telesales_agent", name: "مساحة عمل التيلي سيلز" },
                          { id: "sales_hub", name: "إدارة قسم المبيعات" },
                          { id: "whatsapp_automation", name: "أتمتة الواتساب" },
                          { id: "sales_tools", name: "أدوات التحليل المتقدمة" },
                          { id: "settings", name: "الإعدادات العامة" },
                        ].map((page) => {
                          const isTelesalesDept = formDepartment.toLowerCase().trim() === "telesales";
                          const isRequiredByDept = (page.id === "telesales_agent" && isTelesalesDept);
                          const isChecked = isRequiredByDept || formAllowedPages.includes(page.id);
                          return (
                            <label 
                              key={page.id}
                              className={cn(
                                "flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                                isChecked 
                                  ? "bg-sky-500/10 border-sky-500/20 text-sky-400" 
                                  : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-300 hover:border-white/10",
                                isRequiredByDept && "opacity-80"
                              )}
                            >
                              <input 
                                type="checkbox"
                                className="sr-only"
                                checked={isChecked}
                                onChange={() => {
                                  if (isRequiredByDept) return;
                                  if (isChecked) {
                                    setFormAllowedPages(formAllowedPages.filter(p => p !== page.id));
                                  } else {
                                    setFormAllowedPages([...formAllowedPages, page.id]);
                                  }
                                }}
                              />
                              <div className={cn(
                                "w-4 h-4 rounded flex items-center justify-center border transition-all",
                                isChecked ? "bg-sky-500 border-sky-500 text-white" : "border-slate-600"
                              )}>
                                {isChecked && <Check size={10} strokeWidth={4} />}
                              </div>
                              <span className="text-xs font-bold leading-none flex items-center gap-1">
                                {page.name}
                                {isRequiredByDept && <span className="text-[10px] text-sky-500 font-bold">(أساسي للقسم)</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05] text-right">
                      <Button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-11 px-6 flex items-center gap-2"
                        icon={Save}
                      >
                        {editingMember ? "حفظ وتحديث الصلاحية" : "مزامنة وتسجيل الموظف"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="secondary"
                        onClick={resetForm}
                        className="h-11 px-5 rounded-xl"
                      >
                        إلغاء
                      </Button>
                    </div>

                  </form>
                </Card>
              )}

              {/* List of Teammates Grid */}
              <div className="space-y-4 text-right">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest block font-bold">
                  الكادر الوظيفي الحالي وتفاصيل صلاحياتهم ({allMembersList.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {allMembersList.map((member) => (
                    <Card 
                      key={member.id} 
                      glass 
                      className={cn(
                        "p-5 relative group overflow-hidden border-white/[0.05] transition-all duration-300 text-right",
                        !member.active ? "opacity-60 border-rose-500/20 bg-rose-950/5" : "hover:border-indigo-500/30"
                      )}
                    >
                      {/* Status Top corner badge */}
                      <div className="absolute top-4 left-4 flex items-center gap-1.5">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          member.active ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                        )} />
                        <span className="text-[10px] font-black text-slate-500">
                          {member.active ? "نشط" : "معطل"}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <User size={18} />
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-sm font-black text-white">{member.name}</h5>
                            <p className="text-[11px] font-mono text-slate-500">{member.email || "بلا إيميل"}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.03]">
                          {/* Member Role & Department */}
                          <span className="text-[10px] font-black bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                            القسم: {(() => {
                              const deptObj = departments.find(d => d.id === member.department || d.id.toLowerCase() === String(member.department).toLowerCase());
                              return deptObj ? deptObj.name : (member.department || "عام");
                            })()}
                          </span>
                          
                          {member.role === "Admin" ? (
                            <span className="text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1">
                              <ShieldCheck size={11} />
                              مدير النظام
                            </span>
                          ) : (
                            <span className="text-[10px] font-black bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2 py-0.5 rounded">
                              موظف
                            </span>
                          )}
                        </div>

                        {/* Display Page Access list */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-bold">الصفحات المصرح له بها:</p>
                          <div className="flex flex-wrap gap-1 text-right">
                            {member.role === "Admin" ? (
                              <span className="text-[9px] font-black bg-green-500/15 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded">
                                ✓ جميع لوحات التحكم كاملة
                              </span>
                            ) : (
                              (() => {
                                const cleanAllowedPages = (member.allowedPages || []).map(p => p === "sales" ? "sales_agent" : p);
                                return cleanAllowedPages.length > 0 ? (
                                  cleanAllowedPages.map((pageId) => {
                                    const labels: Record<string, string> = {
                                      sales_agent: "مساحة عمل السيلز",
                                      telesales: "إدارة التيلي",
                                      telesales_agent: "موظف التيلي",
                                      sales_hub: "إدارة المبيعات",
                                      sales_tools: "أدوات السيلز والتيلي",
                                      settings: "الإعدادات"
                                    };
                                    return (
                                      <span key={pageId} className="text-[9px] font-black bg-sky-500/10 border border-sky-500/20 text-sky-450 px-1.5 py-0.5 rounded">
                                        {labels[pageId] || pageId}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-[9px] font-black bg-rose-500/10 border border-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">
                                    ✗ لا يوجد صلاحيات وصول
                                  </span>
                                );
                              })()
                            )}
                          </div>
                        </div>

                        {/* Controls Area */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.03]">
                          <button 
                            type="button"
                            onClick={() => startEdit(member)}
                            className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 hover:bg-sky-500/20 transition-all text-xs"
                            title="تعديل الموظف وصلاحياته"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteMember(member.id, member.name)}
                            className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 transition-all text-xs"
                            title="حذف الموظف"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                      </div>
                    </Card>
                  ))}

                  {allMembersList.length === 0 && (
                    <Card glass className="col-span-1 md:col-span-2 xl:col-span-3 p-12 text-center border-dashed border-white/[0.05]">
                      <p className="text-slate-500 text-sm">لا يوجد موظفين مسجلين حالياً. اضغط على الزر بالأعلى للتسجيل الأول.</p>
                    </Card>
                  )}
                </div>
              </div>
            </div>

            {/* Structure & Departments addition */}
            <div className="space-y-6 pt-8 border-t border-white/[0.05]" dir="rtl">
              <div className="pb-4 mb-6 text-right">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="text-sky-400" size={22} />
                  <span>أقسام الهيكل التنظيمي والوظيفي بالوكالة</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium select-none">
                  أضف أقساماً جديدة، أو احذف قسماً غير مستخدم لتخصيص كتل الكادر الوظيفي بالوكالة.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-right">
                {/* Add New Department Card */}
                <Card glass className="p-6 border-white/[0.05] h-fit">
                  <h4 className="font-black text-white mb-4 border-r-4 border-sky-500 pr-3 text-sm">
                    إضافة جناح وظيفي / قسم جديد
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-bold">
                        اسم القسم بالعربية مع الكود (مثال: البرمجة والتطوير (Dev))
                      </label>
                      <Input
                        dark
                        placeholder="برمجيات ومواقع وتطبيقات (Dev)"
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        if (!newDepartmentName) return;
                        setIsSavingDepartments(true);
                        const generatedId = `custom_${Date.now()}`;
                        const updated = [...departments, { id: generatedId, name: newDepartmentName }];
                        try {
                          await saveSettings("departments", { items: updated });
                          setDepartments(updated);
                          setNewDepartmentName("");
                          showFeedback("تمت إضافة القسم الجديد بنجاح!");
                        } catch (err) {
                          console.error(err);
                          alert("حدث خطأ أثناء حفظ القسم الجديد.");
                        } finally {
                          setIsSavingDepartments(false);
                        }
                      }}
                      disabled={isSavingDepartments}
                      className="w-full bg-sky-500 hover:bg-sky-600 font-bold"
                    >
                      {isSavingDepartments ? "جاري الإضافة والرفع..." : "إضافة قسم جديد للسيستم"}
                    </Button>
                  </div>
                </Card>

                {/* Current Departments List Card */}
                <div className="lg:col-span-2 space-y-4">
                  <Card glass className="p-6 border-white/[0.05] relative overflow-hidden text-right">
                    <h4 className="font-black text-white mb-4 border-r-4 border-sky-400 pr-3 text-sm">
                      الأقسام والكتل الوظيفية الحالية
                    </h4>
                    <div className="divide-y divide-white/[0.04] max-h-[450px] overflow-y-auto pr-1 no-scrollbar space-y-2">
                      {departments.map((dept) => (
                        <div
                          key={dept.id}
                          className="flex items-center justify-between p-3.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] hover:border-white/[0.08] rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                            <span className="text-sm font-bold text-slate-200">{dept.name}</span>
                            <span className="text-[10px] text-slate-500 bg-white/[0.04] px-2.5 py-0.5 rounded-full font-mono">
                              {dept.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirm({ id: dept.id, name: dept.name, type: "department" });
                              }}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all border border-transparent hover:border-red-500/10 cursor-pointer"
                              title="حذف القسم"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {departments.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-8 font-bold italic">لا توجد أقسام معرفة</p>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "telesales" && (
          <motion.div
            key="telesales"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <SettingsTelesales showFeedback={showFeedback} />
          </motion.div>
        )}

        {activeTab === "sales_opt" && (
          <motion.div
            key="sales_opt"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <SettingsSales showFeedback={showFeedback} />
          </motion.div>
        )}

        {false && activeTab === "telesales" && (
          <motion.div
            key="telesales"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.05]">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <MessageSquare className="text-sky-400 animate-pulse" size={22} />
                  <span>تعديل القوائم المنسدلة (الدروب ليست) للتيلي سيلز</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  تحكم بالخيارات التي تظهر لفريق المبيعات عند تسجيل المكالمات، مصادر البيانات، المتابعات وحالات الميتنجز.
                </p>
              </div>

              <Button
                onClick={handleSaveTelesalesDropdowns}
                disabled={isSavingFormDropdowns}
                className="bg-sky-500 hover:bg-sky-600 font-black text-white px-6 h-11 flex items-center gap-2 rounded-xl shadow-lg shadow-sky-500/15"
                icon={Save}
              >
                {isSavingFormDropdowns ? "جاري الحفظ والمزامنة..." : "حفظ كل التغييرات والمزامنة"}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* List 1: مصادر الداتا */}
              <Card glass className="p-6 border-white/[0.05] space-y-4">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>دروب ليست: مصادر الداتا والملفات (dataSources)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">يحدد مصدر ملفات الليدز التي توزع على موظف المبيعات للاتصال بها.</p>
                </div>

                {/* Add Item Area */}
                <div className="flex gap-2">
                  <Input
                    dark
                    placeholder="مثال: داتا/انستقرام ممول"
                    value={newDataSource}
                    onChange={(e) => setNewDataSource(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    onClick={() => {
                      if (newDataSource.trim()) {
                        if (dataSources.includes(newDataSource.trim())) {
                          alert("هذا الخيار موجود بالفعل!");
                          return;
                        }
                        setDataSources([...dataSources, newDataSource.trim()]);
                        setNewDataSource("");
                      }
                    }}
                    className="px-4 h-11"
                    icon={Plus}
                  >
                    إضافة
                  </Button>
                </div>

                {/* Chips list wrapper */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-white/[0.03] space-y-2">
                  <p className="text-[10px] font-black tracking-wider text-slate-600 block">الخيارات المسجلة حالياً ({dataSources.length}):</p>
                  <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {dataSources.map((item) => (
                      <span 
                        key={item} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold transition-all hover:bg-sky-500/20"
                      >
                        <span>{item}</span>
                        <button 
                          type="button" 
                          onClick={() => setDataSources(dataSources.filter(x => x !== item))}
                          className="text-slate-500 hover:text-rose-400 transition-colors mr-1 cursor-pointer font-black text-[13px]"
                          title="حذف هذا الخيار"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {dataSources.length === 0 && <span className="text-slate-600 text-xs font-bold">لا يوجد خيارات مضافة بعد.</span>}
                  </div>
                </div>
              </Card>

              {/* List 3: حالات الميتنج */}
              <Card glass className="p-6 border-white/[0.05] space-y-4">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>دروب ليست: حالات وجدول الميتنج والماتشينج (meetingStatuses)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">تحدد تقدم الموعد والاتفاق بعد مكاملات وربط الميتنجوز الفعلي.</p>
                </div>

                {/* Add Item Area */}
                <div className="flex gap-2">
                  <Input
                    dark
                    placeholder="مثال: تم بنجاح وسجل الفاتورة"
                    value={newMeetingStatus}
                    onChange={(e) => setNewMeetingStatus(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    onClick={() => {
                      if (newMeetingStatus.trim()) {
                        if (meetingStatuses.includes(newMeetingStatus.trim())) {
                          alert("هذا الخيار موجود بالفعل!");
                          return;
                        }
                        setMeetingStatuses([...meetingStatuses, newMeetingStatus.trim()]);
                        setNewMeetingStatus("");
                      }
                    }}
                    className="px-4 h-11"
                    icon={Plus}
                  >
                    إضافة
                  </Button>
                </div>

                {/* Chips list wrapper */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-white/[0.03] space-y-2">
                  <p className="text-[10px] font-black tracking-wider text-slate-600 block">الخيارات المسجلة حالياً ({meetingStatuses.length}):</p>
                  <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {meetingStatuses.map((item) => (
                      <span 
                        key={item} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold transition-all hover:bg-rose-500/20"
                      >
                        <span>{item}</span>
                        <button 
                          type="button" 
                          onClick={() => setMeetingStatuses(meetingStatuses.filter(x => x !== item))}
                          className="text-slate-500 hover:text-rose-400 transition-colors mr-1 cursor-pointer font-black text-[13px]"
                          title="حذف هذا الخيار"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {meetingStatuses.length === 0 && <span className="text-slate-600 text-xs font-bold">لا يوجد خيارات مضافة بعد.</span>}
                  </div>
                </div>
              </Card>

              {/* List 4: أنواع التواصل */}
              <Card glass className="p-6 border-white/[0.05] space-y-4">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>دروب ليست: أنواع وقنوات الاتصال البدئية (contactTypes)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">توضح القنوات التي يستعملها فريق المبيعات في أول مبادرة تواصل.</p>
                </div>

                {/* Add Item Area */}
                <div className="flex gap-2">
                  <Input
                    dark
                    placeholder="مثال: رسائل تويتر / إكس"
                    value={newContactType}
                    onChange={(e) => setNewContactType(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    onClick={() => {
                      if (newContactType.trim()) {
                        if (contactTypes.includes(newContactType.trim())) {
                          alert("هذا الخيار موجود بالفعل!");
                          return;
                        }
                        setContactTypes([...contactTypes, newContactType.trim()]);
                        setNewContactType("");
                      }
                    }}
                    className="px-4 h-11"
                    icon={Plus}
                  >
                    إضافة
                  </Button>
                </div>

                {/* Chips list wrapper */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-white/[0.03] space-y-2">
                  <p className="text-[10px] font-black tracking-wider text-slate-600 block">الخيارات المسجلة حالياً ({contactTypes.length}):</p>
                  <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {contactTypes.map((item) => (
                      <span 
                        key={item} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all hover:bg-emerald-500/20"
                      >
                        <span>{item}</span>
                        <button 
                          type="button" 
                          onClick={() => setContactTypes(contactTypes.filter(x => x !== item))}
                          className="text-slate-500 hover:text-rose-450 text-[#f87171] transition-colors mr-1 cursor-pointer font-black text-[13px]"
                          title="حذف هذا الخيار"
                        >
                           ×
                        </button>
                      </span>
                    ))}
                    {contactTypes.length === 0 && <span className="text-slate-600 text-xs font-bold">لا يوجد خيارات مضافة بعد.</span>}
                  </div>
                </div>
              </Card>

            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/[0.05]">
              <Button
                onClick={handleSaveTelesalesDropdowns}
                disabled={isSavingFormDropdowns}
                className="bg-sky-500 hover:bg-sky-600 font-black text-white px-8 h-12 flex items-center gap-2 rounded-xl"
                icon={Save}
              >
                {isSavingFormDropdowns ? "جاري الحفظ..." : "حفظ كل التغييرات والمزامنة على الخادم"}
              </Button>
            </div>
           </motion.div>
         )}

        {activeTab === "versions" && (
           <motion.div
            key="versions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Layers size={20} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">لقطات إصدارات النظام</h3>
              </div>
              <Button variant="secondary" className="gap-2" icon={Terminal}>
                إنشاء لقطة يدوية
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {versions.map((ver) => (
                <Card 
                  key={ver.id} 
                  glass 
                  className={cn(
                    "p-6 border-l-4 transition-all hover:translate-x-1",
                    ver.versionName === "VERSION_01" ? "border-sky-500" : "border-indigo-500"
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-white">{ver.versionName}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                          ver.versionName === "VERSION_01" ? "bg-sky-500/10 text-sky-400" : "bg-indigo-500/10 text-indigo-400"
                        )}>
                          {ver.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{ver.notes}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ver.modifiedModules?.map(mod => (
                          <span key={mod} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-500">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">التاريخ</p>
                      <p className="text-sm text-white font-mono">{ver.createdAt}</p>
                      <div className="flex items-center gap-2 justify-end pt-2">
                         <Button size="sm" variant="secondary" className="text-xs h-8">تحليل الفرق</Button>
                         <Button 
                           size="sm" 
                           variant="secondary" 
                           className="text-xs h-8 border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                           disabled={!ver.rollbackAvailable}
                         >
                           استعادة
                         </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4">
               <AlertCircle className="text-amber-500 shrink-0 mt-1" size={18} />
               <div>
                  <h4 className="text-sm font-bold text-amber-500">ملاحظة الأمان ونظام الإصدارات</h4>
                  <p className="text-xs text-amber-500/70 mt-1 leading-relaxed">
                    هذا النظام يقوم بحفظ حالة الأكواد والمنطق الخاص بالمشروع. عند طلب استعادة إصدار (Rollback)، سيقوم النظام بإعادة الحالة المستقرة المختارة. تأكد دائماً من وجود "VERSION_01" كمرجع أساسي.
                  </p>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === "targets" && (
          <motion.div
            key="targets"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 text-right"
            dir="rtl"
          >
            <Card glass className="p-8 max-w-4xl mx-auto border-white/[0.05]">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.05]">
                <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
                  <Target size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-sans">تحديد التارجت ومستهدفات الأداء</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    قم بتهيئة الأهداف الشهرية للأقسام والموظفين لمتابعة نسب الإنجاز بدقة في لوحات المتابعة المختلفة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Telesales Department Target */}
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                  <label className="text-xs font-black text-slate-400 block tracking-wider">
                    مستهدف قسم التيلي سيلز بالكامل (عدد الاجتماعات)
                  </label>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    التارجت الشهري الإجمالي لقسم التيلي سيلز بأكمله، ويقاس بعدد الاجتماعات الناجحة (تم الميتنج).
                  </p>
                  <Input
                    dark
                    type="number"
                    value={telesalesDeptTarget === 0 ? "" : telesalesDeptTarget}
                    onChange={(e) => setTelesalesDeptTarget(Number(e.target.value) || 0)}
                    placeholder="مثال: 150 اجتماع"
                    className="mt-2 text-right font-mono text-white"
                  />
                </div>

                {/* 2. Sales Department Target */}
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-sky-500" />
                  <label className="text-xs font-black text-slate-400 block tracking-wider">
                    مستهدف قسم المبيعات بالكامل (مبالغ التعاقد بـ ر.س)
                  </label>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    التارجت الشهري المالي الإجمالي لقسم المبيعات المباشرة بالكامل، ويقاس بمبالغ التعاقد الإجمالية.
                  </p>
                  <Input
                    dark
                    type="number"
                    value={salesDeptTarget === 0 ? "" : salesDeptTarget}
                    onChange={(e) => setSalesDeptTarget(Number(e.target.value) || 0)}
                    placeholder="مثال: 100000 ر.س"
                    className="mt-2 text-right font-mono text-white"
                  />
                </div>

                {/* 3. Telesales Agent Individual Target */}
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />
                  <label className="text-xs font-black text-slate-400 block tracking-wider">
                    تارجت موظف التيلي سيلز الفردي الشهري (عدد الاجتماعات)
                  </label>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    التارجت المستهدف لكل موظف تيلي سيلز منفرد خلال الشهر، ويقاس بالاجتماعات الناجحة التي حققها.
                  </p>
                  <Input
                    dark
                    type="number"
                    value={telesalesAgentMonthlyTarget === 0 ? "" : telesalesAgentMonthlyTarget}
                    onChange={(e) => setTelesalesAgentMonthlyTarget(Number(e.target.value) || 0)}
                    placeholder="مثال: 30 اجتماع لكل موظف"
                    className="mt-2 text-right font-mono text-white"
                  />
                </div>

                {/* 4. Sales Agent Individual Target */}
                <div className="space-y-3 bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-amber-500" />
                  <label className="text-xs font-black text-slate-400 block tracking-wider">
                    تارجت مسؤول المبيعات الفردي الشهري (مبالغ التعاقد بـ ر.س)
                  </label>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    التارجت المالي المستهدف لكل مسؤول مبيعات (Sales Agent) منفرد شهرياً بناءً على مبيعاته.
                  </p>
                  <Input
                    dark
                    type="number"
                    value={salesAgentMonthlyTarget === 0 ? "" : salesAgentMonthlyTarget}
                    onChange={(e) => setSalesAgentMonthlyTarget(Number(e.target.value) || 0)}
                    placeholder="مثال: 20000 ر.س لكل موظف"
                    className="mt-2 text-right font-mono text-white"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-end">
                <Button
                  loading={isSavingTargets}
                  onClick={handleSaveTargets}
                  icon={Save}
                  className="px-8 shadow-sky-500/20"
                >
                  {isSavingTargets ? "جاري حفظ التارجت..." : "حفظ مستهدفات الأداء والتارجت"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-slate-900/90 border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-3xl p-6 text-right overflow-hidden"
              dir="rtl"
            >
              {/* Top ambient orange/rose glow */}
              <div className="absolute top-0 right-1/4 left-1/4 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
              
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle size={24} />
                </div>
                
                <h3 className="text-lg font-black text-white pr-0">تأكيد عملية الحذف</h3>
                
                <p className="text-sm text-slate-300 leading-relaxed">
                  {deleteConfirm.type === "member" ? (
                    <>هل أنت متأكد من رغبتك في سحب صلاحيات الموظف <span className="text-white font-bold">({deleteConfirm.name})</span> نهائياً من السيستم؟</>
                  ) : (
                    <>هل أنت متأكد من حذف قسم <span className="text-white font-bold">({deleteConfirm.name})</span> من النظام؟ قد يؤثر هذا على تصنيف الموظفين والمهام.</>
                  )}
                </p>
                
                <div className="flex items-center gap-3 w-full mt-4">
                  <Button
                    onClick={() => setDeleteConfirm(null)}
                    variant="secondary"
                    className="flex-1 h-11 text-slate-300 border-white/[0.05] hover:bg-white/[0.05]"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={async () => {
                      const { id, type } = deleteConfirm;
                      setDeleteConfirm(null);
                      if (type === "member") {
                        await executeDeleteMember(id);
                      } else {
                        await executeDeleteDepartment(id);
                      }
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold h-11"
                  >
                    تأكيد الحذف
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmUser(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-slate-900/90 border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-3xl p-6 text-right overflow-hidden"
              dir="rtl"
            >
              {/* Top ambient orange/rose glow */}
              <div className="absolute top-0 right-1/4 left-1/4 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
              
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle size={24} />
                </div>
                
                <h3 className="text-lg font-black text-white pr-0">حذف طلب التسجيل</h3>
                
                <p className="text-sm text-slate-300 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف طلب تسجيل الموظف المعلق <span className="text-white font-bold">({deleteConfirmUser.name || deleteConfirmUser.email})</span>؟ سيتعين عليه تسجيل الدخول مجدداً لإرسال طلب جديد.
                </p>
                
                <div className="flex items-center gap-3 w-full mt-4">
                  <Button
                    onClick={() => setDeleteConfirmUser(null)}
                    variant="secondary"
                    className="flex-1 h-11 text-slate-300 border-white/[0.05] hover:bg-white/[0.05]"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={async () => {
                      const { uid } = deleteConfirmUser;
                      setDeleteConfirmUser(null);
                      await executeDeleteUser(uid);
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold h-11"
                  >
                    تأكيد الحذف
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
