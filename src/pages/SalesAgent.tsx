import React, { useState, useMemo, useEffect } from "react";
import { db } from "@/src/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { 
  TrendingUp,
  Calendar,
  User,
  Briefcase,
  Plus,
  Search,
  Edit3,
  Copy,
  Check,
  MessageSquare,
  ListFilter,
  Users,
  CheckCircle2,
  FileText,
  BadgeAlert,
  Save,
  Clock,
  ExternalLink,
  ShieldCheck,
  Target,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Info,
  Sparkles,
  Sliders,
  X,
  Trash2,
  Eye,
  PhoneCall,
  RefreshCw,
  Store
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card, Input, Select, Button, Drawer, Modal } from "@/src/components/UI";
import { useSettings, DEFAULT_SALES_FORM } from "@/src/hooks/useSettings";
import { useSalesLeads } from "@/src/hooks/useSalesLeads";
import { useUserRole } from "@/src/hooks/useUserRole";
import { useAuth } from "@/src/context/AuthContext";
import { SalesLead } from "@/src/types";
import { cn } from "@/src/lib/utils";

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

const cleanTelesalesPrefix = (text: string): string => {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/\[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي:[^\]\n]+\]/g, "");
  cleaned = cleaned.replace(/\[تم التحويل من تلي سيلز - موظف[^\]\n]+\]/g, "");
  return cleaned.trim();
};

// Builds the unified, sequentially-numbered comment list for a lead, used by
// the "بيانات العملاء" table's dynamic Comments column. Backward compatible:
// existing legacy fixed fields (salesComment/comment02/comment03/comment04/
// comment05 — i.e. the old "Comment 1..5" inputs) are read first, in that
// order, as the oldest comments; any newer comments added through the new
// single dynamic input are stored in the lead's "comments" array (already
// just an additional field on the existing sales_leads document — no new
// collection/structure) and appended after them, continuing the same
// sequential numbering. Nothing is migrated or overwritten in Firestore —
// this is a pure read-time merge, so legacy fields stay exactly as they are.
type LeadCommentEntry = { number: number; text: string; date?: string; agentName?: string };

const getLeadCommentsList = (lead: any): LeadCommentEntry[] => {
  const list: LeadCommentEntry[] = [];

  const legacyFields = [lead?.salesComment, lead?.comment02, lead?.comment03, lead?.comment04, lead?.comment05];
  legacyFields.forEach((val) => {
    const text = typeof val === "string" ? val.trim() : "";
    if (text) {
      list.push({ number: list.length + 1, text });
    }
  });

  const dynamicComments = Array.isArray(lead?.comments) ? lead.comments : [];
  dynamicComments.forEach((c: any) => {
    const text = typeof c === "string" ? c.trim() : typeof c?.text === "string" ? c.text.trim() : "";
    if (text) {
      list.push({ number: list.length + 1, text, date: c?.date, agentName: c?.agentName });
    }
  });

  return list;
};

