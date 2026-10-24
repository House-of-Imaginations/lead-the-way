"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    who: "You",
    everyone: false,
    time: "60 min",
    title: "Learn to lead it",
    body: "A short manager path on safe use, checking AI output and supporting teammates who feel nervous about it.",
    img: "/landing/step-learn.webp",
    height: 1056,
    alt: "Manager pathway screen",
    frame: "Manager pathway",
    note: "Setup",
  },
  {
    who: "Your team",
    everyone: false,
    time: "30 min",
    title: "Agree the rules together",
    body: "One conversation produces a one-page Team AI Agreement: tools you use, what never goes in, how outputs get checked.",
    img: "/landing/step-norms.webp",
    height: 1056,
    alt: "Team AI Agreement builder",
    frame: "Team AI Agreement",
    note: "Setup",
  },
  {
    who: "You",
    everyone: false,
    time: "5 min",
    title: "Protect the hour",
    body: "Pick one weekly slot. From hero to zero holds it in every calendar for four weeks and sends the invitations.",
    img: "/landing/step-launch.webp",
    height: 1000,
    alt: "Protected hour scheduler",
    frame: "Protected hour",
    note: "Wednesdays, 2:00 to 3:00 PM",
  },
  {
    who: "Everyone",
    everyone: true,
    time: "Weeks 1 to 3",
    title: "Learn, then apply it that week",
    body: "A short module, then one task each person already does: a client report, a follow-up email, meeting notes.",
    img: "/landing/step-apply.webp",
    height: 1056,
    alt: "Work project form",
    frame: "Work project",
    note: "Weeks 1 to 3",
  },
  {
    who: "Everyone",
    everyone: true,
    time: "Week 4",
    title: "Show what changed",
    body: "A 30-minute show and tell. People share what they tried and how they checked the output, then earn their badge.",
    img: "/landing/step-share.webp",
    height: 1056,
    alt: "Show and tell screen",
    frame: "Show and tell",
    note: "Week 4",
  },
];

/**
 * Five steps on the left; on the right a sticky frame shows the step in the
 * middle of the viewport. An observer switches it, so it works with motion
 * off and without the motion library. Below 900px the frame hides and each
 * step shows its own screenshot.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    list.current?.querySelectorAll(".step").forEach((step) => io.observe(step));
    return () => io.disconnect();
  }, []);

  return (
    <div className="how-grid">
      <div className="how-steps" id="steps">
        <span className="how-rail" aria-hidden="true">
          <i />
        </span>
        <ol ref={list}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="step" data-step={i}>
              <div className="step-who">
                <span className={clsx("tag", s.everyone && "tag-g")}>
                  {s.who}
                </span>
                <span className="cap">{s.time}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <Image
                className="step-img"
                src={s.img}
                width={1600}
                height={s.height}
                sizes="100vw"
                alt={s.alt}
              />
            </li>
          ))}
        </ol>
      </div>
      <div className="how-stage" aria-hidden="true">
        {STEPS.map((s, i) => (
          <figure key={s.title} className={clsx("frame", i === active && "on")}>
            <Image
              src={s.img}
              width={1600}
              height={s.height}
              sizes="(max-width: 1344px) 56vw, 750px"
              alt=""
            />
            <figcaption className="frame-bar">
              <b>{s.frame}</b>
              <span className="cap">{s.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
