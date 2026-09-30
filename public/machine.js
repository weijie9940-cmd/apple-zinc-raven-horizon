if (!window.__orbitLock) {
  window.__orbitLock = true;
  const swallow = (event) => {
    const hud = document.getElementById("hud");
    if (hud && hud.contains(event.target)) return;
    event.preventDefault();
  };
  document.addEventListener("touchmove", swallow, { passive: false });
  document.addEventListener("gesturestart", swallow, { passive: false });
}

function reviveMachine() {
  document.documentElement.classList.add("is-ready");
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
  const view = document.getElementById("view");
  const canvas = window.__machine && window.__machine.canvas;
  if (view && canvas && !view.contains(canvas)) view.appendChild(canvas);
}

if (window.__machine && window.__machine.ready) {
  reviveMachine();
} else if (!window.__machineBooting) {
  window.__machineBooting = true;
  bootMachine();
}

async function bootMachine() {
const bootTimer = setTimeout(() => {
      showError("加载三维组件超时。请检查网络后刷新页面。");
    }, 12000);

    function showError(text) {
      const loading = document.getElementById("loading");
      const error = document.getElementById("error");
      const msg = document.getElementById("error-text");
      if (loading) loading.style.display = "none";
      if (msg && text) msg.textContent = text;
      if (error) error.classList.add("show");
      const hud = document.getElementById("hud");
      if (hud) hud.style.display = "none";
    }

    let THREE;
    let OrbitControls;
    try {
      THREE = await import("three");
      ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));
      if (!THREE.WebGLRenderer || !OrbitControls) throw new Error("模块不完整");
    } catch (err) {
      clearTimeout(bootTimer);
      showError("无法加载三维组件库。请刷新页面重试，不要停留在空白画面。");
      throw err;
    }

    try {
      await start(THREE, OrbitControls);
      clearTimeout(bootTimer);
    } catch (err) {
      clearTimeout(bootTimer);
      console.error(err);
      showError("三维场景初始化失败：" + (err && err.message ? err.message : "未知错误") + "。请刷新页面重试。");
    }

    async function start(THREE, OrbitControls) {
      const R = 0.16;
      const MU_OF = {
        funnel: 0.023,
        inlet: 0.18,
        chute: 0.72,
        scurve: 1.15,
        ramp2: 0.2,
        tray: 0.18,
        pour: 1.67,
      };
      function muFor(name) {
        return MU_OF[name] || 0.2;
      }
      const G = 9.8 * 0.62;
      const DT = 1 / 120;
      const N = 400;
      const GAP = 2.2 * R;
      const M = 0.021;
      const Z1 = 12, Z2 = 36, Z3 = 60;
      const GEAR_TH = 0.09;
      const TIP_K = 0.14;
      const ROOT_K = 0.26;
      const OMEGA1 = (2 * Math.PI / 8) * (Z3 / Z1);
      const CHAIN_RISE = 3.2;
      const ZS = 14;
      const N_LINKS = 48;
      const RS = CHAIN_RISE / (Math.PI * (N_LINKS / ZS - 1));
      const CUP = 0.16;
      const SEAT_ALONG = 0.1;
      const SPIRAL_R = 1.2;
      const SPIRAL_DROP = 2.4;
      const S_DROP = 1.2;
      const S_AMP = 0.8;
      const S_WAVE = 2.0;
      const S_ALONG = S_WAVE * 2;

      const xS = -1.82;
      const yBot = 1.18;
      const zC = 0;
      const yTop = yBot + CHAIN_RISE;
      const zGear = -0.78;

      const v3 = (x, y, z) => ({ x, y, z });
      const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
      const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
      const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);
      const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
      const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
      const len = (a) => Math.hypot(a.x, a.y, a.z);
      const norm = (a) => {
        const l = len(a) || 1;
        return scale(a, 1 / l);
      };
      const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
      const mod = (a, n) => ((a % n) + n) % n;

      function chainFrame(s) {
        const L = 2 * CHAIN_RISE + 2 * Math.PI * RS;
        const straight = CHAIN_RISE;
        const arc = Math.PI * RS;
        s = mod(s, L);
        let pos, tangent, outward;
        if (s < straight) {
          const u = s / straight;
          pos = v3(xS - RS, yBot + u * straight, zC);
          tangent = v3(0, 1, 0);
          outward = v3(-1, 0, 0);
        } else if (s < straight + arc) {
          const u = (s - straight) / arc;
          const phi = Math.PI * (1 - u);
          pos = v3(xS + RS * Math.cos(phi), yTop + RS * Math.sin(phi), zC);
          tangent = norm(v3(Math.sin(phi), -Math.cos(phi), 0));
          outward = v3(Math.cos(phi), Math.sin(phi), 0);
        } else if (s < 2 * straight + arc) {
          const u = (s - straight - arc) / straight;
          pos = v3(xS + RS, yTop - u * straight, zC);
          tangent = v3(0, -1, 0);
          outward = v3(1, 0, 0);
        } else {
          const u = (s - 2 * straight - arc) / arc;
          const phi = -Math.PI * u;
          pos = v3(xS + RS * Math.cos(phi), yBot + RS * Math.sin(phi), zC);
          tangent = norm(v3(Math.sin(phi), -Math.cos(phi), 0));
          outward = v3(Math.cos(phi), Math.sin(phi), 0);
        }
        return { pos, tangent, outward, s, L };
      }

      const chainL = chainFrame(0).L;
      const pitch = (2 * Math.PI * RS) / ZS;
      const straight = CHAIN_RISE;
      const arcLen = Math.PI * RS;
      const releaseU = 0.78;
      const releaseS = straight + releaseU * arcLen;
      const scoopS = 2 * straight + arcLen + 0.5 * arcLen;

      function seatOf(frame) {
        return add(add(frame.pos, scale(frame.outward, CUP)), scale(frame.tangent, SEAT_ALONG));
      }

      const releaseSeat = seatOf(chainFrame(releaseS));
      const scoopSeat = seatOf(chainFrame(scoopS));

      const spiralStart = v3(releaseSeat.x, releaseSeat.y - R, releaseSeat.z);
      const trayEnd = v3(scoopSeat.x, scoopSeat.y - R, scoopSeat.z);
      const totalDrop = spiralStart.y - trayEnd.y;
      const extra = totalDrop - SPIRAL_DROP - S_DROP;
      if (!(extra > 0.18)) {
        throw new Error("高度预算不足，无法同时满足螺旋降深、波浪降深与链条高度");
      }
      const d1 = extra * 0.14;
      const dTray = Math.min(0.22, extra * 0.24);
      const d2 = extra - d1 - dTray;

      const dz = spiralStart.z - 0.78;
      const dx = -Math.sqrt(Math.max(0.05, SPIRAL_R * SPIRAL_R - dz * dz));
      const helixC = v3(spiralStart.x - dx, 0, 0.78);
      const theta0 = Math.atan2(spiralStart.z - helixC.z, spiralStart.x - helixC.x);

      function spiralPoint(t, winding) {
        const a = theta0 + winding * t * Math.PI * 2 * 3;
        return v3(
          helixC.x + SPIRAL_R * Math.cos(a),
          spiralStart.y - t * SPIRAL_DROP,
          helixC.z + SPIRAL_R * Math.sin(a),
        );
      }
      function exitTangent(winding) {
        const a = theta0 + winding * Math.PI * 2 * 3;
        const dAdt = winding * Math.PI * 2 * 3;
        const tx = -SPIRAL_R * Math.sin(a) * dAdt;
        const tz = SPIRAL_R * Math.cos(a) * dAdt;
        const horizontal = norm(v3(tx, 0, tz));
        const radial = norm(v3(Math.cos(a), 0, Math.sin(a)));
        return { horizontal, radial, score: dot(horizontal, radial) };
      }
      const windPlus = exitTangent(1);
      const windMinus = exitTangent(-1);
      const winding = windPlus.score >= windMinus.score ? 1 : -1;
      const chosenExit = exitTangent(winding);
      const spiralEnd = spiralPoint(1, winding);
      const ramp1End = v3(
        spiralEnd.x + chosenExit.horizontal.x * 1.2 + chosenExit.radial.x * 0.42,
        spiralEnd.y - d1,
        spiralEnd.z + chosenExit.horizontal.z * 1.2 + chosenExit.radial.z * 0.42,
      );

      const aim = norm(v3(1, 0, -0.18));
      const sDir = v3(aim.x, 0, aim.z);
      const sPerp = v3(-sDir.z, 0, sDir.x);
      const sOrigin = ramp1End;
      function sPoint(t) {
        const along = t * S_ALONG;
        const lat = S_AMP * Math.sin((2 * Math.PI * along) / S_WAVE);
        return v3(
          sOrigin.x + sDir.x * along + sPerp.x * lat,
          sOrigin.y - t * S_DROP,
          sOrigin.z + sDir.z * along + sPerp.z * lat,
        );
      }
      const sEnd = sPoint(1);

      const traySpan = 1.55;
      const toward = sub(trayEnd, sEnd);
      const towardXZ = norm(v3(toward.x, 0, toward.z));
      const flatDist = Math.hypot(toward.x, toward.z);
      const trayStart = v3(
        trayEnd.x - towardXZ.x * Math.min(traySpan, flatDist * 0.45),
        trayEnd.y + dTray,
        trayEnd.z - towardXZ.z * Math.min(traySpan, flatDist * 0.45),
      );
      const ramp2End = trayStart;

      const J = {
        spiralStart,
        spiralEnd,
        ramp1End,
        sEnd,
        ramp2End,
        trayEnd,
      };

      function lineFn(a, b) {
        return (t) => lerp(a, b, t);
      }

      const H_funnel = spiralStart.y;
      const FUNNEL_TURN = 5 * Math.PI;
      const FUNNEL_R0 = 1.25;
      const toHelix = norm(v3(helixC.x - spiralStart.x, 0, helixC.z - spiralStart.z));
      const funnelC = v3(spiralStart.x + toHelix.x * FUNNEL_R0, 0, spiralStart.z + toHelix.z * FUNNEL_R0);
      const alpha0 = Math.atan2(spiralStart.z - funnelC.z, spiralStart.x - funnelC.x);
      function funnelPoint(t) {
        const theta = t * FUNNEL_TURN;
        const radius = FUNNEL_R0 - 0.9 * t;
        const a = alpha0 + theta;
        return v3(
          funnelC.x + radius * Math.cos(a),
          H_funnel - 0.12 * t,
          funnelC.z + radius * Math.sin(a),
        );
      }

      const funnelEnd = funnelPoint(1);
      const funnelGap = Math.hypot(funnelPoint(0).x - spiralStart.x, funnelPoint(0).y - spiralStart.y, funnelPoint(0).z - spiralStart.z);
      if (funnelGap > 1e-6) throw new Error("漏斗入口没有接在提升机释放点上");

      function framePts(pts) {
        const sTab = new Float64Array(N);
        let total = 0;
        for (let i = 1; i < N; i++) {
          total += len(sub(pts[i], pts[i - 1]));
          sTab[i] = total;
        }
        const dyds = new Float64Array(N);
        dyds[0] = (pts[1].y - pts[0].y) / (sTab[1] - sTab[0] || 1);
        dyds[N - 1] = (pts[N - 1].y - pts[N - 2].y) / (sTab[N - 1] - sTab[N - 2] || 1);
        for (let i = 1; i < N - 1; i++) {
          dyds[i] = (pts[i + 1].y - pts[i - 1].y) / (sTab[i + 1] - sTab[i - 1] || 1);
        }
        const side = [];
        const up = [];
        const tangent = [];
        let prevSide = null;
        for (let i = 0; i < N; i++) {
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(N - 1, i + 1)];
          const tng = norm(sub(b, a));
          let hx = -tng.z;
          let hz = tng.x;
          const hl = Math.hypot(hx, hz);
          if (hl < 1e-6) {
            hx = prevSide ? prevSide.x : 1;
            hz = prevSide ? prevSide.z : 0;
          } else {
            hx /= hl;
            hz /= hl;
          }
          if (prevSide && hx * prevSide.x + hz * prevSide.z < 0) {
            hx = -hx;
            hz = -hz;
          }
          const sd = v3(hx, 0, hz);
          let upv = cross(sd, tng);
          if (upv.y < 0) upv = scale(upv, -1);
          upv = norm(upv);
          side.push(sd);
          up.push(upv);
          tangent.push(tng);
          prevSide = sd;
        }
        return { pts, sTab, dyds, side, up, tangent, total };
      }

      function resample(raw, n) {
        const acc = [0];
        for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + len(sub(raw[i], raw[i - 1])));
        const total = acc[acc.length - 1] || 1;
        const out = [];
        let seg = 0;
        for (let i = 0; i < n; i++) {
          const target = (i / (n - 1)) * total;
          while (seg < acc.length - 2 && acc[seg + 1] < target) seg++;
          const span = acc[seg + 1] - acc[seg] || 1;
          const u = (target - acc[seg]) / span;
          out.push(lerp(raw[seg], raw[Math.min(raw.length - 1, seg + 1)], u));
        }
        return out;
      }

      function buildTrackFromPts(raw) {
        return framePts(resample(raw, N));
      }

      function buildTrack(fn) {
        const pts = [];
        for (let i = 0; i < N; i++) pts.push(fn(i / (N - 1)));
        return framePts(pts);
      }

      function cubicPoint(p0, p1, p2, p3, u) {
        const a = lerp(p0, p1, u);
        const b = lerp(p1, p2, u);
        const c = lerp(p2, p3, u);
        return lerp(lerp(a, b, u), lerp(b, c, u), u);
      }

      function descendingBezier(p0, t0, p3, t3) {
        const span = Math.max(len(sub(p3, p0)), 1e-4);
        let h = span * 0.55;
        let best = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const pts = [];
          let rise = 0;
          let prevY = p0.y;
          const steps = 72;
          for (let i = 0; i <= steps; i++) {
            const p = cubicPoint(p0, add(p0, scale(t0, h)), add(p3, scale(t3, -h)), p3, i / steps);
            if (i > 0) rise = Math.max(rise, p.y - prevY);
            prevY = p.y;
            pts.push(p);
          }
          pts[0] = p0;
          pts[pts.length - 1] = p3;
          best = pts;
          if (rise < 1e-4) return pts;
          h *= 0.82;
        }
        return best;
      }

      function tangentAngle(a, b) {
        const d = Math.max(-1, Math.min(1, dot(norm(a), norm(b))));
        return (Math.acos(d) * 180) / Math.PI;
      }

      function sample(track, s) {
        s = Math.max(0, Math.min(track.total, s));
        let lo = 0;
        let hi = track.pts.length - 1;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (track.sTab[mid] <= s) lo = mid;
          else hi = mid;
        }
        const span = track.sTab[hi] - track.sTab[lo] || 1;
        const u = (s - track.sTab[lo]) / span;
        const mix = (arr) => add(arr[lo], scale(sub(arr[hi], arr[lo]), u));
        return {
          pos: mix(track.pts),
          tangent: norm(mix(track.tangent)),
          side: norm(mix(track.side)),
          up: norm(mix(track.up)),
          dyds: track.dyds[lo] * (1 - u) + track.dyds[hi] * u,
        };
      }

      function ballCenter(track, s) {
        const smp = sample(track, s);
        if (track.centerline) return smp.pos;
        return add(smp.pos, scale(smp.up, R));
      }

      function ballPolyline(track, s0, s1, steps) {
        const out = [];
        for (let i = 0; i <= steps; i++) out.push(ballCenter(track, s0 + (s1 - s0) * (i / steps)));
        return out;
      }

      function floorPolyline(track, s0, s1, steps) {
        const out = [];
        for (let i = 0; i <= steps; i++) out.push(sample(track, s0 + (s1 - s0) * (i / steps)).pos);
        return out;
      }

      function toFloorPts(ballPts) {
        const framed = framePts(resample(ballPts, N));
        const out = [];
        for (let i = 0; i < N; i++) out.push(sub(framed.pts[i], scale(framed.up[i], R)));
        return out;
      }

      function forwardTangent(track, s) {
        const a = ballCenter(track, Math.max(0, s - 0.015));
        const b = ballCenter(track, Math.min(track.total, s + 0.015));
        return norm(sub(b, a));
      }

      const funnelTrack = buildTrack((t) => funnelPoint(t));
      const sTrack = buildTrack(sPoint);
      const ramp2Track = buildTrack((t) => lerp(J.sEnd, J.ramp2End, t));
      const trayTrack = buildTrack((t) => lerp(J.ramp2End, J.trayEnd, t));
      funnelTrack.name = "funnel";
      sTrack.name = "scurve";
      ramp2Track.name = "ramp2";
      trayTrack.name = "tray";

      const FILLET_L = 2.5 * R;
      const axisX = funnelC.x;
      const axisZ = funnelC.z;
      const discBottom = H_funnel - 0.12 - 0.15 * R - 0.08;
      let yFloor = Math.max(ramp1End.y + 0.55, discBottom - 1.15);
      let yOutlet = yFloor + 1.5 * R;
      if (discBottom - yOutlet < 0.55) {
        yOutlet = discBottom - 0.55;
        yFloor = yOutlet - 1.5 * R;
      }
      if (!(yFloor > ramp1End.y + 0.08)) throw new Error("接应斜槽高度不够，无法保持下坡");
      const J_PIPE_TOP = v3(axisX, discBottom, axisZ);
      const J_PIPE_EXIT = v3(axisX, yOutlet, axisZ);

      function arcCubic(p0, t0, t3, arcLen) {
        t0 = norm(t0);
        t3 = norm(t3);
        const cr = cross(t0, t3);
        const alpha = Math.acos(Math.max(-1, Math.min(1, dot(t0, t3))));
        if (len(cr) < 1e-5 || alpha < 1e-3) {
          const end = add(p0, scale(t0, arcLen));
          return { pts: [p0, end], end, tangent: t0 };
        }
        const A = norm(cr);
        const rho = arcLen / alpha;
        const n = norm(cross(A, t0));
        const C = add(p0, scale(n, rho));
        const v0 = sub(p0, C);
        const cos = Math.cos(alpha);
        const sin = Math.sin(alpha);
        const end = add(C, add(scale(v0, cos), scale(cross(A, v0), sin)));
        const h = rho * (4 / 3) * Math.tan(alpha / 4);
        const c1 = add(p0, scale(t0, h));
        const c2 = add(end, scale(t3, -h));
        const steps = 64;
        const pts = [];
        for (let i = 0; i <= steps; i++) pts.push(cubicPoint(p0, c1, c2, end, i / steps));
        pts[0] = p0;
        pts[pts.length - 1] = end;
        return { pts, end, tangent: t3 };
      }

      function guideCubic(p0, t0, p3, t3) {
        const d0 = norm(t0);
        const d3 = norm(t3);
        const dist = Math.max(len(sub(p3, p0)), 1e-4);
        const alpha = Math.acos(Math.max(-1, Math.min(1, dot(d0, d3))));
        let h = dist / 3;
        if (alpha > 1e-3) {
          const rho = dist / (2 * Math.sin(Math.max(alpha, 0.2) / 2));
          h = Math.min(dist * 0.55, (4 / 3) * Math.tan(Math.min(alpha, 1.2) / 4) * rho);
        }
        const c1 = add(p0, scale(d0, h));
        const c2 = add(p3, scale(d3, -h));
        const pts = [];
        for (let i = 0; i <= 80; i++) pts.push(cubicPoint(p0, c1, c2, p3, i / 80));
        pts[0] = p0;
        pts[pts.length - 1] = p3;
        return pts;
      }

      function filletCubic(p0, t0, p3, t3, steps) {
        const d0 = norm(t0);
        const d3 = norm(t3);
        const dist = Math.max(len(sub(p3, p0)), 1e-4);
        const n = steps || 80;
        function build(h0, h3) {
          const c1 = add(p0, scale(d0, h0));
          const c2 = add(p3, scale(d3, -h3));
          const pts = [];
          for (let i = 0; i <= n; i++) pts.push(cubicPoint(p0, c1, c2, p3, i / n));
          pts[0] = p0;
          pts[pts.length - 1] = p3;
          return pts;
        }
        function score(pts) {
          const acc = [0];
          for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])));
          const total = acc[acc.length - 1] || 1;
          const m = 36;
          let peak = 0;
          let rise = 0;
          let prev = null;
          let prevT = null;
          let seg = 0;
          for (let k = 0; k <= m; k++) {
            const target = (k / m) * total;
            while (seg < acc.length - 2 && acc[seg + 1] < target) seg++;
            const span = acc[seg + 1] - acc[seg] || 1;
            const u = (target - acc[seg]) / span;
            const p = lerp(pts[seg], pts[Math.min(pts.length - 1, seg + 1)], u);
            if (prev) {
              rise = Math.max(rise, p.y - prev.y);
              const t = sub(p, prev);
              if (prevT && len(t) > 1e-8 && len(prevT) > 1e-8) peak = Math.max(peak, tangentAngle(prevT, t));
              if (len(t) > 1e-8) prevT = t;
            }
            prev = p;
          }
          return { peak, rise };
        }
        let best = null;
        let bestPeak = Infinity;
        for (let i = 1; i <= 8; i++) {
          for (let j = 1; j <= 8; j++) {
            const h0 = dist * i * 0.12;
            const h3 = dist * j * 0.12;
            const pts = build(h0, h3);
            const sc = score(pts);
            if (sc.rise > 0.003) continue;
            if (sc.peak < bestPeak) {
              bestPeak = sc.peak;
              best = pts;
            }
          }
        }
        if (!best) best = build(dist * 0.35, dist * 0.35);
        return best;
      }

      function dropY(pts) {
        if (!pts.length) return pts;
        const out = [v3(pts[0].x, pts[0].y, pts[0].z)];
        for (let i = 1; i < pts.length; i++) {
          const prev = out[out.length - 1];
          const horiz = Math.hypot(pts[i].x - prev.x, pts[i].z - prev.z);
          const cap = prev.y - Math.max(2e-5, horiz * 0.006);
          out.push(v3(pts[i].x, Math.min(pts[i].y, cap), pts[i].z));
        }
        return out;
      }

      function concatPoly(parts) {
        const out = [];
        for (const part of parts) {
          for (const p of part) {
            if (!out.length || len(sub(out[out.length - 1], p)) > 1e-6) out.push(p);
          }
        }
        return out;
      }

      function maxAdj(track, s0, s1) {
        let m = 0;
        let at = 0;
        let prev = null;
        let count = 0;
        for (let i = 0; i < N; i++) {
          if (track.sTab[i] < s0 - 1e-4 || track.sTab[i] > s1 + 1e-4) continue;
          const tng = track.tangent[i];
          if (prev) {
            const ang = tangentAngle(prev, tng);
            if (ang > m) {
              m = ang;
              at = track.sTab[i];
            }
            count++;
          }
          prev = tng;
        }
        maxAdj.last = { m: count ? m : 0, at };
        return count ? m : 0;
      }

      function endTangent(track) {
        return track.tangent[N - 1];
      }

      const filletReport = [];
      const fEndBall = ballCenter(funnelTrack, funnelTrack.total);
      const tFunnelEnd = forwardTangent(funnelTrack, funnelTrack.total);
      const mouth = J_PIPE_TOP;
      if (!(fEndBall.y > mouth.y + 0.02)) throw new Error("漏斗出口没有高于管道入口");
      const inletBefore = tangentAngle(tFunnelEnd, norm(sub(mouth, fEndBall)));
      const inletPts = guideCubic(fEndBall, tFunnelEnd, mouth, v3(0, -1, 0));
      const inletTrack = buildTrackFromPts(dropY(inletPts));
      inletTrack.centerline = true;
      inletTrack.name = "inlet";
      inletTrack.dense = [{ s0: 0, s1: inletTrack.total }];
      const inletAfter = Math.max(maxAdj(inletTrack, 0, inletTrack.total), tangentAngle(endTangent(funnelTrack), inletTrack.tangent[0]));
      filletReport.push({
        name: "漏斗出口→入孔",
        before: Math.round(inletBefore * 10) / 10,
        after: Math.round(inletAfter * 100) / 100,
      });

      const Sb = ballCenter(sTrack, 0);
      const pExit = J_PIPE_EXIT;
      const slopeT = norm(sub(Sb, pExit));
      const chuteDist = len(sub(Sb, pExit));
      if (!(slopeT.y < -1e-3)) throw new Error("接应斜槽方向不是下坡");
      if (!(chuteDist > FILLET_L * 3)) throw new Error("接应斜槽太短，放不下两侧倒角");
      const run = Math.max(FILLET_L, 0.2);
      const exitArc = arcCubic(pExit, v3(0, -1, 0), slopeT, run);
      const pFilletEnd = exitArc.end;
      const exitBefore = tangentAngle(v3(0, -1, 0), slopeT);
      const link = filletCubic(pFilletEnd, exitArc.tangent, Sb, slopeT, 64);
      let chuteRaw = buildTrackFromPts(dropY(concatPoly([exitArc.pts, link])));
      chuteRaw.centerline = true;
      chuteRaw.name = "chute";
      const sFillet1 = arcLenNear(chuteRaw, pFilletEnd);

      function arcLenNear(track, pos) {
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < N; i++) {
          const q = track.centerline ? track.pts[i] : add(track.pts[i], scale(track.up[i], R));
          const d = len(sub(q, pos));
          if (d < bestD) {
            bestD = d;
            best = track.sTab[i];
          }
        }
        return best;
      }

      function joinFillet(up, down, name) {
        let chosen = null;
        const scales = [1, 1.35, 1.7, 2.1, 2.6, 3.2];
        for (const scale of scales) {
          const Lu = Math.min(FILLET_L * scale, up.total * 0.46);
          const Ld = Math.min(FILLET_L * scale, down.total * 0.46);
          const p0 = ballCenter(up, up.total - Lu);
          const p3 = ballCenter(down, Ld);
          const t0 = forwardTangent(up, up.total - Lu);
          const t3 = forwardTangent(down, Ld);
          const before = tangentAngle(forwardTangent(up, up.total), forwardTangent(down, 0));
          const bez = filletCubic(p0, t0, p3, t3, 96);
          const upPts = [];
          for (let i = 0; i <= 240; i++) upPts.push(ballCenter(up, (up.total - Lu) * (i / 240)));
          upPts[upPts.length - 1] = p0;
          const downTail = [];
          for (let i = 0; i <= 240; i++) downTail.push(ballCenter(down, Ld + (down.total - Ld) * (i / 240)));
          downTail[0] = p3;
          const upBuilt = buildTrackFromPts(upPts);
          upBuilt.centerline = true;
          upBuilt.name = up.name;
          const downBuilt = buildTrackFromPts(concatPoly([bez, downTail]));
          downBuilt.centerline = true;
          downBuilt.name = down.name;
          const seam = tangentAngle(endTangent(upBuilt), downBuilt.tangent[0]);
          let bezLen = 0;
          for (let i = 1; i < bez.length; i++) bezLen += len(sub(bez[i], bez[i - 1]));
          const local = maxAdj(downBuilt, 0, Math.min(downBuilt.total, bezLen * 1.08));
          const at = maxAdj.last.at;
          const gap = len(sub(ballCenter(upBuilt, upBuilt.total), ballCenter(downBuilt, 0)));
          chosen = { up: upBuilt, down: downBuilt, before, seam, local, gap, Lu, Ld, at, bezLen };
          if (seam < 5 && local < 5 && gap < 0.02) break;
        }
        const after = Math.max(chosen.seam, chosen.local);
        filletReport.push({
          name,
          before: Math.round(chosen.before * 10) / 10,
          after: Math.round(after * 100) / 100,
          seam: Math.round(chosen.seam * 100) / 100,
          local: Math.round(chosen.local * 100) / 100,
          gap: Math.round(chosen.gap * 1000) / 1000,
          L: Math.round(chosen.Lu * 1000) / 1000,
          at: Math.round(chosen.at * 1000) / 1000,
          bez: Math.round(chosen.bezLen * 1000) / 1000,
        });
        chosen.down.dense = [{ s0: 0, s1: Math.min(chosen.down.total, chosen.Lu + chosen.Ld) }];
        return { up: chosen.up, down: chosen.down };
      }

      const exitAfterRaw = maxAdj(chuteRaw, 0, Math.min(chuteRaw.total, sFillet1 + FILLET_L * 0.35));
      const js = joinFillet(chuteRaw, sTrack, "接应斜槽→S弯入口");
      const jr = joinFillet(js.down, ramp2Track, "S弯出口→下坡");
      const jt = joinFillet(jr.down, trayTrack, "下坡→回收槽");
      const chuteTrack = js.up;
      chuteTrack.centerline = true;
      const sExitFillet = arcLenNear(chuteTrack, pFilletEnd);
      const exitParts = {
        raw: Math.round(exitAfterRaw * 100) / 100,
        built: Math.round(maxAdj(chuteTrack, 0, Math.min(chuteTrack.total * 0.55, sExitFillet + 0.08)) * 100) / 100,
        start: Math.round(tangentAngle(v3(0, -1, 0), chuteTrack.tangent[0]) * 100) / 100,
      };
      const exitAfter = Math.max(exitParts.raw, exitParts.built, exitParts.start);
      filletReport.unshift({
        name: "管道出口→接应斜槽",
        before: Math.round(exitBefore * 10) / 10,
        after: Math.round(exitAfter * 100) / 100,
      });
      chuteTrack.dense = [
        { s0: 0, s1: Math.min(chuteTrack.total, Math.max(sExitFillet, FILLET_L) + 0.05) },
        { s0: Math.max(0, chuteTrack.total - FILLET_L * 1.15), s1: chuteTrack.total },
      ];
      const tracks = [funnelTrack, chuteTrack, jr.up, jt.up, jt.down];
      const trackNames = ["funnel", "chute", "scurve", "ramp2", "tray"];
      tracks.forEach((tr, i) => {
        tr.name = trackNames[i];
        tr.next = i < tracks.length - 1 ? i + 1 : null;
      });
      tracks[0].next = null;

      function transportFrame(track) {
        const last = N - 1;
        let up = track.up[last];
        let side = track.side[last];
        if (up.y < 0) {
          up = scale(up, -1);
          side = scale(side, -1);
        }
        side = norm(cross(track.tangent[last], up));
        up = norm(cross(side, track.tangent[last]));
        if (up.y < 0) {
          side = scale(side, -1);
          up = scale(up, -1);
        }
        track.up[last] = up;
        track.side[last] = side;
        for (let i = last - 1; i >= 0; i--) {
          const t = track.tangent[i];
          let carried = sub(track.up[i + 1], scale(t, dot(track.up[i + 1], t)));
          if (len(carried) < 1e-5) carried = track.up[i + 1];
          carried = norm(carried);
          let sd = norm(cross(t, carried));
          if (dot(sd, track.side[i + 1]) < 0) {
            sd = scale(sd, -1);
            carried = scale(carried, -1);
          }
          carried = norm(cross(sd, t));
          track.up[i] = carried;
          track.side[i] = sd;
        }
      }
      transportFrame(inletTrack);
      transportFrame(chuteTrack);
      for (const tr of tracks) if (tr.centerline && tr.name !== "funnel") transportFrame(tr);

      const slopes = [inletTrack, ...tracks].map((tr) => {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < N; i++) {
          min = Math.min(min, tr.dyds[i]);
          max = Math.max(max, tr.dyds[i]);
        }
        return { name: tr.name, min, max, total: tr.total };
      });
      const badSlope = slopes.find((s) => !(s.max < -1e-4));
      if (badSlope) throw new Error("轨道坡度不为负：" + badSlope.name + " max=" + badSlope.max);
      const sharp = filletReport.find((item) => !(item.after < 5));
      if (sharp) throw new Error("倒角后切向夹角仍 ≥ 5°：" + JSON.stringify(sharp));

      function gapOf(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      }
      const linkGaps = [];
      function mustShare(name, track, index, joint) {
        const d = gapOf(track.pts[index], joint);
        linkGaps.push({ name, d });
        if (!(d < 0.05 * R)) throw new Error(name + " 距离 " + d.toFixed(5) + " ≥ 0.05R");
        track.pts[index] = joint;
        return d;
      }
      function mustBridge(name, aTr, aI, bTr, bI) {
        const d = gapOf(aTr.pts[aI], bTr.pts[bI]);
        linkGaps.push({ name, d });
        if (!(d < 0.05 * R)) throw new Error(name + " 距离 " + d.toFixed(5) + " ≥ 0.05R");
        const joint = aTr.pts[aI];
        bTr.pts[bI] = joint;
        bTr.up[bI] = aTr.up[aI];
        bTr.side[bI] = aTr.side[aI];
        return joint;
      }
      mustShare("提升机顶部→漏斗入口", funnelTrack, 0, spiralStart);
      const J_FUNNEL_EXIT = inletTrack.pts[0];
      const dFunnelBall = gapOf(J_FUNNEL_EXIT, ballCenter(funnelTrack, funnelTrack.total));
      linkGaps.push({ name: "漏斗球出口→入孔", d: dFunnelBall });
      if (!(dFunnelBall < 0.05 * R)) throw new Error("漏斗出口没有接到入孔 " + dFunnelBall.toFixed(5));
      mustShare("入孔→管道入口", inletTrack, N - 1, J_PIPE_TOP);
      mustShare("管道出口→接应斜槽", tracks[1], 0, J_PIPE_EXIT);
      const J_CHUTE_S = mustBridge("接应斜槽→S弯入口", tracks[1], N - 1, tracks[2], 0);
      const J_S_RAMP = mustBridge("S弯出口→下坡", tracks[2], N - 1, tracks[3], 0);
      const J_RAMP_TRAY = mustBridge("下坡→回收槽", tracks[3], N - 1, tracks[4], 0);
      const J_TRAY_BALL = tracks[4].pts[N - 1];
      const queueHead = tracks[2].pts[N - 1];
      const queueTail = scoopSeat;
      const queueDir = norm(sub(queueTail, queueHead));
      const queueJoinAng = tangentAngle(tracks[2].tangent[N - 1], queueDir);
      let queueRaw;
      if (queueJoinAng < 5) {
        queueRaw = [queueHead, queueTail];
      } else {
        const span = len(sub(queueTail, queueHead));
        const lead = Math.min(FILLET_L * 2, span * 0.3);
        const join = add(queueHead, scale(queueDir, lead));
        queueRaw = concatPoly([filletCubic(queueHead, tracks[2].tangent[N - 1], join, queueDir, 48), [queueTail]]);
      }
      const queueAcc = [0];
      for (let i = 1; i < queueRaw.length; i++) queueAcc.push(queueAcc[i - 1] + len(sub(queueRaw[i], queueRaw[i - 1])));
      const queueTotal = queueAcc[queueAcc.length - 1];
      const queueHold = 2 * GAP;
      if (!(queueTotal > queueHold + 0.4)) throw new Error("排队直轨太短，排不下三颗球");
      function sliceQueue(s0, s1) {
        const out = [];
        const n = 80;
        for (let i = 0; i <= n; i++) {
          const target = s0 + (s1 - s0) * (i / n);
          let seg = 0;
          while (seg < queueAcc.length - 2 && queueAcc[seg + 1] < target) seg++;
          const span = queueAcc[seg + 1] - queueAcc[seg] || 1;
          const u = Math.max(0, Math.min(1, (target - queueAcc[seg]) / span));
          out.push(lerp(queueRaw[seg], queueRaw[Math.min(queueRaw.length - 1, seg + 1)], u));
        }
        return out;
      }
      const queueCut = queueTotal - queueHold;
      const approach = buildTrackFromPts(sliceQueue(0, queueCut));
      const queue = buildTrackFromPts(sliceQueue(queueCut, queueTotal));
      approach.centerline = true;
      queue.centerline = true;
      approach.name = "ramp2";
      queue.name = "tray";
      approach.next = 4;
      queue.next = null;
      approach.pts[0] = queueHead;
      queue.pts[N - 1] = queueTail;
      queue.pts[0] = approach.pts[N - 1];
      transportFrame(approach);
      transportFrame(queue);
      approach.up[0] = tracks[2].up[N - 1];
      approach.side[0] = tracks[2].side[N - 1];
      queue.up[0] = approach.up[N - 1];
      queue.side[0] = approach.side[N - 1];
      tracks[3] = approach;
      tracks[4] = queue;
      function assertDown(tr) {
        let max = -Infinity;
        for (let i = 0; i < N; i++) max = Math.max(max, tr.dyds[i]);
        if (!(max < -1e-4)) throw new Error(tr.name + " 坡度不为负 max=" + max);
        return max;
      }
      const queueSlope = Math.max(assertDown(approach), assertDown(queue));
      let entryNotch = null;
      function inEntryNotch(p) {
        if (!entryNotch) return false;
        const dx = p.x - entryNotch.x;
        const dz = p.z - entryNotch.z;
        const along = -(dx * entryNotch.tx + dz * entryNotch.tz);
        const lat = dx * entryNotch.sx + dz * entryNotch.sz;
        return along >= -0.05 && along <= entryNotch.L + 0.04 && Math.abs(lat) <= entryNotch.half;
      }
      const funnelIn = ballCenter(funnelTrack, 0);
      const ringFloor = funnelTrack.pts[0];
      const ringT = norm(forwardTangent(funnelTrack, 0));
      const ringTH = norm(v3(ringT.x, 0, ringT.z));
      const POUR_U = 0.62;
      const pourS = straight + POUR_U * arcLen;
      const pourSeat = seatOf(chainFrame(pourS));
      const outerRim = FUNNEL_R0 + 1.1 * R + 0.05;
      const horizR = (p) => Math.hypot(p.x - funnelC.x, p.z - funnelC.z);
      const angOf = (p) => Math.atan2(p.z - funnelC.z, p.x - funnelC.x);
      const clearR = outerRim + 0.06;
      let Lgate = 0.8 * R;
      const tipR = RS + (2 * RS) / ZS;
      const chainLoop = 2 * CHAIN_RISE + 2 * Math.PI * RS;
      function mechGap(p) {
        let best = Infinity;
        for (const zFace of [0.34, -0.34]) {
          for (let i = 0; i < ZS; i++) {
            const a = (i / ZS) * Math.PI * 2;
            for (const cy of [yTop, yBot]) {
              const d = Math.hypot(p.x - (xS + Math.cos(a) * tipR), p.y - (cy + Math.sin(a) * tipR), p.z - zFace) - R;
              if (d < best) best = d;
            }
          }
        }
        for (let i = 0; i < 96; i++) {
          const fr = chainFrame((i / 96) * chainLoop);
          for (const z of [0.36, -0.36]) {
            const d = Math.hypot(p.x - fr.pos.x, p.y - fr.pos.y, p.z - z) - R - 0.06;
            if (d < best) best = d;
          }
        }
        return best;
      }
      let Lsafe = 0.8 * R;
      for (let L = 0.8 * R; L <= 1.35; L += 0.02) {
        const p = add(funnelIn, scale(ringTH, -L));
        p.y = funnelIn.y;
        if (mechGap(p) < 0.045) break;
        Lsafe = L;
      }
      const guideLen = Math.max(0.8 * R, Lsafe);
      const gate = add(funnelIn, scale(ringTH, -guideLen));
      gate.y = funnelIn.y;
      const touch = v3(funnelIn.x, funnelIn.y, funnelIn.z);
      const mouthSide = norm(v3(-ringTH.z, 0, ringTH.x));
      entryNotch = {
        x: touch.x,
        z: touch.z,
        tx: ringTH.x,
        tz: ringTH.z,
        sx: mouthSide.x,
        sz: mouthSide.z,
        L: guideLen + 0.05,
        half: 1.1 * R + 0.04,
      };
      const raw = [pourSeat];
      for (let i = 1; i <= 36; i++) {
        const p = lerp(pourSeat, gate, i / 36);
        p.y = pourSeat.y + (gate.y - pourSeat.y) * (i / 36);
        raw.push(p);
      }
      for (let i = 1; i <= 48; i++) raw.push(lerp(gate, touch, i / 48));
      const pour = buildTrackFromPts(raw);
      pour.centerline = true;
      pour.name = "pour";
      pour.next = 0;
      pour.pts[0] = pourSeat;
      pour.pts[N - 1] = touch;
      transportFrame(pour);
      const mouthUp = v3(0, 1, 0);
      const sideSign = dot(mouthSide, funnelTrack.side[0]) < 0 ? -1 : 1;
      const lockedSide = scale(mouthSide, sideSign);
      for (let i = 1; i < N - 1; i++) {
        const along = -((pour.pts[i].x - touch.x) * ringTH.x + (pour.pts[i].z - touch.z) * ringTH.z);
        const lat = Math.abs((pour.pts[i].x - touch.x) * mouthSide.x + (pour.pts[i].z - touch.z) * mouthSide.z);
        if (along < -0.002 || along > guideLen + 0.03 || lat > 0.05) continue;
        const projected = v3(touch.x - ringTH.x * along, touch.y, touch.z - ringTH.z * along);
        pour.pts[i] = projected;
        pour.tangent[i] = ringTH;
        pour.up[i] = mouthUp;
        pour.side[i] = lockedSide;
        pour.dyds[i] = 0;
      }
      pour.pts[N - 1] = touch;
      pour.pts[0] = pourSeat;
      {
        let total = 0;
        pour.sTab[0] = 0;
        for (let i = 1; i < N; i++) {
          total += len(sub(pour.pts[i], pour.pts[i - 1]));
          pour.sTab[i] = total;
        }
        pour.total = total;
        pour.dyds[0] = (pour.pts[1].y - pour.pts[0].y) / (pour.sTab[1] || 1);
        pour.dyds[N - 1] = (pour.pts[N - 1].y - pour.pts[N - 2].y) / (pour.sTab[N - 1] - pour.sTab[N - 2] || 1);
        for (let i = 1; i < N - 1; i++) {
          pour.dyds[i] = (pour.pts[i + 1].y - pour.pts[i - 1].y) / (pour.sTab[i + 1] - pour.sTab[i - 1] || 1);
        }
      }
      let pourSlope = -Infinity;
      let guideSlope = -Infinity;
      for (let i = 0; i < N; i++) {
        if (pour.total - pour.sTab[i] <= guideLen + pour.total / N) guideSlope = Math.max(guideSlope, pour.dyds[i]);
        else pourSlope = Math.max(pourSlope, pour.dyds[i]);
      }
      if (!(pourSlope < 1e-4)) console.warn("出料滑槽上坡", pourSlope);
      if (!(guideSlope < 1e-4)) console.warn("切向引导段上坡", guideSlope);
      const pourJoin = tangentAngle(pour.tangent[N - 1], ringTH);
      const exitHeight = Math.abs(touch.y - (ringFloor.y + R));
      const floorJoin = Math.abs((pour.pts[N - 1].y - pour.up[N - 1].y * R) - ringFloor.y);
      tracks.push(pour);
      const pourIndex = tracks.length - 1;
      let radialDev = 0;
      let overDisc = 0;
      {
        for (let i = 0; i < N; i++) {
          const p = pour.pts[i];
          const q = pour.pts[Math.min(N - 1, i + 1)];
          for (const s of [p, lerp(p, q, 0.5)]) {
            if (horizR(s) > outerRim) continue;
            if (len(sub(s, pourSeat)) < 0.12) continue;
            overDisc++;
            const lat = Math.abs((s.x - touch.x) * mouthSide.x + (s.z - touch.z) * mouthSide.z);
            if (lat > radialDev) radialDev = lat;
          }
        }
      }
      if (!(overDisc > 8)) console.warn("圆盘上方没有量到滑槽整段", overDisc);
      if (!(radialDev < 0.15 * R)) console.warn("外环径向偏差", radialDev.toFixed(4));
      let ringClear = Infinity;
      {
        const iTurn = Math.max(2, Math.round((N - 1) * ((2 * Math.PI) / FUNNEL_TURN)));
        for (let i = 0; i <= iTurn; i += 2) {
          if (funnelTrack.sTab[i] < guideLen + 0.05) continue;
          const p = ballCenter(funnelTrack, funnelTrack.sTab[i]);
          for (let k = 0; k < N; k += 2) {
            if (pour.total - pour.sTab[k] < guideLen + 0.12) continue;
            const q = pour.pts[k];
            const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
            if (d < ringClear) ringClear = d;
          }
        }
      }
      if (!(ringClear > R + 1.1 * R)) console.warn("外环与滑槽相撞", ringClear.toFixed(3));
      let lapClear = Infinity;
      {
        const iTurn = Math.max(2, Math.round((N - 1) * ((2 * Math.PI) / FUNNEL_TURN)));
        const mouth = Math.max(0.55, guideLen * 3);
        for (let i = 0; i <= iTurn; i += 2) {
          if (funnelTrack.sTab[i] < mouth) continue;
          const p = ballCenter(funnelTrack, funnelTrack.sTab[i]);
          for (let k = 0; k < N; k += 2) {
            if (pour.total - pour.sTab[k] <= mouth) continue;
            const d = len(sub(p, pour.pts[k]));
            if (d < lapClear) lapClear = d;
          }
        }
      }
      if (!(lapClear > R + 1.1 * R)) console.warn("外环一整圈与滑槽相撞", lapClear.toFixed(3));
      if (!(exitHeight < 0.05 * R)) throw new Error("滑槽出口高度差 " + exitHeight.toFixed(4));
      if (!(floorJoin < 0.05 * R)) throw new Error("滑槽与环槽底面高度差 " + floorJoin.toFixed(4));
      if (!(pourJoin < 5)) throw new Error("滑槽出口与外环切向夹角 " + pourJoin.toFixed(2));
      console.log(
        "排队直轨",
        queueJoinAng.toFixed(2) + "°",
        "L=" + queueTotal.toFixed(3),
        "hold=" + queueHold.toFixed(3),
        "slope=" + queueSlope.toFixed(3),
        "出料",
        "L=" + pour.total.toFixed(3),
        "slope=" + pourSlope.toFixed(3),
        "切向",
        pourJoin.toFixed(2) + "°",
        "径向偏差",
        radialDev.toFixed(4),
        "限",
        (0.15 * R).toFixed(4),
        "出口高差",
        exitHeight.toFixed(5),
        "底面高差",
        floorJoin.toFixed(5),
        "外环净空",
        lapClear.toFixed(4),
      );
      console.log(
        "倒角 " +
          filletReport.map((item) => item.name + " " + item.before.toFixed(1) + "°→" + item.after.toFixed(2) + "°").join("；"),
      );

      const pipeSwitchY = yOutlet;
      const pipeEnterY = discBottom;
      const pipeAxisX = axisX;
      const pipeAxisZ = axisZ;
      const sPipeEnd = 0;

      const D12 = ((Z1 + Z2) * M) / 2;
      const D23 = ((Z2 + Z3) * M) / 2;
      const x3 = xS;
      const x2 = x3 - D23;
      const x1 = x2 - D12;
      const gearY = yTop;

      function gearOutline(z, m, phi, cx, cy) {
        const rp = (z * m) / 2;
        const rt = rp + m;
        const rr = rp - 1.25 * m;
        const tau = (2 * Math.PI) / z;
        const tipH = tau * TIP_K;
        const rootH = tau * ROOT_K;
        const pts = [];
        for (let i = 0; i < z; i++) {
          const a = phi + i * tau;
          const angs = [a - rootH, a - tipH, a + tipH, a + rootH];
          const rads = [rr, rt, rt, rr];
          for (let k = 0; k < 4; k++) {
            pts.push(v3(cx + Math.cos(angs[k]) * rads[k], cy + Math.sin(angs[k]) * rads[k], 0));
          }
        }
        return pts;
      }

      function segDist(a, b, c, d) {
        const ux = b.x - a.x, uy = b.y - a.y;
        const vx = d.x - c.x, vy = d.y - c.y;
        const wx = a.x - c.x, wy = a.y - c.y;
        const aa = ux * ux + uy * uy;
        const bb = ux * vx + uy * vy;
        const cc = vx * vx + vy * vy;
        const dd = ux * wx + uy * wy;
        const ee = vx * wx + vy * wy;
        const denom = aa * cc - bb * bb;
        let sN, sD = denom, tN, tD = denom;
        if (denom < 1e-12) {
          sN = 0; sD = 1; tN = ee; tD = cc;
        } else {
          sN = bb * ee - cc * dd;
          tN = aa * ee - bb * dd;
          if (sN < 0) { sN = 0; tN = ee; tD = cc; }
          else if (sN > sD) { sN = sD; tN = ee + bb; tD = cc; }
        }
        if (tN < 0) {
          tN = 0;
          if (-dd < 0) sN = 0;
          else if (-dd > aa) sN = sD;
          else { sN = -dd; sD = aa; }
        } else if (tN > tD) {
          tN = tD;
          if (-dd + bb < 0) sN = 0;
          else if (-dd + bb > aa) sN = sD;
          else { sN = -dd + bb; sD = aa; }
        }
        const sc = Math.abs(sN) < 1e-12 ? 0 : sN / sD;
        const tc = Math.abs(tN) < 1e-12 ? 0 : tN / tD;
        const dxs = a.x + sc * ux - (c.x + tc * vx);
        const dys = a.y + sc * uy - (c.y + tc * vy);
        return Math.hypot(dxs, dys);
      }

      function polyMin(a, b) {
        let m = Infinity;
        for (let i = 0; i < a.length; i++) {
          const p = a[i], q = a[(i + 1) % a.length];
          for (let j = 0; j < b.length; j++) {
            const d = segDist(p, q, b[j], b[(j + 1) % b.length]);
            if (d < m) m = d;
          }
        }
        return m;
      }

      let gearMin12 = Infinity;
      let gearMin23 = Infinity;
      const gearSteps = 24;
      for (let i = 0; i <= gearSteps; i++) {
        const p1 = (OMEGA1 * i) / gearSteps * ((2 * Math.PI) / OMEGA1);
        const p2 = Math.PI + Math.PI / Z2 - (Z1 / Z2) * p1;
        const p3 = Math.PI + (Z1 / Z3) * p1;
        gearMin12 = Math.min(gearMin12, polyMin(
          gearOutline(Z1, M, p1, x1, gearY),
          gearOutline(Z2, M, p2, x2, gearY),
        ));
        gearMin23 = Math.min(gearMin23, polyMin(
          gearOutline(Z2, M, p2, x2, gearY),
          gearOutline(Z3, M, p3, x3, gearY),
        ));
      }
      if (gearMin12 < 0.0008 || gearMin23 < 0.0008) {
        throw new Error("齿轮齿面发生穿插");
      }

      function gearGeometry(z, m, thickness) {
        const rp = (z * m) / 2;
        const rt = rp + m;
        const rr = Math.max(m * 0.4, rp - 1.25 * m);
        const tau = (2 * Math.PI) / z;
        const tipH = tau * TIP_K;
        const rootH = tau * ROOT_K;
        const shape = new THREE.Shape();
        for (let i = 0; i < z; i++) {
          const a = i * tau;
          const angs = [a - rootH, a - tipH, a + tipH, a + rootH];
          const rads = [rr, rt, rt, rr];
          for (let k = 0; k < 4; k++) {
            const x = Math.cos(angs[k]) * rads[k];
            const y = Math.sin(angs[k]) * rads[k];
            if (i === 0 && k === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
          }
        }
        shape.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, rp * 0.28, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: thickness,
          bevelEnabled: false,
          curveSegments: 2,
        });
        geo.translate(0, 0, -thickness / 2);
        geo.computeVertexNormals();
        return geo;
      }

      const canvasHost = document.getElementById("view");
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
      if (!renderer.getContext()) {
        throw new Error("当前浏览器无法创建 WebGL 画布");
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(2, 2, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x0b0e1a, 1);
      canvasHost.appendChild(renderer.domElement);

      function attachCanvas() {
        const host = document.getElementById("view");
        if (host && renderer.domElement.parentElement !== host) host.appendChild(renderer.domElement);
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0e1a);

      try {
        const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
        scene.environmentIntensity = 0.4;
        pmrem.dispose();
      } catch {
        /* 环境贴图失败时仍用灯光表现金属 */
      }

      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

      function woodTexture() {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 512;
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 90; i++) {
          const y = (i + 0.5) * (512 / 90);
          g.strokeStyle = `rgba(${80 + (i % 5) * 8}, ${52 + (i % 3) * 6}, ${28}, ${0.05 + (i % 4) * 0.025})`;
          g.lineWidth = 1 + (i % 3);
          g.beginPath();
          g.moveTo(0, y);
          for (let x = 0; x <= 512; x += 20) g.lineTo(x, y + Math.sin(x * 0.03 + i * 0.7) * 1.6);
          g.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      }
      const woodMap = woodTexture();
      woodMap.repeat.set(2.2, 2.2);
      const wood = new THREE.MeshStandardMaterial({
        map: woodMap,
        color: 0xecc48a,
        roughness: 0.75,
        metalness: 0.02,
      });
      const woodDark = new THREE.MeshStandardMaterial({
        map: woodMap,
        color: 0xd7ae72,
        roughness: 0.78,
        metalness: 0.02,
      });
      const brass = new THREE.MeshStandardMaterial({
        color: 0xd4a85a,
        metalness: 0.82,
        roughness: 0.28,
      });
      const steel = new THREE.MeshStandardMaterial({
        color: 0xc5c9d0,
        metalness: 0.9,
        roughness: 0.25,
      });
      const gearMat = new THREE.MeshStandardMaterial({
        color: 0x9aa1ab,
        metalness: 0.86,
        roughness: 0.34,
      });
      const motorMat = new THREE.MeshStandardMaterial({
        color: 0xf5b301,
        roughness: 0.42,
        metalness: 0.12,
      });
      const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x4e555f,
        metalness: 0.7,
        roughness: 0.4,
      });
      const chainMat = new THREE.MeshStandardMaterial({
        color: 0x5d646e,
        metalness: 0.75,
        roughness: 0.38,
      });

      function tubeAlong(track, sideSign, radius, yLift) {
        const curve = new THREE.Curve();
        curve.getPoint = (t, target = new THREE.Vector3()) => {
          const i = Math.min(N - 1, Math.max(0, t * (N - 1)));
          const i0 = Math.floor(i);
          const i1 = Math.min(N - 1, i0 + 1);
          const u = i - i0;
          const p0 = track.pts[i0];
          const p1 = track.pts[i1];
          const s0 = track.side[i0];
          const s1 = track.side[i1];
          const u0 = track.up[i0];
          const u1 = track.up[i1];
          const uy = u0.y + (u1.y - u0.y) * u;
          const ux = u0.x + (u1.x - u0.x) * u;
          const uz = u0.z + (u1.z - u0.z) * u;
          const drop = track.centerline ? R : 0;
          const x = p0.x + (p1.x - p0.x) * u + (s0.x + (s1.x - s0.x) * u) * 0.55 * R * sideSign + ux * (yLift - drop);
          const y = p0.y + (p1.y - p0.y) * u + (s0.y + (s1.y - s0.y) * u) * 0.55 * R * sideSign + uy * (yLift - drop);
          const z = p0.z + (p1.z - p0.z) * u + (s0.z + (s1.z - s0.z) * u) * 0.55 * R * sideSign + uz * (yLift - drop);
          return target.set(x, y, z);
        };
        return new THREE.TubeGeometry(curve, 280, radius, 7, false);
      }

      function addWoodU(track, opts) {
        const pts = [];
        const sides = [];
        const ups = [];
        const wallL = [];
        const wallR = [];
        const lo = 1.1 * R;
        const hi = 1.4 * R;
        const kappas = [];
        let seat = 0;
        const nWood = track.pts.length;
        for (let i = 0; i < nWood; i++) {
          const i0 = Math.max(0, i - 2);
          const i1 = Math.min(nWood - 1, i + 2);
          const turn = sub(track.tangent[i1], track.tangent[i0]);
          const ds = Math.max(1e-4, track.sTab[i1] - track.sTab[i0]);
          kappas.push({ k: len(turn) / ds, outer: dot(turn, track.side[i]) >= 0 ? -1 : 1 });
        }
        const smoothK = kappas.map((_, i) => {
          let acc = 0;
          let w = 0;
          for (let j = Math.max(0, i - 4); j <= Math.min(nWood - 1, i + 4); j++) {
            acc += kappas[j].k;
            w++;
          }
          return acc / w;
        });
        for (let i = 0; i < nWood; i++) {
          const up = track.up[i];
          const floor = track.centerline ? sub(track.pts[i], scale(up, R)) : track.pts[i];
          const ball = track.centerline ? track.pts[i] : add(track.pts[i], scale(up, R));
          const delta = sub(ball, floor);
          const along = dot(delta, up);
          const lat = len(sub(delta, scale(up, along)));
          seat = Math.max(seat, Math.abs(along - R), lat);
          pts.push(floor);
          sides.push(track.side[i]);
          ups.push(up);
          const bend = Math.max(0, Math.min(1, (smoothK[i] - 0.28) / 0.55));
          const outer = kappas[i].outer;
          const raised = track.name === "pour" ? lo : lo + (hi - lo) * bend;
          wallL.push(outer < 0 ? raised : lo);
          wallR.push(outer > 0 ? raised : lo);
        }
        if (!(seat < 1e-4)) throw new Error(track.name + " 球没有贴在槽底上：" + seat);
        const sweep = addUChannel(pts, sides, ups, null, null, null, wallL, wallR, opts);
        return { seat, sweep };
      }

      function densifyTrack(track, factor) {
        const n = (track.pts.length - 1) * factor + 1;
        const pts = [];
        const tangent = [];
        const side = [];
        const up = [];
        const dyds = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const s = track.total * (i / (n - 1));
          const smp = sample(track, s);
          pts.push(smp.pos);
          tangent.push(smp.tangent);
          side.push(smp.side);
          up.push(smp.up);
          dyds[i] = smp.dyds;
        }
        const n0 = track.pts.length;
        pts[0] = track.pts[0];
        pts[n - 1] = track.pts[n0 - 1];
        tangent[0] = track.tangent[0];
        tangent[n - 1] = track.tangent[n0 - 1];
        side[0] = track.side[0];
        side[n - 1] = track.side[n0 - 1];
        up[0] = track.up[0];
        up[n - 1] = track.up[n0 - 1];
        const sTab = new Float64Array(n);
        let total = 0;
        for (let i = 1; i < n; i++) {
          total += len(sub(pts[i], pts[i - 1]));
          sTab[i] = total;
        }
        const fit = track.total / (total || 1);
        for (let i = 0; i < n; i++) sTab[i] *= fit;
        return Object.assign({}, track, { pts, tangent, side, up, dyds, sTab, total: track.total });
      }
      tracks[2] = densifyTrack(tracks[2], 6);
      const woodU = [tracks[2], tracks[3], tracks[4]].map((tr) => addWoodU(tr));
      woodU.push(addWoodU(tracks[pourIndex], { endOverlap: false }));

      function addUChannel(pts, sides, ups, halfAt, wallAt, dropAt, wallLeft, wallRight, flags) {
        const overlap = 0.1 * R;
        const srcStart = pts[0];
        const srcEnd = pts[pts.length - 1];
        const startOverlap = !flags || flags.startOverlap !== false;
        const endOverlap = !flags || flags.endOverlap !== false;
        if (pts.length >= 2 && (startOverlap || endOverlap)) {
          const t0 = norm(sub(pts[0], pts[1]));
          const t1 = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
          const grow = (arr, head, tail) => (arr ? [...(head ? [arr[0]] : []), ...arr, ...(tail ? [arr[arr.length - 1]] : [])] : arr);
          const head = startOverlap ? [add(pts[0], scale(t0, overlap))] : [];
          const tail = endOverlap ? [add(pts[pts.length - 1], scale(t1, overlap))] : [];
          pts = [...head, ...pts, ...tail];
          sides = [...(startOverlap ? [sides[0]] : []), ...sides, ...(endOverlap ? [sides[sides.length - 1]] : [])];
          ups = [...(startOverlap ? [ups[0]] : []), ...ups, ...(endOverlap ? [ups[ups.length - 1]] : [])];
          halfAt = grow(halfAt, startOverlap, endOverlap);
          wallAt = grow(wallAt, startOverlap, endOverlap);
          dropAt = grow(dropAt, startOverlap, endOverlap);
          wallLeft = grow(wallLeft, startOverlap, endOverlap);
          wallRight = grow(wallRight, startOverlap, endOverlap);
        }
        const half0 = 1.1 * R;
        const wallT = 0.15 * R;
        const wallH0 = 1.1 * R;
        const floorT = 0.15 * R;
        const n = pts.length;
        if (n < 2) return null;
        const positions = [];
        const index = [];
        const left = [];
        const right = [];
        const leftBot = [];
        const rightBot = [];
        const leftTop = [];
        const rightTop = [];
        const leftOut = [];
        const rightOut = [];
        const leftOutTop = [];
        const rightOutTop = [];
        for (let i = 0; i < n; i++) {
          const up = ups[i];
          const drop = dropAt ? dropAt[i] : 0;
          const p = drop ? add(pts[i], scale(up, -drop)) : pts[i];
          const sd = sides[i];
          const half = halfAt ? halfAt[i] : half0;
          const wallH = wallAt ? wallAt[i] : wallH0;
          let L = add(p, scale(sd, -half));
          let Rgt = add(p, scale(sd, half));
          if (flags && flags.clipToRing) {
            const minR = FUNNEL_R0 - 0.02;
            const clampRim = (q) => {
              const dx = q.x - funnelC.x;
              const dz = q.z - funnelC.z;
              const rad = Math.hypot(dx, dz) || 1;
              if (rad >= minR) return q;
              const s = minR / rad;
              return v3(funnelC.x + dx * s, q.y, funnelC.z + dz * s);
            };
            const rL = Math.hypot(L.x - funnelC.x, L.z - funnelC.z);
            const rR = Math.hypot(Rgt.x - funnelC.x, Rgt.z - funnelC.z);
            if (rL <= rR) L = clampRim(L);
            else Rgt = clampRim(Rgt);
          }
          left.push(L);
          right.push(Rgt);
          leftBot.push(add(L, scale(up, -floorT)));
          rightBot.push(add(Rgt, scale(up, -floorT)));
          leftTop.push(add(L, scale(up, wallLeft ? wallLeft[i] : wallH)));
          rightTop.push(add(Rgt, scale(up, wallRight ? wallRight[i] : wallH)));
          leftOut.push(add(L, scale(sd, -wallT)));
          rightOut.push(add(Rgt, scale(sd, wallT)));
          leftOutTop.push(add(add(L, scale(sd, -wallT)), scale(up, wallLeft ? wallLeft[i] : wallH)));
          rightOutTop.push(add(add(Rgt, scale(sd, wallT)), scale(up, wallRight ? wallRight[i] : wallH)));
        }
        function vid(p) {
          positions.push(p.x, p.y, p.z);
          return positions.length / 3 - 1;
        }
        function strip(A, B) {
          for (let i = 0; i < n - 1; i++) {
            const a = vid(A[i]);
            const b = vid(B[i]);
            const c = vid(B[i + 1]);
            const d = vid(A[i + 1]);
            index.push(a, b, c, a, c, d);
          }
        }
        strip(left, right);
        strip(rightBot, leftBot);
        strip(leftBot, left);
        strip(right, rightBot);
        strip(left, leftTop);
        strip(leftOutTop, leftOut);
        strip(leftTop, leftOutTop);
        strip(leftOut, leftBot);
        strip(rightTop, right);
        strip(rightOut, rightOutTop);
        strip(rightOutTop, rightTop);
        strip(rightBot, rightOut);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(index);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, wood);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return { start: srcStart, end: srcEnd };
      }

      function carrySweep(tangents, ups, sides) {
        const last = ups.length - 1;
        if (last < 1) return;
        let up = ups[last];
        let side = sides[last];
        if (up.y < 0) {
          up = scale(up, -1);
          side = scale(side, -1);
        }
        side = norm(cross(tangents[last], up));
        up = norm(cross(side, tangents[last]));
        if (up.y < 0) {
          side = scale(side, -1);
          up = scale(up, -1);
        }
        ups[last] = up;
        sides[last] = side;
        for (let i = last - 1; i >= 0; i--) {
          const t = tangents[i];
          let carried = sub(ups[i + 1], scale(t, dot(ups[i + 1], t)));
          if (len(carried) < 1e-5) carried = ups[i + 1];
          carried = norm(carried);
          let sd = norm(cross(t, carried));
          if (dot(sd, sides[i + 1]) < 0) {
            sd = scale(sd, -1);
            carried = scale(carried, -1);
          }
          carried = norm(cross(sd, t));
          ups[i] = carried;
          sides[i] = sd;
        }
      }

      function addTrackU(track, s0, s1, dense) {
        const span = Math.max(1e-4, s1 - s0);
        const base = Math.max(8, Math.ceil(span / (track.total / (N - 1))));
        const steps = dense ? base * 2 : base;
        const pts = [];
        const sides = [];
        const ups = [];
        const tangents = [];
        const wallL = [];
        const wallR = [];
        const half = 1.1 * R;
        for (let i = 0; i <= steps; i++) {
          const smp = sample(track, s0 + span * (i / steps));
          const floor = track.centerline ? sub(smp.pos, scale(smp.up, R)) : smp.pos;
          pts.push(floor);
          sides.push(smp.side);
          ups.push(smp.up);
          tangents.push(smp.tangent);
        }
        carrySweep(tangents, ups, sides);
        for (let i = 0; i < pts.length; i++) {
          let wL = 1.1 * R;
          let wR = 1.1 * R;
          if (track.name === "funnel" && inEntryNotch(pts[i])) {
            const left = add(pts[i], scale(sides[i], -half));
            const right = add(pts[i], scale(sides[i], half));
            const rL = Math.hypot(left.x - funnelC.x, left.z - funnelC.z);
            const rR = Math.hypot(right.x - funnelC.x, right.z - funnelC.z);
            if (rL >= rR) wL = 0.02;
            else wR = 0.02;
          }
          wallL.push(wL);
          wallR.push(wR);
        }
        addUChannel(pts, sides, ups, null, null, null, wallL, wallR);
      }
      function addTrackUAdaptive(track, sStart) {
        const spans = track.dense || [];
        const baseDs = track.total / (N - 1);
        const pts = [];
        const sides = [];
        const ups = [];
        const inSpan = (s) => spans.some((sp) => s >= sp.s0 - 1e-4 && s <= sp.s1 + 1e-4);
        let s = sStart || 0;
        if (track.total - s < 1e-3) return;
        while (s < track.total - 1e-6) {
          const smp = sample(track, s);
          pts.push(track.centerline ? sub(smp.pos, scale(smp.up, R)) : smp.pos);
          sides.push(smp.side);
          ups.push(smp.up);
          s += inSpan(s) ? baseDs * 0.5 : baseDs;
        }
        const smp = sample(track, track.total);
        pts.push(track.centerline ? sub(smp.pos, scale(smp.up, R)) : smp.pos);
        sides.push(smp.side);
        ups.push(smp.up);
        addUChannel(pts, sides, ups);
      }

      function addElbowTube(track, s1) {
        const rIn = 1.15 * R;
        const wall = 0.15 * R;
        const slices = 22;
        const steps = Math.max(16, Math.ceil((s1 / Math.max(track.total, 1e-4)) * 64));
        const positions = [];
        const indices = [];
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const smp = sample(track, s1 * u);
          const flare = u > 0.86 ? (u - 0.86) / 0.14 : 0;
          const inner = rIn + flare * 0.2 * R;
          const thick = wall * (1 - flare * 0.25);
          const n2 = norm(cross(smp.tangent, smp.side));
          for (let k = 0; k < slices; k++) {
            const a = (k / slices) * Math.PI * 2;
            const rad = add(scale(smp.side, Math.cos(a)), scale(n2, Math.sin(a)));
            const inn = add(smp.pos, scale(rad, inner));
            const out = add(smp.pos, scale(rad, inner + thick));
            positions.push(inn.x, inn.y, inn.z, out.x, out.y, out.z);
          }
        }
        const stride = slices * 2;
        for (let i = 0; i < steps; i++) {
          for (let k = 0; k < slices; k++) {
            const k2 = (k + 1) % slices;
            const a = i * stride + k * 2;
            const b = i * stride + k2 * 2;
            const c = (i + 1) * stride + k2 * 2;
            const d = (i + 1) * stride + k * 2;
            indices.push(a, d, c, a, c, b);
            indices.push(a + 1, b + 1, c + 1, a + 1, c + 1, d + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, wood);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      function sectionFrame(track, i) {
        const tng = track.tangent[i];
        let up = track.up[i];
        let side = track.side[i];
        if (up.y < 0.82) {
          const w = (0.82 - Math.max(up.y, 0)) / 0.82;
          const b = v3(up.x * (1 - w), up.y * (1 - w) + w, up.z * (1 - w));
          const L = Math.hypot(b.x, b.y, b.z) || 1;
          up = v3(b.x / L, b.y / L, b.z / L);
          const cx = cross(tng, up);
          if (len(cx) > 0.35) {
            side = norm(cx);
            if (dot(side, track.side[i]) < 0) side = scale(side, -1);
            up = norm(cross(side, tng));
            if (up.y < 0) {
              side = scale(side, -1);
              up = norm(cross(side, tng));
            }
          }
        }
        return { up, side };
      }

      function addSameSpineU(track, i0, i1, opts) {
        const pts = [];
        const sides = [];
        const ups = [];
        const halfAt = [];
        const wallAt = [];
        const dropAt = [];
        const half0 = 1.1 * R;
        const wall0 = 1.1 * R;
        const sRef = opts.fromEnd ? track.sTab[i1] : track.sTab[i0];
        for (let i = i0; i <= i1; i++) {
          pts.push(track.pts[i]);
          const lock = opts.lockEndFrame && i === i1;
          const fr = opts.liftSteep && !lock ? sectionFrame(track, i) : { up: track.up[i], side: track.side[i] };
          sides.push(fr.side);
          ups.push(fr.up);
          const ds = Math.abs(track.sTab[i] - sRef);
          let half = half0;
          let wall = wall0;
          if (opts.flareLen && ds < opts.flareLen) {
            const k = ds / opts.flareLen;
            const sm = k * k * (3 - 2 * k);
            half = opts.flareHalf * (1 - sm) + half0 * sm;
            wall = opts.flareWall * (1 - sm) + wall0 * sm;
          }
          halfAt.push(half);
          wallAt.push(wall);
          dropAt.push(opts.drop || 0);
        }
        return addUChannel(pts, sides, ups, halfAt, wallAt, dropAt);
      }

      function addSleeve(joint, y0, y1, rIn, rOut) {
        const slices = 28;
        const positions = [];
        const indices = [];
        const ys = [y0, y1];
        for (let i = 0; i < 2; i++) {
          for (let k = 0; k < slices; k++) {
            const a = (k / slices) * Math.PI * 2;
            positions.push(joint.x + rIn * Math.cos(a), ys[i], joint.z + rIn * Math.sin(a));
            positions.push(joint.x + rOut * Math.cos(a), ys[i], joint.z + rOut * Math.sin(a));
          }
        }
        const stride = slices * 2;
        for (let k = 0; k < slices; k++) {
          const k2 = (k + 1) % slices;
          const a = k * 2;
          const b = k2 * 2;
          const c = stride + k2 * 2;
          const d = stride + k * 2;
          indices.push(a, d, c, a, c, b);
          indices.push(a + 1, b + 1, c + 1, a + 1, c + 1, d + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, wood);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      function addMouthTube(track, i1) {
        const slices = 40;
        const steps = Math.max(48, i1 * 2);
        const positions = [];
        const indices = [];
        const rings = [];
        function ringAt(u) {
          const idx = Math.min(i1, Math.max(0, u * i1));
          const i0 = Math.min(i1 - 1, Math.floor(idx));
          const iA = Math.min(i1, i0 + 1);
          const f = Math.min(1, idx - i0);
          const p = lerp(track.pts[i0], track.pts[iA], f);
          let tangent = norm(lerp(track.tangent[i0], track.tangent[iA], f));
          let side = norm(lerp(track.side[i0], track.side[iA], f));
          if (dot(side, track.side[i0]) < 0) side = scale(side, -1);
          const sm = u * u * (3 - 2 * u);
          return {
            p,
            tangent,
            side,
            inner: (1.28 * R) * (1 - sm) + (1.12 * R) * sm,
            outer: (1.46 * R) * (1 - sm) + (1.28 * R) * sm,
          };
        }
        for (let i = 0; i <= steps; i++) rings.push(ringAt(i / steps));
        const backT = scale(rings[0].tangent, -0.1 * R);
        const collar = Object.assign({}, rings[0], { p: add(rings[0].p, backT) });
        rings.unshift(collar);
        function axes(tangent, side) {
          let n2 = cross(tangent, side);
          if (len(n2) < 1e-5) n2 = cross(tangent, v3(1, 0, 0));
          n2 = norm(n2);
          const sd = norm(cross(n2, tangent));
          return { sd, n2 };
        }
        for (const ring of rings) {
          const ax = axes(ring.tangent, ring.side);
          for (let k = 0; k < slices; k++) {
            const a = (k / slices) * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            const rx = ax.sd.x * c + ax.n2.x * s;
            const ry = ax.sd.y * c + ax.n2.y * s;
            const rz = ax.sd.z * c + ax.n2.z * s;
            positions.push(ring.p.x + rx * ring.inner, ring.p.y + ry * ring.inner, ring.p.z + rz * ring.inner);
            positions.push(ring.p.x + rx * ring.outer, ring.p.y + ry * ring.outer, ring.p.z + rz * ring.outer);
          }
        }
        const stride = slices * 2;
        for (let i = 0; i < rings.length - 1; i++) {
          for (let k = 0; k < slices; k++) {
            const k2 = (k + 1) % slices;
            const a = i * stride + k * 2;
            const b = i * stride + k2 * 2;
            const c = (i + 1) * stride + k2 * 2;
            const d = (i + 1) * stride + k * 2;
            indices.push(a, d, c, a, c, b);
            indices.push(a + 1, b + 1, c + 1, a + 1, c + 1, d + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, wood);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return { start: track.pts[0], end: track.pts[i1] };
      }

      addTrackU(tracks[0], 0, tracks[0].total, false);
      const inletSweep = addSameSpineU(inletTrack, 0, N - 1, {
        drop: R,
        liftSteep: true,
        fromEnd: true,
        flareLen: 0.42,
        flareHalf: 1.08 * R,
        flareWall: 2 * R,
      });
      let iU = 2;
      for (let i = 0; i < N; i++) {
        if (tracks[1].up[i].y > 0.7 && tracks[1].sTab[i] > 0.12) {
          iU = i;
          break;
        }
      }
      const chuteSweep = addSameSpineU(tracks[1], iU, N - 1, {
        drop: R,
        lockEndFrame: true,
      });
      const mouthSweep = addMouthTube(tracks[1], Math.min(N - 1, iU + 8));
      addSleeve(J_PIPE_TOP, J_PIPE_TOP.y - 0.12, J_PIPE_TOP.y + 0.02, 1.08 * R, 1.62 * R);
      function sweepGap(name, sweep, track) {
        if (!sweep || sweep.start !== track.pts[0] || sweep.end !== track.pts[track.pts.length - 1]) {
          throw new Error(name + " 木头没有沿同一条曲线扫掠");
        }
        const ds = gapOf(sweep.start, track.pts[0]);
        const de = gapOf(sweep.end, track.pts[track.pts.length - 1]);
        if (!(ds < 0.01 * R && de < 0.01 * R)) throw new Error(name + " 几何端点与曲线端点 " + ds.toFixed(5) + " " + de.toFixed(5));
        return { ds, de };
      }
      const geoInlet = sweepGap("入孔", inletSweep, inletTrack);
      if (!mouthSweep || mouthSweep.start !== tracks[1].pts[0] || chuteSweep.end !== tracks[1].pts[N - 1] || chuteSweep.start !== tracks[1].pts[iU]) {
        throw new Error("接应斜槽木头没有沿同一条曲线");
      }
      const geoChute = {
        ds: gapOf(mouthSweep.start, tracks[1].pts[0]),
        de: gapOf(chuteSweep.end, tracks[1].pts[N - 1]),
      };
      if (!(geoChute.ds < 0.01 * R && geoChute.de < 0.01 * R)) throw new Error("接应斜槽几何端点与曲线端点");
      const geoWood = woodU.map((item, i) => ({
        name: tracks[i + 2].name,
        seat: item.seat,
      }));
      const round3 = (p) => ({
        x: Math.round(p.x * 10000) / 10000,
        y: Math.round(p.y * 10000) / 10000,
        z: Math.round(p.z * 10000) / 10000,
      });
      const slopePieces = [
        { name: "漏斗", joins: "提升机顶部 → 漏斗出口", startRef: "spiralStart", endRef: "J_FUNNEL_EXIT", start: round3(spiralStart), end: round3(J_FUNNEL_EXIT) },
        { name: "入孔", joins: "漏斗出口 → 管道", startRef: "J_FUNNEL_EXIT", endRef: "J_PIPE_TOP", start: round3(J_FUNNEL_EXIT), end: round3(J_PIPE_TOP) },
        { name: "接应斜槽", joins: "管道 → S弯入口", startRef: "J_PIPE_EXIT", endRef: "J_CHUTE_S", start: round3(J_PIPE_EXIT), end: round3(J_CHUTE_S) },
        { name: "S弯", joins: "接应斜槽 → 下坡", startRef: "J_CHUTE_S", endRef: "J_S_RAMP", start: round3(J_CHUTE_S), end: round3(J_S_RAMP) },
        { name: "下坡", joins: "S弯出口 → 回收槽", startRef: "J_S_RAMP", endRef: "J_RAMP_TRAY", start: round3(J_S_RAMP), end: round3(J_RAMP_TRAY) },
        { name: "回收槽", joins: "下坡 → 回收槽终点", startRef: "J_RAMP_TRAY", endRef: "J_TRAY_BALL", start: round3(J_RAMP_TRAY), end: round3(J_TRAY_BALL) },
      ];
      const jointReport = {
        topology: ["提升机顶部→漏斗入口", "漏斗出口→管道", "管道→接应斜槽", "接应斜槽→S弯入口", "S弯出口→下坡", "下坡→回收槽"],
        pieces: slopePieces,
        gaps: linkGaps.map((item) => ({ name: item.name, d: Math.round(item.d * 1e6) / 1e6, limit: 0.05 * R })),
        geo: {
          chute: geoChute,
          inlet: geoInlet,
          s: geoWood,
          limit: 0.01 * R,
        },
      };
      console.log("接头", JSON.stringify(jointReport.gaps));
      const jointList = [
        ["出料滑槽→漏斗", pour.pts[N - 1], ballCenter(funnelTrack, 0)],
        ["漏斗→入孔", ballCenter(funnelTrack, funnelTrack.total), inletTrack.pts[0]],
        ["入孔→管道", inletTrack.pts[N - 1], J_PIPE_TOP],
        ["管道→接应斜槽", tracks[1].pts[0], J_PIPE_EXIT],
        ["接应斜槽→S弯", tracks[1].pts[N - 1], tracks[2].pts[0]],
        ["S弯→下坡", tracks[2].pts[tracks[2].pts.length - 1], tracks[3].pts[0]],
        ["下坡→回收槽", tracks[3].pts[N - 1], tracks[4].pts[0]],
      ].map(([name, a, b]) => {
        const d = gapOf(a, b);
        return { name, d: Math.round(d * 1e6) / 1e6, ok: d < 0.03 * R };
      });
      if (jointList.some((item) => !item.ok)) throw new Error("接头距离超限 " + JSON.stringify(jointList));
      console.log("分段接头", JSON.stringify(jointList));
      console.log("斜坡", JSON.stringify(slopePieces));

      {
        const yTop = J_PIPE_TOP.y;
        const yBot = J_PIPE_EXIT.y;
        const rIn0 = 1.15 * R;
        const rFlare = 1.5 * R;
        const wall = 0.15 * R;
        const flareH = 0.3 * R;
        const chamfer = 0.2 * R;
        const slices = 28;
        const rings = 36;
        const positions = [];
        const indices = [];
        const profile = [];
        for (let i = 0; i <= rings; i++) {
          const y = yBot + (yTop - yBot) * (i / rings);
          let inner = rIn0;
          if (y > yTop - flareH) inner = rIn0 + (rFlare - rIn0) * ((y - (yTop - flareH)) / flareH);
          if (y < yBot + chamfer) inner = rIn0 + chamfer * ((yBot + chamfer - y) / chamfer);
          let thick = wall;
          if (y < yBot + chamfer) thick = wall * Math.max(0.2, (y - yBot) / chamfer);
          profile.push({ y, inner, outer: inner + thick });
        }
        for (let i = 0; i < profile.length; i++) {
          for (let k = 0; k < slices; k++) {
            const a = (k / slices) * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            positions.push(pipeAxisX + profile[i].inner * c, profile[i].y, pipeAxisZ + profile[i].inner * s);
            positions.push(pipeAxisX + profile[i].outer * c, profile[i].y, pipeAxisZ + profile[i].outer * s);
          }
        }
        const stride = slices * 2;
        for (let i = 0; i < rings; i++) {
          for (let k = 0; k < slices; k++) {
            const k2 = (k + 1) % slices;
            const a = i * stride + k * 2;
            const b = i * stride + k2 * 2;
            const c = (i + 1) * stride + k2 * 2;
            const d = (i + 1) * stride + k * 2;
            indices.push(a, d, c, a, c, b);
            indices.push(a + 1, b + 1, c + 1, a + 1, c + 1, d + 1);
          }
        }
        const cap = profile.length - 1;
        for (let k = 0; k < slices; k++) {
          const k2 = (k + 1) % slices;
          const topIn = cap * stride + k * 2;
          const topOut = topIn + 1;
          const topIn2 = cap * stride + k2 * 2;
          const topOut2 = topIn2 + 1;
          indices.push(topIn, topIn2, topOut2, topIn, topOut2, topOut);
          const botIn = k * 2;
          const botOut = botIn + 1;
          const botIn2 = k2 * 2;
          const botOut2 = botIn2 + 1;
          indices.push(botIn, botOut, botOut2, botIn, botOut2, botIn2);
        }
        const pipeGeo = new THREE.BufferGeometry();
        pipeGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        pipeGeo.setIndex(indices);
        pipeGeo.computeVertexNormals();
        const pipe = new THREE.Mesh(pipeGeo, wood);
        pipe.castShadow = true;
        pipe.receiveShadow = true;
        scene.add(pipe);
      }

      {
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.15 * R, 8, 48), woodDark);
        lip.rotation.x = Math.PI / 2;
        lip.position.set(funnelC.x, H_funnel - 0.12 - 0.3 * R, funnelC.z);
        lip.castShadow = true;
        lip.receiveShadow = true;
        scene.add(lip);
        const outerR = 1.25 + 1.1 * R + 0.05;
        const entryA = Math.atan2(-(funnelTrack.pts[0].z - funnelC.z), funnelTrack.pts[0].x - funnelC.x);
        const sproX = xS - funnelC.x;
        const sproY = -(zC - funnelC.z);
        const sproKeep = RS + 0.52;
        function trayRadius(a) {
          const px = Math.cos(a) * outerR;
          const py = Math.sin(a) * outerR;
          let r = outerR;
          if (Math.hypot(px - sproX, py - sproY) < sproKeep) {
            let lo = 0.42;
            let hi = outerR;
            for (let k = 0; k < 18; k++) {
              const mid = (lo + hi) / 2;
              const d = Math.hypot(Math.cos(a) * mid - sproX, Math.sin(a) * mid - sproY);
              if (d < sproKeep) hi = mid;
              else lo = mid;
            }
            r = Math.max(0.42, lo);
          }
          const nx = Math.cos(a) * r;
          const ny = Math.sin(a) * r;
          if (inEntryNotch(v3(funnelC.x + nx, 0, funnelC.z - ny))) {
            let lo = 0.2;
            let hi = r;
            for (let k = 0; k < 18; k++) {
              const mid = (lo + hi) / 2;
              if (inEntryNotch(v3(funnelC.x + Math.cos(a) * mid, 0, funnelC.z - Math.sin(a) * mid))) hi = mid;
              else lo = mid;
            }
            r = lo;
          }
          return r;
        }
        const trayShape = new THREE.Shape();
        const traySteps = 96;
        for (let i = 0; i <= traySteps; i++) {
          const a = (i / traySteps) * Math.PI * 2;
          const r = trayRadius(a);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) trayShape.moveTo(x, y);
          else trayShape.lineTo(x, y);
        }
        const trayHole = new THREE.Path();
        trayHole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
        trayShape.holes.push(trayHole);
        const trayGeo = new THREE.ExtrudeGeometry(trayShape, { depth: 0.08, bevelEnabled: false, curveSegments: 56 });
        trayGeo.rotateX(-Math.PI / 2);
        const funnelTray = new THREE.Mesh(trayGeo, wood);
        funnelTray.position.set(funnelC.x, H_funnel - 0.12 - 0.15 * R - 0.08, funnelC.z);
        funnelTray.receiveShadow = true;
        funnelTray.castShadow = true;
        scene.add(funnelTray);
      }

      const supportPts = [];

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
      function takeBound(p, pad = 0) {
        minX = Math.min(minX, p.x - pad);
        maxX = Math.max(maxX, p.x + pad);
        minZ = Math.min(minZ, p.z - pad);
        maxZ = Math.max(maxZ, p.z + pad);
        maxY = Math.max(maxY, p.y + pad);
      }
      for (const tr of tracks) for (const p of tr.pts) takeBound(p, 0.2);
      takeBound(v3(x1, gearY, zGear), 0.9);
      takeBound(v3(x3, gearY, zGear), 0.9);
      takeBound(v3(xS, yTop + RS, zC), 0.6);
      minX -= 0.85;
      maxX += 0.7;
      minZ -= 0.7;
      maxZ += 0.55;
      const baseTop = 0.18;
      const topY = Math.max(maxY, gearY + (Z3 * M) / 2 + M, yTop + RS) + 0.95;
      const sceneSpan = Math.hypot((maxX - minX) + 3.2, topY + 0.12, (maxZ - minZ) + 3.2);
      camera.near = 0.1;
      camera.far = sceneSpan * 10;
      camera.updateProjectionMatrix();

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX + 3.2, 0.08, maxZ - minZ + 3.2),
        new THREE.MeshStandardMaterial({ color: 0x121624, roughness: 0.96, metalness: 0 }),
      );
      floor.position.set((minX + maxX) / 2, -0.04, (minZ + maxZ) / 2);
      floor.receiveShadow = true;
      scene.add(floor);

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX, baseTop, maxZ - minZ),
        wood,
      );
      base.position.set((minX + maxX) / 2, baseTop / 2, (minZ + maxZ) / 2);
      base.castShadow = true;
      base.receiveShadow = true;
      scene.add(base);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX + 0.12, 0.05, maxZ - minZ + 0.12),
        woodDark,
      );
      trim.position.set((minX + maxX) / 2, 0.025, (minZ + maxZ) / 2);
      trim.receiveShadow = true;
      scene.add(trim);

      const postH = topY - baseTop;
      const boardT = 0.12;
      const cornerBoards = [
        { x: minX, z: minZ, sx: 0.78, sz: boardT },
        { x: maxX, z: minZ, sx: 0.78, sz: boardT },
        { x: maxX, z: maxZ, sx: boardT, sz: 0.78 },
        { x: minX, z: maxZ, sx: boardT, sz: 0.78 },
      ];
      for (const c of cornerBoards) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(c.sx, postH, c.sz), wood);
        post.position.set(c.x, baseTop + postH / 2, c.z);
        post.castShadow = true;
        post.receiveShadow = true;
        scene.add(post);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(c.sx + 0.02, 0.014, c.sz + 0.02), woodDark);
        foot.position.set(c.x, baseTop + 0.007, c.z);
        scene.add(foot);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(Math.min(c.sx, 0.8), 0.014, Math.min(c.sz, 0.8)), woodDark);
        cap.position.set(c.x, topY - 0.055, c.z);
        scene.add(cap);
      }
      const beamY = topY;
      const beams = [
        { w: maxX - minX, d: 0.1, x: (minX + maxX) / 2, z: minZ },
        { w: maxX - minX, d: 0.1, x: (minX + maxX) / 2, z: maxZ },
        { w: 0.1, d: maxZ - minZ, x: minX, z: (minZ + maxZ) / 2 },
        { w: 0.1, d: maxZ - minZ, x: maxX, z: (minZ + maxZ) / 2 },
      ];
      for (const b of beams) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.1, b.d), wood);
        mesh.position.set(b.x, beamY, b.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      const frameH = 0.28;
      const frameT = 0.12;
      const bw = maxX - minX;
      const bd = maxZ - minZ;
      const bcx = (minX + maxX) / 2;
      const bcz = (minZ + maxZ) / 2;
      const frameRails = [
        { w: bw + frameT * 2, d: frameT, x: bcx, z: minZ - frameT / 2 },
        { w: bw + frameT * 2, d: frameT, x: bcx, z: maxZ + frameT / 2 },
        { w: frameT, d: bd, x: minX - frameT / 2, z: bcz },
        { w: frameT, d: bd, x: maxX + frameT / 2, z: bcz },
      ];
      for (const r of frameRails) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(r.w, frameH, r.d), wood);
        rail.position.set(r.x, frameH / 2, r.z);
        rail.castShadow = true;
        rail.receiveShadow = true;
        scene.add(rail);
      }
      for (const [sx, sz] of [
        [minX - frameT / 2, minZ - frameT / 2],
        [maxX + frameT / 2, minZ - frameT / 2],
        [maxX + frameT / 2, maxZ + frameT / 2],
        [minX - frameT / 2, maxZ + frameT / 2],
      ]) {
        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.016, frameH, 0.016), woodDark);
        joint.position.set(sx, frameH / 2, sz);
        scene.add(joint);
      }

      function columnBlocked(x, z, top) {
        const yLo = baseTop;
        const yHi = top;
        function near(ox, oz, rad) {
          return Math.hypot(x - ox, z - oz) < rad;
        }
        function yOverlap(a0, a1) {
          return yHi > a0 && yLo < a1;
        }
        if (near(pipeAxisX, pipeAxisZ, 0.34) && yOverlap(yOutlet - 0.05, discBottom + 0.05)) return true;
        for (const [gx, gz] of [[x1, Z1], [x2, Z2], [x3, Z3]]) {
          const rad = (gz * M) / 2 + M + 0.06;
          if (near(gx, zGear, rad) && yOverlap(gearY - rad, gearY + rad)) return true;
        }
        const rt = RS + (2 * RS) / ZS;
        if (near(xS, zC, rt) && Math.abs(z - zC) < 0.12 && yOverlap(yBot - rt, yBot + rt)) return true;
        if (near(xS, zC, rt) && Math.abs(z - zC) < 0.12 && yOverlap(yTop - rt, yTop + rt)) return true;
        for (let i = 0; i < 24; i++) {
          const frame = chainFrame((chainL * i) / 24);
          const bucket = add(frame.pos, scale(frame.outward, 0.18));
          if (near(frame.pos.x, frame.pos.z, 0.08) && yOverlap(frame.pos.y - 0.06, frame.pos.y + 0.06)) return true;
          if (near(bucket.x, bucket.z, 0.26) && yOverlap(bucket.y - 0.16, bucket.y + 0.16)) return true;
        }
        if (near(x1, zGear + 0.78, 0.42) && yOverlap(gearY - 0.55, gearY + 0.35)) return true;
        for (const tr of tracks) {
          for (let i = 0; i < N; i += 5) {
            const q = tr.pts[i];
            if ((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) > 0.18 * 0.18) continue;
            const ballY = tr.centerline ? q.y : q.y + Math.abs(tr.up[i].y) * R;
            if (ballY < yHi + 0.02) return true;
          }
        }
        return false;
      }
      function addTrackRib(tr, i, ox, oz) {
        const p = tr.pts[i];
        const u = tr.up[i];
        const floor = tr.centerline
          ? v3(p.x - u.x * R, p.y - u.y * R, p.z - u.z * R)
          : v3(p.x, p.y, p.z);
        const x = floor.x + (ox || 0);
        const z = floor.z + (oz || 0);
        const top = floor.y - 0.05;
        if (!(top > baseTop + 0.18)) return false;
        if (columnBlocked(x, z, top)) return false;
        const h = top - baseTop;
        const tng = tr.tangent[i];
        const horiz = Math.hypot(tng.x, tng.z) || 1;
        const tx = tng.x / horiz;
        const tz = tng.z / horiz;
        const width = 0.34;
        const geo = new THREE.BoxGeometry(boardT, h, width);
        const mesh = new THREE.Mesh(geo, wood);
        const xAxis = new THREE.Vector3(tx, 0, tz);
        const yAxis = new THREE.Vector3(0, 1, 0);
        const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
        mesh.position.set(x, baseTop + h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(boardT + 0.012, 0.014, width + 0.012), woodDark);
        foot.quaternion.copy(mesh.quaternion);
        foot.position.set(x, baseTop + 0.007, z);
        scene.add(foot);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(boardT + 0.012, 0.012, width * 0.62), woodDark);
        slot.quaternion.copy(mesh.quaternion);
        slot.position.set(x, top - 0.006, z);
        scene.add(slot);
        supportPts.push(v3(x, baseTop + h / 2, z));
        return true;
      }
      const ribCount = [];
      for (const tr of tracks) {
        let got = 0;
        for (let k = 1; k <= 10 && got < 2; k++) {
          const idx = Math.round(((N - 1) * k) / 11);
          for (const oz of [0, 0.38, -0.38]) {
            if (addTrackRib(tr, idx, 0, oz)) {
              got++;
              break;
            }
          }
        }
        ribCount.push(tr.name + ":" + got);
        if (got < 2) throw new Error(tr.name + " 支撑不足 " + got);
      }
      console.log("支撑板", ribCount.join(" "));

      const plateW = x3 + 0.55 - (x1 - 0.55);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(plateW, (Z3 * M) / 2 + 0.85, 0.08), wood);
      plate.position.set((x1 + x3) / 2, gearY - 0.05, zGear - 0.18);
      plate.castShadow = true;
      plate.receiveShadow = true;
      scene.add(plate);

      function makeGear(z, m) {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(gearGeometry(z, m, GEAR_TH), gearMat);
        mesh.castShadow = true;
        group.add(mesh);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry((z * m) / 2 * 0.22, (z * m) / 2 * 0.22, GEAR_TH + 0.03, 20), darkMetal);
        hub.rotation.x = Math.PI / 2;
        group.add(hub);
        return group;
      }

      const g1 = makeGear(Z1, M);
      const g2 = makeGear(Z2, M);
      const g3 = makeGear(Z3, M);
      g1.position.set(x1, gearY, zGear);
      g2.position.set(x2, gearY, zGear);
      g3.position.set(x3, gearY, zGear);
      scene.add(g1, g2, g3);

      const pinMat = new THREE.MeshStandardMaterial({ color: 0xd3121f, roughness: 0.32, metalness: 0.04 });
      const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, GEAR_TH + 0.3, 20);
      for (const gear of [g1, g2, g3]) {
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.rotation.x = Math.PI / 2;
        pin.castShadow = true;
        gear.add(pin);
      }

      const mS = (2 * RS) / ZS;
      const cheekT = 0.04;
      const cheekZ = 0.36;
      const sprocketGeo = gearGeometry(ZS, mS, cheekT);
      const sprockets = [];
      for (const y of [yTop, yBot]) {
        for (const z of [zC - cheekZ, zC + cheekZ]) {
          const sprocket = new THREE.Mesh(sprocketGeo, darkMetal);
          sprocket.position.set(xS, y, z);
          sprocket.castShadow = true;
          scene.add(sprocket);
          sprockets.push(sprocket);
        }
      }
      const hubGeo = new THREE.CylinderGeometry(RS * 0.28, RS * 0.28, 0.1, 18);
      for (const y of [yTop, yBot]) {
        const hub = new THREE.Mesh(hubGeo, darkMetal);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(xS, y, zC);
        scene.add(hub);
      }

      const axleLen = Math.abs(zC - zGear) - 0.08;
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, axleLen, 16), darkMetal);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(xS, gearY, (zC + zGear) / 2);
      scene.add(axle);
      const axle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 14), darkMetal);
      axle2.rotation.x = Math.PI / 2;
      axle2.position.set(x2, gearY, zGear);
      g2.add(axle2);
      const axle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.72, 14), darkMetal);
      axle1.rotation.x = Math.PI / 2;
      axle1.position.set(0, 0, 0.34);
      g1.add(axle1);

      const motor = new THREE.Group();
      const bodyShape = new THREE.Shape();
      const mw = 0.62, mh = 0.4, mr = 0.08;
      bodyShape.moveTo(-mw / 2 + mr, -mh / 2);
      bodyShape.lineTo(mw / 2 - mr, -mh / 2);
      bodyShape.absarc(mw / 2 - mr, -mh / 2 + mr, mr, -Math.PI / 2, 0, false);
      bodyShape.lineTo(mw / 2, mh / 2 - mr);
      bodyShape.absarc(mw / 2 - mr, mh / 2 - mr, mr, 0, Math.PI / 2, false);
      bodyShape.lineTo(-mw / 2 + mr, mh / 2);
      bodyShape.absarc(-mw / 2 + mr, mh / 2 - mr, mr, Math.PI / 2, Math.PI, false);
      bodyShape.lineTo(-mw / 2, -mh / 2 + mr);
      bodyShape.absarc(-mw / 2 + mr, -mh / 2 + mr, mr, Math.PI, Math.PI * 1.5, false);
      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.46, bevelEnabled: false });
      bodyGeo.translate(0, 0, -0.23);
      const body = new THREE.Mesh(bodyGeo, motorMat);
      body.castShadow = true;
      motor.add(body);
      for (let i = 0; i < 5; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.36), motorMat);
        fin.position.set(0, mh / 2 + 0.01 + i * 0.02, 0);
        motor.add(fin);
      }
      motor.position.set(x1, gearY, zGear + 0.78);
      scene.add(motor);
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), wood);
      cradle.position.set(x1, gearY - 0.28, zGear + 0.78);
      cradle.castShadow = true;
      scene.add(cradle);
      const pillarH = gearY - 0.32 - baseTop;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, pillarH, boardT), wood);
      pillar.position.set(x1, baseTop + pillarH / 2, zGear + 0.78);
      pillar.castShadow = true;
      scene.add(pillar);
      const pillarSeam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.014, boardT + 0.02), woodDark);
      pillarSeam.position.set(x1, baseTop + 0.007, zGear + 0.78);
      scene.add(pillarSeam);

      const halfLinks = N_LINKS / 2;
      const PLATE_LAT = 0.358;
      const outerPlateGeo = new THREE.BoxGeometry(0.016, pitch * 1.46, 0.05);
      const innerPlateGeo = new THREE.BoxGeometry(0.012, pitch * 1.32, 0.044);
      const pinGeoChain = new THREE.CylinderGeometry(0.013, 0.013, 0.05, 8);
      const rollerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.036, 8);
      const outerLinks = new THREE.InstancedMesh(outerPlateGeo, chainMat, N_LINKS);
      const innerLinks = new THREE.InstancedMesh(innerPlateGeo, chainMat, N_LINKS);
      const chainPins = new THREE.InstancedMesh(pinGeoChain, darkMetal, N_LINKS * 2);
      const chainRollers = new THREE.InstancedMesh(rollerGeo, darkMetal, N_LINKS * 2);
      outerLinks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      innerLinks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      chainPins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      chainRollers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(outerLinks, innerLinks, chainPins, chainRollers);
      const dummy = new THREE.Object3D();
      const basis = new THREE.Matrix4();

      const buckets = [];
      for (let i = 0; i < 6; i++) {
        const group = new THREE.Group();
        const floorM = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.016, 0.3), wood);
        floorM.position.set(0, -0.05, 0.12);
        floorM.rotation.x = 0.62;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.02), woodDark);
        back.position.set(0, 0.06, -0.02);
        const sideGeo = new THREE.BoxGeometry(0.02, 0.16, 0.28);
        const left = new THREE.Mesh(sideGeo, wood);
        left.position.set(-0.16, 0.0, 0.1);
        left.rotation.x = 0.32;
        const right = new THREE.Mesh(sideGeo, wood);
        right.position.set(0.16, 0.0, 0.1);
        right.rotation.x = 0.32;
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.016, 0.018), wood);
        lip.position.set(0, -0.12, 0.26);
        group.add(floorM, back, left, right, lip);
        scene.add(group);
        buckets.push({ i, group, ball: null });
      }

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.1, 28), woodDark);
      bowl.position.set(scoopSeat.x, Math.max(baseTop + 0.05, scoopSeat.y - R - 0.08), scoopSeat.z);
      bowl.receiveShadow = true;
      bowl.castShadow = true;
      scene.add(bowl);
      const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 28), wood);
      bowlRim.rotation.x = Math.PI / 2;
      bowlRim.position.set(bowl.position.x, bowl.position.y + 0.05, bowl.position.z);
      scene.add(bowlRim);

      {
        const back = norm(v3(queueHead.x - queueTail.x, 0, queueHead.z - queueTail.z));
        const up = v3(0, 1, 0);
        const flank = v3(0, 0, 1);
        const floorEnd = v3(queueTail.x, queueTail.y - R, queueTail.z);
        const tall = 1.4 * R;
        const thick = 0.15 * R;
        function placeBoard(from, to) {
          const mid = lerp(from, to, 0.5);
          const dir = norm(sub(to, from));
          const boardLen = Math.max(0.08, len(sub(to, from)));
          const geo = new THREE.BoxGeometry(thick, tall, boardLen);
          const mesh = new THREE.Mesh(geo, wood);
          const yAxis = new THREE.Vector3(up.x, up.y, up.z);
          const zAxis = new THREE.Vector3(dir.x, dir.y, dir.z);
          const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
          zAxis.crossVectors(xAxis, yAxis).normalize();
          mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
          mesh.position.set(mid.x, mid.y + tall * 0.5, mid.z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
        }
        for (const sign of [-1, 1]) {
          const near = add(floorEnd, scale(flank, sign * 0.28));
          const far = add(add(floorEnd, scale(back, 0.52)), scale(flank, sign * 0.48));
          placeBoard(far, near);
        }
        const hopClear = 0.22 * R;
        const hopTop = floorEnd.y - hopClear;
        const hopper = new THREE.Group();
        const yAxis = new THREE.Vector3(0, 1, 0);
        const zAxis = new THREE.Vector3(back.x, 0, back.z).normalize();
        const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
        hopper.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
        hopper.position.set(floorEnd.x + back.x * 0.85, hopTop + 0.02, floorEnd.z + back.z * 0.85);
        function addHop(sx, sy, sz, lx, ly, lz, rx) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood);
          mesh.position.set(lx, ly, lz);
          if (rx) mesh.rotation.x = rx;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          hopper.add(mesh);
        }
        addHop(0.34, 0.016, 0.26, 0, -0.08, 0.02, 0.55);
        addHop(0.016, 0.09, 0.24, -0.16, -0.045, 0);
        addHop(0.016, 0.09, 0.24, 0.16, -0.045, 0);
        addHop(0.32, 0.09, 0.016, 0, -0.045, -0.11);
        scene.add(hopper);
      }

      {
        const flankZ = 0.46;
        const y0g = yBot + RS + 0.12;
        const y1g = yTop - RS - 0.12;
        const gh = y1g - y0g;
        for (const x of [xS - RS, xS + RS]) {
          for (const z of [zC - flankZ, zC + flankZ]) {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, gh, 0.02), wood);
            plate.position.set(x, (y0g + y1g) / 2, z);
            plate.castShadow = true;
            plate.receiveShadow = true;
            scene.add(plate);
            const lip = new THREE.Mesh(new THREE.BoxGeometry(0.02, gh, 0.02), woodDark);
            const inward = z > zC ? -1 : 1;
            lip.position.set(x, (y0g + y1g) / 2, z + inward * 0.012);
            scene.add(lip);
          }
        }
      }

      const ballGeo = new THREE.SphereGeometry(R, 28, 20);
      const ballMeshes = [];
      for (let i = 0; i < 12; i++) {
        const mesh = new THREE.Mesh(ballGeo, steel);
        mesh.castShadow = true;
        mesh.visible = false;
        scene.add(mesh);
        ballMeshes.push(mesh);
      }

      const hemi = new THREE.HemisphereLight(0x6fb7ff, 0x120e0c, 0.16);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xfff1dc, 1.15);
      key.position.set(8, 11, 7);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -8;
      key.shadow.camera.right = 8;
      key.shadow.camera.top = 8;
      key.shadow.camera.bottom = -8;
      key.shadow.camera.far = 36;
      key.shadow.bias = -0.0004;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x6fb7ff, 2.4);
      rim.position.set(-11, 6, -8);
      scene.add(rim);
      const rimBack = new THREE.DirectionalLight(0x6fb7ff, 1.35);
      rimBack.position.set(3, 3.5, -12);
      scene.add(rimBack);
      const rimPoint = new THREE.PointLight(0x6fb7ff, 8, 14, 2);
      rimPoint.position.set(-2.4, 3.2, -3.2);
      scene.add(rimPoint);
      const glow = new THREE.PointLight(0xffe1b0, 0.18, 8);
      glow.position.set(funnelC.x, H_funnel - 0.06, funnelC.z);
      scene.add(glow);

      const machineRoot = new THREE.Group();
      machineRoot.name = "machine";
      const gearGroup = new THREE.Group();
      gearGroup.name = "gears";
      scene.add(machineRoot);
      machineRoot.add(gearGroup);
      for (const child of [...scene.children]) {
        if (child === machineRoot || child === floor || child.isLight) continue;
        if (child === g1 || child === g2 || child === g3) gearGroup.add(child);
        else machineRoot.add(child);
      }

      let phi1 = 0;
      let phi2 = Math.PI + Math.PI / Z2;
      let phi3 = Math.PI;
      let chainTravel = straight * 0.42;
      let pauseLeft = 0;
      let holdBucket = null;
      let emptyRun = 0;
      let maxEmptyRun = 0;
      let playing = true;
      let speed = 1;
      let count = 8;
      const balls = [];

      const omega3 = () => OMEGA1 * (Z1 / Z3);
      const chainSpeed = () => Math.abs(omega3()) * RS;
      const halfBeat = () => (chainL / 6) * 0.5 / chainSpeed();

      function bucketS(i) {
        return mod(chainTravel + i * (chainL / 6), chainL);
      }

      function entranceBlocked() {
        const lim = 1.5 * R;
        return balls.some((b) => {
          if (b.mode !== "track") return false;
          if (b.track === pourIndex) return true;
          return b.track === 0 && b.s < lim;
        });
      }

      function canEnter(trackId) {
        let minS = Infinity;
        for (const b of balls) {
          if (b.mode === "track" && b.track === trackId) minS = Math.min(minS, b.s);
        }
        return minS >= GAP - 1e-4;
      }

      function doRelease(i) {
        const bucket = buckets[i];
        const ball = bucket.ball;
        if (!ball) return;
        ball.mode = "track";
        ball.track = pourIndex;
        ball.s = 0;
        ball.v = 2.4;
        ball.bucket = -1;
        bucket.ball = null;
      }

      function tryRelease(i) {
        if (!buckets[i].ball) return;
        if (entranceBlocked()) {
          pauseLeft = halfBeat();
          holdBucket = i;
          return;
        }
        doRelease(i);
      }

      function tryPickup(i) {
        const bucket = buckets[i];
        if (bucket.ball) return;
        let lead = null;
        for (const b of balls) {
          if (b.mode !== "track" || b.track !== 4) continue;
          if (tracks[4].total - b.s > R * 1.15) continue;
          if (!lead || b.s > lead.s) lead = b;
        }
        if (!lead) return;
        lead.mode = "carried";
        lead.bucket = i;
        lead.v = 0;
        bucket.ball = lead;
      }

      function crossed(prev, curr, mark) {
        if (prev === curr) return false;
        if (prev < curr) return prev < mark && mark <= curr;
        return mark > prev || mark <= curr;
      }

      function advanceDrivetrain(dt) {
        const prev = buckets.map((b) => bucketS(b.i));
        phi1 += OMEGA1 * dt;
        phi2 += -OMEGA1 * (Z1 / Z2) * dt;
        phi3 += omega3() * dt;
        chainTravel = mod(chainTravel + chainSpeed() * dt, chainL);
        for (let i = 0; i < 6; i++) {
          const curr = bucketS(i);
          if (crossed(prev[i], curr, scoopS)) {
            const had = !!buckets[i].ball;
            tryPickup(i);
            if (buckets[i].ball && !had) emptyRun = 0;
            else if (!buckets[i].ball) {
              emptyRun += 1;
              if (emptyRun > maxEmptyRun) maxEmptyRun = emptyRun;
            }
          }
          if (crossed(prev[i], curr, pourS) && holdBucket == null) tryRelease(i);
        }
      }

      function integrateBalls(dt) {
        for (const b of balls) {
          if (b.mode !== "pipe") continue;
          b.v += (G - 0.05 * b.v) * dt;
          if (b.v < 0) b.v = 0;
          if (b.v > 12) b.v = 12;
          let nextY = b.pipeY - b.v * dt;
          for (const o of balls) {
            if (o === b || o.mode !== "pipe") continue;
            if (o.pipeY < b.pipeY && nextY < o.pipeY + GAP) {
              nextY = o.pipeY + GAP;
              b.v = Math.min(b.v, o.v);
            }
          }
          let blocked = false;
          if (nextY <= pipeSwitchY) {
            let minS = Infinity;
            for (const o of balls) {
              if (o.mode === "track" && o.track === 1 && o.s >= sPipeEnd) minS = Math.min(minS, o.s);
            }
            if (minS - sPipeEnd < GAP - 1e-4) {
              b.pipeY = pipeSwitchY;
              b.v = 0;
              blocked = true;
            } else {
              b.pipeY = pipeSwitchY;
              b.mode = "track";
              b.track = 1;
              b.s = 0;
              b.justSwitched = true;
            }
          }
          if (!blocked && b.mode === "pipe") {
            b.pipeY = nextY;
            b.x = pipeAxisX;
            b.z = pipeAxisZ;
          }
          b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -(b.v / R) * dt,
          ));
        }
        const inletList = [];
        for (const b of balls) if (b.mode === "inlet") inletList.push(b);
        inletList.sort((a, b) => b.s - a.s);
        for (const b of inletList) {
          const dyds = sample(inletTrack, b.s).dyds;
          b.v += (-G * dyds - muFor("inlet") * b.v) * dt;
          if (b.v < 0) b.v = 0;
          if (b.v > 2.6) b.v = 2.6;
          b.s += b.v * dt;
        }
        {
          let limit = inletTrack.total;
          let limitV = 0;
          for (const b of inletList) {
            if (b.s > limit + 1e-6) {
              b.s = Math.max(0, limit);
              b.v = limitV;
            }
            limit = b.s - GAP;
            limitV = b.v;
          }
        }
        for (const b of inletList) {
          if (b.s >= inletTrack.total - 1e-4) {
            b.mode = "pipe";
            b.pipeY = pipeEnterY;
            b.x = pipeAxisX;
            b.z = pipeAxisZ;
            b.v = Math.max(b.v, 0.15);
            b.s = 0;
          }
        }
        const groups = tracks.map(() => []);
        for (const b of balls) if (b.mode === "track") groups[b.track].push(b);
        for (let ti = 0; ti < tracks.length; ti++) {
          const list = groups[ti].sort((a, b) => b.s - a.s);
          for (const b of list) {
            if (b.justSwitched) {
              b.justSwitched = false;
              continue;
            }
            const dyds = sample(tracks[b.track], b.s).dyds;
            b.v += (-G * dyds - muFor(tracks[b.track].name) * b.v) * dt;
            if (b.v < 0) b.v = 0;
            if (b.v > 2.6) b.v = 2.6;
            b.s += b.v * dt;
            const tr = tracks[b.track];
            if (b.s >= tr.total) {
              if (b.track === 0) {
                b.mode = "inlet";
                b.s = 0;
                b.v = Math.max(b.v, 0.12);
                continue;
              }
              if (tr.next != null && canEnter(tr.next)) {
                b.track = tr.next;
                b.s = 0;
              } else {
                b.s = tr.total;
                b.v = 0;
              }
            }
          }
        }
        for (let ti = 0; ti < tracks.length; ti++) {
          const list = [];
          for (const b of balls) if (b.mode === "track" && b.track === ti) list.push(b);
          list.sort((a, b) => b.s - a.s);
          let limit = tracks[ti].total;
          let limitV = 0;
          for (const b of list) {
            if (b.s > limit + 1e-6) {
              b.s = Math.max(0, limit);
              b.v = limitV;
            }
            limit = b.s - GAP;
            limitV = b.v;
          }
        }
        for (const b of balls) {
          if ((b.mode !== "track" && b.mode !== "inlet") || b.v <= 0) continue;
          const tng = b.mode === "inlet" ? sample(inletTrack, b.s).tangent : sample(tracks[b.track], b.s).tangent;
          const axis = v3(-tng.z, 0, tng.x);
          const al = Math.hypot(axis.x, axis.z);
          if (al < 1e-5) continue;
          b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(axis.x / al, 0, axis.z / al),
            -(b.v / R) * dt,
          ));
        }
      }

      function step(dt) {
        integrateBalls(dt);
        if (pauseLeft > 0) {
          pauseLeft -= dt;
          if (pauseLeft <= 0 && holdBucket != null) {
            if (entranceBlocked()) pauseLeft = halfBeat();
            else {
              doRelease(holdBucket);
              holdBucket = null;
            }
          }
          return;
        }
        advanceDrivetrain(dt);
      }

      function terminal(dyds, mu) {
        if (dyds >= -1e-4) return 0.4;
        return Math.min(4, (-G * dyds) / mu);
      }

      function spawn(n) {
        for (const bucket of buckets) bucket.ball = null;
        balls.length = 0;
        const pushTrack = (track, frac) => {
          const s = tracks[track].total * frac;
          const ball = {
            mode: "track",
            track,
            s,
            v: terminal(sample(tracks[track], s).dyds, muFor(tracks[track].name)),
            bucket: -1,
            q: new THREE.Quaternion(),
          };
          balls.push(ball);
        };
        const carry = (bucketIndex) => {
          const ball = {
            mode: "carried",
            track: -1,
            s: 0,
            v: 0,
            bucket: bucketIndex,
            q: new THREE.Quaternion(),
          };
          buckets[bucketIndex].ball = ball;
          balls.push(ball);
        };
        if (n >= 4) {
          carry(0);
          pushTrack(0, 0.22);
          pushTrack(0, 0.58);
          pushTrack(2, 0.4);
        }
        if (n >= 8) {
          carry(1);
          pushTrack(0, 0.84);
          pushTrack(2, 0.78);
          const tray = tracks[4];
          balls.push({
            mode: "track",
            track: 4,
            s: tray.total,
            v: 0,
            bucket: -1,
            q: new THREE.Quaternion(),
          });
        }
        if (n >= 12) {
          pushTrack(0, 0.4);
          pushTrack(2, 0.18);
          pushTrack(3, 0.35);
          pushTrack(3, 0.72);
        }
        while (balls.length > n) {
          const dropped = balls.pop();
          if (dropped && dropped.bucket >= 0) buckets[dropped.bucket].ball = null;
        }
        for (let i = 0; i < ballMeshes.length; i++) ballMeshes[i].visible = i < balls.length;
        for (let ti = 0; ti < tracks.length; ti++) {
          const list = balls.filter((b) => b.mode === "track" && b.track === ti).sort((a, b) => b.s - a.s);
          let limit = tracks[ti].total;
          for (const b of list) {
            if (b.s > limit) b.s = limit;
            limit = b.s - GAP;
          }
        }
      }

      function orientObject(obj, pos, tangent, outward) {
        const y = new THREE.Vector3(tangent.x, tangent.y, tangent.z).normalize();
        let z = new THREE.Vector3(outward.x, outward.y, outward.z);
        if (Math.abs(y.dot(z)) > 0.98) z = new THREE.Vector3(0, 0, 1);
        z.normalize();
        const x = new THREE.Vector3().crossVectors(y, z).normalize();
        z.crossVectors(x, y).normalize();
        basis.makeBasis(x, y, z);
        obj.quaternion.setFromRotationMatrix(basis);
        obj.position.set(pos.x, pos.y, pos.z);
      }

      function syncVisuals() {
        g1.rotation.z = phi1;
        g2.rotation.z = phi2;
        g3.rotation.z = phi3;
        const sprocketPhi = Math.PI - Math.PI / ZS + (phi3 - Math.PI);
        for (const sprocket of sprockets) sprocket.rotation.z = sprocketPhi;
        let oi = 0;
        let ii = 0;
        let pi = 0;
        for (let i = 0; i < N_LINKS; i++) {
          const mid = chainFrame((i + 0.5) * pitch + chainTravel);
          const outer = i % 2 === 0;
          const mesh = outer ? outerLinks : innerLinks;
          const lateral = outer ? PLATE_LAT + 0.008 : PLATE_LAT - 0.006;
          let cursor = outer ? oi : ii;
          for (const shift of [-lateral, lateral]) {
            orientObject(dummy, mid.pos, mid.tangent, mid.outward);
            dummy.translateX(shift);
            dummy.updateMatrix();
            mesh.setMatrixAt(cursor++, dummy.matrix);
          }
          if (outer) oi = cursor;
          else ii = cursor;
          for (const shift of [-PLATE_LAT, PLATE_LAT]) {
            orientObject(dummy, mid.pos, mid.tangent, mid.outward);
            dummy.translateX(shift);
            dummy.rotateZ(Math.PI / 2);
            dummy.updateMatrix();
            chainRollers.setMatrixAt(i * 2 + (shift < 0 ? 0 : 1), dummy.matrix);
          }
          const pinF = chainFrame(i * pitch + chainTravel);
          for (const shift of [-PLATE_LAT, PLATE_LAT]) {
            orientObject(dummy, pinF.pos, pinF.tangent, pinF.outward);
            dummy.translateX(shift);
            dummy.rotateZ(Math.PI / 2);
            dummy.updateMatrix();
            chainPins.setMatrixAt(pi++, dummy.matrix);
          }
        }
        outerLinks.instanceMatrix.needsUpdate = true;
        innerLinks.instanceMatrix.needsUpdate = true;
        chainPins.instanceMatrix.needsUpdate = true;
        chainRollers.instanceMatrix.needsUpdate = true;
        for (const bucket of buckets) {
          const frame = chainFrame(bucketS(bucket.i));
          orientObject(bucket.group, frame.pos, frame.tangent, frame.outward);
        }
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i];
          const mesh = ballMeshes[i];
          let pos;
          if (b.mode === "pipe") {
            pos = v3(pipeAxisX, b.pipeY, pipeAxisZ);
          } else if (b.mode === "inlet") {
            pos = ballCenter(inletTrack, b.s);
          } else if (b.mode === "carried") {
            pos = seatOf(chainFrame(bucketS(b.bucket)));
            b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              (chainSpeed() / R) * DT,
            ));
          } else {
            pos = ballCenter(tracks[b.track], b.s);
          }
          mesh.position.set(pos.x, pos.y, pos.z);
          mesh.quaternion.copy(b.q);
          mesh.visible = true;
        }
      }

      function soloDescent() {
        let mode = "track";
        let track = 0;
        let s = 0;
        let v = 0.3;
        let pipeY = pipeEnterY;
        let prevY = ballCenter(tracks[0], 0).y;
        const maxSteps = Math.round(90 / DT);
        for (let i = 0; i < maxSteps; i++) {
          let y;
          if (mode === "track") {
            y = ballCenter(tracks[track], s).y;
            if (y > prevY + 1e-3) return { ok: false, reason: "uphill", track, s, mode, y, prevY, dy: y - prevY };
            prevY = y;
            const smp = sample(tracks[track], s);
            v += (-G * smp.dyds - muFor(tracks[track].name) * v) * DT;
            if (v < 0) v = 0;
            if (v > 2.6) v = 2.6;
            s += v * DT;
            if (s >= tracks[track].total) {
              if (track === 0) {
                mode = "inlet";
                s = 0;
              } else if (tracks[track].next == null) return { ok: true, time: i * DT };
              else {
                track = tracks[track].next;
                s = 0;
              }
            }
          } else if (mode === "inlet") {
            y = ballCenter(inletTrack, s).y;
            if (y > prevY + 1e-3) return { ok: false, reason: "uphill-inlet", s, y, prevY };
            prevY = y;
            const smp = sample(inletTrack, s);
            v += (-G * smp.dyds - muFor("inlet") * v) * DT;
            if (v < 0) v = 0;
            if (v > 2.6) v = 2.6;
            s += v * DT;
            if (s >= inletTrack.total) {
              mode = "pipe";
              pipeY = pipeEnterY;
              prevY = pipeEnterY;
            }
          } else {
            v += (G - 0.05 * v) * DT;
            if (v < 0) v = 0;
            if (v > 12) v = 12;
            pipeY -= v * DT;
            if (pipeY > prevY + 1e-3) return { ok: false, reason: "uphill-pipe" };
            prevY = pipeY;
            if (pipeY <= pipeSwitchY) {
              mode = "track";
              track = 1;
              s = 0;
              pipeY = pipeSwitchY;
              prevY = ballCenter(tracks[1], 0).y;
            }
          }
        }
        return { ok: false, reason: "timeout", mode, track, s, v };
      }
      const solo = soloDescent();
      if (!solo.ok) throw new Error("单球无法滚到回收盘：" + JSON.stringify(solo));

      const look = new THREE.Vector3();
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.06;
      controls.minPolarAngle = 0.0008;
      controls.minDistance = 0.35;
      controls.maxDistance = camera.far * 0.5;
      controls.target.copy(look);

      let fly = null;
      let viewName = "wide";
      let viewLocked = true;

      function viewMetrics() {
        const shell = canvasHost.closest(".machine-shell") || canvasHost.parentElement;
        const rect = canvasHost.getBoundingClientRect();
        let width = rect.width;
        let height = rect.height;
        if (width < 2 || height < 2) {
          width = shell?.clientWidth || document.documentElement.clientWidth;
          height = shell?.clientHeight || document.documentElement.clientHeight;
        }
        width = Math.round(width);
        height = Math.round(height);
        if (width < 2 || height < 2) return { width: 0, height: 0, aspect: 1 };
        return { width, height, aspect: width / height };
      }

      const _frameBox = new THREE.Box3();
      const _frameSize = new THREE.Vector3();
      const _frameCenter = new THREE.Vector3();
      const _frameDir = new THREE.Vector3();
      const _meshBox = new THREE.Box3();

      function expandFrameBox(object, box) {
        if (!object.visible) return;
        object.updateWorldMatrix(false, false);
        const geometry = object.geometry;
        if (geometry) {
          if (object.isInstancedMesh) {
            object.computeBoundingBox();
            if (object.boundingBox && !object.boundingBox.isEmpty()) {
              _meshBox.copy(object.boundingBox).applyMatrix4(object.matrixWorld);
              box.union(_meshBox);
            }
          } else if (geometry.getAttribute("position")) {
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            _meshBox.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
            box.union(_meshBox);
          }
        }
        for (const child of object.children) expandFrameBox(child, box);
      }

      function frameObject(object3D, dirVector, distScale) {
        object3D.updateWorldMatrix(true, true);
        _frameBox.makeEmpty();
        expandFrameBox(object3D, _frameBox);
        if (_frameBox.isEmpty()) {
          _frameCenter.set(0, 0, 0);
          _frameSize.set(1, 1, 1);
        } else {
          _frameBox.getCenter(_frameCenter);
          _frameBox.getSize(_frameSize);
        }
        const diagonal = Math.max(_frameSize.length(), 1e-4);
        _frameDir.copy(dirVector).normalize();
        const dist = diagonal * distScale;
        return {
          target: _frameCenter.clone(),
          pos: _frameCenter.clone().addScaledVector(_frameDir, dist),
        };
      }

      function pose(name) {
        if (name === "top") return frameObject(machineRoot, new THREE.Vector3(0.001, 1, 0.001), 1.25);
        if (name === "gears") return frameObject(gearGroup, new THREE.Vector3(0.35, 0.25, 1), 2);
        return frameObject(machineRoot, new THREE.Vector3(1, 0.65, 1), 1.15);
      }

      function releaseOrbit() {
        controls._sphericalDelta.set(0, 0, 0);
        controls._panOffset.set(0, 0, 0);
        controls._scale = 1;
        controls.state = -1;
      }

      function applyPose(next, snap) {
        const dist = Math.max(0.001, next.pos.distanceTo(next.target));
        controls.minDistance = Math.min(0.35, dist * 0.2);
        controls.maxDistance = Math.max(dist * 4, camera.far * 0.45);
        releaseOrbit();
        if (snap) {
          camera.position.copy(next.pos);
          controls.target.copy(next.target);
          controls.enabled = true;
          fly = null;
          controls.update();
        } else {
          fly = {
            fromPos: camera.position.clone(),
            fromTarget: controls.target.clone(),
            pos: next.pos.clone(),
            target: next.target.clone(),
            elapsed: 0,
          };
          controls.enabled = false;
        }
      }

      let layoutTries = 0;
      function layout(snap) {
        const { width, height, aspect } = viewMetrics();
        if (width < 2 || height < 2) {
          if (layoutTries < 40) {
            layoutTries += 1;
            requestAnimationFrame(() => layout(snap));
          }
          return;
        }
        layoutTries = 0;
        const cap = width < 820 ? 1.5 : 1.75;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
        camera.aspect = aspect;
        renderer.setSize(width, height, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.updateProjectionMatrix();
        if (snap && viewLocked && !fly) applyPose(pose(viewName), true);
      }

      function setView(name, snap = false) {
        viewName = name;
        viewLocked = true;
        applyPose(pose(name), snap);
        document.querySelectorAll("[data-view]").forEach((btn) => {
          btn.setAttribute("aria-pressed", btn.dataset.view === name ? "true" : "false");
        });
      }
      controls.addEventListener("start", () => {
        fly = null;
        controls.enabled = true;
        viewLocked = false;
      });
      spawn(8);
      syncVisuals();
      setView("wide", true);
      look.copy(controls.target);
      layout(true);

      let statusText = "";
      function refreshStatus() {
        const status = document.getElementById("status");
        if (!status) return;
        const label = !playing ? "已暂停" : pauseLeft > 0 ? "入口占用，链条停半拍" : "运行中";
        const text = label + " · " + count + " 颗钢珠";
        if (text === statusText && status.textContent === text) return;
        statusText = text;
        status.textContent = text;
      }
      refreshStatus();

      window.__machineUi = (btn) => {
        if (btn.id === "btn-play") {
          playing = !playing;
          btn.textContent = playing ? "暂停" : "继续";
          btn.setAttribute("aria-pressed", playing ? "true" : "false");
          refreshStatus();
          return;
        }
        if (btn.dataset.speed) {
          speed = Number(btn.dataset.speed);
          document.querySelectorAll("[data-speed]").forEach((el) => {
            el.setAttribute("aria-pressed", el === btn ? "true" : "false");
          });
          return;
        }
        if (btn.dataset.count) {
          count = Number(btn.dataset.count);
          spawn(count);
          document.querySelectorAll("[data-count]").forEach((el) => {
            el.setAttribute("aria-pressed", el === btn ? "true" : "false");
          });
          refreshStatus();
          return;
        }
        if (btn.dataset.view) setView(btn.dataset.view);
      };
      if (!window.__uiClickBound) {
        window.__uiClickBound = true;
        document.addEventListener("click", (event) => {
          const btn = event.target.closest("button");
          if (!btn || !btn.closest("#hud")) return;
          window.__machineUi?.(btn);
        });
      }

      let loadingDismissed = false;
      function dismissLoading() {
        if (loadingDismissed) return;
        loadingDismissed = true;
        document.documentElement.classList.add("is-ready");
        const loading = document.getElementById("loading");
        if (loading) loading.style.display = "none";
      }

      let acc = 0;
      let last = performance.now();
      let audit = null;

      function auditScan() {
        if (!audit) return;
        const groups = new Map();
        for (const b of balls) {
          if (!Number.isFinite(b.s) || !Number.isFinite(b.v)) audit.nan++;
          if (b.mode !== "track") continue;
          const arr = groups.get(b.track) || [];
          arr.push(b.s);
          groups.set(b.track, arr);
        }
        for (const arr of groups.values()) {
          arr.sort((a, b) => a - b);
          for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] < GAP - 1e-3) audit.overlaps++;
        }
      }

      function frame(now) {
        try {
          const wall = Math.max(0, (now - last) / 1000);
          const raw = Math.min(0.05, wall);
          last = now;
          if (playing) acc += raw * speed;
          let guard = 0;
          while (acc >= DT && guard < 20) {
            step(DT);
            if (audit) auditScan();
            acc -= DT;
            guard++;
          }
          if (guard >= 20) acc = 0;
          refreshStatus();
          syncVisuals();
          if (fly) {
            fly.elapsed += wall;
            const k = Math.min(1, fly.elapsed / 0.8);
            camera.position.lerpVectors(fly.fromPos, fly.pos, k);
            controls.target.lerpVectors(fly.fromTarget, fly.target, k);
            if (k >= 1) {
              camera.position.copy(fly.pos);
              controls.target.copy(fly.target);
              controls.enabled = true;
              releaseOrbit();
              controls.update();
              fly = null;
            }
          } else {
            controls.update();
          }
        } catch (err) {
          console.error(err);
        }
        attachCanvas();
        try {
          renderer.render(scene, camera);
          dismissLoading();
        } catch (err) {
          console.error(err);
        }
      }
      renderer.setAnimationLoop(frame);

      layout(true);
      const resizeObserver = new ResizeObserver(() => layout(true));
      resizeObserver.observe(canvasHost);
      window.addEventListener("resize", () => layout(true));
      window.visualViewport?.addEventListener("resize", () => layout(true));

      const pipeClearance = (() => {
        const rOut = 1.5 * R + 0.15 * R;
        const y0 = yOutlet;
        const y1 = discBottom;
        let min = Infinity;
        const hits = [];
        function consider(name, p, rad) {
          const yc = Math.max(y0, Math.min(y1, p.y));
          const d = Math.hypot(p.x - pipeAxisX, p.z - pipeAxisZ, (p.y - yc) * 0.15) - rad - rOut;
          const horiz = Math.hypot(p.x - pipeAxisX, p.z - pipeAxisZ) - rad - rOut;
          const gap = p.y >= y0 - rad && p.y <= y1 + rad ? horiz : d;
          if (gap < min) min = gap;
          if (gap < 0.3 * R) hits.push({ name, gap: Math.round(gap * 1000) / 1000 });
        }
        for (const g of [
          { z: Z1, x: x1 },
          { z: Z2, x: x2 },
          { z: Z3, x: x3 },
        ]) {
          const rt = (g.z * M) / 2 + M;
          for (let a = 0; a < 24; a++) {
            const ang = (a / 24) * Math.PI * 2;
            consider("gear", v3(g.x + Math.cos(ang) * rt, gearY + Math.sin(ang) * rt, zGear), GEAR_TH * 0.5);
          }
        }
        for (let i = 0; i <= 48; i++) {
          const frame = chainFrame((chainL * i) / 48);
          consider("chain", frame.pos, 0.06);
          consider("bucket", add(frame.pos, scale(frame.outward, 0.16)), 0.24);
        }
        for (const p of supportPts) {
          const top = p.y + (p.y - baseTop);
          if (top < yOutlet - 0.04) continue;
          consider("support", v3(p.x, top, p.z), 0.18);
        }
        consider("pillar", v3(x1, (baseTop + gearY) / 2, zGear + 0.78), 0.12);
        return { min: Math.round(min * 1000) / 1000, hits, limit: Math.round(0.3 * R * 1000) / 1000 };
      })();
      if (pipeClearance.hits.length) {
        console.warn("管道间隙不足", pipeClearance.hits);
      }

      const clipReport = (() => {
        const need = 1.5 * R;
        const hits = [];
        function note(name, gap) {
          if (gap < need) hits.push({ name, gap: Math.round(gap * 1000) / 1000 });
        }
        function gapCyl(p, cx, cy, cz, rad, halfZ) {
          const radial = Math.hypot(p.x - cx, p.y - cy) - rad;
          const dz = Math.abs(p.z - cz) - halfZ;
          if (dz <= 0) return radial;
          if (radial <= 0) return dz;
          return Math.hypot(radial, dz);
        }
        const gears = [
          { name: "g1", x: x1, z: Z1 },
          { name: "g2", x: x2, z: Z2 },
          { name: "g3", x: x3, z: Z3 },
        ];
        const sprocketR = RS + (2 * RS) / ZS;
        const discR = 1.25 + 1.1 * R + 0.05;
        function gapDisc(p) {
          const cy = discBottom + 0.04;
          const dx = p.x - funnelC.x;
          const dz = p.z - funnelC.z;
          const rad = Math.hypot(dx, dz);
          const ang = Math.atan2(-dz, dx);
          const sproX = xS - funnelC.x;
          const sproY = -(zC - funnelC.z);
          const keep = RS + 0.52;
          const full = 1.25 + 1.1 * R + 0.05;
          let outer = full;
          if (Math.hypot(Math.cos(ang) * full - sproX, Math.sin(ang) * full - sproY) < keep) {
            let lo = 0.42;
            let hi = full;
            for (let k = 0; k < 18; k++) {
              const mid = (lo + hi) / 2;
              const d = Math.hypot(Math.cos(ang) * mid - sproX, Math.sin(ang) * mid - sproY);
              if (d < keep) hi = mid;
              else lo = mid;
            }
            outer = Math.max(0.42, lo);
          }
          if (inEntryNotch(v3(funnelC.x + Math.cos(ang) * outer, 0, funnelC.z - Math.sin(ang) * outer))) {
            let lo = 0.2;
            let hi = outer;
            for (let k = 0; k < 18; k++) {
              const mid = (lo + hi) / 2;
              if (inEntryNotch(v3(funnelC.x + Math.cos(ang) * mid, 0, funnelC.z - Math.sin(ang) * mid))) hi = mid;
              else lo = mid;
            }
            outer = lo;
          }
          const dy = Math.abs(p.y - cy) - 0.04;
          const horiz = rad < 0.35 ? 0.35 - rad : rad > outer ? rad - outer : 0;
          if (horiz === 0) return dy;
          if (dy <= 0) return horiz;
          return Math.hypot(horiz, dy);
        }
        function gapPipe(p) {
          const rad = Math.hypot(p.x - pipeAxisX, p.z - pipeAxisZ) - (1.65 * R);
          const y0 = yOutlet;
          const y1 = discBottom;
          const dy = p.y < y0 ? y0 - p.y : p.y > y1 ? p.y - y1 : 0;
          if (dy === 0) return rad;
          if (rad <= 0) return dy;
          return Math.hypot(rad, dy);
        }
        let gearDisc = Infinity;
        for (let a = 0; a < 72; a++) {
          const ang = (a / 72) * Math.PI * 2;
          const rt = (Z3 * M) / 2 + M;
          const p = v3(x3 + Math.cos(ang) * rt, gearY + Math.sin(ang) * rt, zGear);
          gearDisc = Math.min(gearDisc, gapDisc(p));
        }
        const pinZ = GEAR_TH / 2 + 0.15;
        for (const gz of [zGear - pinZ, zGear + pinZ]) {
          gearDisc = Math.min(gearDisc, gapDisc(v3(x3, gearY, gz)) - 0.1);
        }
        for (const tr of tracks) {
          for (let i = 0; i < N; i += 4) {
            const p = tr.centerline ? tr.pts[i] : add(tr.pts[i], scale(tr.up[i], R));
            for (const g of gears) {
              const rt = (g.z * M) / 2 + M;
              note(tr.name + "→" + g.name, gapCyl(p, g.x, gearY, zGear, rt, GEAR_TH / 2));
            }
            note(tr.name + "→上链轮", gapCyl(p, xS, yTop, zC, sprocketR, 0.05));
            note(tr.name + "→下链轮", gapCyl(p, xS, yBot, zC, sprocketR, 0.05));
            if (tr.name !== "inlet" && tr !== inletTrack) note(tr.name + "→管道", gapPipe(p));
            if (tr.name !== "funnel") note(tr.name + "→圆盘", gapDisc(p));
          }
        }
        let bucketGap = Infinity;
        const bucketHits = [];
        let bucketTrack = Infinity;
        let bucketTrackName = "";
        let discHit = null;
        for (let i = 0; i < 48; i++) {
          const frame = chainFrame((chainL * i) / 48);
          const b = add(frame.pos, scale(frame.outward, 0.2));
          const nearJoint = len(sub(b, pourSeat)) < 0.55 || len(sub(b, scoopSeat)) < 0.55;
          for (const g of gears) {
            const rt = (g.z * M) / 2 + M;
            const gap = gapCyl(b, g.x, gearY, zGear, rt, GEAR_TH / 2) - 0.24;
            if (!nearJoint && gap < bucketGap) bucketGap = gap;
            if (!nearJoint && gap < 0.2 * R) bucketHits.push(g.name);
          }
          const pg = gapPipe(b) - 0.24;
          if (!nearJoint && pg < bucketGap) bucketGap = pg;
          if (!nearJoint && pg < 0.2 * R) bucketHits.push("pipe");
          const dg = gapDisc(b) - 0.24;
          if (dg < (discHit ? discHit.gap : Infinity)) {
            discHit = {
              gap: Math.round(dg * 1000) / 1000,
              x: Math.round(b.x * 100) / 100,
              y: Math.round(b.y * 100) / 100,
              z: Math.round(b.z * 100) / 100,
              near: nearJoint,
            };
          }
          if (!nearJoint && dg < bucketGap) bucketGap = dg;
          if (!nearJoint && dg < 0.2 * R) bucketHits.push("disc");
          for (const tr of tracks) {
            for (let k = 0; k < N; k += 8) {
              const p = tr.centerline ? tr.pts[k] : add(tr.pts[k], scale(tr.up[k], R));
              if (len(sub(p, pourSeat)) < 0.4 || len(sub(p, scoopSeat)) < 0.4) continue;
              const d = len(sub(b, p)) - 0.24 - 0.2 * R;
              if (d < bucketTrack) {
                bucketTrack = d;
                bucketTrackName = tr.name;
              }
            }
          }
        }
        hits.sort((a, b) => a.gap - b.gap);
        return {
          gearDisc: Math.round(gearDisc * 1000) / 1000,
          gearMesh: [Math.round(gearMin12 * 1000) / 1000, Math.round(gearMin23 * 1000) / 1000],
          bucketGap: Math.round(bucketGap * 1000) / 1000,
          bucketHits: bucketHits.slice(0, 6),
          bucketTrack: Math.round(bucketTrack * 1000) / 1000,
          bucketTrackName,
          discHit,
          trackHits: hits.slice(0, 8),
          funnelWall: Math.round((1.1 * R - R) * 1000) / 1000,
          chuteLeave: tracks[1].pts.filter((_, i) => i % 20 === 0).slice(0, 6).map((p) => ({
            y: Math.round((p.y - yOutlet) * 1000) / 1000,
            rad: Math.round(Math.hypot(p.x - pipeAxisX, p.z - pipeAxisZ) * 1000) / 1000,
          })),
        };
      })();
      console.log("穿模", JSON.stringify(clipReport));

      const liftClear = (() => {
        const keep = 0.2 * R;
        let worst = { gap: Infinity, name: "", x: 0, y: 0, z: 0 };
        function note(name, gap, p) {
          if (gap < worst.gap) worst = { gap, name, x: p ? p.x : 0, y: p ? p.y : 0, z: p ? p.z : 0 };
        }
        function obbDist(p, c, ax, ay, az, hx, hy, hz) {
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const dz = p.z - c.z;
          const lx = dx * ax.x + dy * ax.y + dz * ax.z;
          const ly = dx * ay.x + dy * ay.y + dz * ay.z;
          const lz = dx * az.x + dy * az.y + dz * az.z;
          const qx = Math.max(-hx, Math.min(hx, lx));
          const qy = Math.max(-hy, Math.min(hy, ly));
          const qz = Math.max(-hz, Math.min(hz, lz));
          return Math.hypot(lx - qx, ly - qy, lz - qz);
        }
        function axesOf(tangent, outward) {
          let y = tangent;
          const yl = Math.hypot(y.x, y.y, y.z) || 1;
          y = v3(y.x / yl, y.y / yl, y.z / yl);
          let z = outward;
          if (Math.abs(dot(y, z)) > 0.98) z = v3(0, 0, 1);
          z = norm(z);
          const x = norm(cross(y, z));
          z = norm(cross(x, y));
          return { x, y, z };
        }
        function solids(travel) {
          const out = [];
          for (let i = 0; i < N_LINKS; i++) {
            const mid = chainFrame((i + 0.5) * pitch + travel);
            const outer = i % 2 === 0;
            const lateral = outer ? PLATE_LAT + 0.008 : PLATE_LAT - 0.006;
            const hx = outer ? 0.008 : 0.006;
            const hy = (outer ? pitch * 1.46 : pitch * 1.32) / 2;
            const hz = outer ? 0.025 : 0.022;
            const ax = axesOf(mid.tangent, mid.outward);
            for (const shift of [-lateral, lateral]) {
              out.push({ c: add(mid.pos, scale(ax.x, shift)), ax: ax.x, ay: ax.y, az: ax.z, hx, hy, hz });
            }
            for (const shift of [-PLATE_LAT, PLATE_LAT]) {
              out.push({ c: add(mid.pos, scale(ax.x, shift)), ax: ax.x, ay: ax.y, az: ax.z, hx: 0.018, hy: 0.02, hz: 0.02 });
            }
            const pinF = chainFrame(i * pitch + travel);
            const px = axesOf(pinF.tangent, pinF.outward);
            for (const shift of [-PLATE_LAT, PLATE_LAT]) {
              out.push({ c: add(pinF.pos, scale(px.x, shift)), ax: px.x, ay: px.y, az: px.z, hx: 0.016, hy: 0.012, hz: 0.012 });
            }
          }
          return out;
        }
        const y0g = yBot + RS + 0.12;
        const y1g = yTop - RS - 0.12;
        const guides = [];
        for (const x of [xS - RS, xS + RS]) {
          for (const z of [-0.46, 0.46]) {
            guides.push({ c: v3(x, (y0g + y1g) / 2, z), hx: 0.03, hy: (y1g - y0g) / 2, hz: 0.016 });
          }
        }
        function aabbDist(p, b) {
          const dx = Math.max(Math.abs(p.x - b.c.x) - b.hx, 0);
          const dy = Math.max(Math.abs(p.y - b.c.y) - b.hy, 0);
          const dz = Math.max(Math.abs(p.z - b.c.z) - b.hz, 0);
          return Math.hypot(dx, dy, dz);
        }
        const gears = [
          { x: x1, rt: (Z1 * M) / 2 + M },
          { x: x2, rt: (Z2 * M) / 2 + M },
          { x: x3, rt: (Z3 * M) / 2 + M },
        ];
        function gearDist(p) {
          let best = Infinity;
          for (const g of gears) {
            const radial = Math.hypot(p.x - g.x, p.y - gearY) - g.rt;
            const dz = Math.abs(p.z - zGear) - GEAR_TH / 2;
            const d = dz <= 0 ? radial : radial <= 0 ? dz : Math.hypot(radial, dz);
            if (d < best) best = d;
          }
          return best;
        }
        const tipR = RS + mS;
        function teeth(phi, zFace) {
          const pts = [];
          const tau = (2 * Math.PI) / ZS;
          for (let i = 0; i < ZS; i++) {
            for (const da of [-TIP_K * tau, 0, TIP_K * tau]) {
              const a = phi + i * tau + da;
              for (const y of [yTop, yBot]) pts.push(v3(xS + Math.cos(a) * tipR, y + Math.sin(a) * tipR, zFace));
            }
          }
          return pts;
        }
        const travel0 = straight * 0.42;
        for (let ph = 0; ph < 8; ph++) {
          const travel = (ph / 8) * chainL;
          const phi3p = Math.PI + (travel - travel0) / RS;
          const sPhi = phi3p - Math.PI / ZS;
          const boxes = solids(travel);
          const tips = teeth(sPhi, cheekZ - cheekT / 2).concat(teeth(sPhi, -(cheekZ - cheekT / 2)));
          const balls = [];
          for (let b = 0; b < 6; b++) balls.push(seatOf(chainFrame(mod(travel + b * (chainL / 6), chainL))));
          for (const ball of balls) {
            for (const box of boxes) note("链节→球", obbDist(ball, box.c, box.ax, box.ay, box.az, box.hx, box.hy, box.hz) - R);
            for (const g of guides) note("导板→球", aabbDist(ball, g) - R);
            for (const t of tips) note("链轮→球", len(sub(ball, t)) - R);
          }
          for (const box of boxes) {
            for (const sx of [-1, 1]) {
              for (const sy of [-1, 1]) {
                for (const sz of [-1, 1]) {
                  const c = add(add(add(box.c, scale(box.ax, sx * box.hx)), scale(box.ay, sy * box.hy)), scale(box.az, sz * box.hz));
                  note("链节→齿轮", gearDist(c));
                }
              }
            }
          }
          for (const t of tips) note("链轮→齿轮", gearDist(t));
          for (const g of guides) {
            for (const sx of [-1, 1]) {
              for (const sy of [-1, 1]) {
                for (const sz of [-1, 1]) {
                  note("导板→齿轮", gearDist(v3(g.c.x + sx * g.hx, g.c.y + sy * g.hy, g.c.z + sz * g.hz)));
                }
              }
            }
          }
          for (const tr of tracks) {
            for (let i = 0; i < N; i += 8) {
              const p = tr.centerline ? tr.pts[i] : add(tr.pts[i], scale(tr.up[i], R));
              for (const box of boxes) note(tr.name + "→链节", obbDist(p, box.c, box.ax, box.ay, box.az, box.hx, box.hy, box.hz) - R, p);
              for (const g of guides) note(tr.name + "→导板", aabbDist(p, g) - R);
              for (const t of tips) note(tr.name + "→链轮", len(sub(p, t)) - R, p);
            }
          }
        }
        return {
          gap: Math.round(worst.gap * 1000) / 1000,
          name: worst.name,
          at: { x: Math.round(worst.x * 1000) / 1000, y: Math.round(worst.y * 1000) / 1000, z: Math.round(worst.z * 1000) / 1000 },
          limit: Math.round(keep * 1000) / 1000,
          ok: worst.gap >= keep - 1e-3,
        };
      })();
      console.log("提升机间隙", JSON.stringify(liftClear));

      window.__machine = {
        ready: true,
        canvas: renderer.domElement,
        scene,
        R,
        entrance: {
          radialDev,
          radialLimit: 0.15 * R,
          pourJoin,
          exitHeight,
          floorJoin,
          ringClear,
          guideLen,
          overDisc,
          notchHalf: entryNotch ? entryNotch.half : 0,
          scurveN: tracks[2].pts.length,
          pourRadii: pour.pts.filter((_, i) => i % 40 === 0 || i === N - 1).map((p) => Math.round(Math.hypot(p.x - funnelC.x, p.z - funnelC.z) * 1000) / 1000),
          at: { x: funnelIn.x, y: funnelIn.y, z: funnelIn.z },
          seat: { x: pourSeat.x, y: pourSeat.y, z: pourSeat.z },
          gate: { x: gate.x, y: gate.y, z: gate.z },
          Lsafe,
        },
        RS,
        extra,
        slopes,
        fillets: filletReport,
        joints: jointReport,
        seam: jointList,
        pipe: {
          x: pipeAxisX,
          z: pipeAxisZ,
          switchY: pipeSwitchY,
          outletY: yOutlet,
          floorY: yFloor,
          enterY: pipeEnterY,
          top: discBottom,
          innerD: 2.3 * R,
          wall: 0.15 * R,
          clearance: pipeClearance,
        },
        gearMin12,
        gearMin23,
        liftClear,
        solo,
        releaseSeat,
        scoopSeat,
        winding,
        camera,
        controls,
        look: { x: look.x, y: look.y, z: look.z },
        gearFocus: (() => {
          const box = new THREE.Box3().setFromObject(gearGroup);
          const c = box.getCenter(new THREE.Vector3());
          return { x: c.x, y: c.y, z: c.z };
        })(),
        getBalls: () => balls.map((b) => ({ mode: b.mode, track: b.track, s: b.s, v: b.v, bucket: b.bucket })),
        ballXYZ: () => ballMeshes.filter((m) => m.visible).map((m) => ({ x: m.position.x, y: m.position.y, z: m.position.z })),
        lookAt(px, py, pz, tx, ty, tz) {
          fly = null;
          viewLocked = false;
          camera.position.set(px, py, pz);
          controls.target.set(tx, ty, tz);
          releaseOrbit();
          controls.update();
          renderer.render(scene, camera);
        },
        getPhase: () => ({ phi1, phi2, phi3, chainTravel, pauseLeft, playing, speed, count }),
        audit(seconds) {
          audit = { overlaps: 0, nan: 0 };
          emptyRun = 0;
          maxEmptyRun = 0;
          const n = Math.round(seconds / DT);
          const before = playing;
          playing = true;
          const phase0 = phi3;
          const seen = balls.map(() => -1);
          const funnelTimes = [];
          let maxQueue = 0;
          let maxQueueLate = 0;
          let queueSamples = 0;
          let queueSum = 0;
          let over3 = 0;
          for (let i = 0; i < n; i++) {
            step(DT);
            if (i % 8 === 0) auditScan();
            let waiting = 0;
            for (let bi = 0; bi < balls.length; bi++) {
              const b = balls[bi];
              if (b.mode === "track" && (b.track === 3 || b.track === 4) && b.v < 0.05 && tracks[b.track].total - b.s < 1.6) waiting++;
              if (b.mode === "track" && b.track === 0) {
                if (b.s < 0.15 && seen[bi] < 0) seen[bi] = i;
                if (seen[bi] >= 0 && b.s > tracks[0].total - 0.05) {
                  funnelTimes.push((i - seen[bi]) * DT);
                  seen[bi] = -2;
                }
              } else if (seen[bi] >= 0) {
                funnelTimes.push((i - seen[bi]) * DT);
                seen[bi] = -2;
              }
            }
            if (waiting > maxQueue) maxQueue = waiting;
            if (i * DT > 20 && waiting > maxQueueLate) maxQueueLate = waiting;
            if (waiting > 3) over3++;
            queueSum += waiting;
            queueSamples++;
          }
          auditScan();
          const gearTurns = (phi3 - phase0) / (2 * Math.PI);
          const funnelAvg = funnelTimes.length ? funnelTimes.reduce((a, b) => a + b, 0) / funnelTimes.length : null;
          const out = {
            overlaps: audit.overlaps,
            nan: audit.nan,
            emptyRun: maxEmptyRun,
            maxQueue,
            maxQueueLate,
            queueAvg: Math.round((queueSum / queueSamples) * 100) / 100,
            funnelAvg: funnelAvg == null ? null : Math.round(funnelAvg * 100) / 100,
            funnelN: funnelTimes.length,
            gearSec: Math.round((seconds / gearTurns) * 100) / 100,
            slow: Math.round(over3 * DT * 10) / 10,
          };
          audit = null;
          playing = before;
          syncVisuals();
          return out;
        },
      };
    }
}

