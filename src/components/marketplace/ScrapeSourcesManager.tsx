import { useState, useEffect } from "react";
import { Plus, Trash2, Globe, Loader2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScrapeSource {
  id: string;
  name: string;
  url: string;
  search_query: string;
  is_active: boolean;
  created_at: string;
}

export function ScrapeSourcesManager() {
  const { toast } = useToast();
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    search_query: "business for sale",
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    const { data, error } = await supabase
      .from("scrape_sources")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sources:", error);
      toast({
        title: "Error",
        description: "Failed to load scrape sources",
        variant: "destructive",
      });
    } else {
      setSources(data || []);
    }
    setLoading(false);
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      toast({
        title: "Missing fields",
        description: "Please provide a name and URL",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("scrape_sources").insert({
      name: newSource.name,
      url: newSource.url.replace(/^https?:\/\//, "").replace(/^www\./, ""),
      search_query: newSource.search_query,
    });

    if (error) {
      console.error("Error adding source:", error);
      toast({
        title: "Error",
        description: "Failed to add source",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Source added",
        description: `${newSource.name} has been added to scrape sources`,
      });
      setNewSource({ name: "", url: "", search_query: "business for sale" });
      setDialogOpen(false);
      fetchSources();
    }
    setSaving(false);
  };

  const handleToggleActive = async (source: ScrapeSource) => {
    const { error } = await supabase
      .from("scrape_sources")
      .update({ is_active: !source.is_active })
      .eq("id", source.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update source",
        variant: "destructive",
      });
    } else {
      fetchSources();
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    const { error } = await supabase
      .from("scrape_sources")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete source",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Source removed",
        description: `${name} has been removed`,
      });
      fetchSources();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Scrape Sources</h3>
          <p className="text-sm text-muted-foreground">
            Manage websites to scrape for business listings
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Scrape Source</DialogTitle>
              <DialogDescription>
                Add a new website to scrape for business-for-sale listings
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., BusinessesForSale"
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  placeholder="e.g., businessesforsale.com"
                  value={newSource.url}
                  onChange={(e) =>
                    setNewSource({ ...newSource, url: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Enter the domain without http:// or www.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="query">Search Query</Label>
                <Input
                  id="query"
                  placeholder="e.g., business for sale UK"
                  value={newSource.search_query}
                  onChange={(e) =>
                    setNewSource({ ...newSource, search_query: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Keywords to search for on this website
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSource} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add Source"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No scrape sources configured. Add a website to get started.
          </p>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead className="font-semibold text-foreground">Name</TableHead>
                <TableHead className="font-semibold text-foreground">URL</TableHead>
                <TableHead className="font-semibold text-foreground">Search Query</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium text-foreground">
                    {source.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {source.url}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {source.search_query}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={source.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(source)}
                    >
                      {source.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(source)}
                        title={source.is_active ? "Disable" : "Enable"}
                      >
                        {source.is_active ? (
                          <PowerOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Power className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSource(source.id, source.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
