import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OutreachRecord } from "./OutreachCRM";

interface OutreachAnalyticsProps {
  records: OutreachRecord[];
}

interface ConversionRate {
  from: string;
  to: string;
  fromCount: number;
  toCount: number;
  rate: number;
}

export function OutreachAnalytics({ records }: OutreachAnalyticsProps) {
  // Calculate stage counts - a record "reaches" a stage if it has the corresponding timestamp
  const counts = {
    draft: records.length,
    approved: records.filter(r => ["approved", "sent", "opened", "replied", "meeting", "closed"].includes(r.status)).length,
    sent: records.filter(r => r.sent_at).length,
    opened: records.filter(r => r.opened_at).length,
    replied: records.filter(r => r.replied_at).length,
    meeting: records.filter(r => r.meeting_scheduled_at).length,
    closed: records.filter(r => r.closed_at).length,
  };

  // Define conversion funnels
  const conversions: ConversionRate[] = [
    {
      from: "Sent",
      to: "Opened",
      fromCount: counts.sent,
      toCount: counts.opened,
      rate: counts.sent > 0 ? (counts.opened / counts.sent) * 100 : 0,
    },
    {
      from: "Opened",
      to: "Replied",
      fromCount: counts.opened,
      toCount: counts.replied,
      rate: counts.opened > 0 ? (counts.replied / counts.opened) * 100 : 0,
    },
    {
      from: "Replied",
      to: "Meeting",
      fromCount: counts.replied,
      toCount: counts.meeting,
      rate: counts.replied > 0 ? (counts.meeting / counts.replied) * 100 : 0,
    },
    {
      from: "Meeting",
      to: "Closed",
      fromCount: counts.meeting,
      toCount: counts.closed,
      rate: counts.meeting > 0 ? (counts.closed / counts.meeting) * 100 : 0,
    },
  ];

  // Overall funnel conversion
  const overallRate = counts.sent > 0 ? (counts.closed / counts.sent) * 100 : 0;

  const getRateColor = (rate: number) => {
    if (rate >= 50) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= 25) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  };

  const getRateIcon = (rate: number) => {
    if (rate >= 50) return <TrendingUp className="h-3 w-3" />;
    if (rate >= 25) return <Minus className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  if (records.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Conversion Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stage-to-Stage Conversions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {conversions.map((conv) => (
              <div
                key={`${conv.from}-${conv.to}`}
                className="bg-muted/50 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{conv.from}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{conv.to}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-bold ${getRateColor(conv.rate)}`}>
                    {conv.rate.toFixed(0)}%
                  </span>
                  <span className={getRateColor(conv.rate)}>
                    {getRateIcon(conv.rate)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {conv.toCount} of {conv.fromCount}
                </p>
              </div>
            ))}
          </div>

          {/* Overall Stats */}
          <div className="flex flex-wrap gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total Outreach:</span>
              <span className="font-semibold">{records.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Emails Sent:</span>
              <span className="font-semibold">{counts.sent}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Deals Closed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{counts.closed}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Overall Conversion:</span>
              <span className={`font-semibold ${getRateColor(overallRate)}`}>
                {overallRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
