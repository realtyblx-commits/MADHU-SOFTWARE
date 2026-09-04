import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

interface RubeGoldbergMachineProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
}

export function RubeGoldbergMachine({
  email,
  setEmail,
  password,
  setPassword,
  rememberMe,
  setRememberMe,
  onSubmit,
  busy,
}: RubeGoldbergMachineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLFormElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gearsContainerRef = useRef<SVGGElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [scale, setScale] = useState(1);

  // References to GSAP timelines and controllers
  const gearsTlsRef = useRef<gsap.core.Timeline[]>([]);
  const emailTlRef = useRef<gsap.core.Timeline | null>(null);
  const pullingTlRef = useRef<gsap.core.Timeline | null>(null);
  const stateRef = useRef({
    handClosed: false,
    sumbitBtnOnPlace: false,
    sumbitBtnTextOpacity: 0,
    pullProgress: 0,
    sprayRepeatCounter: 0,
  });

  // Responsive scaling to fit viewport perfectly without clipping or scrollbars
  useEffect(() => {
    const handleResize = () => {
      // Layer 2 container card dimensions: 900px width x 680px height
      // Perfectly frames the mechanical apparatus with 34px top/bottom and 135px side margins
      const targetW = 900;
      const targetH = 680;
      const availableW = window.innerWidth;
      // Reserve space for nav header (~46px), footer (~34px), and comfortable page margins
      const availableH = window.innerHeight - 95;

      const scaleW = (availableW - 32) / targetW;
      const scaleH = availableH / targetH;
      // Scale up smartly so the container card and machine sit gracefully within viewport
      const computedScale = Math.min(1.25, Math.min(scaleW, scaleH));
      setScale(Math.max(0.4, Number(computedScale.toFixed(3))));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize GSAP animations and SVG machinery
  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const gearsContainer = gearsContainerRef.current;
    const submitBtn = submitBtnRef.current;

    if (!container || !svg || !gearsContainer || !submitBtn) return;

    const ctx = gsap.context(() => {
      // Elements
      const pullSystemContainer = svg.querySelector<SVGGElement>(".pull-system");
      const sprayHandContainer = svg.querySelector<SVGGElement>(".spray-hand-container");
      const sprayer = svg.querySelector<SVGGElement>(".sprayer");
      const sprayLines = Array.from(svg.querySelectorAll<SVGLineElement>(".spray-line"));
      const sprayBubbles = Array.from(svg.querySelectorAll<SVGCircleElement>(".spray-bubble"));
      const pushingHand = svg.querySelector<SVGGElement>(".pushing-hand");
      const sprayerHead = svg.querySelector<SVGGElement>(".sprayer-head");
      const gearConnector = svg.querySelector<SVGLineElement>(".gear-connector");
      const checkboxPullLine = svg.querySelector<SVGLineElement>(".checkbox-pull-line");
      const checkboxPullCircle = svg.querySelector<SVGGElement>(".checkbox-pull-circle");
      const btnPullLine = svg.querySelector<SVGPathElement>(".submit-btn-connector");
      const btnHandlerCircle = svg.querySelector<SVGCircleElement>(".submit-btn-circle");
      const spiralContainer = svg.querySelector<SVGGElement>(".spiral-container");
      const weightBigContainer = svg.querySelector<SVGGElement>(".weight-big-container");
      const scalesContainer = svg.querySelector<SVGGElement>(".scales-container");
      const scalesLine = svg.querySelector<SVGLineElement>(".scales-moving-line");
      const weightBig = svg.querySelector<SVGGElement>(".weight-big");
      const spiralPath = svg.querySelector<SVGPathElement>(".spiral-path");
      const carContainer = svg.querySelector<SVGGElement>(".car-container");
      const car = svg.querySelector<SVGGElement>(".car");
      const carInclineWrapper = svg.querySelector<SVGGElement>(".car-container g");
      const timingChains = Array.from(svg.querySelectorAll<SVGRectElement>(".timing-chain"));
      const reelsConnector = svg.querySelector<SVGGElement>(".reels-connector");
      const carWeightConnector = svg.querySelector<SVGGElement>(".car-weight-connector");
      const grabbingHands = Array.from(svg.querySelectorAll<SVGGElement>(".grabbing-hand"));
      const grabbingHandOpenFingers = Array.from(
        svg.querySelectorAll<SVGPathElement>(".grabbing-hand-finger-open")
      );
      const grabbingHandClosedFingers = Array.from(
        svg.querySelectorAll<SVGElement>(".grabbing-hand-finger-closed")
      );

      // Layout preparation
      if (pullSystemContainer) gsap.set(pullSystemContainer, { x: 375, y: 646 });
      if (sprayHandContainer) gsap.set(sprayHandContainer, { x: 700, y: 621 });
      if (sprayer) gsap.set(sprayer, { x: -59.5, y: 53 });
      if (carContainer) gsap.set(carContainer, { x: 190, y: 802 });
      if (scalesContainer) gsap.set(scalesContainer, { x: 170, y: 710 });
      if (grabbingHands.length) gsap.set(grabbingHands, { x: 297, y: 830 });
      if (grabbingHandClosedFingers.length) gsap.set(grabbingHandClosedFingers, { opacity: 0 });
      if (spiralContainer)
        gsap.set(spiralContainer, { x: 305, y: 435, svgOrigin: "14 14", scaleX: -1 });
      if (weightBigContainer) gsap.set(weightBigContainer, { x: 305, y: 435 });

      submitBtn.style.setProperty("--btn-text-opacity", "1");
      gsap.set([sprayLines, sprayBubbles], { opacity: 0 });

      if (timingChains[0]) {
        gsap.set(timingChains[0], {
          attr: { "stroke-width": "5", "stroke-dasharray": "0 12" },
        });
      }
      if (timingChains[1]) {
        gsap.set(timingChains[1], {
          attr: { "stroke-width": "5", "stroke-dasharray": "0 12" },
        });
      }
      if (checkboxPullLine) {
        gsap.set(checkboxPullLine, { attr: { y1: -105, y2: 44 } });
      }
      gsap.set(submitBtn, { transformOrigin: "100% 0%", rotation: -90 });
      if (checkboxPullCircle) {
        gsap.set(checkboxPullCircle, { y: 44 });
      }

      // Spiral generator
      const updateSpiralPath = (
        centerX: number,
        centerY: number,
        radius: number,
        coils: number,
        points: number,
        offset: number
      ) => {
        let path = "";
        let thetaMax = coils * 2 * Math.PI;
        const awayStep = radius / thetaMax;
        const chord = (2 * Math.PI) / points;
        thetaMax -= offset * points * chord;

        for (let theta = 0; theta <= thetaMax; theta += chord) {
          const away = awayStep * theta;
          const x = centerX + Math.cos(theta) * away;
          const y = centerY + Math.sin(theta) * away;

          if (theta === 0) {
            path += `M${x},${y}`;
          } else {
            const prevAway = awayStep * (theta - chord);
            const arcRadius = (away + prevAway) / 2;
            path += ` A${arcRadius},${arcRadius} 0 0,1 ${x},${y}`;
          }
        }

        const outerAngle = thetaMax + 0.5 * Math.PI;
        const outerLength = 50 + 25 * offset;
        const endPoint = [
          Math.cos(outerAngle) * outerLength,
          Math.sin(outerAngle) * outerLength,
        ];
        path += " l" + endPoint[0] + "," + endPoint[1];

        if (spiralPath) {
          gsap.set(spiralPath, { attr: { d: path } });
        }
        if (weightBig) {
          gsap.set(weightBig, { x: -47 + 3 * offset, y: 12 + outerLength });
        }
      };

      // Create Email (Password Trigger) Timeline
      const createEmailTl = () => {
        const spiralTurnsNumber = 8;
        const spiralProgress = { v: 0 };
        const hammerTimeStart = 1.85;
        const fingersDelay = 0.5;
        const fingersTimeDelta = 0.03;

        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "none", duration: 2 },
          onUpdate: () => {
            updateSpiralPath(14, 14, 45, 17, 200, spiralTurnsNumber * spiralProgress.v);
          },
        });

        tl.to(spiralProgress, { v: 1 }, 0);
        if (spiralContainer) {
          tl.to(spiralContainer, { rotation: -spiralTurnsNumber * 360 }, 0);
        }
        if (scalesLine) {
          tl.fromTo(
            scalesLine,
            { rotation: -20, svgOrigin: "92 20" },
            { duration: 0.15, rotation: -1, svgOrigin: "92 20" },
            hammerTimeStart
          );
        }
        if (timingChains[0]) {
          tl.fromTo(
            timingChains[0],
            { attr: { "stroke-dashoffset": 2 } },
            { duration: 0.15, attr: { "stroke-dashoffset": 20 } },
            hammerTimeStart
          );
        }
        if (timingChains[1]) {
          tl.fromTo(
            timingChains[1],
            { attr: { "stroke-dashoffset": 24 } },
            { duration: 0.15, attr: { "stroke-dashoffset": 6 } },
            hammerTimeStart
          );
        }
        if (reelsConnector) {
          tl.to(reelsConnector, { duration: 0.15, y: 18 }, hammerTimeStart);
        }
        if (carWeightConnector) {
          tl.to(carWeightConnector, { duration: 0.15, y: -18 }, hammerTimeStart);
        }
        if (carInclineWrapper) {
          tl.to(carInclineWrapper, { duration: 0.15, rotation: 6, svgOrigin: "120 93" }, hammerTimeStart);
        }
        if (car) {
          tl.fromTo(car, { x: -50 }, { duration: 0.6, x: 95, ease: "power2.in" }, hammerTimeStart);
        }

        for (let i = 0; i < 5; i++) {
          const openFinger = grabbingHandOpenFingers[i];
          const closedFinger = grabbingHandClosedFingers[i];
          if (openFinger && closedFinger) {
            tl.set(
              openFinger,
              { opacity: 0 },
              hammerTimeStart + fingersDelay + fingersTimeDelta * (i + 1)
            ).set(
              closedFinger,
              { opacity: 1 },
              hammerTimeStart + fingersDelay + fingersTimeDelta * (i + 1)
            );
          }
        }

        tl.fromTo(
          stateRef.current,
          { handClosed: false },
          {
            duration: 0.01,
            handClosed: true,
            onComplete: () => {
              // If checkbox was already checked before typing password, automatically pull button down!
              const chk = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
              if (chk && chk.checked) {
                createPullingTimeline(true, true);
              }
            },
          },
          ">"
        );

        if (grabbingHands.length) {
          tl.to(
            grabbingHands,
            { duration: fingersTimeDelta * 5, x: "+=20" },
            hammerTimeStart + fingersDelay
          );
        }

        tl.progress(0.001);
        return tl;
      };

      // Create Gears Timelines
      const createGearsTimelines = () => {
        gearsContainer.innerHTML = "";
        const tls: gsap.core.Timeline[] = [];

        const params = {
          baseSize: 15,
          pitch: 11,
          teethCurve: 0.6,
          startPos: { x: 634, y: 389 },
          speed: 0.2,
        };

        const data = [
          { angle: 0, teethNumber: 10, hasHole: true },
          { angle: -0.5, teethNumber: 32, hasHole: true },
          { angle: 1.65, teethNumber: 12, hasHole: false },
        ];

        const handleRadius = 14;
        interface GearItem {
          idx: number;
          center: { x: number; y: number };
          radius: number;
          angle: number;
          teethNumber: number;
          hasHole: boolean;
          toothAngle: number;
          toothCurveAngle: number;
          group: SVGGElement;
        }
        const gears: GearItem[] = [];

        data.forEach((d, dIdx) => {
          const radius = (d.teethNumber * params.baseSize) / (2 * Math.PI);
          let x: number, y: number, startAngle: number;

          if (dIdx === 0) {
            startAngle = 0;
            x = params.startPos.x;
            y = params.startPos.y;
          } else {
            const parent = gears[dIdx - 1];
            if (!parent) return;
            const size = parent.teethNumber / d.teethNumber;
            x = parent.center.x + Math.cos(d.angle) * (parent.radius + radius);
            y = parent.center.y + Math.sin(d.angle) * (parent.radius + radius);
            startAngle = (1 + size) * d.angle - size * parent.angle;
          }

          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          gearsContainer.appendChild(group);
          group.appendChild(path);

          const gear: GearItem = {
            idx: dIdx,
            center: { x, y },
            radius,
            angle: startAngle,
            teethNumber: d.teethNumber,
            hasHole: d.hasHole,
            toothAngle: (2 * Math.PI) / d.teethNumber,
            toothCurveAngle: params.teethCurve / d.teethNumber,
            group,
          };

          const rOut = gear.radius + 0.25 * params.pitch;
          const rIn = rOut - 0.75 * params.pitch;
          let pathD =
            "M" +
            (gear.center.x + Math.cos(gear.angle - gear.toothAngle + gear.toothCurveAngle) * rOut) +
            ", " +
            (gear.center.y + Math.sin(gear.angle - gear.toothAngle + gear.toothCurveAngle) * rOut) +
            " ";

          for (
            let a = gear.angle;
            a < gear.angle + 2 * Math.PI - 0.5 * gear.toothAngle;
            a += gear.toothAngle
          ) {
            const pa = a - 0.5 * gear.toothAngle;
            pathD +=
              "L" +
              (gear.center.x + Math.cos(pa - gear.toothCurveAngle) * rOut) +
              ", " +
              (gear.center.y + Math.sin(pa - gear.toothCurveAngle) * rOut) +
              " ";
            pathD +=
              "L" +
              (gear.center.x + Math.cos(pa) * rIn) +
              ", " +
              (gear.center.y + Math.sin(pa) * rIn) +
              " ";
            pathD +=
              "L" +
              (gear.center.x + Math.cos(a) * rIn) +
              ", " +
              (gear.center.y + Math.sin(a) * rIn) +
              " ";
            pathD +=
              "L" +
              (gear.center.x + Math.cos(a + gear.toothCurveAngle) * rOut) +
              ", " +
              (gear.center.y + Math.sin(a + gear.toothCurveAngle) * rOut) +
              " ";
          }

          if (gear.hasHole) {
            const holeRadius = 0.5 * rIn;
            pathD += "M" + (gear.center.x - holeRadius) + ", " + gear.center.y + " ";
            pathD += `A ${holeRadius} ${holeRadius} 1 1 0 ${gear.center.x + holeRadius} ${gear.center.y}`;
            pathD += `A ${holeRadius} ${holeRadius} 1 1 0 ${gear.center.x - holeRadius} ${gear.center.y}`;
          }

          if (dIdx === 0) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            gsap.set(circle, {
              attr: { cx: gear.center.x, cy: gear.center.y, r: 5, fill: "currentColor" },
            });
            gearsContainer.appendChild(circle);
            gsap.set(path, {
              attr: { fill: "currentColor", "fill-opacity": 0.25 },
            });
          } else if (dIdx === data.length - 1) {
            gsap.set(path, {
              attr: { fill: "currentColor", "fill-opacity": 0.25 },
            });
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            gsap.set(circle, {
              attr: {
                cx: gear.center.x + handleRadius,
                cy: gear.center.y,
                r: 5,
                fill: "currentColor",
              },
            });
            gear.group.appendChild(circle);
          }

          path.setAttribute("d", pathD);

          const tl = gsap
            .timeline({ repeat: -1, paused: true })
            .to(group, {
              duration: params.speed * gear.teethNumber,
              rotation: 360 * (gear.idx % 2 ? -1 : 1),
              svgOrigin: gear.center.x + " " + gear.center.y,
              ease: "none",
            });

          if (dIdx === data.length - 1) {
            tl.eventCallback("onUpdate", () => {
              const angle = tl.progress() * 2 * Math.PI;
              const deltaY = Math.sin(angle) * handleRadius;
              if (pushingHand) {
                gsap.set(pushingHand, { y: deltaY });
              }

              if (deltaY > 8) {
                const d = Math.max(0, deltaY - 8);
                if (sprayerHead) gsap.set(sprayerHead, { y: d });

                let sprayProgress = Math.max(0, tl.progress() - 0.1);
                sprayProgress *= 1 / 0.2;

                let bubblesOpacity = sprayProgress > 1 ? 0 : sprayProgress;
                bubblesOpacity *= 1 - Math.pow(bubblesOpacity, 8);

                const textProgress = Math.pow(sprayProgress / 1.5, 6);

                if (!stateRef.current.sumbitBtnOnPlace) {
                  stateRef.current.sumbitBtnTextOpacity =
                    (stateRef.current.sprayRepeatCounter - 1) * 0.3 + 0.3 * textProgress;
                  stateRef.current.sumbitBtnTextOpacity = Math.pow(
                    stateRef.current.sumbitBtnTextOpacity,
                    2
                  );
                }

                const clampedOpacity = Math.min(
                  1,
                  Math.max(0, stateRef.current.sumbitBtnTextOpacity)
                );
                submitBtn.style.setProperty(
                  "--btn-text-opacity",
                  clampedOpacity.toFixed(3)
                );

                if (sprayLines.length) {
                  gsap.set(sprayLines, {
                    attr: { "stroke-dashoffset": 70 * sprayProgress },
                    opacity: Math.pow(bubblesOpacity, 2),
                  });
                }
                sprayBubbles.forEach((b, bIdx) => {
                  gsap.set(b, {
                    x: 25 * (1 - sprayProgress) * (1 + 0.1 * bIdx),
                    scale: 0.5 + 1.4 * Math.pow(sprayProgress, 2),
                    transformOrigin: "center center",
                    opacity: bubblesOpacity,
                  });
                });
              }

              if (gearConnector) {
                gsap.set(gearConnector, {
                  attr: {
                    x1: gear.center.x + handleRadius * Math.cos(angle),
                    y1: gear.center.y + handleRadius * Math.sin(angle),
                    x2: 700 + 18,
                    y2: 646 - 100 + deltaY,
                  },
                });
              }
            });

            tl.eventCallback("onRepeat", () => {
              if (!stateRef.current.sumbitBtnOnPlace) {
                stateRef.current.sprayRepeatCounter++;
              }
            });
          }

          tl.progress(0.6);
          tls.push(tl);
          gears.push(gear);
        });

        return tls;
      };

      // Create Pulling Timeline
      const createPullingTimeline = (isFixed: boolean, btnPulled: boolean) => {
        if (pullingTlRef.current) {
          pullingTlRef.current.kill();
        }

        const animatePullingLine = () => {
          const btnOriginX = 260;
          const btnOriginY = -76;
          const btnWidth = 270;
          const currentRotation = Number(gsap.getProperty(submitBtn, "rotation")) || -90;
          const deg = ((currentRotation - 4) * Math.PI) / 180;

          const endX = btnOriginX - (btnWidth - 20) * Math.cos(deg);
          const endY = btnOriginY - (btnWidth - 20) * Math.sin(deg);

          if (btnHandlerCircle) {
            gsap.set(btnHandlerCircle, { attr: { cx: endX, cy: endY } });
          }

          const handle = 7;
          const r = 10;
          let btnPullLinePath =
            "M" +
            (-r - handle) +
            "," +
            (250 - (isFixed ? 0 : stateRef.current.pullProgress * 300));
          btnPullLinePath += "h" + 2 * handle;
          btnPullLinePath += "h" + -handle;
          btnPullLinePath += " V" + (44 - stateRef.current.pullProgress * 130);
          const slideAngle =
            0.3 * Math.PI * (1 - (isFixed ? 1 : 0.5) * stateRef.current.pullProgress);
          const dx = r * Math.cos(slideAngle);
          const dy = -r * Math.sin(slideAngle);
          btnPullLinePath += "a" + r + ", " + r + " 0 0 1 " + (r + dx) + " " + dy;
          btnPullLinePath += " L" + endX + "," + endY;

          if (btnPullLine) {
            gsap.set(btnPullLine, { attr: { d: btnPullLinePath }, strokeWidth: 3 });
          }
        };

        const tl = gsap.timeline({
          defaults: { ease: "power1.inOut", duration: 1 },
          onUpdate: animatePullingLine,
        });

        if (checkboxPullLine && checkboxPullCircle) {
          if (isFixed && btnPulled) {
            tl.to(stateRef.current, { pullProgress: 1 }, 0)
              .to(submitBtn, { rotation: 0 }, 0)
              .to(stateRef.current, { duration: 0.1, sumbitBtnOnPlace: 1 }, 0.9)
              .to(checkboxPullLine, { attr: { y2: -86 } }, 0)
              .to(checkboxPullCircle, { y: -86 }, 0);
          } else if (!isFixed && btnPulled) {
            tl.to(stateRef.current, { pullProgress: 1 }, 0)
              .to(checkboxPullLine, { attr: { y2: -86 } }, 0)
              .to(checkboxPullCircle, { y: -86 }, 0);
          } else if (isFixed && !btnPulled) {
            tl.to(stateRef.current, { pullProgress: 0 }, 0)
              .to(submitBtn, { rotation: -90 }, 0)
              .to(stateRef.current, { duration: 0.1, sumbitBtnOnPlace: 0 }, 0)
              .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
              .to(checkboxPullCircle, { y: 44 }, 0);
          } else if (!isFixed && !btnPulled) {
            tl.to(stateRef.current, { pullProgress: 0 }, 0)
              .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
              .to(checkboxPullCircle, { y: 44 }, 0);
          }
        }

        pullingTlRef.current = tl;
        return tl;
      };

      emailTlRef.current = createEmailTl();
      gearsTlsRef.current = createGearsTimelines();
      createPullingTimeline(stateRef.current.handClosed, rememberMe);
    }, container);

    return () => ctx.revert();
  }, []);

  // Sync Email validity & Gears spinning
  useEffect(() => {
    const isEmailValid = email.trim().length > 3;
    const emailInput = containerRef.current?.querySelector<HTMLInputElement>(
      'input[name="email"]'
    );
    const submitBtn = submitBtnRef.current;

    if (isEmailValid) {
      emailInput?.classList.add("valid");
      gearsTlsRef.current.forEach((tl) => {
        if (tl.paused()) {
          tl.play();
          gsap.fromTo(tl, { timeScale: 0 }, { timeScale: 1 });
        }
      });
    } else {
      emailInput?.classList.remove("valid");
      gearsTlsRef.current.forEach((tl) => {
        if (!tl.paused()) {
          gsap.to(tl, {
            timeScale: 0,
            onComplete: () => {
              tl.pause();
            },
          });
        }
      });
      stateRef.current.sprayRepeatCounter = 0;
      if (submitBtn) {
        submitBtn.style.setProperty("--btn-text-opacity", "1");
      }
    }
  }, [email]);

  // Sync Password validity & Spiral/Scale/Hand
  useEffect(() => {
    const isPasswordValid = password.trim().length >= 6;
    const passwordInput = containerRef.current?.querySelector<HTMLInputElement>(
      'input[name="password"]'
    );

    if (isPasswordValid) {
      passwordInput?.classList.add("valid");
      emailTlRef.current?.play();
    } else {
      passwordInput?.classList.remove("valid");
      emailTlRef.current?.reverse();
      stateRef.current.handClosed = false;
    }
  }, [password]);

  // Sync Checkbox & Pulley system
  const handleCheckboxChange = (checked: boolean) => {
    setRememberMe(checked);
    const container = containerRef.current;
    if (!container) return;

    // Pulling timeline helper
    const submitBtn = submitBtnRef.current;
    const svg = svgRef.current;
    if (!submitBtn || !svg) return;

    const checkboxPullLine = svg.querySelector<SVGLineElement>(".checkbox-pull-line");
    const checkboxPullCircle = svg.querySelector<SVGGElement>(".checkbox-pull-circle");
    const btnPullLine = svg.querySelector<SVGPathElement>(".submit-btn-connector");
    const btnHandlerCircle = svg.querySelector<SVGCircleElement>(".submit-btn-circle");

    if (pullingTlRef.current) pullingTlRef.current.kill();

    const isFixed = stateRef.current.handClosed;

    const animatePullingLine = () => {
      const btnOriginX = 260;
      const btnOriginY = -76;
      const btnWidth = 270;
      const currentRotation = Number(gsap.getProperty(submitBtn, "rotation")) || -90;
      const deg = ((currentRotation - 4) * Math.PI) / 180;

      const endX = btnOriginX - (btnWidth - 20) * Math.cos(deg);
      const endY = btnOriginY - (btnWidth - 20) * Math.sin(deg);

      if (btnHandlerCircle) {
        gsap.set(btnHandlerCircle, { attr: { cx: endX, cy: endY } });
      }

      const handle = 7;
      const r = 10;
      let btnPullLinePath =
        "M" +
        (-r - handle) +
        "," +
        (250 - (isFixed ? 0 : stateRef.current.pullProgress * 300));
      btnPullLinePath += "h" + 2 * handle;
      btnPullLinePath += "h" + -handle;
      btnPullLinePath += " V" + (44 - stateRef.current.pullProgress * 130);
      const slideAngle =
        0.3 * Math.PI * (1 - (isFixed ? 1 : 0.5) * stateRef.current.pullProgress);
      const dx = r * Math.cos(slideAngle);
      const dy = -r * Math.sin(slideAngle);
      btnPullLinePath += "a" + r + ", " + r + " 0 0 1 " + (r + dx) + " " + dy;
      btnPullLinePath += " L" + endX + "," + endY;

      if (btnPullLine) {
        gsap.set(btnPullLine, { attr: { d: btnPullLinePath }, strokeWidth: 3 });
      }
    };

    const tl = gsap.timeline({
      defaults: { ease: "power1.inOut", duration: 1 },
      onUpdate: animatePullingLine,
    });

    if (checkboxPullLine && checkboxPullCircle) {
      if (isFixed && checked) {
        tl.to(stateRef.current, { pullProgress: 1 }, 0)
          .to(submitBtn, { rotation: 0 }, 0)
          .to(stateRef.current, { duration: 0.1, sumbitBtnOnPlace: 1 }, 0.9)
          .to(checkboxPullLine, { attr: { y2: -86 } }, 0)
          .to(checkboxPullCircle, { y: -86 }, 0);
      } else if (!isFixed && checked) {
        tl.to(stateRef.current, { pullProgress: 1 }, 0)
          .to(checkboxPullLine, { attr: { y2: -86 } }, 0)
          .to(checkboxPullCircle, { y: -86 }, 0);
      } else if (isFixed && !checked) {
        tl.to(stateRef.current, { pullProgress: 0 }, 0)
          .to(submitBtn, { rotation: -90 }, 0)
          .to(stateRef.current, { duration: 0.1, sumbitBtnOnPlace: 0 }, 0)
          .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
          .to(checkboxPullCircle, { y: 44 }, 0);
      } else if (!isFixed && !checked) {
        tl.to(stateRef.current, { pullProgress: 0 }, 0)
          .to(checkboxPullLine, { attr: { y2: 44 } }, 0)
          .to(checkboxPullCircle, { y: 44 }, 0);
      }
    }

    pullingTlRef.current = tl;
  };

  // Submission Dispersal Animation
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger submission dispersal animation
    if (svgRef.current) {
      gsap.to(svgRef.current.querySelectorAll("svg > *"), {
        duration: 0.2,
        opacity: 0,
        stagger: {
          each: 0.03,
          from: "random",
          ease: "none",
        },
      });
    }
    if (formContainerRef.current) {
      gsap.to(formContainerRef.current.querySelectorAll(".form-row"), {
        delay: 0.2,
        duration: 0.15,
        opacity: 0.2,
        stagger: 0.05,
      });
    }

    onSubmit(e);
  };

  // Reset visual dispersal if submit failed and busy turns false
  useEffect(() => {
    if (!busy && svgRef.current && formContainerRef.current) {
      gsap.to(svgRef.current.querySelectorAll("svg > *"), {
        duration: 0.3,
        opacity: 1,
      });
      gsap.to(formContainerRef.current.querySelectorAll(".form-row"), {
        duration: 0.3,
        opacity: 1,
      });
    }
  }, [busy]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
      {/* Layer 2: Container Card (sized to Rube Goldberg Machine with Rich Glassmorphism) */}
      <div
        ref={containerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "900px",
          height: "680px",
        }}
        className="relative transition-transform duration-150 ease-out shrink-0 rounded-[32px] bg-white/70 dark:bg-[#070e1e]/75 backdrop-blur-3xl border border-white/80 dark:border-white/10 shadow-[0_30px_90px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)_inset] dark:shadow-[0_35px_100px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)_inset] [--card-bg-fill:#ffffff] dark:[--card-bg-fill:#070e1e]"
      >
        {/* Ambient backlight illumination under glass card */}
        <div className="absolute -inset-1.5 rounded-[36px] bg-gradient-to-tr from-blue-500/20 via-indigo-500/10 to-amber-500/20 blur-2xl opacity-60 dark:opacity-40 pointer-events-none -z-10" />

        {/* Elegant Micro-Header inside glass card */}
        <div className="absolute top-5 left-8 flex items-center gap-2.5 text-[10px] font-semibold tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase pointer-events-none select-none">
          <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          <span>BLX REALTY MECHANICAL AUTHENTICATION</span>
        </div>

        {/* Layer 3: HTML Interactive Form (aligned to optical center) */}
        <form
          ref={formContainerRef}
          onSubmit={handleFormSubmit}
          style={{
            top: "calc(50% - 92px)",
            left: "calc(50% + 50px)",
            transform: "translate(-50%, -50%)",
          }}
          className="form-container absolute z-20 w-[270px] space-y-0"
        >
          {/* Row 1: Email */}
          <div className="form-row w-full h-[60px] flex items-center justify-start relative">
            <div className="relative w-full">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10 transition-colors" />
              <input
                id="rube-auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email address"
                className="w-full h-[38px] pl-9 pr-3 text-sm bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-xl outline-none shadow-sm transition-all [&.valid]:border-slate-800 dark:[&.valid]:border-amber-400 focus:border-blue-600 dark:focus:border-amber-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-amber-400/10 font-medium"
              />
            </div>
          </div>

          {/* Row 2: Password */}
          <div className="form-row w-full h-[60px] flex items-center justify-start relative">
            <div className="relative w-full">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10 transition-colors" />
              <input
                id="rube-auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!rememberMe) {
                      handleCheckboxChange(true);
                    }
                    handleFormSubmit(e);
                  }
                }}
                placeholder="password (min 6 chars)"
                className="w-full h-[38px] pl-9 pr-9 text-sm bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-xl outline-none shadow-sm transition-all [&.valid]:border-slate-800 dark:[&.valid]:border-amber-400 focus:border-blue-600 dark:focus:border-amber-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-amber-400/10 font-mono text-xs"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Row 3: Checkbox / Remember me */}
          <div className="form-row w-full h-[60px] flex items-center justify-start">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 dark:text-slate-300 font-medium select-none">
              <input
                id="rube-auth-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                className="size-4.5 border border-slate-300 dark:border-slate-600 rounded-md accent-amber-500 bg-white dark:bg-slate-900 shadow-sm cursor-pointer"
              />
              <span>remember my session</span>
            </label>
          </div>

          {/* Row 4: Submit Button with Physics Anchor */}
          <div className="form-row w-full h-[60px] flex items-center justify-start relative">
            <button
              ref={submitBtnRef}
              type="submit"
              disabled={busy}
              className="auth-submit-btn group w-full h-[42px] cursor-pointer rounded-xl border border-slate-300/80 dark:border-blue-500/30 bg-slate-900 hover:bg-slate-800 dark:bg-gradient-to-r dark:from-[#0d1c3a] dark:via-[#162b57] dark:to-[#0d1c3a] dark:hover:from-[#132854] dark:hover:to-[#162b57] text-white shadow-lg shadow-slate-900/15 dark:shadow-blue-900/30 transition-all font-semibold text-sm flex items-center justify-center gap-2 tracking-wide ring-1 ring-white/20"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span className="text-white font-semibold">authenticating…</span>
                </>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-white">
                  <span className="font-semibold tracking-wide text-white">sign in to portal</span>
                  <ArrowRight className="size-4 text-white shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </button>
          </div>
        </form>

        {/* 1000x1000 Precision Mechanical SVG Overlay (shifted to match optical center) */}
        <svg
          ref={svgRef}
          viewBox="0 0 1000 1000"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            {
              top: "calc(50% - 92px)",
              left: "calc(50% + 50px)",
              transform: "translate(-50%, -50%)",
              "--bg-fill": "var(--card-bg-fill, #ffffff)",
              "--timing-bg": "rgb(148, 163, 184)",
              "--timing-chain": "rgb(255, 255, 255)",
              "--sprayer-body": "rgb(241, 245, 249)",
              "--sprayer-band": "rgb(203, 213, 225)",
            } as React.CSSProperties
          }
          className="absolute w-[1000px] h-[1000px] pointer-events-none text-slate-900 dark:text-slate-200 stroke-current fill-none stroke-[1.2px]"
        >
          {/* Defs / Gradients */}
          <defs>
            <radialGradient id="sprayGrad" cx="50%" cy="50%" r="50%" fx="100%" fy="50%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="1" />
            </radialGradient>
            <marker
              id="ball"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerUnits="strokeWidth"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <circle cx="5" cy="5" r="3" fill="currentColor" stroke="none" />
            </marker>
          </defs>

          {/* Reference guide rect */}
          <rect x="710" y="527" width="16" height="47" rx="10" ry="10" />

          {/* 1. Grabbing Hand (Open Fingers) */}
          <g className="grabbing-hand">
            <path d="M48.89,54.39c-3.51.76-15.72,3-22.83-.68a14,14,0,0,0-6.41-1.52h0A3.79,3.79,0,0,1,17,51.09a3.7,3.7,0,0,1-1.1-2.64V27.75A3.75,3.75,0,0,1,19.63,24H24.1" />
            <path
              className="grabbing-hand-finger-open"
              d="M57.05,29.76l24.82,0a4.07,4.07,0,0,0,4.11-4h0a4.07,4.07,0,0,0-4-4.11L48.69,21.3"
            />
            <path
              className="grabbing-hand-finger-open"
              d="M59.34,37.74l28.81.61a4.06,4.06,0,0,0,4.14-4h0a4.06,4.06,0,0,0-4-4.15L57,29.64"
            />
            <path
              className="grabbing-hand-finger-open"
              d="M57.13,45.9l26.94.78a4.07,4.07,0,0,0,4.15-4h0a4.07,4.07,0,0,0-4-4.14l-24.84-.8"
            />
            <path
              className="grabbing-hand-finger-open"
              d="M48.89,54.39l27.82.36a4.06,4.06,0,0,0,4.2-3.93h0A4.06,4.06,0,0,0,77,46.62l-19.88-.78"
            />
            <path
              className="grabbing-hand-finger-open"
              d="M40.78,28c5.75-5.85,12.66-22,10.5-25.88-2.25-4.09-6,.1-14.73,8.66C30.84,16.36,30.91,17.1,24.32,24"
            />
          </g>

          {/* 2. Pull System & Pulley Lines */}
          <g className="pull-system">
            <line className="checkbox-pull-line" x1="0" y1="0" x2="0" y2="0" />
            <g className="checkbox-pull-circle">
              <circle cx="0" cy="0" r="10" />
              <circle cx="0" cy="0" r="4" fill="currentColor" />
            </g>
            <circle className="submit-btn-circle" cx="0" cy="0" r="3" stroke="none" fill="currentColor" />
            <path className="submit-btn-connector" d="" />
          </g>

          {/* 3. Spray Hand & Sprayer */}
          <g className="spray-hand-container">
            <g className="pushing-hand">
              <circle cx="18" cy="0" r="5" fill="currentColor" />
              <circle cx="18" cy="-70" r="5" fill="currentColor" />
              <path d="M18,-70 v70" strokeWidth="4" />
              <g>
                <path d="M25.3,32.9V60.2a4.2,4.2,0,0,0,4.2,4.2h0a4.2,4.2,0,0,0,4.2-4.2V26.7" />
                <rect
                  x="3.9"
                  y="18.4"
                  width="8.4"
                  height="21.47"
                  rx="3.7"
                  transform="translate(10.2 -1) rotate(19.4)"
                />
                <path d="M20.9,24a3.4,3.4,0,0,0-1.7-1.1h0a4.2,4.2,0,0,0-5.4,2.5L9.1,38.8a4.3,4.3,0,0,0,2.6,5.4h0a4.3,4.3,0,0,0,5.4-2.6l1.8-5.1" />
                <path d="M18.4,37.9,17.3,43a4.2,4.2,0,0,0,3.4,4.9h0a4.3,4.3,0,0,0,4.5-2.3" />
                <path
                  className="hand-fill"
                  fill="var(--bg-fill, white)"
                  d="M29,16.8c-6.4,5-15,13.2-12.8,17.8s6,.7,15.8-6.7c6.4-4.8,7.4-12.6.5-19.2V4.2A3.8,3.8,0,0,0,28.7.5H8A3.5,3.5,0,0,0,5.4,1.6,3.7,3.7,0,0,0,4.3,4.2V8.7"
                />
                <path d="M4.3,8.7c-5.8,6.4-3.6,20-2.2,24.8" />
              </g>
            </g>
            <g className="sprayer">
              <g className="sprayer-head">
                <rect x="82.39" y="19.85" width="13.06" height="16.79" rx="1.46" />
                <rect x="74.55" y="22.56" width="7.84" height="6.1" rx="1.13" />

                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="22.4"
                  y1="14.76"
                  x2="74.27"
                  y2="25.2"
                />
                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="21.51"
                  y1="21.12"
                  x2="74.27"
                  y2="25.2"
                />
                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="21.44"
                  y1="28.26"
                  x2="74.27"
                  y2="25.2"
                />
                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="22.37"
                  y1="35.54"
                  x2="74.27"
                  y2="25.2"
                />
                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="24.21"
                  y1="42.36"
                  x2="74.27"
                  y2="25.2"
                />
                <line
                  className="spray-line"
                  stroke="#94a3b8"
                  strokeDasharray="8 5"
                  x1="24.31"
                  y1="7.78"
                  x2="74.27"
                  y2="25.2"
                />

                <circle
                  fill="url(#sprayGrad)"
                  stroke="none"
                  className="spray-bubble"
                  cx="25.43"
                  cy="12.97"
                  r="12.47"
                />
                <circle
                  fill="url(#sprayGrad)"
                  stroke="none"
                  className="spray-bubble"
                  cx="15.6"
                  cy="25.43"
                  r="15.1"
                />
                <circle
                  fill="url(#sprayGrad)"
                  stroke="none"
                  className="spray-bubble"
                  cx="33.24"
                  cy="37.13"
                  r="9.21"
                />
                <circle
                  fill="url(#sprayGrad)"
                  stroke="none"
                  className="spray-bubble"
                  cx="35.92"
                  cy="19.5"
                  r="11.89"
                />
                <circle
                  fill="url(#sprayGrad)"
                  stroke="none"
                  className="spray-bubble"
                  cx="18.82"
                  cy="34.45"
                  r="11.89"
                />
              </g>
              <path
                d="M89,42h0a21.3,21.3,0,0,1,21.3,21.3v56.48a5.06,5.06,0,0,1-5.06,5.06H72.6a5.06,5.06,0,0,1-5.06-5.06V63.4A21.45,21.45,0,0,1,89,42Z"
                fill="var(--sprayer-body, #fff)"
              />
              <rect
                x="78.3"
                y="36.64"
                width="21.24"
                height="6.15"
                rx="1.93"
                fill="var(--sprayer-body, #fff)"
              />
              <rect
                x="76.33"
                y="71.46"
                width="33.96"
                height="23.23"
                fill="var(--sprayer-band, #cccccc)"
              />
            </g>
          </g>

          {/* 4. Gears System */}
          <g>
            <line className="gear-connector" x1="0" x2="0" y1="0" y2="0" />
            <g ref={gearsContainerRef} className="gears" />
          </g>

          {/* 5. Grabbing Hand (Closed Fingers) */}
          <g className="grabbing-hand">
            <g fill="var(--bg-fill, #ffffff)">
              <rect
                className="grabbing-hand-finger-closed"
                x="44.79"
                y="13.38"
                width="8.42"
                height="22.15"
                rx="3.67"
                transform="translate(20.57 71.26) rotate(-85.25)"
              />
              <rect
                className="grabbing-hand-finger-closed"
                x="44.08"
                y="39.17"
                width="8.42"
                height="21.47"
                rx="3.67"
                transform="translate(-5.44 93.9) rotate(-85.25)"
              />
              <rect
                className="grabbing-hand-finger-closed"
                x="45.68"
                y="30.71"
                width="8.42"
                height="22.57"
                rx="3.67"
                transform="matrix(0.08, -1, 1, 0.08, 3.91, 88.24)"
              />
              <rect
                className="grabbing-hand-finger-closed"
                x="44.98"
                y="22.21"
                width="8.42"
                height="22.57"
                rx="3.67"
                transform="matrix(0.08, -1, 1, 0.08, 11.74, 79.74)"
              />
              <path
                className="grabbing-hand-finger-closed"
                d="M32.18,27.42c5,6.46,13.22,15.06,17.76,12.81,4.18-2.07.69-6-6.66-15.74C38.46,18.1,30.69,17.1,24.1,24"
              />
            </g>
          </g>

          {/* 6. Spiral Container & Spring */}
          <g className="spiral-container">
            <path strokeWidth="0.8" className="spiral-path" d="" />
          </g>

          {/* 7. Heavy Weight Container */}
          <g className="weight-big-container">
            <line x1="14" x2="60" y1="14" y2="14" />
            <line x1="14" x2="60" y1="14" y2="55" />
            <circle cx="14" cy="14" r="5" fill="currentColor" stroke="none" />

            <g className="weight-big" stroke="none">
              <path
                d="M25.5,16.7c.2-.6.5-1.3.7-2C31.1,3.1,23.2,0,14.3,0S-1.6,4.2,2.4,14.7a22.5,22.5,0,0,1,.8,2.4A14.4,14.4,0,0,0,0,26.2c0,8,6.5,11.6,14.5,11.6S29,34.2,29,26.2A14.6,14.6,0,0,0,25.5,16.7ZM14.4,5c5.6,0,9.3,1.9,7.1,8.5a13.5,13.5,0,0,0-7-1.8,14.6,14.6,0,0,0-7.2,1.9C5.5,7.5,8.8,5,14.4,5Z"
                fill="currentColor"
              />
              <path
                d="M15.1,15.6l-1.8-.2a9.2,9.2,0,0,0-9.1,9.2,6.2,6.2,0,0,0,.2,1.9A13.3,13.3,0,0,1,15.1,15.6Z"
                fill="var(--bg-fill, #fff)"
              />
            </g>
          </g>

          {/* 8. Balance Scale & Chains */}
          <g className="scales-container">
            <rect
              x="10"
              y="-19"
              width="30"
              height="90"
              rx="15"
              ry="15"
              strokeWidth="10"
              stroke="var(--timing-bg, #ccc)"
            />
            <rect
              className="timing-chain"
              x="10"
              y="-19"
              width="30"
              height="90"
              rx="15"
              ry="15"
              stroke="var(--timing-chain, #fff)"
            />

            <rect
              x="-31"
              y="-19"
              width="30"
              height="144"
              rx="15"
              ry="15"
              strokeWidth="10"
              stroke="var(--timing-bg, #ccc)"
            />
            <rect
              className="timing-chain"
              x="-31"
              y="-19"
              width="30"
              height="144"
              rx="15"
              ry="15"
              stroke="var(--timing-chain, #fff)"
            />

            <g className="reels-connector">
              <rect x="-8" y="3.2" width="25" height="10" rx="5" ry="5" />
              <circle cx="-1" cy="8.5" r="3" fill="currentColor" stroke="none" />
              <circle cx="9.9" cy="8.5" r="3" fill="currentColor" stroke="none" />
            </g>

            <g className="car-weight-connector">
              <rect x="-36" y="97" width="10" height="95" rx="5" ry="5" />
              <circle cx="-31" cy="103" r="3" fill="currentColor" stroke="none" />
              <circle cx="-31" cy="186" r="3" fill="currentColor" stroke="none" />
            </g>

            <line
              className="scales-moving-line"
              x1="147.6"
              y1="30.52"
              x2="40"
              y2="12"
              strokeWidth="2"
              markerStart="url(#ball)"
              markerEnd="url(#ball)"
            />
            <path fill="currentColor" d="M102.45,30.68,92,20.26c-9.89,9.9-9.89,10.47-9.89,10.47Z" />
          </g>

          {/* 9. Miniature Rolling Car & Track */}
          <g className="car-container">
            <g>
              <g className="car">
                <circle cx="17" cy="88" r="5" />
                <circle cx="17" cy="88" r="2" fill="currentColor" />
                <circle cx="32" cy="88" r="5" />
                <circle cx="32" cy="88" r="2" fill="currentColor" />

                <path d="M10,65 h30 l-5,15 h-20 l-5,-15 " fill="currentColor" />
              </g>

              <line x1="-51" y1="95" x2="145" y2="95" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
