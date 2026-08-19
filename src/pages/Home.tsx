import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Users, 
  PhoneCall, 
  Target, 
  Wrench,
  Settings as SettingsIcon,
  Quote,
  Shuffle
} from "lucide-react";
import { Card, Button, InteractiveBanner } from "@/src/components/UI";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/hooks/useUserRole";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";

const DEFAULT_MESSAGES = [
  "النجاح لا يأتي من ما تفعله من حين لآخر، بل مما تفعله باستمرار. يومك سعيد ومليء بالانجازات!",
  "ثق بنفسك وبقدراتك؛ فكل عميل تتواصل معه اليوم هو فرصة جديدة لمجد جديد.",
  "التميز ليس فعلاً، بل هو عادة. اجعل اتصالاتك اليوم تفوق توقعات الجميع.",
  "سر النجاح هو البدء بتركيز كامل وعزيمة لا تلين. بالتوفيق يا بطل!",
  "أفضل طريقة للتنبؤ بالمستقبل هي أن تصنعه بنفسك. خطوتك القادمة هي الفارق.",
  "العقبات هي تلك الأشياء المخيفة التي تراها عندما ترفع عينيك عن هدفك ورسالتك.",
  "اجعل شغفك محركاً لنجاحك، فكل رغبة صادقة تفتح لك أبواب التعاقد والمبيعات.",
  "كل يوم جديد هو فرصة جديدة لتجاوز أرقامك القياسية السابقة وتأكيد ريادتك.",
  "الإصرار على النجاح يضمن لك الوصول لأعلى مستويات الاحترافية والتميز اليوم.",
  "العمل كفريق يبني إمبراطورية المبيعات. تعاون، شارك، وانطلق بقوة!",
  "كن شغوفاً بعملك وسيبحث عنك النجاح تلقائياً. كل التوفيق في مهامك اليوم.",
  "كل تواصل تقوم به بابتسامة وثقة تصنع به فارقاً كبيراً في عقل العميل.",
  "ركز على تقديم قيمة حقيقية للعميل أولاً، وستأتي العقود والأرقام تِباعاً.",
  "التحديات هي ما يجعل الحياة مثيرة، والتغلب عليها هو ما يجعلها ذات مغزى.",
  "لا تنتظر الفرصة المناسبة، بل اصنعها بذكائك ومبادرتك وتواصلك الفعال.",
  "كل مكالمة أو اجتماع اليوم هو خطوة تقربك خطوة إضافية نحو تحقيق هدفك الشهري.",
  "القوة لا تأتي من القدرة الجسدية، بل من إرادة لا تقهر وعزيمة صلبة.",
  "لا توجد حدود لما يمكنك تحقيقه اليوم باستثناء الحدود التي تضعها في عقلك.",
  "ابدأ يومك بابتسامة وتفاؤل، فالسعادة هي الوقود الحقيقي للإنتاجية والنجاح.",
  "احرص على أن تكون أفضل نسخة من نفسك اليوم، فالعملاء يشعرون بالصدق والشغف.",
  "النجاح هو حصيلة مجهودات صغيرة تتكرر يوماً بعد يوم بكل حب وإبداع.",
  "السر الحقيقي للنمو هو الاستمرار في التعلم وتطوير مهارات الإقناع وأساليب الحوار.",
  "ضع قلبك وعقلك وروحك في أصغر أعمالك اليوم، فهذا هو سر النجاح العظيم.",
  "أنت اليوم حيث قادتك أفكارك، وستكون غداً حيث تأخذك أفكارك اليوم.",
  "كل جهد تبذله اليوم هو استثمار حقيقي في مستقبلك المهني والشخصي.",
  "كن مصمماً على الفوز، فالخط الصعب ينتهي دائماً بالوصول إلى القمة.",
  "توقع الأفضل، واستعد للعمل بجد، وتجاهل الأصوات المحبطة لترتفع في عنان السماء.",
  "أعظم متعة في الحياة هي إنجاز ما كان الآخرون يعتقدون أنك لا تستطيع إنجازه.",
  "الوقت كنز ثمين، استثمره في بناء علاقات قوية وصادقة مع عملائك اليوم.",
  "اختم شهرك ومسيرتك اليوم بروح البطل المحارب الذي لا يرضى بغير القمة شريكاً."
];

