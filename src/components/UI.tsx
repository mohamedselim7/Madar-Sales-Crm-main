import React from "react";
import { cn } from "@/src/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glass?: boolean;
  interactive?: boolean;
  scaleHover?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  glass = true, 
  interactive = true,
  scaleHover = true,
  ...props 
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl relative overflow-hidden group/card",
        glass 
          ? "glass-panel" 
          : "bg-white border-slate-100 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="relative z-20 h-full w-full">
        {children}
      </div>
    </div>
  );
};

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ElementType }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  dark?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className, dark }) => {
  return (
    <div className={cn(
      "flex flex-nowrap overflow-x-auto no-scrollbar gap-2 p-1.5 rounded-2xl max-w-full backdrop-blur-md transition-all duration-500", 
      dark 
        ? "bg-slate-950/30 border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,35,0.05),0_8px_32px_rgba(0,0,0,0.3)]" 
        : "bg-slate-100",
      className
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 relative select-none cursor-pointer shrink-0 whitespace-nowrap",
              isActive
                ? (dark 
                    ? "bg-gradient-to-r from-sky-400/15 to-blue-500/15 text-sky-450 border border-sky-400/25 shadow-[0_0_20px_rgba(56,189,248,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] text-shadow-sky transform scale-[1.01]" 
                    : "bg-white text-sky-600 shadow-sm")
                : (dark 
                    ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200")
            )}
          >
            {Icon && <Icon size={18} className={cn("transition-transform duration-300", isActive && "scale-110")} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { dark?: boolean }>(
  ({ className, type, dark, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          dark && "glass-input",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { dark?: boolean }>(
  ({ className, children, dark, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition-all duration-200 appearance-none bg-[url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2338bdf8%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\")] bg-[length:16px_16px] bg-[position:left_14px_center] bg-no-repeat pl-10 pr-4 cursor-pointer border-l-3 border-l-sky-400",
          dark && "glass-input [color-scheme:dark]",
          className
        )}
        style={dark ? { colorScheme: "dark" } : undefined}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps & { variant?: "primary" | "secondary" | "danger" | "ghost", loading?: boolean, icon?: React.ElementType }>(
  ({ className, size = "md", variant = "primary", loading, icon: Icon, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-sm font-bold ring-offset-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-6 py-2 shadow-lg active:scale-[0.98] gap-2 cursor-pointer",
          variant === "primary" && "bg-gradient-to-r from-sky-400 to-blue-500 text-white hover:brightness-110 shadow-lg shadow-sky-500/15 border border-sky-400/20 hover:scale-[1.02]",
          variant === "secondary" && "bg-white/[0.04] backdrop-blur-md text-slate-200 border border-white/10 hover:bg-white/[0.08] hover:scale-[1.02] shadow-none",
          variant === "danger" && "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:scale-[1.02] shadow-none",
          variant === "ghost" && "bg-transparent text-slate-400 hover:text-white shadow-none border-none hover:bg-white/[0.02] active:scale-[0.98]",
          size === "sm" && "h-10 px-4 text-xs",
          size === "lg" && "h-16 px-12 text-xl",
          className
        )}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          Icon && <Icon size={size === "lg" ? 22 : 18} />
        )}
        {children}
      </button>
    );
  }
);

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, size = "md" }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative h-full glass-panel-heavy border-r border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-left duration-500",
        size === "md" && "w-full max-w-md",
        size === "lg" && "w-full max-w-2xl",
        size === "xl" && "w-full max-w-4xl"
      )}>
        <div className="p-8 border-b border-white/[0.05] flex items-center justify-between">
           <h3 className="text-xl font-black text-white text-shadow-sky">{title}</h3>
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-xl">
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-panel-heavy border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
           <h3 className="text-lg font-black text-white text-shadow-sky">{title}</h3>
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-xl">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string, dark?: boolean }>(
  ({ className, label, dark, ...props }, ref) => {
    return (
      <label className="flex items-center gap-3 cursor-pointer group select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="peer sr-only"
            ref={ref}
            {...props}
          />
          <div className={cn(
            "w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center",
            dark 
              ? "border-white/10 bg-white/5 peer-checked:bg-sky-500 peer-checked:border-sky-500" 
              : "border-slate-200 bg-white peer-checked:bg-sky-500 peer-checked:border-sky-500"
          )}>
            <svg 
              className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={4}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        {label && (
          <span className={cn(
            "text-sm font-semibold transition-colors",
            dark ? "text-slate-400 group-hover:text-slate-200" : "text-slate-600 group-hover:text-slate-900"
          )}>
            {label}
          </span>
        )}
      </label>
    );
  }
);

export const Progress: React.FC<{ value: number, className?: string }> = ({ value, className }) => {
  return (
    <div className={cn("h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden", className)}>
      <div 
        className="h-full bg-sky-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

export interface InteractiveBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const InteractiveBanner: React.FC<InteractiveBannerProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#020b22] via-[#051139] to-[#0d1e4a] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] p-10 md:p-14 group/banner",
        className
      )}
      {...props}
    >
      <div className="relative z-20 h-full w-full">
        {children}
      </div>
    </div>
  );
};
