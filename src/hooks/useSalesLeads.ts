import { useMemo } from "react";
import { useData } from "@/src/context/DataContext";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/context/RoleContext";
import { SalesLead } from "@/src/types";
import { sendSystemNotification } from "@/src/utils/notifications";
import axios from "axios";

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export function useSalesLeads() {
  const { 
    salesLeads: allLeads, 
    salesLoading: loading, 
    error,
    addSalesLead,
    updateSalesLead,
    deleteSalesLead,
    restoreSalesLead
  } = useData();
  const { user } = useAuth();
  const { memberInfo, isAdmin, allowedPages } = useUserRole();

  // Data-scoping is based on the SAME signal that already grants access to
  // the "Sales Department Management" page (allowedPages includes
  // "sales_hub") — not on a "manager" role or a TeamMember.managerId link,
  // neither of which the Settings/Team UI ever actually sets. Anyone who
  // can open Sales Department Management manages the whole sales
  // department and should see every sales_leads document there and in
  // their own Sales Workspace. Everyone else only sees the leads
  // assigned to them (matched by TeamMember id, or by name as a fallback
  // for existing leads assigned before agentId was consistently stamped).
  const canManageSalesDept = isAdmin || allowedPages.includes("sales_hub");

  const leads = useMemo(() => {
    if (canManageSalesDept) return allLeads;

    const myId = memberInfo?.id;
    const myName = norm(memberInfo?.name || user?.displayName || user?.email?.split("@")[0]);

    return allLeads.filter(lead =>
      (!!myId && lead.agentId === myId) ||
      (!!myName && norm(lead.agentName) === myName)
    );
  }, [canManageSalesDept, allLeads, memberInfo, user]);

  const addLead = async (newLead: Omit<SalesLead, "id" | "createdAt" | "updatedAt">) => {
    try {
      // Stamp the real Firebase Auth uid (not just a display name) so
      // Firestore rules and scopeLeadsToRole can reliably match this lead
      // to its owning agent/manager later.
      const stampedLead = {
        ...newLead,
        agentId: newLead.agentId || user?.uid || "",
        managerId: newLead.managerId || memberInfo?.managerId || "",
      };
      const createdId = await addSalesLead(stampedLead);

      await sendSystemNotification({
        title: "ده ليد سيلز جديد نار! 🔥🚀",
        message: `تم إضافة أو ترقية ليد مبيعات جديد باسم "${newLead.clientName}" لشركة "${newLead.field || "مجال استراتيجي"}". يلا المتابعة يا وحش!`,
        type: "lead",
        category: "Sales Hub",
        triggeredBy: newLead.agentName || "السيستم"
      });

      // Price offer and contract checks on addition
      const isPriceOffer = newLead.response === "تم تقديم عرض السعر" || newLead.response === "تم تقديم عرض سعر" || (newLead as any).paymentStatus === "تم تقديم عرض سعر";
      const isContract = newLead.isContracted === true || (newLead as any).paymentStatus === "تم التعاقد";

      if (isPriceOffer) {
        await sendSystemNotification({
          title: "تقديم عرض سعر جديد 🏷️",
          message: `تم تقديم عرض سعر للعميل "${newLead.clientName}" بواسطة الموظف "${newLead.agentName || "السيستم"}".`,
          type: "success",
          category: "Sales Hub",
          triggeredBy: newLead.agentName || "السيستم"
        });
      } else if (isContract) {
        await sendSystemNotification({
          title: "تعاقد جديد! 🤝🎉",
          message: `مبروك! تم التعاقد مع العميل "${newLead.clientName}" بواسطة الموظف "${newLead.agentName || "السيستم"}" بقيمة ${newLead.contractAmount || 0} ر.س.`,
          type: "success",
          category: "Sales Hub",
          triggeredBy: newLead.agentName || "السيستم"
        });
      }

      return createdId;
    } catch (err) {
      console.error("Error inside hook adding sales lead:", err);
    }
  };

  const updateLead = async (id: string, updatedFields: Partial<SalesLead>) => {
    try {
      const originalLead = leads.find(l => l.id === id);
      await updateSalesLead(id, updatedFields);

      const clientName = updatedFields.clientName || originalLead?.clientName || "أحد العملاء";
      const agentName = updatedFields.agentName || originalLead?.agentName || "السيستم";
      const contractAmt = updatedFields.contractAmount || originalLead?.contractAmount || 0;

      // Check transitions
      const isPriceOfferResponse = (updatedFields.response === "تم تقديم عرض السعر" || updatedFields.response === "تم تقديم عرض سعر") && 
        (originalLead?.response !== "تم تقديم عرض السعر" && originalLead?.response !== "تم تقديم عرض سعر");
      const isPriceOfferPayment = (updatedFields as any).paymentStatus === "تم تقديم عرض سعر" && (originalLead as any)?.paymentStatus !== "تم تقديم عرض سعر";
      const isNowPriceOffer = isPriceOfferResponse || isPriceOfferPayment;

      const isContractedField = updatedFields.isContracted === true && originalLead?.isContracted !== true;
      const isContractedPayment = (updatedFields as any).paymentStatus === "تم التعاقد" && (originalLead as any)?.paymentStatus !== "تم التعاقد";
      const isNowContract = isContractedField || isContractedPayment;

      if (isNowPriceOffer) {
        await sendSystemNotification({
          title: "تقديم عرض سعر جديد 🏷️",
          message: `تم تقديم عرض سعر للعميل "${clientName}" بواسطة الموظف "${agentName}".`,
          type: "success",
          category: "Sales Hub",
          triggeredBy: agentName
        });
      } else if (isNowContract) {
         await sendSystemNotification({
          title: "تعاقد جديد! 🤝🎉",
          message: `مبروك! تم التعاقد مع العميل "${clientName}" بواسطة الموظف "${agentName}" بقيمة ${contractAmt} ر.س.`,
          type: "success",
          category: "Sales Hub",
          triggeredBy: agentName
        });
      }

      // Trigger notification for state edits
      if (updatedFields.response || updatedFields.firstContactOutcome || updatedFields.meetingStatus) {
        await sendSystemNotification({
          title: "تحديث ليد السيلز هاب 📈✨",
          message: `تم تحديث ليد المبيعات لـ "${clientName}". الحالة الجديدة: ${updatedFields.meetingStatus || updatedFields.firstContactOutcome || updatedFields.response || "معدّل"}`,
          type: "lead",
          category: "Sales Hub",
          triggeredBy: agentName
        });
      }

      // Trigger WhatsApp Status Automation Rules
      if (updatedFields.response && updatedFields.response !== originalLead?.response) {
        axios.post("/api/whatsapp/trigger-status-automation", {
          clientId: id,
          clientName: clientName,
          phone: updatedFields.phone || originalLead?.phone || "",
          status: updatedFields.response,
          type: "sales"
        }).catch(err => console.error("Sales whatsapp trigger failed:", err));
      }
    } catch (err) {
      console.error("Error inside hook updating sales lead:", err);
    }
  };

  const deleteLead = async (id: string, hardDelete: boolean = false) => {
    try {
      await deleteSalesLead(id, hardDelete);
    } catch (err) {
      console.error("Error inside hook deleting sales lead:", err);
    }
  };

  const restoreLead = async (id: string) => {
    try {
      await restoreSalesLead(id);
    } catch (err) {
      console.error("Error inside hook restoring sales lead:", err);
    }
  };

  return { leads, loading, error, addLead, updateLead, deleteLead, restoreLead };
}
