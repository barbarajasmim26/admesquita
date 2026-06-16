import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/mesquita-logo.png";

const ACCESS_CODE = "@mesquita2022";
const STORAGE_KEY = "mesquita.access";

export function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(localStorage.getItem(STORAGE_KEY) === ACCESS_CODE);
    } catch {
      setUnlocked(false);
    }
  }, []);

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim() === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, ACCESS_CODE);
      setUnlocked(true);
    } else {
      setError(true);
      setCode("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl shadow-primary/10"
      >
        <div className="flex flex-col items-center gap-4 mb-6">
          <img src={logo} alt="Mesquita Imóveis" className="h-16 w-auto" />
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lock className="size-4" />
            Acesso restrito
          </div>
        </div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Código de acesso
        </label>
        <Input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(false); }}
          placeholder="Digite o código"
          className="h-11"
        />
        {error && (
          <p className="mt-2 text-sm text-destructive">Código incorreto.</p>
        )}
        <Button type="submit" className="w-full mt-5 h-11">Entrar</Button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Mesquita Administração de Imóveis
        </p>
      </form>
    </div>
  );
}