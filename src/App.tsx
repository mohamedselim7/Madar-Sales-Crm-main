/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Layout } from "@/src/components/Layout";
import { HomePage } from "@/src/pages/Home";
import { TelesalesHubPage } from "@/src/pages/TelesalesHub";
import { TelesalesAgentPage } from "@/src/pages/TelesalesAgent";
import { SalesHubPage } from "@/src/pages/SalesHub";
import { SalesAgentPage } from "@/src/pages/SalesAgent";
import { SettingsPage } from "@/src/pages/Settings";
import { WebsiteAnalysisPage } from "@/src/pages/WebsiteAnalysis";
import { ShareAnalysis } from "@/src/pages/ShareAnalysis";
import { SalesToolsPage } from "@/src/pages/SalesTools";
import WhatsAppAutomation from "@/src/pages/WhatsAppAutomation";

import { useUserRole } from "@/src/hooks/useUserRole";

export default function App() {
  const { allowedPages, loading: roleLoading } = useUserRole();
  const [activePage, setActivePage] = useState("home");
  const [activeSection, setActiveSection] = useState("main");

  // Reset section when changing page
  const handlePageChange = (page: string) => {
    setActivePage(page);
    setActiveSection("main");
  };

  const allowedPagesKey = allowedPages?.join(",") || "";

  // Redirect if current page not allowed
  React.useEffect(() => {
    if (!roleLoading && allowedPages.length > 0) {
      if (!allowedPages.includes(activePage)) {
        setActivePage(allowedPages[0]);
      }
    }
  }, [roleLoading, allowedPagesKey, activePage]);

  // Global browser protection (Inspect element and View Source disable)
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+Shift+I / Cmd+Opt+I (Developer tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.keyCode === 73)) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+Shift+C / Cmd+Opt+C (Element inspector)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c" || e.keyCode === 67)) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+Shift+J / Cmd+Opt+J (Console window)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j" || e.keyCode === 74)) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+U / Cmd+Opt+U (View HTML source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u" || e.keyCode === 85)) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+S / Cmd+S (Save page locally)
      if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s" || e.keyCode === 83)) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    // Keep console cleared from inspection logs
    const consoleWarningInterval = setInterval(() => {
      console.clear();
      console.log(
        "%cتنبيه أمني - MADAR SALES CRM",
        "color: #ef4444; font-size: 24px; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,0.2);"
      );
      console.log(
        "%cفحص الكود البرمجي وحماية البيانات مشفّرة ومحمية بالكامل. يُمنع التعديل أو استعراض البيانات دون إذن لوحة الإدارة.",
        "color: #38bdf8; font-size: 14px; font-weight: bold;"
      );
    }, 2000);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      clearInterval(consoleWarningInterval);
    };
  }, []);

  if (roleLoading) return null;

  // Check for shared link
  const path = window.location.pathname;
  if (path.startsWith("/share/analysis/")) {
    const aiId = path.split("/").pop();
    if (aiId) return <ShareAnalysis analysisId={aiId} />;
  }

  return (
    <Layout 
      activeTab={activePage} 
      setActiveTab={handlePageChange}
    >
      {activePage === "home" && <HomePage setActiveTab={handlePageChange} />}
      {activePage === "telesales" && <TelesalesHubPage />}
      {activePage === "telesales_agent" && <TelesalesAgentPage />}
      {activePage === "sales_agent" && <SalesAgentPage />}
      {activePage === "sales_hub" && <SalesHubPage />}
      {activePage === "sales_tools" && <SalesToolsPage />}
      {activePage === "whatsapp_automation" && <WhatsAppAutomation />}
      {activePage === "settings" && <SettingsPage />}
    </Layout>
  );
}
