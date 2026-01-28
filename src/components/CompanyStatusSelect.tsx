import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CompanyStatusSelectProps {
  companyId: string;
  currentStatus: string;
  onStatusChange: (companyId: string, newStatus: string) => void;
}

const statusOptions = [
  { value: "new", label: "New", className: "bg-blue-50 text-blue-700" },
  { value: "reviewed", label: "Reviewed", className: "bg-slate-100 text-slate-600" },
  { value: "shortlisted", label: "Shortlisted", className: "bg-emerald-50 text-emerald-700" },
];

export function CompanyStatusSelect({
  companyId,
  currentStatus,
  onStatusChange,
}: CompanyStatusSelectProps) {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;

    setUpdating(true);
    const { error } = await supabase
      .from("companies")
      .update({ status: newStatus })
      .eq("id", companyId);

    if (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update company status.",
        variant: "destructive",
      });
    } else {
      onStatusChange(companyId, newStatus);
      toast({
        title: "Status updated",
        description: `Company marked as ${newStatus}.`,
      });
    }
    setUpdating(false);
  };

  const currentOption = statusOptions.find((opt) => opt.value === currentStatus) || statusOptions[0];

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={updating}
    >
      <SelectTrigger
        className={`w-[110px] h-7 text-xs border ${currentOption.className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
