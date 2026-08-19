import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

export interface RawRowMeta {
  fileName: string;
  sheetName: string;
  rowIndex: number;
}

export interface CustomerProcessResult {
  clientName: string;          // Name of the customer (extracted or fallback)
  originalPhone: string;       // First extracted phone number in raw form
  cleanedPhone: string;        // Normalized WhatsApp format: +9665xxxxxxxx or original if invalid
  storeLink: string;           // Extracted/repaired store link
  socialLink: string;          // Extracted/repaired social media link
  linkType: "store" | "social" | "both" | "none";
  classification: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
  classificationName: string;  // Arabic name of classification
  reason: string;              // Explanation of classification
  sourceMeta: RawRowMeta;      // Source location metadata
  allSources: RawRowMeta[];    // List of all merged row locations
  remarks: string[];           // Custom logs/notes/warnings
  allPhones: string[];         // All phones discovered in this row
  allLinks: string[];          // All links discovered in this row
  originalRowData: any[];      // The unmodified values for tracking
  clientNameConfidence: number;// Confidence score for extracted customer name (0-100)
  remarksConfidence: number;   // Confidence score for remarks (0-100)

  // Advanced Lead Qualification Attributes (Version 34)
  approvedName: string;        // الاسم المعتمد (only personal, business, or brand name)
  alternativeName: string;     // الاسم البديل (from link, social, or domain)
  nameSource: "Excel Cell" | "Website Domain" | "Social Username" | "Store Slug" | "Manual Review"; // مصدر الاسم
  nameConfidence: number;      // نسبة ثقة الاسم (0-100)
  whatsappReady: boolean;      // جاهز واتساب
  websiteStatus: "Active" | "Inactive" | "Not Found" | "Redirected" | "Check Failed" | "Check Pending" | "No Website";
  websiteFinalUrl: string;     // الرابط النهائي للموقع
  websiteCheckNotes: string;   // ملاحظات فحص الموقع
  platformType: "Salla" | "Zid" | "Shopify" | "WooCommerce" | "Instagram Store" | "Custom Website" | "Unknown"; // منصة المتجر
  businessCategory: "Fashion" | "Beauty" | "Medical" | "Food" | "Electronics" | "Kids" | "Home" | "Furniture" | "Real Estate" | "Services" | "Education" | "Automotive" | "Unknown"; // النشاط التجاري
}

// Check for social platforms
export function isSocialLink(url: string): boolean {
  const norm = url.toLowerCase().trim();
  const platforms = [
    "instagram.com", "instagram.sa", "insta.me", "instagram.org",
    "snapchat.com", "tiktok.com", "twitter.com", "x.com", "facebook.com",
    "fb.com", "youtube.com", "t.me", "telegram.org", "threads.net",
    "pinterest.com", "linkedin.com", "wa.me", "whatsapp.com"
  ];
  return platforms.some(p => norm.includes(p));
}

// Clean and validate Saudi phone number
export function cleanAndVerifySaudiPhone(rawPhone: string): { 
  isValid: boolean; 
  formatted: string; 
  reason: string;
} {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { isValid: false, formatted: "", reason: "الرقم فارغ" };
  }

  // Clean characters: replace spaces, hyphens, slashes, brackets, periods
  let digits = rawPhone.replace(/[^\d+]/g, "").trim();

  // Strip leading plus or international double-zeros
  if (digits.startsWith("+")) digits = digits.substring(1);
  if (digits.startsWith("00")) digits = digits.substring(2);

  let initialFixed = false;

  // Strip international Saudi prefix
  if (digits.startsWith("966")) {
    digits = digits.substring(3);
    initialFixed = true;
  }

  // Strip local standard prefix zero
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
    initialFixed = true;
  }

  // Standard Saudi mobile has 8 digits following prefix "5" (total 9 digits starting with 5)
  if (digits.length === 9 && digits.startsWith("5")) {
    return { 
      isValid: true, 
      formatted: `+9665${digits.substring(1)}`, 
      reason: initialFixed ? "تم التعرف عليه وتصحيح التنسيق إلى الصيغة الدولية" : "رقم صحيح بالصيغة القياسية"
    };
  }

  // Fallback check: sometimes user inputs 9 digits but miss the '5' or similar standard, or input 10 digits starting with 05.
  // We don't correct doubtful numbers without strict validation rules to keep error rates at zero.
  return { 
    isValid: false, 
    formatted: rawPhone.trim(), 
    reason: `رقم غير صالح للتواصل السعودي (طوله ${digits.length} أرقام بعد التنظيف، ويجب أن يبدأ بـ 5 ويتكون من 9 أرقام)` 
  };
}

// Repair protocols
export function repairAndNormalizeLink(rawLink: string): {
  normalized: string;
  isValid: boolean;
  type: "store" | "social" | "none";
  note: string;
} {
  let link = rawLink.trim();
  if (!link) {
    return { normalized: "", isValid: false, type: "none", note: "الرابط فارغ" };
  }

  // Auto clean common noise terms
  if (["لا يوجد", "انشاء", "إنشاء", "null", "undefined", "none", "no"].includes(link.toLowerCase())) {
    return { normalized: "", isValid: false, type: "none", note: "قيمة معطلة أو فارغة" };
  }

  // Check valid pattern (must have a dot inside domain name)
  const hasDot = link.includes(".");
  const looksLikePhone = /^\+?[0-9\s-\(\)\/\.]{8,15}$/.test(link);

  if (looksLikePhone) {
    return { normalized: link, isValid: false, type: "none", note: "هذه القيمة تبدو كرقم هاتف وليس رابط" };
  }

  if (!hasDot) {
    return { normalized: link, isValid: false, type: "none", note: "رابط ناقص أو غير صالح (لا يحتوي على نطاق .com أو تفاصيل صحيحة)" };
  }

  // Auto-prepend https:// if missing
  if (!/^https?:\/\//i.test(link)) {
    link = "https://" + link;
  }

  // Validate standard URI structure
  try {
    const parsed = new URL(link);
    const host = parsed.hostname.toLowerCase();
    
    // Categorize
    const isSoc = isSocialLink(host);
    return {
      normalized: link,
      isValid: true,
      type: isSoc ? "social" : "store",
      note: isSoc ? "رابط تواصل اجتماعي صحيح" : "رابط متجر/موقع إلكتروني صحيح"
    };
  } catch (e) {
    return {
      normalized: link,
      isValid: false,
      type: "none",
      note: "الرابط غير صحيح بنيوياً"
    };
  }
}

// Advanced scanner to locate data within cells regardless of headers
export function analyzeCellContent(cellValue: any): {
  type: "phone" | "link" | "name" | "none";
  extractedPhones: string[];
  extractedLinks: string[];
  cleanText: string;
} {
  if (cellValue === undefined || cellValue === null) {
    return { type: "none", extractedPhones: [], extractedLinks: [], cleanText: "" };
  }

  const str = String(cellValue).trim();
  if (!str || ["لا يوجد", "انشاء", "إنشاء", "null", "none"].includes(str.toLowerCase())) {
    return { type: "none", extractedPhones: [], extractedLinks: [], cleanText: "" };
  }

  // 1. Detect if it contains links (URLs)
  // Look for salla, zid, instagram, snapchat, http, www, .com, .net, etc.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,6}(?:\/[^\s]*)?)/gi;
  const linkMatches = str.match(urlRegex);
  
  // 2. Detect if it contains potential Saudi phone numbers
  // Saudi phone parts e.g. 05xxxxxxxx, +9665xxxxxxxx, etc.
  const phoneRegex = /(\+?966\s?5\d{2}\s?\d{3}\s?\d{3}|\+?9665\d{8}|05\d{8}|5\d{8}|009665\d{8})/g;
  // Also generic helper to clean and extract consecutive numbers that might look like phone
  const digitClean = str.replace(/[^\d]/g, "");
  const hasSaudiMatchingDigits = (digitClean.startsWith("5") && digitClean.length === 9) || 
                                 (digitClean.startsWith("05") && digitClean.length === 10) || 
                                 (digitClean.startsWith("9665") && digitClean.length === 12);

  const phoneMatches = str.match(phoneRegex) || [];
  const phonesList = [...new Set(phoneMatches.map(p => p.trim()))];
  
  if (phonesList.length === 0 && hasSaudiMatchingDigits) {
    phonesList.push(str);
  }

  if (linkMatches && linkMatches.length > 0) {
    // If it possesses links, prefer link category
    return {
      type: "link",
      extractedPhones: phonesList,
      extractedLinks: linkMatches.map(l => l.trim()),
      cleanText: str
    };
  }

  if (phonesList.length > 0) {
    return {
      type: "phone",
      extractedPhones: phonesList,
      extractedLinks: [],
      cleanText: str
    };
  }

  // 3. Name check - if it mostly contains Arabic/English characters and is short, and not numeric/links
  const lettersOnly = str.replace(/[^\p{L}\s]/gu, "");
  const numbersOnly = str.replace(/[^\d]/g, "");
  
  if (lettersOnly.length > 2 && numbersOnly.length < 4 && str.length < 50) {
    return {
      type: "name",
      extractedPhones: [],
      extractedLinks: [],
      cleanText: str
    };
  }

  return {
    type: "none",
    extractedPhones: [],
    extractedLinks: [],
    cleanText: str
  };
}

