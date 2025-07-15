import { Rocket } from 'lucide-react';

function HelicopterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12a5.5 5.5 0 0 1 11 0" />
      <path d="M12.5 12H18a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.5" />
      <path d="M19 16V9a2 2 0 0 1 2-2h1" />
      <path d="M22 7h-2" />
      <path d="M8 12.5V21" />
      <path d="M5 21h6" />
      <path d="M8 8.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-2">
        <HelicopterIcon className="h-5 w-5 text-primary" />
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
