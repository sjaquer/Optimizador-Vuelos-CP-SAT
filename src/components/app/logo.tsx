
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
      <path d="M10.2 2.6c.1.3.2.7.2 1.1v2.3"/>
      <path d="M13.6 2.6c-.1.3-.2.7-.2 1.1v2.3"/>
      <path d="M11.9 8.1V12h-2"/>
      <path d="m5.9 8.1 1.4 1.4"/>
      <path d="M21 12h-4.2c-.6 0-1.2.3-1.6.7L8 20"/>
      <path d="m3.4 17.6 1.1-1.1"/>
      <path d="M3 12h2.2c.6 0 1.2.3 1.6.7L12 20"/>
      <path d="M12 8.1V6.9c0-.5-.4-1.2-1.2-1.2H8.4c-.8 0-1.2.7-1.2 1.2v1.2"/>
      <path d="M21 12h.5a1.5 1.5 0 0 1 0 3H3"/>
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
