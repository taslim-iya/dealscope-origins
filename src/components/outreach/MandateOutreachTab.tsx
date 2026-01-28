import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, Clock, CheckCircle, Send, Edit3, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface OutreachMessage {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  company_id: string;
  company_name?: string;
}

interface MandateOutreachTabProps {
  mandateId: string;
}

const statusConfig = {
  draft: { label: "Draft", icon: Edit3, variant: "secondary" as const },
  approved: { label: "Approved", icon: CheckCircle, variant: "default" as const },
  sent: { label: "Sent", icon: Send, variant: "outline" as const },
  failed: { label: "Failed", icon: AlertCircle, variant: "destructive" as const },
};

export function MandateOutreachTab({ mandateId }: MandateOutreachTabProps) {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      // Fetch all outreach messages for this mandate with company names
      const { data, error } = await supabase
        .from("outreach_messages")
        .select(`
          id,
          subject,
          body,
          status,
          created_at,
          sent_at,
          company_id,
          companies (
            company_name
          )
        `)
        .eq("mandate_id", mandateId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const messagesWithCompanyNames = data.map((msg: any) => ({
          ...msg,
          company_name: msg.companies?.company_name || "Unknown Company",
        }));
        setMessages(messagesWithCompanyNames);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [mandateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="card-elevated p-12 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-2">No outreach messages yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Generate AI-powered outreach emails from individual company pages. 
          All messages for this mandate will appear here.
        </p>
      </div>
    );
  }

  // Group messages by status for summary
  const statusCounts = messages.reduce((acc, msg) => {
    acc[msg.status] = (acc[msg.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = statusCounts[status] || 0;
          const Icon = config.icon;
          return (
            <div key={status} className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{config.label}</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground">All Messages</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Company
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Subject
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Created
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-24">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-20">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {messages.map((message, index) => {
                const config = statusConfig[message.status as keyof typeof statusConfig] || statusConfig.draft;
                const Icon = config.icon;
                
                return (
                  <tr
                    key={message.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      index % 2 === 0 ? "bg-background" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {message.company_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      <span className="line-clamp-1">{message.subject}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(message.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={config.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/company/${message.company_id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
