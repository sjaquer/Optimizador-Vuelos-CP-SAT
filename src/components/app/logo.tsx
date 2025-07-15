import { Rocket } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-2">
        <Rocket className="h-5 w-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-base font-bold tracking-tight text-foreground">
          OVH
        </h1>
        <span className="text-xs text-muted-foreground -mt-1">by sjaquer</span>
      </div>
    </div>
  );
}