export const SalesAgentPage: React.FC = () => {
  const { leads, loading: leadsLoading, addLead, updateLead, deleteLead } = useSalesLeads();
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const { memberInfo, isAdmin, allowedPages } = useUserRole();
  // Anyone who manages the sales department (admin, or a member whose
  // allowedPages includes "sales_hub") sees the full customer set in their
  // Workspace too, not just leads personally assigned to their own name.
  const canManageSalesDept = isAdmin || allowedPages.includes("sales_hub");

  // Same Sales-employee list/data source used by the "Sales Employee"
  // dropdown in Sales Department Management (SalesHub.tsx availableAgents)
  // — reused as-is so the Sales Manager filter here stays consistent with
  // that page and with the existing assignment data (no new/hardcoded list).
  const availableSalesAgents = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addedNames = new Set<string>();

    if (settings.teamSettings) {
      const depts = ["adsTeam", "seoTeam", "contentTeam", "designTeam", "editorTeam"];
      depts.forEach((dept) => {
        const team = (settings.teamSettings as any)[dept];
        if (Array.isArray(team)) {
          team.forEach((member: any) => {
            if (member.name && !addedNames.has(member.name.trim())) {
              list.push({ id: member.uid || member.id || `team_${member.name}`, name: member.name.trim() });
              addedNames.add(member.name.trim());
            }
          });
        }
      });
    }

    if (settings.salesAgents) {
      settings.salesAgents.forEach((a: any) => {
        if (a.name && !addedNames.has(a.name.trim())) {
          list.push({ id: a.id || `sa_${a.name}`, name: a.name.trim() });
          addedNames.add(a.name.trim());
        }
      });
    }

    if (Array.isArray(leads)) {
      leads.forEach((l) => {
        if (l.agentName && !addedNames.has(l.agentName.trim())) {
          list.push({ id: l.agentId || `lead_${l.agentName}`, name: l.agentName.trim() });
          addedNames.add(l.agentName.trim());
        }
      });
    }

    return list;
  }, [settings.salesAgents, settings.teamSettings, leads]);

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

    // Repair any missing sectionId or custom field section
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

  // Dynamic list of available Sales Agents resolved across database structure & registered users
  const availableAgents = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addedNames = new Set<string>();

    if (settings?.salesAgents) {
      settings.salesAgents.forEach((a: any) => {
        if (a.name && !addedNames.has(a.name.trim())) {
          list.push({ id: a.id || `sa_${a.name}`, name: a.name.trim() });
          addedNames.add(a.name.trim());
        }
      });
    }

    if (settings?.teamSettings) {
      const depts = ["adsTeam", "seoTeam", "contentTeam", "designTeam", "editorTeam"];
      depts.forEach((dept) => {
        const team = (settings.teamSettings as any)[dept];
        if (Array.isArray(team)) {
          team.forEach((member: any) => {
            if (member.name && !addedNames.has(member.name.trim())) {
              list.push({ id: member.id || `team_${member.name}`, name: member.name.trim() });
              addedNames.add(member.name.trim());
            }
          });
        }
      });
    }

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
  }, [settings?.salesAgents, settings?.teamSettings, leads]);

  // Selected agent identity
  const [currentAgentName, setCurrentAgentName] = useState<string>("");
  
  // Real-time live notifications and acknowledgement states for assigned leads
  const [acknowledgedLeads, setAcknowledgedLeads] = useState<string[]>(() => {
    try {
      const persisted = localStorage.getItem("acknowledged_leads_sales");
      return persisted ? JSON.parse(persisted) : [];
    } catch {
      return [];
    }
  });

  // Listen to storage and custom event for in-tab updates from the global header NotificationCenter
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const persisted = localStorage.getItem("acknowledged_leads_sales");
        if (persisted) {
          setAcknowledgedLeads(JSON.parse(persisted));
        }
      } catch (err) {
        console.error("Error syncing acknowledged leads:", err);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("acknowledgedLeadsUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("acknowledgedLeadsUpdated", handleStorageChange);
    };
  }, []);

  const [knownSalesLeadIds, setKnownSalesLeadIds] = useState<string[]>([]);
  const [initialLeadsLoaded, setInitialLeadsLoaded] = useState(false);

  // Play modern chime utilizing Web Audio API Synthesizer
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      // Tone 1: C5 (523Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Tone 2: G5 (784Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(783.99, now + 0.1);
      gain2.gain.setValueAtTime(0, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);

      // Tone 3: C6 (1046Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.setValueAtTime(1046.50, now + 0.2);
      gain3.gain.setValueAtTime(0, now + 0.2);
      gain3.gain.linearRampToValueAtTime(0.12, now + 0.25);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.7);
    } catch (err) {
      console.warn("Could not play notification sound:", err);
    }
  };

  const acknowledgeSingleLead = (leadId: string) => {
    if (!leadId) return;
    setAcknowledgedLeads((prev) => {
      const updated = Array.from(new Set([...prev, leadId]));
      try {
        localStorage.setItem("acknowledged_leads_sales", JSON.stringify(updated));
      } catch (err) {
        console.error("Error writing acknowledged leads in localStorage:", err);
      }
      return updated;
    });
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter criteria states & View controls
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMeetingStatusFilter, setSelectedMeetingStatusFilter] = useState("");
  const [selectedResponseFilter, setSelectedResponseFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "pending" | "won">("all");

  // Page level tabs: "analytics" (Overview analyses) and "meetings" (distributed telesales meetings + clients spreadsheet combined)
  const [workspaceTab, setWorkspaceTab] = useState<"analytics" | "clients" | "meetings">("meetings");
  const [meetingsSubTab, setMeetingsSubTab] = useState<"schedule" | "spreadsheet">("schedule");
  const [clientSubTab, setClientSubTab] = useState<"followup" | "spreadsheet">("spreadsheet");

  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Client registry form states with active auto-save draft lookup to prevent accidental context loss
  const [regClientName, setRegClientName] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regClientName || "" : "";
    } catch { return ""; }
  });
  const [regPhone, setRegPhone] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regPhone || "" : "";
    } catch { return ""; }
  });
  const [regLeadStatus, setRegLeadStatus] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regLeadStatus || "HOT" : "HOT";
    } catch { return "HOT"; }
  });
  const [regDecisionMaker, setRegDecisionMaker] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regDecisionMaker || "YES" : "YES";
    } catch { return "YES"; }
  });
  const [regField, setRegField] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regField || "" : "";
    } catch { return ""; }
  });
  const [regPackage, setRegPackage] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regPackage || "" : "";
    } catch { return ""; }
  });
  const [regAmount, setRegAmount] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regAmount || "" : "";
    } catch { return ""; }
  });
  const [regSalesComment, setRegSalesComment] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regSalesComment || "" : "";
    } catch { return ""; }
  });
  const [regComment02, setRegComment02] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regComment02 || "" : "";
    } catch { return ""; }
  });
  const [regComment03, setRegComment03] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regComment03 || "" : "";
    } catch { return ""; }
  });
  const [regDateFollow, setRegDateFollow] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regDateFollow || "" : "";
    } catch { return ""; }
  });
  const [regInvoiceContract, setRegInvoiceContract] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regInvoiceContract || "" : "";
    } catch { return ""; }
  });
  const [regPaid, setRegPaid] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regPaid || "NO" : "NO";
    } catch { return "NO"; }
  });
  const [regDatePay, setRegDatePay] = useState(() => {
    try {
      const d = localStorage.getItem("sales_agent_add_client_draft");
      return d ? JSON.parse(d).regDatePay || "" : "";
    } catch { return ""; }
  });

  // Automatically sync state into draft storage
  useEffect(() => {
    const draft = {
      regClientName, regPhone, regLeadStatus, regDecisionMaker, regField, regPackage,
      regAmount, regSalesComment, regComment02, regComment03, regDateFollow,
      regInvoiceContract, regPaid, regDatePay
    };
    localStorage.setItem("sales_agent_add_client_draft", JSON.stringify(draft));
  }, [
    regClientName, regPhone, regLeadStatus, regDecisionMaker, regField, regPackage,
    regAmount, regSalesComment, regComment02, regComment03, regDateFollow,
    regInvoiceContract, regPaid, regDatePay
  ]);

  // Search and filter states inside Customer Data Directory
  const [regSearchSearchTerm, setRegSearchSearchTerm] = useState("");
  const [regFilterLeadStatus, setRegFilterLeadStatus] = useState("");
  const [regFilterDecisionMaker, setRegFilterDecisionMaker] = useState("");
  const [regFilterPackage, setRegFilterPackage] = useState("");
  const [regFilterPaid, setRegFilterPaid] = useState("");
  const [regFilterMeetingStatus, setRegFilterMeetingStatus] = useState("");
  const [regFilterDateFollow, setRegFilterDateFollow] = useState("");

  // Sales-Manager-only: filter "بيانات العملاء" down to one Sales employee,
  // reusing the exact same employee list/data source as the employee
  // dropdown in Sales Department Management (SalesHub.tsx availableAgents).
  // Empty string = "All Sales Employees" (default), matching existing
  // manager visibility rules already in place — no new/hardcoded roster.
  const [selectedSalesAgentFilter, setSelectedSalesAgentFilter] = useState("");

  // Mandatory pagination for "بيانات العملاء" — 20 per page, active
  // regardless of whether any filter is applied.
  const REG_LEADS_PAGE_SIZE = 20;
  const [regLeadsPage, setRegLeadsPage] = useState(1);

  // Search and filter states inside Meetings Directory
  const [meetingSearchTerm, setMeetingSearchTerm] = useState("");
  const [meetingStatusFilter, setMeetingStatusFilter] = useState("");

  const [savingState, setSavingState] = useState<{ [leadId: string]: boolean }>({});

  // Draft text for the single dynamic "إضافة تعليق" input in the
  // "بيانات العملاء" table's Comments column, keyed by lead id (one draft
  // per row, since the table renders one row per lead).
  const [newTableCommentDraft, setNewTableCommentDraft] = useState<{ [leadId: string]: string }>({});

  // Comment editing state
  const [editingComment, setEditingComment] = useState<{ leadId: string; index: number; text: string } | null>(null);

  // Form Drawer states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDetailsLead, setSelectedDetailsLead] = useState<SalesLead | null>(null);
  const [detailsTab, setDetailsTab] = useState<"telesales" | "sales">("telesales");
  
  // Custom states inside form update
  const [formData, setFormData] = useState<any>({});
  const [newUpdateText, setNewUpdateText] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showFullOriginalNote, setShowFullOriginalNote] = useState(false);
  const [editDrawerTab, setEditDrawerTab] = useState<"telesales" | "sales">("telesales");

  // Determine authorized name dynamically
  const realAuthName = useMemo(() => {
    return memberInfo?.name || user?.displayName || user?.email?.split("@")[0] || "";
  }, [memberInfo, user]);

  const isMasterEmail = useMemo(() => {
    return user?.email?.toLowerCase().trim() === "abdelrahmanahmed011147@gmail.com" || isAdmin;
  }, [user, isAdmin]);

  // Load/Save persistent Identity for Sales Agent
  useEffect(() => {
    const overridden = localStorage.getItem("sales_agent_identity_override");
    if (isMasterEmail && overridden) {
      setCurrentAgentName(overridden);
    } else if (realAuthName) {
      setCurrentAgentName(realAuthName);
    }
  }, [realAuthName, isMasterEmail]);

  // Check if there are any records, and seed an elegant demo sales lead if empty
  useEffect(() => {
    if (leadsLoading || leads.length > 0) return;

    const seedDemoSalesLead = async () => {
      try {
        const demoPayload = {
          clientName: "ديمو سيلز - مؤسسة العوازل الرقمية",
          phone: "966501112233",
          leadStatus: "HOT",
          decisionMaker: "YES",
          field: "حلول تقنية رائدة وبناء العلامة التجارة برمجياً 🌐",
          package: "الباقة الفضية",
          amount: 8500,
          contractAmount: 8500,
          note: "تم إنشاؤه وتغذيته تلقائياً كعميل ديمو لمطابقة الأنظمة ومراجعة سير تدفّق البيانات وصلاحية الحفظ.",
          salesComment: "تم إنشاؤه وتغذيته تلقائياً كعميل ديمو لمطابقة الأنظمة ومراجعة سير تدفّق البيانات وصلاحية الحفظ.",
          comment02: "متابعة أولية ترحيبية بالعميل بنجاح واهتمام لافت بالباقات المقدمة.",
          comment03: "",
          dateFollow: getLocalDateString(),
          invoiceContract: "https://madaragency.com/demo-invoice-preview",
          paid: "YES",
          datePay: getLocalDateString(),
          agentName: "سجل تجريبي آلي",
          meetingStatus: "تم جدولتها",
          response: "مستعد للتعاقد",
          isContracted: true,
          paidAmount: 8500,
          remainingAmount: 0,
          dataSource: "من المبيعات (تجريبي)",
          businessType: "شركات / وثيقة عمل حر",
          date: getLocalDateString(),
          updates: [{
            text: "تم إنشاء وترحيل السجل التجريبي آلياً للتأكيد.",
            date: new Date().toISOString(),
            agentName: "سيرفر السيلز"
          }]
        };
        await addLead(demoPayload as any);
        console.log("Auto-seeded demo lead successfully due to empty database");
      } catch (err) {
        console.warn("Auto-seeding demo lead omitted or failed:", err);
      }
    };

    seedDemoSalesLead();
  }, [leads, leadsLoading]);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const showErrorFeedback = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
    }, 6000);
  };

  const agentLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.isSystemDeleted === true) return false;
      if (canManageSalesDept) return true;
      const isAssigned = lead.agentName?.trim().toLowerCase() === currentAgentName?.trim().toLowerCase();
      return isAssigned;
    });
  }, [leads, currentAgentName, canManageSalesDept]);

  // Fetch todays local ISO Date
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filtered Leads by Tab & Search filter
  const filteredLeads = useMemo(() => {
    let result = agentLeads;

    // Search term matching
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(lead => 
        lead.clientName?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        lead.field?.toLowerCase().includes(term) ||
        lead.dataSource?.toLowerCase().includes(term) ||
        lead.storeLink?.toLowerCase().includes(term)
      );
    }

    // Meeting status filter
    if (selectedMeetingStatusFilter) {
      result = result.filter(lead => lead.meetingStatus === selectedMeetingStatusFilter);
    }

    // Response Filter
    if (selectedResponseFilter) {
      result = result.filter(lead => lead.response === selectedResponseFilter);
    }

    // Tabs filter
    const todayStr = getLocalDateString();
    if (activeTab === "today") {
      result = result.filter(lead => {
        // Scheduled meeting for today or follow up scheduled for today
        const meetToday = lead.meetingTime?.split("T")[0] === todayStr || lead.meetingTime === todayStr;
        const followToday = lead.dateFollow === todayStr;
        return (meetToday || followToday) && !lead.isContracted;
      });
    } else if (activeTab === "pending") {
      result = result.filter(lead => !lead.isContracted && lead.meetingStatus !== "ملغي");
    } else if (activeTab === "won") {
      result = result.filter(lead => lead.isContracted === true || lead.paymentStatus === "تم التعاقد");
    }

    return result;
  }, [agentLeads, searchTerm, selectedMeetingStatusFilter, selectedResponseFilter, activeTab]);

  // Combined client directory filters memo (Customer Data tab)
  const regFilteredLeads = useMemo(() => {
    return agentLeads.filter(lead => {
      // 0. Sales-Manager employee filter ("All Sales Employees" when empty)
      if (canManageSalesDept && selectedSalesAgentFilter) {
        if (lead.agentName?.trim().toLowerCase() !== selectedSalesAgentFilter.trim().toLowerCase()) {
          return false;
        }
      }
      // 1. search term (matching clientName / phone / email / company)
      if (regSearchSearchTerm.trim()) {
        const term = regSearchSearchTerm.toLowerCase().trim();
        const mName = lead.clientName?.toLowerCase().includes(term);
        const mPhone = lead.phone?.toLowerCase().includes(term);
        const mEmail = lead.email?.toLowerCase().includes(term);
        const mCompany = lead.companyName?.toLowerCase().includes(term);
        const mField = lead.field?.toLowerCase().includes(term);
        if (!mName && !mPhone && !mEmail && !mCompany && !mField) return false;
      }
      // 2. Lead Status filter
      if (regFilterLeadStatus && lead.leadStatus !== regFilterLeadStatus) {
        return false;
      }
      // 3. Decision Maker filter
      if (regFilterDecisionMaker && lead.decisionMaker !== regFilterDecisionMaker) {
        return false;
      }
      // 4. Package filter
      if (regFilterPackage && lead.package !== regFilterPackage) {
        return false;
      }
      // 5. PAID filter
      if (regFilterPaid && lead.paid !== regFilterPaid) {
        return false;
      }
      // 6. Meeting Status filter
      if (regFilterMeetingStatus && lead.meetingStatus !== regFilterMeetingStatus) {
        return false;
      }
      // 7. Date Follow filter
      if (regFilterDateFollow && lead.dateFollow !== regFilterDateFollow) {
        return false;
      }
      return true;
    });
  }, [agentLeads, canManageSalesDept, selectedSalesAgentFilter, regSearchSearchTerm, regFilterLeadStatus, regFilterDecisionMaker, regFilterPackage, regFilterPaid, regFilterMeetingStatus, regFilterDateFollow]);

  // Reset "بيانات العملاء" pagination to page 1 whenever any of its filters
  // change (employee, search, status, decision maker, package, paid, meeting status, date).
  useEffect(() => {
    setRegLeadsPage(1);
  }, [selectedSalesAgentFilter, regSearchSearchTerm, regFilterLeadStatus, regFilterDecisionMaker, regFilterPackage, regFilterPaid, regFilterMeetingStatus, regFilterDateFollow]);

  // Mandatory pagination — 20 leads per page, active even with no filters
  // applied. Client-side: the full leads set is already loaded in memory
  // via the existing onSnapshot listener (useSalesLeads / DataContext), so
  // slicing here is a cheap, stable operation with no new Firestore reads
  // or listeners — server-side/cursor pagination would require
  // restructuring that real-time listener architecture, which isn't
  // needed at this data scale and risks the existing visibility fix.
  const totalRegLeadsPages = Math.max(1, Math.ceil(regFilteredLeads.length / REG_LEADS_PAGE_SIZE));
  const activeRegLeadsPage = Math.min(regLeadsPage, totalRegLeadsPages);
  const paginatedRegFilteredLeads = useMemo(() => {
    const startIndex = (activeRegLeadsPage - 1) * REG_LEADS_PAGE_SIZE;
    return regFilteredLeads.slice(startIndex, startIndex + REG_LEADS_PAGE_SIZE);
  }, [regFilteredLeads, activeRegLeadsPage]);

  // Meetings distributed by the Sales Manager: they must originate from telesales (represented by dataSource or telesalesLeadId)
  const meetingLeads = useMemo(() => {
    return agentLeads.filter(
      (lead) => !!lead.telesalesLeadId || lead.dataSource === "من التيلي سيلز (محول)"
    );
  }, [agentLeads]);

  const unacknowledgedLeads = useMemo(() => {
    return agentLeads.filter((l) => l.id && !acknowledgedLeads.includes(l.id));
  }, [agentLeads, acknowledgedLeads]);

  const unacknowledgedMeetingLeads = useMemo(() => {
    return unacknowledgedLeads.filter(
      (lead) => !!lead.telesalesLeadId || lead.dataSource === "من التيلي سيلز (محول)"
    );
  }, [unacknowledgedLeads]);

  const unacknowledgedGeneralLeads = useMemo(() => {
    return unacknowledgedLeads.filter(
      (lead) => !lead.telesalesLeadId && lead.dataSource !== "من التيلي سيلز (محول)"
    );
  }, [unacknowledgedLeads]);

  // Real-time voice and visual notifications when a new lead is assigned to this agent
  useEffect(() => {
    if (leadsLoading || !agentLeads || agentLeads.length === 0 || !currentAgentName) return;

    const currentLeadIds = agentLeads.map((l) => l.id).filter(Boolean) as string[];

    if (!initialLeadsLoaded) {
      setKnownSalesLeadIds(currentLeadIds);
      setInitialLeadsLoaded(true);
      return;
    }

    const newLeadIds = currentLeadIds.filter((id) => !knownSalesLeadIds.includes(id));

    if (newLeadIds.length > 0) {
      playChime();
      newLeadIds.forEach((id) => {
        const lead = agentLeads.find((l) => l.id === id);
        if (lead && lead.clientName) {
          showFeedback(`🔔 عميل جديد تم إسناده إليك الآن: ${lead.clientName}`);
        }
      });
      setKnownSalesLeadIds(currentLeadIds);
    }
  }, [agentLeads, leadsLoading, initialLeadsLoaded, knownSalesLeadIds, currentAgentName]);

  // Combined meeting filters memo (Meetings Tab)
  const filteredMeetingLeads = useMemo(() => {
    return meetingLeads.filter((lead) => {
      // 1. Search filter
      if (meetingSearchTerm.trim()) {
        const term = meetingSearchTerm.toLowerCase().trim();
        const mName = lead.clientName?.toLowerCase().includes(term);
        const mPhone = lead.phone?.toLowerCase().includes(term);
        const mField = lead.field?.toLowerCase().includes(term);
        const mTelesales = lead.telesalesAgentName?.toLowerCase().includes(term);
        if (!mName && !mPhone && !mField && !mTelesales) return false;
      }
      // 2. Status filter
      if (meetingStatusFilter && lead.meetingStatus !== meetingStatusFilter) {
        return false;
      }
      return true;
    });
  }, [meetingLeads, meetingSearchTerm, meetingStatusFilter]);

  // Reset all filters
  const resetAllFilters = () => {
    setSelectedSalesAgentFilter("");
    setRegFilterLeadStatus("");
    setRegFilterDecisionMaker("");
    setRegFilterPackage("");
    setRegFilterPaid("");
    setRegFilterMeetingStatus("");
    setRegSearchSearchTerm("");
    setRegFilterDateFollow("");
    setRegLeadsPage(1);
    showFeedback("🧹 تم مسح جميع الفلاتر بنجاح!");
  };

  // Client Registry form submission handler (New lead creation)
  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regClientName.trim()) {
      showErrorFeedback("الطلب إجباري: يرجى كتابة اسم العميل.");
      return;
    }
    if (!regPhone.trim()) {
      showErrorFeedback("الطلب إجباري: يرجى كتابة رقم جوال العميل.");
      return;
    }

    // Standardize phone pattern
    let cleanPhone = regPhone.replace(/\D/g, "");
    
    // Replace leading 00966 with 966
    if (cleanPhone.startsWith("00966")) {
      cleanPhone = "966" + cleanPhone.substring(5);
    }
    
    // Convert leading 05 to 9665
    if (cleanPhone.startsWith("05")) {
      cleanPhone = "9665" + cleanPhone.substring(2);
    }
    
    // Convert leading 5 which has length 9 to 9665
    if (cleanPhone.startsWith("5") && cleanPhone.length === 9) {
      cleanPhone = "9665" + cleanPhone.substring(1);
    }

    // Direct generic fixes for 9-digit starting with 5 or 10-digit starting with 05
    if (cleanPhone.length === 9 && cleanPhone.startsWith("5")) {
      cleanPhone = "966" + cleanPhone;
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith("05")) {
      cleanPhone = "9665" + cleanPhone.slice(2);
    }

    // If it still doesn't start with 966, let's prefix with 966 if it's general
    if (!cleanPhone.startsWith("966") && cleanPhone.length >= 9) {
      cleanPhone = "966" + cleanPhone;
    }

    if (!cleanPhone.startsWith("966") || cleanPhone.length !== 12) {
      showErrorFeedback("رقم الجوال السعودي غير صالح. يجب أن يتكون من 12 رقماً ويبدأ بـ 966 (مثال: 9665xxxxxxxx)");
      return;
    }

    try {
      const payload: any = {
        clientName: regClientName.trim(),
        phone: cleanPhone,
        leadStatus: regLeadStatus || "HOT",
        decisionMaker: regDecisionMaker || "YES",
        field: regField.trim() || "غير محدد",
        package: regPackage || "الباقة الفضية",
        amount: Number(regAmount || 0),
        contractAmount: Number(regAmount || 0),
        note: regSalesComment.trim(), // align with existing note model
        salesComment: regSalesComment.trim(),
        comment02: regComment02.trim(),
        comment03: regComment03.trim(),
        dateFollow: regDateFollow || getLocalDateString(),
        invoiceContract: regInvoiceContract.trim(),
        paid: regPaid || "NO",
        datePay: regDatePay || "",
        agentName: currentAgentName || "مسؤول مبيعات",
        meetingStatus: "لم يجدول",
        response: regPaid === "YES" ? "مستعد للتعاقد" : "مفاوضات جارية",
        isContracted: regPaid === "YES",
        paidAmount: regPaid === "YES" ? Number(regAmount || 0) : 0,
        remainingAmount: regPaid === "YES" ? 0 : Number(regAmount || 0),
        dataSource: "من المبيعات (مباشر)",
        businessType: "أفراد / بدون وثيقة",
        date: getLocalDateString(),
        updates: regSalesComment.trim() ? [{
          text: `المكالمة الأولى: ${regSalesComment.trim()}`,
          date: new Date().toISOString(),
          agentName: currentAgentName || "مسؤول مبيعات"
        }] : []
      };

      await addLead(payload);

      // Reset form states
      setRegClientName("");
      setRegPhone("");
      setRegLeadStatus("HOT");
      setRegDecisionMaker("YES");
      setRegField("");
      setRegPackage("");
      setRegAmount("");
      setRegSalesComment("");
      setRegComment02("");
      setRegComment03("");
      setRegDateFollow("");
      setRegInvoiceContract("");
      setRegPaid("NO");
      setRegDatePay("");

      localStorage.removeItem("sales_agent_add_client_draft");

      setIsAddClientOpen(false);

      showFeedback("تم حفظ وإضافة العميل الجديد بنجاح في السحابة!");
    } catch (err: any) {
      console.error("Add client error:", err);
      showErrorFeedback("حدث خطأ أثناء رصد العميل الجديد: " + err.message);
    }
  };

  // Populate form with realistic demo client data to facilitate seamless verification by the user
  const handleFillDemoData = () => {
    setRegClientName("شركة مدار الرقمية لتقنية المعلومات (عميل تجريبي)");
    setRegPhone("0554433221");
    setRegLeadStatus("HOT");
    setRegDecisionMaker("YES");
    setRegField("التصميم الإبداعي والهوية الرقمية");
    setRegPackage("الباقة الذهبية");
    setRegAmount("15000");
    setRegSalesComment("العميل مهتم بالتسويق وحملات السوشيال ميديا مع باقة متكاملة لإدارة المحتوى.");
    setRegComment02("تم تسليم مقترح العمل الأولي والتسعير بنجاح للموافقة.");
    setRegComment03("");
    setRegDateFollow(getLocalDateString());
    setRegInvoiceContract("https://madaragency.com/demo-invoice-preview");
    setRegPaid("YES");
    setRegDatePay(getLocalDateString());
    showFeedback("تم تعبئة حقول العميل التجريبي بنجاح! يمكنك الآن النقر على زر 'حفظ وإضافة العميل الجديد' لاختبار الإرسال ومزامنته بالسحابة. 🧪✨");
  };

  // Real-time cell alteration auto-save listener
  const handleAutoSaveField = async (leadId: string, fieldName: string, value: any) => {
    setSavingState(prev => ({ ...prev, [leadId]: true }));
    try {
      const payload: any = { [fieldName]: value };

      // Multi-column dependency triggers
      if (fieldName === "paid") {
        if (value === "YES") {
          payload.isContracted = true;
          payload.paymentStatus = "تم التعاقد";
          payload.response = "مستعد للتعاقد";
          // set paid Amount equal to the lead's entire registered amount
          const matchedLead = leads.find(l => l.id === leadId);
          if (matchedLead) {
            const amt = Number(matchedLead.amount || matchedLead.contractAmount || 0);
            payload.paidAmount = amt;
            payload.remainingAmount = 0;
          }
        } else {
          payload.isContracted = false;
          payload.paymentStatus = "غير مدفوع";
          payload.response = "مفاوضات جارية";
          payload.paidAmount = 0;
          const matchedLead = leads.find(l => l.id === leadId);
          if (matchedLead) {
            payload.remainingAmount = Number(matchedLead.amount || matchedLead.contractAmount || 0);
          }
        }
      } else if (fieldName === "amount") {
        const amt = Number(value || 0);
        payload.amount = amt;
        payload.contractAmount = amt;
        const matchedLead = leads.find(l => l.id === leadId);
        if (matchedLead) {
          if (matchedLead.paid === "YES") {
            payload.paidAmount = amt;
            payload.remainingAmount = 0;
          } else {
            payload.paidAmount = 0;
            payload.remainingAmount = amt;
          }
        }
      }

      await updateDoc(doc(db, "sales_leads", leadId), payload);
      showFeedback("تم الحفظ التلقائي بنجاح! ✔️");
    } catch (err: any) {
      console.error("Auto save error:", err);
    } finally {
      setSavingState(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Adds one new dynamically-numbered comment to a lead's "comments" array
  // (appended, so order is preserved oldest → newest, matching the existing
  // legacy Comment 1/2/3.. fields it continues numbering after). This is the
  // single-input "Enter to add" flow for the بيانات العملاء table's Comments
  // column — it does not touch or overwrite the legacy salesComment/
  // comment02/comment03/comment04/comment05 fields.
  const handleAddTableComment = async (leadId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSavingState(prev => ({ ...prev, [leadId]: true }));
    try {
      const matchedLead = leads.find(l => l.id === leadId);
      const existingComments = Array.isArray((matchedLead as any)?.comments) ? [...(matchedLead as any).comments] : [];
      existingComments.push({
        text: trimmed,
        date: new Date().toISOString(),
        agentName: currentAgentName
      });

      await updateDoc(doc(db, "sales_leads", leadId), { comments: existingComments });
      setNewTableCommentDraft(prev => ({ ...prev, [leadId]: "" }));
      showFeedback("تم إضافة التعليق بنجاح! ✔️");
    } catch (err: any) {
      console.error("Add comment error:", err);
      showErrorFeedback("تعذر إضافة التعليق، يرجى المحاولة مجدداً.");
    } finally {
      setSavingState(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Edit an existing comment in a lead's "comments" array
  // Edit an existing comment in a lead's "comments" array
  const handleEditComment = async (leadId: string, commentIndex: number, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    setSavingState(prev => ({ ...prev, [leadId]: true }));
    try {
      const matchedLead = leads.find(l => l.id === leadId);
      if (!matchedLead) {
        showErrorFeedback("لم يتم العثور على العميل.");
        return;
      }

      // Determine if we are editing a legacy field or a dynamic comment in the array
      const legacyFieldKeys = ['salesComment', 'comment02', 'comment03', 'comment04', 'comment05'];
      const legacyFieldMap: { index: number; key: string }[] = [];
      legacyFieldKeys.forEach(key => {
        if (typeof (matchedLead as any)[key] === 'string' && (matchedLead as any)[key].trim()) {
          legacyFieldMap.push({ index: legacyFieldMap.length + 1, key });
        }
      });

      const legacyTarget = legacyFieldMap.find(m => m.index === commentIndex);

      if (legacyTarget) {
        // It's a legacy field. Update it directly.
        await updateDoc(doc(db, "sales_leads", leadId), { [legacyTarget.key]: trimmed });
      } else {
        // It's a dynamic comment in the 'comments' array.
        const existingComments = Array.isArray((matchedLead as any)?.comments) ? [...(matchedLead as any).comments] : [];
        const legacyCount = legacyFieldMap.length;
        
        let dynamicIndex = -1;
        let currentDisplayIndex = legacyCount;
        for (let i = 0; i < existingComments.length; i++) {
          const comment = existingComments[i];
          const text = typeof comment === "string" ? comment.trim() : typeof comment?.text === "string" ? comment.text.trim() : "";
          if (text) {
            currentDisplayIndex++;
            if (currentDisplayIndex === commentIndex) {
              dynamicIndex = i;
              break;
            }
          }
        }

        if (dynamicIndex === -1) {
          showErrorFeedback("تعذر تحديد موقع التعليق للتعديل في السجل الديناميكي.");
          return;
        }

        const updatedComments = [...existingComments];
        const commentToUpdate = updatedComments[dynamicIndex];
        if (typeof commentToUpdate === "string") {
          updatedComments[dynamicIndex] = trimmed;
        } else if (typeof commentToUpdate === "object" && commentToUpdate !== null) {
          updatedComments[dynamicIndex] = {
            ...commentToUpdate,
            text: trimmed,
            date: new Date().toISOString(),
            agentName: currentAgentName
          };
        } else {
          showErrorFeedback("تنسيق التعليق غير صالح للتعديل.");
          return;
        }

        await updateDoc(doc(db, "sales_leads", leadId), { comments: updatedComments });
      }

      setEditingComment(null);
      showFeedback("تم تعديل التعليق بنجاح! ✔️");
    } catch (err: any) {
      console.error("Edit comment error:", err);
      showErrorFeedback("تعذر تعديل التعليق، يرجى المحاولة مجدداً.");
    } finally {
      setSavingState(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Analytics tab date-filtered leads
  const analyticsFilteredLeads = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const getDaysAgoDateStr = (days: number) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - days);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dy = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dy}`;
    };

    return agentLeads.filter((lead) => {
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
  }, [agentLeads, timeFilter, startDate, endDate]);

  // KPI calculations derived safely
  const kpis = useMemo(() => {
    const assigned = analyticsFilteredLeads.length;
    
    // اجمالي التواصل: has firstContactDate or contactType or any response
    const totalContacts = analyticsFilteredLeads.filter(
      l => l.firstContactDate || l.contactType || (l.response && l.response !== "لم يحدد" && l.response !== "لم يتحدد بعد")
    ).length;
    
    // اجمالي الميتنج: standard scheduled or completed meetings
    const meetingsCount = analyticsFilteredLeads.filter(
      l => l.meetingStatus && 
           l.meetingStatus !== "لا يوجد ميتنج" && 
           l.meetingStatus !== "غير حدد" && 
           l.meetingStatus !== "بلا ميتنج" && 
           l.meetingStatus !== "لم يحدد" && 
           l.meetingStatus !== "غير محدد"
    ).length;

    // اجمالي الميتنج الناجح
    const successfulMeetings = analyticsFilteredLeads.filter(
      l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "تحت المتابعة" || l.meetingStatus === "تم الاجتماع" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح"
    ).length;
    
    const wonLeads = analyticsFilteredLeads.filter(l => l.isContracted === true || l.paymentStatus === "تم التعاقد" || l.response === "مستعد للتعاقد");
    const wonCount = wonLeads.length;
    
    const revenue = analyticsFilteredLeads.reduce((acc, lead) => acc + Number(lead.paidAmount || 0), 0);
    const totalContractValue = wonLeads.reduce((acc, lead) => acc + Number(lead.contractAmount || 0), 0);
    const totalRemainingAmount = analyticsFilteredLeads.reduce((acc, lead) => acc + Number(lead.remainingAmount || 0), 0);
    
    const conversionRate = assigned > 0 ? Math.round((wonCount / assigned) * 100) : 0;
    const contactRate = assigned > 0 ? Math.round((totalContacts / assigned) * 100) : 0;
    const meetingRate = totalContacts > 0 ? Math.round((meetingsCount / totalContacts) * 100) : 0;
    const successMeetingRate = meetingsCount > 0 ? Math.round((successfulMeetings / meetingsCount) * 100) : 0;

    // إجمالي عروض الأسعار: leads where response is related to quote OR has an amount > 0
    const quoteLeads = analyticsFilteredLeads.filter(l => {
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

    const totalContractsCount = wonCount;
    
    return {
      assigned,
      totalContacts,
      contactRate,
      meetingsCount,
      meetingRate,
      successfulMeetings,
      successMeetingRate,
      wonCount,
      revenue,
      totalContractValue,
      totalRemainingAmount,
      conversionRate,
      totalQuotesCount,
      totalQuotesValue,
      totalContractsCount
    };
  }, [analyticsFilteredLeads]);

  // أكثر المجالات تعاقدًا
  const contractedSectorsData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    const contractedLeads = analyticsFilteredLeads.filter(
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
  }, [analyticsFilteredLeads]);

  // Pie chart data for Lead Responses
  const chartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    analyticsFilteredLeads.forEach(lead => {
      const resp = lead.response || "لم يتحدد بعد";
      counts[resp] = (counts[resp] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analyticsFilteredLeads]);

  // Form input change handlers
  const handlePhoneChange = (val: string) => {
    // Basic numerals cleanup
    const cleanPhone = val.replace(/[^0-9]/g, "");
    setFormData((prev: any) => ({ ...prev, phone: cleanPhone }));

    if (cleanPhone.length > 0 && !cleanPhone.startsWith("966")) {
      setPhoneError("رقم الجوال يجب أن يبدأ بـ 966 متبوعاً بـ 9 أرقام.");
    } else if (cleanPhone.length > 0 && cleanPhone.length !== 12) {
      setPhoneError("رقم الجوال الكلي يجب أن يتكون من 12 رقماً (مثال: 9665xxxxxxxx).");
    } else {
      setPhoneError(null);
    }
  };

  const handleCopyPhone = (phone: string, id: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateWhatsAppLink = (phone: string, message: string = "") => {
    if (!phone) return "#";
    const cleaned = phone.replace(/[^0-9]/g, "");
    const textEncoded = encodeURIComponent(message);
    return `https://wa.me/${cleaned}${textEncoded ? `?text=${textEncoded}` : ""}`;
  };

  const handleNotifyTelesales = async () => {
    const leadId = selectedLead?.id;
    const telesalesLeadId = formData.telesalesLeadId || selectedLead?.telesalesLeadId;
    if (!leadId) return;
    if (!telesalesLeadId) {
      showErrorFeedback("عذراً، هذا العميل لم يتم تحويله من طرف فريق التيلي سيلز ولا يوجد معرف مربوط به.");
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
      showErrorFeedback("حدث خطأ أثناء إبلاغ موظف التيلي سيلز: " + err.message);
    }
  };

  const handleEditClick = (lead: SalesLead) => {
    setSelectedLead(lead);
    setEditDrawerTab("telesales");
    
    // Automatically acknowledge the lead if edited
    if (lead.id && !acknowledgedLeads.includes(lead.id)) {
      acknowledgeSingleLead(lead.id);
    }
    
    // Build values safe dictionary
    const initialForm: any = {};
    Object.keys(formConfig.fieldsConfig).forEach(key => {
      initialForm[key] = lead[key] !== undefined ? lead[key] : "";
    });

    initialForm.id = lead.id;
    initialForm.isContracted = lead.isContracted || false;
    initialForm.contractAmount = lead.contractAmount || 0;
    initialForm.paidAmount = lead.paidAmount || 0;
    initialForm.meetingLink = lead.meetingLink || "";
    initialForm.meetingTime = lead.meetingTime || "";
    initialForm.meetingStatusNote = lead.meetingStatusNote || "";
    initialForm.telesalesNotified = lead.telesalesNotified || false;
    initialForm.telesalesAgentName = lead.telesalesAgentName || "";
    initialForm.telesalesLeadId = lead.telesalesLeadId || "";
    initialForm.updates = Array.isArray(lead.updates) ? [...lead.updates] : [];

    // Explicitly load comments 1-5
    initialForm.salesComment = lead.salesComment || "";
    initialForm.comment02 = lead.comment02 || "";
    initialForm.comment03 = lead.comment03 || "";
    initialForm.comment04 = lead.comment04 || "";
    initialForm.comment05 = lead.comment05 || "";

    setFormData(initialForm);
    setNewUpdateText("");
    setPhoneError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (phoneError) {
      showErrorFeedback("يرجى تصحيح الأخطاء أولاً (رقم الهاتف غير صالح).");
      return;
    }

    try {
      let savedUpdates = Array.isArray(formData.updates) ? [...formData.updates] : [];
      if (newUpdateText.trim()) {
        savedUpdates.unshift({
          text: newUpdateText.trim(),
          date: new Date().toISOString(),
          agentName: currentAgentName
        });
      }

      // Sync remaining calculation directly
      const contractAmt = Number(formData.contractAmount || 0);
      const paidAmt = Number(formData.paidAmount || 0);
      const isContracted = formData.isContracted || false;

      const updatedPayload: any = {
        ...formData,
        updates: savedUpdates,
        isContracted: isContracted,
        contractAmount: isContracted ? contractAmt : 0,
        paidAmount: isContracted ? paidAmt : 0,
        remainingAmount: isContracted ? Math.max(0, contractAmt - paidAmt) : 0,
        agentName: currentAgentName,
        salesComment: formData.salesComment || "",
        comment02: formData.comment02 || "",
        comment03: formData.comment03 || "",
        comment04: formData.comment04 || "",
        comment05: formData.comment05 || ""
      };

      // Set backend triggers based on payment statuses
      if (isContracted) {
        updatedPayload.paymentStatus = "تم التعاقد";
        updatedPayload.meetingStatus = "تم الاجتماع";
      }

      await updateLead(selectedLead.id, updatedPayload);
      
      // If there is an associated telesales lead, notify them about meeting or contract!
      const telesalesLeadId = updatedPayload.telesalesLeadId || selectedLead?.telesalesLeadId;
      if (telesalesLeadId) {
        try {
          const telesalesRef = doc(db, "telesales_leads", telesalesLeadId);
          const telesalesUpdates: any = {};

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
              text: `تم عقد الاجتماع (الميتنج) مع عميلك (${formData.clientName}) بنجاح بواسطة السيلز مان (${currentAgentName}) 🎉.`,
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
                text: `تم عقد الاجتماع (الميتنج) مع عميلك (${formData.clientName}) بنجاح بواسطة السيلز مان (${currentAgentName}) 🎉.${noteSuffix}`,
                date: new Date().toISOString(),
                read: false,
                type: "meeting_done"
              };
            } else {
              // Any other status modification (cancelled, postponed, rescheduled, scheduled, etc.)
              telesalesUpdates.salesNotification = {
                text: `تحديث من السيلز (${currentAgentName}) لحالة ميتنج عميلك (${formData.clientName}) إلى [${updatedPayload.meetingStatus}] ⏳.${noteSuffix}`,
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
          console.error("Error updating telesales lead from sales agent save:", ex);
        }
      }
      
      setIsEditOpen(false);
      showFeedback("تم حفظ وتحديث بيانات العميل بنجاح! ✔📈");
    } catch (err: any) {
      console.error("Error updating lead status:", err);
      showErrorFeedback("حدث خطأ أثناء الحفظ: " + err.message);
    }
  };

  // Field renderer inside form drawer
  const renderFieldInput = (key: string, field: any) => {
    // Under VERSION_121: clientName, phone, field, dataSource, storeLink, businessType, date, note are locked
    const isFieldLocked = !!formData.id && [
      "clientName", "phone", "field", "dataSource", "storeLink", "businessType", "date", "note", "agentName"
    ].includes(key);

    const renderDateInputWithHelper = (valueKey: string, isRequired: boolean) => {
      const isLocked = isFieldLocked;
      return (
        <div className="flex gap-2 items-center">
          <Input
            dark
            type="date"
            required={isRequired}
            disabled={isLocked}
            value={formData[valueKey] || ""}
            onChange={(e) => setFormData({ ...formData, [valueKey]: e.target.value })}
            className={cn("flex-1 text-xs", isLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : "")}
          />
          {!isLocked && (
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, [valueKey]: getLocalDateString() });
              }}
              className="h-10 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/15 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] text-shadow-sky font-sans"
              title="تعيين تاريخ اليوم"
            >
              اليوم
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
        <Input
          dark
          disabled
          readOnly
          value={formData.agentName || currentAgentName || ""}
          className="opacity-60 bg-slate-900 cursor-not-allowed border-white/5 font-bold"
        />
      );
    }

    if (key === "field") {
      return (
        <Select
          dark
          required={field.required}
          disabled={isFieldLocked}
          value={formData.field || ""}
          onChange={(e) => setFormData({ ...formData, field: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
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
          disabled={isFieldLocked}
          value={formData.businessType || ""}
          onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
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
          disabled={isFieldLocked}
          value={formData.dataSource || ""}
          onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
        >
          <option value="">اختر مصدر الداتا...</option>
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
          disabled={isFieldLocked}
          value={formData.contactType || ""}
          onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
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
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
        >
          <option value="">اختر الاستجابة والرد...</option>
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
          className={isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : ""}
        >
          <option value="">اختر حالة الاجتماع...</option>
          {formConfig.meetingStatuses?.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    if (key === "note" || key === "telesalesBrief" || key === "whatsappMessageText") {
      const isReadOnlyField = key === "telesalesBrief" || key === "whatsappMessageText";
      return (
        <textarea
          required={isReadOnlyField ? false : field.required}
          disabled={isReadOnlyField ? true : isFieldLocked}
          readOnly={isReadOnlyField}
          className={cn(
            "w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans",
            (isReadOnlyField || isFieldLocked) ? "opacity-70 bg-[#070b13] cursor-not-allowed border-white/5 text-slate-400 font-medium" : ""
          )}
          placeholder={
            key === "note" ? "أي ملاحظات إضافية تخص العميل..." :
            key === "telesalesBrief" ? "لا يوجد بريف مسجل حالياً..." : "لا يوجد سكريبت مسجل حالياً..."
          }
          value={formData[key] || ""}
          onChange={(e) => {
            if (!isReadOnlyField) {
              setFormData({ ...formData, [key]: e.target.value });
            }
          }}
        />
      );
    }

    if (key === "phone") {
      return (
        <div>
          <Input
            dark
            type="text"
            required={field.required}
            disabled={true}
            placeholder="مثال: 9665xxxxxxxx..."
            value={formData.phone || ""}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="opacity-60 bg-slate-900 cursor-not-allowed border-white/5 font-mono"
          />
          {phoneError && (
            <p className="text-[10px] text-red-500 font-bold font-sans mt-1 animate-pulse">
              {phoneError}
            </p>
          )}
        </div>
      );
    }

    // Default regular input field
    return (
      <Input
        dark
        type={field.type || "text"}
        required={field.required}
        disabled={isFieldLocked}
        placeholder={
          key === "clientName" ? "اسم العميل الكامل..." :
          key === "storeLink" ? "رابط المتجر الإلكتروني / الموقع..." : "أدخل القيمة..."
        }
        value={formData[key] || ""}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className={cn("text-xs font-sans", isFieldLocked ? "opacity-60 bg-slate-900 cursor-not-allowed border-white/5" : "")}
      />
    );
  };

  const renderContractSection = () => {
    return (
      <div className="bg-gradient-to-r from-indigo-500/10 to-sky-500/10 border border-indigo-500/20 p-5 rounded-2xl space-y-4">
        <h4 className="font-extrabold text-sm text-indigo-400 flex items-center gap-1.5 border-b border-indigo-500/10 pb-2">
          <span>تفاصيل التعاقد والإغلاق والتحصيل المالي</span>
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
                meetingStatus: check ? "تم الاجتماع" : formData.meetingStatus,
                response: check ? "مستعد للتعاقد" : formData.response
              });
            }}
          />
          <label htmlFor="isContracted" className="text-xs font-black text-indigo-300 cursor-pointer select-none">
            تم التعاقد وتوقيع الشراكة مع هذا العميل بنجاح ✔🤝
          </label>
        </div>

        {formData.isContracted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300">مبلغ التعاقد الكلي (ر.س)</label>
              <Input
                dark
                type="number"
                placeholder="قيمة الصفقة الإجمالية"
                value={formData.contractAmount || ""}
                onChange={(e) => {
                  const amount = Number(e.target.value);
                  setFormData({
                    ...formData,
                    contractAmount: amount
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
                placeholder="الدفعة الأولى"
                value={formData.paidAmount || ""}
                onChange={(e) => {
                  const paid = Number(e.target.value);
                  setFormData({
                    ...formData,
                    paidAmount: paid
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
                className="w-full text-xs font-mono font-bold bg-[#0f172a]/80 text-rose-300 opacity-90 border-white/5"
              />
            </div>
          </div>
        )}

        {/* Inform Telesales agent of their conversion directly */}
        {formData.isContracted && (formData.telesalesLeadId || selectedLead?.telesalesLeadId) && (
          <div className="pt-3 border-t border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[10px] text-slate-400 font-semibold leading-normal max-w-sm">
              هذا العميل محول من قسم التيلي سيلز. يرجى الضغط للإشعار المباشر كي يتمكن السيستم من احتساب مساهمة زميلك في اللوحة الخاصة به.
            </p>
            
            {formData.telesalesNotified ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/15 shrink-0">
                <CheckCircle2 size={14} />
                <span>تم إرسال الإشعار والتأكيد ✔</span>
              </span>
            ) : (
              <Button
                type="button"
                onClick={handleNotifyTelesales}
                className="h-10 px-5 text-[11px] font-black bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 shrink-0 cursor-pointer"
              >
                📢 ابلاغ التيلي سيلز المحول بالتحصيل
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (leadsLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sky-450 font-bold animate-pulse">
        جاري تهيئة مساحة عمل المبيعات النشطة...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Upper Floating Header Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <Target size={18} />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">مساحة عمل فريق المبيعات (Sales Reps)</h2>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-2">
            المساعد الذكي لمتابعة الصفقات، تحديث الميتنج ومخرجات التواصل، وإتمام التعاقدات.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Identity indicator / selector */}
          <div className="bg-slate-900/65 border border-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl flex items-center gap-2.5 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-right flex flex-col">
              <span className="block text-[9px] text-slate-400 font-extrabold select-none">ملف الموظف النشط:</span>
              {isMasterEmail ? (
                <select
                  className="bg-transparent border-none text-xs font-black text-[#00AEEF] p-0 pr-6 focus:ring-0 focus:outline-none cursor-pointer font-sans text-right"
                  value={currentAgentName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentAgentName(val);
                    localStorage.setItem("sales_agent_identity_override", val);
                    showFeedback(`👤 تم تغيير هوية وكيل المبيعات النشط إلى: ${val}`);
                  }}
                >
                  {realAuthName && (
                    <option value={realAuthName} className="bg-[#0f172a] text-white">
                      {realAuthName} (التلقائي)
                    </option>
                  )}
                  {availableAgents
                    .filter((ag) => ag.name !== realAuthName)
                    .map((ag) => (
                      <option key={ag.id} value={ag.name} className="bg-[#0f172a] text-white">
                        {ag.name}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-xs font-black text-[#00AEEF] font-sans selection:bg-transparent">
                  {realAuthName} (التلقائي)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page Level Tab Swapper: Analytics Dashboard, Customer Data, and Telesales Meeting Reception */}
      <div className="flex bg-[#0b0f24]/80 p-1.5 rounded-2xl border border-white/[0.05] gap-2 max-w-3xl select-none">
        <button
          onClick={() => setWorkspaceTab("analytics")}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
            workspaceTab === "analytics"
              ? "bg-[#00AEEF]/20 text-white border border-[#00AEEF]/30 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <TrendingUp size={14} />
          <span>لوحة التحليلات</span>
        </button>

        <button
          onClick={() => {
            setWorkspaceTab("clients");
          }}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 relative",
            workspaceTab === "clients"
              ? "bg-[#00AEEF]/20 text-white border border-[#00AEEF]/30 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Users size={14} className={cn(unacknowledgedGeneralLeads.length > 0 ? "text-amber-450 animate-bounce shrink-0" : "shrink-0")} />
          <span>بيانات العملاء</span>
          {unacknowledgedGeneralLeads.length > 0 ? (
            <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow-lg border border-slate-950 animate-pulse flex items-center gap-0.5">
              <span>{unacknowledgedGeneralLeads.length}</span>
              <span className="text-[8px]">جديد</span>
            </span>
          ) : agentLeads.length > 0 ? (
            <span className="bg-[#00AEEF]/20 text-[#00AEEF] border border-[#00AEEF]/30 font-extrabold text-[10px] px-1.5 py-0.5 rounded-md text-right">
              {agentLeads.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => {
            setWorkspaceTab("meetings");
          }}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 relative",
            workspaceTab === "meetings"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Calendar size={14} className={cn(unacknowledgedMeetingLeads.length > 0 ? "text-amber-400 animate-bounce shrink-0" : "shrink-0")} />
          <span>استقبال ميتينج التيلي</span>
          {unacknowledgedMeetingLeads.length > 0 ? (
            <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow-lg border border-slate-950 animate-pulse flex items-center gap-0.5">
              <span>{unacknowledgedMeetingLeads.length}</span>
              <span className="text-[8px]">جديد</span>
            </span>
          ) : meetingLeads.length > 0 ? (
            <span className="absolute top-1.5 left-1.5 bg-[#fbbf24] text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
              {meetingLeads.length}
            </span>
          ) : null}
        </button>
      </div>

      {workspaceTab === "analytics" && (
        <div className="space-y-10 animate-in fade-in duration-300">
          
          {/* Header of Analytics & Time Period Filter */}
          <div className="relative overflow-hidden p-6 rounded-3xl border border-white/[0.08] bg-slate-950/20 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] group transition-all duration-500 hover:border-white/[0.12] hover:shadow-[0_20px_55px_rgba(56,189,248,0.06)] animate-in fade-in duration-300">
            {/* Ambient fluid glow backdrops */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#00AEEF]/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 group-hover:bg-[#00AEEF]/15 transition-all duration-700" />
            <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 group-hover:bg-indigo-500/15 transition-all duration-700" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1.5 text-right flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all duration-300 shrink-0">
                  <Activity className="animate-pulse" size={22} />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">لوحة تحليلات الأداء والإنتاجية</span>
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    نظرة عامة على أدائك اليومي، الأسبوعي، والشهري لمتابعة نسب النجاح وتأثير التواصلات
                  </p>
                </div>
              </div>

              {/* Dynamic Time Filter */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/45 backdrop-blur-md p-1.5 rounded-2xl border border-white/[0.06] shadow-inner font-sans">
                {(["today", "week", "month", "custom"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer",
                      timeFilter === filter 
                        ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-[0_4px_25px_rgba(56,189,248,0.25)] border-t border-white/20 scale-[1.03]" 
                        : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                    )}
                  >
                    {filter === "today" && "يومي (اليوم)"}
                    {filter === "week" && "أسبوعي (٧ أيام)"}
                    {filter === "month" && "شهري (الشهر الحالي)"}
                    {filter === "custom" && "تاريخ مخصص 📅"}
                  </button>
                ))}
              </div>
            </div>

            {/* If Custom Date Filter is Chosen */}
            {timeFilter === "custom" && (
              <div className="mt-6 pt-6 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300 pb-2">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400">من تاريخ (البداية)</label>
                  <Input
                    dark
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-12 text-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400">إلى تاريخ (النهاية)</label>
                  <Input
                    dark
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-12 text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 8 Analytics Cards Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 font-sans">
            
            {/* Card 1: إجمالي العملاء */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00AEEF]/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">إجمالي العملاء</span>
                <div className="p-1.5 rounded-lg bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/10">
                  <span className="text-xs">👤</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-white font-mono">{kpis.assigned}</h3>
                <p className="text-[9px] text-slate-500 mt-1 font-semibold">العملاء والصفقات</p>
              </div>
            </Card>

            {/* Card 2: اجمالي الميتنج */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 font-sans">إجمالي الميتنج</span>
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-450/10">
                  <span className="text-xs">📅</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-white font-mono">{kpis.meetingsCount}</h3>
                <p className="text-[9px] text-[#00AEEF] mt-1 font-bold">مجدول ومنفذ</p>
              </div>
            </Card>

            {/* Card 3: اجمالي الميتنج الناجح */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">الميتنج الناجح</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                  <span className="text-xs">✅</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-emerald-400 font-mono">{kpis.successfulMeetings}</h3>
                <p className="text-[9px] text-emerald-500 mt-1 font-extrabold font-sans">ميتنج ناجح ومتابع</p>
              </div>
            </Card>

            {/* Card 4: اجمالي عروض الأسعار */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">عروض الأسعار</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/10">
                  <span className="text-xs">📄</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-amber-400 font-mono leading-tight">
                  {kpis.totalQuotesCount} <span className="text-xs text-slate-400">عروض</span>
                </h3>
                <p className="text-[10px] text-amber-500 mt-1 font-extrabold font-mono text-left" dir="ltr">
                  {kpis.totalQuotesValue.toLocaleString()} ر.س
                </p>
              </div>
            </Card>

            {/* Card 5: اجمالي التعاقدات */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 font-sans">إجمالي التعاقدات</span>
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/10">
                  <span className="text-xs">🚀</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-white font-mono leading-tight">
                  {kpis.totalContractsCount} <span className="text-xs text-slate-400 font-sans">عقود</span>
                </h3>
                <p className="text-[10px] text-purple-400 mt-1 font-extrabold font-mono text-left" dir="ltr">
                  {kpis.totalContractValue.toLocaleString()} ر.س
                </p>
              </div>
            </Card>

            {/* Card 6: اجمالي المبلغ المدفوع */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">المبلغ المدفوع</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                  <span className="text-xs">💰</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-black text-emerald-400 font-mono text-left" dir="ltr">
                  {kpis.revenue.toLocaleString()} ر.س
                </h3>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">إجمالي المحصل</p>
              </div>
            </Card>

            {/* Card 7: اجمالي المبلغ المتبقي */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">المبلغ المتبقي</span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-455 border border-rose-500/10">
                  <span className="text-xs">⚠️</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-black text-rose-400 font-mono text-left" dir="ltr">
                  {kpis.totalRemainingAmount.toLocaleString()} ر.س
                </h3>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">مستحقات متبقية</p>
              </div>
            </Card>

            {/* Card 8: التارجت الشخصي الشهري */}
            <Card glass className="p-4 border-white/[0.04] relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400">التارجت الشخصي الشهري</span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/10">
                  <span className="text-xs">🎯</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-sm font-black text-white font-mono leading-tight">
                  <span>{kpis.totalContractValue.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500"> / {(settings.targets?.salesAgentMonthlyTarget || 0).toLocaleString()} ر.س</span>
                </h3>
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-2">
                  <span>نسبة الإنجاز:</span>
                  <span className="font-mono text-rose-400">
                    {settings.targets?.salesAgentMonthlyTarget && settings.targets.salesAgentMonthlyTarget > 0 
                      ? Math.round((kpis.totalContractValue / settings.targets.salesAgentMonthlyTarget) * 100)
                      : 0}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-1 mt-1 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-1 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(
                        settings.targets?.salesAgentMonthlyTarget && settings.targets.salesAgentMonthlyTarget > 0 
                          ? Math.round((kpis.totalContractValue / settings.targets.salesAgentMonthlyTarget) * 100)
                          : 0, 
                        100
                      )}%` 
                    }}
                  />
                </div>
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
                توزيع صفقات التعاقد الناجحة والمستعدة للتعاقد عبر مجالات الأعمال لتحديد الصناعات والمجالات الأعلى طلباً وقيمة مالية.
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

      {workspaceTab === "clients" && false && (
        <div className="space-y-6 animate-in fade-in duration-350 text-right" dir="rtl">
          {/* Client Sub-tab toggle */}
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 flex-wrap gap-4">
            <div className="flex bg-[#020617]/40 p-1 rounded-xl border border-white/[0.04]">
              <button
                onClick={() => setClientSubTab("followup")}
                className="px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/20"
              >
                <Target size={13} />
                <span>متابعة وتحديث الصفقات النشطة ⭐</span>
              </button>
              <button
                onClick={() => setClientSubTab("spreadsheet")}
                className="px-5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 text-slate-400 hover:text-white"
              >
                <Users size={13} />
                <span>السجل الرقمي الموحد والعملاء السريع (Excel) 🤝</span>
              </button>
            </div>
          </div>

          <div className="space-y-8 animate-in fade-in duration-300">
              {/* Main filter toolbar */}
      <Card glass className="p-5 border-white/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <Input
              dark
              placeholder="ابحث بالاسم، الجوال، المجال..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pr-9 text-xs w-full"
            />
          </div>

          <Select
            dark
            value={selectedMeetingStatusFilter}
            onChange={(e) => setSelectedMeetingStatusFilter(e.target.value)}
            className="h-10 text-xs text-slate-300"
          >
            <option value="">كل حالات الاجتماع</option>
            {formConfig.meetingStatuses?.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </Select>

          <Select
            dark
            value={selectedResponseFilter}
            onChange={(e) => setSelectedResponseFilter(e.target.value)}
            className="h-10 text-xs text-slate-300"
          >
            <option value="">كل حالات الاستجابة</option>
            {formConfig.responseOptions?.map(resp => (
              <option key={resp} value={resp}>{resp}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Success notification popup */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-slate-950 font-black px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-emerald-400/20 animate-bounce">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error notification popup */}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 bg-rose-500 text-white font-black px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-rose-400/20 animate-bounce">
          <BadgeAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Leads Interactive Section */}
      <Card glass className="border-white/[0.04] overflow-hidden">
        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="text-sm font-black text-white">العقود والملفات المعنية للعمل الفعلي ({filteredLeads.length})</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">محدث تلقائيا من الفايرستور سحابياً</span>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3 font-semibold text-xs leading-relaxed">
            <Layers className="mx-auto text-slate-600 animate-pulse" size={32} />
            <p>لا توجد أي صفقات أو متابعات مبيعات تطابق الفلاتر المحددة حالياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right" dir="rtl">
              <thead>
                <tr className="border-b border-white/[0.05] text-[10px] font-black tracking-widest text-slate-400 uppercase bg-slate-950/20">
                  <th className="p-4 pr-6">اسم العميل والنشاط</th>
                  <th className="p-4">الجوال والاتصال</th>
                  <th className="p-4">سورس المصدر</th>
                  <th className="p-4">موعد الميتنج / اللقاء</th>
                  <th className="p-4">المخرجات والاستجابة</th>
                  <th className="p-4">التعاقد المالي</th>
                  <th className="p-4 text-left pl-6">تحديث واتخاذ إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredLeads.map((lead) => {
                  const isWon = lead.isContracted === true || lead.paymentStatus === "تم التعاقد";
                  const todayStr = getLocalDateString();
                  const isTaskUrgent = !isWon && (lead.meetingTime?.split("T")[0] === todayStr || lead.dateFollow === todayStr);

                  return (
                    <tr 
                      key={lead.id} 
                      className={cn(
                        "text-xs transition-colors hover:bg-white/[0.01]",
                        isWon ? "bg-emerald-500/[0.02]" : "",
                        isTaskUrgent ? "bg-amber-500/[0.02]" : ""
                      )}
                    >
                      {/* Name and industry */}
                      <td className="p-4 pr-6 relative">
                        {isTaskUrgent && (
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-amber-500 rounded-l-full shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-sm block">{lead.clientName}</span>
                            {lead.id && !acknowledgedLeads.includes(lead.id) && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full text-slate-900 bg-amber-400 border border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)] animate-pulse select-none font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-ping inline-block" />
                                <span>جديد 🔔</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 bg-white/5 border border-white/5 font-semibold px-2 py-0.5 rounded-lg">
                              {lead.field || "غير محدد"}
                            </span>
                            {lead.businessType && (
                              <span className="text-[9px] text-indigo-300 font-bold">
                                • {lead.businessType}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone & quick WhatsApp button */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-300">
                            <span>{lead.phone}</span>
                            <button
                              onClick={() => handleCopyPhone(lead.phone, lead.id)}
                              className="text-slate-500 hover:text-sky-400 p-1 rounded hover:bg-white/5 cursor-pointer"
                              title="نسخ رقم الجوال"
                            >
                              {copiedId === lead.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            <div className="flex gap-2 flex-wrap">
                              <a
                                href={handleCreateWhatsAppLink(lead.phone, lead.whatsappMessageText || "")}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] bg-green-500/10 hover:bg-green-500/20 text-green-400 px-2 py-0.5 rounded-md border border-green-500/10 transition-all font-bold"
                              >
                                <MessageSquare size={10} />
                                <span>واتساب سريع</span>
                              </a>
                              {lead.storeLink && (
                                <a
                                  href={lead.storeLink.startsWith("http") ? lead.storeLink : `https://${lead.storeLink}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-md border border-sky-500/10 transition-all font-bold"
                                >
                                  <ExternalLink size={10} />
                                  <span>الرابط</span>
                                </a>
                              )}
                            </div>

                            {(lead.additionalPhone || lead.additionalStore) && (
                              <div className="flex flex-col gap-1 border-t border-white/[0.04] pt-1.5 mt-1">
                                {lead.additionalPhone && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-300">
                                    <span className="font-mono font-bold" dir="ltr">{lead.additionalPhone}</span>
                                    <a
                                      href={handleCreateWhatsAppLink(lead.additionalPhone, lead.whatsappMessageText || "")}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-green-400 hover:underline inline-flex items-center gap-0.5"
                                      title="واتساب للرقم الإضافي"
                                    >
                                      <MessageSquare size={9} />
                                      <span>واتساب إضافي</span>
                                    </a>
                                  </div>
                                )}
                                {lead.additionalStore && (
                                  <a
                                    href={lead.additionalStore.startsWith("http") ? lead.additionalStore : `https://${lead.additionalStore}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline font-bold"
                                    title={lead.additionalStore}
                                  >
                                    <ExternalLink size={10} />
                                    <span>الموقع الإضافي</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Data Source */}
                      <td className="p-4 text-slate-400 font-bold text-[11px]">
                        {lead.dataSource || "غير مسجل"}
                      </td>

                      {/* Meeting Status and details */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border",
                            lead.meetingStatus === "مجدول" ? "bg-sky-500/10 text-sky-400 border-sky-500/15" :
                            lead.meetingStatus === "تم الاجتماع" || lead.meetingStatus === "ناجح" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" :
                            lead.meetingStatus === "ملغي" ? "bg-rose-500/10 text-rose-455 border-rose-500/15" :
                            "bg-slate-900 text-slate-400 border-white/[0.04]"
                          )}>
                            <Clock size={10} />
                            <span>{lead.meetingStatus || "لم يجدول"}</span>
                          </span>

                          {(lead.meetingTime || lead.meetingLink) && (
                            <p className="text-[10px] text-slate-500 font-medium font-sans">
                              {lead.meetingTime ? lead.meetingTime.replace("T", " ") : ""}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Outcome & responses */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="text-slate-200 font-extrabold text-[11px] block">
                            {lead.response || "لا يوجد رد بعد"}
                          </span>
                          {lead.firstContactOutcome && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 max-w-[150px] font-sans">
                              {lead.firstContactOutcome}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Financial status */}
                      <td className="p-4">
                        {isWon ? (
                          <div className="space-y-0.5 text-right">
                            <span className="text-emerald-450 text-[11px] font-extrabold block">✓ تم التعاقد</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold block">
                              محصل: {Number(lead.paidAmount || 0).toLocaleString()} ر.س
                            </span>
                            {Number(lead.contractAmount || 0) - Number(lead.paidAmount || 0) > 0 && (
                              <span className="text-[9px] text-rose-400 font-mono font-semibold block">
                                متبقي: {(Number(lead.contractAmount || 0) - Number(lead.paidAmount || 0)).toLocaleString()} ر.س
                              </span>
                            )}
                          </div>
                        ) : lead.response === "تم تقديم عرض السعر" ? (
                          <span className="text-indigo-400 text-[10px] font-extrabold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/15">
                            تم تقديم عرض سعر 🏷️
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-semibold">بانتظار الإغلاق</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-left pl-6">
                        <Button
                          onClick={() => handleEditClick(lead)}
                          className="h-10 px-4 text-xs bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 text-sky-400 font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Edit3 size={12} />
                          <span>تعديل المتابعة</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </div>
      </div>
      )}

      {workspaceTab === "meetings" && (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
          {/* Top segment with Title & Sub-tabs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/45 border border-white/[0.04] backdrop-blur-xl">
            <div className="space-y-1">
              <h3 className="text-base font-black text-white flex items-center gap-2 font-sans">
                <Calendar className="text-amber-400 animate-pulse" size={18} />
                <span>متابعة العملاء والاجتماعات الموزعة 🤝</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium font-sans">
                مساحة العمل المتكاملة لمتابعة ميتنج التيلي سيلز وسجل ملفات وعملاء المبيعات.
              </p>
            </div>

            {/* Premium Sub-tab selector */}
            <div className="flex bg-[#020617]/60 p-1 rounded-xl border border-white/[0.05] self-start lg:self-auto shrink-0 select-none">
              <button
                type="button"
                onClick={() => setMeetingsSubTab("schedule")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  meetingsSubTab === "schedule"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/25 shadow-sm font-black"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Clock size={13} />
                <span>جدول مواعيد الاجتماعات</span>
                {unacknowledgedMeetingLeads.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMeetingsSubTab("spreadsheet")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  meetingsSubTab === "spreadsheet"
                    ? "bg-[#00AEEF]/20 text-white border border-[#00AEEF]/30 shadow-sm font-black"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Users size={13} />
                <span>السجل الرقمي الشامل (Excel)</span>
                {unacknowledgedGeneralLeads.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping shrink-0" />
                )}
              </button>
            </div>
          </div>

          {meetingsSubTab === "schedule" && (
            <div className="space-y-6 animate-in fade-in duration-300">

          {/* Real-time Unacknowledged Telesales Meetings Alerts */}
          {unacknowledgedMeetingLeads.length > 0 && (
            <div className="bg-[#020617]/90 backdrop-blur-md border border-amber-500/25 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300 select-text relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                  </span>
                  <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5 font-sans">
                     مركز التنبيهات اللحظية: لقاءات واجتماعات تيلي سيلز جديدة واردة لإدارتك ({unacknowledgedMeetingLeads.length})
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
                {unacknowledgedMeetingLeads.map((lead) => (
                  <div key={lead.id} className="bg-slate-950/60 border border-white/[0.03] p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-amber-500/15 transition-all relative">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#fbbf24] bg-[#fbbf24]/10 px-2 py-0.5 rounded border border-[#fbbf24]/20 whitespace-nowrap">
                          📆 ميتنج جديد مسند
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold font-mono">
                          بانتظار التفاصيل
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-100 font-black">{lead.clientName}</p>
                        <p className="text-[11px] text-[#00AEEF] font-mono tracking-wider">{lead.phone}</p>
                        {lead.field && (
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            مجال النشاط: <span className="text-slate-300 font-semibold">{lead.field}</span>
                          </p>
                        )}
                        {lead.meetingTime && (
                          <p className="text-[10.5px] text-amber-400/90 font-bold font-mono">
                            ⏳ موعد اللقاء: {lead.meetingTime.replace("T", " ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.02]">
                      <Button
                        onClick={() => {
                          acknowledgeSingleLead(lead.id);
                          showFeedback(`✔ تم تأكيد استلام العميل "${lead.clientName}" بنجاح!`);
                        }}
                        className="flex-1 h-8 rounded-lg text-[10px] font-black bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-550/20 cursor-pointer shadow-sm transition-all"
                      >
                        ✔ تأكيد الاستلام
                      </Button>
                      <Button
                        onClick={() => {
                          handleEditClick(lead);
                        }}
                        className="flex-1 h-8 rounded-lg text-[10px] font-black bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 text-[#00AEEF] border border-[#00AEEF]/20 cursor-pointer shadow-sm transition-all"
                      >
                        ⚙ فتح وتعديل الحالة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini KPI Dashboard for Meetings Tab */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card glass className="p-4 border-white/[0.03] space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي اللقاءات</span>
              <span className="text-2xl font-black text-white font-mono block">
                {meetingLeads.length}
              </span>
            </Card>
            <Card glass className="p-4 border-white/[0.03] space-y-1">
              <span className="text-[10px] text-amber-400 font-bold block">اللقاءات المجدولة ⏳</span>
              <span className="text-2xl font-black text-amber-400 font-mono block">
                {meetingLeads.filter(l => l.meetingStatus === "مجدول" || !l.meetingStatus).length}
              </span>
            </Card>
            <Card glass className="p-4 border-white/[0.03] space-y-1">
              <span className="text-[10px] text-emerald-400 font-bold block">تم اللقاء والاجتماع ✔</span>
              <span className="text-2xl font-black text-emerald-400 font-mono block">
                {meetingLeads.filter(l => l.meetingStatus === "تم الاجتماع").length}
              </span>
            </Card>
            <Card glass className="p-4 border-white/[0.03] space-y-1">
              <span className="text-[10px] text-rose-400 font-bold block">لقاءات ملغية ✖</span>
              <span className="text-2xl font-black text-rose-400 font-mono block">
                {meetingLeads.filter(l => l.meetingStatus === "ملغي").length}
              </span>
            </Card>
          </div>

          {/* Live Filters */}
          <Card glass className="p-5 border-white/[0.04] space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <ListFilter size={16} />
              <h4 className="text-xs font-black text-white font-sans">صندوق تصفية وفرز صفحة الميتنج الفوري</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search term */}
              <div className="relative">
                <Search className="absolute right-3.5 top-3.5 text-slate-500" size={14} />
                <Input
                  dark
                  placeholder="ابحث باسم العميل / رقم الجوال / المجال..."
                  className="h-10 pr-9 text-xs"
                  value={meetingSearchTerm}
                  onChange={(e) => setMeetingSearchTerm(e.target.value)}
                />
              </div>

              {/* Status filter */}
              <div>
                <select
                  value={meetingStatusFilter}
                  onChange={(e) => setMeetingStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 bg-[#0b101f] border border-white/[0.06] rounded-xl text-xs text-slate-300 font-bold focus:ring-1 focus:ring-amber-500/55 focus:border-amber-500/55 outline-none"
                >
                  <option value="">كل حالات الاجتماعات</option>
                  <option value="مجدول">مجدول</option>
                  <option value="تم الاجتماع">تم الاجتماع</option>
                  <option value="ملغي">ملغي</option>
                </select>
              </div>

              {/* Quick count display */}
              <div className="flex items-center justify-start sm:justify-end text-xs font-semibold text-slate-400">
                نتائج التصفية: {filteredMeetingLeads.length} من {meetingLeads.length} لقاء مسند
              </div>
            </div>
          </Card>

          {/* Table / List View */}
          <Card glass className="border-white/[0.04] overflow-hidden">
            {filteredMeetingLeads.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/[0.06] flex items-center justify-center mx-auto text-slate-500">
                  <Calendar size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-300">لا توجد لقاءات ميتنج نشطة</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    لم نجد أي ميتنج يطابق خيارات التصفية الحالية، أو لم يتم توزيع عملاء اجتماعات لك بعد من قبل مدير قسم المبيعات.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.01] text-slate-400 font-black">
                      <th className="p-4 pr-6">اسم العميل ومجال العمل</th>
                      <th className="p-4">الجوال والاتصال</th>
                      <th className="p-4">التيلي سيلز المحول</th>
                      <th className="p-4">رابط اللقاء والوقت</th>
                      <th className="p-4">الحالة المجدولة</th>
                      <th className="p-4">إجراءات المتابعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {filteredMeetingLeads.map((lead) => {
                      const isCompleted = lead.meetingStatus === "تم الاجتماع";
                      const isCancelled = lead.meetingStatus === "ملغي";
                      const formattedTime = lead.meetingTime 
                        ? new Date(lead.meetingTime).toLocaleString("ar-SA", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        : "لم يحدد موعد دقيق";

                      return (
                        <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors group">
                          {/* Client & Field */}
                          <td className="p-4 pr-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-white text-sm block group-hover:text-amber-300 transition-colors">
                                  {lead.clientName}
                                </span>
                                {lead.id && !acknowledgedLeads.includes(lead.id) && (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full text-slate-900 bg-amber-400 border border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)] animate-pulse select-none font-sans">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-ping inline-block" />
                                    <span>جديد 🔔</span>
                                  </span>
                                )}
                              </div>
                              {lead.field && (
                                <span className="text-[10px] text-slate-400 font-medium block">
                                  💼 {lead.field}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Phone & contact links */}
                          <td className="p-4">
                            <div className="space-y-1 font-mono font-bold text-slate-300">
                              <span className="dir-ltr inline-block">{lead.phone}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                                >
                                  اتصال 📞
                                </a>
                                <a
                                  href={`https://wa.me/${lead.phone}`}
                                  target="_blank"
                                  referrerPolicy="no-referrer"
                                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                                >
                                  واتساب 💬
                                </a>
                              </div>
                            </div>
                          </td>

                          {/* Telesales identity */}
                          <td className="p-4 text-slate-400">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-[11px] text-indigo-300 block">
                                {lead.telesalesAgentName || "قسم التيلي سيلز"}
                              </span>
                              <span className="text-[9px] text-slate-500 block">
                                (إحالة تلقائية نشطة)
                              </span>
                            </div>
                          </td>

                          {/* Meeting timing & link */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <span className="text-[11px] text-amber-400 font-bold block">
                                📅 {formattedTime}
                              </span>
                              {lead.meetingLink ? (
                                <a
                                  href={lead.meetingLink.startsWith("http") ? lead.meetingLink : `https://${lead.meetingLink}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  referrerPolicy="no-referrer"
                                  className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded-md font-bold transition-all"
                                >
                                  <span>رابط الغرفة 🌐</span>
                                </a>
                              ) : (
                                <span className="text-[9px] text-slate-500 block">لا يوجد رابط لقاء</span>
                              )}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/15">
                                ✓ تم الاجتماع
                              </span>
                            ) : isCancelled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/15">
                                ملغي ✖
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/15 animate-pulse">
                                مجدول ⏳
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-left pl-6">
                            <Button
                              onClick={() => handleEditClick(lead)}
                              className="h-10 px-4 text-xs bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Edit3 size={12} />
                              <span>تكامل المتابعة والتحديث</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          </div>
          )}
        </div>
      )}

      {(workspaceTab === "clients" || (workspaceTab === "meetings" && meetingsSubTab === "spreadsheet")) && (
        <div className="space-y-6 animate-in fade-in duration-350 text-right" dir="rtl">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-4 flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Users className="text-[#00AEEF]" size={20} />
                <span>بيانات العملاء</span>
              </h2>
            </div>
            
            {/* Registrations count and action */}
            <Button
              onClick={() => setIsAddClientOpen(true)}
              className="h-10 px-4 font-black text-xs bg-[#00AEEF] hover:bg-sky-600 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>تسجيل ملف عميل جديد</span>
            </Button>
          </div>

          {/* Real-time Unacknowledged General Clients Alerts */}
          {unacknowledgedGeneralLeads.length > 0 && (
            <div className="bg-[#020617]/90 backdrop-blur-md border border-[#00AEEF]/25 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300 select-text relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00AEEF]/5 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00AEEF]"></span>
                  </span>
                  <h4 className="text-sm font-black text-sky-400 flex items-center gap-1.5 font-sans">
                     مركز التنبيهات المباشرة: عملاء جدد تم توجيههم إليك ({unacknowledgedGeneralLeads.length})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      playChime();
                      showFeedback("🔊 تم تنشيط واختبار نظام التنبيه الصوتي بنجاح!");
                    }}
                    className="h-8 px-3 text-[10px] font-bold bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 text-sky-300 border border-[#00AEEF]/20 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>تجربة جرس التنبيه</span>
                    <span>🔊</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unacknowledgedGeneralLeads.map((lead) => (
                  <div key={lead.id} className="bg-slate-950/60 border border-white/[0.03] p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-[#00AEEF]/15 transition-all relative">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#00AEEF] bg-[#00AEEF]/10 px-2 py-0.5 rounded border border-[#00AEEF]/20 whitespace-nowrap">
                          👤 عميل جديد مسند
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold font-mono">
                          {lead.dataSource || "غير محدد"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-100 font-black">{lead.clientName}</p>
                        <p className="text-[11px] text-sky-400 font-mono tracking-wider">{lead.phone}</p>
                        {lead.field && (
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            النشاط: <span className="text-slate-300 font-semibold">{lead.field}</span>
                          </p>
                        )}
                        {lead.date && (
                          <p className="text-[10.5px] text-slate-500 font-medium font-mono">
                            تاريخ التوجيه: {lead.date}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.02]">
                      <Button
                        onClick={() => {
                          acknowledgeSingleLead(lead.id);
                          showFeedback(`✔ تم تأكيد استلام العميل "${lead.clientName}" بنجاح!`);
                        }}
                        className="flex-1 h-8 rounded-lg text-[10px] font-black bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-550/20 cursor-pointer shadow-sm transition-all"
                      >
                        ✔ تأكيد الاستلام
                      </Button>
                      <Button
                        onClick={() => {
                          handleEditClick(lead);
                        }}
                        className="flex-1 h-8 rounded-lg text-[10px] font-black bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 text-[#00AEEF] border border-[#00AEEF]/20 cursor-pointer shadow-sm transition-all"
                      >
                        ⚙ فتح وتعديل الحالة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Interactive spreadsheet with live filters occupying FULL WIDTH */}
          <div className="space-y-6">
              
              {/* Filter Card - "صندوق فرز وبحث السجل الفوري" */}
              <Card glass className="p-5 border-white/[0.04] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Sliders size={16} />
                    <h4 className="text-xs font-black text-white font-sans">صندوق فرز وبحث السجل الفوري</h4>
                  </div>
                  <Button
                    type="button"
                    onClick={resetAllFilters}
                    className="h-9 px-4 rounded-xl text-[10px] font-black bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw size={12} />
                    <span>مسح الفلاتر</span>
                  </Button>
                </div>

                {/* Sales-Manager-only: employee filter, reusing the same
                    employee list used in إدارة قسم المبيعات (SalesHub.tsx) */}
                {canManageSalesDept && (
                  <div className="space-y-1.5 pb-1 border-b border-white/[0.04]">
                    <label className="text-[11px] font-bold text-slate-400 font-sans flex items-center gap-1.5">
                      <User size={12} className="text-sky-400" />
                      اختر موظف المبيعات
                    </label>
                    <Select
                      dark
                      value={selectedSalesAgentFilter}
                      onChange={(e) => setSelectedSalesAgentFilter(e.target.value)}
                      className="h-10 text-xs text-slate-300 w-full sm:w-72"
                    >
                      <option value="">كل موظفي المبيعات (الكل)</option>
                      {availableSalesAgents.map(ag => (
                        <option key={ag.id} value={ag.name}>{ag.name}</option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {/* Search text */}
                  <div className="relative">
                    <Search className="absolute right-3.5 top-3.5 text-slate-500" size={14} />
                    <Input
                      dark
                      placeholder="ابحث باسم العميل، الشركة، رقم الهاتف، البريد الإلكتروني..."
                      className="h-10 pr-9 text-xs"
                      value={regSearchSearchTerm}
                      onChange={(e) => setRegSearchSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* 1. Lead Status */}
                  <Select
                    dark
                    value={regFilterLeadStatus}
                    onChange={(e) => setRegFilterLeadStatus(e.target.value)}
                    className="h-10 text-xs text-slate-300"
                  >
                    <option value="">حالات العملاء</option>
                    <option value="HOT">HOT</option>
                    <option value="WARM">WARM</option>
                    <option value="COLD">COLD</option>
                    <option value="DEAD">DEAD</option>
                  </Select>

                  {/* 2. Decision Maker */}
                  <Select
                    dark
                    value={regFilterDecisionMaker}
                    onChange={(e) => setRegFilterDecisionMaker(e.target.value)}
                    className="h-10 text-xs text-slate-300"
                  >
                    <option value="">أصحاب القرار</option>
                    <option value="YES">YES</option>
                    <option value="PARTNER">PARTNER</option>
                    <option value="NO">NO</option>
                  </Select>

                  {/* 3. Package */}
                  <Select
                    dark
                    value={regFilterPackage}
                    onChange={(e) => setRegFilterPackage(e.target.value)}
                    className="h-10 text-xs text-slate-300"
                  >
                    <option value="">الباقات المقررة</option>
                    <option value="360">360</option>
                    <option value="مدار">مدار</option>
                    <option value="مدار حملات اعلانية">مدار حملات اعلانية</option>
                    <option value="مدار سيو">مدار سيو</option>
                  </Select>

                  {/* 4. PAID */}
                  <Select
                    dark
                    value={regFilterPaid}
                    onChange={(e) => setRegFilterPaid(e.target.value)}
                    className="h-10 text-xs text-slate-300"
                  >
                    <option value="">تم الدفع</option>
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </Select>

                  {/* 5. Meeting Status */}
                  <Select
                    dark
                    value={regFilterMeetingStatus}
                    onChange={(e) => setRegFilterMeetingStatus(e.target.value)}
                    className="h-10 text-xs text-slate-300"
                  >
                    <option value="">حالة الاجتماع</option>
                    <option value="مجدول">مجدول</option>
                    <option value="تم الاجتماع">تم الاجتماع</option>
                    <option value="بانتظار العميل">بانتظار العميل</option>
                    <option value="مؤجل">مؤجل</option>
                    <option value="ملغي">ملغي</option>
                    <option value="لم يحضر">لم يحضر</option>
                  </Select>

                  {/* 6. Date Follow */}
                  <Input
                    dark
                    type="date"
                    value={regFilterDateFollow}
                    onChange={(e) => setRegFilterDateFollow(e.target.value)}
                    className="h-10 text-xs font-sans"
                    title="تاريخ المتابعة"
                  />
                </div>
              </Card>

              {/* Table Data list with auto save */}
              <Card glass className="border-white/[0.04] overflow-hidden">
                <div className="p-5 border-b border-white/[0.05] flex items-center justify-between bg-slate-950/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-black text-white font-sans">جدول ملفات المبيعات وسجل العملاء الكلي ({regFilteredLeads.length})</span>
                  </div>
                  <span className="text-[10px] font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/10 font-sans">ميزة الحفظ التلقائي الفوري مفعلة نشطاً (Auto Save) 🌐</span>
                </div>

                {regFilteredLeads.length === 0 ? (
                  <div className="p-16 text-center text-slate-500 space-y-3 font-semibold text-xs leading-relaxed font-sans">
                    <Activity className="mx-auto text-slate-600 animate-pulse" size={32} />
                    <p>لا توجد أي بيانات عملاء مسجلة تطابق التصفية الحالية.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right divide-y divide-white/[0.03]" dir="rtl">
                      <thead>
                        <tr className="bg-slate-950/40 text-[10px] font-black tracking-widest text-slate-400 border-b border-white/[0.05] uppercase">
                          <th className="p-3 text-center whitespace-nowrap min-w-[100px] font-sans">بيانات العميل</th>
                          <th className="p-3 pr-4 whitespace-nowrap min-w-[140px] font-sans">Customer Name (اسم العميل)</th>
                          <th className="p-3 whitespace-nowrap font-sans">Phone Number (رقم الجوال)</th>
                          <th className="p-3 whitespace-nowrap min-w-[110px] font-sans">Lead Status (حالة العميل)</th>
                          <th className="p-3 whitespace-nowrap min-w-[110px] font-sans">Decision Maker (صاحب القرار)</th>
                          <th className="p-3 whitespace-nowrap font-sans">Niche (المجال)</th>
                          <th className="p-3 whitespace-nowrap min-w-[130px] font-sans">Package (الباقة)</th>
                          <th className="p-3 whitespace-nowrap font-sans">Amount (قيمة الصفقة)</th>
                          <th className="p-3 whitespace-nowrap min-w-[220px] font-sans">التعليقات (Comments)</th>
                          <th className="p-3 whitespace-nowrap font-sans">Date Follow (تاريخ المتابعة)</th>
                          <th className="p-3 whitespace-nowrap font-sans">Invoice & Contract (الفاتورة والعقد)</th>
                          <th className="p-3 whitespace-nowrap min-w-[100px] font-sans">PAID</th>
                          <th className="p-3 whitespace-nowrap font-sans">Date Pay (تاريخ السداد)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {paginatedRegFilteredLeads.map((lead) => {
                          const isSaving = savingState[lead.id];
                          
                          const renderLeadStatusBadge = (status: string) => {
                            const val = String(status || "").toUpperCase();
                            if (val === "HOT") return "bg-red-500/10 text-red-400 border-red-500/20";
                            if (val === "WARM") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
                            if (val === "COLD") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
                            return "bg-slate-500/10 text-slate-400 border-slate-500/20";
                          };

                          const renderDecisionMakerBadge = (dm: string) => {
                            const val = String(dm || "").toUpperCase();
                            if (val === "YES") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/10";
                            if (val === "PARTNER") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/10";
                            return "bg-rose-500/10 text-rose-450 border-rose-500/10";
                          };

                          const renderPaidBadge = (paid: string) => {
                            const val = String(paid || "").toUpperCase();
                            if (val === "YES") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
                            return "bg-rose-500/10 text-rose-450 border-rose-500/15";
                          };

                          // Get comments list for this lead
                          const leadComments = getLeadCommentsList(lead);

                          return (
                            <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors relative text-xs">
                              
                              {/* 0. Show All Details Button */}
                              <td className="p-2.5 text-center whitespace-nowrap min-w-[100px]">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDetailsLead(lead);
                                    setIsDetailsOpen(true);
                                  }}
                                  className="h-8 px-2 py-1 text-[10px] bg-[#00AEEF]/10 hover:bg-[#00AEEF]/20 text-[#00AEEF] border border-[#00AEEF]/25 font-black rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer shadow-sm mx-auto"
                                >
                                  <Eye size={11} />
                                  <span>عرض التفاصيل 🔍</span>
                                </Button>
                              </td>

                              {/* 1. Customer Name - (NOT EDITABLE after save as requested) */}
                              <td className="p-3 pr-4 font-black text-rose-100 min-w-[140px] font-sans">
                                <span className="block">{lead.clientName}</span>
                                {/* NEW: Second "زيارة المتجر" directly under the customer name */}
                                {lead.storeLink && (
                                  <a
                                    href={lead.storeLink.startsWith("http") ? lead.storeLink : `https://${lead.storeLink}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 hover:underline font-bold mt-0.5 transition-colors"
                                  >
                                    <Store size={12} />
                                    <span>زيارة المتجر</span>
                                  </a>
                                )}
                                {isSaving && (
                                  <span className="text-[9px] text-sky-400 font-extrabold block animate-pulse">جاري الحفظ تلقائياً...</span>
                                )}
                              </td>

                              {/* 2. Phone Number - (NOT EDITABLE after save as requested) */}
                              <td className="p-3 font-mono text-slate-400 font-bold whitespace-nowrap">
                                {lead.phone}
                              </td>

                              {/* 3. Lead Status Dropdown Badge */}
                              <td className="p-2.5 min-w-[110px]">
                                <select
                                  value={lead.leadStatus || "HOT"}
                                  onChange={(e) => handleAutoSaveField(lead.id, "leadStatus", e.target.value)}
                                  className={cn(
                                    "w-full text-[10px] font-black rounded-lg py-1 px-1 text-center cursor-pointer focus:outline-none border font-sans",
                                    renderLeadStatusBadge(lead.leadStatus || "HOT")
                                  )}
                                >
                                  <option value="HOT" className="bg-slate-900 text-slate-100 font-sans">HOT</option>
                                  <option value="WARM" className="bg-slate-900 text-slate-100 font-sans">WARM</option>
                                  <option value="COLD" className="bg-slate-900 text-slate-100 font-sans">COLD</option>
                                  <option value="DEAD" className="bg-slate-900 text-slate-100 font-sans">DEAD</option>
                                </select>
                              </td>

                              {/* 4. Decision Maker Dropdown Badge */}
                              <td className="p-2.5 min-w-[110px]">
                                <select
                                  value={lead.decisionMaker || "YES"}
                                  onChange={(e) => handleAutoSaveField(lead.id, "decisionMaker", e.target.value)}
                                  className={cn(
                                    "w-full text-[10px] font-black rounded-lg py-1 px-1 text-center cursor-pointer focus:outline-none border font-sans",
                                    renderDecisionMakerBadge(lead.decisionMaker || "YES")
                                  )}
                                >
                                  <option value="YES" className="bg-slate-900 text-slate-100 font-sans">YES</option>
                                  <option value="PARTNER" className="bg-slate-900 text-slate-100 font-sans">PARTNER</option>
                                  <option value="NO" className="bg-slate-900 text-slate-100 font-sans">NO</option>
                                </select>
                              </td>

                              {/* 5. Niche (NOT EDITABLE after save as requested) */}
                              <td className="p-3 text-slate-400 font-bold font-sans">
                                {lead.field || "غير محدد"}
                              </td>

                              {/* 6. Package Dropdown Badge */}
                              <td className="p-2.5 min-w-[130px]">
                                <select
                                  value={lead.package || "360"}
                                  onChange={(e) => handleAutoSaveField(lead.id, "package", e.target.value)}
                                  className="w-full text-[10px] font-black rounded-lg py-1 px-1 text-center cursor-pointer focus:outline-none bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 font-sans"
                                >
                                  <option value="360" className="bg-slate-900 text-slate-100 font-sans">360</option>
                                  <option value="مدار" className="bg-slate-900 text-slate-100 font-sans">مدار</option>
                                  <option value="مدار حملات اعلانية" className="bg-slate-900 text-slate-100 font-sans">مدار حملات اعلانية</option>
                                  <option value="مدار سيو" className="bg-slate-900 text-slate-100 font-sans">مدار سيو</option>
                                </select>
                              </td>

                              {/* 7. Amount */}
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  defaultValue={lead.amount || lead.contractAmount || 0}
                                  onBlur={(e) => handleAutoSaveField(lead.id, "amount", Number(e.target.value))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleAutoSaveField(lead.id, "amount", Number(e.currentTarget.value));
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-20 bg-transparent text-amber-400 font-mono font-bold text-center border-b border-transparent hover:border-white/10 focus:border-sky-500 focus:bg-slate-900/60 focus:outline-none py-1 rounded-md text-xs"
                                />
                              </td>

                              {/* 8. Dynamic Comments with Edit functionality */}
                              <td className="p-2.5 min-w-[220px] align-top">
                                {(() => {
                                  const draftValue = newTableCommentDraft[lead.id] ?? "";
                                  const submitDraft = () => {
                                    if (draftValue.trim()) {
                                      handleAddTableComment(lead.id, draftValue);
                                    }
                                  };
                                  return (
                                    <div className="space-y-1.5 w-full">
                                      <textarea
                                        rows={1}
                                        placeholder="إضافة تعليق..."
                                        value={draftValue}
                                        onChange={(e) => setNewTableCommentDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            submitDraft();
                                          }
                                        }}
                                        className="w-full resize-none bg-transparent text-slate-200 border-b border-rose-500/10 hover:border-white/10 focus:border-sky-500 focus:bg-slate-900/60 focus:outline-none px-2 py-1 rounded text-xs font-sans leading-relaxed"
                                      />
                                      {leadComments.length > 0 && (
                                        <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                                          {leadComments.map((c) => {
                                            const isEditing = editingComment?.leadId === lead.id && editingComment?.index === c.number;
                                            return (
                                              <div key={c.number} className="text-[10.5px] leading-snug bg-white/[0.02] rounded-md px-2 py-1">
                                                {isEditing ? (
                                                  <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="font-black text-sky-400 text-[10px]">تعليق {c.number}:</span>
                                                      <span className="text-[9px] text-slate-500 font-medium">(تعديل)</span>
                                                    </div>
                                                    <textarea
                                                      autoFocus
                                                      rows={2}
                                                      defaultValue={c.text}
                                                      className="w-full bg-slate-900/60 border border-sky-500/30 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                          e.preventDefault();
                                                          handleEditComment(lead.id, c.number, e.currentTarget.value);
                                                        }
                                                        if (e.key === "Escape") {
                                                          setEditingComment(null);
                                                        }
                                                      }}
                                                    />
                                                    <div className="flex gap-2 mt-1">
                                                      <button
                                                        onClick={(e) => {
                                                          const textarea = e.currentTarget.parentElement?.parentElement?.querySelector('textarea');
                                                          if (textarea) {
                                                            handleEditComment(lead.id, c.number, textarea.value);
                                                          }
                                                        }}
                                                        className="text-[10px] font-black bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/20 cursor-pointer"
                                                      >
                                                        حفظ
                                                      </button>
                                                      <button
                                                        onClick={() => setEditingComment(null)}
                                                        className="text-[10px] font-black bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-2.5 py-0.5 rounded border border-rose-500/20 cursor-pointer"
                                                      >
                                                        إلغاء
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-start justify-between gap-2 group/comment">
                                                    <span className="text-slate-300 font-sans whitespace-pre-line flex-1">
                                                      <span className="font-black text-sky-400">تعليق {c.number}: </span>
                                                      {c.text}
                                                    </span>
                                                    <button
                                                      onClick={() => setEditingComment({ leadId: lead.id, index: c.number, text: c.text })}
                                                      className="text-[9px] text-slate-500 hover:text-sky-400 opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer shrink-0 font-bold"
                                                      title="تعديل التعليق"
                                                    >
                                                      [Edit]
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* 11. Date Follow */}
                              <td className="p-2.5">
                                <input
                                  type="date"
                                  defaultValue={lead.dateFollow || ""}
                                  onBlur={(e) => handleAutoSaveField(lead.id, "dateFollow", e.target.value)}
                                  className="bg-transparent text-slate-300 font-mono text-xs border-b border-transparent hover:border-white/10 focus:border-sky-500 focus:outline-none py-1 px-1 rounded"
                                />
                              </td>

                              {/* 12. Invoice & Contract */}
                              <td className="p-2.5 min-w-[180px]">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="رابط الفاتورة والعقد..."
                                    defaultValue={lead.invoiceContract || ""}
                                    onBlur={(e) => handleAutoSaveField(lead.id, "invoiceContract", e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleAutoSaveField(lead.id, "invoiceContract", e.currentTarget.value);
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    className="flex-1 bg-transparent text-sky-400 font-sans text-xs border-b border-transparent hover:border-white/10 focus:border-sky-500 focus:outline-none py-1 px-1 rounded truncate"
                                  />
                                  {lead.invoiceContract && (
                                    <a
                                      href={lead.invoiceContract}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sky-400 hover:text-sky-300 p-1 bg-sky-500/10 rounded"
                                    >
                                      <ExternalLink size={10} />
                                    </a>
                                  )}
                                </div>
                              </td>

                              {/* 13. PAID */}
                              <td className="p-2.5 min-w-[100px]">
                                <select
                                  value={lead.paid || "NO"}
                                  onChange={(e) => handleAutoSaveField(lead.id, "paid", e.target.value)}
                                  className={cn(
                                    "w-full text-[10px] font-black rounded-lg py-1 px-1 text-center cursor-pointer focus:outline-none border font-sans",
                                    renderPaidBadge(lead.paid || "NO")
                                  )}
                                >
                                  <option value="NO" className="bg-slate-900 text-slate-100 font-sans">NO</option>
                                  <option value="YES" className="bg-slate-900 text-slate-100 font-sans">YES</option>
                                </select>
                              </td>

                              {/* 14. Date Pay */}
                              <td className="p-2.5">
                                <input
                                  type="date"
                                  defaultValue={lead.datePay || ""}
                                  onBlur={(e) => handleAutoSaveField(lead.id, "datePay", e.target.value)}
                                  className="bg-transparent text-slate-300 font-mono text-xs border-b border-transparent hover:border-white/10 focus:border-sky-500 focus:outline-none py-1 px-1 rounded"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* بيانات العملاء PAGINATION — mandatory, active with or without filters */}
                {regFilteredLeads.length > 0 && (
                  <div className="p-4 border-t border-white/[0.04] bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none" dir="rtl">
                    <div className="text-xs text-slate-400 font-bold">
                      عرض <span className="text-white">{(activeRegLeadsPage - 1) * REG_LEADS_PAGE_SIZE + 1}</span> إلى <span className="text-white">{Math.min(activeRegLeadsPage * REG_LEADS_PAGE_SIZE, regFilteredLeads.length)}</span> من أصل <span className="text-white">{regFilteredLeads.length}</span> عميل
                    </div>
                    <div className="flex items-center gap-1.5 font-sans">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegLeadsPage(1)}
                        disabled={activeRegLeadsPage === 1}
                        className="h-8 px-2.5 rounded-lg text-[10px] font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                        title="الصفحة الأولى"
                      >
                        « الأولى
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegLeadsPage(p => Math.max(1, p - 1))}
                        disabled={activeRegLeadsPage === 1}
                        className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ‹ السابق
                      </Button>

                      <div className="flex items-center justify-center h-8 min-w-[90px] px-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold font-mono">
                        صفحة {activeRegLeadsPage} من {totalRegLeadsPages}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegLeadsPage(p => Math.min(totalRegLeadsPages, p + 1))}
                        disabled={activeRegLeadsPage === totalRegLeadsPages}
                        className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                      >
                        التالي ›
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegLeadsPage(totalRegLeadsPages)}
                        disabled={activeRegLeadsPage === totalRegLeadsPages}
                        className="h-8 px-2.5 rounded-lg text-[10px] font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                        title="الصفحة الأخيرة"
                      >
                        الأخيرة »
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
        </div>
      )}

      {/* Drawer: Edit Lead Form */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setSelectedLead(null); }}
        title={`تعديل متابعة وعقد العميل: ${selectedLead?.clientName || ""}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-6 pt-2 pb-12 text-right" dir="rtl">
          {/* Top Visual Tab Switcher inside the Drawer */}
          <div className="flex bg-[#0b0f24] p-1 rounded-xl border border-white/[0.05] select-none mb-4">
            <button
              type="button"
              onClick={() => setEditDrawerTab("telesales")}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                editDrawerTab === "telesales"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-md"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <PhoneCall size={14} />
              <span>بيانات التيلي سيلز والاجتماع 📞</span>
            </button>

            <button
              type="button"
              onClick={() => setEditDrawerTab("sales")}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                editDrawerTab === "sales"
                  ? "bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/20 shadow-md"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <TrendingUp size={14} />
              <span>تفاصيل المتابعة وعقود المبيعات 📈</span>
            </button>
          </div>

          {editDrawerTab === "telesales" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Info Banner */}
              <div className="bg-slate-950/60 p-4 border border-white/[0.05] rounded-2xl flex items-start gap-3">
                <Info className="text-sky-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <span className="text-xs font-black text-white block">حقول التيلي سيلز المغلقة للشفافية</span>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed font-sans">
                    وفقاً لسياسة قفل السجلات لـ <b>مجموعة MADAR Blue</b>، تم قفل الحقول التعريفية الأساسية المحولة من التيلي سيلز لحماية دقة البيانات والعمولة. يمكنك فقط تعيين وحفظ حالة الميتنج والاجتماع.
                  </p>
                </div>
              </div>

              {/* Locked Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/[0.03]">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">اسم العميل الكامل:</span>
                  <span className="text-xs text-slate-300 font-black">{selectedLead?.clientName || "غير متوفر"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">رقم الجوال:</span>
                  <span className="text-xs text-slate-300 font-mono font-bold">{selectedLead?.phone || "غير متوفر"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">المجال / النشاط:</span>
                  <span className="text-xs text-slate-300 font-bold">{selectedLead?.field || "غير محدد"}</span>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[10px] text-slate-500 font-bold block">بريف وملاحظات التيلي سيلز:</span>
                  <p className="text-xs text-slate-300 font-medium font-sans whitespace-pre-line leading-relaxed max-h-24 overflow-y-auto">{selectedLead?.note || selectedLead?.telesalesBrief || "لا توجد ملاحظات مسبقة"}</p>
                </div>
              </div>

              {/* Editable meeting status & details section */}
              <div className="space-y-4 bg-slate-900/30 p-5 rounded-2xl border border-white/[0.04]">
                <h4 className="font-extrabold text-xs text-amber-400 flex items-center gap-1.5 border-b border-white/[0.05] pb-2">
                  <Clock size={14} />
                  <span>تحديث وإقرار حالة ميتنج الاجتماع (Meeting Status)</span>
                </h4>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold text-[11px] block">حالة الاجتماع الحالية:</label>
                    <Select
                      dark
                      required
                      value={formData.meetingStatus || ""}
                      onChange={(e) => setFormData({ ...formData, meetingStatus: e.target.value })}
                    >
                      <option value="">اختر حالة الاجتماع...</option>
                      <option value="مجدول">مجدول</option>
                      <option value="تم الاجتماع">تم الاجتماع</option>
                      <option value="بانتظار العميل">بانتظار العميل</option>
                      <option value="مؤجل">مؤجل</option>
                      <option value="ملغي">ملغي</option>
                      <option value="لم يحضر">لم يحضر</option>
                    </Select>
                  </div>

                  {/* Inline scheduling fields */}
                  {["مجدول", "تم الاجتماع", "بانتظار العميل", "مؤجل", "ملغي", "لم يحضر", "تم تحديد ميتنج"].includes(formData.meetingStatus) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-300 block">رابط زووم / جوجل ميتنج:</label>
                        <Input
                          dark
                          type="url"
                          placeholder="https://meet.google.com/..."
                          value={formData.meetingLink || ""}
                          onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                          className="text-xs font-sans h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-300 block">موعد اللقاء والوقت:</label>
                        <Input
                          dark
                          type="datetime-local"
                          value={formData.meetingTime || ""}
                          onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })}
                          className="text-xs font-sans h-10"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {editDrawerTab === "sales" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Sales Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-5 rounded-2xl border border-white/[0.03]">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">حالة العميل / درجة السخونة:</label>
                  <Select
                    dark
                    value={formData.leadStatus || "HOT"}
                    onChange={(e) => setFormData({ ...formData, leadStatus: e.target.value })}
                    className="text-xs font-sans h-10"
                  >
                    <option value="HOT">HOT</option>
                    <option value="WARM">WARM</option>
                    <option value="COLD">COLD</option>
                    <option value="DEAD">DEAD</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">صاحب القرار الفعال:</label>
                  <Select
                    dark
                    value={formData.decisionMaker || "YES"}
                    onChange={(e) => setFormData({ ...formData, decisionMaker: e.target.value })}
                    className="text-xs font-sans h-10"
                  >
                    <option value="YES">YES</option>
                    <option value="PARTNER">PARTNER</option>
                    <option value="NO">NO</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">الباقة التسويقية المقررة:</label>
                  <Select
                    dark
                    value={formData.package || "360"}
                    onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                    className="text-xs font-sans h-10"
                  >
                    <option value="360">360</option>
                    <option value="مدار">مدار</option>
                    <option value="مدار حملات اعلانية">مدار حملات اعلانية</option>
                    <option value="مدار سيو">مدار سيو</option>
                  </Select>
                </div>

                {/* Next Followup date */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">موعد المتابعة القادم (Date Follow):</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      dark
                      type="date"
                      value={formData.dateFollow || ""}
                      onChange={(e) => setFormData({ ...formData, dateFollow: e.target.value })}
                      className="flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, dateFollow: getLocalDateString() });
                      }}
                      className="h-10 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/15 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center font-sans"
                    >
                      اليوم
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">رابط الفاتورة والعقد المبرم:</label>
                  <Input
                    dark
                    type="url"
                    placeholder="https://invoice.invoice-system..."
                    value={formData.invoiceContract || ""}
                    onChange={(e) => setFormData({ ...formData, invoiceContract: e.target.value })}
                    className="text-xs font-sans h-10"
                  />
                </div>

                {/* Date pay */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">تاريخ السداد المحقق / المجدول:</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      dark
                      type="date"
                      value={formData.datePay || ""}
                      onChange={(e) => setFormData({ ...formData, datePay: e.target.value })}
                      className="flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, datePay: getLocalDateString() });
                      }}
                      className="h-10 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/15 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center font-sans"
                    >
                      اليوم
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial Contract details section */}
              {renderContractSection()}

              {/* Timeline action logs updates */}
              <div className="space-y-4 bg-slate-900/20 p-5 rounded-2xl border border-white/[0.03]">
                <h4 className="font-extrabold text-xs text-sky-400 flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>تسجيل خطوة تواصل ومتابعة جديدة على المخطط الزمني</span>
                </h4>
                
                <div className="space-y-2.5">
                  <Input
                    dark
                    placeholder="تفاصيل المتابعة الفورية للعميل اليوم..."
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    className="w-full text-xs"
                  />
                  <span className="text-[9px] text-slate-500 font-semibold block">
                    ملاحظة: عند الحفظ سيتم إدراج هذا التقرير في سجل العميل فوراً بتوقيع اسمك وتاريخ فوري.
                  </span>
                </div>

                {/* Historical timeline list */}
                {formData.updates && formData.updates.length > 0 && (
                  <div className="pt-4 border-t border-white/[0.04] space-y-3">
                    <span className="text-[10px] text-slate-400 font-bold block">تاريخ الإجراءات السابقة:</span>
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {formData.updates.map((upd: any, index: number) => (
                        <div key={index} className="bg-slate-950/40 p-3 rounded-xl border border-white/[0.02] flex items-start gap-2.5 text-[11px] leading-relaxed">
                          <div className="p-1 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                            <User size={10} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="font-extrabold text-sky-350">{upd.agentName || "المبيعات"}</span>
                              <span className="text-[9px] text-slate-500 font-mono font-bold">
                                {upd.date ? new Date(upd.date).toLocaleString("ar-SA") : ""}
                              </span>
                            </div>
                            <p className="text-slate-300 font-medium font-sans whitespace-pre-line">{upd.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Explicitly Render 5 Sales Comments Fields */}
              <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/[0.03] space-y-4">
                <h4 className="font-extrabold text-xs text-[#00AEEF] flex items-center gap-1.5 border-b border-white/[0.05] pb-2">
                  <MessageSquare size={14} />
                  <span>ملاحظات وتقارير المتابعة المستمرة للمبيعات (مكالمات 1 إلى 5) 📝</span>
                </h4>
                
                <div className="grid grid-cols-1 gap-4">
                  {/* Sales Note 1 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 block">ملاحظات المكالمة الأولى (Comment 1):</label>
                    <textarea
                      className="w-full h-16 rounded-xl border border-white/[0.08] bg-[#0c1322] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                      placeholder="اكتب هنا ملاحظات وتفاصيل المكالمة الأولى بالتفصيل..."
                      value={formData.salesComment || ""}
                      onChange={(e) => setFormData({ ...formData, salesComment: e.target.value })}
                    />
                  </div>

                  {/* Sales Note 2 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 block">ملاحظة المتابعة الثانية (Comment 2):</label>
                    <textarea
                      className="w-full h-16 rounded-xl border border-white/[0.08] bg-[#0c1322] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                      placeholder="اكتب هنا ملاحظات المتابعة الثانية وتحديثها..."
                      value={formData.comment02 || ""}
                      onChange={(e) => setFormData({ ...formData, comment02: e.target.value })}
                    />
                  </div>

                  {/* Sales Note 3 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 block">ملاحظة المتابعة الثالثة (Comment 3):</label>
                    <textarea
                      className="w-full h-16 rounded-xl border border-white/[0.08] bg-[#0c1322] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                      placeholder="اكتب هنا ملاحظات المتابعة الثالثة وتحديثها..."
                      value={formData.comment03 || ""}
                      onChange={(e) => setFormData({ ...formData, comment03: e.target.value })}
                    />
                  </div>

                  {/* Sales Note 4 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 block">ملاحظة المتابعة الرابعة (Comment 4):</label>
                    <textarea
                      className="w-full h-16 rounded-xl border border-white/[0.08] bg-[#0c1322] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                      placeholder="اكتب هنا ملاحظات المتابعة الرابعة وتحديثها..."
                      value={formData.comment04 || ""}
                      onChange={(e) => setFormData({ ...formData, comment04: e.target.value })}
                    />
                  </div>

                  {/* Sales Note 5 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 block">ملاحظة المتابعة الخامسة (Comment 5):</label>
                    <textarea
                      className="w-full h-16 rounded-xl border border-white/[0.08] bg-[#0c1322] text-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                      placeholder="اكتب هنا ملاحظات المتابعة الخامسة وتحديثها..."
                      value={formData.comment05 || ""}
                      onChange={(e) => setFormData({ ...formData, comment05: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons footer */}
          <div className="pt-4 border-t border-white/[0.05] flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditOpen(false)}
              className="h-12 px-6 rounded-2xl text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="h-12 px-8 rounded-2xl text-xs font-black bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 shadow-brand text-slate-950"
            >
              <Save size={14} className="ml-1 inline" />
              <span>حفظ وتحديث بيانات المتابعة</span>
            </Button>
          </div>
        </form>
      </Drawer>


      {/* Beautiful Centered Glassmorphic Modal with Auto-Save draft for registering new client */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop blur layer */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => setIsAddClientOpen(false)} 
          />
          
          {/* Main Glassmorphic modal structure */}
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto glass-panel-heavy border border-white/15 shadow-2s bg-slate-900/75 backdrop-blur-3xl rounded-3xl p-6 md:p-8 animate-in zoom-in-95 duration-200 text-right select-text custom-scrollbar flex flex-col" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-450 via-[#8b5cf6] to-[#ec4899] rounded-t-3xl" />
            
            {/* Header section with status Indicators */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-[#8b5cf6] flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/10">
                  <Plus size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight">تسجيل ملف عميل جديد وإضافة سجل</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-extrabold mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>مسودة محفوظة تلقائياً ومأمنة في جهازك 💾</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsAddClientOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors bg-white/5 rounded-xl active:scale-95 duration-150"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="space-y-6">
              <div className="bg-slate-950/40 p-4 border border-white/[0.05] rounded-2x backdrop-blur-md flex items-start gap-3">
                <Info className="text-sky-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1 w-full">
                  <span className="text-xs font-black text-white block font-sans">تسجيل عميل مبيعات جديد</span>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed font-sans mb-3">
                    يرجى ملء الحقول المطلوبة لإنشاء ملف عميل جديد بالكامل في قاعدة البيانات الموحدة ومزانتها لحظياً فوراً.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFillDemoData}
                    className="h-10 px-4 rounded-xl text-[11px] font-black bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20"
                  >
                      🚀 تعبئة بيانات عميل تجريبي (Demo Data)
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Customer Name */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">اسم العميل الكامل (اسم العميل) *</label>
                  <Input
                    dark
                    type="text"
                    placeholder="اكتب اسم العميل الكامل..."
                    value={regClientName}
                    onChange={(e) => setRegClientName(e.target.value)}
                  />
                </div>

                {/* 2. Phone Number */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">رقم الجوال الفعال (مثال: 9665xxxxxxxx) *</label>
                  <Input
                    dark
                    type="text"
                    placeholder="رقم جوال العميل مع رمز الدولة..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="font-mono text-xs text-right"
                  />
                </div>

                {/* 3. Lead Status */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">حالة العميل المحتمل</label>
                  <Select
                    dark
                    value={regLeadStatus}
                    onChange={(e) => setRegLeadStatus(e.target.value)}
                    className="text-xs"
                  >
                    <option value="HOT">HOT</option>
                    <option value="WARM">WARM</option>
                    <option value="COLD">COLD</option>
                    <option value="DEAD">DEAD</option>
                  </Select>
                </div>

                {/* 4. Decision Maker */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">صاحب القرار</label>
                  <Select
                    dark
                    value={regDecisionMaker}
                    onChange={(e) => setRegDecisionMaker(e.target.value)}
                    className="text-xs"
                  >
                    <option value="YES">YES</option>
                    <option value="PARTNER">PARTNER</option>
                    <option value="NO">NO</option>
                  </Select>
                </div>

                {/* 5. Niche */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">المجال / قطاع النشاط</label>
                  <Select
                    dark
                    value={regField}
                    onChange={(e) => setRegField(e.target.value)}
                    className="text-xs"
                  >
                    <option value="">اختر المجال...</option>
                    {(formConfig.fieldsOptions || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>

                {/* 6. Package */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">الباقة المقترحة / المختارة</label>
                  <Select
                    dark
                    value={regPackage}
                    onChange={(e) => setRegPackage(e.target.value)}
                    className="text-xs"
                  >
                    <option value="360">360</option>
                    <option value="مدار">مدار</option>
                    <option value="مدار حملات اعلانية">مدار حملات اعلانية</option>
                    <option value="مدار سيو">مدار سيو</option>
                  </Select>
                </div>

                {/* 7. Amount */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">قيمة الصفقة الإجمالية (Amount)</label>
                  <Input
                    dark
                    type="number"
                    placeholder="مثال: 7500"
                    value={regAmount}
                    onChange={(e) => setRegAmount(e.target.value)}
                    className="font-mono text-sm font-bold text-amber-400"
                  />
                </div>

                {/* 8. SALES COMMENT */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">ملاحظات المكالمة الأولى (SALES COMMENT)</label>
                  <textarea
                    className="w-full h-16 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                    placeholder="تفاصيل تواصل مكالمة الليد وتطلعاته..."
                    value={regSalesComment}
                    onChange={(e) => setRegSalesComment(e.target.value)}
                  />
                </div>

                {/* 9. COMMENT02 */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-400 font-sans">ملاحظة المتابعة الثانية (COMMENT02)</label>
                  <textarea
                    className="w-full h-14 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                    placeholder="المتابعة الثانية..."
                    value={regComment02}
                    onChange={(e) => setRegComment02(e.target.value)}
                  />
                </div>

                {/* 10. COMMENT03 */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-400 font-sans">ملاحظة المتابعة الثالثة (COMMENT03)</label>
                  <textarea
                    className="w-full h-14 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
                    placeholder="المتابعة الثالثة..."
                    value={regComment03}
                    onChange={(e) => setRegComment03(e.target.value)}
                  />
                </div>

                {/* 11. Date Follow */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">تاريخ المتابعة القادمة (Date Follow)</label>
                  <Input
                    dark
                    type="date"
                    value={regDateFollow}
                    onChange={(e) => setRegDateFollow(e.target.value)}
                    className="text-xs font-sans"
                  />
                </div>

                {/* 12. Invoice & Contract Links */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">رابط الفاتورة والعقد المرفوعة (Invoice & Contract)</label>
                  <Input
                    dark
                    type="text"
                    placeholder="رابط مستند الاتفاقية / الفاتورة..."
                    value={regInvoiceContract}
                    onChange={(e) => setRegInvoiceContract(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                {/* 13. PAID */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">تم الدفع (PAID)؟</label>
                  <Select
                    dark
                    value={regPaid}
                    onChange={(e) => setRegPaid(e.target.value)}
                    className="text-xs font-sans"
                  >
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </Select>
                </div>

                {/* 14. Date Pay */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-300 font-sans">تاريخ السداد (Date Pay)</label>
                  <Input
                    dark
                    type="date"
                    value={regDatePay}
                    onChange={(e) => setRegDatePay(e.target.value)}
                    className="text-xs font-sans"
                  />
                </div>
              </div>

              {/* Footer buttons / Interactive Discard Draft */}
              <div className="pt-5 border-t border-white/10 flex flex-wrap gap-3 justify-between items-center mt-8">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من رغبتك في مسح كافة الحقول الحالية وبدء مسودة فارغة؟")) {
                      setRegClientName("");
                      setRegPhone("");
                      setRegLeadStatus("HOT");
                      setRegDecisionMaker("YES");
                      setRegField("");
                      setRegPackage("");
                      setRegAmount("");
                      setRegSalesComment("");
                      setRegComment02("");
                      setRegComment03("");
                      setRegDateFollow("");
                      setRegInvoiceContract("");
                      setRegPaid("NO");
                      setRegDatePay("");
                      localStorage.removeItem("sales_agent_add_client_draft");
                      showFeedback("🧹 تم تفريغ النموذج وحذف المسودة بنجاح!");
                    }
                  }}
                  className="h-11 px-4 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>تصفير النموذج</span>
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAddClientOpen(false)}
                    className="h-11 px-5 rounded-xl text-xs font-bold"
                  >
                    إلغاء التصفح
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 px-7 rounded-xl text-xs font-black bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/10 text-slate-950 flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>حفظ وإضافة العميل الجديد</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Glassmorphic Modal for viewing all client details completely */}
      {isDetailsOpen && selectedDetailsLead && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => {
              setIsDetailsOpen(false);
              setSelectedDetailsLead(null);
            }} 
          />
          
          <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto glass-panel-heavy border border-white/15 shadow-2xl bg-slate-900/75 backdrop-blur-3xl rounded-3xl p-6 md:p-8 animate-in zoom-in-95 duration-200 text-right select-text custom-scrollbar flex flex-col" dir="rtl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-rose-500 rounded-t-3xl" />
            
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00AEEF] to-indigo-500 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/10">
                  <Eye size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight">الملف التفاصيلي الكامل للعميل</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    الرمز التعريفي: <span className="font-mono text-indigo-400">{selectedDetailsLead.clientCode || selectedDetailsLead.id?.slice(0, 8)}</span>
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedDetailsLead(null);
                }}
                className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Elegant Tab Selectors */}
            <div className="flex border border-white/10 mb-6 p-1 bg-slate-950/60 rounded-2xl max-w-lg w-full self-start">
              <button
                type="button"
                onClick={() => setDetailsTab("telesales")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer",
                  detailsTab === "telesales"
                    ? "bg-[#00AEEF] text-slate-950 shadow-md shadow-sky-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <PhoneCall size={14} />
                <span>البيانات الواردة من قسم التيلي سيلز</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab("sales")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer",
                  detailsTab === "sales"
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Target size={14} />
                <span>البيانات الخاصة بقسم المبيعات (Sales)</span>
              </button>
            </div>

            {/* Conditionally render sections depending on selected tab */}
            {detailsTab === "telesales" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 text-slate-200">
                {/* Section 1: الهوية الأساسية والاتصال */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/[0.04] space-y-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-[#00AEEF] border-b border-white/[0.05] pb-2 flex items-center gap-1.5">
                      <User size={14} />
                      <span>البيانات التعريفية والاتصال الأساسية للعميل</span>
                    </h4>
                    
                    <div className="space-y-3 text-xs mt-3">
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">اسم العميل:</span>
                        <span className="font-extrabold text-white">{selectedDetailsLead.clientName}</span>
                      </div>
                      
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">رقم الجوال:</span>
                        <span className="font-mono font-bold text-indigo-300" dir="ltr">{selectedDetailsLead.phone}</span>
                      </div>

                      {selectedDetailsLead.additionalPhone && (
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                          <span className="text-slate-400">رقم جوال إضافي:</span>
                          <span className="font-mono font-bold text-slate-300" dir="ltr">{selectedDetailsLead.additionalPhone}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">المجال / النشاط:</span>
                        <span className="font-bold text-slate-200">{selectedDetailsLead.field || "غير محدد"}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">نوع العمل:</span>
                        <span className="font-bold text-slate-200">{selectedDetailsLead.businessType || "غير محدد"}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">مصدر العميل المعتمد:</span>
                        <span className="font-bold text-sky-400">{selectedDetailsLead.dataSource || "غير محدد"}</span>
                      </div>

                      {selectedDetailsLead.storeLink && (
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                          <span className="text-slate-400">رابط المتجر الأساسي:</span>
                          <a 
                            href={selectedDetailsLead.storeLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#00AEEF] hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>زيارة الرابط</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}

                      {selectedDetailsLead.additionalStore && (
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                          <span className="text-slate-400">متجر إضافي/موقع:</span>
                          <a 
                            href={selectedDetailsLead.additionalStore} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>زيارة الرابط</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}

                      {selectedDetailsLead.socialLink && (
                        <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                          <span className="text-slate-400">حسابات التواصل الاجتماعي:</span>
                          <a 
                            href={selectedDetailsLead.socialLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>زيارة الرابط</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-[#00AEEF]/5 border border-[#00AEEF]/10 p-3.5 rounded-xl text-right">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">وكيل التيلي سيلز المحيل (المسؤول):</span>
                    <span className="text-xs font-black text-sky-300">
                      {(() => {
                        let teleAgentName = selectedDetailsLead.telesalesAgentName || "";
                        if (!teleAgentName) {
                          const noteStr = selectedDetailsLead.note || "";
                          const match1 = noteStr.match(/\[تم التحويل من تلي سيلز بمستوى الإدارة - موظف تيلي:\s*([^\]\n]+)\]/);
                          if (match1) {
                            teleAgentName = match1[1].trim();
                          } else {
                            const match2 = noteStr.match(/\[تم التحويل من تلي سيلز - موظف\s*([^\]\n]+)\]/);
                            if (match2) teleAgentName = match2[1].trim();
                          }
                        }
                        return teleAgentName || "بمستوى الإدارة / غير محدد";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Section 2: تفاصيل الميتنج والتوجيه المبدئي للتيلي سيلز */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/[0.04] space-y-4 shadow-sm text-right">
                  <h4 className="text-xs font-black text-indigo-400 border-b border-white/[0.05] pb-2 flex items-center gap-1.5">
                    <Calendar size={14} />
                    <span>سجل الاجتماعات المنسقة (Meetings) والتواصل التأسيسي</span>
                  </h4>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">موعد وتاريخ الاجتماع المحجوز:</span>
                      <span className="font-mono text-slate-200 font-bold bg-white/5 px-2.5 py-1 rounded">{selectedDetailsLead.meetingTime || "غير محدد"}</span>
                    </div>

                    {selectedDetailsLead.meetingLink && (
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">رابط الاجتماع المنسق:</span>
                        <a 
                          href={selectedDetailsLead.meetingLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sky-450 hover:underline flex items-center gap-1 font-mono font-bold"
                        >
                          <span>رابط الغرفة 🌐</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">تاريخ أول تواصل للتيلي سيلز:</span>
                      <span className="font-mono text-slate-300">{selectedDetailsLead.firstContactDate || "غير مسجل"}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">طريقة التواصل التأسيسية:</span>
                      <span className="font-bold text-slate-200">{selectedDetailsLead.contactType || "غير مسجل"}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">الرد المبدئي والنتائج الأولية:</span>
                      <span className="font-bold text-sky-300">{selectedDetailsLead.firstContactOutcome || selectedDetailsLead.response || "لا يوجد"}</span>
                    </div>
                  </div>

                  {selectedDetailsLead.telesalesBrief && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] text-amber-300 font-extrabold block">📝 خلاصة وتوجيهات مسؤول التيلي سيلز (Telesales Brief):</span>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-white/[0.01] whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar font-medium">
                        {selectedDetailsLead.telesalesBrief}
                      </p>
                    </div>
                  )}

                  {selectedDetailsLead.whatsappMessageText && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-extrabold block">💬 نص رسالة الواتساب التأسيسية المرسلة:</span>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-white/[0.01] font-sans max-h-24 overflow-y-auto custom-scrollbar font-mono">
                        {selectedDetailsLead.whatsappMessageText}
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        handleEditClick(selectedDetailsLead);
                        setIsDetailsOpen(false);
                      }}
                      className="w-full h-10 px-4 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/15 text-amber-300 font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm font-sans"
                    >
                      <Edit3 size={12} />
                      <span>تعديل ومتابعة الملف الوارد من التيلي سيلز ⚙</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 text-slate-200">
                {/* Section 1: تصنيف العميل والمستحقات والمالية */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/[0.04] space-y-4 shadow-sm">
                  <h4 className="text-xs font-black text-emerald-400 border-b border-white/[0.05] pb-2 flex items-center gap-1.5">
                    <DollarSign size={14} />
                    <span>حالة العميل والصفقة والمالية (Sales Data)</span>
                  </h4>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">حالة وتصنيف العميل الحالية (Status):</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-md font-black text-[10px]",
                        selectedDetailsLead.leadStatus === "HOT" && "bg-red-500/10 text-red-400 border border-red-500/20",
                        selectedDetailsLead.leadStatus === "WARM" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                        selectedDetailsLead.leadStatus === "COLD" && "bg-sky-500/10 text-sky-400 border border-sky-500/20",
                        selectedDetailsLead.leadStatus === "DEAD" && "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      )}>
                        {selectedDetailsLead.leadStatus || "HOT"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">الباقة المقررة:</span>
                      <span className="font-extrabold text-[#00AEEF]">{selectedDetailsLead.package || "غير محدد"}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">صاحب القرار:</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded font-bold text-[10px]",
                        selectedDetailsLead.decisionMaker === "YES" && "bg-emerald-500/10 text-emerald-400",
                        selectedDetailsLead.decisionMaker === "PARTNER" && "bg-indigo-500/10 text-indigo-400",
                        selectedDetailsLead.decisionMaker === "NO" && "bg-rose-500/10 text-rose-450"
                      )}>
                        {selectedDetailsLead.decisionMaker === "YES" ? "نعم" : selectedDetailsLead.decisionMaker === "PARTNER" ? "شريك" : "لا"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">قيمة الصفقة الإجمالية:</span>
                      <span className="font-mono font-black text-amber-450 text-sm">{(selectedDetailsLead.amount || selectedDetailsLead.contractAmount || 0).toLocaleString()} ر.س</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="text-slate-400">حالة السداد والتحصيل:</span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-md font-black text-[10px]",
                        selectedDetailsLead.paid === "YES" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                      )}>
                        {selectedDetailsLead.paid === "YES" ? "تم السداد ✓" : "معلق"}
                      </span>
                    </div>

                    {selectedDetailsLead.datePay && (
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">تاريخ السداد:</span>
                        <span className="font-mono text-slate-300">{selectedDetailsLead.datePay}</span>
                      </div>
                    )}

                    {selectedDetailsLead.invoiceContract && (
                      <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                        <span className="text-slate-400">الفاتورة والعقد المرفق:</span>
                        <a 
                          href={selectedDetailsLead.invoiceContract} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-amber-450 hover:underline flex items-center gap-1 font-mono text-[11px] font-bold"
                        >
                          <span>تصفح العقد والفاتورة 📄</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 bg-slate-900/40 p-4 rounded-xl border border-white/[0.02] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">مسؤول المبيعات المتابع:</span>
                      <span className="text-indigo-400 font-black">{selectedDetailsLead.agentName || "غير محدد"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">تاريخ تسجيل العميل بالسيستم:</span>
                      <span className="font-mono text-slate-300">{selectedDetailsLead.date || selectedDetailsLead.createdAt?.slice(0, 10)}</span>
                    </div>
                    {selectedDetailsLead.updatedAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">تاريخ آخر تحديث للملف:</span>
                        <span className="font-mono text-slate-450">{selectedDetailsLead.updatedAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: المتابعة والاتصالات والملاحظات التفصيلية للمبيعات */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/[0.04] space-y-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-amber-400 border-b border-white/[0.05] pb-2 flex items-center gap-1.5">
                      <FileText size={14} />
                      <span>سجل متابعات واتصالات مسؤول المبيعات (Sales Agent logs)</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-3 text-xs mt-3">
                      <div className="bg-slate-900/30 p-3 rounded-xl border border-white/[0.02] space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold block">ملاحظات المكالمة 1 (SALES COMMENT):</span>
                        <p className="text-slate-100 font-medium leading-relaxed bg-slate-950/20 p-2.5 rounded-lg border border-white/[0.01]">
                          {selectedDetailsLead.salesComment || cleanTelesalesPrefix(selectedDetailsLead.note || "") || "لا يوجد ملاحظات مسجلة للمكالمة الأولى"}
                        </p>
                      </div>

                      <div className="bg-slate-900/30 p-3 rounded-xl border border-white/[0.02] space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold block">ملاحظات المكالمة 2 (COMMENT02):</span>
                        <p className="text-slate-100 font-medium leading-relaxed bg-slate-950/20 p-2.5 rounded-lg border border-white/[0.01]">
                          {selectedDetailsLead.comment02 || "لا يوجد ملاحظات مسجلة للمكالمة الثانية"}
                        </p>
                      </div>

                      <div className="bg-slate-900/30 p-3 rounded-xl border border-white/[0.02] space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold block">ملاحظات المكالمة 3 (COMMENT03):</span>
                        <p className="text-slate-100 font-medium leading-relaxed bg-slate-950/20 p-2.5 rounded-lg border border-white/[0.01]">
                          {selectedDetailsLead.comment03 || "لا يوجد ملاحظات مسجلة للمكالمة الثالثة"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="bg-slate-900/30 p-3 rounded-xl border border-white/[0.02] flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">تاريخ المتابعة المجدول القادم:</span>
                      <span className="font-mono text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded">{selectedDetailsLead.dateFollow || "لم يقرر بعد"}</span>
                    </div>

                    {selectedDetailsLead.note && (
                      <div className="bg-slate-900/30 p-3 rounded-xl border border-white/[0.02] space-y-1 text-xs">
                        <span className="text-[10px] text-slate-400 font-extrabold block">الملاحظات التأسيسية الإضافية (Note):</span>
                        <p className="text-slate-300 leading-relaxed bg-slate-950/45 p-2 rounded border border-white/[0.01] max-h-20 overflow-y-auto custom-scrollbar">
                          {selectedDetailsLead.note}
                        </p>
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={() => {
                          handleEditClick(selectedDetailsLead);
                          setIsDetailsOpen(false);
                        }}
                        className="w-full h-10 px-4 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/15 text-indigo-400 font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm font-sans"
                      >
                        <Edit3 size={12} />
                        <span>تعديل وتحديث بيانات المبيعات لهذا الملف ⚙</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer containing action buttons */}
            <div className="flex justify-between items-center pt-5 mt-6 border-t border-white/10 flex-wrap gap-4">
              <span className="text-[10px] text-slate-500 font-bold">
                عرض مباشر للبيانات • مجموعة MADAR Blue للتجارة والحلول البرمجية المتكاملة
              </span>
              
              <div className="flex gap-2">
                {detailsTab === "telesales" ? (
                  <Button
                    type="button"
                    onClick={() => {
                      handleEditClick(selectedDetailsLead);
                      setIsDetailsOpen(false);
                    }}
                    className="h-10 px-4 text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 font-black rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>تعديل ومتابعة هذا الملف ⚙</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      handleEditClick(selectedDetailsLead);
                      setIsDetailsOpen(false);
                    }}
                    className="h-10 px-4 text-xs bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-400 font-black rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>تعديل وتحديث بيانات المبيعات ⚙</span>
                  </Button>
                )}
                
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setSelectedDetailsLead(null);
                  }}
                  className="h-10 px-5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق النافذة
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};