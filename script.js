// ===== Canvas setup =====
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");

function resize() {
  var dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ===== Helpers =====
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// ===== Tree points (cone) =====
var STAR_COUNT = 1400;
var tree = [];        // lights
var ornaments = [];   // bigger balls

// tree dimensions (tweakable)
var baseRadius = 240;
var treeHeight = 520;

// center (slightly lower)
function center() {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 + 120 };
}

// Build tree points
for (var i = 0; i < STAR_COUNT; i++) {
  var t = Math.random();                 // 0..1 from top to bottom
  var y = (t * treeHeight) - treeHeight * 0.70;

  // radius gets bigger downwards
  var r = (t) * baseRadius * rand(0.35, 1.0);
  var ang = rand(0, Math.PI * 2);

  var p = {
    x3: Math.cos(ang) * r,
    z3: Math.sin(ang) * r,
    y3: y,
    tw: rand(0, Math.PI * 2),
    sp: rand(0.6, 2.2),
    size: rand(0.7, 1.8),
    hue: Math.floor(rand(0, 360)),
    kind: (Math.random() < 0.12) ? "color" : "ice"
  };

  tree.push(p);

  // Some ornaments (bigger)
  if (Math.random() < 0.06 && t > 0.25) {
    ornaments.push({
      x3: p.x3,
      z3: p.z3,
      y3: p.y3,
      r: rand(3.5, 7.5),
      hue: Math.floor(rand(0, 360))
    });
  }
}

// ===== 3D -> 2D projection =====
function project(p, rotY) {
  var cos = Math.cos(rotY), sin = Math.sin(rotY);
  var x = p.x3 * cos + p.z3 * sin;
  var z = -p.x3 * sin + p.z3 * cos;

  var c = center();
  var fov = 640; // camera distance
  var scale = fov / (fov + z + 280);

  return {
    x: c.x + x * scale,
    y: c.y + p.y3 * scale,
    s: scale,
    depth: z
  };
}

// ===== Fireworks system (canvas) =====
var fireworks = []; // sparks
var rockets = [];   // rising rockets
var newYearBoom = false;
var countdownDone = false;

function spawnRocket() {
  rockets.push({
    x: rand(window.innerWidth * 0.2, window.innerWidth * 0.8),
    y: window.innerHeight + 20,
    vx: rand(-15, 15),
    vy: rand(-520, -650),
    t: 0,
    hue: Math.floor(rand(0, 360))
  });
}

function explode(x, y, hue) {
  var count = 90;
  for (var i = 0; i < count; i++) {
    var a = rand(0, Math.PI * 2);
    var sp = rand(80, 320);
    fireworks.push({
      x: x,
      y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      hue: hue
    });
  }
}

function updateFireworks(dt) {
  // rockets
  for (var i = rockets.length - 1; i >= 0; i--) {
    var r = rockets[i];
    r.t += dt;
    r.vy += 420 * dt; // gravity
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    // explode near top
    if (r.vy > -60 || r.y < window.innerHeight * 0.25) {
      explode(r.x, r.y, r.hue);
      rockets.splice(i, 1);
    }
  }

  // sparks
  for (var j = fireworks.length - 1; j >= 0; j--) {
    var p = fireworks[j];
    p.vy += 420 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 1.2 * dt);
    p.vy *= (1 - 1.0 * dt);
    p.life -= 1.15 * dt;

    if (p.life <= 0) fireworks.splice(j, 1);
  }
}

