import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useSettings } from "@/src/hooks/useSettings";
import { db } from "@/src/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { Bell, UserCheck, Settings, X, Check, DollarSign, Calendar, Users, AlertCircle, Sparkles } from "lucide-react";

interface NotificationCenterProps {
  setActiveTab?: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Firestore Real-Time Leads States
  const [telesalesLeads, setTelesalesLeads] = useState<any[]>([]);
  const [salesLeads, setSalesLeads] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch Users (Only for master admin)
  useEffect(() => {
    if (user?.email?.toLowerCase().trim() !== "abdelrahmanahmed011147@gmail.com") {
      return;
    }
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      setAllUsers(list);
    }, (err) => {
      const msg = err?.message || (err as any)?.error || String(err);
      const isQuotaOrOffline = msg.includes("Quota exceeded") || msg.includes("quota") || err?.code === "resource-exhausted" || msg.includes("offline") || msg.includes("unavailable");
      if (isQuotaOrOffline) {
        console.warn("NotificationCenter user listener warning (handled):", err);
      } else {
        console.error("NotificationCenter error getting users:", err);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Fetch Telesales Leads
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "telesales_leads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTelesalesLeads(list);
      setIsInitialized(true);
    }, (err) => {
      const msg = err?.message || (err as any)?.error || String(err);
      const isQuotaOrOffline = msg.includes("Quota exceeded") || msg.includes("quota") || err?.code === "resource-exhausted" || msg.includes("offline") || msg.includes("unavailable");
      if (isQuotaOrOffline) {
        console.warn("NotificationCenter telesales listener warning (handled):", err);
      } else {
        console.error("Error loading telesales leads in NotificationCenter:", err);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Fetch Sales Leads
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sales_leads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSalesLeads(list);
      setIsInitialized(true);
    }, (err) => {
      const msg = err?.message || (err as any)?.error || String(err);
      const isQuotaOrOffline = msg.includes("Quota exceeded") || msg.includes("quota") || err?.code === "resource-exhausted" || msg.includes("offline") || msg.includes("unavailable");
      if (isQuotaOrOffline) {
        console.warn("NotificationCenter sales listener warning (handled):", err);
      } else {
        console.error("Error loading sales leads in NotificationCenter:", err);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Retrieve role info
  const { memberInfo, isAdmin, isTelesalesManager, isSalesManager } = useMemo(() => {
    if (!user || !settings.teamSettings) {
      return { memberInfo: null, isAdmin: false, isTelesalesManager: false, isSalesManager: false };
    }
    const allTeams = Object.values(settings.teamSettings).filter(Array.isArray).flat() as any[];
    const matchingMembers = allTeams.filter(m => m.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    const member = matchingMembers.length > 0
      ? [...matchingMembers].sort((a, b) => String(b.id || "").localeCompare(String(a.id || "")))[0]
      : null;
    const isMasterAdmin = user.email?.toLowerCase().trim() === "abdelrahmanahmed011147@gmail.com";
    const adminRole = member?.role === "Admin" || isMasterAdmin;
    
    // Check if they are a manager of either department by allowed pages
    const allowedPages = member?.allowedPages ? [...member.allowedPages] : [];
    const isTelesalesManager = adminRole || allowedPages.includes("telesales");
    const isSalesManager = adminRole || allowedPages.includes("sales_hub");
    
    return { memberInfo: member, isAdmin: adminRole, isTelesalesManager, isSalesManager };
  }, [user, settings.teamSettings]);

  const currentAgentName = useMemo(() => {
    return memberInfo?.name || user?.displayName || user?.email?.split("@")[0] || "";
  }, [memberInfo, user]);

  // Acknowledged Sales Leads from LocalStorage
  const [acknowledgedLeads, setAcknowledgedLeads] = useState<string[]>(() => {
    try {
      const persisted = localStorage.getItem("acknowledged_leads_sales");
      return persisted ? JSON.parse(persisted) : [];
    } catch {
      return [];
    }
  });

  // Seen Telesales Leads from LocalStorage (for Admin/Manager unassigned alerts)
  const [seenTelesalesLeads, setSeenTelesalesLeads] = useState<string[]>(() => {
    try {
      const persisted = localStorage.getItem("seen_telesales_leads");
      return persisted ? JSON.parse(persisted) : [];
    } catch {
      return [];
    }
  });

  // Sync acknowledged leads from localStorage in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const persisted = localStorage.getItem("acknowledged_leads_sales");
        if (persisted) {
          setAcknowledgedLeads(JSON.parse(persisted));
        }
      } catch (err) {
        console.error("Error updating local storage in notify center:", err);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("acknowledgedLeadsUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("acknowledgedLeadsUpdated", handleStorageChange);
    };
  }, []);

  // Sync seen telesales leads from localStorage in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const persisted = localStorage.getItem("seen_telesales_leads");
        if (persisted) {
          setSeenTelesalesLeads(JSON.parse(persisted));
        }
      } catch (err) {
        console.error("Error updating seen telesales local storage:", err);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("seenTelesalesLeadsUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("seenTelesalesLeadsUpdated", handleStorageChange);
    };
  }, []);

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
      osc2.frequency.setValueAtTime(783.99, now + 0.15);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (err) {
      console.warn("Could not play notification sound:", err);
    }
  };

  // Compile individual notifications lists
  const pendingUsers = useMemo(() => {
    if (user?.email?.toLowerCase().trim() !== "abdelrahmanahmed011147@gmail.com") return [];
    
    const registeredEmails = new Set();
    const currentTeamSettings = settings.teamSettings || {};
    
    Object.keys(currentTeamSettings).forEach(key => {
      const team = currentTeamSettings[key];
      if (Array.isArray(team)) {
        team.forEach(m => {
          if (m && m.email) {
            registeredEmails.add(m.email.toLowerCase().trim());
          }
        });
      }
    });

    return allUsers.filter(u => {
      if (!u.email) return false;
      const emailLower = u.email.toLowerCase().trim();
      if (emailLower === "abdelrahmanahmed011147@gmail.com") return false;
      return !registeredEmails.has(emailLower);
    });
  }, [allUsers, settings.teamSettings, user]);

  const telesalesUnread = useMemo(() => {
    const list: Array<{
      id: string;
      leadId: string;
      clientName: string;
      text: string;
      date: string;
      type: "meeting_done" | "contracted";
      fieldKey: "salesNotification" | "contractNotification";
    }> = [];

    // Only filter for own assigned telesales leads
    const filtered = telesalesLeads.filter(l => l.agentName === currentAgentName && l.isSystemDeleted !== true);

    filtered.forEach(l => {
      if (l.salesNotification && !l.salesNotification.read) {
        list.push({
          id: `${l.id}-meeting`,
          leadId: l.id,
          clientName: l.clientName || "",
          text: l.salesNotification.text,
          date: l.salesNotification.date || new Date().toISOString(),
          type: "meeting_done",
          fieldKey: "salesNotification"
        });
      }
      if (l.contractNotification && !l.contractNotification.read) {
        list.push({
          id: `${l.id}-contract`,
          leadId: l.id,
          clientName: l.clientName || "",
          text: l.contractNotification.text,
          date: l.contractNotification.date || new Date().toISOString(),
          type: "contracted",
          fieldKey: "contractNotification"
        });
      }
    });

    return list;
  }, [telesalesLeads, currentAgentName]);

  const salesUnreadTelesalesUpdates = useMemo(() => {
    const list: Array<{
      id: string;
      leadId: string;
      clientName: string;
      text: string;
      date: string;
      type: "telesales_update";
      fieldKey: "telesalesNotification";
    }> = [];

    // Filter leads assigned to this agent where they are not deleted
    const filtered = salesLeads.filter(l => l.agentName === currentAgentName && l.isSystemDeleted !== true);

    filtered.forEach(l => {
      if (l.telesalesNotification && !l.telesalesNotification.read) {
        list.push({
          id: `${l.id}-telesales-update`,
          leadId: l.id,
          clientName: l.clientName || "",
          text: l.telesalesNotification.text,
          date: l.telesalesNotification.date || l.updatedAt || new Date().toISOString(),
          type: "telesales_update",
          fieldKey: "telesalesNotification"
        });
      }
    });

    return list;
  }, [salesLeads, currentAgentName]);

  const salesUnacknowledged = useMemo(() => {
    const list: Array<{
      id: string;
      leadId: string;
      clientName: string;
      text: string;
      date: string;
      type: "new_meeting" | "new_general";
    }> = [];

    // Filter leads assigned to this agent where they are not deleted
    const filtered = salesLeads.filter(l => l.agentName === currentAgentName && l.isSystemDeleted !== true);

    filtered.forEach(l => {
      if (l.id && !acknowledgedLeads.includes(l.id)) {
        const isFromTelesales = !!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)";
        if (isFromTelesales) {
          list.push({
            id: `${l.id}-assigned-meeting`,
            leadId: l.id,
            clientName: l.clientName || "",
            text: `تم توجيه اجتماع جديد لك بخصوص العميل (${l.clientName || "غير محدد"}) - يرجى المباشرة والمتابعة 🤝`,
            date: l.createdAt || l.updatedAt || new Date().toISOString(),
            type: "new_meeting"
          });
        } else {
          list.push({
            id: `${l.id}-assigned-general`,
            leadId: l.id,
            clientName: l.clientName || "",
            text: `تم تعيين ليد مبيعات مباشر جديد لك: العميل (${l.clientName || "غير محدد"}) 🎯`,
            date: l.createdAt || l.updatedAt || new Date().toISOString(),
            type: "new_general"
          });
        }
      }
    });

    return list;
  }, [salesLeads, currentAgentName, acknowledgedLeads]);

