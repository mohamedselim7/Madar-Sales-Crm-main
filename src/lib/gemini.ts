import { GoogleGenAI, Type } from "@google/genai";

/**
 * Gemini AI Service
 * Handles communication with Google's Generative AI using the modern @google/genai SDK
 */

export async function analyzeWebsiteWithAI(apiKey: string, crawledData: any) {
  const geminiKey = process.env.GEMINI_API_KEY || apiKey;
  if (!geminiKey) {
    throw new Error("يرجى ضبط مفتاح API في صفحة الإعدادات أو التأكد من توفر مفتاح النظام.");
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = `
    You are a professional website audit expert. 
    Analyze ONLY the extracted website data below for the URL: ${crawledData.url}
    
    EXTRACTED DATA:
    ${JSON.stringify(crawledData, null, 2)}

    CRITICAL INSTRUCTIONS:
    1. Analyze ONLY the provided data. Do NOT assume anything not present.
    2. Do NOT invent metrics such as traffic numbers, revenue, search rankings, or specific speed milliseconds if they are not in the data.
    3. If data is missing for a specific insight, say: "غير متوفر من البيانات المقروءة".
    4. Every recommendation MUST be based on evidence from the extracted data (e.g., if you recommend adding a CTA, it must be because the data shows few or weak CTAs).
    5. Provide a realistic expert audit based on these real findings.
    6. All text content must be in Arabic.
    
    Structure your response according to the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessField: { type: Type.STRING },
            platform: { type: Type.STRING },
            overallScore: { type: Type.NUMBER },
            subScores: {
              type: Type.OBJECT,
              properties: {
                ux: { type: Type.NUMBER },
                cro: { type: Type.NUMBER },
                seo: { type: Type.NUMBER },
                speed: { type: Type.NUMBER },
                trust: { type: Type.NUMBER },
                content: { type: Type.NUMBER },
                structure: { type: Type.NUMBER }
              },
              required: ["ux", "cro", "seo", "speed", "trust", "content", "structure"]
            },
            criticalProblems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  problem: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ["problem", "impact", "priority"]
              }
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
            monthlyImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
            longTermOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
            revenueOpportunities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  insight: { type: Type.STRING },
                  potentialGrowth: { type: Type.STRING }
                },
                required: ["insight", "potentialGrowth"]
              }
            },
            technicalAudit: {
              type: Type.OBJECT,
              properties: {
                speed: { type: Type.STRING },
                seo: { type: Type.STRING },
                errors: { type: Type.STRING },
                mobile: { type: Type.STRING }
              },
              required: ["speed", "seo", "errors", "mobile"]
            },
            marketInsights: { type: Type.STRING },
            recommendations: { type: Type.STRING }
          },
          required: [
            "businessField", "platform", "overallScore", "subScores", "criticalProblems", 
            "quickWins", "monthlyImprovements", "longTermOpportunities", 
            "revenueOpportunities", "technicalAudit", "marketInsights", "recommendations"
          ]
        }
      }
    });

    const text = response.text;
    if (text) {
      // Remove possible markdown formatting if the model decided to wrap JSON in backticks
      const cleanJson = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanJson);
    }
    throw new Error("فشل في معالجة استجابة الذكاء الاصطناعي.");
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    // Extract more detail from the error if available
    const errorMsg = error?.message || "حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.";
    throw new Error(errorMsg);
  }
}

export async function analyzeSocialMediaWithAI(apiKey: string, data: any) {
  const geminiKey = process.env.GEMINI_API_KEY || apiKey;
  if (!geminiKey) {
    throw new Error("يرجى ضبط مفتاح API في صفحة الإعدادات أو التأكد من توفر مفتاح النظام.");
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = `
    You are a high-level Social Media Strategy Expert (MADAR SALES CRM AI Engine).
    Analyze the following REAL data crawled from the client's platforms.

    CLIENT INFO:
    Business: ${data.client.business}
    Category: ${data.client.category}
    Brief: ${data.client.brief}

    CRAWLED SOCIAL DATA:
    ${JSON.stringify(data.crawledData, null, 2)}

    MANDATORY RULES:
    1. STRICT DATA ADHERENCE: Use ONLY the numbers (followers, posts, etc.) found in the crawled data. If a platform is "BLOCKED", acknowledge it and count it as a visibility/technical issue.
    2. NO HALLUCINATION: Do NOT invent engagement rates, exact follower counts for blocked platforms, or specific post dates not present.
    3. LANGUAGE: All output text (findings, recommendations, plans) MUST be in PROFESSIONALLY formatted ARABIC.
    4. TONE: Bold, critical, and strategic.

    ANALYSIS REQUIREMENTS:
    - overallScore: Out of 100.
    - platformsData: An object where keys are platform names (instagram, tiktok, facebook, youtube, twitter, snapchat), and values include:
        - followersCount: string (e.g., "1.2M", "500")
        - totalPosts: string
        - dailyPostAverage: string
        - totalLikes: string
        - avgLikesPerPost: string
        - photoToVideoRatio: string (e.g. "70/30")
    - contentBreakdown: Percentages based on observed themes in bio/titles/descriptions.
    - criticalProblems: Real strategic gaps (e.g., "Missing clear CTA in Instagram bio", "No active presence on TikTok despite target audience being Gen Z").
    - quickWins: Practical fixes.
    - thirtyDayPlan: Practical campaign ideas and posting plan.

    Output the analysis in JSON format according to the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            subScores: {
              type: Type.OBJECT,
              properties: {
                contentQuality: { type: Type.NUMBER },
                consistency: { type: Type.NUMBER },
                branding: { type: Type.NUMBER },
                engagement: { type: Type.NUMBER },
                conversionReadiness: { type: Type.NUMBER }
              },
              required: ["contentQuality", "consistency", "branding", "engagement", "conversionReadiness"]
            },
            platformsData: {
              type: Type.OBJECT,
              properties: {
                instagram: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                },
                tiktok: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                },
                facebook: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                },
                youtube: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                },
                twitter: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                },
                snapchat: {
                  type: Type.OBJECT,
                  properties: {
                    followersCount: { type: Type.STRING },
                    totalPosts: { type: Type.STRING },
                    dailyPostAverage: { type: Type.STRING },
                    totalLikes: { type: Type.STRING },
                    avgLikesPerPost: { type: Type.STRING },
                    photoToVideoRatio: { type: Type.STRING }
                  }
                }
              }
            },
            contentBreakdown: {
              type: Type.OBJECT,
              properties: {
                educational: { type: Type.NUMBER },
                promotional: { type: Type.NUMBER },
                entertainment: { type: Type.NUMBER },
                missing: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["educational", "promotional", "entertainment", "missing"]
            },
            criticalProblems: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  finding: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  recommendation: { type: Type.STRING }
                },
                required: ["finding", "evidence", "priority", "recommendation"]
              } 
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
            thirtyDayPlan: {
              type: Type.OBJECT,
              properties: {
                postingPlan: { type: Type.STRING },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                campaignIdeas: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["postingPlan", "recommendations", "campaignIdeas"]
            }
          },
          required: ["overallScore", "subScores", "platformsData", "contentBreakdown", "criticalProblems", "quickWins", "thirtyDayPlan"]
        }
      }
    });

    // Handle newer SDK response pattern
    const text = response.text || (response as any).text?.();
    if (text) {
      const cleanJson = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanJson);
    }
    throw new Error("فشل في معالجة استجابة الذكاء الاصطناعي.");
  } catch (error: any) {
    console.error("Social AI Analysis Error:", error);
    throw new Error(error?.message || "حدث خطأ أثناء تحليل السوشيال ميديا.");
  }
}