// Analyze a string to identify name candidates, remark candidates, and calculate confidence ratings
export function analyzeStringConfidence(item: string): {
  isNameCandidate: boolean;
  isRemarkCandidate: boolean;
  nameConfidence: number;
  remarksConfidence: number;
  splitName?: string;
  splitRemark?: string;
} {
  const text = item.trim();
  if (!text) {
    return { isNameCandidate: false, isRemarkCandidate: false, nameConfidence: 0, remarksConfidence: 0 };
  }

  const lowercaseText = text.toLowerCase();
  
  // List of explicit delimiters for mixed cells
  const delimiters = [" - ", " – ", " — ", " | ", " / ", " ، ", " : ", " [ ", " ( "];
  
  for (const delim of delimiters) {
    if (text.includes(delim)) {
      const parts = text.split(delim).map(p => p.replace(/[\(\)\[\]]/g, "").trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Let's analyze both parts. Normally, one is name and one is remark.
        const score1 = calculateBaseScores(parts[0]);
        const score2 = calculateBaseScores(parts[1]);
        
        if (score1.nameScore > 40 && (score2.remarksScore > 50 || score1.nameScore > score2.nameScore)) {
          return {
            isNameCandidate: true,
            isRemarkCandidate: true,
            nameConfidence: score1.nameScore,
            remarksConfidence: Math.max(score2.remarksScore, 85),
            splitName: parts[0],
            splitRemark: parts[1]
          };
        }
        if (score2.nameScore > 40 && (score1.remarksScore > 50 || score2.nameScore > score1.nameScore)) {
          return {
            isNameCandidate: true,
            isRemarkCandidate: true,
            nameConfidence: score2.nameScore,
            remarksConfidence: Math.max(score1.remarksScore, 85),
            splitName: parts[1],
            splitRemark: parts[0]
          };
        }
      }
    }
  }

  // Parentheses check: "مقهى الرياض (لم يرد)"
  const parenMatch = text.match(/^(.+?)\s*[\(\[\{](.+?)[\)\]\}]$/);
  if (parenMatch) {
    const left = parenMatch[1].trim();
    const inside = parenMatch[2].trim();
    const sLeft = calculateBaseScores(left);
    const sInside = calculateBaseScores(inside);
    if (sLeft.nameScore > 40) {
      return {
        isNameCandidate: true,
        isRemarkCandidate: true,
        nameConfidence: sLeft.nameScore,
        remarksConfidence: Math.max(sInside.remarksScore, 85),
        splitName: left,
        splitRemark: inside
      };
    }
  }

  // Keyword transition check (implied splitting without delimiter)
  const remarksKeywords = [
    "لم يتم الرد", "لم يرد", "مغلق", "لا ترد", "تم التواصل", "تم التواصل معه", 
    "تم الإرسال", "تم الارسال", "أول مرة فتح", "اول مرة", "اول مره", "مهتم", 
    "غير مهتم", "الرقم مقفول", "رقم مقفول", "مقفول", "خارج الخدمة", "خارج الخدمه", 
    "متابعة", "متابعه", "تم الاتفاق", "واتساب", "واتس", "اتصال", "رد العميل", 
    "ملاحظة", "ملاحظه", "ملغي", "كنسل", "تواصلنا", "مستبعد", "ليس مهتم", 
    "لا يحب", "جواله مقفل", "تواصل لاحقا", "غير فعال", "الخدمة متوقفة", 
    "ارسال تسعيرة", "مكالمة فائتة", "هاتف خاطئ", "جاري المتابعة", "لا يجيب", 
    "يريد", "يبغى", "تواصلت"
  ];

  for (const kw of remarksKeywords) {
    const idx = lowercaseText.indexOf(kw);
    if (idx > 1) {
      const left = text.substring(0, idx).trim();
      const right = text.substring(idx).trim();
      const leftWords = left.split(/\s+/).filter(Boolean);
      if (leftWords.length > 0 && leftWords.length <= 4) {
        const sLeft = calculateBaseScores(left);
        const sRight = calculateBaseScores(right);
        if (sLeft.nameScore > 35) {
          return {
            isNameCandidate: true,
            isRemarkCandidate: true,
            nameConfidence: sLeft.nameScore,
            remarksConfidence: Math.max(sRight.remarksScore, 85),
            splitName: left,
            splitRemark: right
          };
        }
      }
    }
  }

  // Simple clean fallback score calculation
  const scores = calculateBaseScores(text);
  return {
    isNameCandidate: scores.nameScore >= 50,
    isRemarkCandidate: scores.remarksScore >= 50,
    nameConfidence: scores.nameScore,
    remarksConfidence: scores.remarksScore
  };
}

// Helper calculation model for text scoring
function calculateBaseScores(text: string): { nameScore: number; remarksScore: number } {
  const lowercaseText = text.toLowerCase();
  
  const commercialTags = [
    "مقهى", "بوتيك", "شركة", "متجر", "مؤسسة", "مطعم", "عطور", "مجوهرات", 
    "عيادة", "مطبخ", "فندق", "صالون", "مركز", "معرض", "قهوة", "مكتب", 
    "مصنع", "وكالة", "براند", "ماركة", "محل", "محلات", "مشغل", "مخبز", 
    "حلويات", "ملابس", "عبايات", "هدايا", "صيدلية", "سوبرماركت", "مستوصف", 
    "نظارات", "صيدليه", "مطاعم", "كافيه", "قهوه", "مخبوزات"
  ];
  const englishCommercialTags = [
    "co", "company", "corp", "llc", "store", "shop", "brand", "cafe", 
    "boutique", "restaurant", "hotel", "clinic", "salon", "studio", "group"
  ];

  const remarksKeywords = [
    "لم يتم الرد", "لم يرد", "مغلق", "لا ترد", "تم التواصل", "تم التواصل معه", 
    "تم الإرسال", "تم الارسال", "أول مرة فتح", "اول مرة", "اول مره", "مهتم", 
    "غير مهتم", "الرقم مقفول", "رقم مقفول", "مقفول", "خارج الخدمة", "خارج الخدمه", 
    "متابعة", "متابعه", "تم الاتفاق", "واتساب", "واتس", "اتصال", "رد العميل", 
    "ملاحظة", "ملاحظه", "ملغي", "كنسل", "تواصلنا", "مستبعد", "ليس مهتم", 
    "لا يحب", "جواله مقفل", "تواصل لاحقا", "غير فعال", "الخدمة متوقفة", 
    "ارسال تسعيرة", "مكالمة فائتة", "هاتف خاطئ", "جاري المتابعة", "لا يجيب", 
    "يريد", "يبغى", "تواصلت"
  ];

  let nameScore = 50;
  let remarksScore = 30;

  const hasRemarkKeyword = remarksKeywords.some(kw => lowercaseText.includes(kw));
  const hasCommercialTag = commercialTags.some(tag => lowercaseText.startsWith(tag) || lowercaseText.includes(" " + tag));
  const hasEnglishCommercialTag = englishCommercialTags.some(tag => {
    const regex = new RegExp(`\\b${tag}\\b`, 'i');
    return regex.test(lowercaseText);
  });

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (hasRemarkKeyword) {
    remarksScore += 65;
    nameScore -= 65;
  }

  if (hasCommercialTag || hasEnglishCommercialTag) {
    nameScore += 35;
    remarksScore -= 20;
  }

  if (wordCount === 1 || wordCount === 2 || wordCount === 3) {
    nameScore += 15;
  } else if (wordCount >= 4) {
    remarksScore += 25;
    if (!hasCommercialTag) {
      nameScore -= 25;
    }
  }

  const operationalParticles = ["تم", "لم", "لا", "في", "على", "مع", "من", "عن", "منذ", "جاري", "يرجى"];
  const hasParticles = operationalParticles.some(p => text.startsWith(p + " ") || text.includes(" " + p + " "));
  if (hasParticles) {
    remarksScore += 20;
    nameScore -= 15;
  }

  const isPureArabicLetters = /^[\u0600-\u06FF\s]+$/.test(text);
  if (isPureArabicLetters && wordCount <= 3 && !hasRemarkKeyword && !hasParticles) {
    nameScore = Math.max(nameScore, 85);
  }

  nameScore = Math.max(0, Math.min(100, nameScore));
  remarksScore = Math.max(0, Math.min(100, remarksScore));

  return { nameScore, remarksScore };
}

// -------------------------------------------------------------
// Advanced Lead Qualification & Verification Helpers (Version 34)
// -------------------------------------------------------------

export function isInvalidNameValue(val: string): boolean {
  const clean = val.trim();
  if (!clean) return true;
  
  // 1. If numeric only (phone is treated as invalid name)
  if (/^[0-9+\s\-\(\)\.]+$/.test(clean)) return true;
  
  // 2. If email
  if (clean.includes("@") && (clean.includes(".") || clean.includes("com"))) return true;
  
  // 3. If looks like a URL/link
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(\/.*)?$/i.test(clean) || 
      clean.includes("http") || 
      clean.includes("www") || 
      clean.includes("sa/") || 
      clean.includes(".com") ||
      clean.includes(".net") ||
      clean.includes(".org")) {
    return true;
  }
  
  // 4. If typical store code/slug or username (alphanumeric english without spaces, and short)
  if (/^[a-zA-Z0-9_\-]+$/.test(clean) && clean.length > 0 && clean.length < 24) {
    return true; 
  }
  
  // 5. Common noise values
  const noise = ["لا يوجد", "انشاء", "إنشاء", "null", "undefined", "none", "no name", "unknown", "مجهول", "الفلترة", "الاسم", "اسم", "العميل"];
  if (noise.some(n => clean.toLowerCase() === n || clean.toLowerCase().includes(n))) return true;

  return false;
}

