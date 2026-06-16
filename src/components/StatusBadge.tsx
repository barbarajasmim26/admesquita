import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
    pending: { label: "Pendente", cls: "bg-warning/15 text-warning-foreground border-warning/40" },
    overdue: { label: "Atrasado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    active: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
    inactive: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", v.cls)}>
      {v.label}
    </span>
  );
}
