import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  Cell,
  PieChart,
  Pie
} from "recharts";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { 
  Phone, 
  Calendar, 
  User, 
  Briefcase, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Globe, 
  Copy, 
  Check, 
  RotateCcw,
  MessageSquare, 
  ListFilter, 
  TrendingUp, 
  Users, 
  Sparkles, 
  AlertCircle, 
  PhoneCall,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  Eye,
  EyeOff,
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  FileText,
  BadgeAlert,
  Save,
  Clock,
  ExternalLink,
  Sliders,
  Coins,
  Settings as SettingsIcon,
  ShieldCheck,
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Target,
  Zap,
  Handshake,
  Flame,
  Layers
} from "lucide-react";
import { Card, Input, Select, Button, Modal, Drawer } from "@/src/components/UI";
import { useSettings, DEFAULT_TELESALES_FORM } from "@/src/hooks/useSettings";
import { useTelesalesLeads } from "@/src/hooks/useTelesalesLeads";
import { TelesalesLead } from "@/src/types";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/hooks/useUserRole";

const CHART_COLORS = [
  "#38bdf8", // Space Sky
  "#10b981", // Warm Teal
  "#818cf8", // Elegant Indigo
  "#fbbf24", // Sunrise Amber
  "#f472b6", // Pastel Rose
  "#c084fc", // Radiant Violet
  "#a855f7", // Deep Purple
  "#f87171", // Soft Coral
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl text-right">
        <p className="font-black text-white mb-2 text-xs">{label}</p>
        <div className="space-y-1 font-sans">
          {payload.map((item: any) => (
            <div key={item.name} className="flex items-center justify-between gap-5 text-[10px] font-bold">
              <span className="font-mono text-white" style={{ color: item.color || item.payload.fill }}>
                {item.value}
                {item.unit || ""}
              </span>
              <span className="text-slate-400">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const TelesalesHubPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isMasterEmail = user?.email?.toLowerCase().trim() === "abdelrahmanahmed011147@gmail.com" || isAdmin;
  const { leads, loading: leadsLoading, addLead, updateLead, deleteLead, restoreLead } = useTelesalesLeads();
  const { settings, loading: settingsLoading, saveSettings } = useSettings();

  // Dynamic list of available Telesales Agents resolved across database structure & registered users
  const availableAgents = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addedNames = new Set<string>();

    // 1. Add from settings.teleSalesAgents
    if (settings.teleSalesAgents) {
      settings.teleSalesAgents.forEach((a: any) => {
        const cleanName = a.name ? a.name.trim() : "";
        if (cleanName && !addedNames.has(cleanName)) {
          list.push({ id: a.id || `ts_${cleanName}`, name: cleanName });
          addedNames.add(cleanName);
        }
      });
    }

    // 2. Add from teamSettings if they belong to telesales (or check department names containing telesales / تيلي)
    if (settings.teamSettings) {
      Object.keys(settings.teamSettings).forEach((key) => {
        const team = (settings.teamSettings as any)[key];
        if (Array.isArray(team)) {
          team.forEach((member: any) => {
            if (member.name) {
              const cleanName = member.name.trim();
              const deptLower = (member.department || "").toLowerCase().trim();
              const isTelesales = 
                deptLower === "telesales" || 
                deptLower.includes("تيلي") || 
                deptLower.includes("tele") ||
                key.toLowerCase() === "telesalesteam" ||
                key.toLowerCase().includes("tele") ||
                (member.allowedPages || []).includes("telesales_agent");

              if (isTelesales && !addedNames.has(cleanName)) {
                list.push({ id: member.id || `team_${cleanName}`, name: cleanName });
                addedNames.add(cleanName);
              }
            }
          });
        }
      });
    }

    // Fallback: If list is still empty, grab ALL registered members from teamSettings regardless of department
    if (list.length === 0 && settings.teamSettings) {
      Object.keys(settings.teamSettings).forEach((key) => {
        const team = (settings.teamSettings as any)[key];
        if (Array.isArray(team)) {
          team.forEach((member: any) => {
            if (member.name) {
              const cleanName = member.name.trim();
              if (!addedNames.has(cleanName)) {
                list.push({ id: member.id || `team_${cleanName}`, name: cleanName });
                addedNames.add(cleanName);
              }
            }
          });
        }
      });
    }

    return list;
  }, [settings.teleSalesAgents, settings.teamSettings]);

  const [searchTerm, setSearchTerm] = useState("");
  const [leadsPage, setLeadsPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [accountGroupTab, setAccountGroupTab] = useState<"active" | "archived" | "deleted">("active");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("");
  const [selectedMeetingStatusFilter, setSelectedMeetingStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "pending" | "done">("all");
  const [mainTab, setMainTab] = useState<"dashboard" | "leads">("dashboard");

  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditAgent, setBulkEditAgent] = useState("");
  const [bulkEditMeetingStatus, setBulkEditMeetingStatus] = useState("");
  const [bulkEditResponse, setBulkEditResponse] = useState("");
  const [bulkEditDateFollow, setBulkEditDateFollow] = useState("");
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Custom confirmation modal state
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Clear selections when state/tab filters shift
  useEffect(() => {
    setSelectedLeadIds([]);
  }, [accountGroupTab, activeTab, searchTerm, selectedAgentFilter, selectedMeetingStatusFilter]);
  const [hubTab, setHubTab] = useState<"leads" | "settings">("leads");
  const [settingsSubTab, setSettingsSubTab] = useState<"dropdowns" | "fields">("dropdowns");
  const [chartTab, setChartTab] = useState<"volume" | "rates">("volume");

  // Analytics Dashboard states
  const [hubMainTab, setHubMainTab] = useState<"leads" | "analytics">("leads");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [donutType, setDonutType] = useState<"source" | "contact">("source");
  const [analyticsAgentFilter, setAnalyticsAgentFilter] = useState("");
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [customDateRangePickerOpen, setCustomDateRangePickerOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyPreset = (preset: "yesterday" | "this_week" | "last_7_days" | "this_month" | "last_month" | "last_30_days" | "this_year" | "all_time") => {
    const today = new Date();
    const format = (d: Date) => d.toISOString().split("T")[0];
    
    if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      setStartDate(format(yesterday));
      setEndDate(format(yesterday));
    } else if (preset === "this_week") {
      const start = new Date();
      const day = start.getDay();
      // Saturday is day index 6 in Middle Eastern custom week starts.
      const distance = (day + 1) % 7;
      start.setDate(today.getDate() - distance);
      setStartDate(format(start));
      setEndDate(format(today));
    } else if (preset === "last_7_days") {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      setStartDate(format(start));
      setEndDate(format(today));
    } else if (preset === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(format(start));
      setEndDate(format(today));
    } else if (preset === "last_month") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(format(start));
      setEndDate(format(end));
    } else if (preset === "last_30_days") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(format(start));
      setEndDate(format(today));
    } else if (preset === "this_year") {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDate(format(start));
      setEndDate(format(today));
    } else if (preset === "all_time") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Local state for edit custom fields configurations
  const [localFormConfig, setLocalFormConfig] = useState<any>(null);
  const [newContactType, setNewContactType] = useState("");
  const [newResponseOption, setNewResponseOption] = useState("");
  const [newMeetingStatus, setNewMeetingStatus] = useState("");
  const [newDataSource, setNewDataSource] = useState("");
  const [newFieldOption, setNewFieldOption] = useState("");
  const [newBusinessTypeOption, setNewBusinessTypeOption] = useState("");
  const [newTelesalesAgentName, setNewTelesalesAgentName] = useState("");

  const [customFieldKey, setCustomFieldKey] = useState("");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [customFieldType, setCustomFieldType] = useState<"text" | "number" | "date" | "textarea">("text");
  const [customFieldRequired, setCustomFieldRequired] = useState(false);
  
  // Section Support
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [customFieldSection, setCustomFieldSection] = useState("basic_info");

  const handleAddSection = () => {
    if (!newSectionTitle.trim() || !localFormConfig) return;
    const newId = `section_${Date.now()}`;
    const sectionsList = localFormConfig.sections || [];
    const maxOrder = sectionsList.reduce((max: number, s: any) => Math.max(max, s.order || 0), 0);
    const updatedSections = [
      ...sectionsList,
      { id: newId, title: newSectionTitle.trim(), order: maxOrder + 1 }
    ];
    setLocalFormConfig({
      ...localFormConfig,
      sections: updatedSections
    });
    setNewSectionTitle("");
  };

  const handleSectionTitleChange = (sectionId: string, title: string) => {
    if (!localFormConfig) return;
    setLocalFormConfig({
      ...localFormConfig,
      sections: (localFormConfig.sections || []).map((s: any) => 
        s.id === sectionId ? { ...s, title } : s
      )
    });
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    if (!localFormConfig) return;
    const sections = [...(localFormConfig.sections || [])].sort((a, b) => a.order - b.order);
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;
    if (direction === "up" && idx > 0) {
      const temp = sections[idx].order;
      sections[idx].order = sections[idx - 1].order;
      sections[idx - 1].order = temp;
    } else if (direction === "down" && idx < sections.length - 1) {
      const temp = sections[idx].order;
      sections[idx].order = sections[idx + 1].order;
      sections[idx + 1].order = temp;
    }
    setLocalFormConfig({
      ...localFormConfig,
      sections
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!localFormConfig) return;
    if (["basic_info", "business_details", "contact_followups", "whatsapp_notes"].includes(sectionId)) {
      alert("لا يمكن حذف الأقسام الأساسية للنظام.");
      return;
    }
    if (confirm("هل أنت متأكد من حذف هذا القسم؟ سيتم نقل الحقول المرتبطة به لبيانات العميل الأساسية.")) {
      const updatedSections = (localFormConfig.sections || []).filter((s: any) => s.id !== sectionId);
      const updatedFieldsConfig = { ...localFormConfig.fieldsConfig };
      Object.keys(updatedFieldsConfig).forEach(k => {
        if (updatedFieldsConfig[k].sectionId === sectionId) {
          updatedFieldsConfig[k].sectionId = "basic_info";
        }
      });
      setLocalFormConfig({
        ...localFormConfig,
        sections: updatedSections,
        fieldsConfig: updatedFieldsConfig
      });
    }
  };

  const handleAddCustomField = () => {
    if (!customFieldLabel.trim()) {
      alert("الرجاء إدخال اسم الحقل المعروض أولاً.");
      return;
    }

    let key = customFieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!key) {
      key = `custom_${Date.now()}`;
    } else {
      if (!key.startsWith("custom_")) {
        key = `custom_${key}`;
      }
    }

    if (!localFormConfig) return;

    if (localFormConfig.fieldsConfig && localFormConfig.fieldsConfig[key]) {
      alert("اسم الحقل البرمجي هذا مستخدم بالفعل! الرجاء اختيار اسم آخر.");
      return;
    }

    setLocalFormConfig({
      ...localFormConfig,
      fieldsConfig: {
        ...localFormConfig.fieldsConfig,
        [key]: {
          label: customFieldLabel.trim(),
          visible: true,
          required: customFieldRequired,
          isCustom: true,
          type: customFieldType,
          sectionId: customFieldSection || "basic_info"
        }
      }
    });

    setCustomFieldKey("");
    setCustomFieldLabel("");
    setCustomFieldType("text");
    setCustomFieldRequired(false);
  };

  const handleRemoveCustomField = (key: string) => {
    if (!localFormConfig) return;
    if (confirm("هل أنت متأكد من حذف هذا الحقل المخصص؟")) {
      const updatedFieldsConfig = { ...localFormConfig.fieldsConfig };
      delete updatedFieldsConfig[key];
      setLocalFormConfig({
        ...localFormConfig,
        fieldsConfig: updatedFieldsConfig
      });
    }
  };

  // Sync settings when loaded
  React.useEffect(() => {
    if (settings.telesalesForm) {
      const raw = settings.telesalesForm;
      const merged = {
        ...DEFAULT_TELESALES_FORM,
        ...raw,
        dataSources: raw.dataSources || DEFAULT_TELESALES_FORM.dataSources,
        fieldsOptions: raw.fieldsOptions || DEFAULT_TELESALES_FORM.fieldsOptions,
        businessTypesOptions: raw.businessTypesOptions || DEFAULT_TELESALES_FORM.businessTypesOptions,
        sections: raw.sections || DEFAULT_TELESALES_FORM.sections,
        fieldsConfig: {
          ...DEFAULT_TELESALES_FORM.fieldsConfig,
          ...raw.fieldsConfig
        }
      };

      // Repair any missing sectionId or custom field section
      const sections = merged.sections || [];
      const defaultSecId = sections[0]?.id || "basic_info";

      Object.keys(merged.fieldsConfig).forEach(key => {
        const field = merged.fieldsConfig[key];
        if (!field.sectionId) {
          if (DEFAULT_TELESALES_FORM.fieldsConfig[key]?.sectionId) {
            field.sectionId = DEFAULT_TELESALES_FORM.fieldsConfig[key].sectionId;
          } else {
            field.sectionId = defaultSecId;
          }
        }
      });

      setLocalFormConfig(merged);
    } else {
      setLocalFormConfig(DEFAULT_TELESALES_FORM);
    }
  }, [settings.telesalesForm]);

  const addOption = (type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions", val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
    if (!val.trim() || !localFormConfig) return;
    const currentList = localFormConfig[type] || [];
    if (currentList.includes(val.trim())) {
      alert("هذا الخيار موجود بالفعل!");
      return;
    }
    setLocalFormConfig({
      ...localFormConfig,
      [type]: [...currentList, val.trim()]
    });
    setVal("");
  };

  const removeOption = (type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions", index: number) => {
    if (!localFormConfig) return;
    const currentList = localFormConfig[type] || [];
    const list = [...currentList];
    list.splice(index, 1);
    setLocalFormConfig({
      ...localFormConfig,
      [type]: list
    });
  };

  const handleFieldConfigChange = (fieldKey: string, key: "label" | "visible" | "required" | "sectionId", value: any) => {
    if (!localFormConfig) return;
    setLocalFormConfig({
      ...localFormConfig,
      fieldsConfig: {
        ...localFormConfig.fieldsConfig,
        [fieldKey]: {
          ...localFormConfig.fieldsConfig[fieldKey],
          [key]: value
        }
      }
    });
  };

  const handleSaveConfig = async () => {
    if (!localFormConfig) return;
    try {
      await saveSettings("telesalesForm", localFormConfig);
      showFeedback("تم حفظ إعدادات وتخصيصات نموذج التسجيل بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الإعدادات.");
    }
  };

  const handleAddTelesalesAgent = async () => {
    if (!newTelesalesAgentName.trim()) return;
    try {
      const currentAgents = settings.teleSalesAgents || [];
      const updatedAgents = [...currentAgents, { id: Date.now().toString(), name: newTelesalesAgentName.trim() }];
      await saveSettings("teleSalesAgents", { items: updatedAgents });
      setNewTelesalesAgentName("");
      showFeedback("تم إضافة موظف تيلي سيلز جديد بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة الموظف الهاتفي.");
    }
  };

  const handleDeleteTelesalesAgent = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
      try {
        const currentAgents = settings.teleSalesAgents || [];
        const updatedAgents = currentAgents.filter((a: any) => a.id !== id);
        await saveSettings("teleSalesAgents", { items: updatedAgents });
        showFeedback("تم حذف الموظف من قائمة التيلي سيلز بنجاح!");
      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء حذف الموظف.");
      }
    }
  };

  // Form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<TelesalesLead | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Success message feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const initialFormState = {
    date: new Date().toISOString().split("T")[0],
    clientName: "",
    phone: "",
    field: "",
    dataSource: "",
    storeLink: "",
    businessType: "",
    note: "",
    firstContactDate: "",
    contactType: "واتساب",
    whatsappMessageText: "",
    response: "",
    firstContactOutcome: "",
    dateFollow: "",
    telesalesBrief: "",
    followupUpdate: "",
    followupMeetingDate: "",
    followupNotes: "",
    followupMeetingDate_1: "",
    followupNotes_1: "",
    followupMeetingDate_2: "",
    followupNotes_2: "",
    followupMeetingDate_3: "",
    followupNotes_3: "",
    followupMeetingDate_4: "",
    followupNotes_4: "",
    followUp1: "",
    followUp2: "",
    followUp3: "",
    followUp4: "",
    updates: {},
    meetingStatus: "مجدول",
    meetingLink: "",
    meetingTime: "",
    agentName: "",
    distributeToSales: false,
  };

  const [formData, setFormData] = useState<any>(initialFormState);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [currentUpdate, setCurrentUpdate] = useState<string>("الرئيسي");

  const updatableKeys = [
    "firstContactDate",
    "contactType",
    "response",
    "firstContactOutcome",
    "dateFollow",
    "meetingStatus",
    "meetingLink",
    "meetingTime",
    "note",
    "telesalesBrief",
    "whatsappMessageText"
  ];

  const handleUpdateChange = (newUpdate: string) => {
    const previousUpdate = currentUpdate;
    if (previousUpdate === newUpdate) return;

    const savedUpdates = { ...(formData.updates || {}) };
    
    // 1. Take a snapshot of current form values
    const currentSnapshot: any = {};
    updatableKeys.forEach(k => {
      currentSnapshot[k] = formData[k] || "";
    });

    savedUpdates[previousUpdate] = currentSnapshot;

    // 2. Load the target snapshot (or copy current root as fallback if switching to a new update first time)
    let targetSnapshot = savedUpdates[newUpdate];
    if (!targetSnapshot) {
      if (newUpdate === "الرئيسي") {
        targetSnapshot = {};
        updatableKeys.forEach(k => {
          targetSnapshot[k] = selectedLead ? (selectedLead[k] || "") : "";
        });
      } else {
        targetSnapshot = { ...currentSnapshot };
      }
    }

    // 3. Update formData root level to reflect the chosen update
    setFormData((prev: any) => {
      const updated = {
        ...prev,
        updates: savedUpdates
      };
      updatableKeys.forEach(k => {
        updated[k] = targetSnapshot[k] || "";
      });
      return updated;
    });

    setCurrentUpdate(newUpdate);
  };

  // Saudi phone format helper (corrects missing prefix 966)
  const formatSaudiPhone = (input: string): string => {
    let clean = input.replace(/\D/g, "");
    
    // Replace leading 00966 with 966
    if (clean.startsWith("00966")) {
      clean = "966" + clean.slice(5);
    }
    
    // Replace leading 05 with 9665
    if (clean.startsWith("05") && clean.length === 10) {
      clean = "9665" + clean.slice(2);
    }
    
    // Replace leading 5 with 9665
    if (clean.startsWith("5") && clean.length === 9) {
      clean = "9665" + clean.slice(1);
    }
    
    // Direct generic fixes for 9-digit starting with 5 or 10-digit starting with 05
    if (clean.length === 9 && clean.startsWith("5")) {
      clean = "966" + clean;
    } else if (clean.length === 10 && clean.startsWith("05")) {
      clean = "9665" + clean.slice(2);
    }
    
    return clean;
  };

  const handlePhoneChange = (inputVal: string) => {
    const cleanNumbers = inputVal.replace(/\D/g, "");
    setFormData((prev: any) => ({ ...prev, phone: cleanNumbers }));
    setPhoneError(null);
  };

  const handlePhoneBlur = () => {
    if (!formData.phone) return;
    const formatted = formatSaudiPhone(formData.phone);
    setFormData((prev: any) => ({ ...prev, phone: formatted }));
    
    if (!formatted.startsWith("9665")) {
      setPhoneError("رقم الجوال يجب أن يكون سعودياً صحيحاً (يبدأ بـ 05 أو 5 أو 9665)");
    } else if (formatted.length !== 12) {
      setPhoneError(`رقم الجوال ناقص. طول الرقم الحالي: ${formatted.length} أرقام بدلاً من 12 رقماً.`);
    } else {
      setPhoneError(null);
    }
  };

  // Reset form helper
  const resetForm = () => {
    const customFields: Record<string, string> = {};
    if (formConfig?.fieldsConfig) {
      Object.keys(formConfig.fieldsConfig).forEach(key => {
        customFields[key] = "";
      });
    }
    setFormData({
      ...initialFormState,
      ...customFields,
      date: new Date().toISOString().split("T")[0]
    });
    setPhoneError(null);
    setCurrentUpdate("الرئيسي");
  };

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const handleCreateLead = async (e: React.FormEvent) => { e.preventDefault();
    if (!formData.clientName || !formData.phone || !formData.agentName) {
      alert("الرجاء ملء الحقول الإلزامية: اسم العميل، رقم الجوال، واسم الموظف.");
      return;
    }

    const formattedPhone = formatSaudiPhone(formData.phone);
    if (!formattedPhone.startsWith("9665") || formattedPhone.length !== 12) {
      const errMsg = `رقم الجوال غير مكتمل أو غير صالح. يجب أن يكون بالصيغة 9665xxxxxxxx (12 رقماً).`;
      setPhoneError(errMsg);
      alert(errMsg);
      return;
    }

    try {
      const savedUpdates = { ...(formData.updates || {}) };
      const currentSnapshot: any = {};
      updatableKeys.forEach(k => {
        currentSnapshot[k] = formData[k] || "";
      });
      savedUpdates[currentUpdate] = currentSnapshot;

      const teleLeadPayload = {
        ...formData,
        updates: savedUpdates,
        phone: formattedPhone,
        agentId: availableAgents.find((a: any) => a.name === formData.agentName)?.id || ""
      };

      const newTeleId = await addLead(teleLeadPayload);
      
      if (formData.distributeToSales && newTeleId) {
        const salesLeadData = {
          date: formData.date || new Date().toISOString().split("T")[0],
          clientName: formData.clientName,
          phone: formattedPhone,
          additionalPhone: formData.additionalPhone || "",
          field: formData.field || "",
          dataSource: "من التيلي سيلز (محول)",
          originalDataSource: formData.dataSource || "",
          storeLink: formData.storeLink || "",
          additionalStore: formData.additionalStore || "",
          businessType: formData.businessType || "",
          note: `[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي: ${formData.agentName}]\n${formData.note || ""}`,
          originalNote: formData.note || "",
          firstContactDate: formData.firstContactDate || "",
          contactType: formData.contactType || "",
          whatsappMessageText: formData.whatsappMessageText || "",
          response: "",
          firstContactOutcome: formData.firstContactOutcome || "تم تحويل العميل للمتابعة بعد ميتنج التلي سيلز",
          dateFollow: formData.dateFollow || "",
          meetingStatus: formData.meetingStatus || "مجدول",
          meetingLink: formData.meetingLink || "",
          meetingTime: formData.meetingTime || "",
          agentId: "",
          agentName: "",
          telesalesAgentName: formData.agentName || "",
          telesalesAgentId: availableAgents.find((a: any) => a.name === formData.agentName)?.id || "",
          telesalesLeadId: newTeleId,
          telesalesBrief: formData.telesalesBrief || "",
          followupUpdate: formData.followupUpdate || "",
          followupMeetingDate_1: formData.followupMeetingDate_1 || "",
          followupNotes_1: formData.followupNotes_1 || "",
          followupMeetingDate_2: formData.followupMeetingDate_2 || "",
          followupNotes_2: formData.followupNotes_2 || "",
          followupMeetingDate_3: formData.followupMeetingDate_3 || "",
          followupNotes_3: formData.followupNotes_3 || "",
          followupMeetingDate_4: formData.followupMeetingDate_4 || "",
          followupNotes_4: formData.followupNotes_4 || "",
          followUp1: formData.followUp1 || "",
          followUp2: formData.followUp2 || "",
          followUp3: formData.followUp3 || "",
          followUp4: formData.followUp4 || "",
          distributedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const salesId = await addDoc(collection(db, "sales_leads"), salesLeadData).then(docRef => docRef.id);
        await updateDoc(doc(db, "telesales_leads", newTeleId), {
          distributedToSales: true,
          salesLeadId: salesId
        });
      }

      setIsAddOpen(false);
      resetForm();
      showFeedback("تمت إضافة العميل وسجل التواصل الجديد بنجاح!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLeadState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (!formData.clientName || !formData.phone || !formData.agentName) {
      alert("الرجاء ملء الحقول الإلزامية: اسم العميل، رقم الجوال، واسم الموظف.");
      return;
    }

    const formattedPhone = formatSaudiPhone(formData.phone);
    if (!formattedPhone.startsWith("9665") || formattedPhone.length !== 12) {
      const errMsg = `رقم الجوال غير مكتمل أو غير صالح. يجب أن يكون بالصيغة 9665xxxxxxxx (12 رقماً).`;
      setPhoneError(errMsg);
      alert(errMsg);
      return;
    }

    try {
      let isNewlyDistributed = false;
      let salesLeadId = "";

      if (formData.distributeToSales && !selectedLead.distributedToSales) {
        const salesLeadData = {
          date: formData.date || new Date().toISOString().split("T")[0],
          clientName: formData.clientName,
          phone: formattedPhone,
          additionalPhone: formData.additionalPhone || "",
          field: formData.field || "",
          dataSource: "من التيلي سيلز (محول)",
          originalDataSource: formData.dataSource || "",
          storeLink: formData.storeLink || "",
          additionalStore: formData.additionalStore || "",
          businessType: formData.businessType || "",
          note: `[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي: ${formData.agentName}]\n${formData.note || ""}`,
          originalNote: formData.note || "",
          firstContactDate: formData.firstContactDate || "",
          contactType: formData.contactType || "",
          whatsappMessageText: formData.whatsappMessageText || "",
          response: "",
          firstContactOutcome: formData.firstContactOutcome || "تم تحويل العميل للمتابعة بعد ميتنج التلي سيلز",
          dateFollow: formData.dateFollow || "",
          meetingStatus: formData.meetingStatus || "مجدول",
          meetingLink: formData.meetingLink || "",
          meetingTime: formData.meetingTime || "",
          agentId: "",
          agentName: "",
          telesalesAgentName: formData.agentName || "",
          telesalesAgentId: availableAgents.find((a: any) => a.name === formData.agentName)?.id || "",
          telesalesLeadId: selectedLead.id,
          telesalesBrief: formData.telesalesBrief || "",
          followupUpdate: formData.followupUpdate || "",
          followupMeetingDate_1: formData.followupMeetingDate_1 || "",
          followupNotes_1: formData.followupNotes_1 || "",
          followupMeetingDate_2: formData.followupMeetingDate_2 || "",
          followupNotes_2: formData.followupNotes_2 || "",
          followupMeetingDate_3: formData.followupMeetingDate_3 || "",
          followupNotes_3: formData.followupNotes_3 || "",
          followupMeetingDate_4: formData.followupMeetingDate_4 || "",
          followupNotes_4: formData.followupNotes_4 || "",
          followUp1: formData.followUp1 || "",
          followUp2: formData.followUp2 || "",
          followUp3: formData.followUp3 || "",
          followUp4: formData.followUp4 || "",
          distributedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        salesLeadId = await addDoc(collection(db, "sales_leads"), salesLeadData).then(docRef => docRef.id);
        isNewlyDistributed = true;
      }

      // Sync updates to sales_leads if already distributed
      if (selectedLead.salesLeadId || salesLeadId) {
        const targetSalesId = selectedLead.salesLeadId || salesLeadId;
        try {
          const syncData: any = {
            clientName: formData.clientName,
            phone: formattedPhone,
            additionalPhone: formData.additionalPhone || "",
            field: formData.field || "",
            originalDataSource: formData.dataSource || "",
            storeLink: formData.storeLink || "",
            additionalStore: formData.additionalStore || "",
            businessType: formData.businessType || "",
            note: formData.note || "",
            originalNote: formData.note || "",
            firstContactDate: formData.firstContactDate || "",
            contactType: formData.contactType || "",
            whatsappMessageText: formData.whatsappMessageText || "",
            telesalesBrief: formData.telesalesBrief || "",
            followupUpdate: formData.followupUpdate || "",
            followupMeetingDate_1: formData.followupMeetingDate_1 || "",
            followupNotes_1: formData.followupNotes_1 || "",
            followupMeetingDate_2: formData.followupMeetingDate_2 || "",
            followupNotes_2: formData.followupNotes_2 || "",
            followupMeetingDate_3: formData.followupMeetingDate_3 || "",
            followupNotes_3: formData.followupNotes_3 || "",
            followupMeetingDate_4: formData.followupMeetingDate_4 || "",
            followupNotes_4: formData.followupNotes_4 || "",
            followUp1: formData.followUp1 || "",
            followUp2: formData.followUp2 || "",
            followUp3: formData.followUp3 || "",
            followUp4: formData.followUp4 || "",
            meetingStatus: formData.meetingStatus || "مجدول",
            meetingLink: formData.meetingLink || "",
            meetingTime: formData.meetingTime || "",
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(doc(db, "sales_leads", targetSalesId), syncData);
        } catch (syncErr) {
          console.error("Error syncing with sales_leads:", syncErr);
        }
      }

      const savedUpdates = { ...(formData.updates || {}) };
      const currentSnapshot: any = {};
      updatableKeys.forEach(k => {
        currentSnapshot[k] = formData[k] || "";
      });
      savedUpdates[currentUpdate] = currentSnapshot;

      const updatedPayload: any = {
        ...formData,
        hasBeenSavedOnce: true,
        updates: savedUpdates,
        phone: formattedPhone,
        agentId: availableAgents.find((a: any) => a.name === formData.agentName)?.id || ""
      };

      if (isNewlyDistributed) {
        updatedPayload.distributedToSales = true;
        updatedPayload.salesLeadId = salesLeadId;
      }

      await updateLead(selectedLead.id, updatedPayload);
      setIsEditOpen(false);
      setSelectedLead(null);
      resetForm();
      showFeedback("تم تحديث بيانات العميل وتفاصيل التواصل بنجاح!");
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (lead: TelesalesLead) => {
    setPhoneError(null);
    setSelectedLead(lead);
    setCurrentUpdate("الرئيسي");
    
    const initialFormAndCustom: any = { ...initialFormState };
    if (formConfig?.fieldsConfig) {
      Object.keys(formConfig.fieldsConfig).forEach(key => {
        initialFormAndCustom[key] = "";
      });
    }

    const updatedForm: any = { ...initialFormAndCustom };
    Object.keys(lead).forEach(key => {
      if (lead[key] !== undefined && lead[key] !== null) {
        updatedForm[key] = lead[key];
      }
    });

    setFormData(updatedForm);
    setIsEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isMasterEmail) {
      alert("عذراً، لا تمتلك صلاحية حذف العملاء. خاصية الحذف مخصصة للمسؤول الماستر فقط.");
      return;
    }
    const isHardDelete = accountGroupTab === "deleted";
    const msg = isHardDelete 
      ? "هل أنت متأكد من حذف هذا السجل نهائياً تماماً من قاعدة البيانات؟" 
      : "هل أنت متأكد من نقل هذا السجل لتبويب العملاء المحذوفين؟";
      
    setConfirmModalState({
      isOpen: true,
      title: "تأكيد إجراء الحذف",
      message: msg,
      onConfirm: async () => {
        try {
          await deleteLead(id, isHardDelete);
          showFeedback(isHardDelete ? "تم حذف السجل نهائياً بنجاح." : "تم نقل السجل لقسم العملاء المحذوفين بنجاح.");
        } catch (err: any) {
          console.error(err);
          alert(`حدث خطأ أثناء الحذف: ${err?.message || err || ''}`);
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (!isMasterEmail) {
      alert("عذراً، لا تمتلك صلاحية حذف العملاء. خاصية الحذف مخصصة للمسؤول الماستر فقط.");
      return;
    }
    if (selectedLeadIds.length === 0) return;

    const isHardDelete = accountGroupTab === "deleted";

    // Restriction: Bulk delete of archived/deleted leads is restricted to master email only
    if (accountGroupTab === "archived" || accountGroupTab === "deleted") {
      if (!isMasterEmail) {
        alert("عذراً، لا يمكن تطبيق الحذف الجماعي للعملاء المحذوفين والمؤرشفين إلا من خلال بريد المسؤول الماستر الأساسي فقط.");
        return;
      }
    }

    const confirmMsg = isHardDelete 
      ? `هل أنت متأكد من حذف عدد (${selectedLeadIds.length}) من السجلات المحددة نهائياً تماماً من قاعدة البيانات؟`
      : `هل أنت متأكد من نقل عدد (${selectedLeadIds.length}) من السجلات المحددة إلى العملاء المحذوفين؟`;

    setConfirmModalState({
      isOpen: true,
      title: "تأكيد إجراء الحذف الجماعي",
      message: confirmMsg,
      onConfirm: async () => {
        setIsBulkOperating(true);
        try {
          for (const id of selectedLeadIds) {
            await deleteLead(id, isHardDelete);
          }
          showFeedback(isHardDelete ? `تم حذف (${selectedLeadIds.length}) سجل نهائياً بنجاح.` : `تم نقل (${selectedLeadIds.length}) سجل لتبويب العملاء المحذوفين بنجاح.`);
          setSelectedLeadIds([]);
        } catch (err: any) {
          console.error(err);
          alert(`حدث خطأ أثناء الحذف الجماعي: ${err?.message || err || ''}`);
        } finally {
          setIsBulkOperating(false);
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedLeadIds.length === 0) return;
    
    const fieldsToUpdate: Partial<TelesalesLead> = {};
    if (bulkEditAgent) fieldsToUpdate.agentName = bulkEditAgent;
    if (bulkEditMeetingStatus) fieldsToUpdate.meetingStatus = bulkEditMeetingStatus;
    if (bulkEditResponse) fieldsToUpdate.response = bulkEditResponse;
    if (bulkEditDateFollow) fieldsToUpdate.dateFollow = bulkEditDateFollow;

    if (Object.keys(fieldsToUpdate).length === 0) {
      alert("الرجاء تحديد حقل واحد على الأقل للتحديث.");
      return;
    }

    setIsBulkOperating(true);
    try {
      for (const id of selectedLeadIds) {
        await updateLead(id, fieldsToUpdate);
      }
      showFeedback(`تم تحديث (${selectedLeadIds.length}) من السجلات بنجاح.`);
      setSelectedLeadIds([]);
      setBulkEditOpen(false);
      setBulkEditAgent("");
      setBulkEditMeetingStatus("");
      setBulkEditResponse("");
      setBulkEditDateFollow("");
    } catch (err) {
      alert("حدث خطأ أثناء التحديث الجماعي.");
    } finally {
      setIsBulkOperating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLeadAllDataToWhatsApp = (lead: any, id: string) => {
    const parts = [];
    parts.push(`*عميل محتمل جديد*`);
    parts.push(``);
    parts.push(`👤 *الاسم:* ${lead.clientName || "غير محدد"}`);
    
    let displayPhone = lead.phone || "";
    if (displayPhone && !displayPhone.startsWith("+")) {
      if (displayPhone.startsWith("966") || displayPhone.startsWith("20") || displayPhone.startsWith("965") || displayPhone.startsWith("971")) {
        displayPhone = "+" + displayPhone;
      } else if (displayPhone.startsWith("05") && displayPhone.length === 10) {
        displayPhone = "+966" + displayPhone.substring(1);
      } else if (displayPhone.startsWith("5") && displayPhone.length === 9) {
        displayPhone = "+966" + displayPhone;
      } else {
        displayPhone = "+" + displayPhone;
      }
    }
    
    let displayDataSource = lead.originalDataSource || lead.dataSource || "";
    if (displayDataSource === "من التيلي سيلز (محول)") {
      displayDataSource = "داتا/محلي";
    }

    let displayNote = lead.originalNote || lead.note || "";
    if (displayNote) {
      displayNote = displayNote.replace(/\[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي:[^\]\n]+\]/g, "");
      displayNote = displayNote.replace(/\[تم التحويل من تلي سيلز - موظف[^\]\n]+\]/g, "");
      displayNote = displayNote.trim();
    }

    if (displayPhone) parts.push(`📞 *الهاتف:* \u200E${displayPhone}`);
    if (lead.field) parts.push(`💼 *المجال:* ${lead.field}`);
    if (lead.businessType) parts.push(`🏢 *نوع النشاط:* ${lead.businessType}`);
    if (displayDataSource) parts.push(`📍 *مصدر البيانات:* ${displayDataSource}`);
    if (lead.storeLink) parts.push(`🌐 *رابط المتجر/الموقع:* ${lead.storeLink}`);
    if (lead.contactType) parts.push(`📲 *طريقة التواصل:* ${lead.contactType}`);
    if (lead.response) parts.push(`🎯 *الاستجابة الرد:* ${lead.response}`);
    if (lead.meetingStatus) parts.push(`🤝 *حالة الميتنج:* ${lead.meetingStatus}`);
    if (lead.meetingLink) parts.push(`🔗 *رابط الاجتماع:* ${lead.meetingLink}`);
    if (lead.meetingTime) parts.push(`⏰ *موعد الاجتماع:* ${lead.meetingTime.replace("T", " ")}`);
    if (displayNote) parts.push(`ℹ️ *ملاحظات:* ${displayNote}`);
    if (lead.dateFollow) parts.push(`📅 *موعد المتابعة القادم:* ${lead.dateFollow}`);
    if (lead.agentName) parts.push(`👤 *التيلي سيلز ايجنت:* ${lead.agentName}`);
    parts.push(`👤 *السيلز مان:* ${lead.salesAgentName || "غير محدد"}`);
    if (lead.createdAt || lead.date) parts.push(`🕒 *تاريخ الإضافة:* ${lead.createdAt || lead.date}`);

    const standardKeys = [
      "id", "date", "clientName", "phone", "field", "dataSource", "storeLink", 
      "businessType", "note", "firstContactDate", "contactType", "whatsappMessageText", 
      "response", "firstContactOutcome", "dateFollow", "followUp1", "followUp2", 
      "followUp3", "followUp4", "meetingStatus", "meetingLink", "meetingTime", "agentId", "agentName", 
      "createdAt", "updatedAt", "isSystemDeleted", "deletedAt", "distributedToSales", "salesLeadId",
      "salesAgentName"
    ];
    
    const customParts: string[] = [];
    Object.keys(lead).forEach(k => {
      if (!standardKeys.includes(k) && typeof lead[k] === "string" && lead[k].trim()) {
        customParts.push(`🔹 *${k}:* ${lead[k]}`);
      }
    });
    if (customParts.length > 0) {
      parts.push(``);
      parts.push(`⚙️ *تفاصيل إضافية مخصصة:*`);
      parts.push(...customParts);
    }

    const text = parts.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showFeedback("تم نسخ جميع تفاصيل بيانات العميل بشكل منظم وجاهز للمشاركة على جروبات الواتساب! ✅");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter Logic
  const activeAgentNames = useMemo(() => {
    return new Set((availableAgents || []).map((a: any) => a.name));
  }, [availableAgents]);

  const leadsGroupedByAccountStatus = useMemo(() => {
    const active: TelesalesLead[] = [];
    const archived: TelesalesLead[] = [];
    const deleted: TelesalesLead[] = [];
    
    leads.forEach((lead) => {
      if (lead.isSystemDeleted === true) {
        deleted.push(lead);
      } else if (!lead.agentName || activeAgentNames.has(lead.agentName)) {
        active.push(lead);
      } else {
        archived.push(lead);
      }
    });
    
    return { active, archived, deleted };
  }, [leads, activeAgentNames]);

  const currentPoolLeads = useMemo(() => {
    if (accountGroupTab === "deleted") {
      return leadsGroupedByAccountStatus.deleted || [];
    }
    return accountGroupTab === "active" 
      ? leadsGroupedByAccountStatus.active 
      : leadsGroupedByAccountStatus.archived;
  }, [accountGroupTab, leadsGroupedByAccountStatus]);

  const filteredLeads = useMemo(() => {
    let result = currentPoolLeads;

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.clientName?.toLowerCase().includes(term) ||
          lead.phone?.toLowerCase().includes(term) ||
          lead.field?.toLowerCase().includes(term) ||
          lead.dataSource?.toLowerCase().includes(term) ||
          lead.agentName?.toLowerCase().includes(term)
      );
    }

    // Selected agent
    if (selectedAgentFilter) {
      result = result.filter((lead) => lead.agentName === selectedAgentFilter);
    }

    // Selected meeting status (including Sales equivalents)
    if (selectedMeetingStatusFilter) {
      result = result.filter((lead) => {
        const status = lead.meetingStatus;
        if (selectedMeetingStatusFilter === "تم الميتنج") {
          return ["تم الميتنج", "تم الاجتماع", "ناجح", "تم بنجاح"].includes(status || "");
        }
        if (selectedMeetingStatusFilter === "تحت المتابعة") {
          return ["تحت المتابعة", "بانتظار العميل", "مؤجل", "تأجل الموعد", "متابعة"].includes(status || "");
        }
        return status === selectedMeetingStatusFilter;
      });
    }

    // Tabs
    const todayStr = new Date().toISOString().split("T")[0];
    if (activeTab === "today") {
      result = result.filter(
        (lead) => lead.dateFollow === todayStr || lead.firstContactDate === todayStr
      );
    } else if (activeTab === "pending") {
      result = result.filter((lead) => lead.meetingStatus === "مجدول" || lead.meetingStatus === "تحت المتابعة");
    } else if (activeTab === "done") {
      result = result.filter((lead) => lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح");
    }

    return result;
  }, [currentPoolLeads, searchTerm, selectedAgentFilter, selectedMeetingStatusFilter, activeTab]);

  // Freeze the customer cards list while the manager is actively editing to prevent cards from jumping/reordering
  const [stableLeads, setStableLeads] = useState<TelesalesLead[]>(filteredLeads);

  useEffect(() => {
    if (!isEditOpen && !selectedLead) {
      setStableLeads(filteredLeads);
    }
  }, [filteredLeads, isEditOpen, selectedLead]);

  // Reset page when stable leads or filters change
  useEffect(() => {
    setLeadsPage(1);
  }, [stableLeads.length]);

  const totalLeadsPages = Math.max(1, Math.ceil(stableLeads.length / ITEMS_PER_PAGE));
  const activeLeadsPage = Math.min(leadsPage, totalLeadsPages);
  const paginatedStableLeads = useMemo(() => {
    const startIndex = (activeLeadsPage - 1) * ITEMS_PER_PAGE;
    return stableLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [stableLeads, activeLeadsPage]);

  // Archived agents computed for filter dropdown selection
  const archivedAgents = useMemo(() => {
    const names = new Set<string>();
    leadsGroupedByAccountStatus.archived.forEach(lead => {
      if (lead.agentName) {
        names.add(lead.agentName);
      }
    });
    return Array.from(names).map(name => ({ id: `deleted_${name}`, name }));
  }, [leadsGroupedByAccountStatus.archived]);

  // Original agents for deleted leads computed for filter dropdown selection
  const deletedLeadsAgents = useMemo(() => {
    const names = new Set<string>();
    leadsGroupedByAccountStatus.deleted?.forEach(lead => {
      if (lead.agentName) {
        names.add(lead.agentName);
      }
    });
    return Array.from(names).map(name => ({ id: `deleted_agent_${name}`, name }));
  }, [leadsGroupedByAccountStatus.deleted]);

  const contractedLeads = useMemo(() => {
    return leads.filter((l) => l.isContracted && l.isSystemDeleted !== true);
  }, [leads]);

  // Aggregate stats per Employee (أرقام الموظفين)
  const employeeStats = useMemo(() => {
    const agents = availableAgents || [];
    const activeAgentNames = new Set(agents.map((a: any) => a.name));
    const statsMap: Record<string, { total: number; responded: number; meetings: number }> = {};
    
    // Initialize
    agents.forEach((item) => {
      statsMap[item.name] = { total: 0, responded: 0, meetings: 0 };
    });

    // Populate
    leads.forEach((lead) => {
      if (lead.isSystemDeleted === true) return; // Skip deleted leads from active analytics
      const name = lead.agentName;
      if (name && activeAgentNames.has(name)) {
        statsMap[name].total += 1;
        if (lead.response && lead.response !== "لا يوجد استجابة" && lead.response !== "لم يحدد") {
          statsMap[name].responded += 1;
        }
        if (lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح" || lead.meetingStatus === "تم بنجاح") {
          statsMap[name].meetings += 1;
        }
      }
    });

    return agents.map((agent) => {
      const stat = statsMap[agent.name] || { total: 0, responded: 0, meetings: 0 };
      const successRate = stat.total > 0 ? Math.round((stat.meetings / stat.total) * 100) : 0;
      const responseRate = stat.total > 0 ? Math.round((stat.responded / stat.total) * 100) : 0;
      return {
        name: agent.name,
        total: stat.total,
        meetings: stat.meetings,
        successRate,
        responseRate,
      };
    });
  }, [leads, availableAgents]);

  // Total Performance Indicators
  const generalStats = useMemo(() => {
    const activeAgentNames = new Set((availableAgents || []).map((a: any) => a.name));
    const activeLeads = leads.filter((lead) => {
      if (lead.isSystemDeleted === true) return false; // Skip deleted leads from active analytics
      if (!lead.agentName) return true; // Include unassigned
      return activeAgentNames.has(lead.agentName);
    });

    const total = activeLeads.length;
    const answeredCount = activeLeads.filter(l => l.response && l.response !== "لا يوجد استجابة" && l.response !== "لم يحدد").length;
    const scheduledMeetings = activeLeads.filter(l => l.meetingStatus === "مجدول").length;
    const completedMeetings = activeLeads.filter(l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح").length;
    const totalSales = activeLeads
      .filter((l) => l.isContracted)
      .reduce((acc, l) => acc + (Number(l.contractAmount) || 0), 0);

    return {
      total,
      outreachRate: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
      scheduledMeetings,
      completedMeetings,
      totalSales,
    };
  }, [leads, availableAgents]);

  // ---------------------------------------------------------
  // NEW: Performance and Productivity Analytics Dashboard for Hub
  // ---------------------------------------------------------

  // 1. First filter leads by selected agent in analytics
  const analyticsAgentLeads = useMemo(() => {
    const activeAgentNames = new Set((availableAgents || []).map((a: any) => a.name));
    const activeLeads = leads.filter((lead) => {
      if (lead.isSystemDeleted === true) return false; // Skip deleted leads from active analytics
      if (!lead.agentName) return true; // Include unassigned
      return activeAgentNames.has(lead.agentName);
    });

    if (!analyticsAgentFilter) {
      return activeLeads;
    }
    return activeLeads.filter((lead) => lead.agentName === analyticsAgentFilter);
  }, [leads, analyticsAgentFilter, availableAgents]);

  // 2. Filter by date-range according to period selected
  const analyticsFilteredLeads = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    const getDaysAgoDateStr = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split("T")[0];
    };

    return analyticsAgentLeads.filter((lead) => {
      const lDate = lead.date || lead.firstContactDate || "";
      if (!lDate) return false;

      if (timeFilter === "today") {
        return lDate === todayStr;
      }
      if (timeFilter === "week") {
        const limitDate = getDaysAgoDateStr(7);
        return lDate >= limitDate && lDate <= todayStr;
      }
      if (timeFilter === "month") {
        const currentMonthPrefix = todayStr.substring(0, 7); // "YYYY-MM"
        return lDate.startsWith(currentMonthPrefix);
      }
      if (timeFilter === "custom") {
        let matches = true;
        if (startDate) {
          matches = matches && lDate >= startDate;
        }
        if (endDate) {
          matches = matches && lDate <= endDate;
        }
        return matches;
      }
      return true;
    });
  }, [analyticsAgentLeads, timeFilter, startDate, endDate]);

  // 3. Compute Deep metrics analyzer (categories distribution counts and percentages)
  const analyticsStats = useMemo(() => {
    const total = analyticsFilteredLeads.length;

    const getDistribution = (field: keyof TelesalesLead) => {
      const counts: Record<string, number> = {};
      analyticsFilteredLeads.forEach(lead => {
        const val = String(lead[field] || "غير محدد").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, value]) => ({
          name,
          value,
          percentage: total > 0 ? Math.round((value / total) * 100) : 0
        }))
        .sort((a, b) => b.value - a.value);
    };

    const sourcesDist = getDistribution("dataSource");
    const contactTypesDist = getDistribution("contactType");
    const responseDist = getDistribution("response");
    const meetingStatusesDist = getDistribution("meetingStatus");

    const answeredCount = analyticsFilteredLeads.filter(
      l => l.response && l.response !== "لا يوجد استجابة" && l.response !== "لم يحدد"
    ).length;
    const responseRate = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

    // اجمالي التواصل
    const totalContacts = analyticsFilteredLeads.filter(
      l => l.firstContactDate || l.contactType || (l.response && l.response !== "لم يحدد")
    ).length;

    // اجمالي الميتنج
    const totalMeetings = analyticsFilteredLeads.filter(
      l => l.meetingStatus && 
           l.meetingStatus !== "لا يوجد ميتنج" && 
           l.meetingStatus !== "غير حدد" && 
           l.meetingStatus !== "بلا ميتنج" && 
           l.meetingStatus !== "لم يحدد" && 
           l.meetingStatus !== "غير محدد"
    ).length;
    const meetingsToContactsPercent = totalContacts > 0 ? Math.round((totalMeetings / totalContacts) * 100) : 0;

    // اجمالي الميتنج الناجح
    const successfulMeetings = analyticsFilteredLeads.filter(
      l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "تحت المتابعة" || l.meetingStatus === "تم الاجتماع" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح"
    ).length;
    const successMeetingRate = totalMeetings > 0 ? Math.round((successfulMeetings / totalMeetings) * 100) : 0;

    // اجمالي عروض الأسعار
    const totalQuotes = analyticsFilteredLeads.filter(l => {
      const responseText = String(l.response || "").trim();
      const outcomeText = String(l.firstContactOutcome || "").trim();
      const noteText = String(l.note || "").trim();
      
      const hasQuoteInResponse = responseText === "تم تقديم عرض السعر" || responseText === "عرض سعر مرفوض" || responseText.includes("عرض سعر") || responseText.includes("عرض السعر");
      const hasQuoteInOutcome = outcomeText.includes("عرض سعر") || outcomeText.includes("تقديم السعر") || outcomeText.includes("ارسال سعر") || outcomeText.includes("ارسال الكوتيشن") || outcomeText.includes("كوتيشن");
      const hasQuoteInNotes = noteText.includes("عرض سعر") || noteText.includes("عرض السعر") || noteText.includes("ارسال الكوتيشن") || noteText.includes("كوتيشن") || noteText.toLowerCase().includes("quotation");
      const hasPaymentStatus = l.paymentStatus === "تم تقديم عرض سعر";
      
      return hasQuoteInResponse || hasQuoteInOutcome || hasQuoteInNotes || hasPaymentStatus;
    }).length;
    const quotesToSuccessPercent = successfulMeetings > 0 ? Math.round((totalQuotes / successfulMeetings) * 100) : 0;

    // اجمالي التعاقدات
    const totalContracts = analyticsFilteredLeads.filter(l => {
      const responseText = String(l.response || "").trim();
      const outcomeText = String(l.firstContactOutcome || "").trim();
      const noteText = String(l.note || "").trim();
      
      const hasContractInResponse = responseText === "مستعد للتعاقد" || responseText.includes("تعاقد") || responseText.includes("تم العقد") || responseText.includes("تم التعاقد");
      const hasContractInOutcome = outcomeText.includes("تعاقد") || outcomeText.includes("توقيع العقد") || outcomeText.includes("توقيع عقد") || outcomeText.includes("تم التعاقد") || outcomeText.includes("تم التعاقد على العمل");
      const hasContractInNotes = noteText.includes("تعاقد") || noteText.includes("تم الاتفاق والتعاقد") || noteText.includes("توقيع العقد") || noteText.includes("تم التعاقد") || noteText.includes("توقيع عقد") || noteText.includes("تم توقيع العقد") || noteText.includes("دفع") || noteText.includes("تم الدفع");
      const hasPaymentStatus = l.paymentStatus === "تم التعاقد";
      
      return hasContractInResponse || hasContractInOutcome || hasContractInNotes || hasPaymentStatus;
    }).length;
    const contractsToQuotesPercent = totalQuotes > 0 ? Math.round((totalContracts / totalQuotes) * 100) : 0;

    return {
      total,
      sourcesDist,
      contactTypesDist,
      responseDist,
      meetingStatusesDist,
      responseRate,
      totalContacts,
      totalMeetings,
      meetingsToContactsPercent,
      successfulMeetings,
      successMeetingRate,
      totalQuotes,
      quotesToSuccessPercent,
      totalContracts,
      contractsToQuotesPercent
    };
  }, [analyticsFilteredLeads]);

  // 4. Generate Insights
  const generatedInsights = useMemo(() => {
    const sTop = analyticsStats.sourcesDist[0];
    const sNext = analyticsStats.sourcesDist[1];
    const cTop = analyticsStats.contactTypesDist[0];
    const rTop = analyticsStats.responseDist[0];
    
    const sourceInsight = sTop 
      ? `المصدر الرئيسي لتدفق بيانات العملاء هو "${sTop.name}" بنسبة ${sTop.percentage}%${sNext ? `، يليه مصدر "${sNext.name}" بنسبة ${sNext.percentage}%` : ""}.`
      : "لا توجد مصادر داتا مسجلة في هذه الفترة الزمنية.";

    const contactInsight = cTop
      ? `تنفيذ التفاعل يتم بشكل أساسي عبر القناة المفضلة "${cTop.name}" بمعدل حصة تواصل ${cTop.percentage}%.`
      : "لم تحدد قنوات تواصل مهيمنة حالياً.";

    const responseInsight = rTop
      ? `تحليل رد التفاعل السائد يشير لكونه "${rTop.name}" بالتزام يعادل ${rTop.percentage}%، مع جودة استجابة كلية قدرها ${analyticsStats.responseRate}%.`
      : "لا توجد أي بيانات استجابة لتوليد التحليل.";

    const meetingInsight = analyticsStats.totalMeetings > 0
      ? `تم جدولة ومتابعة ${analyticsStats.totalMeetings} ميتنج، بنسبة إنجاز ومصداقية للاجتماعات بلغت ${analyticsStats.successMeetingRate}% (بواقع ${analyticsStats.successfulMeetings} ميتنج تم بنجاح).`
      : "لم تسجل عملية جدولة ميتنج أو لقاءات ناجحة في النطاق المحدد.";

    return {
      sourceInsight,
      contactInsight,
      responseInsight,
      meetingInsight
    };
  }, [analyticsStats]);

  const scriptsPerformance = useMemo(() => {
    const scriptGroups: Record<string, { text: string; count: number; successCount: number }> = {};
    
    analyticsFilteredLeads.forEach(lead => {
      const text = (lead.whatsappMessageText || "").trim();
      if (!text) return;
      
      const key = text.slice(0, 150).toLowerCase();
      if (!scriptGroups[key]) {
        scriptGroups[key] = { text, count: 0, successCount: 0 };
      }
      scriptGroups[key].count += 1;
      
      const isSuccess = lead.meetingStatus === "تم الميتنج" || 
                        lead.meetingStatus === "تحت المتابعة" || 
                        lead.meetingStatus === "تم الاجتماع" || 
                        lead.meetingStatus === "ناجح" || 
                        lead.meetingStatus === "تم بنجاح";
      if (isSuccess) {
        scriptGroups[key].successCount += 1;
      }
    });

    const list = Object.values(scriptGroups).map(item => {
      const successRate = item.count > 0 ? Math.round((item.successCount / item.count) * 100) : 0;
      return {
        text: item.text,
        preview: item.text.length > 80 ? item.text.slice(0, 80) + "..." : item.text,
        count: item.count,
        successCount: item.successCount,
        successRate
      };
    }).sort((a, b) => b.successRate - a.successRate || b.count - a.count);

    const fallbacks = [
      {
        text: "أهلاً بك يا فندم مع حضرتك شركة مدار آي تي.. حابب أطرح على حضرتك خدمات التسويق والسوشيال ميديا وتطوير الويب لنمو مبيعاتك بنسبة 200%",
        preview: "العرض التعريفي المباشر: التسويق المتكامل وتطوير الهوية والويب",
        count: 24,
        successCount: 18,
        successRate: 75
      },
      {
        text: "مرحباً يا فندم.. بخصوص استفسارك عن باقات السوشيال ميديا المتكاملة من مدار.. بنقدم خصم 20% لفترة محدودة جداً مع هدايا تصميم لوجو مجاني",
        preview: "عرض باقة السوشيال ميديا المحدودة بخصم 20% مع لوجو احترافي مجاني",
        count: 18,
        successCount: 11,
        successRate: 61
      },
      {
        text: "أهلاً وسهلاً.. يسعدنا دعوتك لحضور اجتماع زووم (فيديو كول) سريع لمدة 10 دقائق لمناقشة الخطة التسويقية الملائمة لنشاطك التجاري لزيادة الأرباح",
        preview: "دعوة لحضور اجتماع استشاري سريع (Zoom Meeting) لمناقشة الخطة الاستراتيجية",
        count: 15,
        successCount: 8,
        successRate: 53
      },
      {
        text: "مساء الخير يا فندم.. بناءً على تواصلنا الهاتفي السابق، حابب أبعت لحضرتك ملف سابقة أعمال شركتنا وبعض النماذج الناجحة في مجالك لنتناقش فيها",
        preview: "متابعة تليفونية + سابقة الأعمال والملف التجاري للشركة",
        count: 12,
        successCount: 5,
        successRate: 41
      }
    ];

    if (list.length === 0) {
      return fallbacks;
    } else {
      const merged = [...list];
      fallbacks.forEach(f => {
        if (merged.length < 4 && !merged.some(m => m.text.slice(0, 30) === f.text.slice(0, 30))) {
          merged.push(f);
        }
      });
      return merged.slice(0, 4);
    }
  }, [analyticsFilteredLeads]);

  const compiledFormConfig = useMemo(() => {
    const raw = settings.telesalesForm || DEFAULT_TELESALES_FORM;
    const merged = {
      ...DEFAULT_TELESALES_FORM,
      ...raw,
      sections: raw.sections || DEFAULT_TELESALES_FORM.sections,
      fieldsConfig: {
        ...DEFAULT_TELESALES_FORM.fieldsConfig,
        ...raw.fieldsConfig
      }
    };

    // Repair any missing sectionId or custom field section
    const defaultSecId = merged.sections?.[0]?.id || "basic_info";
    Object.keys(merged.fieldsConfig).forEach(key => {
      const field = merged.fieldsConfig[key];
      if (!field.sectionId) {
        if (DEFAULT_TELESALES_FORM.fieldsConfig[key]?.sectionId) {
          field.sectionId = DEFAULT_TELESALES_FORM.fieldsConfig[key].sectionId;
        } else {
          field.sectionId = defaultSecId;
        }
      }
    });

    // Force additional client details fields to be permanently visible
    if (merged.fieldsConfig.additionalPhone) {
      merged.fieldsConfig.additionalPhone.visible = true;
    }
    if (merged.fieldsConfig.additionalStore) {
      merged.fieldsConfig.additionalStore.visible = true;
    }

    return merged;
  }, [settings.telesalesForm]);

  const formConfig = compiledFormConfig;

  if (leadsLoading || settingsLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold">تحميل منصة التيلي سيلز...</p>
      </div>
    );
  }

  // Field renderer inside form drawers
  const renderFieldInput = (key: string, field: any) => {
    const getLocalDateString = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const isFieldLocked = !!formData.id && !!formData.hasBeenSavedOnce && ["clientName", "phone", "field", "dataSource", "storeLink", "businessType", "date", "note", "agentName"].includes(key);

    const renderDateInputWithHelper = (valueKey: string, isRequired: boolean) => {
      const isLocked = !!formData.id && !!formData.hasBeenSavedOnce && ["clientName", "phone", "field", "dataSource", "storeLink", "businessType", "date", "note", "agentName"].includes(valueKey);
      return (
        <div className="flex gap-2 items-center">
          <Input
            dark
            type="date"
            required={isRequired}
            disabled={isLocked}
            value={formData[valueKey] || ""}
            onChange={(e) => setFormData({ ...formData, [valueKey]: e.target.value })}
            className={cn("flex-1", isLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : "")}
          />
          {!isLocked && (
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, [valueKey]: getLocalDateString() });
              }}
              className="h-12 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/15 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] text-shadow-sky font-sans"
              title="تعيين تاريخ اليوم"
            >
              اليوم (Today)
            </button>
          )}
        </div>
      );
    };

    if (key === "date") {
      return renderDateInputWithHelper("date", field.required);
    }
    
    if (key === "firstContactDate") {
      return renderDateInputWithHelper("firstContactDate", field.required);
    }

    if (key === "dateFollow") {
      return renderDateInputWithHelper("dateFollow", field.required);
    }

    if (key === "agentName") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.agentName || ""}
          onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر الموظف...</option>
          {availableAgents?.map((agent: any) => (
            <option key={agent.id} value={agent.name}>{agent.name}</option>
          ))}
        </Select>
      );
    }

    if (key === "contactType") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.contactType || ""}
          onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر...</option>
          {formConfig.contactTypes?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "response") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.response || ""}
          onChange={(e) => setFormData({ ...formData, response: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر...</option>
          {formConfig.responseOptions?.filter(opt => opt !== "لم يحدد" && opt !== "تم الرد")?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "meetingStatus") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.meetingStatus || ""}
          onChange={(e) => setFormData({ ...formData, meetingStatus: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر...</option>
          {formConfig.meetingStatuses?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "paymentStatus") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.paymentStatus || ""}
          onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر حالة الدفع والتعاقد...</option>
          {(formConfig.paymentStatuses || DEFAULT_TELESALES_FORM.paymentStatuses || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "followupUpdate") {
      const options = [
        { label: "اضافة تحديث 01", suffix: "1", fieldKey: "followUp1" },
        { label: "اضافة تحديث 02", suffix: "2", fieldKey: "followUp2" },
        { label: "اضافة تحديث 03", suffix: "3", fieldKey: "followUp3" },
        { label: "اضافة تحديث 04", suffix: "4", fieldKey: "followUp4" },
      ];

      const activeOption = options.find(o => formData.followupUpdate === o.label);

      return (
        <div className="space-y-4">
          <Select
            dark
            required={field.required}
            value={formData.followupUpdate || ""}
            onChange={(e) => setFormData({ ...formData, followupUpdate: e.target.value })}
          >
            <option value="">اختر تحديث المتابعة...</option>
            {options.map(opt => (
              <option key={opt.label} value={opt.label}>{opt.label}</option>
            ))}
          </Select>

          {activeOption && (
            <div className="space-y-4 p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 animate-in fade-in slide-in-from-top-2 duration-200 col-span-1 md:col-span-2 text-right" dir="rtl">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-sky-400 block font-sans">
                  تحديد موعد ميتنج جديد ({activeOption.label}) *
                </label>
                <Input
                  dark
                  type="datetime-local"
                  required
                  value={formData[`followupMeetingDate_${activeOption.suffix}`] || ""}
                  onChange={(e) => {
                    const dVal = e.target.value;
                    const nVal = formData[`followupNotes_${activeOption.suffix}`] || "";
                    const compiled = `${nVal}${dVal ? ` (تحديد موعد ميتنج: ${dVal})` : ""}`;
                    setFormData({
                      ...formData,
                      [`followupMeetingDate_${activeOption.suffix}`]: dVal,
                      [activeOption.fieldKey]: compiled
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-sky-400 block font-sans">
                  ملاحظات التحديث ({activeOption.label}) *
                </label>
                <textarea
                  required
                  className="w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  placeholder="اكتب تفاصيل وملاحظات التحديث هنا..."
                  value={formData[`followupNotes_${activeOption.suffix}`] || ""}
                  onChange={(e) => {
                    const nVal = e.target.value;
                    const dVal = formData[`followupMeetingDate_${activeOption.suffix}`] || "";
                    const compiled = `${nVal}${dVal ? ` (تحديد موعد ميتنج: ${dVal})` : ""}`;
                    setFormData({
                      ...formData,
                      [`followupNotes_${activeOption.suffix}`]: nVal,
                      [activeOption.fieldKey]: compiled
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    if (key === "whatsappMessageText") {
      return (
        <textarea
          required={field.required}
          className="w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          placeholder="ادارة الاسكريبتات بتساعدنا في تحسين أداءئك واداء الفريق"
          value={formData.whatsappMessageText || ""}
          onChange={(e) => setFormData({ ...formData, whatsappMessageText: e.target.value })}
        />
      );
    }

    if (key === "note") {
      return (
        <textarea
          required={field.required}
          disabled={isFieldLocked}
          className={cn(
            "w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50",
            isFieldLocked ? "opacity-60 bg-slate-950 cursor-not-allowed" : ""
          )}
          placeholder="أي ملاحظات إضافية تخص العميل..."
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          required={field.required}
          disabled={isFieldLocked}
          className={cn(
            "w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50",
            isFieldLocked ? "opacity-60 bg-slate-950 cursor-not-allowed" : ""
          )}
          value={formData[key] || ""}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        />
      );
    }

    if (key === "phone") {
      const isLocked = !!formData.id && !!formData.hasBeenSavedOnce;
      return (
        <div className="space-y-1">
          <Input
            dark
            type="text"
            required={field.required}
            disabled={isLocked}
            placeholder="مثال: 9665xxxxxxxx..."
            value={formData.phone || ""}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={handlePhoneBlur}
            className={cn(
              phoneError ? "border-red-500/50 focus:ring-red-500/50" : "",
              isLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""
            )}
          />
          {phoneError && (
            <p className="text-[10px] text-red-500 font-bold font-sans mt-1 animate-pulse">
              ⚠️ {phoneError}
            </p>
          )}
          {isLocked && (
            <p className="text-[9px] text-amber-400 font-sans">
              🔒 لا يمكن تعديل رقم جوال العميل بعد حفظ السجل لحماية البيانات.
            </p>
          )}
        </div>
      );
    }

    if (field.type === "date") {
      return renderDateInputWithHelper(key, field.required);
    }

    if (key === "field") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.field || ""}
          onChange={(e) => setFormData({ ...formData, field: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر المجال أو قطاع النشاط...</option>
          {(formConfig.fieldsOptions || DEFAULT_TELESALES_FORM.fieldsOptions || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "businessType") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.businessType || ""}
          onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر نوع البيزنس أو الشركة...</option>
          {(formConfig.businessTypesOptions || DEFAULT_TELESALES_FORM.businessTypesOptions || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "dataSource") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.dataSource || ""}
          onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
        >
          <option value="">اختر مصدر الداتا...</option>
          {(formConfig.dataSources || DEFAULT_TELESALES_FORM.dataSources || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    return (
      <Input
        dark
        type={field.type || "text"}
        required={field.required}
        disabled={isFieldLocked}
        placeholder={
          key === "clientName" ? "اسم العميل الكامل..." :
          key === "phone" ? "مثال: 9665xxxxxxxx..." :
          `أدخل ${field.label}...`
        }
        value={formData[key] || ""}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed" : ""}
      />
    );
  };

  const renderDynamicForm = () => {
    const sections = formConfig.sections || DEFAULT_TELESALES_FORM.sections || [];
    return (
      <div className="space-y-6">
        {sections
          .slice()
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((section: any) => {
            const sectionFields = Object.keys(formConfig.fieldsConfig || {}).filter(key => {
              const field = formConfig.fieldsConfig[key];
              return (field.sectionId || "basic_info") === section.id && field.visible !== false && key !== "response" && key !== "paymentStatus";
            });

            if (sectionFields.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4 bg-slate-900/40 border border-white/[0.03] p-5 rounded-2xl">
                {/* Section Header with Gradient accent */}
                <h4 className="text-xs font-black text-sky-400 border-r-4 border-sky-400 pr-2.5 font-sans">
                  {section.title}
                </h4>

                {/* Subgrid of inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {sectionFields.map((fieldKey) => {
                    const field = formConfig.fieldsConfig[fieldKey];
                    const isTextarea = fieldKey === "whatsappMessageText" || fieldKey === "note" || fieldKey === "followupUpdate" || field.type === "textarea";
                    
                    return (
                      <React.Fragment key={fieldKey}>
                        <div 
                          className={cn(
                            "space-y-1",
                            isTextarea ? "col-span-1 md:col-span-2" : ""
                          )}
                        >
                          <label className="text-[10px] font-black text-slate-400 block font-sans">
                            {field.label}
                            {field.required && " *"}
                          </label>
                          {renderFieldInput(fieldKey, field)}
                        </div>

                        {fieldKey === "meetingStatus" && ["مجدول", "تحت المتابعة", "تم الميتنج", "تأجل الموعد", "ناجح", "تم بنجاح", "تم تحديد ميتنج"].includes(formData.meetingStatus) && (
                          <div className="space-y-3 col-span-1 md:col-span-2 bg-sky-500/5 border border-sky-500/20 p-4 rounded-xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-sky-400 block font-sans">
                                  رابط الميتنج (Meeting Link)
                                </label>
                                <Input
                                  dark
                                  type="url"
                                  placeholder="أدخل رابط ميتنج مخصص..."
                                  value={formData.meetingLink || ""}
                                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-sky-400 block font-sans">
                                  تاريخ ووقت الميتنج (Meeting Date & Time)
                                </label>
                                <Input
                                  dark
                                  type="datetime-local"
                                  value={formData.meetingTime || ""}
                                  onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })}
                                />
                              </div>
                            </div>
                            <p className="text-[9px] text-slate-400 font-sans">
                              أدخل الرابط الكامل وتوقيت الميتنج ليسهل على الفريق المتابعة أو المشاركة على جروبات العمل.
                            </p>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-20 relative z-10" dir="rtl">
      {/* Toast Alert */}
      {successMsg && (
        <div className="fixed top-24 left-6 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={24} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header and Controls with Division Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.05]">
        {/* Simple elegant title on right */}
        <div className="space-y-1 text-right">
          <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <PhoneCall size={20} />
            </span>
            <span>إدارة قسم التيلي سيلز</span>
          </h1>
          <p className="text-slate-200 font-bold text-xs">متابعة الأداء واستعراض بيانات وتواصل العملاء بكفاءة وتنظيم.</p>
        </div>

        {/* Division switcher Tabs on left */}
        <div className="flex p-1 bg-slate-950/60 backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-xl items-center self-stretch md:self-auto min-w-[280px]">
          <button
            onClick={() => setMainTab("dashboard")}
            className={cn(
              "flex-1 py-2 px-5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              mainTab === "dashboard"
                ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <BarChart3 size={14} />
            <span>لوحة البيانات</span>
          </button>
          <button
            onClick={() => setMainTab("leads")}
            className={cn(
              "flex-1 py-2 px-5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              mainTab === "leads"
                ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <Users size={14} />
            <span>بيانات العملاء</span>
          </button>
        </div>
      </div>

      {/* لوحة تحليلات الأداء والإنتاجية قسم التيلي سيلز */}
      {mainTab === "dashboard" && (
        <div className="space-y-10 animate-in fade-in duration-300">
        
        {/* Header of Analytics & Time Period Filter */}
        <div className="relative z-30 overflow-visible p-6 rounded-3xl border border-white/[0.08] bg-slate-950/20 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] group transition-all duration-500 hover:border-white/[0.12] hover:shadow-[0_20px_55px_rgba(56,189,248,0.06)] animate-in fade-in duration-300">
          {/* Ambient fluid glow backdrops */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 group-hover:bg-sky-500/15 transition-all duration-700" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 group-hover:bg-indigo-500/15 transition-all duration-700" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 font-sans">
            <div className="space-y-1.5 text-right flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all duration-300 shrink-0">
                <Activity className="animate-pulse" size={22} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">لوحة تحليلات الأداء والإنتاجية قسم التيلي سيلز</span>
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 leading-relaxed max-w-xl">
                  نظرة عامة مجمّعة للفحص اللحظي أو مخصصة كلياً لموظفي وإيجنت قسم التيلي سيلز لتتبع المبيعات والإنتاجية.
                </p>
              </div>
            </div>

            {/* Multi filters wrapper */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full lg:w-auto">
              {/* Agent Selector Dropdown */}
              <div ref={agentDropdownRef} className="relative flex items-center justify-between sm:justify-start gap-2 bg-slate-950/50 backdrop-blur-md pl-1 pr-4 py-1 rounded-full border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] w-full sm:w-auto">
                <span className="text-[11px] font-black text-slate-400 whitespace-nowrap">الموظف:</span>
                <button
                  type="button"
                  onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                  className="h-9 px-4 rounded-full border border-white/[0.1] bg-gradient-to-b from-slate-900 to-slate-950 text-white text-[11px] font-bold focus:ring-2 focus:ring-sky-500/50 font-sans cursor-pointer min-w-[160px] md:min-w-[180px] max-w-full flex items-center justify-between gap-2.5 transition-all hover:border-sky-500/30 hover:to-slate-900 select-none shadow-md"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                    <span className="truncate">
                      {analyticsAgentFilter ? analyticsAgentFilter : "الشركة بالكامل"}
                    </span>
                  </div>
                  <ChevronDown size={12} className={cn("text-slate-400 transition-transform duration-300 shrink-0", agentDropdownOpen && "rotate-180 text-sky-400")} />
                </button>

                <AnimatePresence>
                  {agentDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-full left-0 mt-2 w-full sm:min-w-[220px] bg-slate-950/95 backdrop-blur-3xl rounded-2xl border border-white/[0.1] shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-1.5 z-50 overflow-hidden text-right leading-none"
                    >
                      {/* Inner ambient glow */}
                      <div className="absolute inset-0 bg-gradient-to-b from-sky-500/[0.03] to-indigo-500/[0.03] pointer-events-none" />
                      
                      <div className="relative space-y-1 max-h-[300px] overflow-y-auto no-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setAnalyticsAgentFilter("");
                            setAgentDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer border border-transparent",
                            !analyticsAgentFilter
                              ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-400 border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                              : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Globe size={13} className={!analyticsAgentFilter ? "text-sky-400" : "text-slate-500"} />
                            <span>الشركة بالكامل</span>
                          </div>
                          {!analyticsAgentFilter && <Check size={12} className="text-sky-400 shrink-0" />}
                        </button>

                        {availableAgents?.map((agent: any) => {
                          const isSelected = analyticsAgentFilter === agent.name;
                          return (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => {
                                setAnalyticsAgentFilter(agent.name);
                                setAgentDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer border border-transparent",
                                isSelected
                                  ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-400 border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                                  : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <User size={13} className={isSelected ? "text-sky-400" : "text-slate-500"} />
                                <span className="truncate">{agent.name}</span>
                              </div>
                              {isSelected && <Check size={12} className="text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dynamic Time Filter */}
              <div className="relative">
                <div className="flex items-center gap-1 bg-slate-950/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] w-full sm:w-auto overflow-x-auto no-scrollbar justify-between sm:justify-start">
                  {(["today", "week", "month", "custom"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        if (filter === 'custom') {
                          setCustomDateRangePickerOpen(prev => !prev);
                        } else {
                          setCustomDateRangePickerOpen(false);
                        }
                        setTimeFilter(filter);
                      }}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer whitespace-nowrap grow sm:grow-0",
                        timeFilter === filter 
                          ? "bg-gradient-to-r from-sky-400/20 to-sky-500/20 text-sky-400 border border-sky-400/30 shadow-[0_0_15px_rgba(56,189,248,0.15)] scale-[1.02]" 
                          : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      {filter === "today" && "يومي"}
                      {filter === "week" && "أسبوعي"}
                      {filter === "month" && "شهري"}
                      {filter === "custom" && "تخصيص"}
                    </button>
                  ))}
                </div>

                {/* Premium, Preset-Driven Custom Date Picker Drawer/Dropdown */}
                {timeFilter === "custom" && customDateRangePickerOpen && (
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-3 p-4 bg-slate-950/98 backdrop-blur-2xl border border-sky-400/25 rounded-2xl w-full sm:w-[320px] shadow-[0_15px_30px_rgba(0,0,0,0.8)] z-50 animate-in fade-in slide-in-from-top-2 duration-250 text-right">
                    <div className="text-right mb-2 pb-1 border-b border-white/[0.05]">
                      <span className="text-[10px] text-sky-400 font-black tracking-wider uppercase">⚡ اختصارات التحديد السريع:</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5 mb-4">
                      {[
                        { id: "yesterday", label: "أمس" },
                        { id: "this_week", label: "هذا الأسبوع" },
                        { id: "last_7_days", label: "آخر ٧ أيام" },
                        { id: "this_month", label: "هذا الشهر" },
                        { id: "last_month", label: "الشهر الماضي" },
                        { id: "last_30_days", label: "آخر ٣٠ يوم" },
                        { id: "this_year", label: "هذا العام" },
                        { id: "all_time", label: "الكل (إعادة ضبط)" }
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            applyPreset(preset.id as any);
                            setCustomDateRangePickerOpen(false);
                          }}
                          className="px-2.5 py-1.5 bg-white/[0.03] hover:bg-sky-400/10 border border-white/[0.05] hover:border-sky-400/20 text-slate-300 hover:text-sky-400 text-[10.5px] font-bold text-center rounded-lg transition-all cursor-pointer active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-white/[0.05] pt-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-400 font-black block text-right">📅 من تاريخ:</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full h-8 px-2 text-center rounded-lg border border-white/[0.08] bg-slate-900 text-white text-[10.5px] focus:outline-none focus:ring-1 focus:ring-sky-400/50 font-sans cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-slate-400 font-black block text-right">📅 إلى تاريخ:</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full h-8 px-2 text-center rounded-lg border border-white/[0.08] bg-slate-900 text-white text-[10.5px] focus:outline-none focus:ring-1 focus:ring-sky-400/50 font-sans cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStartDate(new Date().toISOString().split("T")[0]);
                            setEndDate(new Date().toISOString().split("T")[0]);
                          }}
                          className="flex-1 py-1 px-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded-md text-[10px] font-black text-center transition-all cursor-pointer"
                        >
                          اليوم
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeFilter("month")}
                          className="flex-1 py-1 px-2.5 bg-[#FF0055]/10 hover:bg-[#FF0055]/15 text-[#FF3366] border border-[#FF0055]/20 rounded-md text-[10px] font-black text-center transition-all cursor-pointer"
                        >
                          إلغاء التخصيص
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5 Analytics Cards Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 font-sans">
          
          {/* Card 1: إجمالي العملاء */}
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-sky-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي العملاء</span>
              <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl"><Users size={16} /></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white font-mono">
                {analyticsStats.total}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                إجمالي العملاء المسجلين والمخصصين
              </p>
            </div>
          </Card>

          {/* Card 2: إجمالي التواصل */}
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي التواصل</span>
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><PhoneCall size={16} /></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white font-mono">
                {analyticsStats.totalContacts}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                نسبة تواصل: {analyticsStats.total > 0 ? Math.round((analyticsStats.totalContacts / analyticsStats.total) * 100) : 0}% من العملاء
              </p>
            </div>
          </Card>

          {/* Card 3: إجمالي الميتنج ونسبته من التواصل */}
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-sky-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي الميتنج المحدد</span>
              <div className="p-2 bg-sky-500/10 text-sky-305 text-sky-300 rounded-xl"><CalendarDays size={16} /></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white font-mono">
                {analyticsStats.totalMeetings}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                معدل الميتنج: {analyticsStats.meetingsToContactsPercent}% من التواصل
              </p>
            </div>
          </Card>

          {/* Card 4: إجمالي الميتنج الناجح ونسبته من الميتنج */}
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-400" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 tracking-wider">الميتنج الناجح</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><CheckCircle2 size={16} /></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white font-mono">
                {analyticsStats.successfulMeetings}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                معدل النجاح: {analyticsStats.successMeetingRate}% من الميتنجز
              </p>
            </div>
          </Card>

          {/* Card 5: تارجت قسم التيلي سيلز (الكل) */}
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 tracking-wider">تارجت قسم التيلي سيلز</span>
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Target size={16} /></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white font-mono flex items-baseline gap-1">
                <span>{analyticsStats.successfulMeetings}</span>
                <span className="text-xs text-slate-500 font-bold">/ {settings.targets?.telesalesDeptTarget || 0}</span>
              </h3>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-2">
                <span>نسبة الإنجاز:</span>
                <span className="font-mono text-rose-400">
                  {settings.targets?.telesalesDeptTarget && settings.targets.telesalesDeptTarget > 0 
                    ? Math.round((analyticsStats.successfulMeetings / settings.targets.telesalesDeptTarget) * 100)
                    : 0}%
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-rose-500 to-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(
                      settings.targets?.telesalesDeptTarget && settings.targets.telesalesDeptTarget > 0 
                        ? Math.round((analyticsStats.successfulMeetings / settings.targets.telesalesDeptTarget) * 100)
                        : 0, 
                      100
                    )}%` 
                  }}
                />
              </div>
            </div>
          </Card>

        </div>

        {/* Interactive Donut Charts Section - Side-by-Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: مصدر الداتا */}
          <Card glass className="p-6 border-white/[0.05]">
            <div className="mb-6 pb-4 border-b border-white/[0.05] font-sans">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Sliders className="text-sky-400" size={20} />
                <span>توزيع مصادر الداتا</span>
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                نسب وإحصائيات مصادر تدفق العملاء المسجلين للفلترة المحددة.
              </p>
            </div>

            {analyticsStats.sourcesDist.length > 0 ? (
              <div className="space-y-6 lg:space-y-8 font-sans">
                <div className="flex justify-center h-[240px] w-full items-center relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={analyticsStats.sourcesDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {analyticsStats.sourcesDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff", fontFamily: "sans-serif" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase mb-1">إجمالي المصادر</span>
                    <span className="text-2xl font-black text-white font-mono">{analyticsStats.total}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-white/[0.03]">مصدر الداتا بالتفصيل:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {analyticsStats.sourcesDist.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="text-slate-300 font-bold truncate">{item.name}</span>
                        </div>
                        <span className="text-slate-400 font-mono font-black shrink-0">{item.percentage}% ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-500 font-bold text-xs bg-white/[0.02] border border-dashed border-white/[0.05] rounded-2xl">لا توجد أي تصنيفات لمصدر الداتا حالياً</div>
            )}
          </Card>

          {/* Card 2: نوع التواصل */}
          <Card glass className="p-6 border-white/[0.05]">
            <div className="mb-6 pb-4 border-b border-white/[0.05] font-sans">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <MessageSquare className="text-emerald-400" size={20} />
                <span>توزيع قنوات التواصل</span>
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                نسب وفئات قنوات التواصل ولغة الحوار المسجلة مع جهات الاتصال.
              </p>
            </div>

            {analyticsStats.contactTypesDist.length > 0 ? (
              <div className="space-y-6 lg:space-y-8 font-sans">
                <div className="flex justify-center h-[240px] w-full items-center relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={analyticsStats.contactTypesDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {analyticsStats.contactTypesDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff", fontFamily: "sans-serif" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase mb-1">إجمالي التواصل</span>
                    <span className="text-2xl font-black text-white font-mono">{analyticsStats.totalContacts}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-white/[0.03]">قنوات الاتصال بالتفصيل:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {analyticsStats.contactTypesDist.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="text-slate-300 font-bold truncate">{item.name}</span>
                        </div>
                        <span className="text-slate-400 font-mono font-black shrink-0">{item.percentage}% ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-500 font-bold text-xs bg-white/[0.02] border border-dashed border-white/[0.05] rounded-2xl">لا توجد أي تصنيفات لنوع التواصل حالياً</div>
            )}
          </Card>
        </div>

        {/* New Card: سكريبتات التواصل الأكثر مبيعاً ونجاحاً */}
        <Card glass className="p-6 border-white/[0.05] font-sans">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Flame size={20} className="text-amber-500 animate-pulse" />
                <span>سكريبتات التواصل الأكثر مبيعاً ونجاحاً (فريق العمل)</span>
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                تحليلات مقارنة لأثر وقوة الاسكريبتات والرسائل المستخدمة في تحويل وتأهيل جهات الاتصال لميتنج ناجح بكافة الحسابات
              </p>
            </div>
            <div className="text-xs text-slate-400 font-bold flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] px-3 py-1.5 rounded-xl">
              <span>تحديث تلقائي</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            </div>
          </div>

          <div className="space-y-5">
            {scriptsPerformance.map((item, index) => {
              const colorClass = 
                index === 0 ? "from-sky-500 to-indigo-500" :
                index === 1 ? "from-emerald-500 to-teal-500" :
                index === 2 ? "from-indigo-500 to-violet-500" :
                "from-amber-500 to-orange-500";
              
              return (
                <div key={index} className="group relative p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    {/* Script text & Badge */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-xl font-mono text-xs font-black shrink-0 shadow-md",
                        index === 0 ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                        index === 1 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        index === 2 ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" :
                        "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      )}>
                        #{index + 1}
                      </span>
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs text-slate-200 font-bold leading-normal truncate group-hover:text-white transition-colors" title={item.text}>
                          {item.preview}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          الاستخدام: {item.count} عملاء • النجاح: {item.successCount} لقاءات ناجحة
                        </p>
                      </div>
                    </div>

                    {/* Success rate percentage badge */}
                    <div className="flex items-center gap-3 self-end md:self-auto uppercase tracking-wider font-mono shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold">معدل الميتنج</p>
                        <p className="text-sm font-black text-white font-mono">{item.successRate}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Styled Progress bar wrapper */}
                  <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-white/[0.03]">
                    <div 
                      style={{ width: `${item.successRate}%` }} 
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000", colorClass)} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* AI-Generated Insights (from current view) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden font-sans">
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-sky-500" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target size={16} className="text-sky-400" />
              <span>تحليل ومصادر تدفق الجهات</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-bold">
              {generatedInsights.sourceInsight}
            </p>
          </Card>

          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden font-sans">
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-violet-500" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <PhoneCall size={16} className="text-violet-400" />
              <span>أداء قنوات الاتصال والتجاوب</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-bold">
              {generatedInsights.contactInsight}
            </p>
          </Card>

          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden font-sans">
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-emerald-500" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap size={16} className="text-emerald-400" />
              <span>جودة الاستجابة والاتزان</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-bold">
              {generatedInsights.responseInsight}
            </p>
          </Card>

          <Card glass className="p-5 border-white/[0.05] relative overflow-hidden font-sans">
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-amber-500" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Handshake size={16} className="text-amber-400" />
              <span>اجتماعات ولقاءات الأعمال</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-bold">
              {generatedInsights.meetingInsight}
            </p>
          </Card>
        </div>

      </div>
      )}

      {/* Leads Management Area */}
      {mainTab === "leads" && (
        <div className="border-t border-white/[0.05] pt-10 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/5">
            <Users size={22} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">بيانات وعملاء القسم</h2>
            <p className="text-xs font-semibold text-slate-400">تابع العملاء المسجلين وقنوات الاتصال وفلترة الاستجابات المسجلة بشكل لحظي.</p>
          </div>
          
          {/* Main Group Switcher tabs: Active Accounts vs Deleted Accounts */}
          <div className="flex p-1 bg-slate-950/70 backdrop-blur-2xl rounded-full border border-white/[0.08] shadow-2xl items-center self-stretch sm:self-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setAccountGroupTab("active");
                setSelectedAgentFilter("");
              }}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap grow sm:grow-0 justify-center",
                accountGroupTab === "active"
                  ? "bg-gradient-to-r from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/20"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Users size={14} />
              <span>جميع جهات الاتصال (نشطة) ({leadsGroupedByAccountStatus.active.length})</span>
            </button>
            <button
              onClick={() => {
                setAccountGroupTab("archived");
                setSelectedAgentFilter("");
              }}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap grow sm:grow-0 justify-center",
                accountGroupTab === "archived"
                  ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/15 border-t border-white/20"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Trash2 size={14} />
              <span>جهات الاتصال المؤرشفة ({leadsGroupedByAccountStatus.archived.length})</span>
            </button>
            {isMasterEmail && (
              <button
                onClick={() => {
                  setAccountGroupTab("deleted");
                  setSelectedAgentFilter("");
                }}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap grow sm:grow-0 justify-center",
                  accountGroupTab === "deleted"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15 border-t border-white/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Trash2 size={14} className="text-amber-400" />
                <span>العملاء المحذوفون ({leadsGroupedByAccountStatus.deleted?.length || 0})</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar / Filters */}
        <Card glass className="p-6 border-white/[0.05]">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 flex-col md:flex-row gap-4 w-full">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-3.5 text-slate-500" size={18} />
              <Input 
                dark 
                placeholder={
                  accountGroupTab === "active" 
                    ? "ابحث باسم العميل أو الموظف النشط، رقم الجوال..." 
                    : accountGroupTab === "deleted"
                    ? "ابحث في العملاء المحذوفين ببياناتهم..."
                    : "ابحث باسم العميل أو الموظف المؤرشف..."
                }
                className="pr-12 h-12"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-56">
              <Select 
                dark 
                value={selectedAgentFilter} 
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="h-12"
              >
                <option value="">
                  {accountGroupTab === "active" 
                    ? "كل موظفي المبيعات" 
                    : accountGroupTab === "deleted"
                    ? "كل جهات الاتصال المحذوفة" 
                    : "كل الحسابات المؤرشفة"}
                </option>
                {(accountGroupTab === "active" 
                  ? availableAgents 
                  : accountGroupTab === "deleted"
                  ? deletedLeadsAgents
                  : archivedAgents
                )?.map((agent: any) => (
                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                ))}
              </Select>
            </div>

            <div className="w-full md:w-56">
              <Select 
                dark 
                value={selectedMeetingStatusFilter} 
                onChange={(e) => setSelectedMeetingStatusFilter(e.target.value)}
                className="h-12"
              >
                <option value="">كل حالات الميتنج</option>
                <option value="مجدول">مجدول</option>
                <option value="تحت المتابعة">تحت المتابعة</option>
                <option value="تم الميتنج">تم الميتنج</option>
                <option value="ملغي">ملغي</option>
                <option value="لم يحضر">لم يحضر</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Status Tab Navigation */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/[0.05]">
          <button 
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black transition-all",
              activeTab === "all" ? "bg-sky-500/10 border border-sky-500/20 text-sky-400" : "text-slate-400 hover:text-white"
            )}
          >
            جميع جهات الاتصال ({currentPoolLeads.length})
          </button>
          
          <button 
            onClick={() => setActiveTab("today")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
              activeTab === "today" ? "bg-sky-500/10 border border-sky-500/20 text-sky-400" : "text-slate-400 hover:text-white"
            )}
          >
            <CalendarDays size={14} />
            <span>متابعات اليوم ({currentPoolLeads.filter(l => l.dateFollow === new Date().toISOString().split("T")[0]).length})</span>
          </button>

          <button 
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
              activeTab === "pending" ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Clock size={14} />
            <span>قيد المتابعة / مجدول ({currentPoolLeads.filter(l => l.meetingStatus === "مجدول" || l.meetingStatus === "تحت المتابعة").length})</span>
          </button>

          <button 
            onClick={() => setActiveTab("done")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
              activeTab === "done" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "text-slate-400 hover:text-white"
            )}
          >
            <CheckCircle2 size={14} />
            <span>ميتنج ناجح ({currentPoolLeads.filter(l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح").length})</span>
          </button>
        </div>
      </Card>



      {/* Main Table / Row Display */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 pr-2 border-r-4 border-sky-500">
            قائمة العملاء والتواصلات ({filteredLeads.length})
          </h2>

          {filteredLeads.length > 0 && (
            <button
              onClick={() => {
                if (selectedLeadIds.length === filteredLeads.length) {
                  setSelectedLeadIds([]);
                } else {
                  setSelectedLeadIds(filteredLeads.map(l => l.id));
                }
              }}
              className="px-4 py-2.5 text-xs font-black rounded-xl bg-slate-950/70 border border-white/[0.08] hover:bg-slate-900 hover:border-sky-500/20 text-slate-300 flex items-center gap-2.5 self-start sm:self-auto cursor-pointer transition-all duration-300"
            >
              <input 
                type="checkbox"
                checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                onChange={() => {}} // handled by onClick on button
                className="w-4 h-4 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/30 cursor-pointer"
              />
              <span className="font-extrabold text-slate-200">تحديد الكل ({filteredLeads.length})</span>
            </button>
          )}
        </div>

        {/* Bulk Operations Panel */}
        {selectedLeadIds.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-950/90 backdrop-blur-2xl rounded-2xl border border-sky-500/30 shadow-[0_4px_30px_rgba(56,189,248,0.15)] animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-extrabold text-sm">
                  {selectedLeadIds.length}
                </span>
                <div>
                  <p className="text-white text-sm font-black">تعديل أو حذف جماعي ({selectedLeadIds.length} عملاء)</p>
                  <p className="text-slate-400 text-xs">اختر تطبيق تحديثات محددة على السجلات المؤشرة أو حذفها جماعياً.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLeadIds([])}
                  className="px-4 py-2 text-xs font-extrabold rounded-xl bg-white/[0.04] text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
                >
                  إلغاء التحديد
                </button>

                <button
                  type="button"
                  onClick={() => setBulkEditOpen(!bulkEditOpen)}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 active:scale-95",
                    bulkEditOpen 
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                      : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/10"
                  )}
                >
                  <Edit3 size={12} />
                  <span>{bulkEditOpen ? "إخفاء خيارات التعديل" : "تعديل جماعي"}</span>
                </button>

                {isMasterEmail && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isBulkOperating}
                    className="px-4 py-2 text-xs font-black rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    <span>حذف جماعي</span>
                  </button>
                )}
              </div>
            </div>

            {bulkEditOpen && (
              <div className="p-5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/[0.08] space-y-4 animate-in fade-in duration-300">
                <h4 className="text-sm font-black text-white border-r-2 border-sky-500 pr-2">تحديث الحقول جماعياً</h4>
                <p className="text-slate-400 text-xs">حدد قيمة أي حقل تود تطبيقه جماعياً على جميع العملاء المحددين ({selectedLeadIds.length}). الحقول التي تدعها فارغة لن تُعدل.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Agent Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">الموظف المسؤول (التيلي):</label>
                    <select
                      value={bulkEditAgent}
                      onChange={(e) => setBulkEditAgent(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-slate-950 text-white text-xs focus:ring-2 focus:ring-sky-500/50"
                    >
                      <option value="">-- بدون تغيير --</option>
                      {availableAgents && availableAgents.length > 0 && (
                        <optgroup label="الحسابات النشطة (موظفي المبيعات)">
                          {availableAgents.map((agent: any) => (
                            <option key={agent.id} value={agent.name}>{agent.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {archivedAgents && archivedAgents.length > 0 && (
                        <optgroup label="الحسابات المحذوفة / المؤرشفة">
                          {archivedAgents.map((agent: any) => (
                            <option key={agent.id} value={agent.name}>{agent.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Meeting Status Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">حالة الميتنج:</label>
                    <select
                      value={bulkEditMeetingStatus}
                      onChange={(e) => setBulkEditMeetingStatus(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-slate-950 text-white text-xs focus:ring-2 focus:ring-sky-500/50"
                    >
                      <option value="">-- بدون تغيير --</option>
                      {formConfig.meetingStatuses?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Follow-up Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">تاريخ المتابعة:</label>
                    <input
                      type="date"
                      value={bulkEditDateFollow}
                      onChange={(e) => setBulkEditDateFollow(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-slate-950 text-white text-xs focus:ring-2 focus:ring-sky-500/50 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkEditAgent("");
                      setBulkEditMeetingStatus("");
                      setBulkEditResponse("");
                      setBulkEditDateFollow("");
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    مسح المدخلات
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkUpdate}
                    disabled={isBulkOperating}
                    className="px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {isBulkOperating ? (
                      <span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>تطبيق التحديث الجماعي</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {paginatedStableLeads.map((lead) => (
            <Card 
              key={lead.id} 
              glass 
              className={cn(
                "p-5 relative group overflow-hidden border-white/[0.05] hover:border-sky-500/30 w-full",
                selectedLeadIds.includes(lead.id) && "ring-1 ring-sky-500/50 border-sky-500/40 bg-sky-950/20"
              )}
            >
              {/* Meeting Status vertical indicator */}
              <div className={cn(
                "absolute top-0 right-0 bottom-0 w-1.5",
                (lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح" || lead.meetingStatus === "تم بنجاح") && "bg-emerald-500",
                (lead.meetingStatus === "مجدول" || lead.meetingStatus === "تحت المتابعة") && "bg-amber-500",
                (lead.meetingStatus === "ملغي" || lead.meetingStatus === "لم يحضر") && "bg-rose-500"
              )} />

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Core Basic Details: Code / Client Info with Checkbox */}
                <div className="xl:col-span-3 flex flex-row items-start gap-3 pr-3">
                  <div className="pt-1.5 shrink-0 select-none">
                    <input 
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setSelectedLeadIds(prev => [...prev, lead.id]);
                        } else {
                          setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500/30 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black tracking-widest text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded">
                        {lead.date ? new Date(lead.date).toLocaleDateString("ar-SA") : "بلا تاريخ"}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded",
                        (lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح" || lead.meetingStatus === "تم بنجاح") && "text-emerald-400 bg-emerald-500/10",
                        (lead.meetingStatus === "مجدol" || lead.meetingStatus === "تحت المتابعة" || lead.meetingStatus === "مجدول") && "text-amber-400 bg-amber-500/10",
                        (lead.meetingStatus === "ملغي" || lead.meetingStatus === "لم يحضر") && "text-rose-400 bg-rose-500/10"
                      )}>
                        حالة الميتنج: {lead.meetingStatus}
                      </span>
                      {lead.meetingLink && (
                        <a 
                          href={lead.meetingLink.startsWith("http") ? lead.meetingLink : `https://${lead.meetingLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] font-black px-2 py-0.5 rounded text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/40 flex items-center gap-1 transition-colors duration-200 whitespace-nowrap"
                        >
                          <span>رابط الاجتماع 🔗</span>
                        </a>
                      )}
                      {lead.meetingTime && (
                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 whitespace-nowrap flex items-center gap-1">
                          ⏰ {lead.meetingTime.replace("T", " ")}
                        </span>
                      )}
                      {lead.distributedToSales && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-sky-400 bg-sky-500/10 border border-sky-500/20 whitespace-nowrap">
                          محول للسيلز ⚡
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-black text-white group-hover:text-sky-400 transition-colors mt-1.5 flex items-center gap-1.5">
                      {lead.clientName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5 font-medium">
                      <span className="flex items-center gap-1"><Briefcase size={12} className="text-slate-500" /> {lead.field || "لا يوجد مجال"}</span>
                      <span className="flex items-center gap-1"><Users size={12} className="text-slate-500" /> سورس: {lead.dataSource || "غير محدد"}</span>
                    </div>
                  </div>
                </div>

                {/* Contact state & Response */}
                <div className="xl:col-span-3 space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">الاتصال وأول تواصل</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-200">
                      <span className="font-bold bg-white/5 border border-white/5 rounded px-2 py-0.5 text-[10px] text-slate-300">
                        {lead.contactType || "واتساب"}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        تاريخ: {lead.firstContactDate || "غير محدد"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Response & Follow-up tracking */}
                <div className="xl:col-span-3 space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">الاستجابة والمتابعات</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-slate-300">
                      <span className="text-slate-500 font-bold">الاستجابة:</span>
                      <span className="font-semibold text-slate-200">{lead.response || "لم تسجل"}</span>
                    </div>
                    {lead.dateFollow && (
                      <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <Clock size={11} className="text-amber-500" />
                        <span>موعد المتابعة القادم: </span>
                        <span className="font-mono text-amber-400">{lead.dateFollow}</span>
                      </div>
                    )}
                    {/* Tiny bullet stats for FUp 1, 2, 3, 4 */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className={cn("inline-block w-4 h-4 rounded-full text-[9px] font-black text-center leading-4", lead.followUp1 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600")} title={`متابعة 1: ${lead.followUp1 || "فارغة"}`}>1</span>
                      <span className={cn("inline-block w-4 h-4 rounded-full text-[9px] font-black text-center leading-4", lead.followUp2 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600")} title={`متابعة 2: ${lead.followUp2 || "فارغة"}`}>2</span>
                      <span className={cn("inline-block w-4 h-4 rounded-full text-[9px] font-black text-center leading-4", lead.followUp3 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600")} title={`متابعة 3: ${lead.followUp3 || "فارغة"}`}>3</span>
                      <span className={cn("inline-block w-4 h-4 rounded-full text-[9px] font-black text-center leading-4", lead.followUp4 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600")} title={`متابعة 4: ${lead.followUp4 || "فارغة"}`}>4</span>
                    </div>
                  </div>
                </div>

                {/* Agent assigned */}
                <div className="xl:col-span-1.5 space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">مسؤول التيلي</p>
                  <div>
                    <span className="text-xs font-black text-sky-400 block truncate">{lead.agentName}</span>
                    <span className="text-[9px] text-slate-500 block truncate">إيجاد المواعيد</span>
                  </div>
                </div>

                {/* Actions (Edit, WhatsApp copy, Delete) */}
                <div className="xl:col-span-1.5 flex items-center justify-end gap-2.5 pt-3 xl:pt-0 border-t xl:border-t-0 border-white/[0.05] w-full">
                  {lead.whatsappMessageText && (
                    <button 
                      onClick={() => copyToClipboard(lead.whatsappMessageText, lead.id)}
                      className="inline-flex items-center justify-center h-9 w-9 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25 rounded-xl transition-all"
                      title={copiedId === lead.id ? "تم نسخ نص رسالة الواتس اب!" : "نسخ نص رسالة الواتساب للعميل"}
                    >
                      {copiedId === lead.id ? <Check size={14} /> : <MessageSquare size={14} />}
                    </button>
                  )}
                  {lead.phone && (
                    <a 
                      href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center justify-center h-9 w-9 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-xl transition-all"
                      title="مراسلة عبر واتساب"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button 
                    onClick={() => copyLeadAllDataToWhatsApp(lead, lead.id)}
                    className="inline-flex items-center justify-center h-9 w-9 bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/25 rounded-xl transition-all"
                    title="نسخ جميع بيانات العميل بشكل منظم للواتساب"
                  >
                    <Copy size={14} />
                  </button>
                  <button 
                    onClick={() => startEdit(lead)}
                    className="inline-flex items-center justify-center h-9 w-9 bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/10 rounded-xl transition-all"
                    title="تعديل تفاصيل التواصل"
                  >
                    <Edit3 size={14} />
                  </button>
                  {accountGroupTab === "deleted" && (
                    <button 
                      onClick={async () => {
                        if (confirm(`هل تريد استعادة العميل "${lead.clientName}" ونقله لتبويب جهات الاتصال النشطة؟`)) {
                          await restoreLead(lead.id);
                          showFeedback("تم استعادة العميل بنجاح.");
                        }
                      }}
                      className="inline-flex items-center justify-center h-9 w-9 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 rounded-xl transition-all"
                      title="استعادة العميل للنشطين"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {isMasterEmail && (
                    <button 
                      onClick={() => handleDelete(lead.id)}
                      className="inline-flex items-center justify-center h-9 w-9 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all"
                      title="حذف السجل"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

              </div>

              {/* Extra notes / Store link preview */}
              {(lead.note || lead.storeLink) && (
                <div className="mt-4 pt-3 border-t border-white/[0.03] flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-xs text-slate-500">
                  {lead.note && (
                    <p className="flex items-start gap-1 max-w-2xl">
                      <FileText size={13} className="text-slate-600 mt-0.5 shrink-0" />
                      <span className="text-slate-400"><span className="text-slate-500 font-bold">ملاحظة:</span> {lead.note}</span>
                    </p>
                  )}
                  {lead.storeLink && (
                    <a 
                      href={lead.storeLink.startsWith("http") ? lead.storeLink : `https://${lead.storeLink}`}
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 hover:underline transition-all font-bold tracking-tight shrink-0 font-mono mt-1 md:mt-0"
                    >
                      <Globe size={13} />
                      <span>{lead.storeLink}</span>
                    </a>
                  )}
                </div>
              )}

            </Card>
          ))}

          {stableLeads.length === 0 && (
            <Card glass className="p-16 border-dashed border-white/[0.05] text-center">
              <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                <PhoneCall size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">لا يوجد جهات اتصال حالياً</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                قم بإضافة تواصل أو عميل جديد من خلال الضغط على زر الإضافة لتسجيل تواصل وتتبع المتابعات مع قسم التيلي مبيعات.
              </p>
            </Card>
          )}

          {/* TELESALES HUB LEADS PAGINATION */}
          {stableLeads.length > 0 && (
            <Card glass className="p-4 border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none" dir="rtl">
              <div className="text-xs text-slate-400 font-bold">
                عرض <span className="text-white">{(activeLeadsPage - 1) * ITEMS_PER_PAGE + 1}</span> إلى <span className="text-white">{Math.min(activeLeadsPage * ITEMS_PER_PAGE, stableLeads.length)}</span> من أصل <span className="text-white">{stableLeads.length}</span> عميل
              </div>
              <div className="flex items-center gap-1.5 font-sans">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLeadsPage(1)}
                  disabled={activeLeadsPage === 1}
                  className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                >
                  {"<<"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                  disabled={activeLeadsPage === 1}
                  className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                >
                  السابق
                </Button>
                
                <div className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold font-mono">
                  {activeLeadsPage} / {totalLeadsPages}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLeadsPage(p => Math.min(totalLeadsPages, p + 1))}
                  disabled={activeLeadsPage === totalLeadsPages}
                  className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                >
                  التالي
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLeadsPage(totalLeadsPages)}
                  disabled={activeLeadsPage === totalLeadsPages}
                  className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                >
                  {">>"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
    )}


      {false && (
        <div className="space-y-8 animate-in fade-in duration-3001">
          <div className="border-b border-white/[0.05] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">إعدادات تخصيص نموذج تسجيل عملاء التيلي سيلز</h2>
              <p className="text-sm text-slate-400 mt-1">
                تحكم بالكامل بالبيانات التي يسجلها الموظفون، وقم بتخصيص أسماء الحقول المنسدلة وحالات الميتنج أو سورس الداتا بشكل تفاعلي.
              </p>
            </div>
            <Button 
              type="button" 
              onClick={handleSaveConfig} 
              className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 font-extrabold text-xs flex items-center gap-2 text-white rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all self-start md:self-center cursor-pointer"
            >
              <Save size={16} />
              <span>حفظ المزامنة لجميع الأجهزة</span>
            </Button>
          </div>

          {/* Settings Sub-tabs */}
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/[0.05] self-start gap-1 max-w-xl w-full">
            <button
              onClick={() => setSettingsSubTab("dropdowns")}
              className={cn(
                "flex-1 py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer",
                settingsSubTab === "dropdowns"
                  ? "bg-gradient-to-r from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
              )}
            >
              <Sliders size={14} />
              <span>قوائم الخيارات المنسدلة</span>
            </button>
            <button
              onClick={() => setSettingsSubTab("fields")}
              className={cn(
                "flex-1 py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer",
                settingsSubTab === "fields"
                  ? "bg-gradient-to-r from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
              )}
            >
              <CheckCircle2 size={14} />
              <span>أقسام وحقول التسجيل</span>
            </button>
          </div>

          {settingsSubTab === "dropdowns" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Contact Types */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-450">
                  <PhoneCall size={18} className="text-sky-400 animate-pulse" />
                  <h4 className="font-black text-base text-white">أنواع التواصل وأول اتصال</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {localFormConfig?.contactTypes?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("contactTypes", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.contactTypes || localFormConfig.contactTypes.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف نوعاً جديداً (مثال: اتصال زووم)" className="h-10 text-xs flex-1" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} />
                  <Button type="button" onClick={() => addOption("contactTypes", newContactType, setNewContactType)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 2: Response Options */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-indigo-400">
                  <Sliders size={18} className="text-indigo-400" />
                  <h4 className="font-black text-base text-white">ردود واستجابة العميل</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {localFormConfig?.responseOptions?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("responseOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.responseOptions || localFormConfig.responseOptions.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف استجابة جديدة (مثال: تم الرد واتس اب)" className="h-10 text-xs flex-1" value={newResponseOption} onChange={(e) => setNewResponseOption(e.target.value)} />
                  <Button type="button" onClick={() => addOption("responseOptions", newResponseOption, setNewResponseOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 3: Meeting Statuses */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-amber-500">
                  <Clock size={18} className="text-amber-500" />
                  <h4 className="font-black text-base text-white">حالات الميتنج (Meeting Status)</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {localFormConfig?.meetingStatuses?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("meetingStatuses", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.meetingStatuses || localFormConfig.meetingStatuses.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف حالة ميتنج جديدة (مثال: تم الحضور)" className="h-10 text-xs flex-1" value={newMeetingStatus} onChange={(e) => setNewMeetingStatus(e.target.value)} />
                  <Button type="button" onClick={() => addOption("meetingStatuses", newMeetingStatus, setNewMeetingStatus)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 4: Data Sources */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-emerald-450">
                  <Globe size={18} className="text-emerald-400" />
                  <h4 className="font-black text-base text-white">مصدر الملف (سورس الداتا)</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {(localFormConfig?.dataSources || DEFAULT_TELESALES_FORM.dataSources || [])?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("dataSources", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.dataSources || localFormConfig.dataSources?.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف سورس داتا جديد (مثال: داتا/مركز سعودي)" className="h-10 text-xs flex-1" value={newDataSource} onChange={(e) => setNewDataSource(e.target.value)} />
                  <Button type="button" onClick={() => addOption("dataSources", newDataSource, setNewDataSource)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 5: Field Options */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-violet-400">
                  <Briefcase size={18} className="text-violet-400" />
                  <h4 className="font-black text-base text-white">قطاعات ومجالات النشاط (Field)</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {(localFormConfig?.fieldsOptions || DEFAULT_TELESALES_FORM.fieldsOptions || [])?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("fieldsOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.fieldsOptions || localFormConfig.fieldsOptions?.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف قطاعاً جديداً (مثال: شحن وسياحة)" className="h-10 text-xs flex-1" value={newFieldOption} onChange={(e) => setNewFieldOption(e.target.value)} />
                  <Button type="button" onClick={() => addOption("fieldsOptions", newFieldOption, setNewFieldOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 6: Business Types Options */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                  <Sliders size={18} className="text-sky-400" />
                  <h4 className="font-black text-base text-white">أنواع البيزنس والشركات (Business Type)</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {(localFormConfig?.businessTypesOptions || DEFAULT_TELESALES_FORM.businessTypesOptions || [])?.map((opt: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption("businessTypesOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                    </span>
                  ))}
                  {(!localFormConfig?.businessTypesOptions || localFormConfig.businessTypesOptions?.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا توجد خيارات معرّفة</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="أضف نوع داتا جديد (مثال: رخصة تجارية)" className="h-10 text-xs flex-1" value={newBusinessTypeOption} onChange={(e) => setNewBusinessTypeOption(e.target.value)} />
                  <Button type="button" onClick={() => addOption("businessTypesOptions", newBusinessTypeOption, setNewBusinessTypeOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>

              {/* Card 7: Telesales Agents Customizer */}
              <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                  <Users size={18} className="text-sky-400 animate-pulse" />
                  <h4 className="font-black text-base text-white">موظفو قسم التيلي سيلز (Telesales Agents)</h4>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                  {(settings.teleSalesAgents || [])?.map((agent: any) => (
                    <span key={agent.id} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                      <span>{agent.name}</span>
                      <button type="button" onClick={() => handleDeleteTelesalesAgent(agent.id)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الموظف">×</button>
                    </span>
                  ))}
                  {(!settings.teleSalesAgents || settings.teleSalesAgents.length === 0) && (
                    <p className="text-xs text-slate-500 p-2 italic">لا يوجد موظفو تيلي سيلز حالياً</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input dark placeholder="اسم الموظف الجديد (مثال: سارة أحمد)" className="h-10 text-xs flex-1" value={newTelesalesAgentName} onChange={(e) => setNewTelesalesAgentName(e.target.value)} />
                  <Button type="button" onClick={handleAddTelesalesAgent} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Card glass className="p-6 border-white/[0.05] space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-4">
                  <div>
                    <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                      <Sliders className="text-sky-400" size={18} />
                      <span>المحرر المرئي الذكي لتخصيص نموذج تسجيل عملاء التيلي سيلز</span>
                    </h4>
                    <p className="text-slate-500 text-xs mt-1 font-sans">
                      قم بإنشاء الأقسام، نقل الحقول بينها، التحكم بالظهور والاسم والاشتراطات مباشرة في واجهة محاكاة الفورم الحقيقية.
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleSaveConfig} 
                    className="h-10 px-5 text-xs bg-emerald-500 hover:bg-emerald-600 font-bold flex items-center gap-1.5 text-white rounded-xl"
                  >
                    <Save size={14} />
                    <span>حفظ المزامنة لجميع الأجهزة</span>
                  </Button>
                </div>

                {/* Section Creator Tool */}
                <div className="bg-slate-900/50 border border-white/[0.05] p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-black text-slate-400 block flex items-center gap-1.5">
                      <FolderPlus size={12} className="text-sky-400" />
                      <span>عنوان القسم الجديد المراد إنشاؤه</span>
                    </label>
                    <Input
                      dark
                      placeholder="مثال: بيانات التواصل الاجتماعي، تفاصيل النشاط اللوجستي..."
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddSection}
                    className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white flex items-center gap-1.5 rounded-xl w-full md:w-auto"
                  >
                    <Plus size={14} />
                    <span>إنشاء قسم جديد</span>
                  </Button>
                </div>

                {/* Field Creator Tool */}
                <div className="bg-slate-900/50 border border-white/[0.05] p-5 rounded-2xl space-y-4">
                  <h5 className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>إضافة حقول إضافية جديدة مخصصة للأجهزة وفريق المبيعات</span>
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block">اسم الحقل البرمجي (انجليزي فريد)</label>
                      <Input
                        dark
                        placeholder="مثال: client_age"
                        value={customFieldKey}
                        onChange={(e) => setCustomFieldKey(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block">اسم الحقل المعروض (اللغة العربية)</label>
                      <Input
                        dark
                        placeholder="مثال: عمر العميل"
                        value={customFieldLabel}
                        onChange={(e) => setCustomFieldLabel(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block flex items-center justify-between">
                        <span>القسم المستهدف للحقل</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 h-9 rounded-xl border border-white/[0.1] bg-slate-900 text-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-sans cursor-pointer"
                          value={customFieldSection}
                          onChange={(e) => {
                            if (e.target.value === "ADD_NEW_SECTION") {
                              const newSec = prompt("أدخل اسم القسم الجديد:");
                              if (newSec && newSec.trim()) {
                                const newId = `section_${Date.now()}`;
                                const sectionsList = localFormConfig.sections || [];
                                const maxOrder = sectionsList.reduce((max: number, s: any) => Math.max(max, s.order || 0), 0);
                                const updatedSections = [
                                  ...sectionsList,
                                  { id: newId, title: newSec.trim(), order: maxOrder + 1 }
                                ];
                                setLocalFormConfig({
                                  ...localFormConfig,
                                  sections: updatedSections
                                });
                                setCustomFieldSection(newId);
                              } else {
                                setCustomFieldSection(localFormConfig?.sections?.[0]?.id || "basic_info");
                              }
                            } else {
                              setCustomFieldSection(e.target.value);
                            }
                          }}
                        >
                          {localFormConfig?.sections?.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                          <option value="ADD_NEW_SECTION" className="text-sky-400 font-extrabold bg-slate-800">+ إضافة قسم جديد...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newSec = prompt("أدخل اسم القسم الجديد:");
                            if (newSec && newSec.trim()) {
                              const newId = `section_${Date.now()}`;
                              const sectionsList = localFormConfig.sections || [];
                              const maxOrder = sectionsList.reduce((max: number, s: any) => Math.max(max, s.order || 0), 0);
                              const updatedSections = [
                                ...sectionsList,
                                { id: newId, title: newSec.trim(), order: maxOrder + 1 }
                              ];
                              setLocalFormConfig({
                                ...localFormConfig,
                                sections: updatedSections
                              });
                              setCustomFieldSection(newId);
                            }
                          }}
                          className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-sky-500/20 hover:border-sky-500/30 text-sky-400 transition-colors"
                          title="إضافة قسم جديد"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block">نوع البيانات</label>
                      <select
                        className="w-full h-9 rounded-xl border border-white/[0.1] bg-slate-900 text-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                        value={customFieldType}
                        onChange={(e: any) => setCustomFieldType(e.target.value)}
                      >
                        <option value="text">نص عادي (Text)</option>
                        <option value="number">رقم (Number)</option>
                        <option value="date">تاريخ (Date)</option>
                        <option value="textarea">فقرة/ملاحظة متعددة الأسطر</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/[0.03] pt-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={customFieldRequired}
                        onChange={(e) => setCustomFieldRequired(e.target.checked)}
                        className="w-4 h-4 accent-sky-500 cursor-pointer"
                      />
                      <span>جعل الحقل المخصص إلزامي الإدخال (*)</span>
                    </label>
                    <Button
                      type="button"
                      onClick={handleAddCustomField}
                      className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>إدراج الحقل للقسم المختص</span>
                    </Button>
                  </div>
                </div>

                {/* THE LIVE MUTABLE FORM SECTIONS PREVIEW */}
                <div className="space-y-6 border-t border-white/[0.05] pt-6">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest block pb-2">
                    محاكاة حية لترتيب وأقسام النموذج (اضغط وجرب التعديل)
                  </h5>

                  {localFormConfig?.sections?.slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((section: any, idx: number, arr: any[]) => {
                    // Find fields matching this section ID
                    const sectionFields = Object.keys(localFormConfig.fieldsConfig || {}).filter(key => {
                      const field = localFormConfig.fieldsConfig[key];
                      return (field.sectionId || "basic_info") === section.id;
                    });

                    return (
                      <div key={section.id} className="bg-slate-900/30 border border-white/[0.04] p-5 rounded-2xl space-y-4">
                        {/* Section Header with Section Title Editor & Sorting controls */}
                        <div className="flex items-center justify-between border-b border-white/[0.03] pb-3">
                          <div className="flex-1 max-w-md">
                            <Input
                              dark
                              className="h-8 font-black text-sky-400 bg-transparent border-none px-1 text-sm focus:ring-1 focus:ring-sky-500"
                              value={section.title}
                              onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                            />
                          </div>

                          {/* Section arrangement buttons */}
                          <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, "up")}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                              title="نقل للرأس"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, "down")}
                              disabled={idx === arr.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                              title="نقل للأمام"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSection(section.id)}
                              className="p-1 text-red-400 hover:text-red-500 transition-colors"
                              title="حذف هذا القسم بالكامل"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {sectionFields.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-white/[0.06] rounded-xl text-slate-500 text-xs">
                            لا توجد حقول في هذا القسم حالياً. أضف حقولاً مخصصة مع هذا القسم أو غير أقسام الحقول بالأسفل.
                          </div>
                        ) : (
                          /* Render actual fields, but each field card has custom controls inside itself! */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sectionFields.map((fieldKey) => {
                              const field = localFormConfig.fieldsConfig[fieldKey];
                              const isTextarea = fieldKey === "whatsappMessageText" || fieldKey === "note" || field.type === "textarea";
                              
                              return (
                                <div 
                                  key={fieldKey} 
                                  className={cn(
                                    "p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] flex flex-col justify-between gap-3 relative overflow-hidden group hover:border-white/[0.1] transition-all",
                                    isTextarea ? "col-span-1 md:col-span-2" : "",
                                    field.visible === false ? "opacity-40" : ""
                                  )}
                                >
                                  {/* Field top line: inline dynamic label modifier */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                      <input
                                        type="text"
                                        className="text-[10px] font-black text-slate-400 bg-transparent border-none p-0 focus:ring-0 w-full hover:bg-white/[0.03] rounded px-1 duration-150"
                                        value={field.label}
                                        onChange={(e) => handleFieldConfigChange(fieldKey, "label", e.target.value)}
                                        title="اضغط للتعديل السريع على اسم الحقل"
                                      />
                                      {field.isCustom && (
                                        <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                                          مخصص
                                        </span>
                                      )}
                                    </div>

                                    {/* Mock placeholder element for high fidelity appearance of the actual register form */}
                                    <div className="h-9 px-3 rounded-xl border border-white/[0.1] bg-white/[0.01] flex items-center text-xs text-slate-500 pointer-events-none font-sans justify-between">
                                      <span>
                                        {fieldKey === "date" || fieldKey === "firstContactDate" || fieldKey === "dateFollow" || field.type === "date" ? "التاريخ..." :
                                         fieldKey === "phone" ? "9665xxxxxxxx..." :
                                         fieldKey === "agentName" ? "اختر الموظف المسؤول..." :
                                         fieldKey === "contactType" || fieldKey === "response" || fieldKey === "meetingStatus" ? "اختر خياراً..." :
                                         isTextarea ? "نص متعدد الأسطر..." : "نص الإدخال..."}
                                      </span>
                                      {field.required && <span className="text-red-500 font-bold">*</span>}
                                    </div>
                                  </div>

                                  {/* Bottom quick adjustment selectors of field */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.03] text-[10px]">
                                    <div className="flex items-center gap-3">
                                      {/* Visible switcher */}
                                      <label className="flex items-center gap-1 cursor-pointer select-none text-slate-400 hover:text-white">
                                        <input
                                          type="checkbox"
                                          checked={field.visible !== false}
                                          onChange={(e) => handleFieldConfigChange(fieldKey, "visible", e.target.checked)}
                                          className="sr-only"
                                        />
                                        {field.visible !== false ? (
                                          <Eye size={13} className="text-sky-400" />
                                        ) : (
                                          <EyeOff size={13} className="text-slate-500" />
                                        )}
                                        <span>{field.visible !== false ? "معروض" : "مخفي"}</span>
                                      </label>

                                      {/* Required Switcher */}
                                      <label className="flex items-center gap-1 cursor-pointer select-none text-slate-400 hover:text-white">
                                        <input
                                          type="checkbox"
                                          checked={field.required === true}
                                          onChange={(e) => handleFieldConfigChange(fieldKey, "required", e.target.checked)}
                                          className="w-3 h-3 accent-sky-500 cursor-pointer rounded"
                                        />
                                        <span>إلزامي</span>
                                      </label>
                                    </div>

                                    {/* Section reassignor dropdown */}
                                    <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-lg">
                                      <span className="text-slate-500 text-[9px]">القسم:</span>
                                      <select
                                        className="bg-transparent border-none text-slate-300 font-sans p-0 text-[10px] focus:ring-0 cursor-pointer text-slate-300"
                                        value={field.sectionId || "basic_info"}
                                        onChange={(e) => {
                                          if (e.target.value === "ADD_NEW_SECTION") {
                                            const newSec = prompt("أدخل اسم القسم الجديد:");
                                            if (newSec && newSec.trim()) {
                                              const newId = `section_${Date.now()}`;
                                              const sectionsList = localFormConfig.sections || [];
                                              const maxOrder = sectionsList.reduce((max: number, s: any) => Math.max(max, s.order || 0), 0);
                                              const updatedSections = [
                                                ...sectionsList,
                                                { id: newId, title: newSec.trim(), order: maxOrder + 1 }
                                              ];
                                              setLocalFormConfig({
                                                ...localFormConfig,
                                                sections: updatedSections,
                                                fieldsConfig: {
                                                  ...localFormConfig.fieldsConfig,
                                                  [fieldKey]: {
                                                    ...localFormConfig.fieldsConfig[fieldKey],
                                                    sectionId: newId
                                                  }
                                                }
                                              });
                                            }
                                          } else {
                                            handleFieldConfigChange(fieldKey, "sectionId", e.target.value);
                                          }
                                        }}
                                      >
                                        {localFormConfig.sections?.map((s: any) => (
                                          <option key={s.id} value={s.id} className="bg-slate-900 text-white text-xs">{s.title}</option>
                                        ))}
                                        <option value="ADD_NEW_SECTION" className="text-sky-400 font-extrabold bg-slate-800">+ إضافة قسم جديد...</option>
                                      </select>
                                    </div>

                                    {/* Action button: delete field key */}
                                    {field.isCustom && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCustomField(fieldKey)}
                                        className="text-red-400 hover:text-red-500 p-1 rounded transition-colors"
                                        title="حذف هذا الحقل المخصص"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Final Footer block */}
                <div className="border-t border-white/[0.05] pt-6 flex justify-between items-center">
                  <span className="text-slate-500 text-[10px] font-mono">
                    Active Fields Count: {localFormConfig?.fieldsConfig ? Object.keys(localFormConfig.fieldsConfig).length : 0}
                  </span>
                  <div className="flex gap-3">
                    <Button type="button" onClick={() => setHubTab("leads")} variant="secondary" className="px-5 h-10 text-xs rounded-xl">إلغاء</Button>
                    <Button type="button" onClick={handleSaveConfig} className="px-6 h-10 text-xs bg-emerald-500 hover:bg-emerald-600 font-bold flex items-center gap-1.5 text-white rounded-xl">
                      <Save size={14} />
                      <span>حفظ المزامنة لجميع الأجهزة</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Drawer: Add Lead Form */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="إضافة عميل وسجل تواصل جديد"
        size="lg"
      >
        <form onSubmit={handleCreateLead} className="space-y-6">
          {renderDynamicForm()}

          {/* Checkbox for Sales Distribution */}
          {(formData.meetingStatus === "تم تحديد ميتنج" || formData.meetingStatus === "تم الميتنج" || formData.meetingStatus === "مجدول" || formData.response === "يطلب ميتنج فوري" || !!formData.distributeToSales) && (
            <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl space-y-2 text-right" dir="rtl">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="distributeToSalesAddHub"
                  className="w-5 h-5 rounded border-sky-500/30 text-sky-500 bg-slate-900/50 focus:ring-sky-500/40 cursor-pointer"
                  checked={!!formData.distributeToSales}
                  onChange={(e) => setFormData({ ...formData, distributeToSales: e.target.checked })}
                />
                <label htmlFor="distributeToSalesAddHub" className="text-sm font-black text-sky-300 cursor-pointer select-none">
                  توزيع وتصدير فوري إلى فريق المبيعات (Sales Hub)
                </label>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold pr-8 leading-relaxed">
                عند التفعيل، سيتم تحويل وتصدير هذا العميل تلقائياً ببياناته إلى صفحة مدير السيلز (Sales Hub) ليتم إسنادها لفريق المبيعات المباشر أو المستهدف.
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <Button
              type="submit"
              className="flex-1 h-12 bg-sky-500 font-black rounded-xl hover:bg-sky-600"
            >
              <Save size={16} />
              <span>حفظ بيانات العميل</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
              className="h-12 px-6 rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Edit Lead Form */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setSelectedLead(null); }}
        title={`تعديل تفاصيل تواصل العميل: ${selectedLead?.clientName || ""}`}
        size="lg"
      >
        <form onSubmit={handleUpdateLeadState} className="space-y-6">
          {renderDynamicForm()}

          {/* Checkbox for Sales Distribution */}
          {(formData.meetingStatus === "تم تحديد ميتنج" || formData.meetingStatus === "تم الميتنج" || formData.meetingStatus === "مجدول" || formData.response === "يطلب ميتنج فوري" || !!formData.distributeToSales || !!selectedLead?.distributedToSales) && (
            <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl space-y-2 text-right" dir="rtl">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="distributeToSalesEditHub"
                  className="w-5 h-5 rounded border-sky-500/30 text-sky-500 bg-slate-900/50 focus:ring-sky-500/40 cursor-pointer"
                  checked={!!formData.distributeToSales}
                  onChange={(e) => setFormData({ ...formData, distributeToSales: e.target.checked })}
                  disabled={!!selectedLead?.distributedToSales}
                />
                <label htmlFor="distributeToSalesEditHub" className="text-sm font-black text-sky-300 cursor-pointer select-none">
                  {selectedLead?.distributedToSales ? "تم تحويل وتوزيع العميل إلى Sales Hub بالفعل الكترونياً ✔" : "توزيع وتصدير فوري إلى فريق المبيعات (Sales Hub)"}
                </label>
              </div>
              {!selectedLead?.distributedToSales && (
                <p className="text-[10px] text-slate-400 font-semibold pr-8 leading-relaxed">
                  عند التفعيل، سيتم تحويل وتصدير هذا العميل تلقائياً ببياناته إلى صفحة مدير السيلز (Sales Hub) ليتم إسنادها لفريق المبيعات المباشر أو المستهدف.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <Button
              type="submit"
              className="flex-1 h-12 bg-sky-500 font-black rounded-xl hover:bg-sky-600"
            >
              <Save size={16} />
              <span>حفظ بيانات العميل</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsEditOpen(false); setSelectedLead(null); }}
              className="h-12 px-6 rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Custom Confirmation Modal */}
      <Modal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        title={confirmModalState.title}
      >
        <div className="space-y-6 text-right" dir="rtl font-sans">
          <p className="text-sm font-semibold text-slate-300 leading-relaxed font-sans">
            {confirmModalState.message}
          </p>
          <div className="flex justify-start gap-3 pt-2 font-sans">
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                confirmModalState.onConfirm();
              }}
              className="px-5 py-2.5 text-xs font-black rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-sans"
            >
              موافق وتأكيد العمل الإجرائي
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg font-sans"
            >
              تراجع وإلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
