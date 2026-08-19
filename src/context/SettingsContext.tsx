import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import {
  Settings as SystemSettings,
  SettingItem,
  AgentCommissionSetting,
  TeamCommissionSetting,
  TelesalesFormSetting
} from "@/src/types";

// ---------------------------------------------------------------------------
// Form defaults — unchanged from the original useSettings.ts
// ---------------------------------------------------------------------------
export const DEFAULT_TELESALES_FORM: TelesalesFormSetting = {
  contactTypes: ["واتساب", "اتصال هاتفي", "بريد ومراسلة", "سوشيال ميديا"],
  responseOptions: ["مهتم وسعيد بالخدمة", "يطلب ميتنج فوري", "مهتم بالخدمة مستقبلا", "مشغول حاليا", "لا توجد استجابة", "غير مهتم"],
  meetingStatuses: ["مجدول", "تحت المتابعة", "تم الميتنج", "تأجل الموعد", "ملغي", "لم يحضر"],
  paymentStatuses: ["لم يحدد", "تم تقديم عرض سعر", "تم التعاقد", "قيد المتابعة والتحصيل"],
  dataSources: [
    "داتا/مركز سعودي", "داتا/جوجل ماب", "داتا/جوجل سيرش", "داتا/قديمة / شيتات", "داتا/سلة",
    "ليدز سناب", "ليدز تيكتوك", "واتس اب دايركت", "رسائل انستجرام", "متابعة قديمة",
    "من شركة منافسة", "داتا/مزيد", "داتا/محلي"
  ],
  fieldsOptions: [
    "متاجر الكترونية", "خدمات وتقنية", "مطاعم وكافيهات", "عقارات ومقاولات", "تعليم وتدريب",
    "طبي وصحي", "أغذية ومشروبات", "استشارات وأعمال", "أخرى"
  ],
  businessTypesOptions: [
    "سجل تجاري شركة", "سجل تجاري مؤسسة", "وثيقة عمل حر", "رخصة صناعية", "أفراد / بدون وثيقة"
  ],
  sections: [
    { id: "basic_info", title: "بيانات العميل والمسؤول الأساسية", order: 1 },
    { id: "business_details", title: "تفاصيل العمل والنشاط التجاري", order: 2 },
    { id: "contact_followups", title: "التواصل ومخرجات الميتنج والمتابعات", order: 3 },
    { id: "whatsapp_notes", title: "سكريبت التيلي سيلز", order: 4 }
  ],
  fieldsConfig: {
    date: { label: "تاريخ التسجيل مالي / الإضافة", visible: true, required: true, sectionId: "basic_info" },
    agentName: { label: "مسؤول المبيعات (Agent)", visible: true, required: true, sectionId: "basic_info" },
    clientName: { label: "اسم العميل الكامل", visible: true, required: true, sectionId: "basic_info" },
    phone: { label: "رقم الجوال الفعال", visible: true, required: true, sectionId: "basic_info" },
    additionalPhone: { label: "رقم هاتف إضافي (اختياري)", visible: true, required: false, sectionId: "basic_info" },
    field: { label: "المجال / قطاع النشاط", visible: true, required: false, sectionId: "business_details" },
    dataSource: { label: "سورس الداتا (مصدر الملف)", visible: true, required: false, sectionId: "business_details" },
    storeLink: { label: "رابط المتجر الإلكتروني / الموقع", visible: true, required: false, sectionId: "business_details" },
    additionalStore: { label: "رابط الموقع / المتجر الإضافي (اختياري)", visible: true, required: false, sectionId: "business_details" },
    socialLink: { label: "رابط السوشيال ميديا", visible: true, required: false, sectionId: "business_details" },
    businessType: { label: "نوع البيزنس / الوثيقة", visible: true, required: false, sectionId: "business_details" },
    firstContactDate: { label: "تاريخ أول تواصل", visible: true, required: false, sectionId: "contact_followups" },
    contactType: { label: "نوع التواصل", visible: true, required: false, sectionId: "contact_followups" },
    response: { label: "الاستجابة والرد", visible: false, required: false, sectionId: "contact_followups" },
    firstContactOutcome: { label: "مخرجات أول تواصل", visible: false, required: false, sectionId: "contact_followups" },
    meetingStatus: { label: "حالة الميتنج (Meeting Status)", visible: true, required: false, sectionId: "contact_followups" },
    dateFollow: { label: "موعد المتابعة القادم (Date Follow)", visible: true, required: false, sectionId: "contact_followups" },
    telesalesBrief: { label: "بريف التيلي سيلز (Telesales Brief)", visible: true, required: false, sectionId: "contact_followups", type: "textarea" },
    followupUpdate: { label: "تحديث المتابعة", visible: true, required: false, sectionId: "contact_followups", type: "select" },
    whatsappMessageText: { label: "ادارة الاسكريبتات بتساعدنا في تحسين أداءئك واداء الفريق", visible: true, required: false, sectionId: "whatsapp_notes", type: "textarea" },
    note: { label: "ملاحظات وتفاصيل إضافية", visible: false, required: false, sectionId: "whatsapp_notes" },
    paymentStatus: { label: "حالة الدفع والتعاقد", visible: false, required: false, sectionId: "contact_followups" },
  }
};

