import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, Factory, Banknote, Filter, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock data
const mockMandate = {
  id: "1",
  name: "UK Manufacturing Targets",
  status: "active",
  companiesDelivered: 12,
  criteria: {
    geography: "United Kingdom (South East, Midlands)",
    industry: "SIC 25110, 25120",
    revenue: "£1M - £10M",
  },
};

const mockCompanies = [
  {
    id: "c1",
    name: "Precision Engineering Ltd",
    location: "Birmingham, UK",
    industry: "Metal fabrication",
    revenue: "£3.2M",
    status: "new",
  },
  {
    id: "c2",
    name: "Advanced Components Co",
    location: "Manchester, UK",
    industry: "Machinery manufacturing",
    revenue: "£5.8M",
    status: "reviewed",
  },
  {
    id: "c3",
    name: "Allied Manufacturing Group",
    location: "Leeds, UK",
    industry: "Metal products",
    revenue: "£2.1M",
    status: "new",
  },
  {
    id: "c4",
    name: "Industrial Solutions Ltd",
    location: "Sheffield, UK",
    industry: "Metal fabrication",
    revenue: "£4.5M",
    status: "shortlisted",
  },
  {
    id: "c5",
    name: "Northern Precision Works",
    location: "Newcastle, UK",
    industry: "Machinery manufacturing",
    revenue: "£7.2M",
    status: "reviewed",
  },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "shortlisted", label: "Shortlisted" },
];

const statusBadges: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-slate-100 text-slate-600 border-slate-200",
  shortlisted: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function MandateWorkspace() {
  const { id } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredCompanies = mockCompanies.filter((company) => {
    const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || company.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-foreground">
            DealScope
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              john@acmecapital.com
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Sub-header */}
      <div className="border-b border-border bg-secondary/30">
        <div className="container-wide py-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">
                  {mockMandate.name}
                </h1>
                <span className="status-badge status-active">Active</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {mockMandate.companiesDelivered} companies delivered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mandate Criteria Summary */}
      <div className="border-b border-border">
        <div className="container-wide py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{mockMandate.criteria.geography}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Factory className="h-4 w-4" />
              <span>{mockMandate.criteria.industry}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Banknote className="h-4 w-4" />
              <span>Revenue: {mockMandate.criteria.revenue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="container-wide">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Companies Table */}
          <div className="table-container">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Location
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Industry
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Revenue
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-secondary">
                          <Building2 className="h-4 w-4 text-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                      {company.location}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {company.industry}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {company.revenue}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`status-badge ${statusBadges[company.status]}`}
                      >
                        {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCompanies.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-muted-foreground">No companies match your filters.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          DealScope provides buyer-mandated research and origination support only.
        </p>
      </footer>
    </div>
  );
}
