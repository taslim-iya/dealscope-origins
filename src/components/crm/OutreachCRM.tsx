import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Eye,
  MessageSquare,
  Calendar,
  CheckCircle,
  Clock,
  Edit3,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  StickyNote,
  Bell,
  BellOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { OutreachStatusUpdate } from "./OutreachStatusUpdate";

export interface OutreachRecord {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  meeting_scheduled_at: string | null;
  closed_at: string | null;
  outcome: string | null;
  notes: string | null;
  company_id: string;
  company_name?: string;
  recipient_email: string | null;
  follow_up_days: number | null;
  follow_up_dismissed_at: string | null;
}

// Helper to check if follow-up is due
export function isFollowUpDue(record: OutreachRecord): boolean {
  if (!record.sent_at || !record.follow_up_days) return false;
  if (record.follow_up_dismissed_at) return false;
  if (["replied", "meeting", "closed"].includes(record.status)) return false;
  
  const sentDate = new Date(record.sent_at);
  const dueDate = new Date(sentDate.getTime() + record.follow_up_days * 24 * 60 * 60 * 1000);
  return new Date() > dueDate;
}

interface OutreachCRMProps {
  mandateId: string;
}

const pipelineStages = [
  { key: "draft", label: "Draft", icon: Edit3, color: "bg-slate-100 text-slate-600 border-slate-200" },
  { key: "approved", label: "Approved", icon: CheckCircle, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "sent", label: "Sent", icon: Mail, color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "opened", label: "Opened", icon: Eye, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "replied", label: "Replied", icon: MessageSquare, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "meeting", label: "Meeting", icon: Calendar, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "closed", label: "Closed", icon: CheckCircle, color: "bg-green-50 text-green-700 border-green-200" },
];

export function OutreachCRM({ mandateId }: OutreachCRMProps) {
  const [records, setRecords] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from("outreach_messages")
      .select(`
        id,
        subject,
        body,
        status,
        created_at,
        sent_at,
        opened_at,
        replied_at,
        meeting_scheduled_at,
        closed_at,
        outcome,
        notes,
        company_id,
        recipient_email,
        follow_up_days,
        follow_up_dismissed_at,
        companies (
          company_name
        )
      `)
      .eq("mandate_id", mandateId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const recordsWithCompanyNames = data.map((msg: any) => ({
        ...msg,
        company_name: msg.companies?.company_name || "Unknown Company",
      }));
      setRecords(recordsWithCompanyNames);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [mandateId]);

  const handleStatusUpdate = async (recordId: string, newStatus: string, additionalData?: Partial<OutreachRecord>) => {
    setUpdatingId(recordId);
    
    const updateData: any = { status: newStatus };
    
    // Set timestamp based on status change
    const now = new Date().toISOString();
    if (newStatus === "sent" && !records.find(r => r.id === recordId)?.sent_at) {
      updateData.sent_at = now;
    } else if (newStatus === "opened" && !records.find(r => r.id === recordId)?.opened_at) {
      updateData.opened_at = now;
    } else if (newStatus === "replied" && !records.find(r => r.id === recordId)?.replied_at) {
      updateData.replied_at = now;
    } else if (newStatus === "meeting" && !records.find(r => r.id === recordId)?.meeting_scheduled_at) {
      updateData.meeting_scheduled_at = now;
    } else if (newStatus === "closed" && !records.find(r => r.id === recordId)?.closed_at) {
      updateData.closed_at = now;
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    const { error } = await supabase
      .from("outreach_messages")
      .update(updateData)
      .eq("id", recordId);

    if (!error) {
      setRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, ...updateData } : r
        )
      );
    }
    
    setUpdatingId(null);
  };

  const handleNotesUpdate = async (recordId: string, notes: string) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ notes })
      .eq("id", recordId);

    if (!error) {
      setRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, notes } : r
        )
      );
    }
  };

  const handleFollowUpDaysUpdate = async (recordId: string, days: number) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ follow_up_days: days })
      .eq("id", recordId);

    if (!error) {
      setRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, follow_up_days: days } : r
        )
      );
    }
  };

  const handleDismissFollowUp = async (recordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("outreach_messages")
      .update({ follow_up_dismissed_at: now })
      .eq("id", recordId);

    if (!error) {
      setRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, follow_up_dismissed_at: now } : r
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="card-elevated p-12 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-2">No outreach yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Generate AI-powered outreach emails from individual company pages.
          Track your entire pipeline here.
        </p>
      </div>
    );
  }

  // Group by status for pipeline view
  const groupedByStatus = pipelineStages.reduce((acc, stage) => {
    acc[stage.key] = records.filter(r => r.status === stage.key);
    return acc;
  }, {} as Record<string, OutreachRecord[]>);

  // Also count failed separately
  const failedCount = records.filter(r => r.status === "failed").length;

  // Count follow-ups due
  const followUpsDue = records.filter(isFollowUpDue);

  return (
    <div className="space-y-6">
      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {pipelineStages.map((stage) => {
          const count = groupedByStatus[stage.key]?.length || 0;
          const Icon = stage.icon;
          return (
            <Card key={stage.key} className={`${stage.color} border`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{stage.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {followUpsDue.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {followUpsDue.length} follow-up{followUpsDue.length > 1 ? "s" : ""} due
              </span>
            </div>
            <div className="space-y-2">
              {followUpsDue.map((record) => {
                const daysSinceSent = record.sent_at 
                  ? Math.floor((Date.now() - new Date(record.sent_at).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between bg-background rounded-md px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{record.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {daysSinceSent} days ago • No response
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link to={`/company/${record.company_id}`}>
                          Follow up
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDismissFollowUp(record.id, e)}
                        title="Dismiss reminder"
                      >
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {failedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{failedCount} failed outreach attempt(s)</span>
        </div>
      )}

      {/* CRM List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outreach Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {records.map((record) => {
              const stageConfig = pipelineStages.find(s => s.key === record.status) || pipelineStages[0];
              const StageIcon = stageConfig.icon;
              const isExpanded = expandedId === record.id;
              const followUpDue = isFollowUpDue(record);

              return (
                <div key={record.id} className={`bg-background ${followUpDue ? "border-l-4 border-l-amber-400" : ""}`}>
                  {/* Main Row */}
                  <div
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">
                          {record.company_name}
                        </span>
                        {record.notes && (
                          <StickyNote className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {record.subject}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${stageConfig.color} gap-1`}>
                        <StageIcon className="h-3 w-3" />
                        {stageConfig.label}
                      </Badge>
                      
                      <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(record.created_at).toLocaleDateString()}
                      </div>

                      <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                        <Link to={`/company/${record.company_id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                      <OutreachStatusUpdate
                        record={record}
                        pipelineStages={pipelineStages}
                        onStatusUpdate={handleStatusUpdate}
                        onNotesUpdate={handleNotesUpdate}
                        onFollowUpDaysUpdate={handleFollowUpDaysUpdate}
                        isUpdating={updatingId === record.id}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