export const DEFAULT_SALES_FORM: TelesalesFormSetting = {
  contactTypes: ["واتساب", "اتصال هاتفي", "اجتماع حضوري", "اجتماع زووم", "بريد ومراسلة"],
  responseOptions: ["مستعد للتعاقد", "تم تقديم عرض السعر", "يطلب ميتنج فوري", "مفاوضات جارية", "مشغول حاليا", "غير مستجيب", "عرض سعر مرفوض", "غير مهتم"],
  meetingStatuses: ["مجدول", "تم الاجتماع", "بانتظار العميل", "مؤجل", "ملغي", "لم يحضر"],
  leadStatuses: ["HOT", "WARM", "COLD", "DEAD"],
  decisionMakers: ["YES", "PARTNER", "NON"],
  packages: ["الباقة البرونزية", "الباقة الفضية", "الباقة الذهبية", "الباقة الماسية", "باقة مخصصة"],
  paids: ["YES", "NO"],
  dataSources: [
    "ليدز فيسبوك", "ليدز انستجرام", "ليدز سناب شات", "ليدز تيكتوك", "ليدز جوجل",
    "بحث مباشر ماب", "موقع إلكتروني", "واتساب مباشر", "من التيلي سيلز (محول)",
    "ترشيحات وعملاء سابقين", "أخرى"
  ],
  fieldsOptions: [
    "متاجر الكترونية", "خدمات وتقنية", "مطاعم وكافيهات", "عقارات ومقاولات", "تعليم وتدريب",
    "طبي وصحي", "أغذية ومشروبات", "استشارات وأعمال", "أخرى"
  ],
  businessTypesOptions: [
    "سجل تجاري شركة", "سجل تجاري مؤسسة", "وثيقة عمل حر", "رخصة صناعية", "أفراد / بدون وثيقة"
  ],
  sections: [
    { id: "basic_info", title: "بيانات العميل والمسؤول الأساسية", order: 1 },
    { id: "business_details", title: "تفاصيل العمل والنشاط التجاري", order: 2 },
    { id: "contact_followups", title: "التواصل ومخرجات الميتنج والمتابعات", order: 3 },
    { id: "whatsapp_notes", title: "سكريبت التيلي سيلز", order: 4 }
  ],
  fieldsConfig: {
    date: { label: "تاريخ التسجيل مالي / الإضافة", visible: true, required: true, sectionId: "basic_info" },
    agentName: { label: "مسؤول المبيعات المباشر (Sales Agent)", visible: true, required: true, sectionId: "basic_info" },
    clientName: { label: "اسم العميل الكامل", visible: true, required: true, sectionId: "basic_info" },
    phone: { label: "رقم الجوال الفعال", visible: true, required: true, sectionId: "basic_info" },
    additionalPhone: { label: "رقم هاتف إضافي (اختياري)", visible: true, required: false, sectionId: "basic_info" },
    field: { label: "المجال / قطاع النشاط", visible: true, required: false, sectionId: "business_details" },
    dataSource: { label: "سورس الداتا (مصدر الملف)", visible: true, required: false, sectionId: "business_details" },
    storeLink: { label: "رابط المتجر الإلكتروني / الموقع", visible: true, required: false, sectionId: "business_details" },
    additionalStore: { label: "رابط الموقع / المتجر الإضافي (اختياري)", visible: true, required: false, sectionId: "business_details" },
    socialLink: { label: "رابط السوشيال ميديا", visible: true, required: false, sectionId: "business_details" },
    businessType: { label: "نوع البيزنس / الوثيقة", visible: true, required: false, sectionId: "business_details" },
    firstContactDate: { label: "تاريخ أول تواصل", visible: true, required: false, sectionId: "contact_followups" },
    contactType: { label: "نوع التواصل", visible: true, required: false, sectionId: "contact_followups" },
    response: { label: "الاستجابة والرد", visible: false, required: false, sectionId: "contact_followups" },
    firstContactOutcome: { label: "مخرجات أول تواصل", visible: false, required: false, sectionId: "contact_followups" },
    meetingStatus: { label: "حالة الاجتماع (Meeting Status)", visible: true, required: false, sectionId: "contact_followups" },
    dateFollow: { label: "موعد المتابعة القادم (Date Follow)", visible: true, required: false, sectionId: "contact_followups" },
    telesalesBrief: { label: "بريف التيلي سيلز (Telesales Brief)", visible: true, required: false, sectionId: "contact_followups", type: "textarea" },
    followupUpdate: { label: "تحديث المتابعة", visible: true, required: false, sectionId: "contact_followups", type: "select" },
    whatsappMessageText: { label: "ادارة الاسكريبتات بتساعدنا في تحسين أداءئك واداء الفريق", visible: true, required: false, sectionId: "whatsapp_notes", type: "textarea" },
    note: { label: "ملاحظات وتفاصيل إضافية", visible: false, required: false, sectionId: "whatsapp_notes" },
  }
};

