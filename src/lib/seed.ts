import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const SEED_DATA = {
  serviceTypes: [
    { id: "1", name: "إدارة حسابات" },
    { id: "2", name: "ميديا باينج" },
    { id: "3", name: "SEO" },
    { id: "4", name: "باقة شاملة" },
    { id: "5", name: "تصميمات" },
    { id: "6", name: "مواقع" },
  ],
  paymentMethods: [
    { id: "1", name: "كاش" },
    { id: "2", name: "تحويل بنكي" },
    { id: "3", name: "فيزا" },
    { id: "4", name: "دفعة مقدمة" },
    { id: "5", name: "دفعات شهرية" },
  ],
  currencies: [
    { id: "1", name: "SAR" },
    { id: "2", name: "EGP" },
    { id: "3", name: "USD" },
    { id: "4", name: "AED" },
  ],
  csoList: [{ id: "1", name: "مدير المبيعات الرئيسي" }],
  salesManagers: [{ id: "1", name: "أحمد علي" }],
  salesAgents: [{ id: "1", name: "سارة محمد" }],
  teleSalesManagers: [{ id: "1", name: "ياسين حسن" }],
  teleSalesAgents: [],
  clientStatuses: [
    { id: "1", name: "جديد" },
    { id: "2", name: "تم الاستلام" },
    { id: "3", name: "قيد التجهيز" },
    { id: "4", name: "نشط" },
    { id: "5", name: "متوقف مؤقتًا" },
    { id: "6", name: "ملغي" },
  ],
  accountManagers: [{ id: "1", name: "إيمان عبدالله" }],
  marketingManagers: [{ id: "1", name: "كريم يوسف" }],
  workGroups: [{ id: "1", name: "فريق الإبداع" }],
};

export async function seedSettings() {
  try {
    for (const [key, items] of Object.entries(SEED_DATA)) {
      const docRef = doc(db, "settings", key);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { items });
        console.log(`Seeded ${key}`);
      }
    }
  } catch (error) {
    console.warn("Seeding skipped or failed (likely permissions):", error);
  }
}
