"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Fabric } from "./fabric";

/** WebGL canvas for the hero. Loaded client-only, after the poster has painted. */
export default function HeroScene({ progress, onReady }: { progress: RefObject<number>; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Pause rendering entirely once the hero is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.1, 7], fov: 35, near: 0.1, far: 50 }}
        onCreated={() => onReady?.()}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} color="#fff4e0" />
        <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#b594c4" />
        {/* Studio light built from lightformers, no HDR download */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#fff3dc" position={[0, 4, 4]} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#c9a45c" position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[4, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#74418b" position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[4, 6, 1]} />
          <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[2, 3, 6]} scale={1.5} />
        </Environment>
        <Fabric progress={progress} />
      </Canvas>
    </div>
  );
}