  // Compile unassigned Telesales leads alerts for Admin/Manager
  const unassignedTelesalesAlerts = useMemo(() => {
    if (!isAdmin && !isSalesManager && !isTelesalesManager) return [];

    const unassigned = salesLeads.filter(l => 
      !l.isSystemDeleted && 
      (!!l.telesalesLeadId || l.dataSource === "من التيلي سيلز (محول)") &&
      (!l.agentName || l.agentName.trim() === "" || l.agentName === "-- تحديد فريق المبيعات --" || l.agentName === "—")
    );

    const unreadUnassigned = unassigned.filter(l => l.id && !seenTelesalesLeads.includes(l.id));

    return unreadUnassigned.map(l => ({
      id: `${l.id}-unassigned-telesales`,
      leadId: l.id,
      title: "لقاء ميتنج تيلي سيلز جديد 🔔",
      text: `عميل تيلي سيلز جديد محول بانتظار الاعتماد وتوزيعه على فريق المبيعات: (${l.clientName || "غير محدد"}) 🤝`,
      date: l.createdAt || l.updatedAt || new Date().toISOString(),
      icon: "new_meeting" as const,
      category: "sales_hub" as const
    }));
  }, [salesLeads, isAdmin, isSalesManager, isTelesalesManager, seenTelesalesLeads]);

