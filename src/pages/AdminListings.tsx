import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  User,
  Briefcase,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

interface ListingDeal {
  id: string;
  company_name: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  asking_price: string | null;
  revenue: string | null;
  profit: string | null;
  source: string;
  source_url: string;
  listing_type: string;
  approval_status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export default function AdminListings() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [listings, setListings] = useState<ListingDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!data) {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      await fetchListings();
    };
    if (!authLoading) init();
  }, [user, authLoading]);

  const fetchListings = async () => {
    const { data, error } = await supabase
      .from("on_market_deals")
      .select("*")
      .in("listing_type", ["owner", "broker"])
      .order("created_at", { ascending: false });

    if (!error) setListings((data as any[]) || []);
    setLoading(false);
  };

  const handleApproval = async (id: string, status: "approved" | "rejected") => {
    setUpdating(id);
    const { error } = await supabase
      .from("on_market_deals")
      .update({ approval_status: status } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Listing Approved" : "Listing Rejected" });
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, approval_status: status } : l))
      );
    }
    setUpdating(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const pending = listings.filter((l) => l.approval_status === "pending");
  const approved = listings.filter((l) => l.approval_status === "approved");
  const rejected = listings.filter((l) => l.approval_status === "rejected");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader
        email={profile?.email || user?.email}
        onSignOut={async () => { await signOut(); navigate("/"); }}
      />

      <div className="border-b border-border bg-secondary/30">
        <div className="container-wide py-6">
          <h1 className="text-2xl font-semibold text-foreground">Listing Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve owner and broker listing submissions
          </p>
        </div>
      </div>

      <main className="flex-1 py-6">
        <div className="container-wide">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card-elevated p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-semibold text-foreground">{pending.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
            <div className="card-elevated p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-semibold text-foreground">{approved.length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
            <div className="card-elevated p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-semibold text-foreground">{rejected.length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="h-3.5 w-3.5" />
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Approved ({approved.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                Rejected ({rejected.length})
              </TabsTrigger>
            </TabsList>

            {["pending", "approved", "rejected"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <div className="space-y-4 mt-4">
                  {(tab === "pending" ? pending : tab === "approved" ? approved : rejected).length === 0 ? (
                    <div className="card-elevated p-8 text-center text-muted-foreground">
                      No {tab} listings
                    </div>
                  ) : (
                    (tab === "pending" ? pending : tab === "approved" ? approved : rejected).map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onApprove={() => handleApproval(listing.id, "approved")}
                        onReject={() => handleApproval(listing.id, "rejected")}
                        updating={updating === listing.id}
                      />
                    ))
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function ListingCard({
  listing,
  onApprove,
  onReject,
  updating,
}: {
  listing: ListingDeal;
  onApprove: () => void;
  onReject: () => void;
  updating: boolean;
}) {
  const typeIcon = listing.listing_type === "owner" ? (
    <User className="h-3.5 w-3.5" />
  ) : listing.listing_type === "broker" ? (
    <Briefcase className="h-3.5 w-3.5" />
  ) : (
    <Globe className="h-3.5 w-3.5" />
  );

  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{listing.company_name}</h3>
            <Badge variant="outline" className="gap-1 text-xs shrink-0">
              {typeIcon}
              {listing.listing_type === "owner" ? "Owner" : "Broker"}
            </Badge>
            <Badge
              variant={
                listing.approval_status === "approved"
                  ? "default"
                  : listing.approval_status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
              className="text-xs"
            >
              {listing.approval_status}
            </Badge>
          </div>

          {listing.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{listing.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {listing.industry && <span>Industry: {listing.industry}</span>}
            {listing.location && <span>Location: {listing.location}</span>}
            {listing.asking_price && <span>Price: {listing.asking_price}</span>}
            {listing.revenue && <span>Revenue: {listing.revenue}</span>}
            {listing.profit && <span>Profit: {listing.profit}</span>}
          </div>

          {(listing.contact_name || listing.contact_email || listing.contact_phone) && (
            <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {listing.contact_name && <span>Contact: {listing.contact_name}</span>}
              {listing.contact_email && <span>Email: {listing.contact_email}</span>}
              {listing.contact_phone && <span>Phone: {listing.contact_phone}</span>}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-1">
            Submitted: {new Date(listing.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {listing.source_url && !listing.source_url.startsWith("listing://") && (
            <Button variant="ghost" size="sm" asChild>
              <a href={listing.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {listing.approval_status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={updating}
                className="gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                disabled={updating}
                className="gap-1"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Approve
              </Button>
            </>
          )}
          {listing.approval_status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={updating}
              className="gap-1"
            >
              Revoke
            </Button>
          )}
          {listing.approval_status === "rejected" && (
            <Button
              size="sm"
              onClick={onApprove}
              disabled={updating}
              className="gap-1"
            >
              Approve
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
