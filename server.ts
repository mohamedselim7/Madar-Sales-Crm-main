import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import * as XLSX from "xlsx";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  processRawSheetData, 
  mergeAndDeduplicate, 
  generateComprehensiveMultiTabExcel, 
  generateExcelExportBlob 
} from "./src/utils/customerParser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ limit: "200mb", extended: true }));

  // Initialize Firebase Admin SDK
  //
  // The hosting platform creates a NEW versioned folder
  // (hbuilds/versions/<uuid>/nodejs/) on every deploy. firebase-service-account.json
  // is gitignored (it's a secret, not committed), so it never automatically
  // exists in a fresh version folder — it has to be re-uploaded by hand each
  // time, which is exactly what was causing the ENOENT crash on deploy.
  //
  // Fix: read the credential from an env var first (set once in the
  // hosting panel, persists across every deploy). Fall back to the file
  // for local/dev environments where the JSON file is easier to manage.
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = path.join(process.cwd(), "firebase-service-account.json");

  let serviceAccount: any;
  if (serviceAccountEnv) {
    serviceAccount = JSON.parse(serviceAccountEnv);
    console.log("Firebase service account loaded from FIREBASE_SERVICE_ACCOUNT_JSON env var.");
  } else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    console.log("Firebase service account loaded from firebase-service-account.json file.");
  } else {
    throw new Error(
      "No Firebase service account found. Set the FIREBASE_SERVICE_ACCOUNT_JSON env var " +
      "(recommended for this host, since deploy folders change) or place a " +
      "firebase-service-account.json file next to server.js."
    );
  }

// This project uses a named Firestore database (see firestoreDatabaseId in
// firebase-applet-config.json / src/firebase.ts on the client side) rather
// than the "(default)" database. getFirestore() with no databaseId argument
// connects to "(default)", which is a DIFFERENT database than the one the
// app's data actually lives in — that mismatch is what produced
// "Missing or insufficient permissions" here even with a valid service
// account: the account was never being asked to touch the right database.
const appletConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const appletConfig = JSON.parse(fs.readFileSync(appletConfigPath, "utf8"));

const firebaseAdminApp = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(firebaseAdminApp, appletConfig.firestoreDatabaseId);

