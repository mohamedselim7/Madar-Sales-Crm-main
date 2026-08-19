import React, { useState, useEffect, useRef } from "react";
import { 
  Instagram, 
  Twitter, 
  Youtube, 
  Facebook, 
  Ghost, // For Snapchat
  Share2,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Wand2,
  Plus,
  Save,
  Trash2,
  BarChart3,
  Calendar,
  Zap,
  Target,
  Users,
  LayoutDashboard,
  LineChart,
  Edit2,
  X,
  PlusCircle,
  Video,
  MessageSquare
} from "lucide-react";
import { Card, Button, Input, Progress, Tabs, Select } from "@/src/components/UI";
import { useClients } from "@/src/hooks/useClients";
import { useSettings } from "@/src/hooks/useSettings";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { analyzeSocialMediaWithAI } from "@/src/lib/gemini";
import { cn } from "@/src/lib/utils";

const TikTokIcon = ({ size = 20, className = "" }) => (
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
    <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
    <path d="M10 12h4" />
    <path d="M10 16h4" />
    <path d="M10 8h4" />
  </svg>
);

const ANALYSIS_STAGES = [
  "قراءة الروابط الأساسية",
  "جلب أعداد المتابعين",
  "تحليل التوجه العام",
  "صياغة التوصيات الاستراتيجية"
];