  // Combined notifications array for rendering
  const activeAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      leadId?: string;
      title: string;
      text: string;
      date: string;
      icon: "pending_user" | "meeting" | "contract" | "new_meeting" | "new_general";
      category: "admin" | "telesales" | "sales" | "sales_hub";
      meta?: any;
    }> = [];

    // 1. Pending Users
    pendingUsers.forEach(u => {
      alerts.push({
        id: `user-${u.uid}`,
        title: "طلب تفعيل حساب موظف",
        text: `الموظف جديد (${u.displayName || u.email.split("@")[0]}) بريده: ${u.email} يطلب التنشيط والصلاحيات.`,
        date: new Date().toISOString(),
        icon: "pending_user",
        category: "admin",
        meta: { uid: u.uid, email: u.email }
      });
    });

    // 2. Telesales alerts (meetings/contracts)
    telesalesUnread.forEach(t => {
      alerts.push({
        id: t.id,
        leadId: t.leadId,
        title: t.type === "meeting_done" ? "تأكيد عقد الاجتماع" : "إتمام التعاقد الشامل",
        text: t.text,
        date: t.date,
        icon: t.type === "meeting_done" ? "meeting" : "contract",
        category: "telesales",
        meta: { fieldKey: t.fieldKey }
      });
    });

    // 3. Sales Agent alerts (assigned leads)
    salesUnacknowledged.forEach(s => {
      alerts.push({
        id: s.id,
        leadId: s.leadId,
        title: s.type === "new_meeting" ? "تحويل اجتماع وارد" : "ليد مبيعات مباشر جديد",
        text: s.text,
        date: s.date,
        icon: s.type === "new_meeting" ? "new_meeting" : "new_general",
        category: "sales"
      });
    });

    // 3b. Sales Agent alerts from Telesales Updates
    salesUnreadTelesalesUpdates.forEach(su => {
      alerts.push({
        id: su.id,
        leadId: su.leadId,
        title: "تحديث جديد من تلي سيلز 📢",
        text: su.text,
        date: su.date,
        icon: "new_meeting",
        category: "sales",
        meta: { fieldKey: su.fieldKey }
      });
    });

    // 4. Unassigned Telesales alerts for Admin / Manager
    unassignedTelesalesAlerts.forEach(u => {
      alerts.push({
        id: u.id,
        leadId: u.leadId,
        title: u.title,
        text: u.text,
        date: u.date,
        icon: u.icon,
        category: u.category
      });
    });

    // Sort all alerts by date descending
    return alerts.sort((a, b) => b.date.localeCompare(a.date));
  }, [pendingUsers, telesalesUnread, salesUnacknowledged, salesUnreadTelesalesUpdates, unassignedTelesalesAlerts]);

  // Keep track of counts for triggering sound
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (isInitialized && activeAlerts.length > lastCountRef.current) {
      playChime();
    }
    lastCountRef.current = activeAlerts.length;
  }, [activeAlerts.length, isInitialized]);

  // Navigate for Master Admin
  const handleNavigateAdmin = () => {
    if (setActiveTab) {
      setActiveTab("settings");
    }
    setIsOpen(false);
  };

  // Actions on Clicking Notification Items
  const handleAlertClick = async (alert: any) => {
    setIsOpen(false);
    
    if (alert.category === "admin") {
      handleNavigateAdmin();
      return;
    }

    if (alert.category === "sales_hub" && alert.leadId) {
      try {
        const persisted = localStorage.getItem("seen_telesales_leads");
        const list = persisted ? JSON.parse(persisted) : [];
        if (!list.includes(alert.leadId)) {
          const updated = [...list, alert.leadId];
          localStorage.setItem("seen_telesales_leads", JSON.stringify(updated));
          setSeenTelesalesLeads(updated);
          window.dispatchEvent(new Event("seenTelesalesLeadsUpdated"));
        }
      } catch (err) {
        console.error("Error setting seen telesales leads:", err);
      }

      if (setActiveTab) {
        if (isSalesManager) {
          setActiveTab("sales_hub");
        } else if (isTelesalesManager) {
          setActiveTab("telesales");
        } else {
          setActiveTab("sales_hub");
        }
      }
      return;
    }

    if (alert.category === "telesales" && alert.leadId) {
      // 1. Mark notification as read in database
      try {
        const docRef = doc(db, "telesales_leads", alert.leadId);
        const updateObj: any = {};
        updateObj[`${alert.meta.fieldKey}.read`] = true;
        await updateDoc(docRef, updateObj);
      } catch (err) {
        console.error("Error reading telesales notif:", err);
      }

      // 2. Set preferred tab and dispatch event
      const targetTab = alert.meta?.fieldKey === "contractNotification" ? "contracts" : "contacts";
      localStorage.setItem("telesales_agent_preferred_tab", targetTab);
      window.dispatchEvent(new Event("telesalesAgentTabRedirect"));

      // 3. Clear locally & Switch page
      if (setActiveTab) {
        setActiveTab("telesales_agent");
      }
      return;
    }

    if (alert.category === "sales" && alert.leadId) {
      // 1. If it's a telesales update, mark it as read in firestore
      if (alert.meta?.fieldKey === "telesalesNotification") {
        try {
          const docRef = doc(db, "sales_leads", alert.leadId);
          await updateDoc(docRef, {
            "telesalesNotification.read": true
          });
        } catch (err) {
          console.error("Error reading sales notif:", err);
        }
      }

      // 2. Add to acknowledgedLeads & local storage
      try {
        const persisted = localStorage.getItem("acknowledged_leads_sales");
        const list = persisted ? JSON.parse(persisted) : [];
        if (!list.includes(alert.leadId)) {
          const updated = [...list, alert.leadId];
          localStorage.setItem("acknowledged_leads_sales", JSON.stringify(updated));
          setAcknowledgedLeads(updated);
          window.dispatchEvent(new Event("acknowledgedLeadsUpdated"));
        }
      } catch (err) {
        console.error("Error acknowledging sales lead:", err);
      }

      // 3. Switch page
      if (setActiveTab) {
        setActiveTab("sales_agent");
      }
    }
  };

  // Skip rendering if no access or not initialized
  if (!user) return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] flex items-center justify-center text-slate-300 hover:text-white transition-all duration-300 relative cursor-pointer"
        title="مركز الإشعارات المباشرة للنظام"
      >
        <Bell size={18} className={activeAlerts.length > 0 ? "animate-pulse" : ""} />
        
        {activeAlerts.length > 0 && (
          <>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border border-slate-950 animate-bounce">
              {activeAlerts.length}
            </span>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-60 pointer-events-none" />
          </>
        )}
      </button>

      {/* Styled Dropdown Panel */}
      {isOpen && (
        <div 
          className="absolute left-0 mt-3 w-80 sm:w-96 rounded-2xl bg-[#090d22]/95 backdrop-blur-md border border-white/[0.08] shadow-2xl p-4 text-right z-50 animate-in fade-in slide-in-from-top-3 duration-250"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.05] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#00AEEF] rounded-full animate-pulse" />
              <h5 className="text-xs font-black text-white">مركز التنبيهات المباشر (الرئيسي)</h5>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 py-1">
            {activeAlerts.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-white/[0.02] flex items-center justify-center mx-auto text-slate-500">
                  <Bell size={20} className="opacity-40" />
                </div>
                <p className="text-xs font-bold text-slate-500">لا توجد لديك إشعارات أو تفعيلات جديدة حالياً.</p>
              </div>
            ) : (
              activeAlerts.map((alert) => {
                // Determine icon and color based on category/type
                let iconEl = <Bell size={14} />;
                let iconBg = "bg-slate-500/10 text-slate-400";
                
                if (alert.icon === "pending_user") {
                  iconEl = <UserCheck size={14} />;
                  iconBg = "bg-red-500/10 text-red-400";
                } else if (alert.icon === "meeting") {
                  iconEl = <Sparkles size={14} />;
                  iconBg = "bg-amber-500/10 text-amber-400";
                } else if (alert.icon === "contract") {
                  iconEl = <DollarSign size={14} />;
                  iconBg = "bg-emerald-500/10 text-emerald-400";
                } else if (alert.icon === "new_meeting") {
                  iconEl = <Calendar size={14} />;
                  iconBg = "bg-indigo-500/10 text-indigo-400";
                } else if (alert.icon === "new_general") {
                  iconEl = <Users size={14} />;
                  iconBg = "bg-sky-500/10 text-sky-400";
                }

                return (
                  <div 
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className="p-3 bg-white/[0.01] hover:bg-white/[0.04] border border-white/[0.03] hover:border-white/[0.08] rounded-xl flex items-start gap-2.5 relative overflow-hidden cursor-pointer transition-all duration-200 select-none group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                      {iconEl}
                    </div>
                    <div className="min-w-0 text-right flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black text-slate-200 truncate leading-none">
                          {alert.title}
                        </p>
                        {alert.date && (
                          <span className="text-[9px] text-slate-500 shrink-0">
                            {new Date(alert.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2 line-clamp-2">
                        {alert.text}
                      </p>
                      
                      <div className="flex items-center justify-end gap-1 mt-2 text-[9px] font-black text-[#00AEEF] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>انقر للمراجعة والحل</span>
                        <span className="font-sans">←</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
