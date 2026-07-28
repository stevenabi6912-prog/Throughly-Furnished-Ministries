"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Scroll choreography for the whole site (renders nothing):
//   1. Sections fade/rise as each one enters the viewport.
//   2. Grids and lists inside a section stagger their children, one card
//      after another — this is most of the "constantly engaging" feel.
//   3. Elements marked data-parallax drift slowly against the scroll.
// Everything is skipped for prefers-reduced-motion users.
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("js-reveal");

    // --- Section + child reveals ---
    const sections = [...document.querySelectorAll<HTMLElement>("main > section")].filter(
      (s) => !s.querySelector(".animate-rise") && !s.classList.contains("revealed")
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("revealed");
          // Stagger direct children of grids/lists inside this section.
          const groups = entry.target.querySelectorAll<HTMLElement>(".grid, ul");
          let order = 0;
          for (const group of groups) {
            for (const child of group.children) {
              (child as HTMLElement).style.transitionDelay = `${Math.min(order * 110, 880)}ms`;
              child.classList.add("stagger-child", "stagger-in");
              order++;
            }
          }
          observer.unobserve(entry.target);
        }
      },
      // threshold 0, not 0.05: a very tall section (e.g. the 500-row
      // students table) can never have 5% of itself visible at once, so a
      // ratio threshold would leave it permanently faded out.
      { rootMargin: "0px 0px -12% 0px", threshold: 0 }
    );
    for (const s of sections) {
      s.classList.add("reveal-pending");
      // Pre-mark stagger children so they start hidden before the reveal.
      for (const group of s.querySelectorAll<HTMLElement>(".grid, ul")) {
        for (const child of group.children) child.classList.add("stagger-child");
      }
      observer.observe(s);
    }

    // --- Parallax drift ---
    const parallaxEls = [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const el of parallaxEls) {
          const speed = Number(el.dataset.parallax || 0.25);
          el.style.transform = `translateY(${window.scrollY * speed}px) scale(1.12)`;
        }
      });
    };
    if (parallaxEls.length > 0) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return null;
}
