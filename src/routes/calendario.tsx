// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listMonthPayments } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { brl, formatDateBR } from "@/lib/finance";
import { StatusBadge } from "@/components/StatusBadge";

const opts = (y: number, m: number) => queryOptions({ queryKey: ["cal", y, m], queryFn: () => listMonthPayments({ data: { year: y, month: m } }) });
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DIAS = ["D","S","T","Q","Q","S","S"];

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Mesquita Imóveis" }] }),
  loader: ({ context }) => {
    const now = new Date();
    return context.queryClient.ensureQueryData(opts(now.getFullYear(), now.getMonth() + 1));
  },
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { data } = useSuspenseQuery(opts(year, month));

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();
  const byDay = new Map<number, any[]>();
  data.forEach((p: any) => {
    const d = parseInt(p.due_date.slice(8, 10), 10);
    const arr = byDay.get(d) ?? [];
    arr.push(p);
    byDay.set(d, arr);
  });

  function prev() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <PageHeader title="Calendário" description={`Vencimentos de ${MESES[month - 1]}/${year}`} actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="size-4" /></Button>
          <span className="font-medium text-sm w-32 text-center">{MESES[month - 1]} {year}</span>
          <Button variant="outline" size="icon" onClick={next}><ChevronRight className="size-4" /></Button>
        </div>
      } />
      <div className="p-8">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DIAS.map((d, i) => <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                const items = d ? (byDay.get(d) ?? []) : [];
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!d}
                    onClick={() => d && items.length > 0 && setSelectedDay(d)}
                    className={`min-h-24 rounded-md border p-2 text-left ${d ? "bg-card hover:border-primary/50 cursor-pointer" : "bg-muted/30 cursor-default"} ${items.length === 0 && d ? "cursor-default" : ""}`}
                  >
                    {d && <div className="text-xs font-medium text-muted-foreground mb-1">{d}</div>}
                    {d && items.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="text-[10px] mb-1 truncate" title={`${p.tenants?.name} — ${brl(p.amount)}`}>
                        <StatusBadge status={p.status} /> <span className="ml-1">{p.tenants?.name}</span>
                      </div>
                    ))}
                    {d && items.length > 3 && (
                      <div className="text-[10px] text-primary">+ {items.length - 3} ver tudo</div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vencimentos em {selectedDay && formatDateBR(`${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedDay && (byDay.get(selectedDay) ?? []).map((p: any) => (
              <Link key={p.id} to="/financeiro" onClick={() => setSelectedDay(null)} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/30">
                <div>
                  <div className="font-medium text-sm">{p.tenants?.name}</div>
                  <div className="text-xs text-muted-foreground">{p.tenants?.properties?.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="font-medium">{brl(p.amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}