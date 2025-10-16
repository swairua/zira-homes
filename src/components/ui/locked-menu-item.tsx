import React from "react";
import { Lock, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LockedMenuItemProps {
  children: React.ReactNode;
  isLocked: boolean;
  isPartiallyLocked?: boolean;
  lockMessage?: string;
  className?: string;
}

export function LockedMenuItem({ 
  children, 
  isLocked, 
  isPartiallyLocked = false,
  lockMessage = "Upgrade to Pro to access this feature",
  className 
}: LockedMenuItemProps) {
  if (!isLocked && !isPartiallyLocked) {
    return <>{children}</>;
  }

  const LockIcon = isPartiallyLocked ? LockKeyhole : Lock;
  const opacity = isLocked ? "opacity-60" : "opacity-80";
  const iconOpacity = isPartiallyLocked ? "text-warning/70" : "text-muted-foreground/60";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative flex items-center justify-between", opacity, className)}>
            <div className="flex-1">
              {children}
            </div>
            <div className="flex-shrink-0 ml-2">
              <LockIcon className={cn("h-3 w-3", iconOpacity)} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-sm">
            {isPartiallyLocked 
              ? "Some features require Pro plan"
              : lockMessage
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}