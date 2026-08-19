import React, { useState, useMemo, useEffect } from "react";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { 
  PhoneCall, 
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
  MessageSquare, 
  ListFilter, 
  TrendingUp, 
  Target,
  Users, 
  CheckCircle2, 
  FileText, 
  BadgeAlert, 
  Save, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  UserCheck,
  CalendarDays,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Layers,
  Sparkles,
  Flame,
  X
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card, Input, Select, Button, Drawer, Modal } from "@/src/components/UI";
import { useSettings, DEFAULT_TELESALES_FORM } from "@/src/hooks/useSettings";
import { useTelesalesLeads } from "@/src/hooks/useTelesalesLeads";
import { useUserRole } from "@/src/hooks/useUserRole";
import { useAuth } from "@/src/context/AuthContext";
import { TelesalesLead } from "@/src/types";
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

export const TelesalesAgentPage: React.FC = () => {
  const { leads, loading: leadsLoading, addLead, updateLead, deleteLead } = useTelesalesLeads();
  const { settings, loading: settingsLoading } = useSettings();

  const compiledFormConfig = useMemo(() => {
    const raw = settings?.telesalesForm || DEFAULT_TELESALES_FORM;
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
  }, [settings?.telesalesForm]);

  const formConfig = compiledFormConfig;

  // Dynamic list of available Telesales Agents resolved across database structure & registered users
  const availableAgents = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addedNames = new Set<string>();

    if (settings?.teleSalesAgents) {
      settings.teleSalesAgents.forEach((a: any) => {
        const cleanName = a.name ? a.name.trim() : "";
        if (cleanName && !addedNames.has(cleanName)) {
          list.push({ id: a.id || `ts_${cleanName}`, name: cleanName });
          addedNames.add(cleanName);
        }
      });
    }

    if (settings?.teamSettings) {
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
    if (list.length === 0 && settings?.teamSettings) {
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
  }, [settings?.teleSalesAgents, settings?.teamSettings]);

  // Field renderer inside form drawers
  const renderFieldInput = (key: string, field: any) => {
    const getLocalDateString = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const isMeetingDoneOrContracted = formData.isContracted === true || 
                                      formData.paymentStatus === "تم التعاقد" || 
                                      ["تم الميتنج", "تم الاجتماع", "ناجح", "تم بنجاح"].includes(formData.meetingStatus);

    const isFieldLocked = (!!formData.id && !!formData.hasBeenSavedOnce && ["clientName", "phone", "field", "dataSource", "storeLink", "businessType", "date", "note", "agentName"].includes(key)) ||
                          (isMeetingDoneOrContracted && key !== "followupUpdate");

    const renderDateInputWithHelper = (valueKey: string, isRequired: boolean) => {
      const isLocked = (!!formData.id && !!formData.hasBeenSavedOnce && ["clientName", "phone", "field", "dataSource", "storeLink", "businessType", "date", "note", "agentName"].includes(valueKey)) ||
                       isMeetingDoneOrContracted;
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
        <Input
          dark
          disabled
          readOnly
          value={formData.agentName || currentAgentName || ""}
          onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
          className="opacity-60 bg-slate-900 cursor-not-allowed"
        />
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
          disabled={isFieldLocked}
          className={cn(
            "w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50",
            isFieldLocked ? "opacity-60 bg-slate-950 cursor-not-allowed" : ""
          )}
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
      const isLocked = (!!formData.id && !!formData.hasBeenSavedOnce) || isMeetingDoneOrContracted;
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
                            {formData.meetingStatusNote && (
                              <div className="mt-3 text-right bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl animate-in fade-in duration-200">
                                <span className="text-[10px] font-black text-amber-400 block font-sans">📝 ملاحظات السيلز وتفاصيل الحالة الواردة:</span>
                                <p className="text-xs text-slate-200 mt-1.5 whitespace-pre-line leading-relaxed">{formData.meetingStatusNote}</p>
                              </div>
                            )}
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
  const { user } = useAuth();
  const { isAdmin, memberInfo, allowedPages } = useUserRole();
  const isMasterEmail = user?.email?.toLowerCase().trim() === "abdelrahmanahmed011147@gmail.com" || isAdmin;
  // Anyone who manages the Tele Sales department (admin, or a member whose
  // allowedPages includes "telesales" — e.g. a Tele Sales Manager like
  // Nada Nashat) sees the full Tele Sales customer set in their Workspace,
  // not just leads personally assigned to their own name. Mirrors the
  // same fix already applied for the Sales Manager role.
  const canManageTelesalesDept = isAdmin || allowedPages.includes("telesales");

  const [mainViewTab, setMainViewTab] = useState<"analytics" | "contacts" | "contracts">("analytics");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMeetingStatusFilter, setSelectedMeetingStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "pending" | "done">("all");

  // Pagination states
  const [leadsPage, setLeadsPage] = useState(1);
  const [contractsPage, setContractsPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Selected agent identity
  const [currentAgentName, setCurrentAgentName] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<TelesalesLead | null>(null);

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
    meetingStatusNote: "",
    agentName: "",
    distributeToSales: false,
  };

  const [formData, setFormData] = useState<any>(() => {
    try {
      const d = localStorage.getItem("telesales_agent_add_client_draft");
      return d ? JSON.parse(d) : initialFormState;
    } catch {
      return initialFormState;
    }
  });

  // Redirect to contacts or contracts tab if opened from a notification
  useEffect(() => {
    const preferredTab = localStorage.getItem("telesales_agent_preferred_tab");
    if (preferredTab === "contacts" || preferredTab === "contracts") {
      setMainViewTab(preferredTab);
      localStorage.removeItem("telesales_agent_preferred_tab");
    }

    const handleRedirect = () => {
      const pref = localStorage.getItem("telesales_agent_preferred_tab");
      if (pref === "contacts" || pref === "contracts") {
        setMainViewTab(pref);
        localStorage.removeItem("telesales_agent_preferred_tab");
      } else {
        setMainViewTab("contacts");
      }
    };

    window.addEventListener("telesalesAgentTabRedirect", handleRedirect);
    return () => {
      window.removeEventListener("telesalesAgentTabRedirect", handleRedirect);
    };
  }, []);

  // Automatically sync state into draft storage when Add Lead form is open
  useEffect(() => {
    if (isAddOpen) {
      localStorage.setItem("telesales_agent_add_client_draft", JSON.stringify(formData));
    }
  }, [formData, isAddOpen]);

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
    "meetingStatusNote",
    "note",
    "telesalesBrief",
    "whatsappMessageText",
    "additionalPhone",
    "additionalStore"
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

  // Deep Select / Bulk delete & edit states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadToDelete, setLeadToDelete] = useState<TelesalesLead | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({
    response: "",
    meetingStatus: "",
    contactType: "",
    dataSource: "",
    dateFollow: "",
    note: "",
    appendNote: true,
  });
  const [bulkEditToggles, setBulkEditToggles] = useState({
    response: false,
    meetingStatus: false,
    contactType: false,
    dataSource: false,
    dateFollow: false,
    note: false,
  });

  // Excel Import field override presets state
  const [importDefaultDataSource, setImportDefaultDataSource] = useState("");
  const [importDefaultFirstContactDate, setImportDefaultFirstContactDate] = useState("");
  const [importDefaultContactType, setImportDefaultContactType] = useState("");
  const [importDefaultResponse, setImportDefaultResponse] = useState("");
  const [importDefaultMeetingStatus, setImportDefaultMeetingStatus] = useState("");
  const [importDefaultNote, setImportDefaultNote] = useState("");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(paginatedLeads.map((l: any) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(prev => [...prev, leadId]);
    } else {
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
    }
  };

  const handleBulkDelete = async () => {
    if (!isMasterEmail) {
      alert("عذراً، لا تمتلك صلاحية حذف العملاء. خاصية الحذف مخصصة للمسؤول الماستر فقط.");
      return;
    }
    if (selectedLeadIds.length === 0) return;
    try {
      setIsExcelImporting(true);
      for (const id of selectedLeadIds) {
        await deleteLead(id);
      }
      setSelectedLeadIds([]);
      showFeedback("تم حذف العملاء المحددين بنجاح! 🗑️");
    } catch (err) {
      console.error(err);
      showFeedback("حدث خطأ أثناء حذف بعض السجلات.");
    } finally {
      setIsExcelImporting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeadIds.length === 0) return;
    
    const anyFieldSelected = Object.values(bulkEditToggles).some(v => v);
    if (!anyFieldSelected) {
      alert("الرجاء تفعيل حقل واحد على الأقل للتعديل الجماعي.");
      return;
    }

    try {
      setIsExcelImporting(true);
      
      for (const id of selectedLeadIds) {
        const lead = leads.find(l => l.id === id);
        if (!lead) continue;

        const updateData: any = {};
        
        if (bulkEditToggles.response) {
          updateData.response = bulkEditFields.response;
        }
        if (bulkEditToggles.meetingStatus) {
          updateData.meetingStatus = bulkEditFields.meetingStatus;
        }
        if (bulkEditToggles.contactType) {
          updateData.contactType = bulkEditFields.contactType;
        }
        if (bulkEditToggles.dataSource) {
          updateData.dataSource = bulkEditFields.dataSource;
        }
        if (bulkEditToggles.dateFollow) {
          updateData.dateFollow = bulkEditFields.dateFollow;
        }
        if (bulkEditToggles.note) {
          if (bulkEditFields.appendNote) {
            updateData.note = lead.note 
              ? `${lead.note}\n[تحديث جماعي - ${new Date().toLocaleDateString("ar-EG")}]: ${bulkEditFields.note}`
              : bulkEditFields.note;
          } else {
            updateData.note = bulkEditFields.note;
          }
        }

        await updateLead(id, updateData);
      }

      showFeedback(`تم بنجاح تعديل ومزامنة بيانات ${selectedLeadIds.length} عميل محدد! 🚀`);
      setSelectedLeadIds([]);
      setIsBulkEditOpen(false);
      
      // Reset bulk form
      setBulkEditFields({
        response: "",
        meetingStatus: "",
        contactType: "",
        dataSource: "",
        dateFollow: "",
        note: "",
        appendNote: true,
      });
      setBulkEditToggles({
        response: false,
        meetingStatus: false,
        contactType: false,
        dataSource: false,
        dateFollow: false,
        note: false,
      });
    } catch (err) {
      console.error(err);
      showFeedback("حدث خطأ أثناء التعديل الجماعي.");
    } finally {
      setIsExcelImporting(false);
    }
  };

  const handleSingleDelete = async () => {
    if (!leadToDelete) return;
    if (!isMasterEmail) {
      alert("عذراً، لا تمتلك صلاحية حذف العملاء. خاصية الحذف مخصصة للمسؤول الماستر فقط.");
      return;
    }
    try {
      await deleteLead(leadToDelete.id);
      setSelectedLeadIds(prev => prev.filter(id => id !== leadToDelete.id));
      showFeedback(`تم حذف العميل "${leadToDelete.clientName}" بنجاح! 🗑️`);
    } catch (err) {
      console.error(err);
      showFeedback("حدث خطأ أثناء حذف السجل.");
    } finally {
      setLeadToDelete(null);
    }
  };

  // Excel Import states & references
  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [excelImportSummary, setExcelImportSummary] = useState<{
    totalRows: number;
    validData: any[];
    invalidCount: number;
    skippedCount: number;
  } | null>(null);
  const [isExcelConfirmOpen, setIsExcelConfirmOpen] = useState(false);
  const [excelImportProgress, setExcelImportProgress] = useState(0);
  const [excelImportingAgentId, setExcelImportingAgentId] = useState("");
  const [excelImportingAgentName, setExcelImportingAgentName] = useState("");
  const excelInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentAgentName) {
      setExcelImportingAgentName(currentAgentName);
      const matched = settings?.teleSalesAgents?.find((a: any) => a.name === currentAgentName);
      setExcelImportingAgentId(matched?.id || "");
    }
  }, [currentAgentName, settings?.teleSalesAgents]);

  const handleTriggerExcelSelect = () => {
    if (excelInputRef.current) {
      excelInputRef.current.value = "";
      excelInputRef.current.click();
    }
  };

  const decodeXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelImporting(true);
    setExcelImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rawRows.length < 2) {
          alert("الملف لا يحتوي على داتا عملاء كافية (الحد الأدنى صف رأس الجدول وصف بيانات).");
          setIsExcelImporting(false);
          return;
        }

        const headers = rawRows[0].map((h: any) => String(h || "").trim().toLowerCase());

        const getColumnIndex = (synonyms: string[], excludePhrases: string[] = []): number => {
          // 1. Try exact matches first to avoid prefix/suffix collisions
          const exactIdx = headers.findIndex((h) =>
            synonyms.some((s) => h === s)
          );
          if (exactIdx !== -1) return exactIdx;

          // 2. Try bounded substring matches, avoiding forbidden terms like "حالة" or "نوع"
          return headers.findIndex((h) => {
            if (excludePhrases.some((ex) => h.includes(ex))) return false;
            return synonyms.some((s) => {
              if (s.length <= 4) {
                // Short terms like "موقع" or "رابط" must be words/bounded
                return h === s || h.startsWith(s + " ") || h.endsWith(" " + s) || h.includes(" " + s + " ");
              }
              return h.includes(s) || s.includes(h);
            });
          });
        };

        const nameIdx = getColumnIndex(["اسم العميل", "العميل", "الأسم", "الاسم", "client name", "customer name", "name", "client_name"]);
        const phoneIdx = getColumnIndex(["رقم الجوال", "جوال", "هاتف", "تليفون", "موبايل", "الرقم", "phone", "mobile", "tel", "telephone", "phone_number"]);
        const fieldIdx = getColumnIndex(["المجال", "نشاط العميل", "النشاط", "التخصص", "field", "industry", "specialty"]);
        const sourceIdx = getColumnIndex(["مصدر الداتا", "المصدر", "مصدر", "source", "data source", "data_source"]);
        const storeIdx = getColumnIndex(
          ["رابط المتجر", "الرابط", "رابط", "موقع", "store link", "link", "url", "website"],
          ["حالة", "status", "نوع", "type", "تاريخ", "date"]
        );
        const socialIdx = getColumnIndex(
          ["سوشيال", "رابط السوشيال", "قناة السوشيال", "انستقرام", "انستجرام", "سناب", "سناب شات", "تيك توك", "فيسبوك", "تويتر", "إكس", "أكس", "social link", "social", "instagram", "snapchat", "tiktok", "facebook", "twitter", "x_link"],
          ["حالة", "status", "نوع", "type"]
        );
        const typeIdx = getColumnIndex(["نوع النشاط", "نوع العمل", "نوع", "business type", "business_type", "type"]);
        const noteIdx = getColumnIndex(["تفاصيل", "ملاحظات", "ملحوظة", "ملاحظة", "note", "notes", "comment", "details"]);
        const contactTypeIdx = getColumnIndex(["نوع التواصل", "طريقة التواصل", "contact type", "contact_type"]);
        const responseIdx = getColumnIndex(["الاستجابة", "رد العميل", "الرد", "استجابة", "response", "outcome"]);
        const meetingIdx = getColumnIndex(["حالة الميتنج", "حالة الميتينج", "الميتنج", "meeting status", "meeting_status"]);

        if (nameIdx === -1 || phoneIdx === -1) {
          alert("لم نتمكن من تحديد الأعمدة الإلزامية: يجب أن يحتوي الملف على عمود لـ 'اسم العميل' وعمود لـ 'رقم الجوال'.");
          setIsExcelImporting(false);
          return;
        }

        const validDataList: any[] = [];
        let invalidCount = 0;

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const clientName = row[nameIdx] ? String(row[nameIdx]).trim() : "";
          const rawPhone = row[phoneIdx] ? String(row[phoneIdx]).trim() : "";

          if (!clientName || !rawPhone) {
            invalidCount++;
            continue;
          }

          const formattedPhone = formatSaudiPhone(rawPhone);
          const isPhoneOk = formattedPhone.startsWith("9665") && formattedPhone.length === 12;

          if (!isPhoneOk) {
            invalidCount++;
            continue;
          }

          const field = fieldIdx !== -1 && row[fieldIdx] ? String(row[fieldIdx]).trim() : "";
          const dataSource = sourceIdx !== -1 && row[sourceIdx] ? String(row[sourceIdx]).trim() : "إكسل_مستورد";
          
          const sanitizeUrl = (v: any): string => {
            if (!v) return "";
            const str = String(v).trim();
            const low = str.toLowerCase();
            const bad = [
              "لا", "لا يوجد", "لايوجد", "بدون", "لا يوجد حاليا", "بانتظار الفحص", "بانتظارالفحص",
              "لايوجدحاليا", "تحتاج فحص", "تحت الفحص", "لا يوجد حالياً", "لا يوجد حساب", "لا يوجد متجر",
              "none", "n/a", "na", "no", "false", "nil", "null", "not found", "غير محدد", "غير", "لايوجد متجر"
            ];
            if (bad.some(b => low === b || low.includes(b))) return "";
            if (/^[\u0600-\u06FF\s]+$/.test(str)) return "";
            return str;
          };

          let storeLink = storeIdx !== -1 && row[storeIdx] ? sanitizeUrl(row[storeIdx]) : "";
          let socialLink = socialIdx !== -1 && row[socialIdx] ? sanitizeUrl(row[socialIdx]) : "";

          // Smart analysis of links to extract and categorize them correctly
          if (storeLink && !socialLink) {
            const lowLink = storeLink.toLowerCase();
            const isSocialUrl = [
              "instagram.com", "snapchat.com", "tiktok.com", "facebook.com", "twitter.com", "x.com", 
              "insta", "snap", "t.me", "youtube.com", "youtu.be", "social"
            ].some(k => lowLink.includes(k));
            
            if (isSocialUrl) {
              socialLink = storeLink;
              storeLink = "";
            }
          } else if (socialLink && !storeLink) {
            const lowLink = socialLink.toLowerCase();
            const isStoreUrl = [
              "salla.sa", "salla.co", "zid.sa", "shopify.com", "http", "www"
            ].some(k => lowLink.includes(k)) && ![
              "instagram.com", "snapchat.com", "tiktok.com", "facebook.com", "twitter.com", "x.com", 
              "insta", "snap", "t.me"
            ].some(k => lowLink.includes(k));

            if (isStoreUrl) {
              storeLink = socialLink;
              socialLink = "";
            }
          }

          const businessType = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : "";
          const note = noteIdx !== -1 && row[noteIdx] ? String(row[noteIdx]).trim() : "";
          
          const contactType = contactTypeIdx !== -1 && row[contactTypeIdx] ? String(row[contactTypeIdx]).trim() : "";
          const response = responseIdx !== -1 && row[responseIdx] ? String(row[responseIdx]).trim() : "لم يحدد";
          const meetingStatus = meetingIdx !== -1 && row[meetingIdx] ? String(row[meetingIdx]).trim() : "";

          validDataList.push({
            date: new Date().toISOString().split("T")[0],
            clientName,
            phone: formattedPhone,
            field,
            dataSource,
            storeLink,
            socialLink,
            businessType,
            note,
            firstContactDate: "", // empty by default for new raw clients
            contactType,
            whatsappMessageText: "",
            response,
            firstContactOutcome: "",
            dateFollow: "",
            followUp1: "",
            followUp2: "",
            followUp3: "",
            followUp4: "",
            meetingStatus,
          });
        }

        setExcelImportSummary({
          totalRows: rawRows.length - 1,
          validData: validDataList,
          invalidCount,
          skippedCount: 0,
        });
        
        setIsExcelConfirmOpen(true);
      } catch (err) {
        console.error("Error parsing excel:", err);
        alert("حدث خطأ أثناء فحص واستيراد ملف الإكسل.");
      } finally {
        setIsExcelImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCommitExcelImport = async () => {
    if (!excelImportSummary || excelImportSummary.validData.length === 0) return;

    setIsExcelImporting(true);
    setExcelImportProgress(1);

    const total = excelImportSummary.validData.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      try {
        const item = excelImportSummary.validData[i];

        // Apply presets if chosen
        const finalItem = {
          ...item,
          dataSource: item.dataSource !== "إكسل_مستورد" ? item.dataSource : (importDefaultDataSource || "إكسل_مستورد"),
          firstContactDate: item.firstContactDate || importDefaultFirstContactDate || "",
          contactType: item.contactType || importDefaultContactType || "",
          response: item.response && item.response !== "لم يحدد" ? item.response : (importDefaultResponse || ""),
          meetingStatus: item.meetingStatus || importDefaultMeetingStatus || "",
        };
        
        await addLead({
          ...finalItem,
          agentName: excelImportingAgentName || currentAgentName,
          agentId: excelImportingAgentId || settings?.teleSalesAgents?.find((a: any) => a.name === excelImportingAgentName)?.id || ""
        });
        
        successCount++;
        setExcelImportProgress(Math.round((successCount / total) * 100));
      } catch (error) {
        console.error("Error importing lead:", error);
      }
    }

    setIsExcelConfirmOpen(false);
    setExcelImportSummary(null);
    setIsExcelImporting(false);
    setExcelImportProgress(0);
    
    // Reset override presets
    setImportDefaultDataSource("");
    setImportDefaultFirstContactDate("");
    setImportDefaultContactType("");
    setImportDefaultResponse("");
    setImportDefaultMeetingStatus("");
    setImportDefaultNote("");

    showFeedback(`تم بنجاح استيراد ومزامنة ${successCount} عميل جديد من ملف الإكسل! 🚀`);
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
      setPhoneError(`رقم الجوال ناقص. طول الرقم الحالي: ${formatted.length} أرقام بدلاف من 12 رقماً.`);
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
      date: new Date().toISOString().split("T")[0],
      agentName: currentAgentName
    });
    setPhoneError(null);
  };

  // Determine authorized name dynamically
  const realAuthName = useMemo(() => {
    return memberInfo?.name || user?.displayName || user?.email?.split("@")[0] || "";
  }, [memberInfo, user]);

  // Load / Save persistent Identity for Telesales Agent
  useEffect(() => {
    if (realAuthName) {
      setCurrentAgentName(realAuthName);
    }
  }, [realAuthName]);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  // Filter leads to show ONLY this agent's data — unless the user manages
  // the Tele Sales department (admin, or Tele Sales Manager), in which
  // case they see every Tele Sales lead, matching Sales Manager behavior.
  const agentLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.isSystemDeleted === true) return false;
      if (canManageTelesalesDept) return true;
      return lead.agentName === currentAgentName;
    });
  }, [leads, currentAgentName, canManageTelesalesDept]);

  // Lead filtered view by search and tab status
  const filteredLeads = useMemo(() => {
    let result = agentLeads;

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.clientName?.toLowerCase().includes(term) ||
          lead.phone?.toLowerCase().includes(term) ||
          lead.field?.toLowerCase().includes(term) ||
          lead.dataSource?.toLowerCase().includes(term)
      );
    }

    // Meeting Status selector (including Sales equivalents)
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
      result = result.filter((lead) => lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح" || lead.meetingStatus === "تم بنجاح");
    }

    return result;
  }, [agentLeads, searchTerm, selectedMeetingStatusFilter, activeTab]);

  // Personal metrics calculations
  const personalStats = useMemo(() => {
    const total = agentLeads.length;
    const answeredCount = agentLeads.filter(l => l.response && l.response !== "لا يوجد استجابة" && l.response !== "لم يحدد").length;
    const completedMeetings = agentLeads.filter(l => l.meetingStatus === "تم الميتنج" || l.meetingStatus === "ناجح" || l.meetingStatus === "تم بنجاح").length;
    
    const todayStr = new Date().toISOString().split("T")[0];
    const todayFollowups = agentLeads.filter(l => l.dateFollow === todayStr).length;

    return {
      total,
      responseRate: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
      completedMeetings,
      todayFollowups,
    };
  }, [agentLeads]);

  const unreadNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      lead: any;
      text: string;
      date: string;
      type: string;
      fieldKey: "salesNotification" | "contractNotification";
    }> = [];

    agentLeads.forEach(l => {
      if (l.salesNotification && !l.salesNotification.read) {
        list.push({
          id: `${l.id}-sales`,
          lead: l,
          text: l.salesNotification.text,
          date: l.salesNotification.date || new Date().toISOString(),
          type: l.salesNotification.type || "meeting_done",
          fieldKey: "salesNotification"
        });
      }
      if (l.contractNotification && !l.contractNotification.read) {
        list.push({
          id: `${l.id}-contract`,
          lead: l,
          text: l.contractNotification.text,
          date: l.contractNotification.date || new Date().toISOString(),
          type: l.contractNotification.type || "contracted",
          fieldKey: "contractNotification"
        });
      }
    });

    return list;
  }, [agentLeads]);

  const contractedLeads = useMemo(() => {
    return agentLeads.filter(l => l.isContracted);
  }, [agentLeads]);

  const unreadContractNotifications = useMemo(() => {
    return unreadNotifications.filter(n => n.fieldKey === "contractNotification");
  }, [unreadNotifications]);

  // Paginated lists
  const totalLeadsPages = Math.max(1, Math.ceil(filteredLeads.length / ITEMS_PER_PAGE));
  const activeLeadsPage = Math.min(leadsPage, totalLeadsPages);
  const paginatedLeads = useMemo(() => {
    const startIndex = (activeLeadsPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLeads, activeLeadsPage]);

  const totalContractsPages = Math.max(1, Math.ceil(contractedLeads.length / ITEMS_PER_PAGE));
  const activeContractsPage = Math.min(contractsPage, totalContractsPages);
  const paginatedContracts = useMemo(() => {
    const startIndex = (activeContractsPage - 1) * ITEMS_PER_PAGE;
    return contractedLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [contractedLeads, activeContractsPage]);

  const contractedStats = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    contractedLeads.forEach(l => {
      totalAmount += Number(l.contractAmount || 0);
      totalPaid += Number(l.paidAmount || 0);
      totalRemaining += Number(l.remainingAmount || 0);
    });

    return {
      count: contractedLeads.length,
      totalAmount,
      totalPaid,
      totalRemaining
    };
  }, [contractedLeads]);

  const handleMarkNotificationsRead = async () => {
    try {
      for (const item of unreadNotifications) {
        const docRef = doc(db, "telesales_leads", item.lead.id);
        const updateObj: any = {};
        updateObj[`${item.fieldKey}.read`] = true;
        await updateDoc(docRef, updateObj);
      }
      setSuccessMsg("تم تأكيد وقراءة كافة الإشعارات والتحصيلات المباشرة بنجاح! 💸🤝");
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء تحديث الإشعارات: " + err.message);
    }
  };

  // Analytics tab date-filtered leads
  const analyticsFilteredLeads = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    const getDaysAgoDateStr = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split("T")[0];
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

  // Deep metrics analyzer (categories distribution counts and percentages)
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

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.phone) {
      alert("الرجاء إدخال اسم العميل ورقم الجوال لتسجيل التواصل.");
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
      const teleLeadPayload = {
        ...formData,
        phone: formattedPhone,
        agentName: currentAgentName,
        agentId: settings.teleSalesAgents?.find((a: any) => a.name === currentAgentName)?.id || memberInfo?.id || user?.uid || ""
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
          note: `[تم التحويل من تلي سيلز - موظف ${currentAgentName}]\n${formData.note || ""}`,
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
          telesalesAgentName: currentAgentName || "",
          telesalesAgentId: settings.teleSalesAgents?.find((a: any) => a.name === currentAgentName)?.id || memberInfo?.id || user?.uid || "",
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
      localStorage.removeItem("telesales_agent_add_client_draft");
      showFeedback("تم تسجيل وحفظ تواصل العميل الجديد بنجاح!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLeadState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (!formData.clientName || !formData.phone) {
      alert("الرجاء إدخال اسم العميل ورقم الجوال.");
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
      const isMeetingDoneOrContractedBack = selectedLead.isContracted === true || 
                                           selectedLead.paymentStatus === "تم التعاقد" || 
                                           ["تم الميتنج", "تم الاجتماع", "ناجح", "تم بنجاح"].includes(selectedLead.meetingStatus);

      if (isMeetingDoneOrContractedBack) {
        // Enforce existing state fields directly to prevent telesales from updating them
        formData.meetingStatus = selectedLead.meetingStatus || "تم الميتنج";
        formData.meetingLink = selectedLead.meetingLink || "";
        formData.meetingTime = selectedLead.meetingTime || "";
        formData.isContracted = selectedLead.isContracted || false;
        formData.paymentStatus = selectedLead.paymentStatus || "";
        formData.paidAmount = selectedLead.paidAmount || 0;
        formData.remainingAmount = selectedLead.remainingAmount || 0;
        formData.contractAmount = selectedLead.contractAmount || 0;
        formData.clientName = selectedLead.clientName;
        formData.phone = selectedLead.phone;
        formData.field = selectedLead.field || "";
        formData.dataSource = selectedLead.dataSource || "";
        formData.storeLink = selectedLead.storeLink || "";
        formData.businessType = selectedLead.businessType || "";
        formData.note = selectedLead.note || "";
        formData.firstContactDate = selectedLead.firstContactDate || "";
        formData.contactType = selectedLead.contactType || "";
        formData.response = selectedLead.response || "";
        formData.whatsappMessageText = selectedLead.whatsappMessageText || "";
        formData.firstContactOutcome = selectedLead.firstContactOutcome || "";
        formData.dateFollow = selectedLead.dateFollow || "";
        formData.distributeToSales = selectedLead.distributeToSales || false;
      }

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
          note: `[تم التحويل من تلي سيلز - موظف ${currentAgentName}]\n${formData.note || ""}`,
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
          telesalesAgentName: currentAgentName || "",
          telesalesAgentId: settings.teleSalesAgents?.find((a: any) => a.name === currentAgentName)?.id || memberInfo?.id || user?.uid || "",
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

      const savedUpdates = { ...(formData.updates || {}) };
      const currentSnapshot: any = {};
      updatableKeys.forEach(k => {
        currentSnapshot[k] = formData[k] || "";
      });
      savedUpdates[currentUpdate] = currentSnapshot;

      // Sync updates to sales_leads if already distributed
      if (selectedLead.salesLeadId || salesLeadId) {
        const targetSalesId = selectedLead.salesLeadId || salesLeadId;
        try {
          const salesLeadDoc = await getDoc(doc(db, "sales_leads", targetSalesId));
          let existingSalesUpdates: any[] = [];
          if (salesLeadDoc.exists()) {
            const data = salesLeadDoc.data();
            if (Array.isArray(data?.updates)) {
              existingSalesUpdates = data.updates;
            }
          }

          // Filter out existing telesales auto-sync updates so we don't duplicate them
          const nonTelesalesUpdates = existingSalesUpdates.filter(
            (up) => !up.text?.startsWith("[تحديث من التيلي سيلز")
          );

          // Format telesales updates dynamically
          const telesalesUpdatesList: any[] = [];

          // 1. Add "الرئيسي" if there's any active info at the root level of the form
          const mainParts = [];
          if (formData.meetingStatus) mainParts.push(`حالة الميتنج: ${formData.meetingStatus}`);
          if (formData.meetingTime) mainParts.push(`موعد الميتنج: ${formData.meetingTime}`);
          if (formData.meetingStatusNote) mainParts.push(`ملاحظات حالة الميتنج: ${formData.meetingStatusNote}`);
          if (formData.note) mainParts.push(`الملاحظات العامة: ${formData.note}`);
          if (formData.telesalesBrief) mainParts.push(`بريف محادثات التيلي: ${formData.telesalesBrief}`);
          if (formData.response) mainParts.push(`الاستجابة: ${formData.response}`);
          if (formData.dateFollow) mainParts.push(`تاريخ المتابعة: ${formData.dateFollow}`);

          if (mainParts.length > 0) {
            telesalesUpdatesList.push({
              agentName: currentAgentName || "التيلي سيلز",
              date: formData.updatedAt || new Date().toISOString(),
              text: `[تحديث من التيلي سيلز - الرئيسي] \n` + mainParts.join("\n")
            });
          }

          // 2. Add "اضافة تحديث 01" if populated
          if (formData.followupNotes_1 || formData.followupMeetingDate_1 || formData.followUp1) {
            const parts1 = [];
            if (formData.followupNotes_1) parts1.push(`ملاحظات المتابعة: ${formData.followupNotes_1}`);
            if (formData.followupMeetingDate_1) parts1.push(`تحديد موعد ميتنج: ${formData.followupMeetingDate_1}`);
            telesalesUpdatesList.push({
              agentName: currentAgentName || "التيلي سيلز",
              date: formData.updatedAt || new Date().toISOString(),
              text: `[تحديث من التيلي سيلز - اضافة تحديث 01] \n` + parts1.join("\n")
            });
          }

          // 3. Add "اضافة تحديث 02" if populated
          if (formData.followupNotes_2 || formData.followupMeetingDate_2 || formData.followUp2) {
            const parts2 = [];
            if (formData.followupNotes_2) parts2.push(`ملاحظات المتابعة: ${formData.followupNotes_2}`);
            if (formData.followupMeetingDate_2) parts2.push(`تحديد موعد ميتنج: ${formData.followupMeetingDate_2}`);
            telesalesUpdatesList.push({
              agentName: currentAgentName || "التيلي سيلز",
              date: formData.updatedAt || new Date().toISOString(),
              text: `[تحديث من التيلي سيلز - اضافة تحديث 02] \n` + parts2.join("\n")
            });
          }

          // 4. Add "اضافة تحديث 03" if populated
          if (formData.followupNotes_3 || formData.followupMeetingDate_3 || formData.followUp3) {
            const parts3 = [];
            if (formData.followupNotes_3) parts3.push(`ملاحظات المتابعة: ${formData.followupNotes_3}`);
            if (formData.followupMeetingDate_3) parts3.push(`تحديد موعد ميتنج: ${formData.followupMeetingDate_3}`);
            telesalesUpdatesList.push({
              agentName: currentAgentName || "التيلي سيلز",
              date: formData.updatedAt || new Date().toISOString(),
              text: `[تحديث من التيلي سيلز - اضافة تحديث 03] \n` + parts3.join("\n")
            });
          }

          // 5. Add "اضافة تحديث 04" if populated
          if (formData.followupNotes_4 || formData.followupMeetingDate_4 || formData.followUp4) {
            const parts4 = [];
            if (formData.followupNotes_4) parts4.push(`ملاحظات المتابعة: ${formData.followupNotes_4}`);
            if (formData.followupMeetingDate_4) parts4.push(`تحديد موعد ميتنج: ${formData.followupMeetingDate_4}`);
            telesalesUpdatesList.push({
              agentName: currentAgentName || "التيلي سيلز",
              date: formData.updatedAt || new Date().toISOString(),
              text: `[تحديث من التيلي سيلز - اضافة تحديث 04] \n` + parts4.join("\n")
            });
          }

          const mergedUpdates = [...telesalesUpdatesList, ...nonTelesalesUpdates];

          const syncData: any = {
            clientName: formData.clientName,
            phone: formattedPhone,
            additionalPhone: formData.additionalPhone || "",
            field: formData.field || "",
            originalDataSource: formData.dataSource || "",
            storeLink: formData.storeLink || "",
            additionalStore: formData.additionalStore || "",
            socialLink: formData.socialLink || "",
            businessType: formData.businessType || "",
            note: formData.note || "",
            originalNote: formData.note || "",
            firstContactDate: formData.firstContactDate || "",
            contactType: formData.contactType || "",
            whatsappMessageText: formData.whatsappMessageText || "",
            telesalesBrief: formData.telesalesBrief || "",
            meetingStatusNote: formData.meetingStatusNote || "",
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
            updates: mergedUpdates,
            telesalesNotification: {
              text: `تحديث جديد من التيلي سيلز (${currentAgentName}) للعميل (${formData.clientName || "غير محدد"}): [${formData.followupUpdate || "الرئيسي"}] 🔔`,
              date: new Date().toISOString(),
              read: false,
            },
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(doc(db, "sales_leads", targetSalesId), syncData);
        } catch (syncErr) {
          console.error("Error syncing with sales_leads:", syncErr);
        }
      }

      const updatedPayload: any = {
        ...formData,
        hasBeenSavedOnce: true,
        updates: savedUpdates,
        phone: formattedPhone,
        agentName: currentAgentName,
        agentId: settings.teleSalesAgents?.find((a: any) => a.name === currentAgentName)?.id || memberInfo?.id || user?.uid || ""
      };

      if (isNewlyDistributed) {
        updatedPayload.distributedToSales = true;
        updatedPayload.salesLeadId = salesLeadId;
      }

      await updateLead(selectedLead.id, updatedPayload);
      setIsEditOpen(false);
      setSelectedLead(null);
      resetForm();
      showFeedback("تمت مزامنة وتحديث بيانات التابعية بنجاح!");
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
    
    // Ensure accurate assignment of agentName on active edit
    updatedForm.agentName = currentAgentName;

    setFormData(updatedForm);
    setIsEditOpen(true);
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
    if (lead.socialLink) parts.push(`📱 *رابط السوشيال ميديا:* ${lead.socialLink}`);
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
      "id", "date", "clientName", "phone", "field", "dataSource", "storeLink", "socialLink", 
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

  if (leadsLoading || settingsLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold">تحميل منصة متابعة موظفي التيلي...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 relative z-10" dir="rtl">
      {/* Toast Feedback */}
      {successMsg && (
        <div className="fixed top-24 left-6 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={24} />
          <span>{successMsg}</span>
        </div>
      )}


      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <PhoneCall size={24} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">مساحة شغل التيلي سيلز</h1>
          </div>
          <p className="text-slate-400 font-medium">مساحتك الخاصة للابداع</p>
        </div>
        
        <Button 
          onClick={() => { 
            const draft = localStorage.getItem("telesales_agent_add_client_draft");
            if (draft) {
              try {
                setFormData(JSON.parse(draft));
              } catch (e) {
                resetForm();
              }
            } else {
              resetForm();
            }
            setIsAddOpen(true); 
          }}
          className="h-12 px-6 rounded-2xl font-black bg-gradient-to-r from-sky-450 to-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2 self-start xl:self-center"
        >
          <Plus size={18} />
          <span>تسجيل عميل جديد</span>
        </Button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-white/[0.05] pb-1 gap-6">
        <button
          onClick={() => setMainViewTab("analytics")}
          className={cn(
            "pb-4 text-base font-black relative transition-all duration-200 px-1 flex items-center gap-2 cursor-pointer",
            mainViewTab === "analytics" 
              ? "text-sky-400" 
              : "text-slate-400 hover:text-white"
          )}
        >
          <BarChart3 size={18} />
          <span>لوحة التحليلات</span>
          {mainViewTab === "analytics" && (
            <span className="absolute bottom-0 right-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-sky-400 to-sky-600 shadow-[0_2px_10px_rgba(56,189,248,0.5)]" />
          )}
        </button>
        <button
          onClick={() => setMainViewTab("contacts")}
          className={cn(
            "pb-4 text-base font-black relative transition-all duration-200 px-1 flex items-center gap-2 cursor-pointer",
            mainViewTab === "contacts" 
              ? "text-sky-400" 
              : "text-slate-400 hover:text-white"
          )}
        >
          <Users size={18} />
          <div className="flex items-center gap-1.5">
            <span>بيانات العملاء</span>
            {unreadNotifications.length > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse shrink-0">
                {unreadNotifications.length}
              </span>
            )}
          </div>
          {mainViewTab === "contacts" && (
            <span className="absolute bottom-0 right-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-sky-400 to-sky-600 shadow-[0_2px_10px_rgba(56,189,248,0.5)]" />
          )}
        </button>
        <button
          onClick={() => setMainViewTab("contracts")}
          className={cn(
            "pb-4 text-base font-black relative transition-all duration-200 px-1 flex items-center gap-2 cursor-pointer",
            mainViewTab === "contracts" 
              ? "text-sky-400" 
              : "text-slate-400 hover:text-white"
          )}
        >
          <Briefcase size={18} />
          <div className="flex items-center gap-1.5">
            <span>التعاقدات الجديدة</span>
            {unreadContractNotifications.length > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse shrink-0">
                {unreadContractNotifications.length}
              </span>
            )}
          </div>
          {mainViewTab === "contracts" && (
            <span className="absolute bottom-0 right-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-sky-400 to-sky-600 shadow-[0_2px_10px_rgba(56,189,248,0.5)]" />
          )}
        </button>
      </div>

      {mainViewTab === "analytics" && (
        <div className="space-y-10 animate-in fade-in duration-300">
          
          {/* Header of Analytics & Time Period Filter */}
          <div className="relative overflow-hidden p-6 rounded-3xl border border-white/[0.08] bg-slate-950/20 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] group transition-all duration-500 hover:border-white/[0.12] hover:shadow-[0_20px_55px_rgba(56,189,248,0.06)] animate-in fade-in duration-300">
            {/* Ambient fluid glow backdrops */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 group-hover:bg-sky-500/15 transition-all duration-700" />
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
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/45 backdrop-blur-md p-1.5 rounded-2xl border border-white/[0.06] shadow-inner">
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
              <div className="mt-6 pt-6 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
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

          {/* 5 Analytics Cards Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            
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
                  إجمالي العملاء المخصصين والمسجلين لك
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

            {/* Card 5: التارجت الشخصي الشهري */}
            <Card glass className="p-5 border-white/[0.05] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-wider">التارجت الشخصي الشهري</span>
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Target size={16} /></div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white font-mono flex items-baseline gap-1">
                  <span>{analyticsStats.successfulMeetings}</span>
                  <span className="text-xs text-slate-500 font-bold">/ {settings.targets?.telesalesAgentMonthlyTarget || 0}</span>
                </h3>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>نسبة الإنجاز:</span>
                  <span className="font-mono text-rose-400">
                    {settings.targets?.telesalesAgentMonthlyTarget && settings.targets.telesalesAgentMonthlyTarget > 0 
                      ? Math.round((analyticsStats.successfulMeetings / settings.targets.telesalesAgentMonthlyTarget) * 100)
                      : 0}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(
                        settings.targets?.telesalesAgentMonthlyTarget && settings.targets.telesalesAgentMonthlyTarget > 0 
                          ? Math.round((analyticsStats.successfulMeetings / settings.targets.telesalesAgentMonthlyTarget) * 100)
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
                  <Layers className="text-sky-400" size={20} />
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
                        <Tooltip 
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
                        <Tooltip 
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
                  <span>سكريبتات التواصل الأكثر مبيعاً ونجاحاً</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  تحليلات مقارنة لأثر وقوة الاسكريبتات والرسائل المستخدمة في تحويل وتأهيل جهات الاتصال لميتنج ناجح
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
        </div>
      )}

      {mainViewTab === "contacts" && (
        <div className="space-y-10 animate-in fade-in duration-300">

          {/* Toolbar / Search Header */}
          <Card glass className="p-6 border-white/[0.05]">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-1 flex-col md:flex-row gap-4 w-full">
                <div className="relative flex-1">
                  <Search className="absolute right-4 top-3.5 text-slate-500" size={18} />
                  <Input 
                    dark 
                    placeholder="ابحث باسم العميل، المجال، أو مصدر الداتا..." 
                    className="pr-12 h-12"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
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

              {/* Excel upload trigger button */}
              <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
                <input 
                  type="file" 
                  ref={excelInputRef}
                  onChange={decodeXlsxFile}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <Button
                  onClick={handleTriggerExcelSelect}
                  disabled={isExcelImporting}
                  className="h-12 px-5 rounded-xl font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer w-full lg:w-auto hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText size={18} />
                  <span>{isExcelImporting ? "جاري القراءة..." : "استيراد من إكسل 📤"}</span>
                </Button>
              </div>
            </div>


          </Card>

          {/* Notifications Section - Enabled and supercharged! */}
          {unreadNotifications.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-amber-500/30 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300 select-text">
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                     مركز الإشعارات والتنبيهات المباشرة ({unreadNotifications.length})
                  </h4>
                </div>
                <Button
                  onClick={handleMarkNotificationsRead}
                  className="h-8 px-3 text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg transition-all cursor-pointer"
                >
                  تعليم الكل كمقروء ✔
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {unreadNotifications.map((notif) => {
                  const isMeeting = notif.type === "meeting_done";
                  const lead = notif.lead;
                  return (
                    <div key={notif.id} className="bg-slate-950/60 border border-white/[0.03] p-3.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-amber-500/10 transition-all">
                      <div className="flex items-start gap-2.5 select-text">
                        <span className="text-xl shrink-0 mt-0.5">{isMeeting ? "🤝" : "💸"}</span>
                        <div className="space-y-0.5">
                          <p className="text-xs text-slate-200 font-bold leading-relaxed whitespace-pre-line">{notif.text}</p>
                          {notif.date && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              {new Date(notif.date).toLocaleDateString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <Button
                          onClick={async () => {
                            try {
                              const docRef = doc(db, "telesales_leads", lead.id);
                              await updateDoc(docRef, {
                                [`${notif.fieldKey}.read`]: true
                              });
                              setSuccessMsg(`تم استلام الإشعار وفتح لوحة التعديل للعميل: ${lead.clientName}`);
                              // Open the edit drawer directly for this lead
                              startEdit(lead);
                            } catch (err: any) {
                              console.error(err);
                              alert("حدث خطأ: " + err.message);
                            }
                          }}
                          className="h-7 px-3 text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <span>فتح وتعديل الحالة</span>
                          <span>⚙️</span>
                        </Button>
                        <Button
                          onClick={async () => {
                            try {
                              const docRef = doc(db, "telesales_leads", lead.id);
                              await updateDoc(docRef, {
                                [`${notif.fieldKey}.read`]: true
                              });
                              setSuccessMsg(`تم تأكيد استلام إشعار العميل: ${lead.clientName}`);
                            } catch (err: any) {
                              console.error(err);
                              alert("حدث خطأ: " + err.message);
                            }
                          }}
                          className="h-7 px-3 text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg shrink-0 cursor-pointer"
                        >
                          تأكيد الاستلام فقط
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}



          {/* Main Listing View (طريقة عرض الأسطر لبيانات الموظف) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 pr-2 border-r-4 border-sky-500">
                قائمة تواصلاتي وسجل العملائي ({filteredLeads.length})
              </h2>
            </div>

            {/* Bulk / Multi-select Actions Panel */}
            {selectedLeadIds.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-500/20 via-slate-900/40 to-sky-500/10 border border-indigo-500/25 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold">
                    ⚙️
                  </div>
                  <div className="text-right space-y-0.5">
                    <h4 className="text-sm font-black text-white">إجراء جماعي على العناصر المحددة</h4>
                    <p className="text-[11px] text-slate-300 font-bold">لقد قمت بتحديد {selectedLeadIds.length} عميل. يمكنك تعديل بياناتهم معاً بالتعديل الجماعي السريع أو حذفهم نهائياً.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    onClick={() => setIsBulkEditOpen(true)}
                    className="h-10 px-5 text-xs font-black bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-lg shadow-sky-500/10 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 size={14} />
                    <span>تعديل جماعي للعملاء المحددين ({selectedLeadIds.length})</span>
                  </Button>

                  {isMasterEmail && (
                    <Button
                      onClick={() => setIsBulkDeleteConfirmOpen(true)}
                      className="h-10 px-5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/10 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>حذف العملاء المحددين ({selectedLeadIds.length})</span>
                    </Button>
                  )}
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedLeadIds([])}
                    className="h-10 px-4 text-xs font-bold rounded-xl border border-white/10 text-slate-300"
                  >
                    <span>إلغاء التحديد ✖</span>
                  </Button>
                </div>
              </div>
            )}

            <Card glass className="p-0 overflow-hidden border-white/[0.05]">
              <div className="overflow-x-auto">
                <table className="w-full text-right" dir="rtl">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06] text-slate-400 text-xs font-semibold">
                      <th className="px-5 py-4 w-12 text-center">
                        <input 
                          type="checkbox"
                          className="w-4.5 h-4.5 rounded border-white/15 bg-slate-950/40 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.includes(l.id))}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-5 py-4 text-slate-300 font-black">العميل</th>
                      <th className="px-5 py-4 text-slate-300 font-black">تاريخ الإضافة</th>
                      <th className="px-5 py-4 text-slate-300 font-black">سورس الملف والمجال</th>
                      <th className="px-5 py-4 text-slate-300 font-black">التواصل والاستجابة</th>
                      <th className="px-5 py-4 text-slate-300 font-black">حالة الميتنج</th>
                      <th className="px-5 py-4 text-slate-300 font-black text-center font-sans">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {paginatedLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const isContacted = !!lead.firstContactDate || !!lead.contactType || (lead.response && lead.response !== "لم يحدد");
                      
                      return (
                        <tr 
                          key={lead.id} 
                          className={cn(
                            "hover:bg-white/[0.02] transition-colors",
                            isSelected ? "bg-sky-500/[0.03]" : ""
                          )}
                        >
                          {/* Checkbox */}
                          <td className="px-5 py-4 text-center">
                            <input 
                              type="checkbox"
                              className="w-4.5 h-4.5 rounded border-white/15 bg-slate-950/40 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              checked={isSelected}
                              onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                            />
                          </td>

                          {/* Client information */}
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-sm font-sans tracking-tight">{lead.clientName}</span>
                                {lead.distributedToSales && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded text-sky-400 bg-sky-500/10 border border-sky-500/20 whitespace-nowrap">
                                    محول للسيلز ⚡
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono tracking-tight flex items-center gap-1">
                                <span>جوال:</span>
                                <span>{lead.phone}</span>
                              </div>
                            </div>
                          </td>

                          {/* Added date */}
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-400 font-bold">
                            {lead.date ? new Date(lead.date).toLocaleDateString("ar-SA") : "بلا تاريخ"}
                          </td>

                          {/* Source & Specialty */}
                          <td className="px-5 py-4 text-xs font-semibold space-y-1">
                            <div className="text-slate-300 flex items-center gap-1">
                              <Users size={12} className="text-slate-600" />
                              <span>{lead.dataSource || "إكسل_مستورد"}</span>
                            </div>
                            <div className="text-slate-500 text-[11px] flex items-center gap-1 font-bold">
                              <Briefcase size={11} className="text-slate-700" />
                              <span>{lead.field || "لا يوجد مجال"}</span>
                            </div>
                          </td>

                          {/* First Contact & Response outcome */}
                          <td className="px-5 py-4">
                            {isContacted ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-400/90">
                                  <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px]">
                                    {lead.contactType || "واتساب"}
                                  </span>
                                  <span className="font-mono text-slate-500">
                                    بتاريخ {lead.firstContactDate || "غير محدد"}
                                  </span>
                                </div>
                                {lead.response && (
                                  <div className="text-[11px] text-slate-200">
                                    <span className="text-slate-500 font-bold">الاستجابة: </span>
                                    <span>{lead.response}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/10 text-[9px] font-extrabold">
                                  عميل جديد - لم يتصل 💤
                                </span>
                                <p className="text-[10px] text-slate-500 font-bold leading-normal">بانتظار بدء تواصلك الأول معه</p>
                              </div>
                            )}
                          </td>

                          {/* Meeting Status */}
                          <td className="px-5 py-4 text-xs">
                            {lead.meetingStatus ? (
                              <div className="space-y-1">
                                <span className={cn(
                                  "text-[9px] font-black px-2 py-0.5 rounded border block w-fit",
                                  (lead.meetingStatus === "تم الميتنج" || lead.meetingStatus === "ناجح" || lead.meetingStatus === "تم بنجاح") && "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                                  (lead.meetingStatus === "مجدول" || lead.meetingStatus === "تحت المتابعة") && "text-amber-400 bg-amber-500/10 border-amber-500/20",
                                  (lead.meetingStatus === "ملغي" || lead.meetingStatus === "لم يحضر") && "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                )}>
                                  {lead.meetingStatus}
                                </span>
                                {lead.meetingLink && (
                                  <a 
                                    href={lead.meetingLink.startsWith("http") ? lead.meetingLink : `https://${lead.meetingLink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[9px] font-black px-2 py-0.5 rounded text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/40 inline-flex items-center gap-1 transition-colors duration-200 whitespace-nowrap"
                                  >
                                    <span>رابط الاجتماع 🔗</span>
                                  </a>
                                )}
                                {lead.meetingTime && (
                                  <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 whitespace-nowrap inline-flex items-center gap-1">
                                    ⏰ {lead.meetingTime.replace("T", " ")}
                                  </span>
                                )}
                                {lead.meetingStatusNote && (
                                  <div className="text-[10px] text-[#fcd34d] bg-amber-500/10 px-2 py-1.5 rounded-lg border border-amber-500/20 whitespace-pre-line mt-1 max-w-[190px] leading-relaxed font-semibold">
                                    📝 {lead.meetingStatusNote}
                                  </div>
                                )}
                                {lead.dateFollow && (
                                  <p className="text-[9px] font-mono font-black text-amber-400 flex items-center gap-1.5" title="موعد المتابعة القادم">
                                    <Clock size={10} className="animate-pulse" />
                                    <span>متابعة {lead.dateFollow}</span>
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-bold">بدون ميتنج</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {lead.whatsappMessageText && (
                                <button 
                                  onClick={() => copyToClipboard(lead.whatsappMessageText, lead.id)}
                                  className="inline-flex items-center justify-center h-8 w-8 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25 rounded-lg transition-all cursor-pointer"
                                  title={copiedId === lead.id ? "تم نسخ نص رسالة الواتس اب!" : "نسخ نص رسالة الواتساب للعميل"}
                                >
                                  {copiedId === lead.id ? <Check size={13} /> : <MessageSquare size={13} />}
                                </button>
                              )}
                              {lead.phone && (
                                <a 
                                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center h-8 w-8 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-lg transition-all cursor-pointer"
                                  title="مراسلة عبر واتساب"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <button 
                                onClick={() => copyLeadAllDataToWhatsApp(lead, lead.id)}
                                className="inline-flex items-center justify-center h-8 w-8 bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/25 rounded-lg transition-all cursor-pointer"
                                title="نسخ جميع بيانات العميل بشكل منظم للواتساب"
                              >
                                <Copy size={13} />
                              </button>
                              <button 
                                onClick={() => startEdit(lead)}
                                className="inline-flex items-center justify-center h-8 w-8 bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                                title="تعديل تفاصيل التواصل"
                              >
                                <Edit3 size={13} />
                              </button>
                              {isMasterEmail && (
                                <button 
                                  onClick={() => setLeadToDelete(lead)}
                                  className="inline-flex items-center justify-center h-8 w-8 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                                  title="حذف السجل"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MAIN LEADS PAGINATION */}
              {filteredLeads.length > 0 && (
                <div className="p-4 border-t border-white/[0.04] bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none" dir="rtl">
                  <div className="text-xs text-slate-400 font-bold">
                    عرض <span className="text-white">{(activeLeadsPage - 1) * ITEMS_PER_PAGE + 1}</span> إلى <span className="text-white">{Math.min(activeLeadsPage * ITEMS_PER_PAGE, filteredLeads.length)}</span> من أصل <span className="text-white">{filteredLeads.length}</span> عميل
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

              {filteredLeads.length === 0 && (
                <div className="p-16 border-t border-dashed border-white/[0.05] text-center">
                  <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                    <PhoneCall size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">لا يوجد جهات اتصال متطابقة</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto font-sans">
                    قم بالضغط على "تسجيل عميل جديد" لتسجيل تفاصيل الاتصال لعميل وعقد ميتنج سريع.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Beautiful Centered Glassmorphic Modal with Auto-Save draft for registering new lead */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop blur layer */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => setIsAddOpen(false)} 
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
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight">تسجيل ملف تواصل تيلي عميل جديد</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-extrabold mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>مسودة تواصل محفوظة مأمنة محلياً 💾</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors bg-white/5 rounded-xl active:scale-95 duration-150"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-6">
              {renderDynamicForm()}

              {/* Checkbox for Sales Distribution */}
              {(formData.meetingStatus === "تم تحديد ميتنج" || formData.meetingStatus === "تم الميتنج" || formData.meetingStatus === "مجدول" || formData.response === "يطلب ميتنج فوري" || !!formData.distributeToSales) && (
                <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl space-y-2 text-right" dir="rtl">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="distributeToSalesAdd"
                      className="w-5 h-5 rounded border-sky-500/30 text-sky-500 bg-slate-900/50 focus:ring-sky-500/40 cursor-pointer"
                      checked={!!formData.distributeToSales}
                      onChange={(e) => setFormData({ ...formData, distributeToSales: e.target.checked })}
                    />
                    <label htmlFor="distributeToSalesAdd" className="text-sm font-black text-sky-300 cursor-pointer select-none">
                      توزيع وتصدير فوري إلى فريق المبيعات (Sales Hub)
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold pr-8 leading-relaxed">
                    عند التفعيل، سيتم تحويل وتصدير هذا العميل تلقائياً ببياناته إلى صفحة مدير السيلز (Sales Hub) ليتم إسنادها لفريق المبيعات المباشر أو المستهدف.
                  </p>
                </div>
              )}

              {/* Footer buttons / Interactive Discard Draft */}
              <div className="pt-5 border-t border-white/10 flex flex-wrap gap-3 justify-between items-center mt-8">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من رغبتك في مسح كافة الحقول الحالية للاتصال وبدء مسودة فارغة؟")) {
                      resetForm();
                      localStorage.removeItem("telesales_agent_add_client_draft");
                      showFeedback("🧹 تم تصفير النموذج وحذف مسودة التيلي سيلز بنجاح!");
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
                    onClick={() => setIsAddOpen(false)}
                    className="h-11 px-5 rounded-xl text-xs font-bold"
                  >
                    إلغاء التصفح
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 px-7 rounded-xl text-xs font-black bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/10 text-slate-950 flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>حفظ بيانات العميل</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {mainViewTab === "contracts" && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Contracts Tab UI */}
          
          {/* Metric Cards (KPI Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
            {/* 1. Total Contracted Count */}
            <Card className="relative overflow-hidden p-6 border-white/[0.04] bg-gradient-to-br from-emerald-500/10 via-slate-950 to-transparent group transition-all duration-300 hover:border-emerald-500/20">
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-125 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={20} />
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">نشط</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black font-mono text-white">{contractedStats.count}</p>
                <p className="text-xs text-slate-400 font-bold">مجموع العملاء المتعاقدين</p>
              </div>
            </Card>

            {/* 2. Total Contract Amounts */}
            <Card className="relative overflow-hidden p-6 border-white/[0.04] bg-gradient-to-br from-sky-500/10 via-slate-950 to-transparent group transition-all duration-300 hover:border-sky-500/20">
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-sky-500/5 rounded-full blur-xl group-hover:scale-125 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400">
                  <TrendingUp size={20} />
                </span>
                <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-400/20 px-2 py-0.5 rounded-full font-bold">القيمة الكلية</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black font-mono text-white">
                  {contractedStats.totalAmount.toLocaleString()} <span className="text-xs text-sky-400">ريال</span>
                </p>
                <p className="text-xs text-slate-400 font-bold font-sans">إجمالي مبالغ التعاقدات</p>
              </div>
            </Card>

            {/* 3. Total Paid Amounts */}
            <Card className="relative overflow-hidden p-6 border-white/[0.04] bg-gradient-to-br from-teal-500/10 via-slate-950 to-transparent group transition-all duration-300 hover:border-teal-500/20">
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-teal-500/5 rounded-full blur-xl group-hover:scale-125 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <ShieldCheck size={20} />
                </span>
                <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold font-sans">المحصل فعلياً</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black font-mono text-white">
                  {contractedStats.totalPaid.toLocaleString()} <span className="text-xs text-teal-400">ريال</span>
                </p>
                <p className="text-xs text-slate-400 font-bold font-sans">إجمالي المبالغ المدفوعة</p>
              </div>
            </Card>

            {/* 4. Total Remaining Amounts */}
            <Card className="relative overflow-hidden p-6 border-white/[0.04] bg-gradient-to-br from-amber-500/10 via-slate-950 to-transparent group transition-all duration-300 hover:border-amber-500/20">
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:scale-125 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Clock size={20} />
                </span>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold font-sans">مستحق</span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black font-mono text-white">
                  {contractedStats.totalRemaining.toLocaleString()} <span className="text-xs text-amber-400">ريال</span>
                </p>
                <p className="text-xs text-slate-400 font-bold">إجمالي المبالغ المتبقية</p>
              </div>
            </Card>
          </div>

          {/* Quick confirmation notification banner */}
          {unreadContractNotifications.length > 0 && (
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in zoom-in duration-300 text-right pr-6 pl-6" dir="rtl">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>تنبيه أمني: يوجد تعاقدات جديدة بانتظار التأكيد والإقرار!</span>
                </h4>
                <p className="text-xs text-slate-400 font-bold">
                  لديك عدد ({unreadContractNotifications.length}) إشعارات تعاقدات مرسلة من مدير المبيعات ولم تقم بقراءتها وتأكيدها وتنزيل عوائدها وعمولاتها بعد.
                </p>
              </div>
              <Button
                onClick={handleMarkNotificationsRead}
                className="h-10 px-5 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
              >
                تأكيد وقراءة جميع إشعارات التعاقدات 💸🤝
              </Button>
            </div>
          )}

          {/* List and Details Table */}
          <Card glass className="p-6 border-white/[0.05] overflow-visible">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]" dir="rtl">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Briefcase className="text-emerald-400" size={20} />
                  <span>سجل العملاء المتعاقدين بالتفصيل</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  جدول متقدم لاستعراض العملاء الذين قاموا بالتوقيع والتعاقد رسميًا بمبالغهم ومدفوعاتهم ونسب التحصيل
                </p>
              </div>
              <div className="text-xs font-bold text-slate-400 bg-white/[0.02] border border-white/[0.05] px-3 py-1.5 rounded-xl">
                <span>العدد: {contractedLeads.length} عميل متعاقد</span>
              </div>
            </div>

            {contractedLeads.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4" dir="rtl">
                <div className="w-16 h-16 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-full flex items-center justify-center text-slate-500 text-xl">
                  🤝
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-white">لا توجد أي تعاقدات مسجلة حالياً</p>
                  <p className="text-xs text-slate-500 font-bold">بمجرد قيام المبيعات بإغلاق صفقات عملاءك بنجاح، ستظهر بياناتهم ومبالغهم هنا تلقائياً.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto" dir="rtl">
                <table className="w-full text-right border-collapse text-xs font-semibold">
                  <thead>
                    <tr className="border-b border-white/[0.03] text-xs font-black text-slate-400">
                      <th className="pb-3 pt-1">اسم العميل</th>
                      <th className="pb-3 pt-1 text-center">رقم الهاتف</th>
                      <th className="pb-3 pt-1 text-center">الشركة والمجال</th>
                      <th className="pb-3 pt-1 text-center">قيمة التعاقد</th>
                      <th className="pb-3 pt-1 text-center">المبلغ المدفوع</th>
                      <th className="pb-3 pt-1 text-center">المبلغ المتبقي</th>
                      <th className="pb-3 pt-1 text-center">التقدم المالي</th>
                      <th className="pb-3 pt-1 text-center">تحصيل المبيعات</th>
                      <th className="pb-3 pt-1 text-left">الخيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02] text-xs font-bold text-slate-300">
                    {paginatedContracts.map((lead) => {
                      const amount = Number(lead.contractAmount || 0);
                      const paid = Number(lead.paidAmount || 0);
                      const remaining = Number(lead.remainingAmount || 0);
                      const progressPercent = amount > 0 ? Math.round((paid / amount) * 100) : 0;
                      
                      const progressColorClass = 
                        progressPercent >= 100 ? "bg-emerald-500" :
                        progressPercent >= 50 ? "bg-sky-500" :
                        "bg-amber-500";

                      return (
                        <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-4 font-sans">
                            <div className="font-black text-white flex items-center gap-2">
                              <span>{lead.clientName}</span>
                              {lead.contractNotification && !lead.contractNotification.read && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse animate-duration-1000" title="تعاقد غير مؤكد" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold font-mono">ID: {lead.id.substring(0, 8)}</span>
                          </td>
                          <td className="py-4 font-mono select-all text-slate-400 text-center">{lead.clientPhone}</td>
                          <td className="py-4 text-center">
                            <div>{lead.field || "غير محدد"}</div>
                            <span className="text-[10px] text-slate-500 font-semibold">{lead.companyName || "تداول فردي"}</span>
                          </td>
                          <td className="py-4 font-mono text-white font-black text-center">{amount.toLocaleString()} ر.س</td>
                          <td className="py-4 font-mono text-emerald-400 font-black text-center">{paid.toLocaleString()} ر.س</td>
                          <td className="py-4 font-mono text-amber-500 font-black text-center">{remaining.toLocaleString()} ر.س</td>
                          <td className="py-4">
                            <div className="space-y-1.5 max-w-[120px] mx-auto font-mono">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-500">تحصيل</span>
                                <span className="font-bold text-white">{progressPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-white/[0.05]">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", progressColorClass)}
                                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {lead.paymentStatus || "تم التعاقد"}
                            </span>
                          </td>
                          <td className="py-4 text-left">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setFormData({ ...DEFAULT_TELESALES_FORM, ...lead });
                                  setIsEditOpen(true);
                                }}
                                className="h-8 px-3 rounded-lg text-[10px] font-black bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-white flex items-center gap-1 cursor-pointer font-sans"
                              >
                                <FileText size={12} />
                                <span>التفاصيل والمتابعة</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* CONTRACTS PAGINATION */}
              {contractedLeads.length > 0 && (
                <div className="p-4 border-t border-white/[0.04] bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans select-none" dir="rtl">
                  <div className="text-xs text-slate-400 font-bold">
                    عرض <span className="text-white">{(activeContractsPage - 1) * ITEMS_PER_PAGE + 1}</span> إلى <span className="text-white">{Math.min(activeContractsPage * ITEMS_PER_PAGE, contractedLeads.length)}</span> من أصل <span className="text-white">{contractedLeads.length}</span> تعاقد
                  </div>
                  <div className="flex items-center gap-1.5 font-sans">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setContractsPage(1)}
                      disabled={activeContractsPage === 1}
                      className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      {"<<"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setContractsPage(p => Math.max(1, p - 1))}
                      disabled={activeContractsPage === 1}
                      className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      السابق
                    </Button>
                    
                    <div className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold font-mono">
                      {activeContractsPage} / {totalContractsPages}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setContractsPage(p => Math.min(totalContractsPages, p + 1))}
                      disabled={activeContractsPage === totalContractsPages}
                      className="h-8 px-2.5 rounded-lg text-xs font-black text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      التالي
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setContractsPage(totalContractsPages)}
                      disabled={activeContractsPage === totalContractsPages}
                      className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      {">>"}
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Drawer: Edit Lead Form */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setSelectedLead(null); }}
        title={`تعديل تواصل العميل: ${selectedLead?.clientName || ""}`}
        size="lg"
      >
        <form onSubmit={handleUpdateLeadState} className="space-y-6">
          {(formData.isContracted === true || formData.paymentStatus === "تم التعاقد" || ["تم الميتنج", "تم الاجتماع", "ناجح", "تم بنجاح"].includes(formData.meetingStatus)) && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 text-right" dir="rtl">
              <span className="text-xl shrink-0">🔒</span>
              <div className="space-y-1">
                <h5 className="text-xs font-black text-amber-400">حالة العميل مقفلة ومحمية</h5>
                <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                  لقد تم عقد الميتنج أو إتمام التعاقد مع هذا العميل بواسطة قسم المبيعات. لا يمكن تعديل بيانات العميل أو حالته الأساسية حالياً، ولكن لك الصلاحية الكاملة لإضافة ملاحظات وتحديثات متابعة جديدة عبر خيار "اضافة تحديث" المتاح بالأسفل.
                </p>
              </div>
            </div>
          )}
          {renderDynamicForm()}

          {/* Checkbox for Sales Distribution */}
          {(formData.meetingStatus === "تم تحديد ميتنج" || formData.meetingStatus === "تم الميتنج" || formData.meetingStatus === "مجدول" || formData.response === "يطلب ميتنج فوري" || !!formData.distributeToSales || !!selectedLead?.distributedToSales) && (
            <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl space-y-2 text-right" dir="rtl">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="distributeToSalesEdit"
                  className="w-5 h-5 rounded border-sky-500/30 text-sky-500 bg-slate-900/50 focus:ring-sky-500/40 cursor-pointer"
                  checked={!!formData.distributeToSales}
                  onChange={(e) => setFormData({ ...formData, distributeToSales: e.target.checked })}
                  disabled={!!selectedLead?.distributedToSales}
                />
                <label htmlFor="distributeToSalesEdit" className="text-sm font-black text-sky-300 cursor-pointer select-none">
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

      {/* Drawer: Excel Import Confirmation & Settings */}
      <Drawer
        isOpen={isExcelConfirmOpen}
        onClose={() => { if (!isExcelImporting) setIsExcelConfirmOpen(false); }}
        title="تأكيد ومزامنة استيراد العملاء من ملف إكسل"
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-white/[0.05] space-y-4">
            <h4 className="text-sm font-black text-white">ملخص فحص وقراءة الملف:</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي الصفوف بالملف</span>
                <span className="text-xl font-mono font-black text-white">{excelImportSummary?.totalRows || 0}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <span className="text-xs font-bold text-slate-400 block mb-1">سجلات جاهزة للاستيراد</span>
                <span className="text-xl font-mono font-black text-emerald-400">{excelImportSummary?.validData?.length || 0}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 text-center">
                <span className="text-xs font-bold text-slate-400 block mb-1">سجلات فارغة أو غير صالحة</span>
                <span className="text-xl font-mono font-black text-rose-400">{excelImportSummary?.invalidCount || 0}</span>
              </div>
            </div>

            {excelImportSummary && excelImportSummary.invalidCount > 0 && (
              <p className="text-[11px] font-medium text-rose-300 leading-relaxed bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-500/10 font-sans">
                ⚠️ السجلات غير الصالحة ستُستبعد تلقائياً (تأكد من احتواء كل صف على اسم وبنية رقم جوال سعودية مثل 05xxxxxxxx أو 9665xxxxxxxx).
              </p>
            )}
          </div>

          {/* Only preview records should be displayed directly */}

          {/* Importing progress feedback */}
          {isExcelImporting && excelImportProgress > 0 && (
            <div className="space-y-2 p-4 rounded-xl bg-sky-950/20 border border-sky-500/10 animate-pulse">
              <div className="flex justify-between items-center text-xs font-bold text-sky-450">
                <span>جاري مزامنة ورفع العملاء إلى السيرفر...</span>
                <span>{excelImportProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(14,165,233,0.5)]" 
                  style={{ width: `${excelImportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview list sample */}
          {excelImportSummary && excelImportSummary.validData.length > 0 && (
            <div className="space-y-2.5">
              <h5 className="text-xs font-black text-slate-300">أول 5 سجلات كمثال للمعاينة والتحقق:</h5>
              <div className="max-h-48 overflow-y-auto border border-white/[0.05] rounded-xl bg-black/20 divide-y divide-white/[0.05] text-xs font-medium">
                {excelImportSummary.validData.slice(0, 5).map((lead, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-white font-bold truncate">{lead.clientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">جوال: {lead.phone}</div>
                      
                      {/* Dynamic links display */}
                      {(lead.storeLink || lead.socialLink) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {lead.storeLink && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/10 text-sky-400 text-[9px] font-bold">
                              <span className="text-[10px]">🌐</span> {lead.storeLink}
                            </span>
                          )}
                          {lead.socialLink && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/10 text-indigo-400 text-[9px] font-bold">
                              <span className="text-[10px]">📱</span> {lead.socialLink}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded bg-sky-550/10 border border-sky-500/10 text-sky-450 text-[10px] font-bold">
                        {lead.dataSource || "غير محدد"}
                      </span>
                      {lead.field && (
                        <div className="text-[10px] text-slate-500">{lead.field}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-white/[0.05]">
            <Button
              onClick={handleCommitExcelImport}
              disabled={isExcelImporting || !excelImportSummary || excelImportSummary.validData.length === 0}
              className="flex-1 h-12 bg-emerald-500 font-black rounded-xl hover:bg-emerald-650 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={16} />
              <span>
                {isExcelImporting ? "جاري الاستيراد..." : `مزامنة واستيراد ${excelImportSummary?.validData?.length || 0} عميل`}
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsExcelConfirmOpen(false)}
              disabled={isExcelImporting}
              className="h-12 px-6 rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Drawer: Bulk Edit Selected Leads */}
      <Drawer
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        title={`التعديل الجماعي على العملاء: (${selectedLeadIds.length}) عميل محدد`}
        size="lg"
      >
        <form onSubmit={handleBulkUpdate} className="space-y-6 text-right" dir="rtl">
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            حدد الحقول التي ترغب في تعديلها وتحديث قيمتها لجميع الـ ({selectedLeadIds.length}) عملاء المحددين دفعة واحدة. الحقول غير المحددة لن تتأثر ولن تتغير قيمتها الأصلية لدى العملاء.
          </p>

          <div className="space-y-5">
            {/* 2. Meeting Status */}
            <div className={cn(
              "p-5 rounded-2xl backdrop-blur-md transition-all duration-300 space-y-4",
              bulkEditToggles.meetingStatus
                ? "bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-lg shadow-sky-500/5"
                : "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="toggle-bulk-meetingStatus"
                  className="w-4.5 h-4.5 rounded-lg border-white/10 text-sky-500 bg-slate-900/80 focus:ring-sky-500/40 cursor-pointer transition-all"
                  checked={bulkEditToggles.meetingStatus}
                  onChange={(e) => setBulkEditToggles({ ...bulkEditToggles, meetingStatus: e.target.checked })}
                />
                <label htmlFor="toggle-bulk-meetingStatus" className="text-sm font-black text-slate-100 cursor-pointer select-none flex items-center gap-2">
                  <Activity size={16} className={bulkEditToggles.meetingStatus ? "text-sky-400" : "text-slate-400"} />
                  <span>تعديل حالة وموقف الميتنج (meetingStatus)</span>
                </label>
              </div>
              {bulkEditToggles.meetingStatus && (
                <div className="animate-in fade-in-50 slide-in-from-top-1 duration-250">
                  <Select
                    dark
                    required
                    value={bulkEditFields.meetingStatus}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, meetingStatus: e.target.value })}
                    className="h-11 text-xs bg-[#0f172a]/90 border-sky-500/20 focus:border-sky-500/60 rounded-xl"
                  >
                    <option value="">اختر حالة الميتنج...</option>
                    {(formConfig.meetingStatuses || DEFAULT_TELESALES_FORM.meetingStatuses || [])?.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {/* 3. Contact Type */}
            <div className={cn(
              "p-5 rounded-2xl backdrop-blur-md transition-all duration-300 space-y-4",
              bulkEditToggles.contactType
                ? "bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-lg shadow-sky-500/5"
                : "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="toggle-bulk-contactType"
                  className="w-4.5 h-4.5 rounded-lg border-white/10 text-sky-500 bg-slate-900/80 focus:ring-sky-500/40 cursor-pointer transition-all"
                  checked={bulkEditToggles.contactType}
                  onChange={(e) => setBulkEditToggles({ ...bulkEditToggles, contactType: e.target.checked })}
                />
                <label htmlFor="toggle-bulk-contactType" className="text-sm font-black text-slate-100 cursor-pointer select-none flex items-center gap-2">
                  <PhoneCall size={16} className={bulkEditToggles.contactType ? "text-sky-400" : "text-slate-400"} />
                  <span>تعديل طريقة ونوع التواصل (contactType)</span>
                </label>
              </div>
              {bulkEditToggles.contactType && (
                <div className="animate-in fade-in-50 slide-in-from-top-1 duration-250">
                  <Select
                    dark
                    required
                    value={bulkEditFields.contactType}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, contactType: e.target.value })}
                    className="h-11 text-xs bg-[#0f172a]/90 border-sky-500/20 focus:border-sky-500/60 rounded-xl"
                  >
                    <option value="">اختر طريقة التواصل...</option>
                    {(formConfig.contactTypes || DEFAULT_TELESALES_FORM.contactTypes || [])?.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {/* 4. Data Source */}
            <div className={cn(
              "p-5 rounded-2xl backdrop-blur-md transition-all duration-300 space-y-4",
              bulkEditToggles.dataSource
                ? "bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-lg shadow-sky-500/5"
                : "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="toggle-bulk-dataSource"
                  className="w-4.5 h-4.5 rounded-lg border-white/10 text-sky-500 bg-slate-900/80 focus:ring-sky-500/40 cursor-pointer transition-all"
                  checked={bulkEditToggles.dataSource}
                  onChange={(e) => setBulkEditToggles({ ...bulkEditToggles, dataSource: e.target.checked })}
                />
                <label htmlFor="toggle-bulk-dataSource" className="text-sm font-black text-slate-100 cursor-pointer select-none flex items-center gap-2">
                  <Layers size={16} className={bulkEditToggles.dataSource ? "text-sky-400" : "text-slate-400"} />
                  <span>تعديل سورس الملف والمجال (dataSource)</span>
                </label>
              </div>
              {bulkEditToggles.dataSource && (
                <div className="animate-in fade-in-50 slide-in-from-top-1 duration-250">
                  <Select
                    dark
                    required
                    value={bulkEditFields.dataSource}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, dataSource: e.target.value })}
                    className="h-11 text-xs bg-[#0f172a]/90 border-sky-500/20 focus:border-sky-500/60 rounded-xl"
                  >
                    <option value="">اختر سورس الداتا والمجال...</option>
                    {(formConfig.dataSources || DEFAULT_TELESALES_FORM.dataSources || [])?.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {/* 5. Date Follow-up */}
            <div className={cn(
              "p-5 rounded-2xl backdrop-blur-md transition-all duration-300 space-y-4",
              bulkEditToggles.dateFollow
                ? "bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-lg shadow-sky-500/5"
                : "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="toggle-bulk-dateFollow"
                  className="w-4.5 h-4.5 rounded-lg border-white/10 text-sky-500 bg-slate-900/80 focus:ring-sky-500/40 cursor-pointer transition-all"
                  checked={bulkEditToggles.dateFollow}
                  onChange={(e) => setBulkEditToggles({ ...bulkEditToggles, dateFollow: e.target.checked })}
                />
                <label htmlFor="toggle-bulk-dateFollow" className="text-sm font-black text-slate-100 cursor-pointer select-none flex items-center gap-2">
                  <CalendarDays size={16} className={bulkEditToggles.dateFollow ? "text-sky-400" : "text-slate-400"} />
                  <span>تعديل تاريخ المتابعة القادم (dateFollow)</span>
                </label>
              </div>
              {bulkEditToggles.dateFollow && (
                <div className="animate-in fade-in-50 slide-in-from-top-1 duration-250">
                  <Input
                    dark
                    required
                    type="date"
                    value={bulkEditFields.dateFollow}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, dateFollow: e.target.value })}
                    className="h-11 text-xs bg-[#0f172a]/90 border-sky-500/20 focus:border-sky-500/60 rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* 6. Notes */}
            <div className={cn(
              "p-5 rounded-2xl backdrop-blur-md transition-all duration-300 space-y-4",
              bulkEditToggles.note
                ? "bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-lg shadow-sky-500/5"
                : "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
            )}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="toggle-bulk-note"
                    className="w-4.5 h-4.5 rounded-lg border-white/10 text-sky-500 bg-slate-900/80 focus:ring-sky-500/40 cursor-pointer transition-all"
                    checked={bulkEditToggles.note}
                    onChange={(e) => setBulkEditToggles({ ...bulkEditToggles, note: e.target.checked })}
                  />
                  <label htmlFor="toggle-bulk-note" className="text-sm font-black text-slate-100 cursor-pointer select-none flex items-center gap-2">
                    <Edit3 size={16} className={bulkEditToggles.note ? "text-sky-400" : "text-slate-400"} />
                    <span>إضافة ملاحظات وتحديثات جديدة (note)</span>
                  </label>
                </div>
                {bulkEditToggles.note && (
                  <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-xl border border-sky-500/20 animate-pulse duration-2000">
                    <input
                      type="checkbox"
                      id="toggle-bulk-appendNote"
                      className="w-3.5 h-3.5 rounded text-sky-500 focus:ring-sky-500/40 cursor-pointer"
                      checked={bulkEditFields.appendNote}
                      onChange={(e) => setBulkEditFields({ ...bulkEditFields, appendNote: e.target.checked })}
                    />
                    <label htmlFor="toggle-bulk-appendNote" className="text-[10px] font-bold text-sky-300 cursor-pointer select-none">
                      إلحاق الملاحظات السابقة دون حذفها
                    </label>
                  </div>
                )}
              </div>
              {bulkEditToggles.note && (
                <div className="animate-in fade-in-50 slide-in-from-top-1 duration-250">
                  <textarea
                    required
                    className="w-full h-24 rounded-xl border border-sky-500/20 bg-[#0f172a]/95 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/60 leading-relaxed font-semibold placeholder:text-slate-500"
                    placeholder="اكتب التحديث أو الملاحظة الجديدة هنا التي سيتم تطبيقها على العملاء..."
                    value={bulkEditFields.note}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, note: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-white/[0.05]">
            <Button
              type="submit"
              disabled={isExcelImporting}
              className="flex-1 h-12 bg-sky-500 font-black rounded-xl hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExcelImporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>{isExcelImporting ? "جاري الحفظ والمزامنة..." : "حفظ التعديلات الجماعية"}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBulkEditOpen(false)}
              disabled={isExcelImporting}
              className="h-12 px-6 rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Absolute Confirmation Modals */}
      {/* 1. Single Delete Confirm Modal */}
      <Modal
        isOpen={!!leadToDelete}
        onClose={() => setLeadToDelete(null)}
        title="تأكيد حذف العميل 🚨"
      >
        <div className="space-y-6 text-right" dir="rtl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-450 text-2xl">
            ⚠️
          </div>
          <div className="space-y-2 text-center">
            <h4 className="text-base font-black text-white font-sans">هل أنت متأكد من حذف العميل؟</h4>
            <p className="text-sm text-slate-400 font-bold leading-normal">
              سيتم حذف العميل <span className="text-rose-400 font-extrabold">{leadToDelete?.clientName}</span> نهائياً من قاعدة البيانات مع كافة تواصلاته ومتابعاته المسجلة.
            </p>
            <p className="text-xs text-slate-500 font-semibold">هذا الإجراء نهائي ولا يمكن التراجع عنه.</p>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-white/[0.05]">
            <Button
              onClick={handleSingleDelete}
              className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 size={16} />
              <span>نعم، احذف نهائياً</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLeadToDelete(null)}
              className="px-6 rounded-xl text-slate-300"
            >
              إلغاء الحذف
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Bulk Delete Confirm Modal */}
      <Modal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        title="تأكيد الحذف الجماعي للعملاء 🚨🗑️"
      >
        <div className="space-y-6 text-right" dir="rtl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-450 text-2xl">
            🚨
          </div>
          <div className="space-y-2 text-center font-sans">
            <h4 className="text-base font-black text-white">تحذير أمان: حذف {selectedLeadIds.length} عميل دفعة واحدة!</h4>
            <p className="text-sm text-slate-400 font-bold leading-normal mt-1">
              أنت على وشك حذف <span className="text-rose-400 font-black">{selectedLeadIds.length}</span> عميل محدد من السيستم دفعة واحدة بشكل دائم.
            </p>
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/15 p-3 rounded-xl font-semibold leading-relaxed mt-3">
              تنبيه: سيظهر هذا التعديل فوراً لدى جميع مستخدمي المنصة ولن نتمكن من استعادة البيانات المحذوفة لأي عميل بعد هذه العملية.
            </div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-white/[0.05]">
            <Button
              onClick={handleBulkDelete}
              disabled={isExcelImporting}
              className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExcelImporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              <span>{isExcelImporting ? "جاري الحذف..." : `نعم، احذف الـ ${selectedLeadIds.length} عميل`}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBulkDeleteConfirmOpen(false)}
              disabled={isExcelImporting}
              className="px-6 rounded-xl text-slate-300"
            >
              تراجع وإلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};