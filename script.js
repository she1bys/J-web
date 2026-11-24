(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Background: twinkling stars + drifting hearts ---------- */
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let w, h, dpr, stars = [], hearts = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const starCount = Math.round((w * h) / 6000);
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      t: Math.random() * Math.PI * 2,
      s: Math.random() * 0.02 + 0.005,
    }));
    const heartCount = Math.max(8, Math.round(w / 90));
    hearts = Array.from({ length: heartCount }, () => newHeart(true));
  }

  function newHeart(anywhere) {
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 30,
      size: Math.random() * 10 + 6,
      speed: Math.random() * 0.35 + 0.15,
      sway: Math.random() * 1.5 + 0.5,
      phase: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.35 + 0.15,
    };
  }

  function drawHeart(x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(0, 0, -8, -4, -8, 2);
    ctx.bezierCurveTo(-8, 8, 0, 11, 0, 14);
    ctx.bezierCurveTo(0, 11, 8, 8, 8, 2);
    ctx.bezierCurveTo(8, -4, 0, 0, 0, 4);
    ctx.fillStyle = `rgba(255, 107, 154, ${alpha})`;
    ctx.shadowColor = "rgba(255, 107, 154, 0.6)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      s.t += s.s;
      const a = 0.35 + Math.sin(s.t) * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 236, 245, ${a})`;
      ctx.fill();
    }

    for (let i = 0; i < hearts.length; i++) {
      const p = hearts[i];
      p.y -= p.speed;
      p.phase += 0.01;
      const x = p.x + Math.sin(p.phase) * p.sway * 10;
      drawHeart(x, p.y, p.size, p.alpha);
      if (p.y < -30) hearts[i] = newHeart(false);
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  if (!reduceMotion) requestAnimationFrame(frame);

  /* ---------- Hearts on click / tap ---------- */
  const symbols = ["❤", "♥", "❣", "💕", "💗"];

  function burst(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "pop-heart";
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.fontSize = 14 + Math.random() * 22 + "px";
      el.style.setProperty("--dx", (Math.random() - 0.5) * 160 + "px");
      el.style.setProperty("--r", (Math.random() - 0.5) * 60 + "deg");
      el.style.animationDelay = i * 40 + "ms";
      document.body.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    }
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#love-btn")) return;
    burst(e.clientX, e.clientY, 4);
  });

  /* ---------- Love button ---------- */
  const btn = document.getElementById("love-btn");
  const counter = document.getElementById("counter");
  const messages = [
    "I love you, Joana.",
    "Te amo, Joana.",
    "Je t'aime, Joana.",
    "Ti amo, Joana.",
    "Ich liebe dich, Joana.",
    "Te quiero, Joana.",
    "Seni seviyorum, Joana.",
    "愛してる, Joana.",
    "사랑해, Joana.",
    "Ik hou van je, Joana.",
  ];
  let taps = 0;

  btn.addEventListener("click", () => {
    const r = btn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 14);
    counter.textContent = messages[taps % messages.length];
    taps++;
  });

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
