import { useState, useEffect } from "react";
import { Sparkles, Send, Edit3, Loader2, Mail, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OutreachMessage {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface OutreachPanelProps {
  companyId: string;
  mandateId: string;
  companyName: string;
}

const statusConfig = {
  draft: { label: "Draft", icon: Edit3, className: "text-muted-foreground" },
  approved: { label: "Approved", icon: CheckCircle, className: "text-primary" },
  sent: { label: "Sent", icon: Send, className: "text-green-600" },
  failed: { label: "Failed", icon: AlertCircle, className: "text-destructive" },
};

export function OutreachPanel({ companyId, mandateId, companyName }: OutreachPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [companyId]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("outreach_messages")
      .select("id, subject, body, status, created_at, sent_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMessages(data as OutreachMessage[]);
    }
    setLoading(false);
  };

  const generateDraft = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            companyId,
            mandateId,
            buyerName: profile?.full_name,
            buyerCompany: profile?.company_name,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate email");
      }

      const result = await response.json();
      setDraftSubject(result.subject);
      setDraftBody(result.body);
      setIsEditing(true);

      toast({
        title: "Draft generated",
        description: "AI has created a personalized outreach email. Review and edit as needed.",
      });
    } catch (error) {
      console.error("Generate error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!user || !draftSubject || !draftBody) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("outreach_messages").insert({
        company_id: companyId,
        mandate_id: mandateId,
        user_id: user.id,
        subject: draftSubject,
        body: draftBody,
        status: "draft",
      });

      if (error) throw error;

      toast({
        title: "Draft saved",
        description: "Your outreach message has been saved.",
      });

      setDraftSubject("");
      setDraftBody("");
      setIsEditing(false);
      fetchMessages();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const approveMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ status: "approved" })
      .eq("id", messageId);

    if (!error) {
      toast({
        title: "Message approved",
        description: "The message is ready to be sent.",
      });
      fetchMessages();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate New or Show Editor */}
      {!isEditing ? (
        <div className="card-elevated p-6 text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-2">AI-Powered Outreach</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Generate a personalized acquisition inquiry email for {companyName} based on company data and your mandate criteria.
          </p>
          <Button onClick={generateDraft} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Email Draft
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Edit Draft</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Email body..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveDraft} disabled={saving || !draftSubject || !draftBody}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button variant="outline" onClick={generateDraft} disabled={generating}>
              {generating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        </div>
      )}

      {/* Message History */}
      {messages.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Message History</h3>
          <div className="space-y-3">
            {messages.map((message) => {
              const config = statusConfig[message.status as keyof typeof statusConfig] || statusConfig.draft;
              const StatusIcon = config.icon;

              return (
                <div key={message.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`h-4 w-4 ${config.className}`} />
                        <span className={`text-xs font-medium ${config.className}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(message.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-medium text-foreground truncate">{message.subject}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {message.body}
                      </p>
                    </div>
                    {message.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => approveMessage(message.id)}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