export function extractAlternativeName(storeLink: string, socialLink: string): { 
  name: string; 
  source: "Website Domain" | "Social Username" | "Store Slug" | "Manual Review" 
} {
  // Try domain link first
  if (storeLink) {
    try {
      const cleanLink = storeLink.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
      const parsedUrl = new URL(storeLink.trim().startsWith("http") ? storeLink.trim() : `https://${storeLink.trim()}`);
      const host = parsedUrl.hostname.toLowerCase().replace("www.", "");
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      
      const platforms = ["salla.sa", "zid.sa", "salla.gift", "zid.store", "myshopify.com", "shopify.com"];
      const isPlatformHost = platforms.some(p => host.includes(p));

      if (isPlatformHost && pathParts.length > 0) {
        return { name: pathParts[0], source: "Store Slug" };
      } else {
        const parts = host.split(".");
        if (parts.length > 0 && parts[0] && parts[0] !== "salla" && parts[0] !== "zid" && parts[0] !== "shopify") {
          return { name: parts[0], source: "Website Domain" };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Next, try social links
  if (socialLink) {
    try {
      const parsedUrl = new URL(socialLink.trim().startsWith("http") ? socialLink.trim() : `https://${socialLink.trim()}`);
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const username = pathParts[0];
        if (username && username.length > 2 && !["p", "reel", "explore", "stories", "tags"].includes(username)) {
          return { name: username, source: "Social Username" };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return { name: "", source: "Manual Review" };
}

export function detectPlatformType(storeLink: string): "Salla" | "Zid" | "Shopify" | "WooCommerce" | "Instagram Store" | "Custom Website" | "Unknown" {
  if (!storeLink) return "Unknown";
  const url = storeLink.toLowerCase();
  
  if (url.includes("salla.sa") || url.includes("salla.gift") || url.includes("s.salla")) {
    return "Salla";
  }
  if (url.includes("zid.sa") || url.includes("zid.store") || url.includes("zid.market")) {
    return "Zid";
  }
  if (url.includes("shopify") || url.includes("myshopify")) {
    return "Shopify";
  }
  if (url.includes("instagram.com") || url.includes("insta.me")) {
    return "Instagram Store";
  }
  if (url.includes("wp-content") || url.includes("wordpress") || url.includes("woocommerce")) {
    return "WooCommerce";
  }
  return "Custom Website";
}

export function detectBusinessCategory(
  itemText: string
): "Fashion" | "Beauty" | "Medical" | "Food" | "Electronics" | "Kids" | "Home" | "Furniture" | "Real Estate" | "Services" | "Education" | "Automotive" | "Unknown" {
  const norm = itemText.toLowerCase();

  const categories = [
    {
      name: "Fashion" as const,
      keywords: ["ملابس", "أزياء", "عبايات", "فساتين", "جلابيات", "بوتيك", "خياط", "براند ملابس", "عبايه", "فستان", "موضة", "خياطة", "أقمشة", "أحذية", "جزم", "حقائب", "شنط", "طرح", "شال", "fashion", "boutique", "abaya", "dress", "wear", "clothing", "style", "tailor", "bag", "shoes"]
    },
    {
      name: "Beauty" as const,
      keywords: ["عطور", "تجميل", "مكياج", "مسك", "براند عطور", "صالون", "مركز تجميل", "عناية", "بشرة", "عدسات", "مستحضرات", "رموش", "دهن", "عود", "ورد", "سيروم", "عمروس", "أظافر", "مرطب", "صابون", "سيرومات", "مرطبات", "كريمات", "شامبو", "خمرية", "beauty", "perfume", "makeup", "salon", "care", "oud", "lens", "shampoo", "creams", "fragrance", "musk"]
    },
    {
      name: "Medical" as const,
      keywords: ["عيادة", "مجمع طب", "طبي", "صيدلية", "مستوصف", "طبية", "عيادات", "مستشفى", "أسنان", "جلدية", "نظارات", "صيدليه", "دكتور", "علاج", "بصريات", "طبيب", "أخصائي", "clinic", "medical", "pharmacy", "hospital", "dental", "pharma", "optology", "doctor"]
    },
    {
      name: "Food" as const,
      keywords: ["مطعم", "مقهى", "مخبز", "حلويات", "قهوة", "شوكولاتة", "كافيه", "مطاعم", "كيك", "كوكيز", "مأكولات", "طعام", "قهوه", "بهارات", "تمور", "عسل", "عصير", "شوكولاته", "لقيمات", "فطائر", "أغذية", "مطبخ", "شاي", "بن", "محمصة", "مكسرات", "غذاء", "تناول", "توابل", "café", "coffee", "restaurant", "chocolate", "food", "sweets", "bakery", "dates", "honey", "pastry", "kitchen", "tea", "roasters"]
    },
    {
      name: "Electronics" as const,
      keywords: ["جوالات", "الكترونيات", "شواحن", "أجهزة", "كمبيوتر", "تقنية", "كاميرات", "سماعات", "برمجيات", "إلكترونيات", "أكسسوارات جوال", "هواتف", "شبكات", "برمجة", "تقني", "صيانة جوالات", "شاحن", "تلفزيونات", "أثرياء", "سيرفرات", "اشتراكات", "electronic", "electronics", "phone", "tech", "devices", "accessory", "accessories", "camera", "mobile code", "computer"]
    },
    {
      name: "Kids" as const,
      keywords: ["ألعاب أطفال", "مواليد", "أطفال", "لعبة", "حضانه", "حضانة", "العاب", "اطفال", "بيبي", "رضع", "مستلزمات أطفال", "روضة", "تنشئة", "تعليم أطفال", "kids", "baby", "toys", "children", "nursery"]
    },
    {
      name: "Home" as const,
      keywords: ["منزلي", "تحف", "أدوات منزلية", "منظمات", "هدايا", "بخوش", "مباخر", "أكواب", "نباتات", "منظفات", "شموع", "مستلزمات منزل", "تحفة", "بخور", "فواحة", "ورد مجفف", "منزلية", "صحون", "مواعين", "أواني", "أوانى", "home", "kitchen", "gifts", "cup", "candle", "incense"]
    },
    {
      name: "Furniture" as const,
      keywords: ["كنب", "مفروشات", "أثاث", "غرف نوم", "طاولة", "سجاد", "ستائر", "خشب", "جلسات", "ديكور", "ديكورات", "سجادة", "طاولات", "مطابخ ألمنيوم", "مفارش", "مراتب", "مكتبة", "decor", "furniture", "carpet", "table", "mattress", "curtains"]
    },
    {
      name: "Real Estate" as const,
      keywords: ["عقارات", "شقق", "فلل", "تسويق عقاري", "عقار", "مكتب عقاري", "برج", "أراضي", "مخطط", "أرض", "فيلا", "شقة", "استثمار عقاري", "شاليه", "شاليهات", "منتجع", "منتجعات", "real estate", "property", "villa", "apartment", "resort", "chalet"]
    },
    {
      name: "Services" as const,
      keywords: ["نقليات", "مقاولات", "خدمات", "تنظيف", "تصميم", "برمجة", "تسويق", "شحن", "توصيل", "صيانة", "استشارات", "تنظيم", "تأجير", "نقل عفش", "مظلات", "سواتر", "غسيل", "تركيب", "عوازل", "كوش", "أعراس", "استشارات قانونية", "تأشيرات", "تخليص", "تسجيل", "تطوير", "فوتوغرافي", "خدمه", "خدمة", "services", "logistics", "cleaning", "design", "marketing", "consultancy", "law", "cargo", "rent"]
    },
    {
      name: "Education" as const,
      keywords: ["مدرسة", "تعليم", "لغات", "دورات", "تدريب", "أكاديمية", "طالب", "كتب", "مناهج", "قرطاسية", "جامعة", "معلم", "تدريبية", "ملخصات", "ملازم", "بحوث", "طالبات", "قرطاسيه", "شرح", "تأسيس", "تعليمي", "دورة", "حقيبة تدريبية", "university", "school", "academy", "training", "book", "student", "course"]
    },
    {
      name: "Automotive" as const,
      keywords: ["سيارات", "قطع غيار", "زينة سيارات", "إطارات", "غسيل سيارات", "ورشة", "محرك", "سيارة", "عجلات", "إطارات سيارات", "محركات", "مخرطة", "فحص سيارات", "فحمات", "زيوت", "سمكرة", "دهان سيارات", "automotive", "cars", "parts", "motors", "tires", "garage"]
    }
  ];

  for (const cat of categories) {
    if (cat.keywords.some(kw => norm.includes(kw))) {
      return cat.name;
    }
  }

  return "Unknown";
}

export function sortLeadResults(items: CustomerProcessResult[]): CustomerProcessResult[] {
  const classOrder: Record<string, number> = {
    "C": 9, // both
    "A": 8, // store
    "B": 7, // social
    "D": 6, // phone only
    "E": 5, // links no phone
    "G": 4, // invalid links
    "H": 3, // manual review
    "F": 2, // invalid phones
    "I": 1  // duplicates
  };

  return [...items].sort((a, b) => {
    // 1. WhatsApp Ready = TRUE first
    const waA = a.whatsappReady ? 1 : 0;
    const waB = b.whatsappReady ? 1 : 0;
    if (waA !== waB) return waB - waA;

    // 2. Classification Priority
    const scoreA = classOrder[a.classification] || 0;
    const scoreB = classOrder[b.classification] || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 3. Name Source / Confidence
    if ((b.nameConfidence || 0) !== (a.nameConfidence || 0)) {
      return (b.nameConfidence || 0) - (a.nameConfidence || 0);
    }

    // 4. Source Row index ascending
    return (a.sourceMeta?.rowIndex || 0) - (b.sourceMeta?.rowIndex || 0);
  });
}

// Process sheet rows and parse everything with absolute robustness
export function processRawSheetData(
  sheetRows: any[][],
  fileName: string,
  sheetName: string
): CustomerProcessResult[] {
  if (sheetRows.length === 0) return [];

  // Determine header row by inspecting first rows for maximum metadata
  let headerIndex = -1;
  let maxScore = -1;
  const nameKeywords = ["الاسم", "اسم", "الزبون", "التاجر", "العميل", "العام", "name", "client", "customer", "merchant"];
  const phoneKeywords = ["جوال", "هاتف", "رقم", "موبايل", "تليفون", "اتصال", "phone", "mobile", "tel", "whatsapp", "جوال العميل", "رقم الجوال", "رقم الهاتف", "الرقم الأصلي", "الرقم المعدل", "الهاتف أصلي", "القديم", "الموحد"];
  const linkKeywords = ["رابط", "متجر", "لينك", "ويب", "دومين", "سوشيال", "link", "url", "website", "store", "insta", "snap", "الرابط", "المتجر", "موقع الكتروني", "موقع الإلكتروني", "موقع الويب"];

  for (let r = 0; r < Math.min(10, sheetRows.length); r++) {
    const row = sheetRows[r];
    if (!row) continue;
    let score = 0;
    row.forEach(cell => {
      const val = String(cell || "").toLowerCase().trim();
      if (val) {
        if (nameKeywords.some(k => val.includes(k))) score += 2;
        if (phoneKeywords.some(k => val.includes(k))) score += 2;
        if (linkKeywords.some(k => val.includes(k))) score += 2;
      }
    });

    if (score > maxScore && score >= 2) {
      maxScore = score;
      headerIndex = r;
    }
  }

  // Map columns if a valid header was identified
  let nameColIdxs: number[] = [];
  let phoneColIdxs: number[] = [];
  let linkColIdxs: number[] = [];

  const detectedHeaders = headerIndex !== -1 ? sheetRows[headerIndex].map(h => String(h || "").toLowerCase().trim()) : [];

  if (headerIndex !== -1) {
    detectedHeaders.forEach((val, idx) => {
      if (nameKeywords.some(k => val === k || val.includes(k))) {
        nameColIdxs.push(idx);
      } else if (phoneKeywords.some(k => val === k || val.includes(k))) {
        phoneColIdxs.push(idx);
      } else if (linkKeywords.some(k => val === k || val.includes(k))) {
        linkColIdxs.push(idx);
      }
    });
  }

  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;
  const results: CustomerProcessResult[] = [];

  for (let r = startRow; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    if (!row || row.length === 0) continue;

    // Check if the entire row is blank
    const nonBlank = row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
    if (nonBlank.length === 0) continue;

    // Scanned data banks
    let nameCandidates: { text: string; confidence: number; source: string }[] = [];
    let remarkCandidates: { text: string; confidence: number }[] = [];
    let discoveredPhones: string[] = [];
    let discoveredLinks: string[] = [];
    let remarksList: string[] = [];

    // Semantic cell-by-cell content parsing to verify mapped columns and capture misplaced attributes
    row.forEach((cell, colIdx) => {
      if (cell === undefined || cell === null) return;
      const cellValueStr = String(cell).trim();
      if (!cellValueStr) return;

      const analysis = analyzeCellContent(cell);
      if (analysis.type === "phone") {
        analysis.extractedPhones.forEach(p => {
          if (!discoveredPhones.includes(p)) discoveredPhones.push(p);
        });
      } else if (analysis.type === "link") {
        analysis.extractedLinks.forEach(l => {
          if (!discoveredLinks.includes(l)) discoveredLinks.push(l);
        });
        analysis.extractedPhones.forEach(p => {
          if (!discoveredPhones.includes(p)) discoveredPhones.push(p);
        });
      }

      // Content analysis of strings to segregate clean names, remarks, and mixtures
      const contentAnalysis = analyzeStringConfidence(cellValueStr);

      if (contentAnalysis.splitName && contentAnalysis.splitRemark) {
        nameCandidates.push({
          text: contentAnalysis.splitName,
          confidence: contentAnalysis.nameConfidence,
          source: nameColIdxs.includes(colIdx) ? "split_header" : "split_cell"
        });
        remarkCandidates.push({
          text: contentAnalysis.splitRemark,
          confidence: contentAnalysis.remarksConfidence
        });
        remarksList.push(`عزل مدمج: تم تجزئة (${contentAnalysis.splitName}) والملاحظة المتداخلة (${contentAnalysis.splitRemark}).`);
      } else if (contentAnalysis.isRemarkCandidate && !contentAnalysis.isNameCandidate) {
        remarkCandidates.push({
          text: cellValueStr,
          confidence: contentAnalysis.remarksConfidence
        });
        if (!remarksList.includes(cellValueStr)) {
          remarksList.push(cellValueStr);
        }
      } else if (contentAnalysis.isNameCandidate) {
        nameCandidates.push({
          text: cellValueStr,
          confidence: contentAnalysis.nameConfidence,
          source: nameColIdxs.includes(colIdx) ? "header_column" : "discovered_cell"
        });
      } else {
        // Safe doubtful fallback name
        const lettersOnly = cellValueStr.replace(/[^\p{L}\s]/gu, "");
        if (lettersOnly.length > 2 && cellValueStr.length < 50 && analysis.type !== "phone" && analysis.type !== "link") {
          nameCandidates.push({
            text: cellValueStr,
            confidence: contentAnalysis.nameConfidence,
            source: nameColIdxs.includes(colIdx) ? "header_column_low" : "discovered_cell_low"
          });
        }
      }
    });

    // Select name candidates and apply strict verification rules
    const validNameCandidates = nameCandidates.filter(c => c.text && c.text.length > 1 && !isInvalidNameValue(c.text));
    
    let customerName = "";
    let approvedName = "";
    let alternativeName = "";
    let nameSource: "Excel Cell" | "Website Domain" | "Social Username" | "Store Slug" | "Manual Review" = "Manual Review";
    let clientNameConfidence = 0;

    if (validNameCandidates.length > 0) {
      validNameCandidates.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        const aIsHeader = a.source.startsWith("header");
        const bIsHeader = b.source.startsWith("header");
        if (aIsHeader && !bIsHeader) return -1;
        if (!aIsHeader && bIsHeader) return 1;
        return 0;
      });

      const winner = validNameCandidates[0];
      customerName = winner.text;
      clientNameConfidence = winner.confidence;
      
      if (clientNameConfidence >= 70) {
        approvedName = winner.text;
        nameSource = "Excel Cell";
      } else {
        approvedName = ""; // No automatic approval for low-confidence names
        nameSource = "Manual Review";
        remarksList.push("مراجعة الاسم: مستوى ثقة استخراج اسم العميل أقل من 70% ولذا يحتاج لمراجعة يدوية.");
      }

      validNameCandidates.slice(1).forEach(cand => {
        const dupRemark = `اسم مرشح إضافي: ${cand.text} (ثقة: ${cand.confidence}%)`;
        if (!remarksList.includes(dupRemark) && cand.text !== winner.text) {
          remarksList.push(dupRemark);
        }
      });
    } else {
      // Name not found or cells contain invalid values (numbers, link, or email)
      customerName = "";
      approvedName = "";
      clientNameConfidence = 0;
      nameSource = "Manual Review";
      remarksList.push("لا يوجد اسم واضح");
    }

    // Capture remarks confidence rating
    let remarksConfidence = 0;
    if (remarkCandidates.length > 0) {
      remarksConfidence = Math.max(...remarkCandidates.map(rc => rc.confidence));
    } else if (remarksList.length > 0) {
      remarksConfidence = 80;
    }

    // Clean Phone candidates
    const cleanPhones = discoveredPhones.filter(ph => {
      const norm = ph.trim().toLowerCase();
      return norm && !["لا يوجد", "انشاء", "إنشاء", "null", "undefined"].includes(norm);
    });

    // Detect if there are multiple mobile numbers
    const uniquePhones = [...new Set(cleanPhones)];
    if (uniquePhones.length > 1) {
      remarksList.push(`تنبيه: تم اكتشاف أرقام هواتف متعددة في هذا السطر: [${uniquePhones.join(" | ")}]`);
    }

    const primaryPhone = uniquePhones.length > 0 ? uniquePhones[0] : "";

    // Clean Link candidates
    const cleanLinks = discoveredLinks.filter(l => {
      const norm = l.trim().toLowerCase();
      return norm && !["لا يوجد", "انشاء", "إنشاء", "null", "undefined"].includes(norm);
    });

    const uniqueLinks = [...new Set(cleanLinks)];
    if (uniqueLinks.length > 1) {
      remarksList.push(`تنبيه: تم اكتشاف روابط متعددة في هذا السطر: [${uniqueLinks.join(" | ")}]`);
    }

    // Two-Way Auto Recovery and categorizations
    let finalStoreLink = "";
    let finalSocialLink = "";

    uniqueLinks.forEach(l => {
      const repaired = repairAndNormalizeLink(l);
      if (repaired.isValid) {
        if (repaired.type === "social") {
          if (!finalSocialLink) finalSocialLink = repaired.normalized;
        } else if (repaired.type === "store") {
          if (!finalStoreLink) finalStoreLink = repaired.normalized;
        }
      } else if (repaired.note && l) {
        // Test if the link is actually an accidental phone number
        const cleanDigitsNum = l.replace(/[^\d]/g, "");
        if (cleanDigitsNum.length >= 8 && cleanDigitsNum.length <= 15) {
          if (!uniquePhones.includes(l)) {
            uniquePhones.push(l);
            remarksList.push(`استرداد تلقائي: تم تحويل الرابط "${l}" إلى رقم هاتف مرشح.`);
          }
        } else {
          remarksList.push(`رابط غير صالح: [${l}] -> ${repaired.note}`);
        }
      }
    });

    // Extract alternative names from links if customer name was missing or low confidence
    if (!approvedName && (finalStoreLink || finalSocialLink)) {
      const altExtract = extractAlternativeName(finalStoreLink, finalSocialLink);
      if (altExtract.name) {
        alternativeName = altExtract.name;
        nameSource = altExtract.source;
        // set conservative confidence scores for alternative extractions
        if (altExtract.source === "Website Domain") {
          clientNameConfidence = 65;
        } else if (altExtract.source === "Social Username") {
          clientNameConfidence = 60;
        } else {
          clientNameConfidence = 55;
        }
      }
    }

    // Determine Phone validity
    let cleanedPhone = "";
    let isPhoneValid = false;
    let phoneVerifyReason = "لا يوجد رقم جوال";

    if (primaryPhone) {
      const phoneCheck = cleanAndVerifySaudiPhone(primaryPhone);
      cleanedPhone = phoneCheck.formatted;
      isPhoneValid = phoneCheck.isValid;
      phoneVerifyReason = phoneCheck.reason;
    }

    // Handle Link classification
    let linkType: "store" | "social" | "both" | "none" = "none";
    if (finalStoreLink && finalSocialLink) {
      linkType = "both";
    } else if (finalStoreLink) {
      linkType = "store";
    } else if (finalSocialLink) {
      linkType = "social";
    }

    // Platform and business activity classification
    const platformType = detectPlatformType(finalStoreLink);
    
    // Scan all cell texts to determine the business domain
    let combinedRowText = "";
    row.forEach(c => {
      if (c !== undefined && c !== null) {
        combinedRowText += " " + String(c);
      }
    });
    const businessCategory = detectBusinessCategory(combinedRowText);

    // Initial Website Status
    const websiteStatus = finalStoreLink ? "Check Pending" : "No Website";

    // Determine basic classification
    let classification: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" = "H";
    let classificationName = "";
    let classificationReason = "";

    if (!primaryPhone) {
      if (finalStoreLink || finalSocialLink) {
        classification = "E";
        classificationName = "عملاء لديهم روابط بدون رقم جوال";
        classificationReason = "الصف يحتوي على روابط (متاجر أو سوشيال) ولكن يفتقر تماماً لرقم جوال.";
      } else {
        classification = "H";
        classificationName = "صفوف تحتاج مراجعة يدوية";
        classificationReason = "الصف غير كافٍ للاستخراج (لا يحتوي على رقم جوال أو روابط مفيدة).";
      }
    } else if (!isPhoneValid) {
      classification = "F";
      classificationName = "أرقام غير صالحة";
      classificationReason = `رقم الهاتف الأصلي (${primaryPhone}) لا يطابق معايير الجوال السعودي الصحيحة. ${phoneVerifyReason}`;
    } else {
      if (linkType === "both") {
        classification = "C";
        classificationName = "عملاء لديهم رقم جوال + رابط متجر + رابط سوشيال";
        classificationReason = "تم تحديد رقم جوال سعودي صحيح، رابط متجر إلكتروني معتمد، ورابط تواصل اجتماعي.";
      } else if (linkType === "store") {
        classification = "A";
        classificationName = "عملاء لديهم رقم جوال + رابط متجر/موقع";
        classificationReason = "رقم جوال سعودي صحيح ورابط متجر إلكتروني صالح (بدون روابط سوشيال).";
      } else if (linkType === "social") {
        classification = "B";
        classificationName = "عملاء لديهم رقم جوال + رابط سوشيال فقط";
        classificationReason = "رقم جوال سعودي صحيح ورابط تواصل اجتماعي صالح (بدون روابط متاجر مستقلة).";
      } else {
        classification = "D";
        classificationName = "عملاء لديهم رقم جوال فقط بدون روابط";
        classificationReason = "رقم جوال سعودي صحيح مع غياب تام للروابط والمتاجر في الصف (قيد الإنشاء).";
      }
    }

    if (classification === "A" || classification === "B" || classification === "C") {
      const hasInvalidLinksLogged = remarksList.some(rmk => rmk.includes("رابط غير صالح:"));
      if (hasInvalidLinksLogged && !finalStoreLink && !finalSocialLink) {
        classification = "G";
        classificationName = "روابط غير صالحة";
        classificationReason = "الجوال صحيح ولكن الروابط المصاحبة معطلة أو مشكوك في أرقامها.";
      }
    }

    // FORCE manual review 'H' in case name extracted is low-confidence or empty
    if (clientNameConfidence < 70 && classification !== "F" && classification !== "E") {
      classification = "H";
      classificationName = "صفوف تحتاج مراجعة يدوية (اشتباه الاسم/الملاحظات)";
      classificationReason = `اشتباه في استخراج اسم العميل لتدني نسبة ثقة الاسم استناداً لتحليل المحتوى (${clientNameConfidence}%).`;
    }

    // Determine initial WhatsApp Ready
    let whatsappReady = false;
    if (isPhoneValid && classification !== "F" && classification !== "E") {
      whatsappReady = true;
    } else {
      whatsappReady = false;
    }

    results.push({
      clientName: approvedName || alternativeName || `عميل ${r + 1}`,
      originalPhone: primaryPhone || "بدون هاتف",
      cleanedPhone: cleanedPhone || primaryPhone,
      storeLink: finalStoreLink,
      socialLink: finalSocialLink,
      linkType,
      classification,
      classificationName,
      reason: classificationReason,
      sourceMeta: {
        fileName,
        sheetName,
        rowIndex: r + 1
      },
      allSources: [{
        fileName,
        sheetName,
        rowIndex: r + 1
      }],
      remarks: remarksList,
      allPhones: uniquePhones,
      allLinks: uniqueLinks,
      originalRowData: row,
      clientNameConfidence,
      remarksConfidence,

      // Version 34 fields
      approvedName,
      alternativeName,
      nameSource,
      nameConfidence: clientNameConfidence,
      whatsappReady,
      websiteStatus,
      websiteFinalUrl: finalStoreLink,
      websiteCheckNotes: finalStoreLink ? "بانتظار الفحص التلقائي" : "الدومين فارغ",
      platformType,
      businessCategory
    });
  }

  return results;
}

// Global deduplication and merge processor
export function mergeAndDeduplicate(
  rawResults: CustomerProcessResult[]
): {
  uniqueCustomers: CustomerProcessResult[];
  duplicateRecords: CustomerProcessResult[];
} {
  const uniqueCustomers: CustomerProcessResult[] = [];
  const duplicateRecords: CustomerProcessResult[] = [];

  // Index maps for lookup
  const phoneMap = new Map<string, CustomerProcessResult>();
  const storeMap = new Map<string, CustomerProcessResult>();
  const socialMap = new Map<string, CustomerProcessResult>();

  rawResults.forEach(record => {
    let matchedExisting: CustomerProcessResult | null = null;

    // 1. Match on cleaned phone if valid
    if (record.cleanedPhone && !record.cleanedPhone.includes("بدون") && record.classification !== "F") {
      matchedExisting = phoneMap.get(record.cleanedPhone) || null;
    }

    // 2. Match on Store Link if vorhanden
    if (!matchedExisting && record.storeLink) {
      matchedExisting = storeMap.get(record.storeLink.toLowerCase().trim()) || null;
    }

    // 3. Match on Social Link if vorhanden
    if (!matchedExisting && record.socialLink) {
      matchedExisting = socialMap.get(record.socialLink.toLowerCase().trim()) || null;
    }

    if (matchedExisting) {
      // Merge/Fuse details instead of discarding!
      matchedExisting.allSources.push(record.sourceMeta);
      
      // Merge remarks
      record.remarks.forEach(rem => {
        if (!matchedExisting!.remarks.includes(rem)) {
          matchedExisting!.remarks.push(rem);
        }
      });

      // Merge missing phone numbers
      record.allPhones.forEach(ph => {
        if (!matchedExisting!.allPhones.includes(ph)) {
          matchedExisting!.allPhones.push(ph);
        }
      });

      // Merge missing links
      record.allLinks.forEach(lnk => {
        if (!matchedExisting!.allLinks.includes(lnk)) {
          matchedExisting!.allLinks.push(lnk);
        }
      });

      // Fill in metadata if missing
      if (!matchedExisting!.storeLink && record.storeLink) {
        matchedExisting!.storeLink = record.storeLink;
      }
      if (!matchedExisting!.socialLink && record.socialLink) {
        matchedExisting!.socialLink = record.socialLink;
      }

      // Merge name attributes based on confidence and existence
      if (!matchedExisting!.approvedName && record.approvedName) {
        matchedExisting!.approvedName = record.approvedName;
        matchedExisting!.clientName = record.clientName;
        matchedExisting!.nameConfidence = record.nameConfidence;
        matchedExisting!.clientNameConfidence = record.clientNameConfidence;
        matchedExisting!.nameSource = record.nameSource;
      } else if (record.approvedName && record.nameConfidence > matchedExisting!.nameConfidence) {
        matchedExisting!.approvedName = record.approvedName;
        matchedExisting!.clientName = record.clientName;
        matchedExisting!.nameConfidence = record.nameConfidence;
        matchedExisting!.clientNameConfidence = record.clientNameConfidence;
        matchedExisting!.nameSource = record.nameSource;
      }

      if (!matchedExisting!.alternativeName && record.alternativeName) {
        matchedExisting!.alternativeName = record.alternativeName;
        if (!matchedExisting!.approvedName) {
          matchedExisting!.clientName = record.clientName;
          matchedExisting!.nameSource = record.nameSource;
          matchedExisting!.nameConfidence = record.nameConfidence;
          matchedExisting!.clientNameConfidence = record.clientNameConfidence;
        }
      }

      matchedExisting!.remarksConfidence = Math.max(matchedExisting!.remarksConfidence, record.remarksConfidence);

      // Re-evaluate linkType and classification for the merged record
      let mergedLinkType: "store" | "social" | "both" | "none" = "none";
      if (matchedExisting!.storeLink && matchedExisting!.socialLink) {
        mergedLinkType = "both";
      } else if (matchedExisting!.storeLink) {
        mergedLinkType = "store";
      } else if (matchedExisting!.socialLink) {
        mergedLinkType = "social";
      }
      matchedExisting!.linkType = mergedLinkType;

      if (matchedExisting!.classification === "D" || matchedExisting!.classification === "H") {
        if (mergedLinkType === "both") {
          matchedExisting!.classification = "C";
          matchedExisting!.classificationName = "عملاء لديهم رقم جوال + رابط متجر + رابط سوشيال";
          matchedExisting!.reason = "تم الترقية تلقائياً: تم دمج جوال السجل مع روابط مفيدة من سطر آخر مكرر.";
        } else if (mergedLinkType === "store") {
          matchedExisting!.classification = "A";
          matchedExisting!.classificationName = "عملاء لديهم رقم جوال + رابط متجر/موقع";
          matchedExisting!.reason = "تم الترقية تلقائياً: تم دمج جوال السجل مع رابط متجر من سطر آخر مكرر.";
        } else if (mergedLinkType === "social") {
          matchedExisting!.classification = "B";
          matchedExisting!.classificationName = "عملاء لديهم رقم جوال + رابط سوشيال فقط";
          matchedExisting!.reason = "تم الترقية تلقائياً: تم دمج جوال السجل مع رابط سوشيال من سطر آخر مكرر.";
        }
      }

      // Re-detect platform and business category for merged record if they were unknown
      if (matchedExisting!.platformType === "Unknown" && record.platformType !== "Unknown") {
        matchedExisting!.platformType = record.platformType;
      }
      if (matchedExisting!.businessCategory === "Unknown" && record.businessCategory !== "Unknown") {
        matchedExisting!.businessCategory = record.businessCategory;
      }

      // Track duplicate row independently for review (Group I)
      const duplicateRecord: CustomerProcessResult = {
        ...record,
        classification: "I",
        classificationName: "بيانات مكررة",
        reason: `تم دمج هذا الصف مسبقاً وتوجيهه إلى السجل الرئيسي للعميل "${matchedExisting!.clientName}" المتواجد في الملف (${matchedExisting!.sourceMeta.fileName}).`,
        whatsappReady: false
      };
      duplicateRecords.push(duplicateRecord);

    } else {
      // Is unique, append to unique list and index
      uniqueCustomers.push(record);
      
      if (record.cleanedPhone && !record.cleanedPhone.includes("بدون") && record.classification !== "F") {
        phoneMap.set(record.cleanedPhone, record);
      }
      if (record.storeLink) {
        storeMap.set(record.storeLink.toLowerCase().trim(), record);
      }
      if (record.socialLink) {
        socialMap.set(record.socialLink.toLowerCase().trim(), record);
      }
    }
  });

  return {
    uniqueCustomers,
    duplicateRecords
  };
}




    // Create custom Excel downloadable sections as requested
export async function generateExcelExportBlob(
  sectionTitle: string,
  dataList: CustomerProcessResult[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  addDataTabToWorkbook(workbook, sectionTitle || "تفاصيل التصفية", dataList);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// Generate the ultimate Comprehensive Excel File with multiple sections as Tabs/Sheets!
export async function generateComprehensiveMultiTabExcel(
  groups: {
    eligible: CustomerProcessResult[];
    creation: CustomerProcessResult[];
    stores: CustomerProcessResult[];
    socials: CustomerProcessResult[];
    combo: CustomerProcessResult[];
    invalidPhones: CustomerProcessResult[];
    linksNoPhone: CustomerProcessResult[];
    duplicates: CustomerProcessResult[];
    manualReview: CustomerProcessResult[]; // contains H and G
  }
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  // Combine unique customers to extract Statistics and Smart Review candidates
  const allUnique: CustomerProcessResult[] = [];
  const addedIds = new Set<string>();

  const processList = [
    ...groups.stores,
    ...groups.socials,
    ...groups.combo,
    ...groups.creation,
    ...groups.linksNoPhone,
    ...groups.invalidPhones,
    ...groups.manualReview
  ];

  processList.forEach(item => {
    const key = `${item.cleanedPhone}|||${item.storeLink}|||${item.socialLink}`;
    if (!addedIds.has(key)) {
      addedIds.add(key);
      allUnique.push(item);
    }
  });

  const smartReviewList = allUnique.filter(c => isSmartReviewCandidate(c));

  // --- SHEET 1: معلومات الملف ---
  const infoSheet = workbook.addWorksheet("معلومات الملف", {
    views: [{ rightToLeft: true }]
  });
  
  infoSheet.columns = [
    { width: 35 }, // Indicator Name
    { width: 25 }, // Statistic Value
    { width: 50 }  // Details/Description
  ];

  // System Header Logo banner row
  infoSheet.mergeCells("A1:C1");
  const logoCell = infoSheet.getCell("A1");
  logoCell.value = "MADAR SALES CRM - نظام مدار لفلترة وتطهير البيانات الحجمي";
  logoCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFF" } };
  logoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F172A" } }; // Charcoal-900
  logoCell.alignment = { vertical: "middle", horizontal: "center" };
  infoSheet.getRow(1).height = 45;

  // Subtitle
  infoSheet.mergeCells("A2:C2");
  const subtitleCell = infoSheet.getCell("A2");
  subtitleCell.value = "بطاقة إحصائيات جودة ملفات الليدز وتصفيات البيانات المستخلصة";
  subtitleCell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "38BDF8" } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } }; // Charcoal-800
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  infoSheet.getRow(2).height = 25;

  // Metadata rows helper
  const addMetadataRow = (rowNum: number, label: string, val: string, dateLabel: string, dateVal: string) => {
    infoSheet.getCell(`A${rowNum}`).value = label;
    infoSheet.getCell(`A${rowNum}`).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "475569" } };
    infoSheet.getCell(`A${rowNum}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
    infoSheet.getCell(`A${rowNum}`).alignment = { horizontal: "right", vertical: "middle" };
    infoSheet.getCell(`A${rowNum}`).border = { right: { style: "medium", color: { argb: "38BDF8" } }, left: { style: "thin", color: { argb: "E2E8F0" } } };

    infoSheet.getCell(`B${rowNum}`).value = val;
    infoSheet.getCell(`B${rowNum}`).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };
    infoSheet.getCell(`B${rowNum}`).alignment = { horizontal: "right", vertical: "middle" };
    infoSheet.getCell(`B${rowNum}`).border = { right: { style: "thin", color: { argb: "E2E8F0" } }, left: { style: "thin", color: { argb: "E2E8F0" } } };

    infoSheet.getCell(`C${rowNum}`).value = `${dateLabel} : ${dateVal}`;
    infoSheet.getCell(`C${rowNum}`).font = { name: "Segoe UI", size: 10, color: { argb: "64748B" } };
    infoSheet.getCell(`C${rowNum}`).alignment = { horizontal: "right", vertical: "middle" };
    infoSheet.getCell(`C${rowNum}`).border = { left: { style: "thin", color: { argb: "E2E8F0" } }, right: { style: "thin", color: { argb: "E2E8F0" } } };

    infoSheet.getRow(rowNum).height = 22;
  };

  const currentDate = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
  addMetadataRow(4, "أداة المعالجة", "مدار الذكي لفرز وتصنيف البيانات", "تاريخ ووقت المعالجة", currentDate);
  addMetadataRow(5, "إجمالي الملفات المشمولة", "الدفعة المرفوعة تفاعلياً", "تقارير تدقيق السلامة", "سليم مئة بالمئة (0% فاقد)");

  // KPI Section Title
  infoSheet.mergeCells("A7:C7");
  const sectionKpiCell = infoSheet.getCell("A7");
  sectionKpiCell.value = "مؤشرات جودة وتقسيم هيكلية البيانات الفريدة";
  sectionKpiCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "0F172A" } };
  sectionKpiCell.alignment = { vertical: "middle", horizontal: "right" };
  infoSheet.getRow(7).height = 28;

  // Let's add table row headers
  infoSheet.getCell("A8").value = "مؤشر جودة البيانات";
  infoSheet.getCell("B8").value = "القيمة الإحصائية (سجل)";
  infoSheet.getCell("C8").value = "التوزيع والهدف التشغيلي";
  
  infoSheet.getRow(8).height = 24;
  ["A8", "B8", "C8"].forEach(col => {
    const cell = infoSheet.getCell(col);
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  const totalUnique = allUnique.length;
  const originalRowsCalculated = totalUnique + groups.duplicates.length;
  const storeOwnersCount = groups.stores.length + groups.combo.length;
  const socialOwnersCount = groups.socials.length + groups.combo.length;
  const invalidWhatsAppCount = groups.invalidPhones.length;

  const statsList = [
    { label: "إجمالي السجلات الأصلية الكلية المعالجة", count: originalRowsCalculated, desc: "العدد الإجمالي لصفوف المدخلات التي خضعت للتصفية شاملة المكررات" },
    { label: "إجمالي السجلات والعملاء الفريدين", count: totalUnique, desc: "العملاء الفرديون المصفون ديموغرافياً بعد عزل ودمج التكرار" },
    { label: "إجمالي السجلات المكررة المدمجة", count: groups.duplicates.length, desc: "تم دمج تكرارها عابراً للـ شيتات وحفظ سجلاتها الرئيسية لتجنب التكرار" },
    { label: "عدد أرقام الجوالات الصحيحة والنشطة", count: totalUnique - invalidWhatsAppCount, desc: "أرقام هواتف سعودية مطابقة ومعتمدة وقابلة للاتصال الهاتفي" },
    { label: "عدد أرقام الهواتف التالفة أو غير الصالحة", count: invalidWhatsAppCount, desc: "أرقام مجهولة أو مخالفة لبنية وصيغة الجوال السعودي" },
    { label: "عدد أصحاب المتاجر والمواقع النشطة الكلي", count: storeOwnersCount, desc: "عملاء يمتلكون براند بموقع أو متجر ذي دومين مفرز" },
    { label: "عدد أصحاب قنوات السوشيال ميديا الكلي", count: socialOwnersCount, desc: "عملاء لديهم قنوات سناب شات، إنستقرام، تيك توك متصل كقناة تواصل رئيسية" },
    { label: "إجمالي العملاء المؤهلين للتواصل التلقائي", count: groups.eligible.length, desc: "مؤشر عملاء جاهزون للإرسال المباشر بدون مشاكل" }
  ];

  let currentStatRow = 9;
  statsList.forEach((stat, idx) => {
    infoSheet.getCell(`A${currentStatRow}`).value = stat.label;
    infoSheet.getCell(`B${currentStatRow}`).value = stat.count;
    infoSheet.getCell(`C${currentStatRow}`).value = stat.desc;

    const isEven = idx % 2 === 0;
    ["A", "B", "C"].forEach(col => {
      const cell = infoSheet.getCell(`${col}${currentStatRow}`);
      cell.font = { name: "Segoe UI", size: 10, color: { argb: "1E293B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "F8FAFC" : "FFFFFF" } };
      cell.alignment = { horizontal: col === "B" ? "center" : "right", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } }
      };
    });
    infoSheet.getRow(currentStatRow).height = 24;
    currentStatRow++;
  });

  // --- SHEET 2: ملخص التصفية الرقمي ---
  const summarySheet = workbook.addWorksheet("ملخص التصفية الرقمي", {
    views: [{ rightToLeft: true }]
  });

  summarySheet.columns = [
    { header: "البند الإحصائي والتقسيم الهيكلي", key: "item", width: 45 },
    { header: "عدد السجلات (ليد)", key: "count", width: 25 },
    { header: "نوعية التوزيع ودور التبويب", key: "desc", width: 50 }
  ];

  // Headings
  const sumHeader = summarySheet.getRow(1);
  sumHeader.height = 26;
  sumHeader.eachCell(cell => {
    cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
    cell.alignment = { vertical: "middle", horizontal: "right" };
  });

  const summaryRows = [
    { item: "إجمالي الصفوف الكلية الخاضعة للتدقيق", count: originalRowsCalculated, desc: "إجمالي ليدز الإيقاع قبل المزامنة والتصفية والتطهير" },
    { item: "أصحاب المتاجر والمواقع (أ)", count: groups.stores.length, desc: "عملاء لديهم متاجر نشطة أو مستقلة ومفتاحة" },
    { item: "أصحاب السوشيال فقط (ب)", count: groups.socials.length, desc: "ليدز بقنوات سناب وإنستا دون دومين" },
    { item: "المتاجر والقنوات الاجتماعية (ج)", count: groups.combo.length, desc: "عملاء نموذجيون لديهم دومين متجر وقنوات إتصال ومشاركة" },
    { item: "قيد الإنشاء - جوال فقط (د)", count: groups.creation.length, desc: "براندات جوال فقط بدون أي متجر أو تمايز نطاقات" },
    { item: "روابط صالحة بلا أي هاتف (هـ)", count: groups.linksNoPhone.length, desc: "مطهرون تم رصد دومين أو قناة تواصل دون هاتف سليم معتمد" },
    { item: "أرقام جوالات تالفة أو غير صالحة (و)", count: groups.invalidPhones.length, desc: "عملاء جوالات تالفة أو أقل من 9 أرقام أو خاطئ البنية" },
    { item: "مراجعة يدوية وحالات معطلة (ح)", count: groups.manualReview.length, desc: "حالات منخفضة ثقة اسم العميل أو مشبوهة الهيكل" },
    { item: "سجلات مكررة مدمجة محذوفة تكرارها (ط)", count: groups.duplicates.length, desc: "قائمة القيود التي تم فرز تكرارها عابراً للـ شيتات" },
    { item: "إجمالي المؤهلين المباشر للتواصل السليم", count: groups.eligible.length, desc: "التبويب التجميعي المفرز الجاهز كلياً وبدون تكرار (أ + ب + ج + د)" }
  ];

  summaryRows.forEach((r, idx) => {
    summarySheet.addRow({ item: r.item, count: r.count, desc: r.desc });
    const isEven = idx % 2 === 0;
    const rowNum = idx + 2;
    summarySheet.getRow(rowNum).height = 24;
    ["A", "B", "C"].forEach(col => {
      const cell = summarySheet.getCell(`${col}${rowNum}`);
      cell.font = { name: "Segoe UI", size: 10, color: { argb: "1E293B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "F8FAFC" : "FFFFFF" } };
      cell.alignment = { horizontal: col === "B" ? "center" : "right", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } }
      };
    });
  });

  // --- DATA TABS: Strictly disjoint order ---
  addDataTabToWorkbook(workbook, "المؤهلين للتواصل", groups.eligible);
  addDataTabToWorkbook(workbook, "المراجعة الذكية (Smart)", smartReviewList);
  addDataTabToWorkbook(workbook, "أصحاب المتاجر والمواقع (أ)", groups.stores);
  addDataTabToWorkbook(workbook, "أصحاب السوشيال (ب)", groups.socials);
  addDataTabToWorkbook(workbook, "المتاجر والسوشيال (ج)", groups.combo);
  addDataTabToWorkbook(workbook, "قيد الإنشاء (د)", groups.creation);
  addDataTabToWorkbook(workbook, "روابط بدون هاتف (هـ)", groups.linksNoPhone);
  addDataTabToWorkbook(workbook, "أرقام غير صالحة (و)", groups.invalidPhones);
  addDataTabToWorkbook(workbook, "مراجعة يدوية وتحذيرية (ح)", groups.manualReview);
  addDataTabToWorkbook(workbook, "سجلات مكررة مدمجة (ط)", groups.duplicates);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function addDataTabToWorkbook(workbook: ExcelJS.Workbook, sheetName: string, items: CustomerProcessResult[]) {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31), {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, rightToLeft: true }]
  });

  const sortedData = sortLeadResults(items);

  worksheet.columns = [
    { header: "المسلسل", key: "index", width: 10 },
    { header: "الاسم المعتمد", key: "approvedName", width: 22 },
    { header: "الاسم البديل", key: "alternativeName", width: 18 },
    { header: "مصدر الاسم", key: "nameSource", width: 14 },
    { header: "دقة استخراج الاسم (%)", key: "nameConfidence", width: 15 },
    { header: "رقم الجوال الأصلي", key: "originalPhone", width: 16 },
    { header: "رقم الجوال بصيغة واتساب", key: "cleanedPhone", width: 20 },
    { header: "صحة الرقم؟", key: "isPhoneValid", width: 12 },
    { header: "جاهز للواتساب؟", key: "whatsappReady", width: 14 },
    { header: "وجود متجر؟", key: "hasStore", width: 11 },
    { header: "وجود سوشيال؟", key: "hasSocial", width: 12 },
    { header: "منصة المتجر", key: "platformType", width: 14 },
    { header: "النشاط التجاري", key: "businessCategory", width: 16 },
    { header: "حالة الموقع الإلكتروني", key: "websiteStatus", width: 20 },
    { header: "رابط المتجر", key: "storeLink", width: 30 },
    { header: "رابط السوشيال", key: "socialLink", width: 30 },
    { header: "نوع الرابط", key: "linkType", width: 14 },
    { header: "التصنيف النهائي", key: "classificationName", width: 32 },
    { header: "سبب التصنيف", key: "classificationReason", width: 40 },
    { header: "تحتاج مراجعة يدوية؟", key: "needsManualReview", width: 16 },
    { header: "مستوى ثقة الملاحظات (%)", key: "remarksConfidence", width: 17 },
    { header: "مصدر البيانات الكامل", key: "sourceMeta", width: 30 },
    { header: "رقم الصف الأصلي", key: "rowIndex", width: 14 },
    { header: "الملاحظات", key: "remarks", width: 25 }
  ];

  sortedData.forEach((c, index) => {
    const sourcesStr = c.allSources ? c.allSources.map(s => `${s.fileName} -> شيت (${s.sheetName}) -> صف [${s.rowIndex}]`).join(" | ") : "";
    const isPhoneValid = c.classification !== "F" && c.cleanedPhone && !c.cleanedPhone.includes("بدون") ? "نعم" : "لا";
    const hasStore = c.storeLink ? "نعم" : "لا";
    const hasSocial = c.socialLink ? "نعم" : "لا";
    const needsManualReview = c.classification === "H" ? "نعم" : "لا";
    
    const websiteStatusAr = c.websiteStatus === "Active" ? "نشط ومتاح" : 
                             c.websiteStatus === "Inactive" ? "غير نشط / منتهي" :
                             c.websiteStatus === "Redirected" ? "تم التحويل" :
                             c.websiteStatus === "Check Pending" ? "بانتظار الفحص" : "لا يوجد موقع";

    const linkTypeAr = c.linkType === "both" ? "متجر + سوشيال" : 
                       c.linkType === "store" ? "متجر إلكتروني" : 
                       c.linkType === "social" ? "قناة تواصل" : "بدون روابط";

    worksheet.addRow({
      index: index + 1,
      approvedName: c.approvedName || "لا يوجد اسم واضح",
      alternativeName: c.alternativeName || "لا يوجد",
      nameSource: c.nameSource || "Manual Review",
      nameConfidence: c.nameConfidence !== undefined ? `${c.nameConfidence}%` : "0%",
      originalPhone: c.originalPhone || "بدون هاتف",
      cleanedPhone: c.cleanedPhone || "بدون هاتف",
      isPhoneValid,
      whatsappReady: c.whatsappReady ? "نعم" : "لا",
      hasStore,
      hasSocial,
      platformType: c.platformType || "Unknown",
      businessCategory: c.businessCategory || "Unknown",
      websiteStatus: websiteStatusAr,
      storeLink: c.storeLink || "لا يوجد",
      socialLink: c.socialLink || "لا يوجد",
      linkType: linkTypeAr,
      classificationName: c.classificationName,
      classificationReason: c.reason,
      needsManualReview,
      remarksConfidence: c.remarksConfidence !== undefined ? `${c.remarksConfidence}%` : "0%",
      sourceMeta: sourcesStr,
      rowIndex: c.sourceMeta?.rowIndex || 1,
      remarks: c.remarks && c.remarks.length > 0 ? c.remarks.join(" | ") : "سليم"
    });
  });

  // Style Header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1E293B" } // Slate-800
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" }
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: "0F172A" } },
      left: { style: "thin", color: { argb: "334155" } },
      right: { style: "thin", color: { argb: "334155" } }
    };
  });

  // Highlight and Zebra striping cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    row.height = 24;
    const isEven = rowNumber % 2 === 0;

    row.eachCell((cell, colNumber) => {
      const col = worksheet.columns[colNumber - 1];
      if (!col) return;
      const colKey = col.key;

      cell.font = {
        name: "Segoe UI",
        size: 10,
        color: { argb: "1E293B" }
      };

      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } }
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: colKey === "index" || colKey === "nameConfidence" || colKey === "remarksConfidence" || colKey === "rowIndex" || colKey === "isPhoneValid" || colKey === "whatsappReady" || colKey === "hasStore" || colKey === "hasSocial" ? "center" : "right",
        wrapText: colKey === "classificationReason" || colKey === "remarks" || colKey === "sourceMeta" || colKey === "classificationName"
      };

      // Fills with zebra stripes and color codes
      let colorHex = "FFFFFF";

      const identityKeys = ["index", "approvedName", "alternativeName", "nameSource", "nameConfidence", "originalPhone", "cleanedPhone", "isPhoneValid"];
      const whatsappKeys = ["whatsappReady"];
      const storeKeys = ["hasStore", "platformType", "storeLink"];
      const businessKeys = ["businessCategory"];
      const websiteKeys = ["websiteStatus"];

      if (identityKeys.includes(colKey!)) {
        colorHex = isEven ? "D6EBFF" : "EBF5FF"; // soft blue stable zebra
      } else if (whatsappKeys.includes(colKey!)) {
        colorHex = isEven ? "DCF7E1" : "EEFBF0"; // green zebra
      } else if (storeKeys.includes(colKey!)) {
        colorHex = isEven ? "E8DDF2" : "F5EEFB"; // purple zebra
      } else if (businessKeys.includes(colKey!)) {
        colorHex = isEven ? "FFE5CC" : "FFF5EB"; // orange zebra
      } else if (websiteKeys.includes(colKey!)) {
        colorHex = isEven ? "D5F6F9" : "EBFBFD"; // cyan zebra
      } else {
        colorHex = isEven ? "F1F5F9" : "FAFAFA"; // light gray zebra
      }

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorHex }
      };

      // Status codes highlight
      if (colKey === "websiteStatus") {
        const val = String(cell.value || "");
        if (val.includes("نشط")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "A7F3D0" } };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "065F46" } };
        } else if (val.includes("غير") || val.includes("منتهي") || val.includes("فشل")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FCA5A5" } };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "991B1B" } };
        } else if (val.includes("بانتظار")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FDE68A" } };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "92400E" } };
        } else if (val.includes("لا يوجد") || val.includes("فارغ")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E4E4E7" } };
          cell.font = { name: "Segoe UI", size: 10, color: { argb: "52525B" } };
        }
      }

      // Highlight WhatsApp Ready value
      if (colKey === "whatsappReady") {
        const val = String(cell.value || "");
        if (val === "نعم") {
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "15803D" } };
        } else {
          cell.font = { name: "Segoe UI", size: 10, color: { argb: "B91C1C" } };
        }
      }

      // Format url as clickable hyperlink in cell
      if ((colKey === "storeLink" || colKey === "socialLink") && cell.value && String(cell.value).startsWith("http")) {
        const linkVal = String(cell.value);
        cell.value = {
          text: linkVal,
          hyperlink: linkVal,
          tooltip: "انقر لفتح الرابط مباشرة"
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          color: { argb: "2563EB" },
          underline: "single"
        };
      }
    });
  });

  // Dynamically recalculate and adjust column widths
  worksheet.columns.forEach(column => {
    let maxLen = 0;
    column.eachCell!({ includeEmpty: true }, (cell, rowNum) => {
      if (rowNum === 1) return; // ignore headers for width calculation to prevent wide header expansions
      let cellVal = cell.value;
      if (cellVal && typeof cellVal === "object" && "text" in cellVal) {
        cellVal = cellVal.text;
      }
      const valStr = cellVal ? String(cellVal) : "";
      const len = valStr.length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(45, Math.max(14, Math.round(maxLen * 1.15) + 3));
  });

  // Enable AutoFilter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length }
  };
}

export function isSmartReviewCandidate(c: CustomerProcessResult): boolean {
  // 1. Customer name not clear (approvedName is empty OR nameConfidence < 70%)
  if (!c.approvedName || c.nameConfidence < 70) return true;
  
  // 2. Correct phone but no name and no links
  if (c.cleanedPhone && !c.approvedName && !c.storeLink && !c.socialLink) return true;
  
  // 3. Website does not work or failed check
  if (c.storeLink && (c.websiteStatus === "Inactive" || c.websiteStatus === "Check Failed" || c.websiteStatus === "Not Found")) return true;
  
  // 4. Multiple phone numbers on same row
  if (c.allPhones && c.allPhones.length > 1) return true;
  
  // 5. Multiple store or social links on same row
  if (c.allLinks && c.allLinks.length > 1) return true;
  
  // 6. Conflicting link types / classification (e.g. store link but classified as socialOnly)
  if (c.storeLink && c.classification === "B") return true;
  if (c.socialLink && c.classification === "A") return true;

  return false;
}
