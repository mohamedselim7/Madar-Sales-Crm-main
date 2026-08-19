export enum ClientStage {
  SALES_RECEIVED = "received_from_sales",
  CR_RECEIVED = "cr_received",
  SENT_TO_MARKETING = "sent_to_marketing_manager",
}

export enum TaskStatus {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  DONE = "done",
  CANCELLED = "cancelled",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskDepartment {
  ADS = "Ads",
  SEO = "SEO",
  CONTENT = "Content",
  DESIGN = "Design",
  EDITOR = "Editor",
}

export interface ImportantLink {
  title: string;
  url: string;
}

export interface Client {
  id: string;
  clientCode: string;
  stage: ClientStage;
  contract: {
    startDate: string;
    endDate: string;
    contractAmount: number;
    currency: string;
    paymentMethod: string;
    paidAmount: number;
    remainingAmount: number;
    contractMonths: number;
    monthlyValue: number;
  };
  clientInfo: {
    clientName: string;
    phone: string;
    additionalPhone?: string;
    email: string;
    businessName: string;
    websiteStatus: "exists" | "create" | "not_available";
    websiteUrl?: string;
    additionalStore?: string;
    salesBrief: string;
    serviceType: string;
  };
  salesTeam: {
    cso: string;
    salesManager: string;
    salesAgent: string;
    teleSalesManager: string;
    teleSalesAgent: string;
  };
  crData?: {
    accountManagerBrief?: string;
    workGroupName?: string;
    clientStatus?: string;
    accountManagerName?: string;
    notes?: string;
  };
  marketingData?: {
    marketingManagerName?: string;
    strategyId?: string;
  };
  importantLinks?: ImportantLink[];
  distributedDepartment?: string;
  satisfactionRatings?: {
    date: string;
    rating: number;
    comment?: string;
    period?: string;
  }[];
  updateLog: UpdateLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLogEntry {
  date: string;
  action: string;
  updatedFields: string[];
  oldValue: any;
  newValue: any;
  department?: "SALES" | "CR" | "MARKETING";
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface StrategyCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface MarketingStrategy {
  id: string;
  name: string;
  clientId?: string;
  clientName?: string;
  isTemplate?: boolean;
  finalStrategyLink?: string;
  categories: StrategyCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskLog {
  date: string;
  action: string;
  oldValue: any;
  newValue: any;
  user?: string;
}

export interface Task {
  id: string;
  taskTitle: string;
  taskDescription: string;
  optionalLink?: string;
  department: TaskDepartment;
  clientId: string;
  clientCode: string;
  businessName: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  unread: boolean;
  notes: string;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  uid?: string; // Firebase Auth uid — populated automatically on first login (see AuthContext)
  name: string;
  email?: string;
  role?: "admin" | "manager" | "agent" | string; // "Admin" kept for legacy compatibility
  managerId?: string; // for agents: the TeamMember.id of their manager
  department?: TaskDepartment;
  active: boolean;
  joinDate?: string;
  allowedPages?: string[]; // e.g. ["sales", "cr", "marketing", "team"]
}

export interface SettingItem {
  id: string;
  name: string;
}

export interface APIIntegrations {
  gemini: string;
  whatsapp: string;
  meta: string;
  tiktok: string;
  googleAds: string;
  googleSheets: string;
  smtp: string;
  customApi: string;
}

export interface TelesalesFormSection {
  id: string;
  title: string;
  order: number;
}

export interface TelesalesFormSetting {
  contactTypes: string[];
  responseOptions: string[];
  meetingStatuses: string[];
  dataSources?: string[];
  fieldsOptions?: string[];
  businessTypesOptions?: string[];
  paymentStatuses?: string[];
  sections?: TelesalesFormSection[];
  leadStatuses?: string[];
  decisionMakers?: string[];
  packages?: string[];
  paids?: string[];
  fieldsConfig: {
    [key: string]: {
      label: string;
      visible: boolean;
      required: boolean;
      isCustom?: boolean;
      type?: string;
      sectionId?: string;
      order?: number;
    };
  };
}

export interface TargetSettings {
  telesalesDeptTarget?: number;
  salesDeptTarget?: number;
  salesAgentMonthlyTarget?: number;
  telesalesAgentMonthlyTarget?: number;
}

export interface Settings {
  serviceTypes: SettingItem[];
  paymentMethods: SettingItem[];
  currencies: SettingItem[];
  csoList: SettingItem[];
  salesManagers: SettingItem[];
  salesAgents: SettingItem[];
  teleSalesManagers: SettingItem[];
  teleSalesAgents: SettingItem[];
  clientStatuses: SettingItem[];
  accountManagers: SettingItem[];
  marketingManagers: SettingItem[];
  departments?: SettingItem[];
  workGroups: SettingItem[];
  agentCommissions: AgentCommissionSetting[];
  teamCommissions: TeamCommissionSetting[];
  apiIntegrations?: APIIntegrations;
  telesalesForm?: TelesalesFormSetting;
  salesForm?: TelesalesFormSetting;
  generalSettings?: {
    agencyName: string;
    agencyLogo: string;
    timezone: string;
    dateFormat: string;
    newUserAlertsEnabled?: boolean;
  };
  teamSettings?: {
    adsTeam: TeamMember[];
    seoTeam: TeamMember[];
    contentTeam: TeamMember[];
    designTeam: TeamMember[];
    editorTeam: TeamMember[];
  };
  targets?: TargetSettings;
}

export interface AgentCommissionSetting {
  id: string;
  agentName: string;
  type: "percentage" | "fixed" | "both";
  percentageValue: number;
  fixedValue: number;
  appliesTo: "total" | "collected";
  active: boolean;
}

export interface TeamCommissionSetting {
  id: string;
  position: "CSO" | "Sales Manager" | "Sales Agent" | "Tele Sales Manager" | "Tele Sales Agent";
  personName: string;
  type: "percentage" | "fixed" | "both";
  percentageValue: number;
  fixedValue: number;
  appliesTo: "total" | "collected";
  active: boolean;
}

export interface SystemVersion {
  id: string;
  versionName: string;
  createdAt: string;
  modifiedModules: string[];
  notes: string;
  rollbackAvailable: boolean;
  status: string;
}

export interface TelesalesLead {
  id: string;
  date: string;
  clientName: string;
  phone: string;
  field: string;
  dataSource: string;
  storeLink: string;
  socialLink?: string;
  businessType: string;
  note: string;
  firstContactDate: string;
  contactType: string;
  whatsappMessageText: string;
  response: string;
  firstContactOutcome: string;
  dateFollow: string;
  followUp1?: string;
  followUp2?: string;
  followUp3?: string;
  followUp4?: string;
  telesalesBrief?: string;
  updates?: any;
  meetingStatus: string;
  meetingLink?: string;
  meetingTime?: string;
  agentId: string;
  agentName: string;
  managerId?: string; // Firebase Auth uid of the owning manager, stamped at write-time
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface SalesLead {
  id: string;
  date: string;
  clientName: string;
  phone: string;
  field: string;
  dataSource: string;
  storeLink: string;
  socialLink?: string;
  businessType: string;
  note: string;
  firstContactDate: string;
  contactType: string;
  whatsappMessageText: string;
  response: string;
  firstContactOutcome: string;
  dateFollow: string;
  followUp1?: string;
  followUp2?: string;
  followUp3?: string;
  followUp4?: string;
  telesalesBrief?: string;
  updates?: any;
  meetingStatus: string;
  meetingLink?: string;
  meetingTime?: string;
  agentId: string;
  agentName: string;
  managerId?: string; // Firebase Auth uid of the owning manager, stamped at write-time
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}


