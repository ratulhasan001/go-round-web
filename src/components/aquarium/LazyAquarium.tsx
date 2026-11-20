"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Placeholder = () => <div className="h-[27rem] w-full animate-pulse rounded-[22px] bg-[#e1f3f0]/60 sm:h-[36rem]" />;

// the engine is a big piece of code, and it only runs in the browser
const AquariumTank = dynamic(() => import("./AquariumTank").then((m) => m.AquariumTank), { ssr: false, loading: Placeholder });

/**
 * The interactive aquarium, loaded only when the visitor scrolls near it: its code and its fish aren't built while the
 * page opens, which kept slower Android phones busy. The placeholder keeps the page from jumping.
 */
export function LazyAquarium(props: ComponentProps<typeof AquariumTank>) {
  const spot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true); // eslint-disable-line react-hooks/set-state-in-effect -- very old browsers: just show it
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (near) return <AquariumTank {...props} />;
  return (
    <div ref={spot}>
      <Placeholder />
    </div>
  );
}
