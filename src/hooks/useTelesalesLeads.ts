import { useMemo } from "react";
import { useData } from "@/src/context/DataContext";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/context/RoleContext";
import { TelesalesLead } from "@/src/types";
import { sendSystemNotification } from "@/src/utils/notifications";
import axios from "axios";

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export function useTelesalesLeads() {
  const { 
    telesalesLeads: allLeads, 
    telesalesLoading: loading, 
    error,
    addTelesalesLead,
    updateTelesalesLead,
    deleteTelesalesLead,
    restoreTelesalesLead
  } = useData();
  const { user } = useAuth();
  const { memberInfo, isAdmin, allowedPages } = useUserRole();

  // Data-scoping is based on the SAME signal that already grants access to
  // the Tele Sales management page ("إدارة قسم التيلي سيلز", allowedPages
  // includes "telesales") — not on a "manager" role or a
  // TeamMember.managerId link, neither of which the Settings/Team UI ever
  // actually sets. Anyone who can open Tele Sales Department Management
  // manages the whole Tele Sales department (e.g. Nada Nashat, Tele Sales
  // Manager) and should see every telesales_leads document there and in
  // their own Tele Sales Workspace, exactly like the equivalent fix for
  // the Sales Manager role. Everyone else only sees the leads assigned to
  // them (matched by TeamMember id, or by name as a fallback for existing
  // leads assigned before agentId was consistently stamped).
  const canManageTelesalesDept = isAdmin || allowedPages.includes("telesales");

  const leads = useMemo(() => {
    if (canManageTelesalesDept) return allLeads;

    const myId = memberInfo?.id;
    const myName = norm(memberInfo?.name || user?.displayName || user?.email?.split("@")[0]);

    return allLeads.filter(lead =>
      (!!myId && lead.agentId === myId) ||
      (!!myName && norm(lead.agentName) === myName)
    );
  }, [canManageTelesalesDept, allLeads, memberInfo, user]);

  const addLead = async (newLead: Omit<TelesalesLead, "id" | "createdAt" | "updatedAt">) => {
    try {
      const stampedLead = {
        ...newLead,
        agentId: newLead.agentId || user?.uid || "",
        managerId: newLead.managerId || memberInfo?.managerId || "",
      };
      const createdId = await addTelesalesLead(stampedLead);
      
      await sendSystemNotification({
        title: "ليد مبيعات جديد 📌📞",
        message: `تم إضافة عميل محتمل تيلي سيلز جديد باسم "${newLead.clientName}" بواسطة "${newLead.agentName || "السيستم"}". يلا المتابعة!`,
        type: "lead",
        category: "Telesales",
        triggeredBy: newLead.agentName || "السيستم"
      });

      // Price offer and contract checks on addition
      if (newLead.paymentStatus === "تم تقديم عرض سعر") {
        await sendSystemNotification({
          title: "تقديم عرض سعر جديد 🏷️",
          message: `تم تقديم عرض سعر للعميل "${newLead.clientName}" بواسطة الموظف "${newLead.agentName || "السيستم"}".`,
          type: "success",
          category: "Telesales",
          triggeredBy: newLead.agentName || "السيستم"
        });
      } else if (newLead.paymentStatus === "تم التعاقد" || newLead.isContracted) {
        await sendSystemNotification({
          title: "تعاقد جديد! 🤝🎉",
          message: `مبروك! تم التعاقد مع العميل "${newLead.clientName}" بواسطة الموظف "${newLead.agentName || "السيستم"}" بقيمة ${newLead.contractAmount || 0} ر.س.`,
          type: "success",
          category: "Telesales",
          triggeredBy: newLead.agentName || "السيستم"
        });
      }

      return createdId;
    } catch (err) {
      console.error("Error inside hook adding lead:", err);
    }
  };

  const updateLead = async (id: string, updatedFields: Partial<TelesalesLead>) => {
    try {
      const originalLead = leads.find(l => l.id === id);
      await updateTelesalesLead(id, updatedFields);

      const clientName = updatedFields.clientName || originalLead?.clientName || "أحد العملاء";
      const agentName = updatedFields.agentName || originalLead?.agentName || "السيستم";
      const contractAmt = updatedFields.contractAmount || originalLead?.contractAmount || 0;

      // Check transitions
      const isNowPriceOffer = updatedFields.paymentStatus === "تم تقديم عرض سعر" && originalLead?.paymentStatus !== "تم تقديم عرض سعر";
      const isNowContract = (updatedFields.paymentStatus === "تم التعاقد" && originalLead?.paymentStatus !== "تم التعاقد") || (updatedFields.isContracted === true && originalLead?.isContracted !== true);

      if (isNowPriceOffer) {
        await sendSystemNotification({
          title: "تقديم عرض سعر جديد 🏷️",
          message: `تم تقديم عرض سعر للعميل "${clientName}" بواسطة الموظف "${agentName}".`,
          type: "success",
          category: "Telesales",
          triggeredBy: agentName
        });
      } else if (isNowContract) {
        await sendSystemNotification({
          title: "تعاقد جديد! 🤝🎉",
          message: `مبروك! تم التعاقد مع العميل "${clientName}" بواسطة الموظف "${agentName}" بقيمة ${contractAmt} ر.س.`,
          type: "success",
          category: "Telesales",
          triggeredBy: agentName
        });
      }

      // Trigger notification for status changes
      if (updatedFields.response || updatedFields.firstContactOutcome || updatedFields.meetingStatus) {
        await sendSystemNotification({
          title: "تحديث ليد تيلي سيلز 📞⚙️",
          message: `تم تعديل رد العميل أو حالة المتابعة لـ "${clientName}". النتيجة: ${updatedFields.firstContactOutcome || updatedFields.response || updatedFields.meetingStatus || "تم التعديل"}`,
          type: "lead",
          category: "Telesales",
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
          type: "telesales"
        }).catch(err => console.error("Telesales whatsapp trigger failed:", err));
      }
    } catch (err) {
      console.error("Error inside hook updating lead:", err);
    }
  };

  const deleteLead = async (id: string, hardDelete: boolean = false) => {
    try {
      await deleteTelesalesLead(id, hardDelete);
    } catch (err) {
      console.error("Error inside hook deleting lead:", err);
    }
  };

  const restoreLead = async (id: string) => {
    try {
      await restoreTelesalesLead(id);
    } catch (err) {
      console.error("Error inside hook restoring lead:", err);
    }
  };

  return { leads, loading, error, addLead, updateLead, deleteLead, restoreLead };
}