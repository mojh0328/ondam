import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/utils";

export function CostStatusBadge({ percentage, className }: { percentage: number, className?: string }) {
  if (percentage <= 0) return <Badge variant="outline" className={className}>Not Set</Badge>;
  
  if (percentage < 30) {
    return <Badge className={`bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 ${className}`}>{formatPercent(percentage)}</Badge>;
  }
  
  if (percentage <= 40) {
    return <Badge className={`bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 ${className}`}>{formatPercent(percentage)}</Badge>;
  }
  
  return <Badge className={`bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200 ${className}`}>{formatPercent(percentage)}</Badge>;
}
