import { useData } from "@/src/context/DataContext";

export function useClients() {
  const { 
    clients, 
    clientsLoading, 
    error,
    addClient,
    updateClient,
    deleteClient
  } = useData();
  
  return { 
    clients, 
    loading: clientsLoading, 
    error,
    addClient,
    updateClient,
    deleteClient
  };
}

