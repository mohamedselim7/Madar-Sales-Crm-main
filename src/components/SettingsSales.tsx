import React, { useState, useEffect } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Plus, 
  Sliders, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  Briefcase, 
  Users, 
  FolderPlus, 
  Sparkles,
  PhoneCall,
  Clock,
  Globe
} from "lucide-react";
import { Card, Input, Button, Select } from "@/src/components/UI";
import { useSettings, DEFAULT_SALES_FORM } from "@/src/hooks/useSettings";
import { cn } from "@/src/lib/utils";

interface SettingsSalesProps {
  showFeedback: (msg: string) => void;
}

export const SettingsSales: React.FC<SettingsSalesProps> = ({ showFeedback }) => {
  const { settings, saveSettings } = useSettings();
  const [localFormConfig, setLocalFormConfig] = useState<any>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<"dropdowns" | "fields">("dropdowns");

  // Options states
  const [newContactType, setNewContactType] = useState("");
  const [newResponseOption, setNewResponseOption] = useState("");
  const [newMeetingStatus, setNewMeetingStatus] = useState("");
  const [newDataSource, setNewDataSource] = useState("");
  const [newFieldOption, setNewFieldOption] = useState("");
  const [newBusinessTypeOption, setNewBusinessTypeOption] = useState("سجل تجاري شركة");
  
  // Custom dropdown lists draft states
  const [newLeadStatus, setNewLeadStatus] = useState("");
  const [newDecisionMaker, setNewDecisionMaker] = useState("");
  const [newPackage, setNewPackage] = useState("");
  const [newPaid, setNewPaid] = useState("");

  // Agents state
  const [newSalesAgentName, setNewSalesAgentName] = useState("");

  // Custom field state
  const [customFieldKey, setCustomFieldKey] = useState("");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [customFieldType, setCustomFieldType] = useState<"text" | "number" | "date" | "textarea font-sans">("text");
  const [customFieldRequired, setCustomFieldRequired] = useState(false);
  const [customFieldSection, setCustomFieldSection] = useState("basic_info");

  // Section state
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Initialize and merge configs
  useEffect(() => {
    if (settings.salesForm) {
      const raw = settings.salesForm;
      const merged = {
        ...DEFAULT_SALES_FORM,
        ...raw,
        dataSources: raw.dataSources || DEFAULT_SALES_FORM.dataSources,
        fieldsOptions: raw.fieldsOptions || DEFAULT_SALES_FORM.fieldsOptions,
        businessTypesOptions: raw.businessTypesOptions || DEFAULT_SALES_FORM.businessTypesOptions,
        leadStatuses: raw.leadStatuses || DEFAULT_SALES_FORM.leadStatuses,
        decisionMakers: raw.decisionMakers || DEFAULT_SALES_FORM.decisionMakers,
        packages: raw.packages || DEFAULT_SALES_FORM.packages,
        paids: raw.paids || DEFAULT_SALES_FORM.paids,
        sections: raw.sections || DEFAULT_SALES_FORM.sections,
        fieldsConfig: {
          ...DEFAULT_SALES_FORM.fieldsConfig,
          ...raw.fieldsConfig
        }
      };

      const sections = merged.sections || [];
      const defaultSecId = sections[0]?.id || "basic_info";

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

      setLocalFormConfig(merged);
    } else {
      setLocalFormConfig({ ...DEFAULT_SALES_FORM });
    }
  }, [settings.salesForm]);

  // Handle adding an option to the list
  const addOption = (
    type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions" | "leadStatuses" | "decisionMakers" | "packages" | "paids", 
    val: string, 
    setVal: React.Dispatch<React.SetStateAction<string>>
  ) => {
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

  // Handle removing an option
  const removeOption = (
    type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions" | "leadStatuses" | "decisionMakers" | "packages" | "paids", 
    index: number
  ) => {
    if (!localFormConfig) return;
    const currentList = localFormConfig[type] || [];
    const list = [...currentList];
    list.splice(index, 1);
    setLocalFormConfig({
      ...localFormConfig,
      [type]: list
    });
  };

  // Field change
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

  // Save full configurations
  const handleSaveConfig = async () => {
    if (!localFormConfig) return;
    setIsSaving(true);
    try {
      await saveSettings("salesForm", localFormConfig);
      showFeedback("تم حفظ وتحديث إعدادات وحقول نموذج عملاء المبيعات بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ وتحديث التعديلات على الخادم.");
    } finally {
      setIsSaving(false);
    }
  };

  // Agents
  const handleAddSalesAgent = async () => {
    if (!newSalesAgentName.trim()) return;
    try {
      const currentAgents = settings.salesAgents || [];
      const updatedAgents = [...currentAgents, { id: Date.now().toString(), name: newSalesAgentName.trim() }];
      await saveSettings("salesAgents", { items: updatedAgents });
      setNewSalesAgentName("");
      showFeedback("تم إضافة موظف مبيعات جديد بنجاح!");
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

  // Section actions
  const handleAddSection = () => {
    if (!newSectionTitle.trim() || !localFormConfig) return;
    const currentSections = localFormConfig.sections || [];
    const maxOrder = currentSections.reduce((max: number, s: any) => Math.max(max, s.order || 0), 0);
    const newId = `section_${Date.now()}`;
    const updated = [
      ...currentSections,
      { id: newId, title: newSectionTitle.trim(), order: maxOrder + 1 }
    ];
    setLocalFormConfig({
      ...localFormConfig,
      sections: updated
    });
    setNewSectionTitle("");
    showFeedback("تم إنشاء قسم مخصص جديد للنموذج!");
  };

  const handleSectionTitleChange = (sectionId: string, value: string) => {
    if (!localFormConfig) return;
    const updated = (localFormConfig.sections || []).map((s: any) => {
      if (s.id === sectionId) {
        return { ...s, title: value };
      }
      return s;
    });
    setLocalFormConfig({
      ...localFormConfig,
      sections: updated
    });
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    if (!localFormConfig) return;
    const sections = [...(localFormConfig.sections || [])];
    const index = sections.findIndex((s: any) => s.id === sectionId);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      const temp = sections[index].order;
      sections[index].order = sections[index - 1].order;
      sections[index - 1].order = temp;
    } else if (direction === "down" && index < sections.length - 1) {
      const temp = sections[index].order;
      sections[index].order = sections[index + 1].order;
      sections[index + 1].order = temp;
    }

    setLocalFormConfig({
      ...localFormConfig,
      sections: sections.sort((a, b) => (a.order || 0) - (b.order || 0))
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!localFormConfig) return;
    if (confirm("هل أنت متأكد من حذف هذا القسم بالكامل؟")) {
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

  // Add custom field
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
          type: customFieldType.replace(" font-sans", ""),
          sectionId: customFieldSection || "basic_info"
        }
      }
    });

    setCustomFieldKey("");
    setCustomFieldLabel("");
    setCustomFieldType("text");
    setCustomFieldRequired(false);
    showFeedback("تم إدراج الحقل المخصص بنجاح للحفظ!");
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
      showFeedback("تم إزالة الحقل بنجاح.");
    }
  };

  if (!localFormConfig) {
    return <div className="text-slate-500 py-6 text-center font-bold">جاري تحميل إعدادات السيلز...</div>;
  }

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-300" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Briefcase className="text-sky-400" size={20} />
            <span>إعدادات نموذج ليدز واستمارة السيلز (Sales CRM Settings)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            تحكم بقوائم التبويب، الحقول المخصصة، الفئات المنسدلة وموظفي وأعضاء فريق قسم المبيعات المباشرين.
          </p>
        </div>
        <Button 
          type="button" 
          onClick={handleSaveConfig} 
          disabled={isSaving}
          className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 font-extrabold text-xs flex items-center gap-2 text-white rounded-xl shadow-lg transition-all"
        >
          <Save size={14} />
          <span>{isSaving ? "جاري الحفظ والمزامنة..." : "حفظ المزامنة لجميع الأجهزة"}</span>
        </Button>
      </div>



      {settingsSubTab === "dropdowns" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Contact Types */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-sky-400">
              <PhoneCall size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: أنواع وقنوات الاتصال البدئية (contactTypes)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.contactTypes?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("contactTypes", idx)} className="text-rose-450 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف قناة اتصال جديدة" className="h-9 text-xs flex-1" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} />
              <Button type="button" onClick={() => addOption("contactTypes", newContactType, setNewContactType)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 3: Meeting Statuses */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-rose-400">
              <Clock size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: حالات المقابلات والاجتماعات الميدانية (meetingStatuses)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.meetingStatuses?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("meetingStatuses", idx)} className="text-rose-450 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف حالة اجتماع جديدة" className="h-9 text-xs flex-1" value={newMeetingStatus} onChange={(e) => setNewMeetingStatus(e.target.value)} />
              <Button type="button" onClick={() => addOption("meetingStatuses", newMeetingStatus, setNewMeetingStatus)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 4: Data Sources */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-emerald-450">
              <Globe size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: قنوات جلب الليدز وخدمة السورس (dataSources)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02] max-h-[150px] overflow-y-auto no-scrollbar">
              {localFormConfig.dataSources?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("dataSources", idx)} className="text-rose-450 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف سورس جذب مخصص" className="h-9 text-xs flex-1" value={newDataSource} onChange={(e) => setNewDataSource(e.target.value)} />
              <Button type="button" onClick={() => addOption("dataSources", newDataSource, setNewDataSource)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 5: Field Options */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-violet-400">
              <Briefcase size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: وتصنيف قطاعات المشاريع مبيعات (fieldsOptions)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.fieldsOptions?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("fieldsOptions", idx)} className="text-rose-450 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف قطاعاً جديداً" className="h-9 text-xs flex-1" value={newFieldOption} onChange={(e) => setNewFieldOption(e.target.value)} />
              <Button type="button" onClick={() => addOption("fieldsOptions", newFieldOption, setNewFieldOption)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 6: Business Types Options */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-amber-500">
              <Sliders size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: أنواع عقود والكيانات القانونية للمتاجر والمؤسسات</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.businessTypesOptions?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("businessTypesOptions", idx)} className="text-rose-455 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف وثيقة أو كيان جديد" className="h-9 text-xs flex-1" value={newBusinessTypeOption} onChange={(e) => setNewBusinessTypeOption(e.target.value)} />
              <Button type="button" onClick={() => addOption("businessTypesOptions", newBusinessTypeOption, setNewBusinessTypeOption)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 7: Lead Statuses */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-rose-500">
              <Sparkles size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: حالة العميل المحتمل (leadStatuses)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.leadStatuses?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-500/10 text-rose-350 border border-rose-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("leadStatuses", idx)} className="text-rose-455 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف حالة عميل (مثال: HOT)" className="h-9 text-xs flex-1" value={newLeadStatus} onChange={(e) => setNewLeadStatus(e.target.value)} />
              <Button type="button" onClick={() => addOption("leadStatuses", newLeadStatus, setNewLeadStatus)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 8: Decision Makers */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-emerald-500">
              <Users size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: أصحاب القرار (decisionMakers)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.decisionMakers?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-350 border border-emerald-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("decisionMakers", idx)} className="text-rose-455 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف خيار صاحب قرار (YES)" className="h-9 text-xs flex-1" value={newDecisionMaker} onChange={(e) => setNewDecisionMaker(e.target.value)} />
              <Button type="button" onClick={() => addOption("decisionMakers", newDecisionMaker, setNewDecisionMaker)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 9: Packages */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-indigo-455">
              <Briefcase size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: الباقة (packages)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.packages?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-indigo-500/10 text-indigo-350 border border-indigo-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("packages", idx)} className="text-rose-455 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف باقة جديدة (مثال: الباقة البرونزية)" className="h-9 text-xs flex-1" value={newPackage} onChange={(e) => setNewPackage(e.target.value)} />
              <Button type="button" onClick={() => addOption("packages", newPackage, setNewPackage)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 10: PAID */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-sky-400">
              <Sliders size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: حالة السداد PAID (paids)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.paids?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-sky-500/10 text-sky-350 border border-sky-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("paids", idx)} className="text-rose-455 hover:text-rose-400 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف خيار دفع (YES)" className="h-9 text-xs flex-1" value={newPaid} onChange={(e) => setNewPaid(e.target.value)} />
              <Button type="button" onClick={() => addOption("paids", newPaid, setNewPaid)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>
        </div>
      )}


    </div>
  );
};
