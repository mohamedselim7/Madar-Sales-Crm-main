import React, { useState, useEffect } from "react";
import { 
  BarChart3, 
  Users, 
  Target, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  LogOut,
  Bell,
  Menu,
  X,
  Search,
  FileText,
  Palette,
  Monitor,
  AlertCircle,
  Globe,
  PhoneCall,
  UserCheck,
  TrendingUp,
  Briefcase,
  Wrench,
  MessageSquare
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Button, Card } from "@/src/components/UI";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/hooks/useUserRole";
import { useData } from "@/src/context/DataContext";
import { NotificationCenter } from "@/src/components/NotificationCenter";
import { Logo } from "@/src/components/Logo";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onClose }) => {
  const { logout, user } = useAuth();
  const { allowedPages, isAdmin, loading } = useUserRole();

  const menuItems = [
    { id: "home", name: "الصفحة الرئيسية", icon: LayoutDashboard },
    { id: "sales_hub", name: "إدارة قسم المبيعات", icon: TrendingUp },
    { id: "telesales", name: "إدارة قسم التيلي سيلز", icon: PhoneCall },
    { id: "sales_agent", name: "مساحة عمل المبيعات", icon: Target },
    { id: "telesales_agent", name: "مساحة عمل التيلي سيلز", icon: UserCheck },
    { id: "whatsapp_automation", name: "أتمتة الواتساب", icon: MessageSquare },
    { id: "sales_tools", name: "أدوات الفريق", icon: Wrench },
    { id: "settings", name: "الإعدادات", icon: SettingsIcon },
    { id: "divider-logout", type: "divider" },
    { id: "logout-item", name: "تسجيل الخروج", icon: LogOut, action: "logout" },
  ].filter(item => {
    if (item.id === "logout-item") return true;
    if (item.type === "divider") {
      // Only show divider if user is admin (has access to both main and dept sections)
      return isAdmin;
    }
    return allowedPages.includes(item.id!);
  });

  if (loading) return null;

  return (
    <div className="w-full lg:w-72 bg-[#020617]/50 backdrop-blur-3xl border-l border-white/[0.07] text-white h-screen flex flex-col shrink-0 relative overflow-hidden group shadow-2xl">
      {/* Sidebar Glow */}
      <div className="absolute top-0 right-0 w-full h-1/2 bg-sky-500/10 blur-[120px] pointer-events-none" />
      
      <div className="p-8 flex items-center justify-between border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center shrink-0">
            <Logo isStatic size={36} className="w-[36px] h-auto object-contain bg-transparent border-none shadow-none p-0 rounded-none shrink-0" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">MADAR</h1>
            <p className="text-[10px] text-sky-400 font-black uppercase tracking-[0.2em] mt-1.5 opacity-80">SALES CRM</p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-8 space-y-3 relative z-10">
        {menuItems.map((item, index) => {
          if (item.type === "divider") {
            return <div key={`divider-${index}`} className="h-px bg-white/[0.05] mx-4 my-6" />;
          }
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.action === "logout") {
                  logout();
                } else {
                  setActiveTab(item.id!);
                }
              }}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group/item relative",
                activeTab === item.id 
                  ? "bg-sky-500/10 text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.1)] border border-sky-500/20" 
                  : "text-slate-500 hover:bg-white/[0.02] hover:text-slate-300 border border-transparent"
              )}
            >
              <item.icon size={22} className={cn("transition-transform duration-500", activeTab === item.id ? "scale-110" : "group-hover/item:scale-110")} />
              <span className="font-bold text-sm tracking-tight">{item.name}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-pill" 
                  className="absolute right-0 w-1 h-6 bg-sky-500 rounded-l-full" 
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/[0.05] relative z-10">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 text-sm mb-6 group/user transition-all hover:bg-white/5">
          <div className="w-10 h-10 rounded-xl bg-sky-500 font-black flex items-center justify-center overflow-hidden shadow-lg shadow-sky-500/10 transition-transform group-hover/user:scale-110">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ""} referrerPolicy="no-referrer" />
            ) : (
              user?.displayName?.charAt(0) || "U"
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white truncate tracking-tight">{user?.displayName}</p>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center justify-center gap-3 w-full p-4 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-2xl transition-all font-bold text-sm border border-transparent hover:border-red-500/10"
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};