const DEFAULT_SETTINGS: SystemSettings = {
  serviceTypes: [],
  paymentMethods: [],
  currencies: [],
  csoList: [],
  salesManagers: [],
  salesAgents: [],
  teleSalesManagers: [],
  teleSalesAgents: [],
  clientStatuses: [],
  accountManagers: [],
  marketingManagers: [],
  departments: [],
  workGroups: [],
  agentCommissions: [],
  teamCommissions: [],
  apiIntegrations: {
    gemini: "", whatsapp: "", meta: "", tiktok: "", googleAds: "", googleSheets: "", smtp: "", customApi: "",
  },
  generalSettings: {
    agencyName: "MADAR SALES CRM", agencyLogo: "", timezone: "UTC+3", dateFormat: "YYYY-MM-DD",
  },
  telesalesForm: DEFAULT_TELESALES_FORM,
  salesForm: DEFAULT_SALES_FORM,
  targets: {
    telesalesDeptTarget: 0, salesDeptTarget: 0, salesAgentMonthlyTarget: 0, telesalesAgentMonthlyTarget: 0
  }
};

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean; // kept as `loading` (not `settingsLoading`) — matches the original
                     // useSettings() shape so every existing `{ settings, loading, saveSettings }`
                     // call site across the app keeps compiling unchanged.
  saveSettings: (key: string, data: any) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Settings Layer — owns the `settings` Firestore collection ONLY.
 * Its only dependency is Firestore itself. It does NOT import AuthContext
 * or DataContext, so it can never be part of any provider-order cycle.
 */
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSettings = onSnapshot(
      collection(db, "settings"),
      (snapshot) => {
        const newSettings = { ...DEFAULT_SETTINGS };
        snapshot.docs.forEach((docSnap) => {
          const key = docSnap.id as keyof SystemSettings;
          if (docSnap.id === "teamSettings") {
            const rawData = docSnap.data() as any;
            const cleanedData: any = {};
            if (rawData) {
              Object.keys(rawData).forEach((teamKey) => {
                const members = rawData[teamKey];
                cleanedData[teamKey] = Array.isArray(members) ? members : members;
              });
            }
            newSettings.teamSettings = cleanedData;
          } else if (docSnap.id === "apiIntegrations") {
            newSettings.apiIntegrations = { ...DEFAULT_SETTINGS.apiIntegrations, ...docSnap.data() };
          } else if (docSnap.id === "generalSettings") {
            newSettings.generalSettings = { ...DEFAULT_SETTINGS.generalSettings, ...docSnap.data() };
          } else if (docSnap.id === "telesalesForm") {
            newSettings.telesalesForm = { ...DEFAULT_TELESALES_FORM, ...docSnap.data() };
          } else if (docSnap.id === "salesForm") {
            newSettings.salesForm = { ...DEFAULT_SALES_FORM, ...docSnap.data() };
          } else if (docSnap.id === "targets") {
            newSettings.targets = { ...DEFAULT_SETTINGS.targets, ...docSnap.data() };
          } else if (newSettings.hasOwnProperty(key)) {
            const rawItems = (docSnap.data() as any).items || [];
            (newSettings as any)[key] = rawItems;
          }
        });
        setSettings(newSettings);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "settings");
        setLoading(false);
      }
    );
    return () => unsubSettings();
  }, []);

  const saveSettings = async (key: string, data: any) => {
    // Optimistic local update
    setSettings(prev => ({ ...prev, [key]: data }));
    try {
      await setDoc(doc(db, "settings", key), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${key}`);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
