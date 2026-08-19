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
  MessageSquare, 
  PhoneCall, 
  Clock, 
  Globe, 
  Briefcase, 
  Users, 
  FolderPlus, 
  Sparkles 
} from "lucide-react";
import { Card, Input, Button, Select } from "@/src/components/UI";
import { useSettings, DEFAULT_TELESALES_FORM } from "@/src/hooks/useSettings";
import { cn } from "@/src/lib/utils";

interface SettingsTelesalesProps {
  showFeedback: (msg: string) => void;
}

export const SettingsTelesales: React.FC<SettingsTelesalesProps> = ({ showFeedback }) => {
  const { settings, saveSettings } = useSettings();
  const [localFormConfig, setLocalFormConfig] = useState<any>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<"dropdowns" | "fields">("dropdowns");

  // Options states
  const [newContactType, setNewContactType] = useState("");
  const [newResponseOption, setNewResponseOption] = useState("");
  const [newMeetingStatus, setNewMeetingStatus] = useState("");
  const [newDataSource, setNewDataSource] = useState("");
  const [newFieldOption, setNewFieldOption] = useState("");
  const [newBusinessTypeOption, setNewBusinessTypeOption] = useState("");
  const [newPaymentStatus, setNewPaymentStatus] = useState("");

  // Agents state
  const [newTelesalesAgentName, setNewTelesalesAgentName] = useState("");

  // Custom field state
  const [customFieldKey, setCustomFieldKey] = useState("");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [customFieldType, setCustomFieldType] = useState<"text" | "number" | "date" | "textarea">("text");
  const [customFieldRequired, setCustomFieldRequired] = useState(false);
  const [customFieldSection, setCustomFieldSection] = useState("basic_info");

  // Section state
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Initialize and merge configs
  useEffect(() => {
    if (settings.telesalesForm) {
      const raw = settings.telesalesForm;
      const merged = {
        ...DEFAULT_TELESALES_FORM,
        ...raw,
        dataSources: raw.dataSources || DEFAULT_TELESALES_FORM.dataSources,
        fieldsOptions: raw.fieldsOptions || DEFAULT_TELESALES_FORM.fieldsOptions,
        businessTypesOptions: raw.businessTypesOptions || DEFAULT_TELESALES_FORM.businessTypesOptions,
        paymentStatuses: raw.paymentStatuses || DEFAULT_TELESALES_FORM.paymentStatuses,
        sections: raw.sections || DEFAULT_TELESALES_FORM.sections,
        fieldsConfig: {
          ...DEFAULT_TELESALES_FORM.fieldsConfig,
          ...raw.fieldsConfig
        }
      };

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

  // Handle adding an option to the list
  const addOption = (type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions" | "paymentStatuses", val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
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

  // Handle removing an option
  const removeOption = (type: "contactTypes" | "responseOptions" | "meetingStatuses" | "dataSources" | "fieldsOptions" | "businessTypesOptions" | "paymentStatuses", index: number) => {
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
      await saveSettings("telesalesForm", localFormConfig);
      showFeedback("تم حفظ وتحديث إعدادات نموذج التيلي سيلز بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء المزامنة وحفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  // Agents
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
      alert("حدث خطأ أثناء إضافة موظف التيلي سيلز.");
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
          type: customFieldType,
          sectionId: customFieldSection || "basic_info"
        }
      }
    });

    setCustomFieldKey("");
    setCustomFieldLabel("");
    setCustomFieldType("text");
    setCustomFieldRequired(false);
    showFeedback("تم إدراج الحقل المخصص بنجاح!");
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
    return <div className="text-slate-500 py-6 text-center">جاري تحميل إعدادات التيلي سيلز...</div>;
  }

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-300" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <MessageSquare className="text-sky-400" size={20} />
            <span>إعدادات تخصيص نموذج ليدز التيلي سيلز (Telesales Settings)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            تحكم بقوائم التبويب، الحقول المخصصة، الأقسام وحسابات الموظفين لقسم التيلي سيلز من واجهة مركزية واحدة.
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
              <h4 className="font-black text-sm text-white">دروب ليست: أنواع التواصل وأول اتصال (contactTypes)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.contactTypes?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("contactTypes", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف نوع تواصل جديد" className="h-9 text-xs flex-1" value={newContactType} onChange={(e) => setNewContactType(e.target.value)} />
              <Button type="button" onClick={() => addOption("contactTypes", newContactType, setNewContactType)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 3: Meeting Statuses */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-rose-400">
              <Clock size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: حالات الميتنج المجدول والمنسق (meetingStatuses)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.meetingStatuses?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("meetingStatuses", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف حالة ميتنج" className="h-9 text-xs flex-1" value={newMeetingStatus} onChange={(e) => setNewMeetingStatus(e.target.value)} />
              <Button type="button" onClick={() => addOption("meetingStatuses", newMeetingStatus, setNewMeetingStatus)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 4: Data Sources */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-emerald-450">
              <Globe size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: مصادر ومجلدات الملفات (dataSources)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/25 p-3 rounded-xl border border-white/[0.02] max-h-[150px] overflow-y-auto no-scrollbar">
              {localFormConfig.dataSources?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("dataSources", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف سورس داتا مخصص" className="h-9 text-xs flex-1" value={newDataSource} onChange={(e) => setNewDataSource(e.target.value)} />
              <Button type="button" onClick={() => addOption("dataSources", newDataSource, setNewDataSource)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 5: Field Options */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-violet-400">
              <Briefcase size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: مجالات وقطاعات النشاط (fieldsOptions)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.fieldsOptions?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("fieldsOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
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
              <h4 className="font-black text-sm text-white">دروب ليست: الكيانات وأنواع الشركات الوثائقية (businessTypesOptions)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {localFormConfig.businessTypesOptions?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("businessTypesOptions", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف وثيقة أو كيان مخصص" className="h-9 text-xs flex-1" value={newBusinessTypeOption} onChange={(e) => setNewBusinessTypeOption(e.target.value)} />
              <Button type="button" onClick={() => addOption("businessTypesOptions", newBusinessTypeOption, setNewBusinessTypeOption)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>

          {/* Card 7: Payment Statuses */}
          <Card glass className="p-5 border-white/[0.05] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-sky-400 font-sans">
              <Sliders size={16} />
              <h4 className="font-black text-sm text-white">دروب ليست: حالة الدفع والتعاقد في قسم التيلي (paymentStatuses)</h4>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start bg-slate-950/20 p-3 rounded-xl border border-white/[0.02]">
              {(localFormConfig.paymentStatuses || DEFAULT_TELESALES_FORM.paymentStatuses)?.map((opt: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/10 rounded-lg px-2.5 py-1">
                  <span>{opt}</span>
                  <button type="button" onClick={() => removeOption("paymentStatuses", idx)} className="text-rose-400 hover:text-rose-300 font-extrabold pr-1 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input dark placeholder="أضف حالة دفع جديدة" className="h-9 text-xs flex-1" value={newPaymentStatus} onChange={(e) => setNewPaymentStatus(e.target.value)} />
              <Button type="button" onClick={() => addOption("paymentStatuses", newPaymentStatus, setNewPaymentStatus)} className="h-9 px-4 text-xs bg-sky-500 hover:bg-sky-600 font-bold text-white rounded-xl">أضف</Button>
            </div>
          </Card>
        </div>
      )}


    </div>
  );
};