export const SocialMediaAnalysisPage: React.FC = () => {
  const { clients } = useClients();
  const { settings } = useSettings();
  const apiKey = settings.apiIntegrations?.gemini || "";

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [socialLinks, setSocialLinks] = useState<any>({
    instagram: "",
    tiktok: "",
    snapchat: "",
    facebook: "",
    youtube: "",
    twitter: ""
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");

  // Search clients
  const [searchTerm, setSearchTerm] = useState("");
  const filteredClients = clients.filter(c => 
    c.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.clientInfo.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setSelectedClient(client);
        // In a real app, we'd fetch or set links from client metadata if they exist
        // For now let's assume they are empty unless we find 'clientSocialLinks' collection entries
        fetchClientSocialLinks(client.id);
      }
    }
  }, [selectedClientId, clients]);

  const fetchClientSocialLinks = async (clientId: string) => {
    try {
      const q = query(collection(db, "clientSocialLinks"), where("clientId", "==", clientId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSocialLinks(snap.docs[0].data());
      } else {
        setSocialLinks({
          instagram: "",
          tiktok: "",
          snapchat: "",
          facebook: "",
          youtube: "",
          twitter: ""
        });
      }
    } catch (e) {
      console.error("Error fetching social links:", e);
    }
  };

  const startAnalysis = async () => {
    if (!selectedClient) {
      setError("اختر العميل أولاً");
      return;
    }

    const linksMap: Record<string, string> = {};
    Object.entries(socialLinks).forEach(([p, u]) => {
      if (u) linksMap[p] = u as string;
    });

    if (Object.keys(linksMap).length === 0) {
      setError("يرجى إضافة رابط واحد على الأقل للتحليل");
      return;
    }

    setAnalyzing(true);
    setProgress(10);
    setCurrentStageIndex(0);
    setError(null);
    setResults(null);
    setStatusText("جاري قراءة الروابط...");

    try {
      // Save links first
      await addDoc(collection(db, "clientSocialLinks"), {
        clientId: selectedClient.id,
        ...socialLinks,
        updatedAt: serverTimestamp()
      });

      // Stage 1: Fetch Data
      setCurrentStageIndex(1);
      setProgress(40);
      setStatusText("جاري سحب أعداد المتابعين والبيانات الرئيسية...");
      
      const response = await fetch("/api/analyze-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: linksMap })
      });

      if (!response.ok) {
        throw new Error("فشل النظام في استخراج بيانات التواصل الاجتماعي.");
      }

      const crawledData = await response.json();
      
      // Check if we got any "SUCCESS" status
      const hasRealData = Object.values(crawledData).some((d: any) => d.status === "SUCCESS");
      if (!hasRealData) {
        throw new Error("جميع محاولات سحب البيانات فشلت. المنصات الاجتماعية تمنع القراءة الآلية حالياً أو الروابط غير دقيقة.");
      }

      // Stage 2: Pattern Analysis
      setCurrentStageIndex(2);
      setProgress(70);
      setStatusText("تحليل التوجه العام للمحتوى...");

      // Stage 3: AI
      setCurrentStageIndex(3);
      setProgress(90);
      setStatusText("صياغة التوصيات النهائية...");
      
      const aiResults = await Promise.race([
        analyzeSocialMediaWithAI(apiKey, {
          client: {
            name: selectedClient.clientInfo.clientName,
            business: selectedClient.clientInfo.businessName,
            category: selectedClient.clientInfo.serviceType,
            brief: selectedClient.clientInfo.salesBrief
          },
          crawledData: crawledData
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("استغرق التحليل وقتاً طويلاً جداً. يرجى المحاولة مرة أخرى.")), 60000)
        )
      ]) as any;

      // Finish
      setProgress(100);
      setResults(aiResults);
      setAnalyzing(false);

      // Save analysis
      await addDoc(collection(db, "socialAnalysis"), {
        clientId: selectedClient.id,
        clientCode: selectedClient.clientCode,
        businessName: selectedClient.clientInfo.businessName,
        links: socialLinks,
        rawData: crawledData,
        analysisResults: aiResults,
        createdAt: serverTimestamp()
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ غير متوقع أثناء تحليل السوشيال ميديا.");
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between gap-6 px-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">تحليل حسابات <span className="text-sky-500">السوشيال ميديا</span> 📱✨</h2>
          <p className="text-slate-400 font-medium">تحليل ذكي جداً لصفحات وقنوات العميل.. اعرف نقاط قوتهم والمشاكل اللي محتاجة تظبيط فوراً!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Side */}
        <div className="lg:col-span-1 space-y-6">
          <Card glass className="p-6 space-y-6 border-white/[0.05]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">بحث عن عميل</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <Input 
                    dark 
                    className="pl-12 bg-white/[0.02]"
                    placeholder="كود العميل أو اسم البيزنس..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">اختيار من القائمة</label>
                <Select 
                  dark 
                  className="w-full bg-white/[0.02]"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">اختر عميل...</option>
                  {filteredClients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.clientCode} | {c.clientInfo.businessName}</option>
                  ))}
                </Select>
              </div>
            </div>

            {selectedClient && (
              <div className="p-5 bg-white/[0.03] rounded-[32px] border border-white/[0.05] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">العميل:</span>
                  <span className="text-[11px] font-black text-white">{selectedClient.clientInfo.clientName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">النشاط:</span>
                  <span className="text-[11px] font-black text-sky-400">{selectedClient.clientInfo.serviceType}</span>
                </div>
                <div className="pt-3 border-t border-white/[0.05]">
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic line-clamp-2">{selectedClient.clientInfo.salesBrief}</p>
                </div>
              </div>
            )}
          </Card>

          <Card glass className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">روابط المنصات</h3>
              <Sparkles className="text-sky-500" size={16} />
            </div>

            <div className="space-y-4">
              <SocialInput 
                icon={<Instagram size={18} />} 
                label="Instagram" 
                placeholder="https://instagram.com/profile" 
                value={socialLinks.instagram}
                onChange={(v) => setSocialLinks({...socialLinks, instagram: v})}
              />
              <SocialInput 
                icon={<TikTokIcon size={18} />} 
                label="TikTok" 
                placeholder="https://tiktok.com/@user" 
                value={socialLinks.tiktok}
                onChange={(v) => setSocialLinks({...socialLinks, tiktok: v})}
              />
              <SocialInput 
                icon={<Facebook size={18} />} 
                label="Facebook" 
                placeholder="https://facebook.com/page" 
                value={socialLinks.facebook}
                onChange={(v) => setSocialLinks({...socialLinks, facebook: v})}
              />
              <SocialInput 
                icon={<Youtube size={18} />} 
                label="YouTube" 
                placeholder="https://youtube.com/@channel" 
                value={socialLinks.youtube}
                onChange={(v) => setSocialLinks({...socialLinks, youtube: v})}
              />
              <SocialInput 
                icon={<Twitter size={18} />} 
                label="X / Twitter" 
                placeholder="https://x.com/user" 
                value={socialLinks.twitter}
                onChange={(v) => setSocialLinks({...socialLinks, twitter: v})}
              />
              <SocialInput 
                icon={<Ghost size={18} />} 
                label="Snapchat" 
                placeholder="https://snapchat.com/add/user" 
                value={socialLinks.snapchat}
                onChange={(v) => setSocialLinks({...socialLinks, snapchat: v})}
              />
            </div>

            <Button 
              onClick={startAnalysis}
              disabled={analyzing || !selectedClient}
              className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-sky-500/20 transition-all"
            >
              {analyzing ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>ابدأ تحليل السوشيال</span>
                  <ArrowRight size={20} />
                </>
              )}
            </Button>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-500 text-xs font-bold">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </Card>
        </div>

        {/* Results Side */}
        <div className="lg:col-span-2 space-y-6">
          {!results && !analyzing && (
            <Card glass className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border border-white/[0.05]">
              <div className="w-24 h-24 rounded-[32px] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-8 shadow-inner shadow-white/[0.02]">
                <Share2 size={42} className="opacity-50" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">في انتظار البيانات...</h3>
              <p className="text-slate-400 max-w-sm font-medium leading-relaxed">قم باختيار عميل من القائمة وأضف روابط منصاته ليتمكن محرك MADAR SALES CRM من تحليل الأداء وبناء استراتيجية احترافية.</p>
            </Card>
          )}

          {analyzing && (
            <Card glass className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 space-y-12 border-sky-500/20">
              <div className="relative">
                <div className="absolute inset-0 bg-sky-500 blur-[80px] opacity-20 animate-pulse"></div>
                <div className="relative w-24 h-24 rounded-[32px] bg-sky-500 flex items-center justify-center text-white shadow-[0_0_40px_rgba(14,165,233,0.3)]">
                  <Wand2 size={36} className="animate-bounce" />
                </div>
              </div>
              
              <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-3">
                  <h3 className="text-3xl font-black text-white tracking-tight">{ANALYSIS_STAGES[currentStageIndex]}</h3>
                  <p className="text-sky-400/80 text-sm font-black uppercase tracking-widest">MADAR SALES CRM Engine is processing...</p>
                </div>
                
                <div className="space-y-4">
                  <div className="relative h-4 bg-white/5 rounded-full overflow-hidden border border-white/[0.05] p-1">
                    <div 
                      className="absolute inset-y-1 left-1 bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `calc(${progress}% - 8px)` }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress-stripe_1s_linear_infinite]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <span>Analysis in Progress</span>
                    <span className="flex items-center gap-1.5 text-sky-500">
                      <Clock size={12} />
                      {progress}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {ANALYSIS_STAGES.map((stage, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-[11px] font-black uppercase tracking-wider",
                      i < currentStageIndex ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5" :
                      i === currentStageIndex ? "bg-sky-500/10 border-sky-500/30 text-white shadow-lg shadow-sky-500/10" :
                      "bg-white/[0.02] border-transparent text-slate-600"
                    )}>
                      {i < currentStageIndex ? (
                        <CheckCircle2 size={16} className="shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-lg border border-current flex items-center justify-center text-[10px] shrink-0">{i+1}</div>
                      )}
                      <span className="truncate">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {results && (
            <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-1000 pb-20">
              {/* Overall Score */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card glass className="p-8 text-center space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-3xl -mr-12 -mt-12 transition-all"></div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معدل الأداء الاجتماعي</div>
                  <div className="text-7xl font-black text-white tracking-tighter">{results.overallScore}</div>
                  <div className="px-6">
                    <Progress value={results.overallScore} className="h-2 bg-white/5" />
                  </div>
                  <p className="text-[10px] font-black text-sky-500/80 uppercase tracking-widest">بناءً على {Object.entries(socialLinks).filter(([_,v])=>!!v).length} منصات نشطة</p>
                </Card>

                <Card glass className="md:col-span-2 p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                      <BarChart3 size={16} className="text-sky-500" />
                      التقييمات الاستراتيجية المتقدمة
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <ScoreBar label="جودة المحتوى" value={results.subScores.contentQuality} color="bg-blue-500" />
                    <ScoreBar label="الاستمرارية" value={results.subScores.consistency} color="bg-indigo-500" />
                    <ScoreBar label="الهوية البصرية" value={results.subScores.branding} color="bg-purple-500" />
                    <ScoreBar label="التفاعل" value={results.subScores.engagement} color="bg-emerald-500" />
                    <ScoreBar label="جاهزية التحويل" value={results.subScores.conversionReadiness} color="bg-amber-500" />
                  </div>
                </Card>
              </div>

              {/* Content Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card glass className="p-8 space-y-6">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                    <PieChartIcon size={16} className="text-sky-500" />
                    توزيع المحتوى الحقيقي
                  </h3>
                  <div className="space-y-6">
                    <ContentBar label="محتوى تعليمي" value={results.contentBreakdown.educational} color="bg-blue-500" />
                    <ContentBar label="محتوى ترويجي" value={results.contentBreakdown.promotional} color="bg-sky-500" />
                    <ContentBar label="محتوى ترفيهي" value={results.contentBreakdown.entertainment} color="bg-indigo-500" />
                  </div>
                  <div className="pt-6 border-t border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">فئات محتوى مفقودة (فرص نمو)</p>
                    <div className="flex flex-wrap gap-2">
                      {results.contentBreakdown.missing.map((m: string, i: number) => (
                        <span key={i} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black flex items-center gap-2">
                          <AlertCircle size={12} />
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card glass className="p-8 space-y-6 text-right">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 justify-end uppercase tracking-widest">
                    خطة الـ 30 يوماً القادمة
                    <Calendar size={16} className="text-sky-500" />
                  </h3>
                  <div className="space-y-6">
                    <div className="p-5 bg-white/[0.03] border border-white/[0.05] rounded-3xl">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">جدول النشر المقترح</p>
                      <p className="text-sm text-white font-medium leading-relaxed">{results.thirtyDayPlan.postingPlan}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">توصيات استراتيجية</p>
                      {results.thirtyDayPlan.recommendations.map((rec: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-slate-300 bg-white/[0.01] p-3 rounded-xl border border-white/[0.02]">
                          <CheckCircle2 size={14} className="text-sky-500 shrink-0" />
                          <span className="font-medium">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Detailed Platform Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.platformsData && Object.entries(results.platformsData).map(([platform, stats]: [string, any]) => {
                  if (!stats || (!stats.followersCount && !stats.totalPosts)) return null;
                  return (
                    <Card glass key={platform} className="p-6 space-y-4 border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1 h-4 bg-sky-500 rounded-full"></span>
                          {platform}
                        </h4>
                        <div className="px-2 py-1 bg-white/5 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          بيانات نشطة
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">المتابعين</p>
                          <p className="text-lg font-black text-white">{stats.followersCount || '0'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">المنشورات</p>
                          <p className="text-lg font-black text-white">{stats.totalPosts || '0'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">إجمالي اللايكات</p>
                          <p className="text-lg font-black text-white">{stats.totalLikes || '0'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">متوسط النشر</p>
                          <p className="text-sm font-bold text-sky-400">{stats.dailyPostAverage || '0'}/يوم</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">متوسط التفاعل/بوست</p>
                          <p className="text-xs font-bold text-slate-300">{stats.avgLikesPerPost || '0'} لايك</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">صور / فيديو</p>
                          <p className="text-xs font-bold text-slate-300">{stats.photoToVideoRatio || 'N/A'}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Critical Problems */}
              <Card glass className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <AlertTriangle size={24} className="text-amber-500" />
                    نقاط الضعف والتوصيات الحرجة
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.criticalProblems.map((prob: any, i: number) => (
                    <div key={i} className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-[32px] space-y-5 transition-all hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          prob.priority.toLowerCase() === "high" ? "bg-red-500/15 text-red-500 shadow-sm shadow-red-500/20" : "bg-amber-500/15 text-amber-500"
                        )}>
                          {prob.priority} Priority
                        </span>
                        <AlertCircle size={16} className="text-slate-600" />
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-xl font-black text-white leading-snug">{prob.finding}</h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{prob.evidence} <span className="text-slate-600 italic font-bold">(دليل الرصد)</span></p>
                      </div>
                      <div className="p-5 bg-sky-500/10 border border-sky-500/20 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-2xl -mr-12 -mt-12 transition-all group-hover:scale-110"></div>
                        <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-2 relative z-10">التوصية الاستراتيجية لـ MADAR SALES CRM</p>
                        <p className="text-sm text-white font-black relative z-10 leading-snug">{prob.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Wins & Campaigns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card glass className="p-8 space-y-6 border-emerald-500/20 shadow-emerald-500/10 shadow-2xl">
                  <h3 className="text-xs font-black text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                    <Zap size={18} />
                    تحسينات فورية (نتائج سريعة)
                  </h3>
                  <div className="space-y-3">
                    {results.quickWins.map((win: string, i: number) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-emerald-500/[0.04] border border-emerald-500/10 rounded-2xl text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/[0.08]">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-emerald-500/20 shrink-0">{i+1}</div>
                        {win}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card glass className="p-8 space-y-6">
                  <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                    <LineChart size={18} className="text-sky-500" />
                    أفكار حملات إبداعية
                  </h3>
                  <div className="space-y-4">
                    {results.thirtyDayPlan.campaignIdeas.map((idea: string, i: number) => (
                      <div key={i} className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl shadow-inner transition-all hover:bg-white/[0.05] hover:border-white/10">
                         <p className="text-sm text-slate-100 font-bold flex items-start gap-4">
                           <Target size={20} className="text-sky-500 mt-0.5 shrink-0" />
                           {idea}
                         </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SocialInput = ({ icon, label, placeholder, value, onChange }: any) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
      <div className="text-sky-500/80">{icon}</div>
      <span>{label}</span>
    </div>
    <Input 
      dark 
      placeholder={placeholder} 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="h-11 rounded-xl bg-white/[0.02] border-white/[0.05] focus:border-sky-500/30"
    />
  </div>
);

const ScoreBar = ({ label, value, color }: any) => (
  <div className="space-y-2.5">
    <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
      <span className="text-slate-400">{label}</span>
      <span className="text-white">{value}%</span>
    </div>
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div 
        className={cn("h-full transition-all duration-1000", color)}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const ContentBar = ({ label, value, color }: any) => (
  <div className="flex items-center gap-4">
    <span className="text-[10px] font-black text-slate-500 w-24 text-right">{label}</span>
    <div className="flex-grow h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
      <div 
        className={cn("h-full transition-all duration-1000", color)}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-[10px] font-black text-white w-8">{value}%</span>
  </div>
);

const PieChartIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);
