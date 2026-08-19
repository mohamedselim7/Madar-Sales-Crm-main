import React, { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  Search, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Gauge,
  Layout,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Clock,
  Target,
  DollarSign,
  Activity,
  X,
  ChevronRight,
  ArrowUpRight,
  BarChart3,
  MousePointer2,
  Lock,
  Smartphone,
  Cpu,
  Sparkles,
  Download,
  Share2,
  Save,
  Edit3,
  Plus,
  Trash2,
  Copy,
  Check
} from "lucide-react";
import { Card, Button } from "@/src/components/UI";
import { useSettings } from "@/src/hooks/useSettings";
import { useClients } from "@/src/hooks/useClients";
import { analyzeWebsiteWithAI } from "@/src/lib/gemini";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const ANALYSIS_STAGES = [
  "التحقق من الرابط",
  "قراءة الصفحة الرئيسية",
  "قراءة الصفحات الداخلية",
  "استخراج البيانات الحقيقية",
  "إرسال البيانات إلى Gemini",
  "إنشاء التقرير النهائي"
];

export const WebsiteAnalysisPage: React.FC = () => {
  const { settings } = useSettings();
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [url, setUrl] = useState("");
  
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [editableResults, setEditableResults] = useState<any | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusText, setStatusText] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (analyzing) {
      // Countdown timer
      countdownRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setShowTimeoutWarning(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [analyzing]);

  const validateUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const runAnalysis = async () => {
    if (!url) return;
    if (!validateUrl(url)) {
      setError("رابط الموقع غير صالح. يرجى إدخال رابط يبدأ بـ http:// أو https://");
      return;
    }

    const apiKey = settings.apiIntegrations?.gemini;
    if (!apiKey) {
      setError("يرجى إدخال مفتاح Gemini API في صفحة الإعدادات أولاً.");
      return;
    }

    setAnalyzing(true);
    setProgress(5);
    setTimeLeft(50);
    setCurrentStageIndex(0);
    setError(null);
    setResults(null);
    setStatusText("");
    setShowTimeoutWarning(false);

    try {
      // Step 1: Validate URL & Step 2: Fetch Homepage (Combined in backend)
      setCurrentStageIndex(0);
      setProgress(10);
      await new Promise(r => setTimeout(r, 1000));
      
      setCurrentStageIndex(1);
      setProgress(25);
      
      // Call Backend Crawler
      const crawlResponse = await fetch("/api/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (!crawlResponse.ok) {
        const errorData = await crawlResponse.json();
        throw new Error(errorData.error || "فشل النظام في التعرف على بيانات الموقع الحقيقية.");
      }

      const crawledData = await crawlResponse.json();

      setCurrentStageIndex(2);
      setProgress(40);
      await new Promise(r => setTimeout(r, 800));

      setCurrentStageIndex(3);
      setProgress(55);
      await new Promise(r => setTimeout(r, 800));

      // Step 5: Send to Gemini
      setCurrentStageIndex(4);
      setProgress(70);
      const aiResults = await analyzeWebsiteWithAI(apiKey, crawledData);
      
      // Step 6: Finalize
      setCurrentStageIndex(5);
      setProgress(90);
      
      // Success splash
      setStatusText("تم تحليل الموقع بنجاح!");
      setProgress(100);
      await new Promise(r => setTimeout(r, 1000));

      setResults(aiResults);
      setEditableResults(aiResults);

      // Save to Firestore
      const selectedClient = clients.find(c => c.id === selectedClientId);
      const docRef = await addDoc(collection(db, "aiAnalysis"), {
        clientId: selectedClientId || null,
        clientCode: selectedClient?.clientCode || null,
        businessName: selectedClient?.clientInfo.businessName || "عملاء من غير القائمة",
        websiteUrl: url,
        reportTitle: "تقرير تحليل الموقع الاستراتيجي",
        analysisType: "website",
        scores: aiResults.subScores,
        overallScore: aiResults.overallScore,
        problems: aiResults.criticalProblems,
        recommendations: aiResults.recommendations,
        revenueOpportunities: aiResults.revenueOpportunities,
        technicalAudit: aiResults.technicalAudit,
        quickWins: aiResults.quickWins,
        monthlyImprovements: aiResults.monthlyImprovements,
        longTermOpportunities: aiResults.longTermOpportunities,
        marketInsights: aiResults.marketInsights,
        businessField: aiResults.businessField,
        platform: aiResults.platform,
        createdAt: serverTimestamp()
      });
      setCurrentAnalysisId(docRef.id);
      fetchHistory();

    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء رصد بيانات الموقع.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!currentAnalysisId || !editableResults) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "aiAnalysis", currentAnalysisId), {
        reportTitle: editableResults.reportTitle || "تقرير تحليل الموقع الاستراتيجي",
        scores: editableResults.subScores,
        overallScore: editableResults.overallScore,
        problems: editableResults.criticalProblems,
        recommendations: editableResults.recommendations,
        revenueOpportunities: editableResults.revenueOpportunities,
        technicalAudit: editableResults.technicalAudit,
        quickWins: editableResults.quickWins,
        monthlyImprovements: editableResults.monthlyImprovements,
        longTermOpportunities: editableResults.longTermOpportunities,
        marketInsights: editableResults.marketInsights,
        businessField: editableResults.businessField,
        platform: editableResults.platform,
        customSections: editableResults.customSections || [],
        updatedAt: serverTimestamp()
      });
      setResults(editableResults);
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `aiAnalysis/${currentAnalysisId}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [settings.apiIntegrations?.gemini]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "aiAnalysis"),
        where("analysisType", "==", "website"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(historyData);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFromHistory = (analysis: any) => {
    // Reconstruct results object from flat Firestore fields
    const reconstructedResults = {
      reportTitle: analysis.reportTitle,
      overallScore: analysis.overallScore,
      businessField: analysis.businessField,
      platform: analysis.platform,
      subScores: analysis.scores,
      criticalProblems: analysis.problems,
      recommendations: analysis.recommendations,
      revenueOpportunities: analysis.revenueOpportunities,
      technicalAudit: analysis.technicalAudit,
      quickWins: analysis.quickWins,
      monthlyImprovements: analysis.monthlyImprovements,
      longTermOpportunities: analysis.longTermOpportunities,
      marketInsights: analysis.marketInsights,
      customSections: analysis.customSections || []
    };
    
    setResults(reconstructedResults);
    setEditableResults(reconstructedResults);
    setCurrentAnalysisId(analysis.id);
    setUrl(analysis.websiteUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteFromHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذا التحليل؟")) return;
    
    try {
      await deleteDoc(doc(db, "aiAnalysis", id));
      setHistory(prev => prev.filter(item => item.id !== id));
      if (currentAnalysisId === id) {
        setResults(null);
        setEditableResults(null);
        setCurrentAnalysisId(null);
      }
    } catch (err) {
      console.error("Error deleting history item:", err);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    const exportWithConfig = async (scale: number, simplify: boolean) => {
      const element = reportRef.current!;
      
      return await html2canvas(element, {
        scale: scale,
        useCORS: true,
        backgroundColor: "#020617",
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap');
            
            * { 
              backdrop-filter: none !important; 
              -webkit-backdrop-filter: none !important;
              animation: none !important;
              transition: none !important;
              box-shadow: none !important;
              text-shadow: none !important;
              letter-spacing: normal !important;
              font-family: "IBM Plex Sans Arabic", sans-serif !important;
            }
            .glass {
              background: #0f172a !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              backdrop-filter: none !important;
            }
            [data-pdf-ignore="true"] {
              display: none !important;
            }
            
            ${simplify ? `
              * { 
                background-image: none !important; 
                background-color: transparent !important;
                color: #ffffff !important;
                border-color: rgba(255,255,255,0.1) !important;
              }
              .bg-slate-900, .bg-slate-950, body { background-color: #020617 !important; }
              div, section, article { background-color: transparent !important; }
            ` : ''}
            
            /* Tailwind 4 oklch fallbacks */
            .text-white { color: #ffffff !important; }
            .text-blue-400 { color: #60a5fa !important; }
            .text-sky-400 { color: #38bdf8 !important; }
            .text-emerald-400 { color: #34d399 !important; }
            .text-amber-400 { color: #fbbf24 !important; }
            .text-red-400 { color: #f87171 !important; }
            .text-slate-400 { color: #94a3b8 !important; }
            .text-slate-500 { color: #64748b !important; }
            
            .bg-blue-600 { background-color: #2563eb !important; }
            .bg-slate-800 { background-color: #1e293b !important; }
            .bg-slate-900 { background-color: #0f172a !important; }
            .bg-slate-950 { background-color: #020617 !important; }
          `;
          clonedDoc.head.appendChild(style);

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            
            // 1. Scrub okl/oklch/oklab from inline style
            const directStyle = el.getAttribute('style') || '';
            if (directStyle.includes('okl')) {
              el.setAttribute('style', directStyle.replace(/okl(ab|ch)\([^)]+\)/g, '#ffffff'));
            }

            // 2. Clear problematic filters
            el.style.filter = 'none';
            el.style.backdropFilter = 'none';
            (el.style as any).webkitBackdropFilter = 'none';
            el.style.boxShadow = 'none';
            el.style.textShadow = 'none';

            // 3. Scrub computed colors
            const computed = window.getComputedStyle(el);
            const colorProps = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke', 'stopColor', 'textDecorationColor'];
            
            colorProps.forEach(prop => {
              const val = (computed as any)[prop];
              if (val && (val.includes('oklab') || val.includes('oklch'))) {
                (el.style as any)[prop] = (prop === 'color' || prop === 'fill' || prop === 'stroke' || prop === 'stopColor') ? '#ffffff' : 'transparent';
              }
            });

            // 4. Force background fix for gradients
            if (computed.backgroundImage.includes('okl')) {
              el.style.backgroundImage = 'none';
              el.style.backgroundColor = '#1e293b'; 
            }

            el.style.direction = 'rtl';
            el.style.textAlign = 'right';
          }

          // 5. Global CSS text replacement in style tags
          clonedDoc.head.querySelectorAll('style').forEach(tag => {
            if (tag.innerHTML.includes('okl')) {
              tag.innerHTML = tag.innerHTML.replace(/okl(ab|ch)\([^)]+\)/g, '#ffffff');
            }
          });
        }
      });
    };

    try {
      setIsExportingPDF(true);
      setStatusText("جاري تحضير التقرير الاحترافي...");
      await new Promise(r => setTimeout(r, 500));

      let canvas;
      try {
        canvas = await exportWithConfig(1.5, false);
      } catch (firstErr) {
        console.warn("First PDF export attempt failed, trying simplified version...", firstErr);
        canvas = await exportWithConfig(1.2, true);
      }

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      
      // Calculate image dimensions to fit page width
      const imgProps = pdf.getImageProperties(imgData);
      const scaledHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      let heightLeft = scaledHeight;
      let position = margin;

      // Page 1
      pdf.setFillColor(2, 6, 23); // Dark theme matching the app
      pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
      pdf.addImage(imgData, "PNG", margin, position, contentWidth, scaledHeight, undefined, 'FAST');
      
      heightLeft -= (pdfHeight - margin * 2);

      // Subsequent pages
      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - scaledHeight + margin;
        pdf.setFillColor(2, 6, 23);
        pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
        pdf.addImage(imgData, "PNG", margin, position, contentWidth, scaledHeight, undefined, 'FAST');
        heightLeft -= (pdfHeight - margin * 2);
      }

      const domain = new URL(url).hostname.replace('www.', '').split('/')[0];
      pdf.save(`MADAR-SALES-CRM-Report-${domain}.pdf`);
    } catch (err) {
      console.error("Critical PDF Export Error:", err);
      alert("عذراً، فشل النظام في معالجة التنسيق المتقدم للتقرير بسبب قيود المتصفح. يرجى محاولة التصدير من متصفح آخر أو مراسلة الدعم.");
    } finally {
      setIsExportingPDF(false);
      setStatusText("");
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/analysis/${currentAnalysisId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addCustomSection = () => {
    const newSection = { title: "قسم جديد", content: "أضف تفاصيل القسم هنا..." };
    setEditableResults((prev: any) => ({
      ...prev,
      customSections: [...(prev.customSections || []), newSection]
    }));
  };

  const updateCustomSection = (index: number, field: string, value: string) => {
    const updated = [...(editableResults.customSections || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditableResults((prev: any) => ({ ...prev, customSections: updated }));
  };

  const removeCustomSection = (index: number) => {
    const updated = editableResults.customSections.filter((_: any, i: number) => i !== index);
    setEditableResults((prev: any) => ({ ...prev, customSections: updated }));
  };

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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-[2rem] border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-2xl shadow-blue-500/10">
            <Globe size={32} />
          </div>
          <div>
            {isEditing && editableResults ? (
              <input 
                className="text-4xl font-black text-white bg-transparent border-b border-white/20 focus:outline-none w-full tracking-tighter"
                value={editableResults.reportTitle || ""}
                onChange={(e) => setEditableResults({...editableResults, reportTitle: e.target.value})}
              />
            ) : (
              <h1 className="text-4xl font-black text-white tracking-tighter">
                {results?.reportTitle || "تحليل الموقع الاحترافي"}
              </h1>
            )}
            <p className="text-slate-400 font-bold text-sm mt-1">حلّل موقع عميلك بالذكاء الاصطناعي.. واعرف نقاط القوة والفرص لزيادة أرباحه! 🚀</p>
          </div>
        </div>
        
        {results && (
          <div className="flex gap-4" data-pdf-ignore="true">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(false)} icon={X}>إلغاء</Button>
                <Button variant="primary" onClick={handleSave} loading={isSaving} icon={Save} className="bg-blue-600 hover:bg-blue-500">حفظ التغييرات</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(true)} icon={Edit3}>تعديل التقرير</Button>
                <Button variant="secondary" onClick={handleExportPDF} icon={Download} loading={isExportingPDF}>تصدير PDF</Button>
                <Button variant="primary" onClick={handleShare} icon={copied ? Check : Share2} className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20">
                  {copied ? "تم النسخ" : "مشاركة"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {!results && !analyzing && (
        <Card glass className="p-10 max-w-4xl mx-auto border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/10 blur-[120px] rounded-full" />
          
          <div className="relative z-10 space-y-8">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <h3 className="text-3xl font-black text-white flex items-center justify-center gap-4">
                <Sparkles className="text-blue-400" size={32} />
                فحص الموقع بالذكاء الاصطناعي
              </h3>
              <p className="text-slate-400 leading-relaxed">
                استخدم قوة تقنيات MADAR SALES CRM و Gemini 2.0 لتحليل موقع الويب الخاص بك وتحديد الثغرات التقنية وفرص النمو لزيادة الأرباح.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">اختيار العميل (اختياري)</label>
                  <select 
                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                    value={selectedClientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      setSelectedClientId(clientId);
                      if (clientId) {
                        const client = clients.find(c => c.id === clientId);
                        if (client) {
                          // Reset URL first to ensure it changes if selecting a different client
                          let newUrl = "";
                          
                          // Prioritize direct websiteUrl
                          if (client.clientInfo.websiteUrl) {
                            newUrl = client.clientInfo.websiteUrl;
                          } 
                          // Fallback to important links if websiteUrl is missing
                          else if (client.importantLinks && client.importantLinks.length > 0) {
                            // Try to find a link that looks like a store
                            const storeLink = client.importantLinks.find(link => 
                              link.url.includes("salla.sa") || 
                              link.url.includes("zid.sa") || 
                              link.url.includes("shopify.com") ||
                              link.title.includes("متجر") ||
                              link.title.includes("موقع")
                            );
                            
                            if (storeLink) {
                              newUrl = storeLink.url;
                            } else {
                              // Just take the first link if no obvious store link
                              newUrl = client.importantLinks[0].url;
                            }
                          }
                          
                          setUrl(newUrl);
                        }
                      } else {
                        // If selecting "New Client", optionally clear the URL or keep it
                        setUrl("");
                      }
                    }}
                  >
                    <option value="">-- عميل جديد --</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.clientInfo.businessName} ({client.clientCode})</option>
                    ))}
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">رابط الموقع</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 right-4 flex items-center text-slate-500 group-focus-within:text-blue-400 transition-colors">
                      <Globe size={20} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="https://example.com"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
               </div>
            </div>

            <Button 
              onClick={runAnalysis} 
              disabled={!url} 
              icon={Zap}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 text-lg font-black"
            >
              ابدأ التحليل الذكي الآن
            </Button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 font-bold justify-center"
              >
                <AlertCircle size={20} />
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Smartphone, label: "استجابة الجوال" },
                { icon: Lock, label: "الأمان والخصوصية" },
                { icon: Cpu, label: "الأداء التقني" },
                { icon: Target, label: "معدل التحويل" },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-center space-y-2">
                  <item.icon size={20} className="mx-auto text-slate-500" />
                  <span className="block text-[10px] text-slate-600 font-bold uppercase tracking-tighter">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* History Section */}
      {!results && !analyzing && (loadingHistory || history.length > 0) && (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <Clock className="text-blue-400" size={24} />
              سجل التحليلات السابقة
            </h3>
            <Button variant="secondary" size="sm" onClick={fetchHistory} icon={RefreshCw} loading={loadingHistory}>تحديث</Button>
          </div>
          
          {loadingHistory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => (
                <Card 
                  glass 
                  key={item.id} 
                  className="p-6 cursor-pointer hover:border-blue-500/30 transition-all group relative overflow-hidden"
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full" />
                  
                  <div className="flex flex-col h-full space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                        <Globe size={18} />
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{item.businessName || "عميل"}</div>
                        <div className="text-[10px] text-slate-500">{item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('ar-EG') : 'قيد المعالجة'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-white text-lg line-clamp-1 mb-1">{item.reportTitle}</h4>
                      <p className="text-xs text-slate-500 font-mono truncate">{item.websiteUrl}</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">التقييم:</span>
                        <span className={cn(
                          "text-sm font-black",
                          item.overallScore > 80 ? "text-emerald-400" : item.overallScore > 60 ? "text-amber-400" : "text-red-400"
                        )}>{item.overallScore}%</span>
                      </div>
                      <div className="flex gap-2">
                         <button 
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="p-2 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress Modal */}
      <AnimatePresence>
        {analyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-slate-900 border border-white/[0.1] rounded-[2.5rem] shadow-[0_0_100px_rgba(37,99,235,0.2)] p-10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-[shimmer_2s_infinite_linear] bg-[length:200%_100%]" />
              
              <div className="flex flex-col items-center text-center space-y-8">
                <div className="w-24 h-24 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-center relative">
                  <RefreshCw size={40} className="text-blue-400 animate-spin" />
                  <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white">جاري تحليل الموقع الاستراتيجي</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">MADAR SALES CRM Intelligence Engine</p>
                </div>

                <div className="w-full space-y-4">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-right">
                      <span className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">المرحلة الحالية</span>
                      <span className="text-white font-bold">{statusText || ANALYSIS_STAGES[currentStageIndex]}</span>
                    </div>
                    <div className="text-left">
                      <span className="block text-blue-400 text-3xl font-black">{Math.floor(progress)}%</span>
                    </div>
                  </div>

                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-white/[0.05] p-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 bg-[length:200%_100%] animate-[shimmer_2s_infinite_linear] rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-slate-500 font-medium text-sm">
                    <Clock size={16} />
                    الوقت المتوقع المتبقي: 
                    <span className="text-white font-bold font-mono ml-1">{timeLeft} ثانية</span>
                  </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {ANALYSIS_STAGES.map((stage, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all duration-500",
                        i < currentStageIndex 
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                          : i === currentStageIndex 
                            ? "bg-blue-500/5 border-blue-500/20 text-blue-400 animate-pulse" 
                            : "bg-white/[0.01] border-white/[0.05] text-slate-600"
                      )}
                    >
                      <div className="shrink-0">
                        {i < currentStageIndex ? <CheckCircle2 size={16} /> : i === currentStageIndex ? <RefreshCw size={16} className="animate-spin" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                      </div>
                      <span className="text-xs font-bold leading-none">{stage}</span>
                    </div>
                  ))}
                </div>

                {showTimeoutWarning && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col items-center gap-4"
                  >
                    <div className="flex items-center gap-3 text-amber-500 font-bold">
                       <AlertCircle size={20} />
                       التحليل يستغرق وقتًا أطول من المتوقع
                    </div>
                    <div className="flex gap-4">
                       <Button variant="secondary" size="sm" onClick={() => setTimeLeft(20)}>الانتظار</Button>
                       <Button variant="danger" size="sm" onClick={() => setAnalyzing(false)}>إلغاء التحليل</Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Dashboard */}
      <AnimatePresence>
        {(results || isEditing) && !analyzing && (
          <motion.div 
            ref={reportRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 animate-in"
          >
            {/* Top Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Overall Score Circle */}
              <Card glass className="p-8 lg:col-span-1 flex flex-col items-center justify-center space-y-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-white/[0.02] group-hover:text-blue-500/[0.05] transition-colors">
                  <TrendingUp size={120} />
                </div>
                
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest relative z-10">التقييم العام للموقع</h3>
                
                <div className="relative inline-flex items-center justify-center p-8 z-10">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="84"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-white/[0.05]"
                    />
                    <motion.circle
                      cx="96"
                      cy="96"
                      r="84"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={528}
                      initial={{ strokeDashoffset: 528 }}
                      animate={{ strokeDashoffset: 528 - (528 * (isEditing ? editableResults.overallScore : results.overallScore)) / 100 }}
                      transition={{ duration: 2, ease: "easeOut" }}
                      className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isEditing && editableResults ? (
                      <input 
                        type="number"
                        className="text-6xl font-black text-white bg-transparent text-center w-24 focus:outline-none"
                        value={editableResults.overallScore ?? 0}
                        onChange={(e) => setEditableResults({...editableResults, overallScore: parseInt(e.target.value) || 0})}
                      />
                    ) : (
                      <span className="text-6xl font-black text-white">{results.overallScore}</span>
                    )}
                    <span className="text-slate-500 font-bold">100 /</span>
                  </div>
                </div>

                <div className="px-6 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 font-black text-xs uppercase tracking-widest relative z-10">
                   {(isEditing ? editableResults.overallScore : results.overallScore) > 80 ? "أداء ممتاز" : (isEditing ? editableResults.overallScore : results.overallScore) > 60 ? "أداء جيد" : "يحتاج تحسين"}
                </div>
              </Card>

              {/* Sub-Scores & Summary */}
              <Card glass className="p-8 lg:col-span-3 space-y-8">
                <div className="flex justify-between items-center border-b border-white/[0.05] pb-6">
                  <div className="flex items-center gap-3">
                    <Activity size={20} className="text-blue-400" />
                    <h3 className="font-bold text-white text-xl">تحليل المؤشرات الأساسية</h3>
                  </div>
                  <div className="flex gap-4">
                    <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
                      <Target size={14} className="text-blue-400" />
                      {isEditing && editableResults ? (
                        <input 
                          className="text-[10px] font-black text-white uppercase bg-transparent border-none p-0 focus:outline-none"
                          value={editableResults.businessField || ""}
                          onChange={(e) => setEditableResults({...editableResults, businessField: e.target.value})}
                        />
                      ) : (
                        <span className="text-[10px] font-black text-white uppercase">{results.businessField || "غير محدد"}</span>
                      )}
                    </div>
                    <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-2">
                      <Cpu size={14} className="text-indigo-400" />
                      {isEditing && editableResults ? (
                        <input 
                          className="text-[10px] font-black text-white uppercase bg-transparent border-none p-0 focus:outline-none"
                          value={editableResults.platform || ""}
                          onChange={(e) => setEditableResults({...editableResults, platform: e.target.value})}
                        />
                      ) : (
                        <span className="text-[10px] font-black text-white uppercase">{results.platform || "غير محدد"}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <ScoreBar label="تجربة المستخدم UX" value={isEditing ? editableResults.subScores.ux : results.subScores.ux} colorClass="text-blue-400" />
                    <ScoreBar label="عناصر التحويل CRO" value={isEditing ? editableResults.subScores.cro : results.subScores.cro} colorClass="text-indigo-400" />
                    <ScoreBar label="هيكلة الموقع Structure" value={isEditing ? editableResults.subScores.structure : results.subScores.structure} colorClass="text-sky-400" />
                  </div>
                  <div className="space-y-6">
                    <ScoreBar label="تحسين محركات البحث SEO" value={isEditing ? editableResults.subScores.seo : results.subScores.seo} colorClass="text-emerald-400" />
                    <ScoreBar label="سرعة التحميل Speed" value={isEditing ? editableResults.subScores.speed : results.subScores.speed} colorClass="text-amber-400" />
                  </div>
                  <div className="space-y-6">
                    <ScoreBar label="الثقة والمصداقية Trust" value={isEditing ? editableResults.subScores.trust : results.subScores.trust} colorClass="text-purple-400" />
                    <ScoreBar label="جودة المحتوى Content" value={isEditing ? editableResults.subScores.content : results.subScores.content} colorClass="text-fuchsia-400" />
                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                          <Shield size={20} />
                       </div>
                       <div>
                          <span className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">الحالة الأمنية</span>
                          <span className="text-white font-bold">آمن (SSL مفعل)</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-blue-500/[0.03] border border-blue-500/10 rounded-2xl text-slate-400 leading-relaxed italic relative">
                  <MessageSquare className="absolute -top-3 -right-3 text-blue-500/20" size={40} />
                  {isEditing && editableResults ? (
                    <textarea 
                      className="w-full bg-transparent text-sm text-slate-300 focus:outline-none resize-none"
                      rows={3}
                      value={editableResults.recommendations || ""}
                      onChange={(e) => setEditableResults({...editableResults, recommendations: e.target.value})}
                    />
                  ) : (
                    <p className="relative z-10 text-sm">{results.recommendations}</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Critical Problems */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                 <AlertCircle className="text-red-500" size={24} />
                 <h3 className="text-2xl font-black text-white tracking-tight">مشاكل حرجة تحتاج تدخل سريع</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {(isEditing ? editableResults.criticalProblems : results.criticalProblems).map((issue: any, i: number) => (
                   <Card key={i} glass className="p-6 border-red-500/10 hover:border-red-500/30 transition-all group">
                     {isEditing ? (
                       <div className="space-y-4">
                         <div className="flex justify-between">
                            <select 
                              className="bg-slate-800 text-[10px] text-white rounded px-2"
                              value={issue.priority || "Medium"}
                              onChange={(e) => {
                                const updated = [...editableResults.criticalProblems];
                                updated[i] = { ...updated[i], priority: e.target.value };
                                setEditableResults({...editableResults, criticalProblems: updated});
                              }}
                            >
                               <option value="High">High</option>
                               <option value="Medium">Medium</option>
                               <option value="Low">Low</option>
                            </select>
                            <button 
                              onClick={() => {
                                const updated = editableResults.criticalProblems.filter((_: any, idx: number) => idx !== i);
                                setEditableResults({...editableResults, criticalProblems: updated});
                              }}
                              className="text-red-500 hover:text-red-400"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                         <input 
                           className="w-full bg-transparent border-b border-white/10 font-bold text-white text-lg focus:outline-none"
                           value={issue.problem || ""}
                           onChange={(e) => {
                             const updated = [...editableResults.criticalProblems];
                             updated[i] = { ...updated[i], problem: e.target.value };
                             setEditableResults({...editableResults, criticalProblems: updated});
                           }}
                         />
                         <textarea 
                           className="w-full bg-transparent border rounded p-2 text-slate-500 text-sm focus:outline-none"
                           value={issue.impact || ""}
                           onChange={(e) => {
                             const updated = [...editableResults.criticalProblems];
                             updated[i] = { ...updated[i], impact: e.target.value };
                             setEditableResults({...editableResults, criticalProblems: updated});
                           }}
                         />
                       </div>
                     ) : (
                       <>
                        <div className="flex justify-between items-start mb-4">
                          <div className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            issue.priority === "High" ? "bg-red-500/10 text-red-500" : 
                            issue.priority === "Medium" ? "bg-amber-500/10 text-amber-500" :
                            "bg-blue-500/10 text-blue-500"
                          )}>
                            أولوية: {issue.priority === "High" ? "عالية" : issue.priority === "Medium" ? "متوسطة" : "عادية"}
                          </div>
                          <AlertCircle className="text-red-500/40 group-hover:text-red-500 transition-colors" size={20} />
                        </div>
                        <h4 className="font-bold text-white text-lg mb-2">{issue.problem}</h4>
                        <p className="text-slate-500 text-sm leading-relaxed">{issue.impact}</p>
                       </>
                     )}
                   </Card>
                 ))}
                 {isEditing && (
                   <button 
                    onClick={() => setEditableResults({...editableResults, criticalProblems: [...editableResults.criticalProblems, { problem: "مشكلة جديدة", impact: "الأثر...", priority: "Medium" }]})}
                    className="p-6 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 transition-all"
                   >
                     <Plus size={24} />
                     <span className="font-bold text-sm">إضافة مشكلة</span>
                   </button>
                 )}
              </div>
            </div>

            {/* Strategic Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Growth & Wins */}
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Target className="text-blue-400" size={24} />
                    <h3 className="text-2xl font-black text-white">خارطة طريق النمو</h3>
                  </div>
                  
                  <Card glass className="p-0 overflow-hidden divide-y divide-white/[0.05]">
                    {/* Quick Wins */}
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Zap size={16} />
                          </div>
                          <h4 className="font-bold text-white">نتائج سريعة (خلال ٧ أيام)</h4>
                        </div>
                        {isEditing && (
                          <button 
                            onClick={() => setEditableResults({...editableResults, quickWins: [...editableResults.quickWins, "تحسين جديد..."]})}
                            className="p-1 hover:text-emerald-400"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(isEditing ? editableResults.quickWins : results.quickWins).map((win: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 text-sm">
                             <CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-500" />
                             {isEditing ? (
                               <div className="flex-1 flex gap-2">
                                 <input 
                                   className="flex-1 bg-transparent focus:outline-none" 
                                   value={win} 
                                   onChange={(e) => {
                                      const updated = [...editableResults.quickWins];
                                      updated[i] = e.target.value;
                                      setEditableResults({...editableResults, quickWins: updated});
                                   }}
                                 />
                                 <Trash2 size={12} className="text-red-500 cursor-pointer" onClick={() => setEditableResults({...editableResults, quickWins: editableResults.quickWins.filter((_: any, idx: number) => idx !== i)})} />
                               </div>
                             ) : win}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 30-Day */}
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Clock size={16} />
                          </div>
                          <h4 className="font-bold text-white">تحسينات خلال ٣٠ يوماً</h4>
                        </div>
                        {isEditing && (
                          <button 
                            onClick={() => setEditableResults({...editableResults, monthlyImprovements: [...editableResults.monthlyImprovements, "تحسين شهري..."]})}
                            className="p-1 hover:text-blue-400"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(isEditing ? editableResults.monthlyImprovements : results.monthlyImprovements).map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 text-sm">
                             <TrendingUp size={14} className="mt-1 shrink-0 text-blue-500" />
                             {isEditing ? (
                               <div className="flex-1 flex gap-2">
                                 <input 
                                   className="flex-1 bg-transparent focus:outline-none" 
                                   value={item} 
                                   onChange={(e) => {
                                      const updated = [...editableResults.monthlyImprovements];
                                      updated[i] = e.target.value;
                                      setEditableResults({...editableResults, monthlyImprovements: updated});
                                   }}
                                 />
                                 <Trash2 size={12} className="text-red-500 cursor-pointer" onClick={() => setEditableResults({...editableResults, monthlyImprovements: editableResults.monthlyImprovements.filter((_: any, idx: number) => idx !== i)})} />
                               </div>
                             ) : item}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Long Term */}
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <Target size={16} />
                          </div>
                          <h4 className="font-bold text-white">فرص نمو بعيدة المدى</h4>
                        </div>
                        {isEditing && (
                          <button 
                            onClick={() => setEditableResults({...editableResults, longTermOpportunities: [...editableResults.longTermOpportunities, "فرصة طويلة الأمد..."]})}
                            className="p-1 hover:text-indigo-400"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(isEditing ? editableResults.longTermOpportunities : results.longTermOpportunities).map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 text-sm">
                             <ArrowRight size={14} className="mt-1 shrink-0 text-indigo-500" />
                             {isEditing ? (
                               <div className="flex-1 flex gap-2">
                                 <input 
                                   className="flex-1 bg-transparent focus:outline-none" 
                                   value={item} 
                                   onChange={(e) => {
                                      const updated = [...editableResults.longTermOpportunities];
                                      updated[i] = e.target.value;
                                      setEditableResults({...editableResults, longTermOpportunities: updated});
                                   }}
                                 />
                                 <Trash2 size={12} className="text-red-500 cursor-pointer" onClick={() => setEditableResults({...editableResults, longTermOpportunities: editableResults.longTermOpportunities.filter((_: any, idx: number) => idx !== i)})} />
                               </div>
                             ) : item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
               </div>

               {/* Revenue & Marketing Insights */}
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <DollarSign className="text-emerald-500" size={24} />
                      <h3 className="text-2xl font-black text-white">فرص زيادة الأرباح</h3>
                    </div>
                    {isEditing && (
                      <Button variant="secondary" size="sm" onClick={() => setEditableResults({...editableResults, revenueOpportunities: [...editableResults.revenueOpportunities, { insight: "فرصة جديدة", potentialGrowth: "10%" }]})} icon={Plus}>إضافة فرصة</Button>
                    )}
                  </div>

                  <Card glass className="p-8 space-y-8">
                     <div className="space-y-4">
                       {(isEditing ? editableResults.revenueOpportunities : results.revenueOpportunities).map((item: any, i: number) => (
                         <div key={i} className="p-6 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-4 hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] transition-all relative">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                               <TrendingUp size={24} />
                            </div>
                            <div className="flex-1">
                               {isEditing ? (
                                 <div className="space-y-2">
                                   <input className="w-full bg-transparent text-white font-bold" value={item.insight} onChange={(e) => {
                                      const updated = [...editableResults.revenueOpportunities];
                                      updated[i].insight = e.target.value;
                                      setEditableResults({...editableResults, revenueOpportunities: updated});
                                   }} />
                                   <input className="w-full bg-transparent text-emerald-400 text-xs" value={item.potentialGrowth} onChange={(e) => {
                                      const updated = [...editableResults.revenueOpportunities];
                                      updated[i].potentialGrowth = e.target.value;
                                      setEditableResults({...editableResults, revenueOpportunities: updated});
                                   }} />
                                 </div>
                               ) : (
                                 <>
                                  <h4 className="font-bold text-white text-lg mb-1">{item.insight}</h4>
                                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-black uppercase tracking-widest">
                                      <ArrowUpRight size={14} />
                                      النمو المتوقع: {item.potentialGrowth}
                                  </div>
                                 </>
                               )}
                            </div>
                            {isEditing && (
                              <Trash2 size={16} className="text-red-500 cursor-pointer" onClick={() => setEditableResults({...editableResults, revenueOpportunities: editableResults.revenueOpportunities.filter((_: any, idx: number) => idx !== i)})} />
                            )}
                         </div>
                       ))}
                     </div>

                     <div className="pt-8 border-t border-white/[0.05] space-y-4">
                        <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                           <Sparkles size={20} className="text-blue-400" />
                           تحليل متموقع للبراند
                        </h4>
                        <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-slate-400 leading-loose text-sm">
                           {isEditing ? (
                             <textarea 
                               className="w-full bg-transparent focus:outline-none resize-none"
                               rows={4}
                               value={editableResults.marketInsights}
                               onChange={(e) => setEditableResults({...editableResults, marketInsights: e.target.value})}
                             />
                           ) : results.marketInsights}
                        </div>
                     </div>
                  </Card>
               </div>
            </div>

            {/* Custom Sections */}
            {(isEditing ? (editableResults.customSections || []) : (results.customSections || [])).length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Layout className="text-blue-400" size={24} />
                  <h3 className="text-2xl font-black text-white">أقسام إضافية</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(isEditing ? editableResults.customSections : results.customSections).map((section: any, i: number) => (
                    <Card key={i} glass className="p-8 space-y-4 relative group">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <input 
                              className="text-xl font-bold text-white bg-transparent border-b border-white/10 focus:outline-none flex-1"
                              value={section.title}
                              onChange={(e) => updateCustomSection(i, "title", e.target.value)}
                            />
                            <button onClick={() => removeCustomSection(i)} className="text-red-500 p-2"><Trash2 size={18} /></button>
                          </div>
                          <textarea 
                            className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 text-slate-400 text-sm focus:outline-none resize-none"
                            rows={4}
                            value={section.content}
                            onChange={(e) => updateCustomSection(i, "content", e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <h4 className="text-xl font-bold text-white">{section.title}</h4>
                          <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                            {section.content}
                          </div>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {isEditing && (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={addCustomSection} icon={Plus} className="border-2 border-dashed px-10 rounded-[2rem]">إضافة قسم جديد مخصص</Button>
              </div>
            )}

            {/* Technical Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {[
                 { icon: Gauge, label: "السرعة والأداء", key: "speed" },
                 { icon: Search, label: "محركات البحث", key: "seo" },
                 { icon: AlertCircle, label: "أخطاء تقنية", key: "errors" },
                 { icon: Smartphone, label: "تجربة الجوال", key: "mobile" },
               ].map((audit, i) => (
                 <Card key={i} glass className="p-6 text-center space-y-4 group">
                    <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-blue-400 transition-colors mx-auto">
                       <audit.icon size={24} />
                    </div>
                    <div className="space-y-1">
                       <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">{audit.label}</span>
                       {isEditing ? (
                         <input 
                           className="block text-white font-bold bg-transparent text-center focus:outline-none w-full"
                           value={editableResults.technicalAudit[audit.key]}
                           onChange={(e) => setEditableResults({
                             ...editableResults, 
                             technicalAudit: { ...editableResults.technicalAudit, [audit.key]: e.target.value }
                           })}
                         />
                       ) : (
                         <span className="block text-white font-bold">{results.technicalAudit[audit.key]}</span>
                       )}
                    </div>
                 </Card>
               ))}
            </div>

            {/* Final Actions */}
            <div className="flex justify-center pt-10" data-pdf-ignore="true">
               <Button 
                onClick={() => {
                  setResults(null);
                  setEditableResults(null);
                  setCurrentAnalysisId(null);
                  setUrl("");
                }} 
                variant="secondary" 
                icon={RefreshCw}
                className="px-10 h-14 rounded-2xl"
               >
                 إجراء تحليل جديد لموقع آخر
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
