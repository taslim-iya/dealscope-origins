import { OutreachCRM } from "@/components/crm/OutreachCRM";

interface MandateOutreachTabProps {
  mandateId: string;
}

export function MandateOutreachTab({ mandateId }: MandateOutreachTabProps) {
  return <OutreachCRM mandateId={mandateId} />;
}