export const Layout: React.FC<{ 
  children: React.ReactNode; 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
}> = ({ 
  children, 
  activeTab, 
  setActiveTab,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading, signIn, logout } = useAuth();
  const { hasAccess, loading: roleLoading } = useUserRole();
  const { progress, loadingMessage, isInitialLoadComplete } = useData();
  const isQuotaExceeded = false;

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#020B22] text-white flex flex-col items-center justify-center p-8 overflow-hidden relative" dir="rtl">
        <div className="premium-noise-overlay" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 animate-pulse">جاري التحقق من الصلاحيات الأمنية...</p>
        </div>
      </div>
    );
  }



  if (user && !hasAccess) {
    return (
      <div className="min-h-screen bg-[#020B22] text-slate-200 flex flex-col items-center justify-center p-8 relative overflow-hidden" dir="rtl">
        <div className="premium-noise-overlay" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="w-full max-w-lg space-y-10 text-center relative z-10 animate-in fade-in zoom-in-95 duration-1000">
           <div className="space-y-6">
              <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 shadow-2xl rounded-[2.5rem] mx-auto flex items-center justify-center text-red-400 rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
                <AlertCircle size={48} />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black text-white tracking-tighter leading-tight">عذرًا! لا تتوفر لديك صلاحية الوصول لهذه الصفحة.</h1>
                <p className="text-slate-400 text-lg font-medium leading-relaxed">
                   يرجى التواصل مع مدير النظام لتفعيل الصلاحيات المناسبة لبريدك الإلكتروني <span className="text-sky-400 font-black px-2">{user.email}</span>.
                </p>
              </div>
           </div>

           <Card glass className="p-8 border-white/[0.08] shadow-2xl space-y-6">
              <p className="text-sm text-slate-500 font-medium leading-relaxed">يرجى تزويد مدير النظام ببريدك الإلكتروني لتتمكن من الوصول للأقسام المطلوبة والبدء بالعمل.</p>
              <Button onClick={logout} variant="secondary" className="w-full h-14 font-black rounded-2xl ring-2 ring-red-500/20">
                تسجيل الخروج والعودة مجددًا
              </Button>
           </Card>

           <div className="pt-8 border-t border-white/[0.05] flex items-center justify-center gap-3">
              <div className="w-2 h-2 bg-slate-700 rounded-full" />
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest">MADAR SALES CRM</p>
           </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020B22] text-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="premium-noise-overlay" />
        
        {/* Animated fluid gradient glowing mesh orbs in the background */}
        <motion.div 
          animate={{ 
            y: [0, 40, -20, 0],
            x: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            y: [0, -50, 30, 0],
            x: [0, 25, -25, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[5%] right-[-10%] w-[55%] h-[55%] bg-sky-500/15 rounded-full blur-[130px] pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            y: [0, 30, -30, 0],
            x: [0, 40, -40, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/3 left-1/3 w-[30%] h-[30%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" 
        />
        <div className="absolute right-[5%] top-[10%] w-96 h-96 bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Dynamic enterprise grid lines behind forms */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        <div className="w-full max-w-md space-y-10 text-center relative z-10 animate-in fade-in zoom-in-95 duration-1000">
          <div className="space-y-4">
            <div className="flex items-center justify-center mx-auto">
              <Logo size={140} className="w-[140px] h-[140px] shrink-0" />
            </div>
            <div className="space-y-3">
              <h1 className="text-6xl font-black text-white tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_2px_10px_rgba(0,191,255,0.15)] font-sans">
                MADAR SALES CRM
              </h1>
              <p className="text-sky-300/80 text-base font-bold tracking-wide">
                النظام الشامل لفريق المبيعات لوكالة مدار
              </p>
            </div>
          </div>
          
          {/* Main glassy signup box with gorgeous colorful multi-layered border and reflections */}
          <div className="relative group/card">
            {/* Soft backdrop neon glow behind the box */}
            <div className="absolute inset-[-1px] rounded-3xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-pink-500/20 opacity-0 group-hover/card:opacity-100 blur-xl transition-opacity duration-700 pointer-events-none" />
            
            {/* The multi-colored linear outline container */}
            <div className="absolute inset-[-1px] rounded-3xl bg-gradient-to-tr from-sky-500/20 via-white/5 to-indigo-500/20 p-[1px]" />
            
            <Card glass className="p-10 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-b from-[#020b22]/90 to-[#051139]/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] border border-white/[0.04]">
               {/* Soft colored lighting inside the box corners */}
               <div className="absolute -top-10 -right-10 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
               <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

               <Button 
                 onClick={signIn} 
                 className="w-full h-16 text-lg font-black rounded-2xl group overflow-hidden relative shadow-[0_0_30px_rgba(0,191,255,0.3)] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 text-white hover:from-sky-300 hover:via-blue-400 hover:to-indigo-500 transition-all border-none"
               >
                 {/* Internal shimmering glare overlay */}
                 <span className="relative z-10 flex items-center justify-center gap-3">
                   <span>تسجيل الدخول باستخدام حساب Google</span>
                 </span>
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
               </Button>
               
               <div className="mt-8 pt-8 border-t border-white/[0.06] flex items-center justify-center gap-3">
                  <div className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse shadow-[0_0_10px_#00BFFF]" />
                  <p className="text-xs font-black text-slate-400 tracking-wide">
                    التسجيل متاح فقط علي موظفي المبيعات للوكالة
                  </p>
               </div>
            </Card>
          </div>

          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em] select-none">
            MADAR SALES CRM v2.0
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent text-slate-100 overflow-hidden font-sans relative" dir="rtl">
      <div className="premium-noise-overlay" />
      {/* Global Background Accents - Enhanced colors for premium glass refraction */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/15 rounded-full blur-[160px] pointer-events-none z-0 animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[5%] right-[-10%] w-[50%] h-[50%] bg-sky-500/12 rounded-full blur-[140px] pointer-events-none z-0 animate-pulse duration-[8000ms]" />
      <div className="absolute top-[30%] left-[40%] w-[35%] h-[35%] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-white/[0.05] flex items-center justify-between px-6 bg-[#020617]/80 backdrop-blur-md relative z-20">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-2.5">
            <Logo isStatic size={24} className="w-[24px] h-auto object-contain bg-transparent border-none shadow-none p-0 rounded-none shrink-0" />
            <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none">MADAR</h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationCenter setActiveTab={setActiveTab} />
            <button 
              onClick={logout}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-20 items-center justify-between px-8 border-b border-white/[0.04] bg-[#020617]/30 backdrop-blur-md relative z-20 shrink-0">
          <div className="flex items-center gap-3">
             <div className="text-right">
                <p className="text-xs text-slate-500 font-bold tracking-wider">لوحة تحكم ومتابعة وكالة مدار</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Bell / Action Notification Center */}
             <NotificationCenter setActiveTab={setActiveTab} />
             
             {/* Vertical Splitter */}
             <div className="w-px h-6 bg-white/[0.08]" />
             
             {/* Dynamic Status Indicator */}
             {isQuotaExceeded ? (
               <div className="flex items-center gap-2.5 bg-amber-500/5 border border-amber-500/15 px-4 py-2 rounded-2xl">
                 <div className="relative h-2 w-2 shrink-0">
                   <motion.div 
                     animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                     transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                     className="absolute inset-0 rounded-full bg-amber-400"
                   />
                   <div className="absolute inset-[1.5px] rounded-full bg-amber-500" />
                 </div>
                 <span className="text-xs font-black text-amber-400">وضع الأداء المحلي الآمن</span>
               </div>
             ) : (
               <div className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/15 px-4 py-2 rounded-2xl">
                 <div className="relative h-2 w-2 shrink-0">
                   <motion.div 
                     animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                     transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                     className="absolute inset-0 rounded-full bg-emerald-400"
                   />
                   <div className="absolute inset-[1.5px] rounded-full bg-emerald-500" />
                 </div>
                 <span className="text-xs font-black text-emerald-400">مزامنة سحابية نشطة</span>
               </div>
             )}
          </div>
        </header>

        {/* Safe Local Fallback Notification Banner */}
        {isQuotaExceeded && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4 relative z-30 shrink-0" dir="rtl">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <p className="text-xs md:text-sm font-bold text-amber-300">
                تنبيه الأداء المستقر: تم تفعيل <span className="underline decoration-amber-500/40 underline-offset-4 font-black">وضع العمل المحلي السريع والآمن</span> لامتلاء حصة الخدمة السحابية المؤقتة. يمكنك متابعة عملك بالكامل وإضافة وتعديل البيانات وحفظها محلياً بكفاءة 100% دون أي قلق!
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-72 bg-[#020617] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar 
                activeTab={activeTab} 
                setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
                onClose={() => setIsMobileMenuOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