export const HomePage: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const { memberInfo, allowedPages } = useUserRole();
  const [dbMessages, setDbMessages] = useState<string[]>([]);
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch customizable daily messages from settings
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "dailyMessages"),
      (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data().items)) {
          setDbMessages(docSnap.data().items);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "settings/dailyMessages");
      }
    );
    return () => unsub();
  }, []);

  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "صباح الخير";
    return "مساء الخير";
  }, []);

  // Employee Name priorities: member settings Name -> user account display name -> email localpart
  const employeeName = useMemo(() => {
    return memberInfo?.name || user?.displayName || user?.email?.split("@")[0] || "شريك النجاح";
  }, [memberInfo, user]);

  // Today's message logic - supports dynamic shuffling and fallback lists
  const defaultIndex = useMemo(() => {
    const dayOfMonth = new Date().getDate(); // 1 - 31
    return (dayOfMonth - 1) % DEFAULT_MESSAGES.length;
  }, []);

  const [currentMessageIndex, setCurrentMessageIndex] = useState<number>(defaultIndex);

  const activeMessagesSource = useMemo(() => {
    const available = dbMessages.filter(m => m && m.trim() !== "");
    return available.length > 0 ? available : DEFAULT_MESSAGES;
  }, [dbMessages]);

  const todayMessage = useMemo(() => {
    const idx = currentMessageIndex % activeMessagesSource.length;
    return activeMessagesSource[idx] || DEFAULT_MESSAGES[0];
  }, [activeMessagesSource, currentMessageIndex]);

  const handleShuffleQuote = () => {
    // Generate a random quote index that is different from current if possible
    let nextIdx = Math.floor(Math.random() * activeMessagesSource.length);
    if (nextIdx === currentMessageIndex && activeMessagesSource.length > 1) {
      nextIdx = (nextIdx + 1) % activeMessagesSource.length;
    }
    setCurrentMessageIndex(nextIdx);
  };

  const activeQuickActions = [
    { id: "telesales", label: "إدارة قسم التيلي سيلز", desc: "نظام إدارة البيانات الكلي، وتوزيع العملاء المحتملين والتحويلات على مسؤولي المبيعات الهاتفيين.", icon: PhoneCall, show: allowedPages.includes("telesales") },
    { id: "telesales_agent", label: "مساحة عمل التيلي سيلز", desc: "قم بتسجيل وتوثيق المكالمات، تنظيم المواعيد، ومتابعة العملاء المحتملين لزيادة كفاءة المبيعات.", icon: Users, show: allowedPages.includes("telesales_agent") },
    { id: "sales_agent", label: "مساحة عمل السيلز (بيانات العملاء)", desc: "استعراض بيانات العملاء والصفقات والاجتماعات ومزامنتها مباشرة.", icon: Target, show: allowedPages.includes("sales_agent") },
    { id: "sales_hub", label: "إدارة قسم المبيعات", desc: "متابعة وإتمام الصفقات المحالة من قسم الاتصالات الهاتفية لتحقيق أفضل نسب إغلاق للمبيعات.", icon: TrendingUp, show: allowedPages.includes("sales_hub") },
    { id: "sales_tools", label: "أدوات التحليل المتقدمة", desc: "أدوات تحليلية متقدمة لنشاط المواقع الإلكترونية والشبكات الاجتماعية لدعم جودة المقترحات المقدمة للعملاء.", icon: Wrench, show: allowedPages.includes("sales_tools") },
    { id: "settings", label: "الإعدادات العامة", desc: "إدارة وصلاحيات الموظفين، تهيئة حقول استمارات المبيعات، وتحديث الرسائل التحفيزية اليومية.", icon: SettingsIcon, show: allowedPages.includes("settings") || user?.email === "abdelrahmanahmed011147@gmail.com" },
  ].filter(action => action.show);

  return (
    <div className="space-y-12 pb-20 relative z-10 overflow-hidden" dir="rtl">
      {/* Dynamic drifting background neon glowing points */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sky-500/5 blur-[150px] rounded-full pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-purple-500/5 blur-[180px] rounded-full pointer-events-none animate-pulse duration-[12000ms]" />
      <div className="absolute bottom-[-10%] left-[10%] w-[450px] h-[450px] bg-rose-500/5 blur-[130px] rounded-full pointer-events-none animate-pulse duration-[10000ms]" />

      {/* Hero Welcome banner with high-end luxury gradient shifting styling */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full"
      >
        <InteractiveBanner className="bg-gradient-to-br from-[#020b22] via-[#041133] to-[#0f1d44] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-10 md:p-14">
          {/* Background glows inside hero */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
            <div className="space-y-4 max-w-2xl text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-sky-400/10 to-indigo-500/10 border border-sky-400/20 text-sky-400 text-xs font-black uppercase tracking-widest">
                <Sparkles size={14} className="animate-pulse text-indigo-400" />
                <span>مرحبًا بك في النظام الإداري لوكالة مدار.</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {greeting}، يا <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-indigo-500 bg-clip-text text-transparent font-black">{employeeName}</span>
              </h1>
              <p className="text-slate-400 text-base md:text-lg font-medium leading-relaxed whitespace-pre-line">
                تم تصميم هذا النظام لمساعدتك في إنجاز أعمالك بكفاءة ويسر.
                كل معلومة إضافية تسجلها وكل متابعة تقوم بها تسهم بشكل مباشر في نجاح وتفوق الجميع.
                نتمنى لك يوم عمل موفقًا ومثمرًا.
              </p>
            </div>

            {/* Time & Digital Clock Widget - Framed beautifully */}
            <div className="p-6 md:p-8 bg-[#020b22]/80 border border-white/[0.08] rounded-3xl backdrop-blur-md self-stretch md:self-auto flex flex-col justify-center items-center text-center gap-2 min-w-[220px] shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <Clock size={32} className="text-sky-400 animate-pulse mb-1" />
              <span className="text-2xl md:text-3xl font-black font-mono text-white tracking-tight text-shadow-sky">{time}</span>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mt-1.5">
                <Calendar size={14} className="text-indigo-400" />
                <span>{dateStr}</span>
              </div>
            </div>
          </div>
        </InteractiveBanner>
      </motion.div>

      {/* Inspirational Daily Message section with dynamic shuffle trigger */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="w-full"
      >
        <InteractiveBanner className="bg-gradient-to-r from-indigo-950/40 to-[#051139]/40 border border-indigo-500/25 shadow-2xl p-8 md:p-10 select-none">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.02] to-sky-500/[0.02] pointer-events-none" />
          <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-2xl rounded-full" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-6 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-inner">
                <Quote size={28} />
              </div>
              <div className="space-y-3 flex-1 text-right">
                <h3 className="text-lg font-black text-indigo-400 flex items-center gap-2">
                  <span>رسالتنا ليك النهارده ..</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  <span className="text-xs font-bold text-slate-500">من الرسائل الإدارية والتحفيزية لوكالة مدار</span>
                </h3>
                
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={currentMessageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="text-slate-200 text-xl md:text-2xl font-black leading-relaxed tracking-tight select-none"
                  >
                    "{todayMessage}"
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <Button
              onClick={handleShuffleQuote}
              variant="secondary"
              className="h-12 w-12 rounded-2xl bg-white/[0.05] border-white/10 hover:border-indigo-400/40 hover:bg-white/10 text-indigo-300 self-end md:self-center transition-all flex items-center justify-center p-0"
              title="الحصول على فكرة ملهمة أخرى"
            >
              <Shuffle size={18} className="text-indigo-400 hover:rotate-180 duration-500 transition-transform" />
            </Button>
          </div>
        </InteractiveBanner>
      </motion.div>

      {/* Quick shortcuts / Available Control Boards */}
      <div className="space-y-6 text-right">
        <h3 className="text-xl font-black text-white border-r-4 border-sky-500 pr-4">الأقسام واللوحات المتاحة لك اليوم</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeQuickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.5 }}
              >
                <Card 
                  glass 
                  className="p-6 h-full flex flex-col justify-between hover:border-sky-500/40 group transition-all duration-300 relative overflow-hidden text-right"
                  id={`action-${action.id}`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-sky-400 group-hover:border-sky-500/20 transition-all shadow-lg">
                      <Icon size={22} className="group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-extrabold text-base text-white group-hover:text-sky-400 transition-colors uppercase tracking-tight">{action.label}</h4>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">{action.desc}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/[0.05]">
                    <Button 
                      onClick={() => setActiveTab(action.id)} 
                      variant="secondary"
                      className="w-full text-xs font-black rounded-xl h-10 group-hover/btn:bg-sky-500/15"
                    >
                      دخول القسم
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