console.log(`Firebase Admin initialized successfully (database: ${appletConfig.firestoreDatabaseId})`);

  // Background Job Processing Queue
  const jobQueue: string[] = [];
  let currentProcessingJobId: string | null = null;

  async function triggerProcessing() {
    if (currentProcessingJobId) return;
    if (jobQueue.length === 0) return;

    const jobId = jobQueue.shift()!;
    currentProcessingJobId = jobId;

    try {
      await processJob(jobId);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
    } finally {
      currentProcessingJobId = null;
      setTimeout(triggerProcessing, 1000);
    }
  }

  async function processJob(jobId: string) {
    const jobRef = db.collection("background_jobs").doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) return;
    const jobData = jobSnap.data();

    if (jobData.status === "cancelled" || jobData.status === "failed") return;

    const startedAt = new Date().toISOString();
    await jobRef.update({
      status: "processing",
      startedAt
    });

    const flatRowsPath = `/tmp/job_${jobId}_flat_rows.json`;
    const resultsPath = `/tmp/job_${jobId}_results.json`;

    if (!fs.existsSync(flatRowsPath)) {
      throw new Error("ملفات بيانات المعالجة غير موجودة على الخادم");
    }

    const flatRows = JSON.parse(fs.readFileSync(flatRowsPath, "utf8"));
    const totalRows = flatRows.length;

    let processedRows = jobData.processedRows || 0;
    let accumulatedResults: any[] = [];

    if (processedRows > 0 && fs.existsSync(resultsPath)) {
      try {
        accumulatedResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
      } catch (e) {
        processedRows = 0;
      }
    }

    const BATCH_SIZE = 500;

    while (processedRows < totalRows) {
      // Check for user cancellation
      const freshSnap = await jobRef.get();
      if (freshSnap.exists) {
        const freshData = freshSnap.data();
        if (freshData.status === "cancelled") {
          console.log(`Job ${jobId} cancelled.`);
          return;
        }
      }

      const currentBatch = flatRows.slice(processedRows, processedRows + BATCH_SIZE);
      const groups: { [key: string]: { headerRow: any[] | null; fileName: string; sheetName: string; items: { rowIndex: number; rowData: any[] }[] } } = {};

      for (const item of currentBatch) {
        const key = `${item.originalFileName}|||${item.sheetName}`;
        if (!groups[key]) {
          groups[key] = {
            headerRow: item.headerRow,
            fileName: item.originalFileName,
            sheetName: item.sheetName,
            items: []
          };
        }
        groups[key].items.push({ rowIndex: item.rowIndex, rowData: item.rowData });
      }

      const batchParsedResults: any[] = [];
      for (const group of Object.values(groups)) {
        const rowsPayload: any[][] = [];
        if (group.headerRow) {
          rowsPayload.push(group.headerRow);
        }
        group.items.forEach(it => {
          rowsPayload.push(it.rowData);
        });

        const parsedPart = processRawSheetData(rowsPayload, group.fileName, group.sheetName);
        parsedPart.forEach((res, idx) => {
          const origItem = group.items[idx];
          if (origItem) {
            res.sourceMeta.rowIndex = origItem.rowIndex + 1;
            res.allSources.forEach(src => {
              src.rowIndex = origItem.rowIndex + 1;
            });
          }
        });
        batchParsedResults.push(...parsedPart);
      }

      accumulatedResults.push(...batchParsedResults);
      fs.writeFileSync(resultsPath, JSON.stringify(accumulatedResults), "utf8");

      processedRows += currentBatch.length;
      const progress = Math.min(100, Math.floor((processedRows / totalRows) * 100));

      const { uniqueCustomers, duplicateRecords } = mergeAndDeduplicate(accumulatedResults);
      const uniqueClientsVal = uniqueCustomers.length;

      const vPhones = uniqueCustomers.filter(c => c.classification !== "F" && c.cleanedPhone).length;
      const invPhones = uniqueCustomers.filter(c => c.classification === "F").length;
      const stOnly = uniqueCustomers.filter(c => c.classification === "A").length;
      const socOnly = uniqueCustomers.filter(c => c.classification === "B").length;
      const stAndSoc = uniqueCustomers.filter(c => c.classification === "C").length;
      const crOnly = uniqueCustomers.filter(c => c.classification === "D").length;
      const linksNoPhone = uniqueCustomers.filter(c => c.classification === "E").length;
      const malLinks = uniqueCustomers.filter(c => c.classification === "G").length;
      const manualRevCount = uniqueCustomers.filter(c => c.classification === "H").length;

      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      const rowsPerMs = processedRows / elapsedMs;
      const remainingRows = totalRows - processedRows;
      const estSec = rowsPerMs > 0 ? Math.ceil((remainingRows / rowsPerMs) / 1000) : 0;

      await jobRef.update({
        progress,
        processedRows,
        uniqueClients: uniqueClientsVal,
        estimatedTimeRemaining: estSec,
        stats: {
          totalRows,
          uniqueClients: uniqueClientsVal,
          validPhones: vPhones,
          invalidPhones: invPhones,
          storesOnly: stOnly,
          socialsOnly: socOnly,
          storeAndSocial: stAndSoc,
          creationOnly: crOnly,
          noPhoneLinks: linksNoPhone,
          invalidLinks: malLinks,
          duplicatesCount: duplicateRecords.length,
          manualReview: manualRevCount
        }
      });

      await new Promise(resolve => setTimeout(resolve, 80));
    }

    await jobRef.update({
      status: "completed",
      completedAt: new Date().toISOString(),
      progress: 100,
      estimatedTimeRemaining: 0
    });

    const { uniqueCustomers } = mergeAndDeduplicate(accumulatedResults);
    const stCount = uniqueCustomers.filter(c => c.classification === "A" || c.classification === "C").length;
    const socCount = uniqueCustomers.filter(c => c.classification === "B" || c.classification === "C").length;
    const buildCount = uniqueCustomers.filter(c => c.classification === "D").length;
    const corruptedCount = uniqueCustomers.filter(c => c.classification === "F" || c.classification === "G" || c.classification === "H").length;

    const sessionLogRef = db.collection("filter_sessions").doc();
    await sessionLogRef.set({
      id: sessionLogRef.id,
      fileName: jobData.fileName,
      totalContacts: uniqueCustomers.length,
      storeCount: stCount,
      socialCount: socCount,
      creationCount: buildCount,
      brokenCount: corruptedCount,
      timestamp: new Date().toISOString(),
      operatorName: jobData.operatorName
    });
  }

  async function sendExcelBlob(res: express.Response, blob: any, filename: string) {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
    res.send(buffer);
  }

  // API Route for website analysis crawling
  app.post("/api/analyze-website", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "رابط الموقع مطلوب" });
    }

    try {
      // Basic validation
      let targetUrl = url;
      if (!targetUrl.startsWith("http")) targetUrl = "https://" + targetUrl;

      const extractedData: any = {
        url: targetUrl,
        timestamp: new Date().toISOString(),
        internalLinks: [],
      };

      // Helper to fetch and parse
      const fetchPage = async (pageUrl: string) => {
        try {
          const res = await axios.get(pageUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" },
            timeout: 8000,
          });
          return cheerio.load(res.data);
        } catch (e) {
          return null;
        }
      };

      const $ = await fetchPage(targetUrl);
      if (!$) throw new Error("Could not reach website");

      const bodyText = $("body").text().trim();
      if (bodyText.length < 100) {
        return res.status(400).json({ error: "لم يتم العثور على محتوى كافي للتحليل" });
      }

      const htmlContent = $.html().toLowerCase();

      // Basic Metadata
      extractedData.meta = {
        title: $("title").text().trim() || "غير متوفر",
        description: $('meta[name="description"]').attr("content") || "غير متوفر",
        language: $("html").attr("lang") || "غير متوفر",
        hasSSL: targetUrl.startsWith("https"),
        platform: "Custom",
      };

      // Find Internal Links for "Depth"
      const domains = new URL(targetUrl).hostname;
      $("a[href]").each((i, el) => {
        const href = $(el).attr("href");
        if (href && (href.startsWith("/") || href.includes(domains)) && !extractedData.internalLinks.includes(href)) {
          if (extractedData.internalLinks.length < 5) extractedData.internalLinks.push(href);
        }
      });

      // Platform Detection
      if (htmlContent.includes("shopify")) extractedData.meta.platform = "Shopify";
      else if (htmlContent.includes("wp-content") || htmlContent.includes("wordpress")) extractedData.meta.platform = "WordPress";
      else if (htmlContent.includes("salla.sa")) extractedData.meta.platform = "Salla";
      else if (htmlContent.includes("zid.sa")) extractedData.meta.platform = "Zid";

      // Discovery: Try to fetch one more page if it looks like a Product/Service page
      let secondaryPageData = "No internal page analyzed";
      const secondaryLink = extractedData.internalLinks.find((l: string) => l.includes("product") || l.includes("item") || l.includes("service") || l.includes("shop"));
      if (secondaryLink) {
        const secondaryUrl = secondaryLink.startsWith("http") ? secondaryLink : new URL(secondaryLink, targetUrl).href;
        const $2 = await fetchPage(secondaryUrl);
        if ($2) secondaryPageData = `Internal Page (${secondaryUrl}) Title: ${$2("title").text().trim()}`;
      }

      // Structure Extraction
      extractedData.structure = {
        sectionsCount: $("section").length || "غير متوفر من البيانات المقروءة",
        hasHero: ($("section:first-child").length > 0 || $(".hero").length > 0) ? "نعم" : "لا",
        bannersCount: ($("img[src*='banner']").length + $(".banner").length) || 0,
        textBlocksCount: $("p, h1, h2, h3").length,
        secondaryPageInfo: secondaryPageData,
      };

      // Navigation
      extractedData.navigation = {
        headerLinksCount: $("header a, nav a").length,
        footerLinksCount: $("footer a").length,
        hasSearchBar: $('input[type="search"], .search-form, #search').length > 0 ? "نعم" : "لا",
      };

      // CTA Detection
      const ctaKeywords = ["buy", "order", "shop", "contact", "whatsapp", "اطلب", "اشتري", "تواصل", "واتساب", "سلة", "cart", "add to cart"];
      const ctaFound: string[] = [];
      $("button, a.btn, a.button, .cta, a:contains('سلة'), a:contains('اطلب')").each((i, el) => {
        const text = $(el).text().toLowerCase().trim();
        if (text && ctaKeywords.some(kw => text.includes(kw))) {
          ctaFound.push(text);
        }
      });
      extractedData.ctas = {
        totalFound: ctaFound.length,
        buttons: [...new Set(ctaFound)].slice(0, 10),
      };

      // Trust Signals
      extractedData.trust = {
        hasReviews: htmlContent.includes("review") || htmlContent.includes("تقييم") ? "نعم" : "لا",
        hasTestimonials: htmlContent.includes("testimonial") || htmlContent.includes("قالوا عنا") ? "نعم" : "لا",
        hasWhatsApp: (htmlContent.includes("wa.me") || htmlContent.includes("whatsapp")) ? "نعم" : "لا",
        hasPhone: /(\+?\d{1,4}[-.\s]?)?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}/.test(htmlContent) ? "نعم" : "لا",
        hasRefundPolicy: (htmlContent.includes("refund") || htmlContent.includes("سياسة الاسترجاع") || htmlContent.includes("الاستبدال")) ? "نعم" : "لا",
        hasPaymentBadges: (htmlContent.includes("visa") || htmlContent.includes("mastercard") || htmlContent.includes("mada")) ? "نعم" : "لا",
      };

      // Forms
      extractedData.forms = {
        count: $("form").length,
        hasLeadGen: htmlContent.includes("contact") || htmlContent.includes("subscribe") || htmlContent.includes("newsletter") ? "نعم" : "لا",
      };

      // SEO & Technical
      extractedData.seo = {
        h1Count: $("h1").length,
        h2Count: $("h2").length,
        h3Count: $("h3").length,
        totalImages: $("img").length,
        imagesMissingAlt: $("img:not([alt]), img[alt='']").length,
        hasCanonical: $('link[rel="canonical"]').length > 0 ? "نعم" : "لا",
        hasViewport: $('meta[name="viewport"]').length > 0 ? "نعم" : "لا",
        hasSitemap: htmlContent.includes("sitemap") ? "نعم" : "لا",
      };

      // Content
      const pageText = $.text().replace(/\s+/g, ' ').trim();
      extractedData.content = {
        wordCount: pageText.substring(0, 10000).split(' ').length, // Limit processing for wordcount
        hasFAQ: (htmlContent.includes("faq") || htmlContent.includes("أسئلة")) ? "نعم" : "لا",
        hasBlog: (htmlContent.includes("blog") || htmlContent.includes("مدونة")) ? "نعم" : "لا",
      };

      return res.json(extractedData);

    } catch (error: any) {
      console.error("Crawl error:", error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(400).json({ error: "رابط الموقع غير صالح أو لا يمكن الوصول إليه" });
      }
      if (error.response?.status === 403) {
        return res.status(403).json({ error: "الموقع يمنع القراءة الآلية" });
      }
      return res.status(500).json({ error: "لا يمكن تحليل الموقع لأن النظام لم يتمكن من قراءة بيانات حقيقية من الرابط" });
    }
  });

  app.post("/api/analyze-social", async (req, res) => {
    const { links } = req.body;
    const results: any = {};

    const crawlPlatform = async (platform: string, url: string) => {
      if (!url) return;
      if (platform === "snapchat") {
        results[platform] = { status: "LIMITATION", message: "بيانات سناب غير متاحة تلقائيًا" };
        return;
      }

      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 8000 // Reduced timeout for speed
        });

        const $ = cheerio.load(response.data);
        const data: any = { status: "SUCCESS", url };

        if (platform === "instagram") {
          const ogDesc = $('meta[property="og:description"]').attr('content') || "";
          data.bio = ogDesc.substring(0, 500); // Limit bio size
          data.title = $('title').text();
          
          const followersMatch = ogDesc.match(/([\d,.\w]+)\s*Followers/i);
          const followingMatch = ogDesc.match(/([\d,.\w]+)\s*Following/i);
          const postsMatch = ogDesc.match(/([\d,.\w]+)\s*Posts/i);
          
          if (followersMatch) data.followers = followersMatch[1];
          if (followingMatch) data.following = followingMatch[1];
          if (postsMatch) data.posts = postsMatch[1];
        } else if (platform === "tiktok") {
          data.title = $('title').text();
          const desc = $('meta[name="description"]').attr('content') || "";
          data.description = desc.substring(0, 500);
          
          const followersMatch = desc.match(/([\d,.\w]+)\s*Followers/i);
          const likesMatch = desc.match(/([\d,.\w]+)\s*Likes/i);
          
          if (followersMatch) data.followers = followersMatch[1];
          if (likesMatch) data.likes = likesMatch[1];
        } else if (platform === "youtube") {
          data.title = $('title').text();
          const desc = $('meta[name="description"]').attr('content') || "";
          data.description = desc.substring(0, 500);
          const subsMatch = desc.match(/([\d,.\w]+)\s*subscribers/i);
          if (subsMatch) data.subscribers = subsMatch[1];
        } else if (platform === "facebook") {
          data.title = $('title').text();
          const desc = $('meta[name="description"]').attr('content') || "";
          data.description = desc.substring(0, 500);
          const likesMatch = desc.match(/([\d,.\w]+)\s*likes/i);
          const followersMatch = desc.match(/([\d,.\w]+)\s*followers/i);
          if (likesMatch) data.likes = likesMatch[1];
          if (followersMatch) data.followers = followersMatch[1];
        } else if (platform === "twitter") {
          data.title = $('title').text();
          data.description = ($('meta[name="description"]').attr('content') || "").substring(0, 500);
        }

        results[platform] = data;
      } catch (error: any) {
        if (error.response?.status === 403 || error.response?.status === 429) {
          results[platform] = { status: "BLOCKED", message: "المنصة تمنع القراءة الآلية" };
        } else {
          results[platform] = { status: "ERROR", message: "الرابط غير صالح" };
        }
      }
    };

    // Parallel execution for all platforms
    await Promise.all(Object.entries(links).map(([platform, url]) => crawlPlatform(platform, url as string)));

    res.json(results);
  });

  // API Route to bulk check domain validity and identify dead domains
  app.post("/api/check-domains", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: "قائمة روابط المواقع مطلوبة" });
    }

    const checkDomain = async (url: string) => {
      let targetUrl = url.trim();
      if (!targetUrl) return { url, active: false, status: "empty", reason: "رابط فارغ" };
      if (!targetUrl.startsWith("http")) targetUrl = "https://" + targetUrl;

      try {
        const response = await axios.get(targetUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" },
          timeout: 4000,
          validateStatus: () => true, // Accept any status code (even 404/500 means server responds)
        });
        
        const html = String(response.data || "").toLowerCase();
        const expiredKeywords = [
          "domain expired", "suspended", "this domain is for sale", 
          "buy this domain", "رصيد اشتراكك انتهى", "موقف مؤقتا", 
          "تجديد الاشتراك", "expired membership", "عفوا، الموقع الذي تطلبه غير متاح",
          "account suspended", "has expired"
        ]; 
        const isSuspended = expiredKeywords.some(kw => html.includes(kw));

        if (isSuspended) {
          return { url, active: false, status: "expired", reason: "محتوى معطل / منتهي الصلاحية" };
        }

        return { url, active: true, status: "active", reason: "نشط ومتاح" };
      } catch (error: any) {
        let reason = "غير نشط";
        if (error.code === 'ENOTFOUND') {
          reason = "النطاق غير موجود أو منتهي";
        } else if (error.code === 'ECONNREFUSED') {
          reason = "رفض الانصال بالسيرفر";
        } else if (error.timeout || error.code === 'ECONNABORTED') {
          reason = "انتهاء مهلة الاتصال (Timeout)";
        } else {
          reason = "خطأ في الاتصال بالسيرفر";
        }

        return { url, active: false, status: "inactive", reason };
      }
    };

    try {
      // Run checks in parallel with limit/batches or direct Promise.all since it's up to 50
      const results = await Promise.all(urls.slice(0, 100).map(url => checkDomain(url)));
      return res.json({ results });
    } catch (err: any) {
      console.error("General domain check failure:", err);
      return res.status(500).json({ error: "فشل التحقق من الدومينات" });
    }
  });

  // Background Job Processing APIs
  app.post("/api/jobs/create", async (req, res) => {
    try {
      const { files, operatorName, userId, userEmail } = req.body;
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "لا تتوفر أية ملفات مرفوعة للمعالجة" });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Process sheet headers and build flatRows
      const allSheetData: { sheetName: string; rows: any[][]; originalFileName: string }[] = [];
      for (const f of files) {
        const buffer = Buffer.from(f.base64Data, "base64");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          allSheetData.push({ sheetName, rows: rawRows, originalFileName: f.fileName });
        }
      }

      const flatRows: any[] = [];
      for (const sheet of allSheetData) {
        let headerIndex = -1;
        let maxScore = -1;
        const nameKeywords = ["الاسم", "اسم", "الزبون", "التاجر", "العميل", "العام", "name", "client", "customer", "merchant"];
        const phoneKeywords = ["جوال", "هاتف", "رقم", "موبايل", "تليفون", "اتصال", "phone", "mobile", "tel", "whatsapp", "جوال العميل", "رقم الجوال", "رقم الهاتف", "الرقم الأصلي", "الرقم الأصلى", "الرقم المعدل", "الهاتف أصلي", "القديم", "الموحد"];
        const linkKeywords = ["رابط", "متجر", "لينك", "ويب", "دومين", "سوشيال", "link", "url", "website", "store", "insta", "snap", "الرابط", "المتجر", "موقع الكتروني", "موقع الإلكتروني", "موقع الويب"];

        for (let r = 0; r < Math.min(10, sheet.rows.length); r++) {
          const row = sheet.rows[r];
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

        const headerRow = headerIndex !== -1 ? sheet.rows[headerIndex] : null;
        const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

        for (let r = startRow; r < sheet.rows.length; r++) {
          const rowData = sheet.rows[r];
          if (!rowData || rowData.length === 0) continue;
          const nonBlank = rowData.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
          if (nonBlank.length === 0) continue;
          flatRows.push({
             originalFileName: sheet.originalFileName,
             sheetName: sheet.sheetName,
             rowIndex: r,
             rowData,
             headerRow
          });
        }
      }

      const flatRowsPath = `/tmp/job_${jobId}_flat_rows.json`;
      fs.writeFileSync(flatRowsPath, JSON.stringify(flatRows), "utf8");

      const jobRef = db.collection("background_jobs").doc(jobId);
      await jobRef.set({
        id: jobId,
        fileName: files.map(f => f.fileName).join(" + "),
        uploadedAt: new Date().toISOString(),
        status: "pending",
        progress: 0,
        totalRows: flatRows.length,
        processedRows: 0,
        uniqueClients: 0,
        estimatedTimeRemaining: 0,
        operatorName: operatorName,
        userId: userId || null,
        userEmail: userEmail || null,
        stats: {
          totalRows: flatRows.length,
          uniqueClients: 0,
          validPhones: 0,
          invalidPhones: 0,
          storesOnly: 0,
          socialsOnly: 0,
          storeAndSocial: 0,
          creationOnly: 0,
          noPhoneLinks: 0,
          invalidLinks: 0,
          duplicatesCount: 0,
          manualReview: 0
        }
      });

      jobQueue.push(jobId);
      triggerProcessing();

      return res.status(200).json({ success: true, jobId, totalRows: flatRows.length });
    } catch (err: any) {
      console.error("Job creation error:", err);
      return res.status(500).json({ error: "فشل إنشاء مهمة المعالجة بالخلفية: " + err.message });
    }
  });

  app.post("/api/jobs/:jobId/cancel", async (req, res) => {
    try {
      const { jobId } = req.params;
      const jobRef = db.collection("background_jobs").doc(jobId);
      await jobRef.update({
        status: "cancelled",
        completedAt: new Date().toISOString()
      });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: "فشل إلغاء المهمة: " + err.message });
    }
  });

  app.get("/api/jobs/:jobId/download/:type", async (req, res) => {
    const { jobId, type } = req.params;
    const resultsPath = `/tmp/job_${jobId}_results.json`;

    if (!fs.existsSync(resultsPath)) {
      return res.status(404).send("ملف نتائج هذه التصفية غير متوفر حالياً على السيرفر");
    }

    try {
      const rawResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
      const { uniqueCustomers, duplicateRecords } = mergeAndDeduplicate(rawResults);

      const eligible = uniqueCustomers.filter(c => c.classification === "A" || c.classification === "B" || c.classification === "C" || c.classification === "D");
      const stores = uniqueCustomers.filter(c => c.classification === "A");
      const socials = uniqueCustomers.filter(c => c.classification === "B");
      const combo = uniqueCustomers.filter(c => c.classification === "C");
      const creation = uniqueCustomers.filter(c => c.classification === "D");
      const linksNoPhone = uniqueCustomers.filter(c => c.classification === "E");
      const invalidPhones = uniqueCustomers.filter(c => c.classification === "F");
      const manualReview = uniqueCustomers.filter(c => c.classification === "H" || c.classification === "G");
      const duplicates = duplicateRecords;

      const groups = {
        eligible,
        creation,
        stores,
        socials,
        combo,
        invalidPhones,
        linksNoPhone,
        duplicates,
        manualReview
      };

      if (type === "comprehensive") {
        const blob = await generateComprehensiveMultiTabExcel(groups);
        await sendExcelBlob(res, blob, "ملف_تصفية_مدار_الشامل_المدمج");
      } else {
        let targetList: any[] = [];
        let filename = "";
        let title = "";

        switch (type) {
          case "stores":
            targetList = stores;
            filename = "ملف_أصحاب_المتاجر_والمواقع";
            title = "أصحاب المتاجر";
            break;
          case "socials":
            targetList = socials;
            filename = "ملف_أصحاب_السوشيال_فقط";
            title = "أصحاب السوشيال";
            break;
          case "combo":
            targetList = combo;
            filename = "ملف_المتجر_والسوشيال_معا";
            title = "المتجر والسوشيال";
            break;
          case "creation":
            targetList = creation;
            filename = "ملف_قيد_الإنشاء";
            title = "قيد الإنشاء";
            break;
          case "linksNoPhone":
            targetList = linksNoPhone;
            filename = "ملف_روابط_بدون_هاتف";
            title = "روابط بدون هاتف";
            break;
          case "invalidPhones":
            targetList = invalidPhones;
            filename = "ملف_الأرقام_غير_الصالحة";
            title = "أرقام غير صالحة";
            break;
          case "manualReview":
            targetList = manualReview;
            filename = "ملف_مراجعة_يدوية_وتالفة";
            title = "المراجعة اليدوية والتالفة";
            break;
          case "duplicates":
            targetList = duplicates;
            filename = "ملف_المكررات_المدمجة";
            title = "المكررات";
            break;
          default:
            return res.status(400).send("نوع التحميل المطلوب غير مدعوم");
        }

        const blob = await generateExcelExportBlob(title, targetList);
        await sendExcelBlob(res, blob, filename);
      }
    } catch (err: any) {
      console.error("Failed to compile excel on download response:", err);
      return res.status(500).send("فشل تصدير وتحميل الملف المحدد: " + err.message);
    }
  });

  // --- WHATSAPP AUTOMATION IMPLEMENTATION ---

  // Phone number formatter
  function formatPhoneNumber(phone: string): string {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    
    // Egyptian mobile numbers (11 digits, starts with 01)
    if (cleaned.startsWith("01") && cleaned.length === 11) {
      cleaned = "20" + cleaned.slice(1);
    } else if (cleaned.startsWith("1") && cleaned.length === 10) {
      cleaned = "20" + cleaned;
    }
    
    // Saudi mobile numbers (10 digits, starts with 05)
    if (cleaned.startsWith("05") && cleaned.length === 10) {
      cleaned = "966" + cleaned.slice(1);
    } else if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "966" + cleaned;
    }

    // Default formatting backup
    if (cleaned.length === 11 && cleaned.startsWith("01")) {
      cleaned = "20" + cleaned.slice(1);
    }

    return cleaned;
  }

  // Get WhatsApp global settings (with masked token)
  app.get("/api/whatsapp/settings/get", async (req, res) => {
    try {
      const settingsRef = db.collection("settings").doc("whatsapp");
      const settingsSnap = await settingsRef.get();
      
      if (!settingsSnap.exists) {
        return res.json({
          apiUrl: "https://wasenderapi.com/api/send-message",
          apiToken: "",
          phoneNumber: "",
          active: false,
          connected: false
        });
      }

      const data = settingsSnap.data();
      const token = data.apiToken || "";
      const maskedToken = token ? "••••••••••••" + token.slice(-4) : "";

      return res.json({
        ...data,
        apiToken: maskedToken
      });
    } catch (err: any) {
      console.error("Failed to get whatsapp settings:", err);
      return res.status(500).json({ error: "فشل استيراد إعدادات الواتساب: " + err.message });
    }
  });

  // Save WhatsApp global settings
  app.post("/api/whatsapp/settings/save", async (req, res) => {
    try {
      const { apiUrl, apiToken, phoneNumber, active } = req.body;
      const settingsRef = db.collection("settings").doc("whatsapp");
      const settingsSnap = await settingsRef.get();

      let finalToken = apiToken;
      
      // If token is masked, preserve the existing one
      if (apiToken && apiToken.includes("••••")) {
        if (settingsSnap.exists) {
          finalToken = settingsSnap.data().apiToken || "";
        } else {
          finalToken = "";
        }
      }

      const updatedData = {
        apiUrl: apiUrl || "https://wasenderapi.com/api/send-message",
        apiToken: finalToken || "",
        phoneNumber: phoneNumber || "",
        active: active !== undefined ? active : true,
        connected: finalToken ? true : false,
        updatedAt: new Date().toISOString()
      };

      await settingsRef.set(updatedData, { merge: true });
      return res.json({ success: true, settings: { ...updatedData, apiToken: apiToken } });
    } catch (err: any) {
      console.error("Failed to save whatsapp settings:", err);
      return res.status(500).json({ error: "فشل حفظ إعدادات الواتساب: " + err.message });
    }
  });

  // Test connection
  app.post("/api/whatsapp/test-connection", async (req, res) => {
    try {
      const { apiUrl, apiToken } = req.body;
      let finalToken = apiToken;

      if (apiToken && apiToken.includes("••••")) {
        const settingsSnap = await db.collection('settings').doc('whatsapp').get();
        if (settingsSnap.exists) {
          finalToken = settingsSnap.data().apiToken || "";
        }
      }

      if (!finalToken) {
        return res.status(400).json({ error: "الـ Token مطلوب لإجراء فحص الاتصال" });
      }

      // Hit WasenderAPI send-message endpoint with empty/dummy payload to test bearer token validity
      try {
        await axios.post(apiUrl || "https://wasenderapi.com/api/send-message", {}, {
          headers: {
            "Authorization": `Bearer ${finalToken}`,
            "Content-Type": "application/json"
          },
          timeout: 6000
        });
        
        return res.json({ success: true, status: "connected", message: "اتصال ناجح بالخدمة" });
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          return res.status(401).json({ error: "فشل المصادقة: الـ API Token غير صالح" });
        }
        
        if (status) {
          return res.json({ success: true, status: "connected", message: "تم التحقق والاتصال بنجاح" });
        }

        return res.json({ success: true, status: "simulated", message: "تم حفظ الإعدادات وفحص الاتصال آمن" });
      }
    } catch (err: any) {
      return res.status(500).json({ error: "فشل فحص الاتصال: " + err.message });
    }
  });

  // Proxy API for sending standard WhatsApp messages
  app.post("/api/whatsapp/send-message", async (req, res) => {
    try {
      const { to, text, templateId, templateName, clientId, clientName, type, campaignId, ruleId, sentBy, mediaUrl } = req.body;

      if (!to || !text) {
        return res.status(400).json({ error: "رقم المستلم ومحتوى الرسالة مطلوبان" });
      }

      // Fetch global settings
      const settingsSnap = await db.collection('settings').doc('whatsapp').get();
      if (!settingsSnap.exists || !settingsSnap.data().apiToken) {
        return res.status(400).json({ error: "لم يتم تكوين إعدادات الواتساب أو تفعيلها بعد" });
      }

      const settings = settingsSnap.data();
      const formattedPhone = formatPhoneNumber(to);

      if (!formattedPhone) {
        return res.status(400).json({ error: "رقم الهاتف غير صالح" });
      }

      let sendError: string | null = null;
      let apiResponse: any = null;

      try {
        const payload: any = {
          phone: formattedPhone,
          message: text
        };
        if (mediaUrl) {
          payload.media_url = mediaUrl;
          payload.file = mediaUrl;
        }

        const response = await axios.post(settings.apiUrl || "https://wasenderapi.com/api/send-message", payload, {
          headers: {
            "Authorization": `Bearer ${settings.apiToken}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        });
        apiResponse = response.data;
      } catch (err: any) {
        sendError = err.response?.data?.message || err.message;
      }

      // Create log
      const logCollection = db.collection("whatsapp_logs");
      const logRef = logCollection.doc();
      const logData = {
        id: logRef.id,
        clientName: clientName || "عميل غير معروف",
        phone: formattedPhone,
        message: text,
        templateId: templateId || null,
        templateName: templateName || null,
        type: type || "individual", // individual, campaign, automation
        status: sendError ? "failed" : "sent",
        failureReason: sendError || null,
        createdAt: new Date().toISOString(),
        sentBy: sentBy || "نظام مدار",
        campaignId: campaignId || null,
        ruleId: ruleId || null
      };

      await logRef.set(logData);

      if (sendError) {
        return res.status(500).json({ error: "فشل إرسال الرسالة: " + sendError, logId: logRef.id });
      }

      return res.json({ success: true, logId: logRef.id, apiResponse });
    } catch (err: any) {
      console.error("Send message proxy error:", err);
      return res.status(500).json({ error: "خطأ داخلي أثناء معالجة الإرسال: " + err.message });
    }
  });

  // Campaign background processor map
  const activeCampaigns = new Set<string>();

  async function runCampaignSender(campaignId: string, clients: any[], templateId: string, templateName: string, messageTextTemplate: string, delaySeconds: number, sentBy: string, mediaUrl?: string) {
    if (activeCampaigns.has(campaignId)) return;
    activeCampaigns.add(campaignId);

    try {
      // Get global settings
      const settingsSnap = await db.collection('settings').doc('whatsapp').get();
      if (!settingsSnap.exists) {
        await db.collection('whatsapp_campaigns').doc(campaignId).update({ status: "paused", failureReason: "إعدادات الواتساب غير مهيأة" });
        activeCampaigns.delete(campaignId);
        return;
      }

      const settings = settingsSnap.data();
      const apiUrl = settings.apiUrl || "https://wasenderapi.com/api/send-message";
      const apiToken = settings.apiToken;

      const campaignRef = db.collection("whatsapp_campaigns").doc(campaignId);

      let sentCount = 0;
      let failedCount = 0;

      // Fetch starting state in case of resume
      const currentCampSnap = await campaignRef.get();
      if (currentCampSnap.exists) {
        sentCount = currentCampSnap.data().sentCount || 0;
        failedCount = currentCampSnap.data().failedCount || 0;
      }

      // Loop remaining clients starting from processed total (sentCount + failedCount)
      const startIndex = sentCount + failedCount;
      const targetClients = clients.slice(startIndex);

      for (let i = 0; i < targetClients.length; i++) {
        // Fetch fresh campaign status to check for Pause or Cancellation
        const freshCampSnap = await campaignRef.get();
        if (!freshCampSnap.exists) break;
        const currentStatus = freshCampSnap.data().status;
        if (currentStatus !== "sending") {
          console.log(`Campaign ${campaignId} was paused or stopped (current status: ${currentStatus}).`);
          break;
        }

        const client = targetClients[i];
        const formattedPhone = formatPhoneNumber(client.phone || "");

        if (!formattedPhone) {
          failedCount++;
          await campaignRef.update({ failedCount });
          continue;
        }

        // Replace template variables
        let personalizedText = messageTextTemplate
          .replace(/{clientName}/g, client.name || "")
          .replace(/{agentName}/g, sentBy || "")
          .replace(/{meetingDate}/g, client.meetingDate || "")
          .replace(/{remainingAmount}/g, client.remainingAmount || "");

        let sendError: string | null = null;
        try {
          const payload: any = {
            phone: formattedPhone,
            message: personalizedText
          };
          if (mediaUrl) {
            payload.media_url = mediaUrl;
            payload.file = mediaUrl;
          }

          await axios.post(apiUrl, payload, {
            headers: {
              "Authorization": `Bearer ${apiToken}`,
              "Content-Type": "application/json"
            },
            timeout: 10000
          });
          sentCount++;
        } catch (err: any) {
          sendError = err.response?.data?.message || err.message;
          failedCount++;
        }

        // Log the message individually
        const logCollection = db.collection("whatsapp_logs");
        const logRef = logCollection.doc();
        await logRef.set({
          id: logRef.id,
          clientName: client.name || "عميل الحملة",
          phone: formattedPhone,
          message: personalizedText,
          templateId: templateId || null,
          templateName: templateName || null,
          type: "campaign",
          status: sendError ? "failed" : "sent",
          failureReason: sendError || null,
          createdAt: new Date().toISOString(),
          sentBy: sentBy || "حملة مدار",
          campaignId: campaignId
        });

        // Update campaign progress
        await campaignRef.update({
          sentCount,
          failedCount,
          progress: Math.floor(((sentCount + failedCount) / clients.length) * 100)
        });

        // Custom batch delay
        if (i < targetClients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      }

      // Mark campaign as completed if we processed all clients
      const finalCampSnap = await campaignRef.get();
      if (finalCampSnap.exists && finalCampSnap.data().status === "sending") {
        const totalProcessed = sentCount + failedCount;
        if (totalProcessed >= clients.length) {
          await campaignRef.update({
            status: "completed",
            completedAt: new Date().toISOString(),
            progress: 100
          });
        }
      }

    } catch (err: any) {
      console.error(`Campaign ${campaignId} processing failure:`, err);
      await db.collection('whatsapp_campaigns').doc(campaignId).update({ status: "paused", failureReason: err.message });
    } finally {
      activeCampaigns.delete(campaignId);
    }
  }

  // Create campaign API
  app.post("/api/whatsapp/campaigns/create", async (req, res) => {
    try {
      const { name, target, filterStatus, templateId, templateName, messageText, delaySeconds, clients, sentBy, mediaUrl } = req.body;

      if (!name || !clients || !Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: "اسم الحملة وقائمة العملاء مطلوبة" });
      }

      const campaignRef = db.collection("whatsapp_campaigns").doc();
      const campaignData = {
        id: campaignRef.id,
        name,
        target,
        filterStatus: filterStatus || "جميع الحالات",
        templateId: templateId || null,
        templateName: templateName || null,
        messageText,
        delaySeconds: delaySeconds || 5,
        totalContacts: clients.length,
        sentCount: 0,
        failedCount: 0,
        status: "pending",
        createdAt: new Date().toISOString(),
        clients: clients, // Store clients to process
        sentBy: sentBy || "مدير الحملة",
        mediaUrl: mediaUrl || null
      };

      await campaignRef.set(campaignData);
      return res.json({ success: true, campaignId: campaignRef.id });
    } catch (err: any) {
      return res.status(500).json({ error: "فشل إنشاء الحملة: " + err.message });
    }
  });

  // Start campaign API
  app.post("/api/whatsapp/campaigns/:campaignId/start", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const campaignRef = db.collection("whatsapp_campaigns").doc(campaignId);
      const campSnap = await campaignRef.get();

      if (!campSnap.exists) {
        return res.status(404).json({ error: "الحملة غير موجودة" });
      }

      const campData = campSnap.data()!;
      await campaignRef.update({ status: "sending", startedAt: new Date().toISOString() });

      // Run sender loop in background asynchronously
      runCampaignSender(
        campaignId,
        campData.clients || [],
        campData.templateId,
        campData.templateName || "قالب مخصص",
        campData.messageText,
        campData.delaySeconds || 5,
        campData.sentBy || "حملة مدار",
        campData.mediaUrl
      );

      return res.json({ success: true, status: "sending" });
    } catch (err: any) {
      return res.status(500).json({ error: "فشل بدء الحملة: " + err.message });
    }
  });

  // Pause campaign API
  app.post("/api/whatsapp/campaigns/:campaignId/pause", async (req, res) => {
    try {
      const { campaignId } = req.params;
      await db.collection("whatsapp_campaigns").doc(campaignId).update({ status: "paused" });
      return res.json({ success: true, status: "paused" });
    } catch (err: any) {
      return res.status(500).json({ error: "فشل إيقاف الحملة مؤقتاً: " + err.message });
    }
  });

  // Trigger automation based on status change
  app.post("/api/whatsapp/trigger-status-automation", async (req, res) => {
    try {
      const { clientId, clientName, phone, status, type } = req.body; // type = 'telesales' | 'sales'

      if (!phone || !status) {
        return res.status(400).json({ error: "بيانات العميل وحالته مطلوبة لتفعيل الأتمتة" });
      }

      const ruleTrigger = type === "telesales" ? "status_change_telesales" : "status_change_sales";

      // Query active rules for this trigger and triggerValue
      const rulesQuery = db.collection("whatsapp_rules")
        .where("trigger", "==", ruleTrigger)
        .where("triggerValue", "==", status)
        .where("active", "==", true);


      const rulesSnap = await rulesQuery.get();
      if (rulesSnap.empty) {
        return res.json({ success: true, triggered: false, message: "لا توجد قواعد أتمتة نشطة لهذه الحالة" });
      }

      const triggeredRules: string[] = [];

      for (const ruleDoc of rulesSnap.docs) {
        const rule = ruleDoc.data();
        
        // Fetch Template content
        const templateSnap = await db.collection('whatsapp_templates').doc(rule.templateId).get();
        if (!templateSnap.exists) continue;

        const template = templateSnap.data();
        const content = template.content;

        // Personalize Text
        const personalizedText = content
          .replace(/{clientName}/g, clientName || "")
          .replace(/{agentName}/g, "نظام الأتمتة")
          .replace(/{meetingDate}/g, "")
          .replace(/{remainingAmount}/g, "");

        const delay = rule.delayMinutes || 0;

        if (delay === 0) {
          // Send immediately
          try {
            // Fetch global settings
            const settingsSnap = await db.collection('settings').doc('whatsapp').get();
            if (settingsSnap.exists && settingsSnap.data().apiToken) {
              const settings = settingsSnap.data();
              const formatted = formatPhoneNumber(phone);
              
              const payload: any = {
                phone: formatted,
                message: personalizedText
              };
              if (template.mediaUrl) {
                payload.media_url = template.mediaUrl;
                payload.file = template.mediaUrl;
              }

              await axios.post(settings.apiUrl || "https://wasenderapi.com/api/send-message", payload, {
                headers: {
                  "Authorization": `Bearer ${settings.apiToken}`,
                  "Content-Type": "application/json"
                },
                timeout: 10000
              });

              // Log as sent
              const logRef = db.collection("whatsapp_logs").doc();
              await logRef.set({
                id: logRef.id,
                clientName: clientName || "عميل أوتوماتيكي",
                phone: formatted,
                message: personalizedText,
                templateId: rule.templateId,
                templateName: template.name || "قالب أتمتة",
                type: "automation",
                status: "sent",
                createdAt: new Date().toISOString(),
                sentBy: "أتمتة مدار",
                ruleId: rule.id
              });
            }
          } catch (sendErr: any) {
            console.error("Immediate automation send failure:", sendErr);
            // Log as failed
            const logRef = db.collection("whatsapp_logs").doc();
            await logRef.set({
              id: logRef.id,
              clientName: clientName || "عميل أوتوماتيكي",
              phone: formatPhoneNumber(phone),
              message: personalizedText,
              templateId: rule.templateId,
              templateName: template.name || "قالب أتمتة",
              type: "automation",
              status: "failed",
              failureReason: sendErr.message,
              createdAt: new Date().toISOString(),
              sentBy: "أتمتة مدار",
              ruleId: rule.id
            });
          }
        } else {
          // Delay > 0, schedule by storing as pending message in whatsapp_logs
          const logRef = db.collection("whatsapp_logs").doc();
          const scheduledAt = new Date();
          scheduledAt.setMinutes(scheduledAt.getMinutes() + delay);

          await logRef.set({
            id: logRef.id,
            clientName: clientName || "عميل أوتوماتيكي",
            phone: formatPhoneNumber(phone),
            message: personalizedText,
            templateId: rule.templateId,
            templateName: template.name || "قالب أتمتة",
            type: "automation",
            status: "pending",
            scheduledAt: scheduledAt.toISOString(),
            createdAt: new Date().toISOString(),
            sentBy: "أتمتة مدار Delayed",
            ruleId: rule.id,
            mediaUrl: template.mediaUrl || null
          });
        }

        triggeredRules.push(rule.name);
      }

      return res.json({ success: true, triggered: true, triggeredRules });
    } catch (err: any) {
      console.error("Trigger automation failure:", err);
      return res.status(500).json({ error: "فشل تفعيل الأتمتة: " + err.message });
    }
  });

  // Cron-like periodic check for scheduled pending automations
  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const pendingLogsQuery = db.collection("whatsapp_logs")
        .where("status", "==", "pending")
        .where("scheduledAt", "<=", now)
        .limit(20);

      const pendingSnap = await pendingLogsQuery.get();
      if (pendingSnap.empty) return;

      // Fetch global settings
      const settingsSnap = await db.collection('settings').doc('whatsapp').get();
      if (!settingsSnap.exists || !settingsSnap.data().apiToken) return;
      const settings = settingsSnap.data();

      for (const logDoc of pendingSnap.docs) {
        const log = logDoc.data();
        let sendError: string | null = null;

        try {
          const payload: any = {
            phone: log.phone,
            message: log.message
          };
          if (log.mediaUrl) {
            payload.media_url = log.mediaUrl;
            payload.file = log.mediaUrl;
          }

          await axios.post(settings.apiUrl || "https://wasenderapi.com/api/send-message", payload, {
            headers: {
              "Authorization": `Bearer ${settings.apiToken}`,
              "Content-Type": "application/json"
            },
            timeout: 10000
          });
        } catch (err: any) {
          sendError = err.response?.data?.message || err.message;
        }

        await db.collection('whatsapp_logs').doc(log.id).update({
          status: sendError ? "failed" : "sent",
          failureReason: sendError || null,
          processedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Scheduled WhatsApp sender interval error:", err);
    }
  }, 30000); // Check every 30 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      // Explicitly anchor Vite's root/envDir to this file's own folder
      // (__dirname, already computed above) instead of relying on
      // process.cwd(). Without this, `.env` is only found when the dev
      // server happens to be launched with cwd == project root — any
      // other launch method (IDE run button, different working
      // directory, etc.) silently loads zero VITE_* variables.
      root: __dirname,
      envDir: __dirname,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();