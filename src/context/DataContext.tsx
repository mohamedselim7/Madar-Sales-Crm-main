import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, convertTimestamps } from "@/src/lib/firebase";
import { useAuth } from "@/src/context/AuthContext";
import { TelesalesLead, SalesLead, Client } from "@/src/types";

// ---------------------------------------------------------------------------
// Data Layer — fetches telesales leads / sales leads / clients. Nothing else.
// This file has NO knowledge of settings, roles, or filtering. It does not
// import SettingsContext or RoleContext, and nothing in the Settings/Role
// layer imports this file back — so a circular dependency is structurally
// impossible here.
// ---------------------------------------------------------------------------

interface DataContextType {
  telesalesLeads: TelesalesLead[];
  telesalesLoading: boolean;
  salesLeads: SalesLead[];
  salesLoading: boolean;
  clients: Client[];
  clientsLoading: boolean;
  error: string | null;

  addTelesalesLead: (lead: Omit<TelesalesLead, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateTelesalesLead: (id: string, updates: Partial<TelesalesLead>) => Promise<void>;
  deleteTelesalesLead: (id: string, hardDelete?: boolean) => Promise<void>;
  restoreTelesalesLead: (id: string) => Promise<void>;

  addSalesLead: (lead: Omit<SalesLead, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateSalesLead: (id: string, updates: Partial<SalesLead>) => Promise<void>;
  deleteSalesLead: (id: string, hardDelete?: boolean) => Promise<void>;
  restoreSalesLead: (id: string) => Promise<void>;

  addClient: (client: Omit<Client, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  progress: number;
  loadingMessage: string;
  isInitialLoadComplete: boolean;
  isQuotaExceeded: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // ONLY external dependency

  const [telesalesLeads, setTelesalesLeads] = useState<TelesalesLead[]>([]);
  const [telesalesLoading, setTelesalesLoading] = useState(true);

  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  const [progress, setProgress] = useState(100);
  const [loadingMessage, setLoadingMessage] = useState("بدء الاتصال بالخادم...");
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(true);

  useEffect(() => {
    if (!user) {
      setTelesalesLeads([]);
      setSalesLeads([]);
      setClients([]);
      setTelesalesLoading(true);
      setSalesLoading(true);
      setClientsLoading(true);
      setProgress(0);
      setIsInitialLoadComplete(true);
      setIsQuotaExceeded(false);
      return;
    }

    setLoadingMessage("جاري الاتصال بقاعدة البيانات...");
    setProgress(15);

    const isQuotaError = (err: any) => {
      const msg = err?.message || err?.error || "";
      return msg.includes("Quota exceeded") || msg.includes("quota") || err?.code === "resource-exhausted";
    };

    const qTelesales = query(collection(db, "telesales_leads"), orderBy("createdAt", "desc"));
    const unsubTelesales = onSnapshot(
      qTelesales,
      (snapshot) => {
        setTelesalesLeads(snapshot.docs.map((d) => convertTimestamps<TelesalesLead>({ id: d.id, ...d.data() })));
        setTelesalesLoading(false);
      },
      (err) => {
        if (isQuotaError(err)) setIsQuotaExceeded(true);
        handleFirestoreError(err, OperationType.LIST, "telesales_leads");
        setTelesalesLoading(false);
      }
    );

    const qSales = query(collection(db, "sales_leads"), orderBy("createdAt", "desc"));
    const unsubSales = onSnapshot(
      qSales,
      (snapshot) => {
        setSalesLeads(snapshot.docs.map((d) => convertTimestamps<SalesLead>({ id: d.id, ...d.data() })));
        setSalesLoading(false);
      },
      (err) => {
        if (isQuotaError(err)) setIsQuotaExceeded(true);
        handleFirestoreError(err, OperationType.LIST, "sales_leads");
        setSalesLoading(false);
      }
    );

    const qClients = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const unsubClients = onSnapshot(
      qClients,
      (snapshot) => {
        setClients(snapshot.docs.map((d) => convertTimestamps<Client>({ id: d.id, ...d.data() })));
        setClientsLoading(false);
      },
      (err) => {
        if (isQuotaError(err)) setIsQuotaExceeded(true);
        handleFirestoreError(err, OperationType.LIST, "clients");
        setClientsLoading(false);
      }
    );

    return () => {
      unsubTelesales();
      unsubSales();
      unsubClients();
    };
  }, [user]);

  // Smooth loading progress estimator (now only tracks the 3 streams this context owns)
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const totalStreams = 3;
    const activeLoadingStreams = (telesalesLoading ? 1 : 0) + (salesLoading ? 1 : 0) + (clientsLoading ? 1 : 0);
    const loadedRatio = (totalStreams - activeLoadingStreams) / totalStreams;
    const targetProgress = Math.round(15 + loadedRatio * 85);

    let message = "جاري الاتصال الآمن بالخادم...";
    if (telesalesLoading) message = "مزامنة قسم التيلي سيلز وقوائم الاتصالات...";
    else if (salesLoading) message = "جاري تحميل وتحديث ليدز المبيعات الفعالة...";
    else if (clientsLoading) message = "تحميل سجلات وبيانات العملاء والتعاقدات...";
    else message = "اكتملت مزامنة البيانات بالكامل بنجاح!";
    setLoadingMessage(message);

    const tick = () => {
      setProgress((prev) => {
        if (targetProgress > prev) return Math.min(prev + 2, targetProgress);
        if (99 > prev && activeLoadingStreams > 0) return prev + 0.1;
        return prev;
      });
      timer = setTimeout(tick, 30);
    };
    tick();

    if (activeLoadingStreams === 0 || isQuotaExceeded) {
      setProgress(100);
      const finishTimer = setTimeout(() => setIsInitialLoadComplete(true), 500);
      return () => { clearTimeout(timer); clearTimeout(finishTimer); };
    }
    return () => clearTimeout(timer);
  }, [user, telesalesLoading, salesLoading, clientsLoading, isQuotaExceeded]);

  // ---- Telesales leads CRUD ----
  const addTelesalesLead = async (lead: Omit<TelesalesLead, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    const tempId = `temp_ts_${Date.now()}`;
    const payload = { ...lead, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as TelesalesLead;
    setTelesalesLeads(prev => [payload, ...prev]);
    try {
      const docRef = await addDoc(collection(db, "telesales_leads"), { ...lead, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setTelesalesLeads(prev => prev.map(item => item.id === tempId ? { ...item, id: docRef.id } : item));
      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, "telesales_leads");
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
      return tempId;
    }
  };

  const updateTelesalesLead = async (id: string, updates: any) => {
    setTelesalesLeads(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
    try {
      await updateDoc(doc(db, "telesales_leads", id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `telesales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  const deleteTelesalesLead = async (id: string, hardDelete: boolean = false) => {
    if (hardDelete) {
      setTelesalesLeads(prev => prev.filter(item => item.id !== id));
    } else {
      setTelesalesLeads(prev => prev.map(item => item.id === id ? { ...item, isSystemDeleted: true, deletedAt: new Date().toISOString() } : item));
    }
    try {
      const ref = doc(db, "telesales_leads", id);
      if (hardDelete) await deleteDoc(ref);
      else await updateDoc(ref, { isSystemDeleted: true, deletedAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `telesales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  const restoreTelesalesLead = async (id: string) => {
    setTelesalesLeads(prev => prev.map(item => item.id === id ? { ...item, isSystemDeleted: false, deletedAt: null } : item));
    try {
      await updateDoc(doc(db, "telesales_leads", id), { isSystemDeleted: false, deletedAt: null });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `telesales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  // ---- Sales leads CRUD ----
  const addSalesLead = async (lead: Omit<SalesLead, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    const tempId = `temp_sl_${Date.now()}`;
    const payload = { ...lead, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as SalesLead;
    setSalesLeads(prev => [payload, ...prev]);
    try {
      const docRef = await addDoc(collection(db, "sales_leads"), { ...lead, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setSalesLeads(prev => prev.map(item => item.id === tempId ? { ...item, id: docRef.id } : item));
      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, "sales_leads");
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
      return tempId;
    }
  };

  const updateSalesLead = async (id: string, updates: any) => {
    setSalesLeads(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
    try {
      await updateDoc(doc(db, "sales_leads", id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `sales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  const deleteSalesLead = async (id: string, hardDelete: boolean = false) => {
    if (hardDelete) {
      setSalesLeads(prev => prev.filter(item => item.id !== id));
    } else {
      setSalesLeads(prev => prev.map(item => item.id === id ? { ...item, isSystemDeleted: true, deletedAt: new Date().toISOString() } : item));
    }
    try {
      const ref = doc(db, "sales_leads", id);
      if (hardDelete) await deleteDoc(ref);
      else await updateDoc(ref, { isSystemDeleted: true, deletedAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `sales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  const restoreSalesLead = async (id: string) => {
    setSalesLeads(prev => prev.map(item => item.id === id ? { ...item, isSystemDeleted: false, deletedAt: null } : item));
    try {
      await updateDoc(doc(db, "sales_leads", id), { isSystemDeleted: false, deletedAt: null });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `sales_leads/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  // ---- Clients CRUD ----
  const addClient = async (client: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    const tempId = `temp_cl_${Date.now()}`;
    const payload = { ...client, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Client;
    setClients(prev => [payload, ...prev]);
    try {
      const docRef = await addDoc(collection(db, "clients"), { ...client, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setClients(prev => prev.map(item => item.id === tempId ? { ...item, id: docRef.id } : item));
      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, "clients");
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
      return tempId;
    }
  };

  const updateClient = async (id: string, updates: any) => {
    setClients(prev => prev.map(item => {
      if (item.id !== id) return item;
      const cloned = JSON.parse(JSON.stringify(item));
      Object.keys(updates).forEach(key => {
        if (key.includes(".")) {
          const parts = key.split(".");
          let current = cloned;
          parts.slice(0, -1).forEach(part => { if (!current[part]) current[part] = {}; current = current[part]; });
          current[parts[parts.length - 1]] = updates[key];
        } else {
          cloned[key] = updates[key];
        }
      });
      cloned.updatedAt = new Date().toISOString();
      return cloned;
    }));
    try {
      await updateDoc(doc(db, "clients", id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `clients/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  const deleteClient = async (id: string) => {
    setClients(prev => prev.filter(item => item.id !== id));
    try {
      await deleteDoc(doc(db, "clients", id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `clients/${id}`);
      if (err?.code === "resource-exhausted") setIsQuotaExceeded(true);
    }
  };

  return (
    <DataContext.Provider
      value={{
        telesalesLeads, telesalesLoading,
        salesLeads, salesLoading,
        clients, clientsLoading,
        error,
        progress, loadingMessage, isInitialLoadComplete, isQuotaExceeded,
        addTelesalesLead, updateTelesalesLead, deleteTelesalesLead, restoreTelesalesLead,
        addSalesLead, updateSalesLead, deleteSalesLead, restoreSalesLead,
        addClient, updateClient, deleteClient,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
