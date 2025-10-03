import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Crown, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";

interface TrialFeatureBadgeProps {
  feature: Feature;
  children: React.ReactNode;
  showTooltip?: boolean;
}

export function TrialFeatureBadge({ 
  feature, 
  children,
  showTooltip = true 
}: TrialFeatureBadgeProps) {
  const navigate = useNavigate();
  const { allowed, plan_name, status, reason } = usePlanFeatureAccess(feature);

  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate("/upgrade");
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!allowed && reason !== 'network_error' && reason !== 'rpc_error' && reason !== 'error') {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // If feature is allowed, show children without badge
  if (allowed || reason === 'network_error' || reason === 'rpc_error' || reason === 'error') {
    return <>{children}</>;
  }

  // Feature locked - show with floating badge
  if (!showTooltip) {
    return (
      <div className="relative inline-block" onClick={handleClick}>
        <div className="opacity-60 pointer-events-none">
          {children}
        </div>
        <Badge 
          variant="outline" 
          className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-primary/30 bg-primary/10 backdrop-blur-sm shadow-sm pointer-events-auto cursor-pointer"
          onClick={handleUpgrade}
        >
          <Crown className="h-2.5 w-2.5" />
          Pro
        </Badge>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="relative inline-block" onClick={handleClick}>
            <div className="opacity-60 pointer-events-none">
              {children}
            </div>
            <Badge 
              variant="outline" 
              className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-primary/30 bg-primary/10 backdrop-blur-sm shadow-sm hover:bg-primary/20 transition-colors pointer-events-auto cursor-pointer z-10"
            >
              <Crown className="h-2.5 w-2.5" />
              Pro
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs p-4 bg-popover border shadow-lg"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="p-1.5 bg-primary/10 rounded">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Premium Feature</h4>
                <p className="text-xs text-muted-foreground">
                  Unlock bulk operations to efficiently manage multiple items at once.
                </p>
              </div>
            </div>
            
            {status === 'trial' && (
              <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded text-xs">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span className="text-purple-900 dark:text-purple-100">
                  Available during trial
                </span>
              </div>
            )}
            
            {plan_name && (
              <p className="text-xs text-muted-foreground">
                Current plan: <span className="font-medium">{plan_name}</span>
              </p>
            )}
            
            <Button 
              size="sm" 
              className="w-full h-8 text-xs"
              onClick={handleUpgrade}
            >
              <Crown className="h-3 w-3 mr-1" />
              Upgrade Now
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
