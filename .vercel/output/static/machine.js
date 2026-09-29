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
      const MU = 0.2;
      const G = 9.8 * 0.62;
      const DT = 1 / 120;
      const N = 400;
      const GAP = 2.2 * R;
      const M = 0.021;
      const Z1 = 12, Z2 = 36, Z3 = 60;
      const GEAR_TH = 0.09;
      const TIP_K = 0.14;
      const ROOT_K = 0.26;
      const OMEGA1 = 5.4;
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
      const holeCenter = v3(funnelC.x, funnelEnd.y - 0.02, funnelC.z);
      const dropEnd = v3(funnelC.x, holeCenter.y - 0.6, funnelC.z);
      const lenIn = len(sub(holeCenter, funnelEnd));
      const lenDrop = 0.6;
      const lenRun = len(sub(ramp1End, dropEnd));
      const dropTotal = lenIn + lenDrop + lenRun;
      function dropPoint(t) {
        const s = t * dropTotal;
        if (s <= lenIn) return lerp(funnelEnd, holeCenter, lenIn ? s / lenIn : 1);
        if (s <= lenIn + lenDrop) return lerp(holeCenter, dropEnd, (s - lenIn) / lenDrop);
        return lerp(dropEnd, ramp1End, lenRun ? (s - lenIn - lenDrop) / lenRun : 1);
      }

      const curveFns = [
        (t) => funnelPoint(t),
        dropPoint,
        sPoint,
        lineFn(J.sEnd, J.ramp2End),
        lineFn(J.ramp2End, J.trayEnd),
      ];
      const trackNames = ["funnel", "drop", "scurve", "ramp2", "tray"];

      function buildTrack(fn) {
        const pts = [];
        for (let i = 0; i < N; i++) pts.push(fn(i / (N - 1)));
        const sTab = new Float64Array(N);
        let total = 0;
        for (let i = 1; i < N; i++) {
          total += len(sub(pts[i], pts[i - 1]));
          sTab[i] = total;
        }
        const dyds = new Float64Array(N);
        dyds[0] = (pts[1].y - pts[0].y) / (sTab[1] - sTab[0]);
        dyds[N - 1] = (pts[N - 1].y - pts[N - 2].y) / (sTab[N - 1] - sTab[N - 2]);
        for (let i = 1; i < N - 1; i++) {
          dyds[i] = (pts[i + 1].y - pts[i - 1].y) / (sTab[i + 1] - sTab[i - 1]);
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
        return { pts, sTab, dyds, side, up, tangent, total, fn };
      }

      const tracks = curveFns.map(buildTrack);
      tracks.forEach((tr, i) => {
        tr.name = trackNames[i];
        tr.next = i < tracks.length - 1 ? i + 1 : null;
      });

      const slopes = tracks.map((tr) => {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < N; i++) {
          min = Math.min(min, tr.dyds[i]);
          max = Math.max(max, tr.dyds[i]);
        }
        return { name: tr.name, min, max, total: tr.total };
      });
      const badSlope = slopes.find((s) => !(s.max < -1e-4));
      if (badSlope) throw new Error("轨道坡度不为负：" + badSlope.name);

      function sample(track, s) {
        s = Math.max(0, Math.min(track.total, s));
        let lo = 0;
        let hi = N - 1;
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
        return add(smp.pos, scale(smp.up, R));
      }

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
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
      renderer.setClearColor(0xefe2cf, 1);
      canvasHost.appendChild(renderer.domElement);

      function attachCanvas() {
        const host = document.getElementById("view");
        if (host && renderer.domElement.parentElement !== host) host.appendChild(renderer.domElement);
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xefe2cf);

      try {
        const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
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
        color: 0xd9b98a,
        roughness: 0.8,
        metalness: 0.04,
      });
      const woodDark = new THREE.MeshStandardMaterial({
        map: woodMap,
        color: 0xc6a06e,
        roughness: 0.82,
        metalness: 0.04,
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
          const x = p0.x + (p1.x - p0.x) * u + (s0.x + (s1.x - s0.x) * u) * 0.55 * R * sideSign + (u0.x + (u1.x - u0.x) * u) * yLift;
          const y = p0.y + (p1.y - p0.y) * u + (s0.y + (s1.y - s0.y) * u) * 0.55 * R * sideSign + (u0.y + (u1.y - u0.y) * u) * yLift;
          const z = p0.z + (p1.z - p0.z) * u + (s0.z + (s1.z - s0.z) * u) * 0.55 * R * sideSign + (u0.z + (u1.z - u0.z) * u) * yLift;
          return target.set(x, y, z);
        };
        return new THREE.TubeGeometry(curve, 280, radius, 7, false);
      }

      const railRadius = 0.12 * R;
      for (let ti = 0; ti < tracks.length; ti++) {
        if (ti < 2) continue;
        const tr = tracks[ti];
        for (const sign of [-1, 1]) {
          const mesh = new THREE.Mesh(tubeAlong(tr, sign, railRadius, 0), brass);
          mesh.castShadow = true;
          scene.add(mesh);
        }
        const bed = new THREE.Mesh(tubeAlong(tr, 0, 0.064, -0.078), wood);
        bed.castShadow = true;
        bed.receiveShadow = true;
        scene.add(bed);
      }

      function addUChannel(pts, sides, ups) {
        const half = 1.1 * R;
        const wallT = 0.15 * R;
        const wallH = 1.1 * R;
        const floorT = 0.15 * R;
        const n = pts.length;
        if (n < 2) return;
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
          const p = pts[i];
          const sd = sides[i];
          const up = ups[i];
          const L = add(p, scale(sd, -half));
          const Rgt = add(p, scale(sd, half));
          left.push(L);
          right.push(Rgt);
          leftBot.push(add(L, scale(up, -floorT)));
          rightBot.push(add(Rgt, scale(up, -floorT)));
          leftTop.push(add(L, scale(up, wallH)));
          rightTop.push(add(Rgt, scale(up, wallH)));
          leftOut.push(add(L, scale(sd, -wallT)));
          rightOut.push(add(Rgt, scale(sd, wallT)));
          leftOutTop.push(add(add(L, scale(sd, -wallT)), scale(up, wallH)));
          rightOutTop.push(add(add(Rgt, scale(sd, wallT)), scale(up, wallH)));
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
      }

      addUChannel(tracks[0].pts, tracks[0].side, tracks[0].up);
      {
        const pts = [];
        const sides = [];
        const ups = [];
        const tr = tracks[1];
        for (let i = 0; i < N; i++) {
          if (tr.pts[i].y > dropEnd.y + 1e-3) continue;
          pts.push(tr.pts[i]);
          sides.push(tr.side[i]);
          ups.push(tr.up[i]);
        }
        addUChannel(pts, sides, ups);
      }

      {
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.15 * R, 8, 48), woodDark);
        lip.rotation.x = Math.PI / 2;
        lip.position.set(funnelC.x, H_funnel - 0.12 - 0.3 * R, funnelC.z);
        lip.castShadow = true;
        lip.receiveShadow = true;
        scene.add(lip);
        const outerR = 1.25 + 1.1 * R + 0.05;
        const trayShape = new THREE.Shape();
        trayShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
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
      for (const idx of [2, 3]) {
        const tr = tracks[idx];
        for (let i = 8; i < N; i += 36) {
          const p = tr.pts[i];
          const u = tr.up[i];
          supportPts.push(v3(p.x - u.x * 0.09, p.y - u.y * 0.09, p.z - u.z * 0.09));
        }
      }

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
        new THREE.MeshStandardMaterial({ color: 0xe7d3b0, roughness: 0.92, metalness: 0 }),
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
      const corners = [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ];
      const postGeo = new THREE.BoxGeometry(0.12, postH, 0.12);
      for (const [px, pz] of corners) {
        const post = new THREE.Mesh(postGeo, wood);
        post.position.set(px, baseTop + postH / 2, pz);
        post.castShadow = true;
        post.receiveShadow = true;
        scene.add(post);
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

      const dowelGeo = new THREE.CylinderGeometry(0.03, 0.035, 1, 8);
      for (const p of supportPts) {
        const h = Math.max(0.2, p.y - baseTop);
        const dowel = new THREE.Mesh(dowelGeo, woodDark);
        dowel.scale.y = h;
        dowel.position.set(p.x, baseTop + h / 2, p.z);
        dowel.castShadow = true;
        scene.add(dowel);
      }

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

      const mS = (2 * RS) / ZS;
      const sprocketGeo = gearGeometry(ZS, mS, 0.07);
      const sprocketTop = new THREE.Mesh(sprocketGeo, darkMetal);
      const sprocketBot = new THREE.Mesh(sprocketGeo, darkMetal);
      sprocketTop.position.set(xS, yTop, zC);
      sprocketBot.position.set(xS, yBot, zC);
      sprocketTop.castShadow = true;
      sprocketBot.castShadow = true;
      scene.add(sprocketTop, sprocketBot);

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
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, pillarH, 0.14), wood);
      pillar.position.set(x1, baseTop + pillarH / 2, zGear + 0.78);
      pillar.castShadow = true;
      scene.add(pillar);

      const linkGeo = new THREE.BoxGeometry(0.045, pitch * 0.62, 0.02);
      const links = new THREE.InstancedMesh(linkGeo, chainMat, N_LINKS);
      links.castShadow = false;
      links.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(links);
      const dummy = new THREE.Object3D();
      const basis = new THREE.Matrix4();

      const buckets = [];
      const bucketGeo = {
        floor: new THREE.BoxGeometry(0.46, 0.03, 0.36),
        side: new THREE.BoxGeometry(0.03, 0.22, 0.36),
        back: new THREE.BoxGeometry(0.46, 0.22, 0.03),
      };
      for (let i = 0; i < 6; i++) {
        const group = new THREE.Group();
        const floorM = new THREE.Mesh(bucketGeo.floor, wood);
        floorM.position.set(0, -0.08, 0.16);
        const back = new THREE.Mesh(bucketGeo.back, woodDark);
        back.position.set(0, 0.01, 0.33);
        const left = new THREE.Mesh(bucketGeo.side, wood);
        left.position.set(-0.215, 0.01, 0.16);
        const right = new THREE.Mesh(bucketGeo.side, wood);
        right.position.set(0.215, 0.01, 0.16);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, 0.028), brass);
        lip.position.set(0, 0.11, 0.16);
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

      const ballGeo = new THREE.SphereGeometry(R, 28, 20);
      const ballMeshes = [];
      for (let i = 0; i < 12; i++) {
        const mesh = new THREE.Mesh(ballGeo, steel);
        mesh.castShadow = true;
        mesh.visible = false;
        scene.add(mesh);
        ballMeshes.push(mesh);
      }

      const hemi = new THREE.HemisphereLight(0xfff6ea, 0xc4a574, 0.72);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xfff3dd, 1.45);
      key.position.set(7.5, 12.5, 6.5);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -8;
      key.shadow.camera.right = 8;
      key.shadow.camera.top = 8;
      key.shadow.camera.bottom = -8;
      key.shadow.camera.far = 36;
      key.shadow.bias = -0.00035;
      scene.add(key);
      scene.add(new THREE.DirectionalLight(0xd5e4ff, 0.28)).position.set(-6, 5, -3);
      const glow = new THREE.PointLight(0xffe1b0, 0.55, 8);
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
        return balls.some((b) => b.mode === "track" && b.track === 0 && b.s < lim);
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
        ball.track = 0;
        ball.s = 0;
        ball.v = 0.3;
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
          if (crossed(prev[i], curr, scoopS)) tryPickup(i);
          if (crossed(prev[i], curr, releaseS) && holdBucket == null) tryRelease(i);
        }
      }

      function integrateBalls(dt) {
        const groups = tracks.map(() => []);
        for (const b of balls) if (b.mode === "track") groups[b.track].push(b);
        for (let ti = 0; ti < tracks.length; ti++) {
          const list = groups[ti].sort((a, b) => b.s - a.s);
          for (const b of list) {
            const dyds = sample(tracks[b.track], b.s).dyds;
            b.v += (-G * dyds - MU * b.v) * dt;
            if (b.v < 0) b.v = 0;
            if (b.v > 12) b.v = 12;
            b.s += b.v * dt;
            const tr = tracks[b.track];
            if (b.s >= tr.total) {
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
          if (b.mode !== "track" || b.v <= 0) continue;
          const tng = sample(tracks[b.track], b.s).tangent;
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

      function terminal(dyds) {
        if (dyds >= -1e-4) return 0.2;
        return Math.min(3.2, ((-G * dyds) / MU) * 0.72);
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
            v: terminal(sample(tracks[track], s).dyds),
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
        sprocketTop.rotation.z = sprocketPhi;
        sprocketBot.rotation.z = sprocketPhi;
        for (let i = 0; i < N_LINKS; i++) {
          const frame = chainFrame(i * pitch + chainTravel);
          const xAxis = norm(cross(frame.tangent, frame.outward));
          const wobble = i % 2 === 0 ? 0.012 : -0.012;
          const pos = add(frame.pos, scale(xAxis, wobble));
          orientObject(dummy, pos, frame.tangent, frame.outward);
          dummy.updateMatrix();
          links.setMatrixAt(i, dummy.matrix);
        }
        links.instanceMatrix.needsUpdate = true;
        for (const bucket of buckets) {
          const frame = chainFrame(bucketS(bucket.i));
          orientObject(bucket.group, frame.pos, frame.tangent, frame.outward);
        }
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i];
          const mesh = ballMeshes[i];
          let pos;
          if (b.mode === "carried") {
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
        let track = 0;
        let s = 0;
        let v = 0.3;
        let prevY = sample(tracks[0], 0).pos.y;
        for (let i = 0; i < 120 / DT; i++) {
          const smp = sample(tracks[track], s);
          if (smp.pos.y > prevY + 1e-3) return { ok: false, reason: "uphill", track, s };
          prevY = smp.pos.y;
          v += (-G * smp.dyds - MU * v) * DT;
          if (v < 0) v = 0;
          s += v * DT;
          if (s >= tracks[track].total) {
            if (tracks[track].next == null) return { ok: true, time: i * DT };
            track = tracks[track].next;
            s = 0;
          }
        }
        return { ok: false, reason: "timeout", track, s, v };
      }
      const solo = soloDescent();
      if (!solo.ok) throw new Error("单球无法滚到回收盘：" + solo.reason);

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

      window.__machine = {
        ready: true,
        canvas: renderer.domElement,
        R,
        RS,
        extra,
        slopes,
        gearMin12,
        gearMin23,
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
        getPhase: () => ({ phi1, phi2, phi3, chainTravel, pauseLeft, playing, speed, count }),
        audit(seconds) {
          audit = { overlaps: 0, nan: 0 };
          const n = Math.round(seconds / DT);
          const before = playing;
          playing = true;
          for (let i = 0; i < n; i++) {
            step(DT);
            if (i % 8 === 0) auditScan();
          }
          auditScan();
          const out = audit;
          audit = null;
          playing = before;
          syncVisuals();
          return out;
        },
      };
    }
}