function drawFireworks() {
  // rockets trail + sparks
  for (var i = 0; i < rockets.length; i++) {
    var r = rockets[i];
    ctx.fillStyle = "hsla(" + r.hue + ", 100%, 75%, 0.8)";
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (var j = 0; j < fireworks.length; j++) {
    var p = fireworks[j];
    ctx.fillStyle = "hsla(" + p.hue + ", 100%, 70%, " + clamp(p.life, 0, 1) + ")";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Countdown =====
var cd = document.getElementById("countdown");
var cdVal = 3;

function startCountdown() {
  cd.classList.add("show");
  cd.textContent = String(cdVal);

  var timer = setInterval(function () {
    cdVal--;

    if (cdVal > 0) {
      cd.textContent = String(cdVal);
    } else {
      cd.textContent = "";
      setTimeout(function () {
        cd.classList.remove("show");
      }, 450);

      clearInterval(timer);
      countdownDone = true;
      newYearBoom = true;

      // big first boom
      for (var k = 0; k < 3; k++) spawnRocket();
    }
  }, 1000);
}

// page load: start after 0.8s
setTimeout(startCountdown, 800);

// ===== Animation loop =====
var prev = performance.now();

function frame(now) {
  var dt = (now - prev) / 1000;
  prev = now;

  // background fade (NOT too bright)
  ctx.fillStyle = "rgba(0,0,0," + (18 / 100) + ")"; // 0.18
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // tree rotation
  var rotY = now * 0.00075;

  // sort by depth
  var pts = [];
  for (var i = 0; i < tree.length; i++) {
    var s = tree[i];
    var pr = project(s, rotY);
    pts.push({ s: s, p: pr });
  }
  pts.sort(function (a, b) { return a.p.depth - b.p.depth; });

  // draw tree lights
  for (var n = 0; n < pts.length; n++) {
    var it = pts[n];
    var s0 = it.s;
    var p0 = it.p;

    // twinkle
    s0.tw += dt * s0.sp;
    var tw = 0.55 + 0.45 * Math.sin(s0.tw);  // 0.1..1 range-ish

    var baseR = Math.max(0.6, s0.size * (0.85 + tw * 0.6)) * p0.s;
    var glowR = baseR * 3.2;

    // color choice
    var alpha = 0.15 + tw * 0.35; // reduced => less "beyaz patlama"

    if (s0.kind === "color") {
      // colorful fairy lights
      ctx.fillStyle = "hsla(" + s0.hue + ", 100%, 70%, " + (alpha * 0.75) + ")";
    } else {
      // icy white-blue lights
      ctx.fillStyle = "rgba(210,235,255," + (alpha * 0.55) + ")";
    }

    // glow
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // core
    if (s0.kind === "color") {
      ctx.fillStyle = "hsla(" + s0.hue + ", 100%, 80%, " + (alpha + 0.20) + ")";
    } else {
      ctx.fillStyle = "rgba(255,255,255," + (alpha + 0.25) + ")";
    }

    ctx.beginPath();
    ctx.arc(p0.x, p0.y, baseR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ornaments
  for (var o = 0; o < ornaments.length; o++) {
    var ob = ornaments[o];
    var pr2 = project(ob, rotY);

    var rr = ob.r * pr2.s;

    // soft glow
    ctx.fillStyle = "hsla(" + ob.hue + ", 90%, 65%, 0.22)";
    ctx.beginPath();
    ctx.arc(pr2.x, pr2.y, rr * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // ball
    ctx.fillStyle = "hsla(" + ob.hue + ", 95%, 60%, 0.85)";
    ctx.beginPath();
    ctx.arc(pr2.x, pr2.y, rr, 0, Math.PI * 2);
    ctx.fill();

    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(pr2.x - rr * 0.25, pr2.y - rr * 0.25, rr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // top star (fixed point)
  var topStar = { x3: 0, y3: -treeHeight * 0.72, z3: 0, size: 7 };
  var tp = project(topStar, rotY);

  ctx.fillStyle = "rgba(255,220,140,0.35)";
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,240,200,0.95)";
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, 7.2, 0, Math.PI * 2);
  ctx.fill();

  // fireworks after countdown
  if (countdownDone) {
    // spawn periodically
    if (newYearBoom && Math.random() < 0.035) spawnRocket();
    updateFireworks(dt);
    drawFireworks();
  }

  requestAnimationFrame(frame);
}

// first clear
ctx.fillStyle = "rgba(0,0,0,1)";
ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
requestAnimationFrame(frame);
