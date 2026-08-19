import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, 
  Users, 
  User,
  Target, 
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
  Sparkles, 
  AlertCircle, 
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
  Briefcase,
  UserCheck,
  PhoneCall,
  Wallet,
  Settings as SettingsIcon 
} from "lucide-react";
import { Card, Input, Select, Button, Modal, Drawer } from "@/src/components/UI";
import { useSettings, DEFAULT_SALES_FORM } from "@/src/hooks/useSettings";
import { useSalesLeads } from "@/src/hooks/useSalesLeads";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/hooks/useUserRole";
import { SalesLead } from "@/src/types";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const SalesHubPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isMasterEmail = user?.email?.toLowerCase().trim() === "abdelrahmanahmed011147@gmail.com" || isAdmin;
  const { leads, loading: leadsLoading, addLead, updateLead, deleteLead, restoreLead } = useSalesLeads();
  const { settings, loading: settingsLoading, saveSettings } = useSettings();

  // Dynamic list of available Sales Agents resolved across database structure & registered users
  const availableAgents = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addedNames = new Set<string>();

    // Priority 1 — registered team members. These are the only source that
    // can carry a real Firebase Auth `uid` (stamped on first login, see
    // AuthContext.linkUidToTeamMember), which is what scopeLeadsToRole /
    // firestore.rules actually match against. This MUST be merged first so
    // a real team member always wins over a same-named legacy roster entry.
    if (settings.teamSettings) {
      const depts = ["adsTeam", "seoTeam", "contentTeam", "designTeam", "editorTeam"];
      depts.forEach((dept) => {
        const team = (settings.teamSettings as any)[dept];
        if (Array.isArray(team)) {
          team.forEach((member: any) => {
            if (member.name && !addedNames.has(member.name.trim())) {
              // Prefer the real uid; fall back to the settings-record id only
              // if this member hasn't logged in yet (uid not linked).
              list.push({ id: member.uid || member.id || `team_${member.name}`, name: member.name.trim() });
              addedNames.add(member.name.trim());
            }
          });
        }
      });
    }

    // Priority 2 (fallback only) — legacy free-text sales agent roster.
    // Never overrides a name already claimed by a registered team member above.
    if (settings.salesAgents) {
      settings.salesAgents.forEach((a: any) => {
        if (a.name && !addedNames.has(a.name.trim())) {
          list.push({ id: a.id || `sa_${a.name}`, name: a.name.trim() });
          addedNames.add(a.name.trim());
        }
      });
    }

    // Priority 3 (fallback only) — names seen on existing leads that aren't
    // in either roster above (keeps old/orphaned agent names selectable).
    if (Array.isArray(leads)) {
      leads.forEach((l) => {
        if (l.agentName && !addedNames.has(l.agentName.trim())) {
          list.push({ id: l.agentId || `lead_${l.agentName}`, name: l.agentName.trim() });
          addedNames.add(l.agentName.trim());
        }
      });
    }

    if (list.length === 0) {
      list.push({ id: "1", name: "أحمد العتيبي" });
    }

    return list;
  }, [settings.salesAgents, settings.teamSettings, leads]);

  const [searchTerm, setSearchTerm] = useState("");
  const [leadsPage, setLeadsPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("");
  const salesAgentDropdownRef = useRef<HTMLDivElement>(null);
  const [salesAgentDropdownOpen, setSalesAgentDropdownOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (salesAgentDropdownRef.current && !salesAgentDropdownRef.current.contains(event.target as Node)) {
        setSalesAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [selectedMeetingStatusFilter, setSelectedMeetingStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "meetings_page" | "deleted">("all");
  const [currentMainTab, setCurrentMainTab] = useState<"analytics" | "clients" | "meetings">("analytics");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customDateRangePickerOpen, setCustomDateRangePickerOpen] = useState(false);

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
      // Saturday is day index 6. Middle Eastern week start.
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

  // Notification states for new Telesales leads
  const [seenLeads, setSeenLeads] = useState<string[]>(() => {
    try {
      const persisted = localStorage.getItem("seen_telesales_leads");
      return persisted ? JSON.parse(persisted) : [];
    } catch {
      return [];
    }
  });

  // Sync seen leads from localStorage in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const persisted = localStorage.getItem("seen_telesales_leads");
        if (persisted) {
          setSeenLeads(JSON.parse(persisted));
        }
      } catch (err) {
        console.error("Error updating seen leads local storage:", err);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("seenTelesalesLeadsUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("seenTelesalesLeadsUpdated", handleStorageChange);
    };
  }, []);

  const [initialLeadsLoaded, setInitialLeadsLoaded] = useState(false);
  const [knownTelesalesLeadIds, setKnownTelesalesLeadIds] = useState<string[]>([]);

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      // Tone 1: A5 (880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Tone 2: C#6 (1109Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(1109, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);

      // Tone 3: E6 (1318Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.setValueAtTime(1318, now + 0.2);
      gain3.gain.setValueAtTime(0, now + 0.2);
      gain3.gain.linearRampToValueAtTime(0.12, now + 0.25);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.7);
    } catch (err) {
      console.warn("Could not play notification sound:", err);
    }
  };

  // Play chime and trigger notification when a new telesales lead arrives
  useEffect(() => {
    if (leadsLoading || !leads || leads.length === 0) return;

    const currentTelesalesLeads = leads.filter(
      (l) => !l.isSystemDeleted && (!!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)")
    );
    const currentTelesalesIds = currentTelesalesLeads.map((l) => l.id).filter(Boolean) as string[];

    if (!initialLeadsLoaded) {
      setKnownTelesalesLeadIds(currentTelesalesIds);
      setInitialLeadsLoaded(true);
      return;
    }

    const newTelesalesIds = currentTelesalesIds.filter((id) => !knownTelesalesLeadIds.includes(id));

    if (newTelesalesIds.length > 0) {
      playChime();
      newTelesalesIds.forEach((id) => {
        const lead = currentTelesalesLeads.find((l) => l.id === id);
        if (lead && lead.clientName) {
          showFeedback(`🔔 عميل جديد محول من التيلي سيلز: ${lead.clientName}`);
        }
      });
      setKnownTelesalesLeadIds(currentTelesalesIds);
    }
  }, [leads, leadsLoading, initialLeadsLoaded, knownTelesalesLeadIds]);

  // Handle marking all as read when meetings tab is active
  useEffect(() => {
    if (activeTab === "meetings_page" && leads) {
      const telesalesLeads = leads.filter(
        (l) => !l.isSystemDeleted && (!!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)")
      );
      const telesalesIds = telesalesLeads.map((l) => l.id).filter(Boolean) as string[];
      
      const newSeenIds = telesalesIds.filter(id => !seenLeads.includes(id));
      if (newSeenIds.length > 0) {
        const merged = [...seenLeads, ...newSeenIds];
        try {
          localStorage.setItem("seen_telesales_leads", JSON.stringify(merged));
        } catch (e) {
          console.error("Failed to write to localStorage", e);
        }
        setSeenLeads(merged);
        
        // Dispatch the event asynchronously on the next tick so it doesn't interrupt rendering/state commit
        setTimeout(() => {
          window.dispatchEvent(new Event("seenTelesalesLeadsUpdated"));
        }, 0);
      }
    }
  }, [activeTab, leads, seenLeads]);

  const unseenTelesalesLeadsCount = useMemo(() => {
    if (!leads) return 0;
    const telesalesLeads = leads.filter(
      (l) => !l.isSystemDeleted && (!!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)")
    );
    const unseen = telesalesLeads.filter((l) => l.id && !seenLeads.includes(l.id));
    return unseen.length;
  }, [leads, seenLeads]);

  const unassignedTelesalesLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter(
      (l) => !l.isSystemDeleted && 
             (!!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)") &&
             (!l.agentName || l.agentName.trim() === "" || l.agentName === "-- تحديد فريق المبيعات --")
    );
  }, [leads]);

  const [hubTab, setHubTab] = useState<"leads" | "settings">("leads");
  const [settingsSubTab, setSettingsSubTab] = useState<"dropdowns" | "fields">("dropdowns");

  // Local state for edit custom fields configurations
  const [localFormConfig, setLocalFormConfig] = useState<any>(null);
  const [newContactType, setNewContactType] = useState("");
  const [newResponseOption, setNewResponseOption] = useState("");
  const [newMeetingStatus, setNewMeetingStatus] = useState("");
  const [newDataSource, setNewDataSource] = useState("");
  const [newFieldOption, setNewFieldOption] = useState("");
  const [newBusinessTypeOption, setNewBusinessTypeOption] = useState("");
  const [newSalesAgentName, setNewSalesAgentName] = useState("");

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
    const updated = (localFormConfig.sections || []).map((sec: any) => {
      if (sec.id === sectionId) return { ...sec, title };
      return sec;
    });
    setLocalFormConfig({ ...localFormConfig, sections: updated });
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!localFormConfig) return;
    // Cannot delete basic_info and basic structural sections
    if (["basic_info", "business_details", "contact_followups", "whatsapp_notes"].includes(sectionId)) {
      alert("لا يمكن حذف الأقسام الأساسية للنظام لسلامة البيانات.");
      return;
    }
    if (confirm("هل أنت متأكد من حذف هذا القسم؟ سيتم نقل الحقول المرتبطة به للقسم الأساسي.")) {
      const updatedSections = (localFormConfig.sections || []).filter((sec: any) => sec.id !== sectionId);
      const updatedFieldsConfig = { ...localFormConfig.fieldsConfig };
      Object.keys(updatedFieldsConfig).forEach((key) => {
        if (updatedFieldsConfig[key].sectionId === sectionId) {
          updatedFieldsConfig[key].sectionId = "basic_info";
        }
      });
      setLocalFormConfig({
        ...localFormConfig,
        sections: updatedSections,
        fieldsConfig: updatedFieldsConfig
      });
    }
  };

  // Synchronize system config from settings store when panel opens
  React.useEffect(() => {
    if (settings.salesForm) {
      const raw = settings.salesForm;
      setLocalFormConfig({
        ...DEFAULT_SALES_FORM,
        ...raw,
        dataSources: raw.dataSources || DEFAULT_SALES_FORM.dataSources,
        fieldsOptions: raw.fieldsOptions || DEFAULT_SALES_FORM.fieldsOptions,
        businessTypesOptions: raw.businessTypesOptions || DEFAULT_SALES_FORM.businessTypesOptions,
        sections: raw.sections || DEFAULT_SALES_FORM.sections,
        fieldsConfig: {
          ...DEFAULT_SALES_FORM.fieldsConfig,
          ...raw.fieldsConfig
        }
      });
    } else {
      setLocalFormConfig({ ...DEFAULT_SALES_FORM });
    }
  }, [settings.salesForm]);

  const addOption = (type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions", val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
    if (!val.trim() || !localFormConfig) return;
    const currentList = localFormConfig[type] || [];
    if (currentList.includes(val.trim())) {
      alert("الخيار مضاف بالفعل من قبل.");
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

  const handleSaveFormConfig = async () => {
    try {
      await saveSettings("salesForm", localFormConfig);
      showFeedback("تم حفظ وتعميم إعدادات حقول المبيعات بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الإعدادات في السيرفر.");
    }
  };

  const handleAddSalesAgent = async () => {
    if (!newSalesAgentName.trim()) return;
    try {
      const currentAgents = settings.salesAgents || [];
      const updatedAgents = [...currentAgents, { id: Date.now().toString(), name: newSalesAgentName.trim() }];
      await saveSettings("salesAgents", { items: updatedAgents });
      setNewSalesAgentName("");
      showFeedback("تم إضافة موظف المبيعات بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة موظف المبيعات.");
    }
  };

  const handleDeleteSalesAgent = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
      try {
        const currentAgents = settings.salesAgents || [];
        const updatedAgents = currentAgents.filter((a: any) => a.id !== id);
        await saveSettings("salesAgents", { items: updatedAgents });
        showFeedback("تم حذف الموظف من قائمة موظفي المبيعات بنجاح!");
      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء حذف الموظف.");
      }
    }
  };

  // Form states for manual additions
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);

  // Bulk operation states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAgentToAssign, setBulkAgentToAssign] = useState("");
  const [isBulkActionActive, setIsBulkActionActive] = useState(false);

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

  // Clear selections when tab or filter searches are executed
  useEffect(() => {
    setSelectedLeadIds([]);
  }, [activeTab, searchTerm, selectedAgentFilter, selectedMeetingStatusFilter]);

  const [formData, setFormData] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    clientName: "",
    phone: "",
    field: "",
    dataSource: "",
    storeLink: "",
    businessType: "",
    note: "",
    firstContactDate: "",
    contactType: "",
    whatsappMessageText: "",
    response: "",
    firstContactOutcome: "",
    dateFollow: "",
    followUp1: "",
    followUp2: "",
    followUp3: "",
    followUp4: "",
    meetingStatus: "",
    meetingLink: "",
    meetingTime: "",
    meetingStatusNote: "",
    agentId: "",
    agentName: "",
    isContracted: false,
    contractAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    telesalesNotified: false,
  });

  const [feedbackMsg, setFeedbackMsg] = useState("");
  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg("");
    }, 4000);
  };

  const handleSelectAllLeads = (filteredLeads: SalesLead[]) => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleSelectLead = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter(item => item !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const handleBulkReassignLeads = async () => {
    if (selectedLeadIds.length === 0 || !bulkAgentToAssign) {
      alert("الرجاء تشخيص العملاء المحددين وتحديد عضو فريق المبيعات الجديد للإسناد.");
      return;
    }
    const matchedAgent = availableAgents.find(a => a.name === bulkAgentToAssign);
    const agentId = matchedAgent?.id || "";

    if (confirm(`هل أنت متأكد من إعادة إسناد عدد (${selectedLeadIds.length}) عميل إلى مسؤول فريق المبيعات: ${bulkAgentToAssign}؟`)) {
      setIsBulkActionActive(true);
      let success = 0;
      try {
        for (const leadId of selectedLeadIds) {
          await updateLead(leadId, {
            agentId,
            agentName: bulkAgentToAssign
          });
          success++;
        }
        showFeedback(`تم بنجاح إرجاع وإعادة توزيع عدد ${success} عميل إلى فريق المبيعات: ${bulkAgentToAssign}!`);
        setSelectedLeadIds([]);
        setBulkAgentToAssign("");
      } catch (err) {
        console.error(err);
        alert("حدثت مشكلة أثناء النقل الجماعي للعملاء.");
      } finally {
        setIsBulkActionActive(false);
      }
    }
  };

  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.length === 0) return;

    const isHardDelete = activeTab === "deleted";

    // Restriction: Bulk delete of deleted/archived leads is restricted to master email only
    if (isHardDelete) {
      if (!isMasterEmail) {
        alert("عذراً، لا يمكن تطبيق الحذف الجماعي للعملاء المحذوفين والمؤرشفين إلا من خلال بريد المسؤول الماستر الأساسي فقط.");
        return;
      }
    }

    const confirmMsg = isHardDelete 
      ? `هل أنت متأكد نهائياً وبشكل كامل من حذف عدد (${selectedLeadIds.length}) عميل محدد من قاعدة البيانات؟`
      : `هل أنت متأكد من نقل عدد (${selectedLeadIds.length}) عميل محدد إلى قائمة العملاء المحذوفين؟`;

    setConfirmModalState({
      isOpen: true,
      title: "تأكيد إجراء الحذف الجماعي",
      message: confirmMsg,
      onConfirm: async () => {
        setIsBulkActionActive(true);
        let deletedCount = 0;
        try {
          for (const leadId of selectedLeadIds) {
            await deleteLead(leadId, isHardDelete);
            deletedCount++;
          }
          showFeedback(isHardDelete ? `تم بنجاح حذف عدد ${deletedCount} عميل نهائياً دفعة واحدة!` : `تم بنجاح نقل عدد ${deletedCount} عميل لقائمة العملاء المحذوفين!`);
          setSelectedLeadIds([]);
        } catch (err: any) {
          console.error(err);
          alert(`حدث خطأ أثناء الحذف الجماعي للعملاء: ${err?.message || err || ''}`);
        } finally {
          setIsBulkActionActive(false);
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Save Configured Custom Field
  const handleAddCustomField = () => {
    if (!customFieldKey.trim() || !customFieldLabel.trim() || !localFormConfig) {
      alert("يرجى إدخال كود الحقل بالإنجليزية، واسم الحقل بالعربية.");
      return;
    }
    const slug = customFieldKey.trim().replace(/\s+/g, '_').toLowerCase();
    
    // Check if key is preserved
    if (["id", "date", "clientName", "phone", "field", "dataSource", "storeLink", "businessType", "note", "firstContactDate", "contactType", "whatsappMessageText", "response", "firstContactOutcome", "dateFollow", "meetingStatus"].includes(slug)) {
      alert("الكود المدخل محجوز بالفعل لنظام التشغيل الأساسي.");
      return;
    }

    const updatedConfig = {
      ...localFormConfig.fieldsConfig,
      [slug]: {
        label: customFieldLabel.trim(),
        visible: true,
        required: customFieldRequired,
        isCustom: true,
        type: customFieldType,
        sectionId: customFieldSection,
        order: Object.keys(localFormConfig.fieldsConfig).length + 1
      }
    };

    setLocalFormConfig({
      ...localFormConfig,
      fieldsConfig: updatedConfig
    });

    setCustomFieldKey("");
    setCustomFieldLabel("");
    setCustomFieldType("text");
    setCustomFieldRequired(false);
    showFeedback("تم إضافة الحقل المخصص مؤقتاً باللوحة، يرجى حفظ التغييرات لاعتمادها!");
  };

  const handleRemoveCustomField = (key: string) => {
    if (!localFormConfig) return;
    if (confirm(`هل أنت متأكد من حذف الحقل المخصص "${localFormConfig.fieldsConfig[key]?.label}"؟ قد تفقد البيانات المحفوظة بهذا الحقل للعملاء الجدد.`)) {
      const updatedConfig = { ...localFormConfig.fieldsConfig };
      delete updatedConfig[key];
      setLocalFormConfig({
        ...localFormConfig,
        fieldsConfig: updatedConfig
      });
      showFeedback("تم إزالة الحقل، يرجى حفظ التغييرات لاعتمادها نهائياً!");
    }
  };

  const handleToggleFieldVisibility = (key: string) => {
    if (!localFormConfig) return;
    const current = localFormConfig.fieldsConfig[key];
    const updatedConfig = {
      ...localFormConfig.fieldsConfig,
      [key]: {
        ...current,
        visible: !current.visible
      }
    };
    setLocalFormConfig({
      ...localFormConfig,
      fieldsConfig: updatedConfig
    });
  };

  const handleToggleFieldRequired = (key: string) => {
    if (!localFormConfig) return;
    const current = localFormConfig.fieldsConfig[key];
    const updatedConfig = {
      ...localFormConfig.fieldsConfig,
      [key]: {
        ...current,
        required: !current.required
      }
    };
    setLocalFormConfig({
      ...localFormConfig,
      fieldsConfig: updatedConfig
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.phone) {
      alert("اسم العميل ورقم الجوال حقول إجبارية.");
      return;
    }
    const matched = availableAgents.find(a => a.name === formData.agentName);
    const agentId = matched ? matched.id : "";

    try {
      await addLead({
        ...formData,
        agentId,
      });
      setIsAddOpen(false);
      showFeedback("تم إضافة العميل الجديد بنجاح في قاعدة بيانات المبيعات!");
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        clientName: "",
        phone: "",
        field: "",
        dataSource: "",
        storeLink: "",
        businessType: "",
        note: "",
        firstContactDate: "",
        contactType: "",
        whatsappMessageText: "",
        response: "",
        firstContactOutcome: "",
        dateFollow: "",
        followUp1: "",
        followUp2: "",
        followUp3: "",
        followUp4: "",
        meetingStatus: "",
        meetingLink: "",
        meetingTime: "",
        meetingStatusNote: "",
        agentId: "",
        agentName: availableAgents[0]?.name || "",
        isContracted: false,
        contractAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        telesalesNotified: false,
      });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة العميل.");
    }
  };

  const handleEditClick = (lead: SalesLead) => {
    setSelectedLead(lead);
    setFormData({ ...lead });
    setIsEditOpen(true);
  };

  const handleViewClick = (lead: SalesLead) => {
    setSelectedLead(lead);
    setIsViewOpen(true);
  };

  const handleNotifyTelesales = async () => {
    const leadId = selectedLead?.id;
    const telesalesLeadId = formData.telesalesLeadId || selectedLead?.telesalesLeadId;
    if (!leadId) return;
    if (!telesalesLeadId) {
      alert("عذراً، هذا العميل لم يتم تحويله من طرف فريق التيلي سيلز ولا يوجد معرف مربوط به.");
      return;
    }

    const contractAmt = Number(formData.contractAmount || 0);
    const paidAmt = Number(formData.paidAmount || 0);
    const remainingAmt = Math.max(0, contractAmt - paidAmt);

    try {
      // 1. Update the telesales_leads document
      const telesalesRef = doc(db, "telesales_leads", telesalesLeadId);
      await updateDoc(telesalesRef, {
        isContracted: true,
        contractAmount: contractAmt,
        paidAmount: paidAmt,
        remainingAmount: remainingAmt,
        paymentStatus: "paid",
        contractNotification: {
          text: `تم التعاقد مع عميلك (${formData.clientName}) وتأكيد تحصيل مبلغ ${paidAmt} ر.س من أصل ${contractAmt} ر.س! مبروك 🎈`,
          date: new Date().toISOString(),
          read: false,
          type: "contracted"
        }
      });

      // 2. Set notified on the current form state
      const updatedFields = {
        ...formData,
        isContracted: true,
        contractAmount: contractAmt,
        paidAmount: paidAmt,
        remainingAmount: remainingAmt,
        telesalesNotified: true,
      };
      
      setFormData(updatedFields);

      // 3. Update the sales_lead in firebase
      await updateLead(leadId, updatedFields);

      showFeedback("تم إشعار موظف التيلي سيلز المحول بالتعاقد وتأكيد الدفعة المالية فورا! 📢");
    } catch (err: any) {
      console.error("Error notifying telesales:", err);
      alert("حدث خطأ أثناء إبلاغ موظف التيلي سيلز: " + err.message);
    }
  };

  const renderContractSection = () => {
    return (
      <div className="bg-gradient-to-r from-indigo-500/10 to-sky-500/10 border border-indigo-500/20 p-5 rounded-2xl space-y-4">
        <h4 className="font-extrabold text-sm text-indigo-400 flex items-center gap-1.5 border-b border-indigo-500/10 pb-2">
          <span>تفاصيل عقد الشراكة والتحصيل المالي</span>
        </h4>
        
        <div className="flex items-center gap-3 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10 mb-2">
          <input
            type="checkbox"
            id="isContracted"
            className="w-5 h-5 rounded border-indigo-500/30 text-indigo-500 bg-slate-900/50 focus:ring-indigo-500/40 cursor-pointer"
            checked={!!formData.isContracted}
            onChange={(e) => {
              const check = e.target.checked;
              setFormData({
                ...formData,
                isContracted: check,
                meetingStatus: check ? "ناجح" : formData.meetingStatus
              });
            }}
          />
          <label htmlFor="isContracted" className="text-xs font-black text-indigo-300 cursor-pointer select-none">
            تم التعاقد وتوقيع العقد مع هذا العميل رسمياً ✔
          </label>
        </div>

        {formData.isContracted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300">مبلغ التعاقد (ر.س)</label>
              <Input
                dark
                type="number"
                placeholder="امتداد العقد المالي"
                value={formData.contractAmount || ""}
                onChange={(e) => {
                  const amount = Number(e.target.value);
                  const paid = Number(formData.paidAmount || 0);
                  setFormData({
                    ...formData,
                    contractAmount: amount,
                    remainingAmount: Math.max(0, amount - paid)
                  });
                }}
                className="w-full text-xs font-mono font-bold"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300">المبلغ المدفوع (المحصل)</label>
              <Input
                dark
                type="number"
                placeholder="الدفعة المحصلة"
                value={formData.paidAmount || ""}
                onChange={(e) => {
                  const paid = Number(e.target.value);
                  const amount = Number(formData.contractAmount || 0);
                  setFormData({
                    ...formData,
                    paidAmount: paid,
                    remainingAmount: Math.max(0, amount - paid)
                  });
                }}
                className="w-full text-xs font-mono font-bold text-emerald-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300">المبلغ المتبقي</label>
              <Input
                dark
                type="number"
                disabled
                placeholder="الباقي تلقائياً"
                value={Math.max(0, Number(formData.contractAmount || 0) - Number(formData.paidAmount || 0))}
                className="w-full text-xs font-mono font-bold bg-[#0f172a]/80 text-rose-450 opacity-90 border-white/5"
              />
            </div>
          </div>
        )}

        {/* Notification button for Telesales Agent */}
        {formData.isContracted && (formData.telesalesLeadId || selectedLead?.telesalesLeadId) && (
          <div className="pt-3 border-t border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[10px] text-slate-400 font-semibold leading-normal max-w-sm">
              هذا العميل محول من التيلي سيلز. اضغط على الزر التالي لإبلاغ موظف التيلي سيلز بالتعاقد وتأكيد الدفعة مباشرة.
            </p>
            
            {formData.telesalesNotified ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/10 px-3.5 py-2 rounded-xl border border-emerald-500/15 shrink-0">
                <CheckCircle2 size={14} />
                <span>تم إبلاغ التيلي سيلز ✔</span>
              </span>
            ) : (
              <Button
                type="button"
                onClick={handleNotifyTelesales}
                className="h-10 px-5 text-[11px] font-black bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 shrink-0 cursor-pointer"
              >
                📢 ابلاغ التيلي سيلز بالتحصيل
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    const matched = availableAgents.find(a => a.name === formData.agentName);
    const agentId = matched ? matched.id : "";

    try {
      const updatedPayload: any = {
        ...formData,
        agentId,
      };

      await updateLead(selectedLead.id, updatedPayload);

      // If there is an associated telesales lead, notify them about meeting or contract!
      const telesalesLeadId = updatedPayload.telesalesLeadId || selectedLead?.telesalesLeadId;
      if (telesalesLeadId) {
        try {
          const telesalesRef = doc(db, "telesales_leads", telesalesLeadId);
          const telesalesUpdates: any = {};
          const isContracted = updatedPayload.isContracted || false;
          const contractAmt = Number(updatedPayload.contractAmount || 0);
          const paidAmt = Number(updatedPayload.paidAmount || 0);

          if (updatedPayload.meetingStatus) {
            telesalesUpdates.meetingStatus = updatedPayload.meetingStatus;
            telesalesUpdates.meetingStatusNote = updatedPayload.meetingStatusNote || "";
          }

          if (isContracted) {
            // Send automatic contract notification
            telesalesUpdates.isContracted = true;
            telesalesUpdates.contractAmount = contractAmt;
            telesalesUpdates.paidAmount = paidAmt;
            telesalesUpdates.remainingAmount = Math.max(0, contractAmt - paidAmt);
            telesalesUpdates.paymentStatus = "paid";
            telesalesUpdates.contractNotification = {
              text: `تم التعاقد مع عميلك (${formData.clientName}) وتأكيد تحصيل مبلغ ${paidAmt} ر.س من أصل ${contractAmt} ر.س! مبروك 🎈`,
              date: new Date().toISOString(),
              read: false,
              type: "contracted"
            };
            // Also ensure meeting status is updated on their end
            telesalesUpdates.meetingStatus = "تم الاجتماع";
            telesalesUpdates.salesNotification = {
              text: `تم عقد الاجتماع (الميتنج) مع عميلك (${formData.clientName}) بنجاح بواسطة إدارة المبيعات 🎉.`,
              date: new Date().toISOString(),
              read: false,
              type: "meeting_done"
            };

            // Set telesalesNotified, meetingStatus, and paymentStatus on sales lead
            await updateLead(selectedLead.id, { 
              telesalesNotified: true,
              meetingStatus: "تم الاجتماع",
              paymentStatus: "تم التعاقد"
            });
          } else if (updatedPayload.meetingStatus) {
            // Send meeting status only (for any status update!)
            const noteSuffix = updatedPayload.meetingStatusNote ? `\n📝 ملاحظات السيلز: ${updatedPayload.meetingStatusNote}` : "";
            
            if (["تم الاجتماع", "ناجح", "تم بنجاح"].includes(updatedPayload.meetingStatus)) {
              telesalesUpdates.salesNotification = {
                text: `تم عقد الاجتماع (الميتنج) مع عميلك (${formData.clientName}) بنجاح بواسطة إدارة المبيعات 🎉.${noteSuffix}`,
                date: new Date().toISOString(),
                read: false,
                type: "meeting_done"
              };
            } else {
              telesalesUpdates.salesNotification = {
                text: `تحديث من إدارة المبيعات لحالة ميتنج عميلك (${formData.clientName}) إلى [${updatedPayload.meetingStatus}] ⏳.${noteSuffix}`,
                date: new Date().toISOString(),
                read: false,
                type: "meeting_update"
              };
            }
          }

          if (Object.keys(telesalesUpdates).length > 0) {
            await updateDoc(telesalesRef, telesalesUpdates);
          }
        } catch (ex) {
          console.error("Error updating telesales lead from sales hub save:", ex);
        }
      }

      setIsEditOpen(false);
      setSelectedLead(null);
      showFeedback("تم تحديث بيانات العميل بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التحديث.");
    }
  };

  const handleDeleteClick = async (id: string, name: string) => {
    const isHardDelete = activeTab === "deleted";
    const msg = isHardDelete 
      ? `هل أنت متأكد من حذف العميل: ${name} نهائياً وبشكل كامل من قاعدة البيانات؟` 
      : `هل أنت متأكد من نقل العميل: ${name} إلى تبويب العملاء المحذوفين؟`;

    setConfirmModalState({
      isOpen: true,
      title: "تأكيد إجراء الحذف",
      message: msg,
      onConfirm: async () => {
        try {
          await deleteLead(id, isHardDelete);
          showFeedback(isHardDelete ? "تم حذف العميل نهائياً بنجاح." : "تم نقل العميل لتبويب العملاء المحذوفين بنجاح.");
        } catch (err) {
          console.error(err);
          alert("حدث خطأ أثناء الاستجابة لطلب الحذف.");
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Compiling Form Field Config
  const compiledFormConfig = useMemo(() => {
    const raw = settings?.salesForm || DEFAULT_SALES_FORM;
    const merged = {
      ...DEFAULT_SALES_FORM,
      ...raw,
      sections: raw.sections || DEFAULT_SALES_FORM.sections,
      fieldsConfig: {
        ...DEFAULT_SALES_FORM.fieldsConfig,
        ...raw.fieldsConfig
      }
    };

    // Repair config keys sectionIds
    const defaultSecId = merged.sections?.[0]?.id || "basic_info";
    Object.keys(merged.fieldsConfig).forEach(key => {
      const field = merged.fieldsConfig[key];
      if (!field.sectionId) {
        if (DEFAULT_SALES_FORM.fieldsConfig[key]?.sectionId) {
          field.sectionId = DEFAULT_SALES_FORM.fieldsConfig[key].sectionId;
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
  }, [settings?.salesForm]);

  const formConfig = compiledFormConfig;

  // Filtered Leads calculation
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    const todayStr = new Date().toISOString().split("T")[0];
    const getDaysAgoDateStr = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split("T")[0];
    };

    return leads.filter((lead) => {
      // Manage deleted status filter
      if (lead.isSystemDeleted === true) {
        if (activeTab !== "deleted") return false;
      } else {
        if (activeTab === "deleted") return false;
      }

      const isFromTelesales = !!lead.telesalesLeadId || lead.dataSource === "من التيلي سيلز (محول)";

      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || 
        lead.clientName?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        lead.field?.toLowerCase().includes(term) ||
        lead.dataSource?.toLowerCase().includes(term);

      const matchAgent = !selectedAgentFilter || lead.agentName === selectedAgentFilter;
      const matchMeeting = !selectedMeetingStatusFilter || lead.meetingStatus === selectedMeetingStatusFilter;

      // Time Filtering matching
      let matchTime = true;
      const lDate = lead.createdAt || lead.date || "";
      if (lDate) {
        const leadDateStr = typeof lDate === "string" ? (lDate.includes("T") ? lDate.split("T")[0] : lDate.substring(0, 10)) : "";
        if (leadDateStr) {
          if (timeFilter === "today") {
            matchTime = leadDateStr === todayStr;
          } else if (timeFilter === "week") {
            const limitDate = getDaysAgoDateStr(7);
            matchTime = leadDateStr >= limitDate && leadDateStr <= todayStr;
          } else if (timeFilter === "month") {
            const currentMonthPrefix = todayStr.substring(0, 7); // "YYYY-MM"
            matchTime = leadDateStr.startsWith(currentMonthPrefix);
          } else if (timeFilter === "custom") {
            if (startDate) {
              matchTime = matchTime && leadDateStr >= startDate;
            }
            if (endDate) {
              matchTime = matchTime && leadDateStr <= endDate;
            }
          }
        } else {
          matchTime = false;
        }
      } else {
        matchTime = false;
      }

      let matchTab = true;
      if (activeTab === "meetings_page") {
        matchTab = isFromTelesales;
      } else if (activeTab === "all") {
        // Show non-telesales leads, or telesales leads that have already been assigned to an agent
        matchTab = !isFromTelesales || (!!lead.agentName && lead.agentName !== "-- تحديد فريق المبيعات --" && lead.agentName.trim() !== "");
      }

      return matchSearch && matchAgent && matchMeeting && matchTime && matchTab;
    });
  }, [leads, searchTerm, selectedAgentFilter, selectedMeetingStatusFilter, activeTab, timeFilter, startDate, endDate]);

  // Filtered Leads specifically for Analytics metrics
  const displayAnalyticsLeads = useMemo(() => {
    if (!leads) return [];
    
    const todayStr = new Date().toISOString().split("T")[0];
    const getDaysAgoDateStr = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split("T")[0];
    };

    return leads.filter((lead) => {
      if (lead.isSystemDeleted === true) return false;

      const matchAgent = !selectedAgentFilter || lead.agentName === selectedAgentFilter;

      // Time Filtering matching
      let matchTime = true;
      const lDate = lead.createdAt || lead.date || "";
      if (lDate) {
        const leadDateStr = typeof lDate === "string" ? (lDate.includes("T") ? lDate.split("T")[0] : lDate.substring(0, 10)) : "";
        if (leadDateStr) {
          if (timeFilter === "today") {
            matchTime = leadDateStr === todayStr;
          } else if (timeFilter === "week") {
            const limitDate = getDaysAgoDateStr(7);
            matchTime = leadDateStr >= limitDate && leadDateStr <= todayStr;
          } else if (timeFilter === "month") {
            const currentMonthPrefix = todayStr.substring(0, 7); // "YYYY-MM"
            matchTime = leadDateStr.startsWith(currentMonthPrefix);
          } else if (timeFilter === "custom") {
            if (startDate) {
              matchTime = matchTime && leadDateStr >= startDate;
            }
            if (endDate) {
              matchTime = matchTime && leadDateStr <= endDate;
            }
          }
        } else {
          matchTime = false;
        }
      } else {
        matchTime = false;
      }

      return matchAgent && matchTime;
    });
  }, [leads, selectedAgentFilter, timeFilter, startDate, endDate]);

  // Freeze the customer list while the manager is actively editing to prevent cards/rows from jumping/reordering
  const [stableLeads, setStableLeads] = useState<SalesLead[]>(filteredLeads);

  useEffect(() => {
    if (!isEditOpen && !selectedLead) {
      setStableLeads(filteredLeads);
    }
  }, [filteredLeads, isEditOpen, selectedLead]);

  // Reset page when filters or stable leads change
  useEffect(() => {
    setLeadsPage(1);
  }, [stableLeads.length]);

  const totalLeadsPages = Math.max(1, Math.ceil(stableLeads.length / ITEMS_PER_PAGE));
  const activeLeadsPage = Math.min(leadsPage, totalLeadsPages);
  const paginatedStableLeads = useMemo(() => {
    const startIndex = (activeLeadsPage - 1) * ITEMS_PER_PAGE;
    return stableLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [stableLeads, activeLeadsPage]);

  // Analytics Calculation
  const stats = useMemo(() => {
    const activeLeads = displayAnalyticsLeads;
    const total = activeLeads.length || 0;
    
    const meetingsCount = activeLeads.filter(
      l => l.meetingStatus && 
           l.meetingStatus !== "لا يوجد ميتنج" && 
           l.meetingStatus !== "غير حدد" && 
           l.meetingStatus !== "بلا ميتنج" && 
           l.meetingStatus !== "لم يحدد" && 
           l.meetingStatus !== "غير محدد"
    ).length;

    const successfulMeetings = activeLeads.filter(
      l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "تحت المتابعة" || l.meetingStatus === "تم الاجتماع" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح"
    ).length;

    const quoteLeads = activeLeads.filter(l => {
      const responseText = String(l.response || "").trim();
      const outcomeText = String(l.firstContactOutcome || "").trim();
      const noteText = String(l.note || "").trim();
      const hasQuoteInResponse = responseText === "تم تقديم عرض السعر" || responseText === "عرض سعر مرفوض" || responseText.includes("عرض سعر") || responseText.includes("عرض السعر");
      const hasQuoteInOutcome = outcomeText.includes("عرض سعر") || outcomeText.includes("تقديم السعر") || outcomeText.includes("ارسال سعر") || outcomeText.includes("ارسال الكوتيشن") || outcomeText.includes("كوتيشن");
      const hasQuoteInNotes = noteText.includes("عرض سعر") || noteText.includes("عرض السعر") || noteText.includes("ارسال الكوتيشن") || noteText.includes("كوتيشن") || noteText.toLowerCase().includes("quotation");
      const hasAmount = Number(l.amount || 0) > 0 || Number(l.contractAmount || 0) > 0;
      return hasQuoteInResponse || hasQuoteInOutcome || hasQuoteInNotes || hasAmount;
    });
    const totalQuotesCount = quoteLeads.length;
    const totalQuotesValue = quoteLeads.reduce((acc, l) => acc + Number(l.amount || l.contractAmount || 0), 0);

    const wonLeads = activeLeads.filter(l => l.isContracted === true || l.paymentStatus === "تم التعاقد" || l.response === "مستعد للتعاقد");
    const totalContractsCount = wonLeads.length;
    const totalContractValue = wonLeads.reduce((acc, l) => acc + Number(l.contractAmount || 0), 0);

    const revenue = activeLeads.reduce((acc, l) => acc + Number(l.paidAmount || 0), 0);
    const totalRemainingAmount = activeLeads.reduce((acc, l) => acc + Number(l.remainingAmount || 0), 0);

    const activePipeline = activeLeads.filter(l => l.response && l.response !== "غير مهتم" && l.response !== "لم يحدد")?.length || 0;
    const closedWon = totalContractsCount;
    const conversionRate = total > 0 ? Math.round((closedWon / total) * 100) : 0;

    return { 
      total, 
      meetingsCount, 
      successfulMeetings, 
      totalQuotesCount, 
      totalQuotesValue, 
      totalContractsCount, 
      totalContractValue, 
      revenue, 
      totalRemainingAmount, 
      activePipeline, 
      closedWon, 
      conversionRate 
    };
  }, [displayAnalyticsLeads]);

  // أكثر المجالات تعاقدًا
  const contractedSectorsData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    const activeLeads = displayAnalyticsLeads;
    const contractedLeads = activeLeads.filter(
      l => l.isContracted === true || l.paymentStatus === "تم التعاقد" || l.response === "مستعد للتعاقد"
    );

    contractedLeads.forEach(l => {
      const sector = l.field || "غير محدد";
      if (!map[sector]) {
        map[sector] = { count: 0, value: 0 };
      }
      map[sector].count++;
      map[sector].value += Number(l.contractAmount || 0);
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.count - a.count);
  }, [displayAnalyticsLeads]);

  const repStats = useMemo(() => {
    const list: { name: string; count: number; won: number; rate: number }[] = [];
    const activeLeads = displayAnalyticsLeads;
    
    availableAgents.forEach(agent => {
      const agentLeads = activeLeads.filter(l => l.agentName === agent.name);
      const count = agentLeads.length;
      const won = agentLeads.filter(l => l.response === "مستعد للتعاقد" || l.isContracted === true || l.paymentStatus === "تم التعاقد").length;
      const rate = count > 0 ? Math.round((won / count) * 100) : 0;
      if (count > 0) {
        list.push({ name: agent.name, count, won, rate });
      }
    });

    return list.sort((a,b) => b.rate - a.rate);
  }, [displayAnalyticsLeads, availableAgents]);

  const sourceStats = useMemo(() => {
    const map: Record<string, { count: number; won: number }> = {};
    const activeLeads = displayAnalyticsLeads;
    
    activeLeads.forEach(l => {
      const src = l.dataSource || "غير محدد";
      if (!map[src]) map[src] = { count: 0, won: 0 };
      map[src].count++;
      if (l.response === "مستعد للتعاقد" || l.isContracted === true || l.paymentStatus === "تم التعاقد") map[src].won++;
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      count: val.count,
      won: val.won,
      rate: val.count > 0 ? Math.round((val.won / val.count) * 100) : 0
    })).sort((a,b) => b.count - a.count);
  }, [displayAnalyticsLeads]);

  const fieldStats = useMemo(() => {
    const map: Record<string, { count: number; won: number }> = {};
    const activeLeads = displayAnalyticsLeads;
    
    activeLeads.forEach(l => {
      const fld = l.field || "غير محدد";
      if (!map[fld]) map[fld] = { count: 0, won: 0 };
      map[fld].count++;
      if (l.response === "مستعد للتعاقد" || l.isContracted === true || l.paymentStatus === "تم التعاقد") map[fld].won++;
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      count: val.count,
      won: val.won,
      rate: val.count > 0 ? Math.round((val.won / val.count) * 100) : 0
    })).sort((a,b) => b.count - a.count);
  }, [displayAnalyticsLeads]);

  // Render Form inputs for add / edit fields dynamically
  const renderFieldInput = (key: string, field: any) => {
    const getLocalDateString = () => {
      const d = new Date();
      return d.toISOString().split('T')[0];
    };

    if (key === "date" || key === "firstContactDate" || key === "dateFollow") {
      return (
        <div className="relative">
          <Input 
            dark
            type="date"
            required={field.required}
            value={formData[key] || ""}
            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
            className="w-full text-xs"
          />
          {key === "date" && !formData.date && (
            <button
              type="button"
              onClick={() => setFormData({ ...formData, date: getLocalDateString() })}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded hover:bg-sky-500/20"
            >
              اليوم
            </button>
          )}
        </div>
      );
    }

    if (key === "agentName") {
      return (
        <Select
          dark
          required={field.required}
          value={formData.agentName || ""}
          onChange={(e) => {
            const agentName = e.target.value;
            const ag = availableAgents.find(a => a.name === agentName);
            setFormData({ ...formData, agentName, agentId: ag?.id || "" });
          }}
        >
          <option value="">اختر مسؤول فريق المبيعات المباشر...</option>
          {availableAgents.map((ag) => (
            <option key={ag.id} value={ag.name}>{ag.name}</option>
          ))}
        </Select>
      );
    }

    if (key === "field") {
      return (
        <Select
          dark
          required={field.required}
          value={formData.field || ""}
          onChange={(e) => setFormData({ ...formData, field: e.target.value })}
        >
          <option value="">اختر المجال أو قطاع النشاط...</option>
          {(formConfig.fieldsOptions || DEFAULT_SALES_FORM.fieldsOptions || [])?.map((opt: string) => (
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
          value={formData.businessType || ""}
          onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
        >
          <option value="">اختر نوع البيزنس أو الشركة...</option>
          {(formConfig.businessTypesOptions || DEFAULT_SALES_FORM.businessTypesOptions || [])?.map((opt: string) => (
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
          value={formData.dataSource || ""}
          onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
        >
          <option value="">اختر سورس الداتا...</option>
          {(formConfig.dataSources || DEFAULT_SALES_FORM.dataSources || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "contactType") {
      return (
        <Select
          dark
          required={field.required}
          value={formData.contactType || ""}
          onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
        >
          <option value="">اختر نوع التواصل...</option>
          {(formConfig.contactTypes || DEFAULT_SALES_FORM.contactTypes || [])?.map((opt: string) => (
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
          value={formData.response || ""}
          onChange={(e) => setFormData({ ...formData, response: e.target.value })}
        >
          <option value="">اختر نوع الاستجابة والرد...</option>
          {(formConfig.responseOptions || DEFAULT_SALES_FORM.responseOptions || [])?.filter(opt => opt !== "لم يحدد" && opt !== "تم الرد")?.map((opt: string) => (
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
          value={formData.meetingStatus || ""}
          onChange={(e) => setFormData({ ...formData, meetingStatus: e.target.value })}
        >
          <option value="">اختر حالة الاجتماع...</option>
          {(formConfig.meetingStatuses || DEFAULT_SALES_FORM.meetingStatuses || [])?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (field.type === "textarea" || key === "note" || key === "whatsappMessageText" || key === "firstContactOutcome") {
      return (
        <textarea
          required={field.required}
          value={formData[key] || ""}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          rows={3}
          className="w-full bg-[#020617]/70 text-white text-xs px-4 py-3 rounded-xl border border-white/[0.08] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/20 transition-all font-sans"
        />
      );
    }

    return (
      <Input
        dark
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        value={formData[key] || ""}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="text-xs h-11"
      />
    );
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showFeedback("تم نسخ النص للحافظة بنجاح!");
  };

  const copyLeadAllDataToWhatsApp = (lead: any) => {
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
    
    // Extract Telesales Agent Name
    const isFromTelesales = !!lead.telesalesLeadId || lead.dataSource === "من التيلي سيلز (محول)";
    let telesalesAgentName = lead.telesalesAgentName || "";
    if (isFromTelesales && !telesalesAgentName) {
      const noteStr = lead.note || "";
      const match1 = noteStr.match(/\[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي:\s*([^\]\n]+)\]/);
      if (match1) {
        telesalesAgentName = match1[1].trim();
      } else {
        const match2 = noteStr.match(/\[تم التحويل من تلي سيلز - موظف\s*([^\]\n]+)\]/);
        if (match2) telesalesAgentName = match2[1].trim();
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
    if (isFromTelesales && telesalesAgentName) {
      parts.push(`👤 *التيلي سيلز ايجنت:* ${telesalesAgentName}`);
    }
    if (lead.agentName) parts.push(`👤 *السيلز مان:* ${lead.agentName}`);
    if (lead.createdAt || lead.date) parts.push(`🕒 *تاريخ الإضافة:* ${lead.createdAt || lead.date}`);

    const standardKeys = [
      "id", "date", "clientName", "phone", "field", "dataSource", "storeLink", 
      "businessType", "note", "firstContactDate", "contactType", "whatsappMessageText", 
      "response", "firstContactOutcome", "dateFollow", "followUp1", "followUp2", 
      "followUp3", "followUp4", "meetingStatus", "meetingLink", "meetingTime", "agentId", "agentName", 
      "createdAt", "updatedAt", "isSystemDeleted", "deletedAt", "distributedToSales", "salesLeadId",
      "telesalesLeadId", "telesalesAgentName", "telesalesAgentId", "distributedAt"
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
    showFeedback("تم نسخ جميع تفاصيل بيانات العميل بشكل منظم وجاهز للمشاركة على جروبات الواتساب! ✅");
  };

  return (
    <div className="space-y-8 pb-16 relative" dir="rtl">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#090d1f] border border-emerald-500/20 text-emerald-300 font-bold px-5 py-4 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs tracking-wide">{feedbackMsg}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#00AEEF]/10 text-[#00AEEF] rounded-2xl border border-[#00AEEF]/20">
              <Target size={26} className="text-[#00AEEF]" />
            </span>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none">إدارة قسم المبيعات</h1>
              <p className="text-xs text-slate-400 mt-2 font-medium">لوحة التحكم لفرق المبيعات المباشرة وإدارة الليدز والصفقات المفتوحة لزيادة كفاءة الإغلاق وتحقيق المبيعات.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Client button removed by request */}
        </div>
      </div>

      {/* Master Toolbar Container: Navigation Tabs on the Right, Filters on the Left */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 w-full select-none">
        {/* Main Section Navigation Tabs */}
        <div className="flex bg-slate-950/60 backdrop-blur-3xl p-1 rounded-2xl border border-white/[0.08] shadow-xl items-center select-none w-full lg:w-auto lg:min-w-[420px]">
          <button
            onClick={() => {
              setCurrentMainTab("analytics");
            }}
            className={cn(
              "flex-1 py-2 md:py-2.5 px-4 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap",
              currentMainTab === "analytics"
                ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <TrendingUp size={14} />
            <span>لوحة التحليلات</span>
          </button>

          <button
            onClick={() => {
              setCurrentMainTab("clients");
              if (activeTab === "meetings_page") {
                setActiveTab("all");
              }
            }}
            className={cn(
              "flex-1 py-2 md:py-2.5 px-4 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap",
              currentMainTab === "clients"
                ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <Users size={14} />
            <span>بيانات العملاء</span>
          </button>

          <button
            onClick={() => {
              setCurrentMainTab("meetings");
              setActiveTab("meetings_page");
            }}
            className={cn(
              "flex-1 py-2 md:py-2.5 px-4 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 relative whitespace-nowrap",
              currentMainTab === "meetings"
                ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15 border-t border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <PhoneCall size={14} className={cn(unassignedTelesalesLeads.length > 0 ? "text-amber-400 animate-bounce shrink-0" : "shrink-0")} />
            <span>استقبال ميتنج التيلي</span>
            {unassignedTelesalesLeads.length > 0 ? (
              <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow-lg border border-slate-950 animate-pulse flex items-center gap-0.5">
                <span>{unassignedTelesalesLeads.length}</span>
                <span className="text-[8px]">جديد</span>
              </span>
            ) : unseenTelesalesLeadsCount > 0 ? (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white font-extrabold text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full shadow-md animate-pulse">
                {unseenTelesalesLeadsCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Master Filters (Telesales Style): Agent Dropdown & Date Range Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Agent selection dropdown */}
          <div ref={salesAgentDropdownRef} className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSalesAgentDropdownOpen(!salesAgentDropdownOpen)}
              className="h-11 px-4 rounded-xl border border-white/[0.08] bg-slate-900/90 text-white text-xs font-bold focus:ring-2 focus:ring-[#00AEEF]/50 font-sans cursor-pointer w-full sm:min-w-[180px] max-w-full flex items-center justify-between gap-3.5 transition-all hover:bg-slate-900/70 select-none shadow-md"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                <span className="truncate">
                  {selectedAgentFilter ? selectedAgentFilter : "كل موظفي المبيعات"}
                </span>
              </div>
              <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300 shrink-0", salesAgentDropdownOpen && "rotate-180 text-sky-400")} />
            </button>

            <AnimatePresence>
              {salesAgentDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full left-0 mt-2 w-full sm:min-w-[210px] bg-slate-950/95 backdrop-blur-3xl rounded-2xl border border-white/[0.1] shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-1.5 z-50 overflow-hidden text-right leading-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-sky-500/[0.03] to-indigo-500/[0.03] pointer-events-none" />
                  
                  <div className="relative space-y-1 max-h-[300px] overflow-y-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAgentFilter("");
                        setSalesAgentDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer border border-transparent",
                        !selectedAgentFilter
                          ? "bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-400 border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Users size={13} className={!selectedAgentFilter ? "text-sky-400" : "text-slate-500"} />
                        <span>كل موظفي المبيعات</span>
                      </div>
                      {!selectedAgentFilter && <Check size={12} className="text-sky-400 shrink-0" />}
                    </button>

                    {availableAgents.map((agent) => {
                      const isSelected = selectedAgentFilter === agent.name;
                      return (
                        <button
                          key={agent.id || agent.name}
                          type="button"
                          onClick={() => {
                            setSelectedAgentFilter(agent.name);
                            setSalesAgentDropdownOpen(false);
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

          {/* Date range buttons and absolute Custom Select container */}
          <div className="relative w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-slate-950/50 backdrop-blur-md p-1.5 rounded-xl border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] w-full sm:w-auto overflow-x-auto no-scrollbar justify-between sm:justify-start">
              {[
                { id: "today", label: "يومي" },
                { id: "week", label: "أسبوعي" },
                { id: "month", label: "شهري" },
                { id: "custom", label: "تخصيص" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'custom') {
                      setCustomDateRangePickerOpen(prev => !prev);
                    } else {
                      setCustomDateRangePickerOpen(false);
                    }
                    setTimeFilter(item.id as any);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap min-w-[55px] text-center",
                    timeFilter === item.id
                      ? "bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/20 font-black shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Premium, Preset-Driven Custom Date Picker Drawer/Dropdown */}
            {timeFilter === "custom" && customDateRangePickerOpen && (
              <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-3 p-4 bg-slate-950/98 backdrop-blur-2xl border border-[#00AEEF]/25 rounded-2xl w-full sm:w-[340px] shadow-[0_15px_30px_rgba(0,0,0,0.8)] z-50 animate-in fade-in slide-in-from-top-2 duration-250">
                <div className="text-right mb-2 pb-1 border-b border-white/[0.05]">
                  <span className="text-[10px] text-[#00AEEF] font-black tracking-wider uppercase">⚡ اختصارات التحديد السريع:</span>
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
                      className="px-2.5 py-1.5 bg-white/[0.03] hover:bg-[#00AEEF]/10 border border-white/[0.05] hover:border-[#00AEEF]/20 text-slate-300 hover:text-[#00AEEF] text-[10.5px] font-bold text-center rounded-lg transition-all cursor-pointer active:scale-95"
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
                        className="w-full h-8 px-2 text-center rounded-lg border border-white/[0.08] bg-slate-900 text-white text-[10.5px] focus:outline-none focus:ring-1 focus:ring-[#00AEEF]/50 font-sans cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] text-slate-400 font-black block text-right">📅 إلى تاريخ:</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-8 px-2 text-center rounded-lg border border-white/[0.08] bg-slate-900 text-white text-[10.5px] focus:outline-none focus:ring-1 focus:ring-[#00AEEF]/50 font-sans cursor-pointer"
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

      {currentMainTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 font-sans">
            
            {/* Card 1: إجمالي العملاء */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-sky-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي العملاء</span>
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                  <Users size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white font-mono">
                  {leadsLoading ? "..." : stats.total}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  إجمالي العملاء الموزعين
                </p>
              </div>
            </Card>

            {/* Card 2: اجمالي الميتنج */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-sky-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي الميتنج</span>
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                  <CalendarDays size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white font-mono">
                  {leadsLoading ? "..." : stats.meetingsCount}
                </h3>
                <p className="text-[10px] text-sky-400 font-bold leading-normal">
                  مجدول ومنفذ حالياً للفلترة
                </p>
              </div>
            </Card>

            {/* Card 3: اجمالي الميتنج الناجح */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">الميتنج الناجح</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-400 font-mono">
                  {leadsLoading ? "..." : stats.successfulMeetings}
                </h3>
                <p className="text-[10px] text-emerald-500 font-bold leading-normal">
                  ميتنجز ناجحة ومتابعة بدقة
                </p>
              </div>
            </Card>

            {/* Card 4: اجمالي عروض الأسعار */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">عروض الأسعار</span>
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <FileText size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-white font-mono">
                    {leadsLoading ? "..." : stats.totalQuotesCount}
                  </h3>
                  <span className="text-xs text-slate-400">عروض</span>
                </div>
                <p className="text-[11px] font-extrabold text-amber-405 text-amber-400 font-mono" dir="ltr">
                  {leadsLoading ? "..." : stats.totalQuotesValue.toLocaleString()} ر.س
                </p>
              </div>
            </Card>

            {/* Card 5: اجمالي التعاقدات */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">إجمالي التعاقدات</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Briefcase size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-white font-mono">
                    {leadsLoading ? "..." : stats.totalContractsCount}
                  </h3>
                  <span className="text-xs text-slate-400">عقود</span>
                </div>
                <p className="text-[11px] font-extrabold text-purple-400 font-mono" dir="ltr">
                  {leadsLoading ? "..." : stats.totalContractValue.toLocaleString()} ر.س
                </p>
              </div>
            </Card>

            {/* Card 6: اجمالي المبلغ المدفوع */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-teal-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">المبلغ المدفوع</span>
                <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-400 font-mono text-left" dir="ltr">
                  {leadsLoading ? "..." : stats.revenue.toLocaleString()} <span className="text-xs text-slate-400 font-sans">ر.س</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  إجمالي المحصل والأرباح
                </p>
              </div>
            </Card>

            {/* Card 7: اجمالي المبلغ المتبقي */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-400" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">المبلغ المتبقي</span>
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                  <AlertCircle size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-rose-400 font-mono text-left" dir="ltr">
                  {leadsLoading ? "..." : stats.totalRemainingAmount.toLocaleString()} <span className="text-xs text-slate-400 font-sans">ر.س</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  مستحقات متبقية قيد التحصيل
                </p>
              </div>
            </Card>

            {/* Card 8: تارجت قسم المبيعات (الكل) */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">تارجت قسم المبيعات</span>
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                  <Target size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white font-mono text-left" dir="ltr">
                  <span>{leadsLoading ? "..." : stats.totalContractValue.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 font-sans font-bold"> / {(settings.targets?.salesDeptTarget || 0).toLocaleString()} ر.س</span>
                </h3>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>نسبة الإنجاز:</span>
                  <span className="font-mono text-rose-400">
                    {settings.targets?.salesDeptTarget && settings.targets.salesDeptTarget > 0 
                      ? Math.round((stats.totalContractValue / settings.targets.salesDeptTarget) * 100)
                      : 0}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(
                        settings.targets?.salesDeptTarget && settings.targets.salesDeptTarget > 0 
                          ? Math.round((stats.totalContractValue / settings.targets.salesDeptTarget) * 100)
                          : 0, 
                        100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            </Card>

          </div>

          {/* Dynamic BI Grid Analytics */}
          <div className="grid grid-cols-1 gap-6">
            {/* Sales Rep performance */}
            <Card glass className="p-6 border-white/[0.05]">
              <h4 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                <Users size={16} className="text-[#00AEEF]" />
                <span>أداء وإنتاجية فريق المبيعات</span>
              </h4>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {repStats.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">لا توجد بيانات متاحة حالياً للقسم.</p>
                ) : (
                  repStats.map((rep) => (
                    <div key={rep.name} className="space-y-1.5 bg-white/[0.01] p-3 rounded-xl border border-white/[0.03]">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-200">{rep.name}</span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {rep.won} ديل كسبان من {rep.count} عملاء
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 bg-[#020617] rounded-full flex-1 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${rep.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-emerald-400 min-w-[32px] text-left">
                          {rep.rate}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* New Row: Most Contracted Sectors Chart */}
          <div className="mt-6">
            <Card glass className="p-6 border-white/[0.05]">
              <h4 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                <span className="text-emerald-400">★</span>
                <span>تحليل القطاعات والمجالات الأكثر تعاقداً</span>
              </h4>
              <p className="text-xs text-slate-400 font-medium mb-6 leading-relaxed">
                توزيع صفقات التعاقد الناجحة والمستعدة للتعاقد عبر مجالات الأعمال والأنشطة الاقتصادية المختلفة لتحديد القطاعات الأعلى ربحية وقيمة تعاقدية للشركة.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractedSectorsData.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 italic text-xs">
                    لا توجد تعاقدات مسجلة حالياً لعرض تحليل المجالات الأكثر تعاقداً.
                  </div>
                ) : (
                  contractedSectorsData.map((item, index) => {
                    const totalContractsCount = contractedSectorsData.reduce((acc, x) => acc + x.count, 0);
                    const percent = totalContractsCount > 0 ? Math.round((item.count / totalContractsCount) * 100) : 0;
                    return (
                      <div key={item.name} className="relative bg-white/[0.01] p-4 rounded-xl border border-white/[0.03] flex flex-col justify-between overflow-hidden group hover:bg-white/[0.02] transition-all">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-lg pointer-events-none" />
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500 font-bold">0{index + 1}.</span>
                            <span className="font-extrabold text-slate-100 text-xs">{item.name}</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full font-mono">
                            {item.count} تعاقد
                          </span>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>القيمة الاستثمارية:</span>
                            <span className="font-bold text-slate-200 font-mono text-left">{item.value.toLocaleString()} ر.س</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 bg-[#020617] rounded-full flex-1 overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 min-w-[24px] text-left font-sans">
                              {percent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {(currentMainTab === "clients" || currentMainTab === "meetings") && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Leads Filter Bar */}
          <Card glass className="p-5 border-white/[0.04] flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  dark
                  placeholder="ابحث عن العميل بالاسم، الهاتف، المجال..."
                  className="pr-10 text-xs h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="w-full sm:w-48">
                <Select
                  dark
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="text-xs h-11"
                >
                  <option value="">كل أعضاء فريق المبيعات</option>
                  {availableAgents.map((ag) => (
                    <option key={ag.id} value={ag.name}>{ag.name}</option>
                  ))}
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <Select
                  dark
                  value={selectedMeetingStatusFilter}
                  onChange={(e) => setSelectedMeetingStatusFilter(e.target.value)}
                  className="text-xs h-11"
                >
                  <option value="">كل حالات الاجتماعات</option>
                  {(formConfig.meetingStatuses || DEFAULT_SALES_FORM.meetingStatuses || [])?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Quick Filter Tabs (Only shown inside direct-sale Client Data section if more than one tab exists) */}
            {currentMainTab === "clients" && isMasterEmail && (
              <div className="flex bg-[#020617]/50 p-1 rounded-xl border border-white/[0.05] w-full md:w-auto overflow-x-auto no-scrollbar gap-1">
                {[
                  { id: "all", label: "عملاء المبيعات" },
                  { id: "deleted", label: "العملاء المحذوفون" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "relative px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                      activeTab === tab.id
                        ? "bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/10 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Bulk Action Controls */}
          {selectedLeadIds.length > 0 && (
            <Card className="p-4 bg-sky-950/20 border-sky-500/30 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl xl:py-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse" />
                <p className="text-xs font-bold text-sky-300">لقد حددت عدد <span className="text-white font-black">{selectedLeadIds.length}</span> عميل من الجدول.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="w-52">
                  <Select
                    dark
                    value={bulkAgentToAssign}
                    onChange={(e) => setBulkAgentToAssign(e.target.value)}
                    className="h-10 text-xs border-sky-500/30 focus:border-sky-400"
                    disabled={isBulkActionActive}
                  >
                    <option value="">اختر عضو فريق مبيعات جديد...</option>
                    {availableAgents.map((ag) => (
                      <option key={ag.id} value={ag.name}>{ag.name}</option>
                    ))}
                  </Select>
                </div>

                <Button
                  onClick={handleBulkReassignLeads}
                  disabled={isBulkActionActive || !bulkAgentToAssign}
                  className="h-10 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold rounded-lg cursor-pointer text-white flex items-center gap-1"
                >
                  <span>إسناد جماعي للفريق</span>
                </Button>

                <Button
                  onClick={handleBulkDeleteLeads}
                  disabled={isBulkActionActive}
                  variant="danger"
                  className="h-10 px-4 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>حذف جماعي</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Real-time Unassigned Telesales Leads Alerts */}
          {currentMainTab === "meetings" && unassignedTelesalesLeads.length > 0 && (
            <div className="bg-[#020617]/90 backdrop-blur-md border border-amber-500/25 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300 select-text relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-550/5 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                  </span>
                  <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5 font-sans">
                     مركز التنبيهات المباشرة: عملاء التيلي سيلز الجدد بانتظار الإسناد والتوزيع ({unassignedTelesalesLeads.length})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      playChime();
                      showFeedback("🔊 تم تنشيط واختبار نظام التنبيه الصوتي بنجاح!");
                    }}
                    className="h-8 px-3 text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>تجربة جرس التنبيه</span>
                    <span>🔊</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedTelesalesLeads.map((lead) => (
                  <div key={lead.id} className="bg-slate-950/60 border border-white/[0.03] p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-amber-500/15 transition-all relative">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                          👤 عميل غير موزع
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold font-mono">
                          بانتظار الإسناد
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-100 font-black">{lead.clientName}</p>
                        <p className="text-[11px] text-slate-400 font-mono tracking-wider">{lead.phone}</p>
                        {lead.field && (
                          <p className="text-[10px] text-slate-500 font-medium">مجال النشاط: <span className="text-slate-350">{lead.field}</span></p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/[0.02]">
                      <label className="text-[10px] font-bold text-slate-400 block">توزيع العميل وإسناده للسيلز:</label>
                      <select
                        className="w-full bg-[#020617]/90 border border-white/10 text-slate-100 rounded-lg px-2.5 py-2 text-[11px] font-bold focus:ring-[#38bdf8]/20 focus:outline-[#38bdf8] cursor-pointer hover:border-[#38bdf8]/35 transition-all font-sans"
                        value={lead.agentName || ""}
                        onChange={async (e) => {
                          const selectedName = e.target.value;
                          if (!selectedName) return;
                          const agentObj = availableAgents.find(a => a.name === selectedName);
                          try {
                            await updateLead(lead.id, {
                              agentName: selectedName,
                              agentId: agentObj?.id || ""
                            });
                            showFeedback(`✔ تم إسناد العميل "${lead.clientName}" بنجاح إلى ${selectedName}`);
                          } catch (err: any) {
                            console.error("Failed to assign agent from notification card:", err);
                            alert("حدث خطأ أثناء توزيع العميل: " + err.message);
                          }
                        }}
                      >
                        <option value="" className="bg-[#0f172a] text-slate-400">-- اختر السيلز مان للتعيين --</option>
                        {availableAgents.map((ag) => (
                          <option key={ag.id} value={ag.name} className="bg-[#0f172a] text-slate-100 font-bold">
                            {ag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leads CRM Table Card */}
          <Card glass className="overflow-hidden border-white/[0.05] shadow-2xl relative">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/40 text-slate-400 border-b border-white/[0.05]">
                    <th className="px-5 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={leads && leads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                        onChange={() => handleSelectAllLeads(filteredLeads)}
                        className="rounded bg-[#020617] border-white/10 text-sky-500 focus:ring-sky-500/20"
                      />
                    </th>
                    <th className="px-5 py-4 font-black">اسم العميل والمسؤول</th>
                    <th className="px-5 py-4 font-black">رقم الجوال الفعال</th>
                    <th className="px-5 py-4 font-black">المجال / قطاع النشاط</th>
                    <th className="px-5 py-4 font-black">سورس الداتا</th>
                    <th className="px-5 py-4 font-black">فريق المبيعات المباشر</th>
                    <th className="px-5 py-4 font-black">نوع الاستجابة</th>
                    <th className="px-5 py-4 font-black">حالة الاجتماع</th>
                    <th className="px-5 py-4 font-black">المتابعة القادمة</th>
                    <th className="px-5 py-4 font-black w-24 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-20 text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-[3px] border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
                          <p className="font-bold">جاري تحميل داتا العملاء وفلترتها...</p>
                        </div>
                      </td>
                    </tr>
                  ) : stableLeads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-20 text-slate-500 italic">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="text-slate-600" />
                          <p className="font-bold">لا يوجد ليدز عملاء مطابقة للخيارات المحددة.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedStableLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-5 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="rounded bg-[#020617] border-white/10 text-sky-500 focus:ring-sky-500/20"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-white text-[13px]">{lead.clientName}</div>
                          {lead.storeLink && (
                            <a href={lead.storeLink} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 mt-1 truncate max-w-[200px]">
                              <Globe size={11} />
                              <span>تصفح الموقع</span>
                              <ExternalLink size={9} />
                            </a>
                          )}
                          {lead.additionalStore && (
                            <a href={lead.additionalStore.startsWith("http") ? lead.additionalStore : `https://${lead.additionalStore}`} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1 truncate max-w-[200px]" title={lead.additionalStore}>
                              <Globe size={11} />
                              <span>الموقع الإضافي</span>
                              <ExternalLink size={9} />
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-200 tracking-wider text-[12px]">{lead.phone}</span>
                            <button
                              onClick={() => handleCopyText(lead.phone)}
                              className="text-slate-500 hover:text-white transition-all p-1 hover:bg-white/5 rounded"
                              title="نسخ رقم الجوال"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          {lead.additionalPhone && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-slate-400 tracking-wider text-[11px]" dir="ltr">{lead.additionalPhone}</span>
                              <button
                                onClick={() => handleCopyText(lead.additionalPhone)}
                                className="text-slate-600 hover:text-white transition-all p-1 hover:bg-white/5 rounded"
                                title="نسخ الهاتف الإضافي"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/10 rounded-xl px-2.5 py-1">
                            {lead.field || "غير محدد"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {lead.dataSource === "من التيلي سيلز (محول)" ? (
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">
                              <PhoneCall size={11} className="text-sky-400" />
                              <span>تيلي سيلز (محول)</span>
                            </span>
                          ) : (
                            <div className="text-[12px]">{lead.dataSource || "غير محدد"}</div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center">
                            <select
                              className="bg-[#020617]/80 border border-white/10 text-slate-100 rounded-xl px-2.5 py-1.5 text-[12px] font-bold focus:ring-[#38bdf8]/20 focus:outline-none focus:border-[#38bdf8] min-w-[150px] cursor-pointer shadow-sm shadow-black/40 hover:border-[#38bdf8]/30 transition-all font-sans"
                              value={lead.agentName || ""}
                              onChange={async (e) => {
                                const selectedName = e.target.value;
                                const agentObj = availableAgents.find(a => a.name === selectedName);
                                try {
                                  await updateLead(lead.id, {
                                    agentName: selectedName,
                                    agentId: agentObj?.id || ""
                                  });
                                } catch (err) {
                                  console.error("Failed to assign agent inline:", err);
                                }
                              }}
                            >
                              <option value="" className="bg-[#0f172a] text-slate-400">-- تحديد فريق المبيعات --</option>
                              {availableAgents.map((ag) => (
                                <option key={ag.id} value={ag.name} className="bg-[#0f172a] text-slate-100 font-bold">
                                  {ag.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-xl px-2.5 py-1 text-[10px] font-extrabold border",
                            lead.response === "مستعد للتعاقد" || lead.response === "تم تقديم عرض السعر"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-emerald-500/5 shadow-sm"
                              : lead.response === "مفاوضات جارية" || lead.response === "يطلب ميتنج فوري"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                                : lead.response === "مشغول حاليا"
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                  : "bg-slate-500/5 text-slate-400 border-white/[0.04]"
                          )}>
                            {lead.response || "لم يقرر بعد"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 w-fit">
                            <span className={cn(
                              "inline-flex items-center rounded-xl px-2.5 py-1 text-[10px] font-extrabold border justify-center",
                              lead.meetingStatus === "تم الاجتماع"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 whitespace-nowrap"
                                : lead.meetingStatus === "مجدول"
                                  ? "bg-sky-500/10 text-sky-300 border-sky-500/20 animate-pulse whitespace-nowrap"
                                  : lead.meetingStatus === "ملغي" || lead.meetingStatus === "لم يحضر"
                                    ? "bg-rose-500/10 text-rose-300 border-rose-500/20 whitespace-nowrap"
                                    : "bg-slate-500/5 text-slate-400 border-white/[0.04] whitespace-nowrap"
                            )}>
                              {lead.meetingStatus || "غير مجدول"}
                            </span>
                            {lead.meetingLink && (
                              <a 
                                href={lead.meetingLink.startsWith("http") ? lead.meetingLink : `https://${lead.meetingLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[9px] font-black px-2 py-0.5 rounded text-sky-400 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 inline-flex items-center justify-center gap-1 transition-colors duration-200 whitespace-nowrap"
                              >
                                <span>رابط الاجتماع 🔗</span>
                              </a>
                            )}
                            {lead.meetingTime && (
                              <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 inline-flex items-center justify-center gap-1 transition-colors duration-200 whitespace-nowrap">
                                <span>⏰ {lead.meetingTime.replace("T", " ")}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {lead.dateFollow ? (
                            <div className="flex items-center gap-1.5 text-slate-300 font-mono font-bold text-[11px]">
                              <Clock size={12} className="text-sky-400" />
                              <span>{lead.dateFollow}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => copyLeadAllDataToWhatsApp(lead)}
                              className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/5 transition-all p-1.5 rounded-lg border border-transparent hover:border-sky-500/10 cursor-pointer"
                              title="نسخ جميع بيانات العميل بشكل منظم للواتساب"
                            >
                              <Copy size={14} />
                            </button>
                            {(!!lead.telesalesLeadId || lead.dataSource === "من التيلي سيلز (محول)") ? (
                              <button
                                onClick={() => handleViewClick(lead)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all px-2.5 py-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 cursor-pointer shadow-sm shadow-emerald-500/5"
                                title="عرض بيانات العميل (صفحة الميتنج)"
                              >
                                <Eye size={12} className="animate-pulse" />
                                <span>عرض البيانات</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditClick(lead)}
                                className="text-slate-400 hover:text-white hover:bg-white/5 transition-all p-1.5 rounded-lg border border-transparent hover:border-white/[0.05] cursor-pointer"
                                title="تعديل بيانات العميل"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            {activeTab === "deleted" && (
                              <button
                                onClick={async () => {
                                  if (confirm(`هل تريد استعادة العميل "${lead.clientName}" ونقله لتبويب جهات الاتصال النشطة؟`)) {
                                    await restoreLead(lead.id);
                                    showFeedback("تم استعادة العميل بنجاح.");
                                  }
                                }}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5 transition-all p-1.5 rounded-lg border border-transparent hover:border-emerald-500/10"
                                title="استعادة العميل للنشطين"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteClick(lead.id, lead.clientName)}
                              className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all p-1.5 rounded-lg border border-transparent hover:border-rose-500/10"
                              title="حذف العميل"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* STABLE LEADS PAGINATION */}
            {stableLeads.length > 0 && (
              <div className="p-4 border-t border-white/[0.04] bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none" dir="rtl">
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
              </div>
            )}
          </Card>
        </div>
      )}

      {false && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Sidebar Customizer Menu */}
          <div className="space-y-4">
            <Card glass className="p-4 border-white/[0.05] flex flex-col gap-2 shadow-xl">
              <h3 className="font-extrabold text-white text-sm px-2 pb-2 border-b border-white/[0.05]">خيارات التخصيص</h3>
              <button
                onClick={() => setSettingsSubTab("dropdowns")}
                className={cn(
                  "w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between",
                  settingsSubTab === "dropdowns"
                    ? "bg-sky-500/10 text-sky-400 border-r-2 border-sky-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <span>خيارات القوائم المنسدلة (Dropdowns)</span>
                <Sliders size={14} />
              </button>
              <button
                onClick={() => setSettingsSubTab("fields")}
                className={cn(
                  "w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between",
                  settingsSubTab === "fields"
                    ? "bg-sky-500/10 text-sky-400 border-r-2 border-sky-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <span>تهيئة وبناء الحقول المخصصة (Custom Fields)</span>
                <Briefcase size={14} />
              </button>
            </Card>

            <Card glass className="p-5 border-white/[0.05] bg-sky-950/10 space-y-3 relative overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 text-sky-400">
                <Sparkles size={16} className="text-sky-400 animate-pulse" />
                <h4 className="font-black text-xs text-white uppercase">مزامنة التعديلات</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">بمجرد إجراء أي تعديل على القوائم أو الحقول باللوحة، يرجى حفظ وتحديث التعديلات لتعميمها على جميع أعضاء فريق المبيعات بالوكالة.</p>
              <Button
                onClick={handleSaveFormConfig}
                className="w-full h-11 text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                <span>حفظ التعديلات وتعميمها</span>
              </Button>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {settingsSubTab === "dropdowns" ? (
              <div className="space-y-6">
                {/* 1. Contact Types customizer */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <MessageSquare size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">خيارات نوع التواصل (Contact Method)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.contactTypes || DEFAULT_SALES_FORM.contactTypes)?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("contactTypes", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف خيار اتصال جديد (مثال: منصة لينكدان)" className="h-10 text-xs flex-1" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} />
                    <Button type="button" onClick={() => addOption("contactTypes", newContactType, setNewContactType)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 2. Response Options customizable */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-emerald-400">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <h4 className="font-black text-base text-white">خيارات نتائج التواصل والاستجابة (Response Outcomes)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.responseOptions || DEFAULT_SALES_FORM.responseOptions)?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("responseOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 p-0.5 ml-0.5 pointer-events-auto cursor-pointer" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف خيار رد جديد (مثال: تم إرسال العقد للتعميد)" className="h-10 text-xs flex-1" value={newResponseOption} onChange={(e) => setNewResponseOption(e.target.value)} />
                    <Button type="button" onClick={() => addOption("responseOptions", newResponseOption, setNewResponseOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 3. Meeting Status customizable */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <CalendarDays size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">خيارات حالة الاجتماع (Meeting Status Options)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.meetingStatuses || DEFAULT_SALES_FORM.meetingStatuses)?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("meetingStatuses", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف خيار اجتماع جديد (مثال: بانتظار التفويض)" className="h-10 text-xs flex-1" value={newMeetingStatus} onChange={(e) => setNewMeetingStatus(e.target.value)} />
                    <Button type="button" onClick={() => addOption("meetingStatuses", newMeetingStatus, setNewMeetingStatus)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 4. Data Sources customizer */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <FolderPlus size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">سورس الداتا (Data Sources)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.dataSources || DEFAULT_SALES_FORM.dataSources || [])?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("dataSources", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف مصدر داتا جديد (مثال: معرض مبيعات الرياض)" className="h-10 text-xs flex-1" value={newDataSource} onChange={(e) => setNewDataSource(e.target.value)} />
                    <Button type="button" onClick={() => addOption("dataSources", newDataSource, setNewDataSource)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 5. Field Options customizable */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-violet-400">
                    <Sliders size={18} className="text-violet-400" />
                    <h4 className="font-black text-base text-white">قطاعات ومجالات النشاط (Field Options)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.fieldsOptions || DEFAULT_SALES_FORM.fieldsOptions || [])?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("fieldsOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف قطاع نشاط جديد" className="h-10 text-xs flex-1" value={newFieldOption} onChange={(e) => setNewFieldOption(e.target.value)} />
                    <Button type="button" onClick={() => addOption("fieldsOptions", newFieldOption, setNewFieldOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 6. Business Types customizable */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <Sliders size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">أنواع البيزنس والشركات (Business Type Options)</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.businessTypesOptions || DEFAULT_SALES_FORM.businessTypesOptions || [])?.map((opt: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{opt}</span>
                        <button type="button" onClick={() => removeOption("businessTypesOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف الخيار">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="أضف نوع بيزنس جديد" className="h-10 text-xs flex-1" value={newBusinessTypeOption} onChange={(e) => setNewBusinessTypeOption(e.target.value)} />
                    <Button type="button" onClick={() => addOption("businessTypesOptions", newBusinessTypeOption, setNewBusinessTypeOption)} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف</Button>
                  </div>
                </Card>

                {/* 7. Sales Agents Management */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <Users size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">أعضاء فريق المبيعات المباشرة</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02]">
                    {(settings.salesAgents || [])?.map((ag: any) => (
                      <span key={ag.id} className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-xl px-3 py-1.5 transition-all hover:border-rose-500/30">
                        <span>{ag.name}</span>
                        <button type="button" onClick={() => handleDeleteSalesAgent(ag.id)} className="text-rose-400 hover:text-rose-300 font-extrabold text-xs shrink-0 cursor-pointer p-0.5 ml-0.5" title="حذف من الفريق">×</button>
                      </span>
                    ))}
                    {(!settings.salesAgents || settings.salesAgents.length === 0) && (
                      <p className="text-xs text-slate-500 p-2 italic">لا يوجد أعضاء في الفريق مسجلين حالياً</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input dark placeholder="اسم عضو فريق المبيعات الجديد (مثال: خالد المطيري)" className="h-10 text-xs flex-1" value={newSalesAgentName} onChange={(e) => setNewSalesAgentName(e.target.value)} />
                    <Button type="button" onClick={handleAddSalesAgent} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl font-bold">أضف</Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Custom Fields Constructor Tab */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl relative" dir="rtl">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <Plus size={18} className="text-sky-400" />
                    <h4 className="font-extrabold text-base text-white">إضافة حقل عملاء مخصص جديد (Constructor)</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400">كود الحقل (بالإنجليزي - إجباري)</label>
                      <Input dark placeholder="مثال: customer_budget" className="h-11 text-xs" value={customFieldKey} onChange={(e) => setCustomFieldKey(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400">اسم الحقل بالعربي (يظهر بالنموذج)</label>
                      <Input dark placeholder="مثال: ميزانية المتجر المقترحة" className="h-11 text-xs" value={customFieldLabel} onChange={(e) => setCustomFieldLabel(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400">نوع مدخل الحقل (Input Type)</label>
                      <Select dark value={customFieldType} onChange={(e) => setCustomFieldType(e.target.value as any)} className="h-11 text-xs">
                        <option value="text">نص عادي (Text)</option>
                        <option value="number">قيمة رقمية (Number)</option>
                        <option value="date">تاريخ (Date)</option>
                        <option value="textarea font-sans">نص طويل (Paragraph Text)</option>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400">القسم التابع له بالاستمارة</label>
                      <Select dark value={customFieldSection} onChange={(e) => setCustomFieldSection(e.target.value)} className="h-11 text-xs">
                        {(localFormConfig?.sections || []).map((sec: any) => (
                          <option key={sec.id} value={sec.id}>قسم: {sec.title}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="field_required_opt"
                      checked={customFieldRequired}
                      onChange={(e) => setCustomFieldRequired(e.target.checked)}
                      className="rounded bg-[#020617] border-white/10 text-sky-500 focus:ring-sky-500/20"
                    />
                    <label htmlFor="field_required_opt" className="text-xs font-black text-slate-300">جعل هذا الحقل إجبارياً على الفريق أثناء ملء البيانات.</label>
                  </div>

                  <div className="flex pt-2">
                    <Button onClick={handleAddCustomField} className="h-11 px-6 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl">أضف حقل مخصص للنموذج</Button>
                  </div>
                </Card>

                {/* Form Sections Customizer & Reordering */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
                    <div className="flex items-center gap-2 text-violet-400">
                      <FolderPlus size={18} />
                      <h4 className="font-extrabold text-base text-white">أقسام نموذج البيانات (Form Sections)</h4>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-950/25 p-4 rounded-xl border border-white/[0.02]">
                    {(localFormConfig?.sections || []).map((sec: any, index: number) => (
                      <div key={sec.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[#020617]/40 border border-white/[0.04]">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="font-bold text-xs text-sky-400">[{index + 1}]</span>
                          <Input
                            dark
                            value={sec.title}
                            onChange={(e) => handleSectionTitleChange(sec.id, e.target.value)}
                            className="h-9 text-xs flex-1 max-w-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(sec.id)}
                          className="text-rose-400 hover:text-rose-300 font-extrabold text-xs cursor-pointer p-1 rounded hover:bg-rose-500/10 transition-all"
                        >
                          إزالة القسم
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      dark
                      placeholder="عنوان القسم الجديد (مثال: تفاصيل الشحن والبودجيت)..."
                      className="h-10 text-xs flex-1"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                    />
                    <Button onClick={handleAddSection} className="h-10 px-5 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white cursor-pointer rounded-xl">أضف قسماً</Button>
                  </div>
                </Card>

                {/* Current Fields Layout and toggling */}
                <Card glass className="p-6 border-white/[0.05] space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3 text-sky-400">
                    <Sliders size={18} className="text-sky-400" />
                    <h4 className="font-black text-base text-white">ترتيب وتحكم حقول استمارة تفاصيل العميل</h4>
                  </div>

                  <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto pr-2">
                    {localFormConfig && Object.keys(localFormConfig.fieldsConfig).map((key) => {
                      const field = localFormConfig.fieldsConfig[key];
                      return (
                        <div key={key} className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white text-xs">{field.label}</span>
                              <span className="font-mono text-[9px] text-slate-500">({key})</span>
                              {field.isCustom && (
                                <span className="text-[8px] font-black bg-sky-500/10 text-sky-400 border border-sky-500/10 px-1.5 py-0.5 rounded-md">مخصص</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 font-semibold">تابع لقسم: {localFormConfig.sections?.find((s: any) => s.id === field.sectionId)?.title || "عناوين أساسية"}</p>
                          </div>

                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => handleToggleFieldVisibility(key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer",
                                field.visible
                                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/10 hover:bg-emerald-500/15"
                                  : "bg-slate-500/10 text-slate-400 border-white/[0.04] hover:bg-white/5"
                              )}
                            >
                              {field.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                              <span>{field.visible ? "مرئي" : "مخفي"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleFieldRequired(key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer",
                                field.required
                                  ? "bg-rose-500/10 text-rose-300 border-rose-500/10 hover:bg-rose-500/15"
                                  : "bg-slate-500/10 text-slate-400 border-white/[0.04] hover:bg-white/5"
                              )}
                            >
                              <span>{field.required ? "مطلوب" : "اختياري"}</span>
                            </button>

                            {field.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomField(key)}
                                className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/5 rounded transition-all"
                                title="حذف الحقل المخصص نهائياً"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer Mode: ADD SALES LEAD */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="تسجيل وإضافة عميل مبيعات جديد"
        size="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-6" dir="rtl">
          {formConfig.sections?.map((section: any) => {
            const fieldsInSec = Object.keys(formConfig.fieldsConfig).filter(
              (key) => formConfig.fieldsConfig[key].sectionId === section.id && formConfig.fieldsConfig[key].visible && key !== "response"
            );
            if (fieldsInSec.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                <h4 className="font-extrabold text-xs text-sky-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider">{section.title}</h4>
                <div className="grid grid-cols-1 gap-4">
                  {fieldsInSec.map((fieldKey) => {
                    const field = formConfig.fieldsConfig[fieldKey];
                    return (
                      <React.Fragment key={fieldKey}>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500 font-bold">*</span>}
                          </label>
                          {renderFieldInput(fieldKey, field)}
                        </div>

                        {fieldKey === "meetingStatus" && ["مجدول", "تم الاجتماع", "بانتظار العميل", "مؤجل", "تم تحديد ميتنج"].includes(formData.meetingStatus) && (
                          <div className="space-y-3 bg-sky-500/5 border border-sky-500/20 p-4 rounded-xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                                  رابط الاجتماع المجدول (Meeting Link)
                                </label>
                                <Input
                                  dark
                                  type="url"
                                  placeholder="أدخل رابط ميتنج مخصص..."
                                  className="text-xs h-11"
                                  value={formData.meetingLink || ""}
                                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                                  تاريخ ووقت الميتنج (Meeting Date & Time)
                                </label>
                                <Input
                                  dark
                                  type="datetime-local"
                                  className="text-xs h-11"
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

                        {fieldKey === "meetingStatus" && formData.meetingStatus && !["تم الاجتماع", "ناجح", "تم بنجاح"].includes(formData.meetingStatus) && (
                          <div className="space-y-2 bg-amber-500/5 border border-amber-500/25 p-4 rounded-xl text-right animate-in fade-in duration-200">
                            <label className="text-[11px] font-bold text-amber-400 block font-sans">
                              📝 ملاحظات وتفاصيل حالة الاجتماع (سترسل للتيلي سيلز للمتابعة) *
                            </label>
                            <textarea
                              required
                              className="w-full h-20 rounded-xl border border-white/[0.1] bg-[#0c1322] text-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-sans"
                              placeholder="اكتب هنا تفاصيل وملاحظات هذه الحالة لتصل تلقائياً لموظفة التيلي سيلز لمتابعتها."
                              value={formData.meetingStatusNote || ""}
                              onChange={(e) => setFormData({ ...formData, meetingStatusNote: e.target.value })}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {renderContractSection()}

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button type="submit" className="flex-1 h-12 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl">حفظ وإضافة العميل الجديد 💾</Button>
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)} className="h-12 px-6 text-xs font-bold rounded-xl text-slate-400">إلغاء</Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer Mode: EDIT SALES LEAD */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setSelectedLead(null); }}
        title="تحديث وتعديل بيانات عميل المبيعات"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-6" dir="rtl">
          {formConfig.sections?.map((section: any) => {
            const fieldsInSec = Object.keys(formConfig.fieldsConfig).filter(
              (key) => formConfig.fieldsConfig[key].sectionId === section.id && formConfig.fieldsConfig[key].visible && key !== "response"
            );
            if (fieldsInSec.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                <h4 className="font-extrabold text-xs text-sky-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider">{section.title}</h4>
                <div className="grid grid-cols-1 gap-4">
                  {fieldsInSec.map((fieldKey) => {
                    const field = formConfig.fieldsConfig[fieldKey];
                    return (
                      <React.Fragment key={fieldKey}>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500 font-bold">*</span>}
                          </label>
                          {renderFieldInput(fieldKey, field)}
                        </div>

                        {fieldKey === "meetingStatus" && ["مجدول", "تم الاجتماع", "بانتظار العميل", "مؤجل", "تم تحديد ميتنج"].includes(formData.meetingStatus) && (
                          <div className="space-y-3 bg-sky-500/5 border border-sky-500/20 p-4 rounded-xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                                  رابط الاجتماع المجدول (Meeting Link)
                                </label>
                                <Input
                                  dark
                                  type="url"
                                  placeholder="أدخل رابط ميتنج مخصص..."
                                  className="text-xs h-11"
                                  value={formData.meetingLink || ""}
                                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                                  تاريخ ووقت الميتنج (Meeting Date & Time)
                                </label>
                                <Input
                                  dark
                                  type="datetime-local"
                                  className="text-xs h-11"
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

                        {fieldKey === "meetingStatus" && formData.meetingStatus && !["تم الاجتماع", "ناجح", "تم بنجاح"].includes(formData.meetingStatus) && (
                          <div className="space-y-2 bg-amber-500/5 border border-amber-500/25 p-4 rounded-xl text-right animate-in fade-in duration-200">
                            <label className="text-[11px] font-bold text-amber-400 block font-sans">
                              📝 ملاحظات وتفاصيل حالة الاجتماع (سترسل للتيلي سيلز للمتابعة) *
                            </label>
                            <textarea
                              required
                              className="w-full h-20 rounded-xl border border-white/[0.1] bg-[#0c1322] text-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-sans"
                              placeholder="اكتب هنا تفاصيل وملاحظات هذه الحالة لتصل تلقائياً لموظفة التيلي سيلز لمتابعتها."
                              value={formData.meetingStatusNote || ""}
                              onChange={(e) => setFormData({ ...formData, meetingStatusNote: e.target.value })}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {renderContractSection()}

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button type="submit" className="flex-1 h-12 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl">تحديث وحفظ التغييرات 💾</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsEditOpen(false); setSelectedLead(null); }} className="h-12 px-6 text-xs font-bold rounded-xl text-slate-400">إلغاء</Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer Mode: VIEW SALES LEAD */}
      <Drawer
        isOpen={isViewOpen}
        onClose={() => { setIsViewOpen(false); setSelectedLead(null); }}
        title="تفاصيل بيانات عميل صفحة الميتنج 👁️ (عرض فقط)"
        size="lg"
      >
        <div className="space-y-6 text-right font-sans" dir="rtl">
          {/* Header Action: Quick WhatsApp Copy */}
          {selectedLead && (
            <div className="bg-sky-500/10 border border-sky-400/20 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="text-right">
                <p className="text-sm font-black text-white">{selectedLead.clientName}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">معرف العميل الكوني: {selectedLead.id || "--"}</p>
              </div>
              <button
                onClick={() => copyLeadAllDataToWhatsApp(selectedLead)}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-md transition-all duration-200 animate-pulse"
              >
                <Copy size={13} />
                <span>نسخ جميع التفاصيل للواتساب ✅</span>
              </button>
            </div>
          )}

          {/* Render Sections and Fields */}
          {selectedLead && formConfig.sections?.map((section: any) => {
            const fieldsInSec = Object.keys(formConfig.fieldsConfig).filter(
              (key) => formConfig.fieldsConfig[key].sectionId === section.id && formConfig.fieldsConfig[key].visible && key !== "response"
            );
            if (fieldsInSec.length === 0) return null;

            return (
              <div key={section.id} className="bg-slate-900/30 p-5 rounded-2xl border border-white/[0.04] space-y-4 shadow-sm">
                <h4 className="font-extrabold text-xs text-sky-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                  {section.title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fieldsInSec.map((fieldKey) => {
                    const field = formConfig.fieldsConfig[fieldKey];
                    // Dynamic values lookup from selectedLead
                    const val = (selectedLead as any)[fieldKey];
                    const displayVal = val !== undefined && val !== null && val !== "" ? String(val) : "غير محدد";

                    return (
                      <div key={fieldKey} className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5 hover:border-white/[0.07] transition-all">
                        <span className="text-[10px] font-bold text-slate-400 block">{field.label}</span>
                        <span className="text-xs font-bold text-slate-100 block break-words">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Telesales Origin details */}
          {selectedLead && (!!selectedLead.telesalesLeadId || selectedLead.dataSource === "من التيلي سيلز (محول)") && (() => {
            let teleAgentName = selectedLead.telesalesAgentName || "";
            if (!teleAgentName) {
              const noteStr = selectedLead.note || "";
              const match1 = noteStr.match(/\[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي:\s*([^\]\n]+)\]/);
              if (match1) {
                teleAgentName = match1[1].trim();
              } else {
                const match2 = noteStr.match(/\[تم التحويل من تلي سيلز - موظف\s*([^\]\n]+)\]/);
                if (match2) teleAgentName = match2[1].trim();
              }
            }

            return (
              <div className="bg-amber-500/5 border border-amber-400/20 p-5 rounded-2xl space-y-4 shadow-sm text-right" dir="rtl">
                <h4 className="font-extrabold text-xs text-amber-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  تفاصيل الإحالة من قسم التيلي سيلز
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-300 block">موظف التيلي سيلز (الوكيل)</span>
                    <span className="text-xs font-bold text-slate-200">{teleAgentName || "غير محدد / بمستوى الإدارة"}</span>
                  </div>
                  <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-300 block">مصدر الإحالة والمزامنة</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">تيلي سيلز نشط (محول تلقائياً) 🚀</span>
                  </div>
                </div>

                {/* Telesales Brief */}
                {selectedLead.telesalesBrief && (
                  <div className="bg-slate-950/40 border border-white/[0.03] p-4 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-300 block">📝 بريف وخلاصة التيلي سيلز (Telesales Brief)</span>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans font-medium">{selectedLead.telesalesBrief}</p>
                  </div>
                )}

                {/* Telesales Follow-up updates list */}
                {(() => {
                  const updatesList = [];
                  for (let i = 1; i <= 4; i++) {
                     const fNotes = selectedLead[`followupNotes_${i}`];
                     const fDate = selectedLead[`followupMeetingDate_${i}`];
                     const fFull = selectedLead[`followUp${i}`] || fNotes || fDate;
                     
                     if (fFull) {
                       updatesList.push({
                         index: i,
                         notes: fNotes || "",
                         date: fDate || "",
                         full: fFull
                       });
                     }
                  }

                  if (updatesList.length === 0) return null;

                  return (
                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] font-bold text-amber-300 block">📞 سجل المتابعات والتحديثات من التيلي سيلز:</span>
                      <div className="space-y-2">
                        {updatesList.map((up) => (
                          <div key={up.index} className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-extrabold text-amber-400">تحديث المتابعة #{up.index}</span>
                              {up.date && (
                                <span className="text-slate-300 font-mono bg-amber-500/20 px-2 py-0.5 rounded">
                                  📅 موعد ميتنج: {up.date.replace("T", " ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans font-medium">{up.notes || up.full}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Meeting specific details */}
          {selectedLead && (
            <div className="bg-fuchsia-500/5 border border-fuchsia-400/20 p-5 rounded-2xl space-y-4 shadow-sm">
              <h4 className="font-extrabold text-xs text-fuchsia-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse"></span>
                تفاصيل ميعاد الاجتماع والمتابعة
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-fuchsia-300 block">رابط الاجتماع (Meeting Link)</span>
                  {selectedLead.meetingLink ? (
                    <a
                      href={selectedLead.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-sky-400 hover:underline break-all inline-flex items-center gap-1.5"
                    >
                      <span>تصفح ودخول الاجتماع 🔗</span>
                    </a>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">لا يوجد رابط مضاف للاجتماع</span>
                  )}
                </div>

                <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-fuchsia-300 block">توقيت الاجتماع المجدول</span>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {selectedLead.meetingTime ? selectedLead.meetingTime.replace("T", " ") : "لم يحدد بعد"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contract details */}
          {selectedLead && (
            <div className="bg-emerald-500/5 border border-emerald-400/20 p-5 rounded-2xl space-y-4 shadow-sm">
              <h4 className="font-extrabold text-xs text-emerald-400 border-b border-white/[0.05] pb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                البيانات المالية والتعاقدات
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 block">قيمة التعاقد الكلية</span>
                  <span className="text-xs font-bold text-slate-200">{selectedLead.contractAmount !== undefined ? `${selectedLead.contractAmount} ر.س` : "0 ر.س"}</span>
                </div>
                <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-400 block">المبلغ المدفوع</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{selectedLead.paidAmount !== undefined ? `${selectedLead.paidAmount} ر.س` : "0 ر.س"}</span>
                </div>
                <div className="bg-slate-950/40 border border-white/[0.03] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-rose-400 block">المبلغ المتبقي</span>
                  <span className="text-xs font-bold text-rose-400 font-mono">{selectedLead.remainingAmount !== undefined ? `${selectedLead.remainingAmount} ر.س` : "0 ر.س"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsViewOpen(false); setSelectedLead(null); }}
              className="w-full h-12 text-xs font-bold rounded-xl text-slate-300 hover:text-white bg-slate-800"
            >
              إغلاق النافذة ❌
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Custom Confirmation Modal */}
      <Modal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        title={confirmModalState.title}
      >
        <div className="space-y-6 text-right font-sans" dir="rtl">
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