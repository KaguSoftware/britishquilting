"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A continuous band: every message in a row, separated by a stitched rule, repeated
 * enough times to overfill the container, then the whole run doubled so translating
 * the track by -50% loops seamlessly. Speed is constant in px/second whatever the
 * text length. Pauses on hover and focus; holds still under reduced motion.
 */
export function Marquee({
  messages,
  speed = 30,
  className,
  itemClassName,
  ruleClassName,
}: {
  messages: string[];
  speed?: number;
  className?: string;
  itemClassName?: string;
  ruleClassName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(4);
  const [duration, setDuration] = useState(30);
  const key = messages.join("\n");

  useLayoutEffect(() => {
    const b = box.current;
    const g = group.current;
    if (!b || !g) return;
    const measure = () => {
      const unit = g.offsetWidth;
      if (!unit) return;
      const n = Math.max(1, Math.ceil(b.offsetWidth / unit) + 1);
      setRepeats(n);
      setDuration((unit * n) / speed);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(g);
    return () => ro.disconnect();
  }, [key, speed]);

  const run = (copy: number) =>
    Array.from({ length: repeats }, (_, r) => (
      <div key={`${copy}-${r}`} ref={copy === 0 && r === 0 ? group : undefined} className="flex shrink-0 items-center" aria-hidden={copy > 0 || r > 0 || undefined}>
        {messages.map((m, i) => (
          <Fragment key={i}>
            <span className={cn("whitespace-nowrap", itemClassName)}>{m}</span>
            <span aria-hidden className={cn("mx-6 inline-block h-px w-6 shrink-0 border-t border-dashed border-gold-500/80", ruleClassName)} />
          </Fragment>
        ))}
      </div>
    ));

  return (
    <div ref={box} className={cn("group/marquee relative flex overflow-hidden", className)}>
      <div
        className="flex w-max shrink-0 animate-marquee group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${duration}s` }}
      >
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}
