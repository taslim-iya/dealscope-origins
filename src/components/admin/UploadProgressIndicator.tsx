import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface UploadProgressIndicatorProps {
  mandateId: string;
  isProcessing: boolean;
  estimatedCompanies: number;
  onComplete: () => void;
}

export function UploadProgressIndicator({
  mandateId,
  isProcessing,
  estimatedCompanies,
  onComplete,
}: UploadProgressIndicatorProps) {
  const [initialCount, setInitialCount] = useState<number | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [done, setDone] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const checkProgress = useCallback(async () => {
    const { count } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("mandate_id", mandateId);

    const c = count ?? 0;
    setCurrentCount(c);

    if (initialCount === null) {
      setInitialCount(c);
      return;
    }

    const inserted = c - initialCount;
    // Consider done if we've inserted close to the estimate or if count stopped changing after several polls
    if (inserted >= estimatedCompanies * 0.95 || pollCount > 30) {
      setDone(true);
      onComplete();
    }
  }, [mandateId, initialCount, estimatedCompanies, pollCount, onComplete]);

  useEffect(() => {
    if (!isProcessing) return;

    // Capture initial count immediately
    checkProgress();

    const interval = setInterval(() => {
      setPollCount((p) => p + 1);
      checkProgress();
    }, 3000);

    return () => clearInterval(interval);
  }, [isProcessing, checkProgress]);

  if (!isProcessing && !done) return null;

  const inserted = initialCount !== null ? currentCount - initialCount : 0;
  const progress = estimatedCompanies > 0
    ? Math.min(100, Math.round((inserted / estimatedCompanies) * 100))
    : 0;

  if (done) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Upload complete</p>
          <p className="text-xs text-muted-foreground">
            {inserted.toLocaleString()} companies added successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Processing companies…</p>
          <span className="text-xs text-muted-foreground">
            {inserted.toLocaleString()} / ~{estimatedCompanies.toLocaleString()}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
