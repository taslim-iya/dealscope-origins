import { useState } from "react";
import { Check, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { OutreachRecord } from "./OutreachCRM";

interface OutreachStatusUpdateProps {
  record: OutreachRecord;
  pipelineStages: Array<{ key: string; label: string; icon: any; color: string }>;
  onStatusUpdate: (recordId: string, newStatus: string, additionalData?: Partial<OutreachRecord>) => Promise<void>;
  onNotesUpdate: (recordId: string, notes: string) => Promise<void>;
  onFollowUpDaysUpdate: (recordId: string, days: number) => Promise<void>;
  isUpdating: boolean;
}

const outcomeOptions = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "not_for_sale", label: "Not For Sale" },
  { value: "deal_closed", label: "Deal Closed" },
  { value: "lost", label: "Lost/No Response" },
];

export function OutreachStatusUpdate({
  record,
  pipelineStages,
  onStatusUpdate,
  onNotesUpdate,
  onFollowUpDaysUpdate,
  isUpdating,
}: OutreachStatusUpdateProps) {
  const [notes, setNotes] = useState(record.notes || "");
  const [outcome, setOutcome] = useState(record.outcome || "");
  const [followUpDays, setFollowUpDays] = useState(record.follow_up_days || 7);
  const [notesChanged, setNotesChanged] = useState(false);
  const { toast } = useToast();

  const handleFollowUpDaysChange = async (value: string) => {
    const days = parseInt(value);
    setFollowUpDays(days);
    await onFollowUpDaysUpdate(record.id, days);
    toast({
      title: "Reminder updated",
      description: `Follow-up reminder set to ${days} days.`,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    await onStatusUpdate(record.id, newStatus);
    toast({
      title: "Status updated",
      description: `Outreach marked as ${newStatus}.`,
    });
  };

  const handleSaveNotes = async () => {
    await onNotesUpdate(record.id, notes);
    setNotesChanged(false);
    toast({
      title: "Notes saved",
      description: "Your notes have been saved.",
    });
  };

  const handleOutcomeChange = async (newOutcome: string) => {
    setOutcome(newOutcome);
    await onStatusUpdate(record.id, record.status, { outcome: newOutcome });
    toast({
      title: "Outcome updated",
      description: `Marked as ${outcomeOptions.find(o => o.value === newOutcome)?.label}.`,
    });
  };

  // Format timestamp for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="pt-4 space-y-4">
      {/* Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Created</span>
          <p className="font-medium">{formatDate(record.created_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Sent</span>
          <p className="font-medium">{formatDate(record.sent_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Opened</span>
          <p className="font-medium">{formatDate(record.opened_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Replied</span>
          <p className="font-medium">{formatDate(record.replied_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Meeting</span>
          <p className="font-medium">{formatDate(record.meeting_scheduled_at)}</p>
        </div>
      </div>

      {/* Status Update */}
      <div className="flex flex-wrap gap-2">
        <Label className="w-full text-xs text-muted-foreground mb-1">Update Status</Label>
        <div className="flex flex-wrap gap-2">
          {pipelineStages.map((stage) => {
            const isActive = record.status === stage.key;
            const Icon = stage.icon;
            return (
              <Button
                key={stage.key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`text-xs ${isActive ? "" : stage.color}`}
                onClick={() => handleStatusChange(stage.key)}
                disabled={isUpdating}
              >
                {isUpdating && isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Icon className="h-3 w-3 mr-1" />
                )}
                {stage.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Outcome (for closed deals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">Outcome</Label>
          <Select value={outcome} onValueChange={handleOutcomeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select outcome..." />
            </SelectTrigger>
            <SelectContent>
              {outcomeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Follow-up reminder configuration */}
        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Follow-up reminder
          </Label>
          <Select value={followUpDays.toString()} onValueChange={handleFollowUpDaysChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">After 3 days</SelectItem>
              <SelectItem value="5">After 5 days</SelectItem>
              <SelectItem value="7">After 7 days</SelectItem>
              <SelectItem value="14">After 14 days</SelectItem>
              <SelectItem value="21">After 21 days</SelectItem>
              <SelectItem value="30">After 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea
          placeholder="Add notes about this outreach (e.g., response details, meeting notes, next steps)..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesChanged(true);
          }}
          rows={3}
          className="text-sm"
        />
        {notesChanged && (
          <Button size="sm" onClick={handleSaveNotes} className="w-fit">
            <Check className="h-3 w-3 mr-1" />
            Save Notes
          </Button>
        )}
      </div>

      {/* Email Preview */}
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Email Preview</Label>
        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="font-medium mb-2">{record.subject}</p>
          <p className="text-muted-foreground whitespace-pre-wrap text-xs">
            {record.body}
          </p>
        </div>
      </div>
    </div>
  );
}
