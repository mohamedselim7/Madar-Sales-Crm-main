import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, convertTimestamps } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, Button } from "@/src/components/UI";
import { 
  Globe, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Target, 
  Cpu, 
  TrendingUp, 
  MessageSquare,
  Zap,
  Clock,
  ArrowRight,
  DollarSign,
  ArrowUpRight,
  Sparkles,
  Gauge,
  Search,
  Smartphone,
  ChevronLeft,
  Layout
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion } from "motion/react";

export const ShareAnalysis: React.FC<{ analysisId?: string }> = ({ analysisId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!analysisId) return;
      try {
        const docSnap = await getDoc(doc(db, "aiAnalysis", analysisId));
        if (docSnap.exists()) {
          setData(convertTimestamps(docSnap.data()));
        } else {
          setError("التقرير غير موجود.");
        }
      } catch (err) {
        setError("فشل في تحميل التقرير.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [analysisId]);

  const ScoreBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-400">{label}</span>
        <span className={cn("font-black", colorClass)}>{value}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorClass.replace("text-", "bg-"))}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <RefreshCw size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-red-500">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-2xl font-bold text-white">{error || "حدث خطأ ما"}</h1>
        <Link to="/">
          <Button variant="secondary" icon={ChevronLeft}>العودة للرئيسية</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 font-sans dir-rtl" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-500/10 rounded-[2rem] border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Globe size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter">{data.reportTitle || "تقرير تحليل الموقع الاستراتيجي"}</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">MADAR SALES CRM Premium Analysis • {data.websiteUrl}</p>
            </div>
          </div>
        </div>

        {/* Dashboard Content (Simplified view of WebsiteAnalysis) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <Card glass className="p-8 lg:col-span-1 flex flex-col items-center justify-center space-y-6 relative overflow-hidden group">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest relative z-10">التقييم العام</h3>
            <div className="relative inline-flex items-center justify-center p-8 z-10">
              <svg className="w-48 h-48 transform -rotate-90">
                <circle cx="96" cy="96" r="84" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/[0.05]" />
                <motion.circle
                  cx="96" cy="96" r="84" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={528}
                  initial={{ strokeDashoffset: 528 }}
                  animate={{ strokeDashoffset: 528 - (528 * data.overallScore) / 100 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="text-blue-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black text-white">{data.overallScore}</span>
                <span className="text-slate-500 font-bold">100 /</span>
              </div>
            </div>
            <div className="px-6 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 font-black text-xs uppercase tracking-widest">
              {data.overallScore > 80 ? "أداء ممتاز" : data.overallScore > 60 ? "أداء جيد" : "يحتاج تحسين"}
            </div>
          </Card>

          <Card glass className="p-8 lg:col-span-3 space-y-8">
            <div className="flex justify-between items-center border-b border-white/[0.05] pb-6">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-blue-400" />
                <h3 className="font-bold text-white text-xl">تحليل المؤشرات</h3>
              </div>
              <div className="flex gap-4">
                <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
                  <Target size={14} className="text-blue-400" />
                  <span className="text-[10px] font-black text-white uppercase">{data.businessField || "غير محدد"}</span>
                </div>
                <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-2">
                  <Cpu size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-white uppercase">{data.platform || "غير محدد"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <ScoreBar label="UX" value={data.scores.ux} colorClass="text-blue-400" />
                <ScoreBar label="CRO" value={data.scores.cro} colorClass="text-indigo-400" />
              </div>
              <div className="space-y-6">
                <ScoreBar label="SEO" value={data.scores.seo} colorClass="text-emerald-400" />
                <ScoreBar label="Speed" value={data.scores.speed} colorClass="text-amber-400" />
              </div>
              <div className="space-y-6">
                <ScoreBar label="Trust" value={data.scores.trust} colorClass="text-purple-400" />
              </div>
            </div>

            <div className="p-6 bg-blue-500/[0.03] border border-blue-500/10 rounded-2xl text-slate-400 italic">
              <p className="text-sm">{data.recommendations}</p>
            </div>
          </Card>
        </div>

        {/* Problems */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500" size={24} />
            <h3 className="text-2xl font-black text-white">المشاكل التقنية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.problems.map((issue: any, i: number) => (
              <Card key={i} glass className="p-6">
                <div className="mb-4">
                  <span className="px-3 py-1 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-black uppercase">{issue.priority} Priority</span>
                </div>
                <h4 className="font-bold text-white text-lg mb-2">{issue.problem}</h4>
                <p className="text-slate-500 text-sm">{issue.impact}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Roadmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-white flex items-center gap-3"><Target className="text-blue-400" /> خطة العمل</h3>
            <Card glass className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2"><Zap size={16} /> نتائج سريعة</h4>
                {data.quickWins.map((win: string, i: number) => (
                  <div key={i} className="text-sm text-slate-400 border-r-2 border-emerald-500/30 pr-4 py-1">{win}</div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="font-bold text-blue-400 flex items-center gap-2"><Clock size={16} /> تحسينات قريبة</h4>
                {data.monthlyImprovements.map((item: string, i: number) => (
                  <div key={i} className="text-sm text-slate-400 border-r-2 border-blue-500/30 pr-4 py-1">{item}</div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-2xl font-black text-white flex items-center gap-3"><DollarSign className="text-emerald-500" /> فرص النمو</h3>
            <Card glass className="p-8 space-y-6">
              {data.revenueOpportunities.map((item: any, i: number) => (
                <div key={i} className="space-y-1">
                  <h4 className="font-bold text-white">{item.insight}</h4>
                  <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">النمو المتوقع: {item.potentialGrowth}</p>
                </div>
              ))}
              <div className="pt-6 border-t border-white/10">
                <p className="text-slate-400 text-sm leading-loose">{data.marketInsights}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Custom Sections */}
        {data.customSections && data.customSections.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Layout className="text-blue-400" size={24} />
              <h3 className="text-2xl font-black text-white">معلومات إضافية</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {data.customSections.map((section: any, i: number) => (
                <Card key={i} glass className="p-8 space-y-4">
                  <h4 className="text-xl font-bold text-white">{section.title}</h4>
                  <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RefreshCw: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);
