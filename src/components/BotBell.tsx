import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listBotSuggestions } from "@/lib/api/crm.functions";
import { Bot } from "lucide-react";

export function BotBell() {
  const { data } = useQuery({
    queryKey: ["bot-suggestions"],
    queryFn: () => listBotSuggestions(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const count = data?.length ?? 0;
  return (
    <Link
      to="/assistente"
      className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/30 hover:bg-sidebar-accent text-sm font-medium"
      title="Assistente"
    >
      <Bot className="size-4" />
      <span>Assistente</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center ring-2 ring-sidebar">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}