
import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-1.5">
         <Image src="/images/helicopter.png" alt="Helicopter Icon" width={24} height={24} />
      </div>
      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
        <h1 className="text-base font-bold tracking-tight text-foreground">
          OVH
        </h1>
        <span className="text-xs text-muted-foreground -mt-1">by sjaquer</span>
      </div>
    </div>
  );
}
