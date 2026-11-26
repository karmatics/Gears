class HypoidGearGenerator {
  static vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  static vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  static vecScale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  static vecDot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  static vecCross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
  static vecNorm(a) {
    const len = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / len, y: a.y / len, z: a.z / len };
  }

  static rotX(p, ang) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  }

  static rotZ(p, ang) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }

  static wrapPi(a) {
    let x = a;
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return x;
  }

  static generatePair(THREE, opts = {}) {
      const tStart = performance.now();
      const NP = Math.max(6, Math.round(opts.pinionTeeth || 11));
      const NG = Math.max(16, Math.round(opts.ringTeeth || 34));
      const E = Math.max(0.10, Math.min(0.55, opts.offset !== undefined ? opts.offset : 0.42));
      const shaftAngleDeg = Math.max(70, Math.min(110, opts.shaftAngleDeg !== undefined ? opts.shaftAngleDeg : 90));
      const sigma = (shaftAngleDeg * Math.PI) / 180;
      const alphaN = ((opts.pressureAngleDeg || 23) * Math.PI) / 180;
      const profileShift = opts.profileShift !== undefined ? opts.profileShift : 0.30;
      const backlashFrac = 0.004;

      const omegaG = 1.0;
      const omegaP = -(NG / NP) * omegaG;
      const Op = { x: 0, y: -E, z: 0 };

      const uG = { x: 1, y: 0, z: 0 };
      const uP = { x: Math.cos(sigma), y: 0, z: Math.sin(sigma) };
      const wP = { x: Math.sin(sigma), y: 0, z: -Math.cos(sigma) };
      const yAxis = { x: 0, y: 1, z: 0 };
      const omegaPVec = HypoidGearGenerator.vecScale(uP, omegaP);

      const worldToPinionLocal = (q) => ({
        x: HypoidGearGenerator.vecDot(q, wP),
        y: q.y,
        z: HypoidGearGenerator.vecDot(q, uP)
      });
      const pinionLocalToWorldVec = (loc) => ({
        x: loc.x * wP.x + loc.z * uP.x,
        y: loc.y,
        z: loc.x * wP.z + loc.z * uP.z
      });

      const rG0 = 1.365;
      const y0 = -0.83 * E;
      const zG0 = Math.sqrt(Math.max(0.25, rG0 * rG0 - y0 * y0));
      const rP0Target = rG0 * (NP / NG) * (1.0 + 0.21 * (E / 0.42));
      const dXZ = Math.sqrt(Math.max(0.06, rP0Target * rP0Target - (y0 + E) * (y0 + E)));
      const xP0World = (dXZ + zG0 * Math.cos(sigma)) / Math.sin(sigma);
      const P0 = { x: xP0World, y: y0, z: zG0 };

      const q0 = HypoidGearGenerator.vecSub(P0, Op);
      const q0Loc = worldToPinionLocal(q0);
      const rP0 = Math.hypot(q0Loc.x, q0Loc.y);
      const zP0 = q0Loc.z;
      const thetaP0 = Math.atan2(q0Loc.y, q0Loc.x);
      const thetaG0 = Math.atan2(P0.z, P0.y);

      const vG0 = { x: 0, y: -omegaG * P0.z, z: omegaG * P0.y };
      const vP0 = HypoidGearGenerator.vecCross(omegaPVec, q0);
      const Ns0 = HypoidGearGenerator.vecNorm(HypoidGearGenerator.vecCross(vG0, vP0));

      const Ns0Loc = worldToPinionLocal(Ns0);
      const rHatP0Loc = { x: Math.cos(thetaP0), y: Math.sin(thetaP0), z: 0 };
      const nrP0 = -(Ns0Loc.x * rHatP0Loc.x + Ns0Loc.y * rHatP0Loc.y);
      const nuP0 = -Ns0Loc.z;
      const tanGammaP = -nuP0 / nrP0;
      const gammaP = Math.atan(tanGammaP);
      const nPx_cone = nrP0;
      const nPz_cone = nuP0;
      const gPx_cone = -nPz_cone;
      const gPz_cone = nPx_cone;

      const rHatG0 = { x: 0, y: Math.cos(thetaG0), z: Math.sin(thetaG0) };
      const nGx = HypoidGearGenerator.vecDot(Ns0, uG);
      const nGr = HypoidGearGenerator.vecDot(Ns0, rHatG0);
      const cosGammaG = Math.abs(nGr);
      const gammaG = Math.atan2(-nGx, nGr);

      const minSafeZ = Math.max(0.16, zP0 - (rP0 / Math.max(0.12, Math.abs(tanGammaP))) * 0.72);
      const zToe = Math.max(minSafeZ + 0.14, zP0 - 0.18);
      const zHeel = zP0 + 0.28;
      const zMinExt = Math.max(minSafeZ, zToe - 0.34);
      const zMaxExt = zHeel + 0.34;

      const numSpiralSteps = 480;
      const dz = (zMaxExt - zMinExt) / numSpiralSteps;
      const zGrid = new Array(numSpiralSteps + 1);
      const thetaGrid = new Array(numSpiralSteps + 1);

      const spiralSlopeAtZ = (zVal) => {
        const rP = Math.max(0.06, rP0 + (zVal - zP0) * tanGammaP);
        const qLoc = { x: rP * Math.cos(thetaP0), y: rP * Math.sin(thetaP0), z: zVal };
        const p = HypoidGearGenerator.vecAdd(Op, pinionLocalToWorldVec(qLoc));
        const vG = { x: 0, y: -omegaG * p.z, z: omegaG * p.y };
        const vP = HypoidGearGenerator.vecCross(omegaPVec, HypoidGearGenerator.vecSub(p, Op));
        const vPG = HypoidGearGenerator.vecSub(vP, vG);
        const vPGLoc = worldToPinionLocal(vPG);
        const ePLoc = { x: -Math.sin(thetaP0), y: Math.cos(thetaP0), z: 0 };
        const vTheta = vPGLoc.x * ePLoc.x + vPGLoc.y * ePLoc.y;
        const vZ = Math.abs(vPGLoc.z) > 1e-4 ? vPGLoc.z : 1e-4;
        return vTheta / (rP * vZ);
      };

      for (let i = 0; i <= numSpiralSteps; i++) zGrid[i] = zMinExt + i * dz;
      const idxMid = Math.min(numSpiralSteps - 1, Math.max(1, Math.round((zP0 - zMinExt) / dz)));
      zGrid[idxMid] = zP0;
      thetaGrid[idxMid] = thetaP0;

      for (let i = idxMid + 1; i <= numSpiralSteps; i++) {
        const a = zGrid[i - 1], b = zGrid[i];
        const k1 = spiralSlopeAtZ(a), k2 = spiralSlopeAtZ(0.5 * (a + b)), k3 = spiralSlopeAtZ(b);
        thetaGrid[i] = thetaGrid[i - 1] + ((b - a) / 6) * (k1 + 4 * k2 + k3);
      }
      for (let i = idxMid - 1; i >= 0; i--) {
        const a = zGrid[i + 1], b = zGrid[i];
        const k1 = spiralSlopeAtZ(a), k2 = spiralSlopeAtZ(0.5 * (a + b)), k3 = spiralSlopeAtZ(b);
        thetaGrid[i] = thetaGrid[i + 1] + ((b - a) / 6) * (k1 + 4 * k2 + k3);
      }

      const evalPinionSpiral = (zVal) => {
        const clamped = Math.max(zMinExt, Math.min(zMaxExt, zVal));
        const f = (clamped - zMinExt) / dz;
        const idx = Math.min(numSpiralSteps - 1, Math.max(0, Math.floor(f)));
        const t = f - idx;
        const theta = thetaGrid[idx] * (1 - t) + thetaGrid[idx + 1] * t;
        const rP = Math.max(0.06, rP0 + (clamped - zP0) * tanGammaP);
        const dThetaDz = spiralSlopeAtZ(clamped);

        const qLoc = { x: rP * Math.cos(theta), y: rP * Math.sin(theta), z: clamped };
        const pos = HypoidGearGenerator.vecAdd(Op, pinionLocalToWorldVec(qLoc));
        const tLoc = HypoidGearGenerator.vecNorm({
          x: tanGammaP * Math.cos(theta) - rP * Math.sin(theta) * dThetaDz,
          y: tanGammaP * Math.sin(theta) + rP * Math.cos(theta) * dThetaDz,
          z: 1
        });
        const rHatLoc = { x: Math.cos(theta), y: Math.sin(theta), z: 0 };
        const gHatLoc = { x: Math.sin(gammaP) * rHatLoc.x, y: Math.sin(gammaP) * rHatLoc.y, z: Math.cos(gammaP) };
        const cosPsi = Math.min(0.999, Math.max(0.25, Math.abs(HypoidGearGenerator.vecDot(tLoc, gHatLoc))));
        const mn = (2 * rP * cosPsi) / NP;
        const sP = (rP - rP0) * gPx_cone + (clamped - zP0) * gPz_cone;
        return { pos, rP, theta, cosPsi, mn, sP };
      };

      const halfGearPitch = Math.PI / NG;
      const evalRingToothCenter = (zVal) => {
        const st = evalPinionSpiral(zVal);
        const phiP = thetaP0 - st.theta;
        const phiG = (omegaG / omegaP) * phiP;
        const q = HypoidGearGenerator.vecSub(st.pos, Op);
        const pMesh = HypoidGearGenerator.vecAdd(Op, HypoidGearGenerator.rotAxis(q, uP, phiP));
        const pos = HypoidGearGenerator.rotX(pMesh, -phiG + halfGearPitch);
        return { pos, mn: st.mn, phiG };
      };

      const evalRingFrame = (zVal) => {
        const eps = 1e-4;
        const c = evalRingToothCenter(zVal);
        const a = evalRingToothCenter(zVal - eps);
        const b = evalRingToothCenter(zVal + eps);
        const tVec = HypoidGearGenerator.vecNorm(HypoidGearGenerator.vecSub(b.pos, a.pos));
        const rG = Math.hypot(c.pos.y, c.pos.z);
        const rHatG = { x: 0, y: c.pos.y / rG, z: c.pos.z / rG };
        const nConeOut = { x: nGx, y: nGr * rHatG.y, z: nGr * rHatG.z };
        const mVec = HypoidGearGenerator.vecNorm(HypoidGearGenerator.vecCross(tVec, nConeOut));
        const gHat = HypoidGearGenerator.vecNorm({ x: nGr, y: -nGx * rHatG.y, z: -nGx * rHatG.z });
        const cosPsiG = Math.min(0.999, Math.max(0.25, Math.abs(HypoidGearGenerator.vecDot(tVec, gHat))));
        return { pos: c.pos, mn: c.mn, phiG: c.phiG, tVec, nConeOut, mVec, cosPsiG };
      };

      const haP = 1.05;
      const hdP = 0.50;
      const haG = 0.40;
      const hdG = 1.15;

      const evalRingFlankPoint = (zVal, hFrac, side) => {
        const st = evalRingFrame(zVal);
        const mn = st.mn;
        const NvG = NG / (cosGammaG * Math.pow(st.cosPsiG, 3));
        const Rv = 0.5 * NvG * mn;
        const Rb = Rv * Math.cos(alphaN);
        const invAlpha = Math.tan(alphaN) - alphaN;

        const sPitch = (0.5 * Math.PI - 2 * profileShift * Math.tan(alphaN) - backlashFrac) * mn;
        const betaHalf = sPitch / (2 * Rv) + invAlpha;

        const R = Math.max(Rb + 0.002 * mn, Rv + hFrac * mn);
        const t = Math.sqrt(Math.max(1e-8, (R / Rb) * (R / Rb) - 1));
        const phi = betaHalf - (t - Math.atan(t));

        const xNorm = side * R * Math.sin(phi);
        const yNorm = R * Math.cos(phi) - Rv;

        const pos = HypoidGearGenerator.vecAdd(
          st.pos,
          HypoidGearGenerator.vecAdd(
            HypoidGearGenerator.vecScale(st.mVec, xNorm),
            HypoidGearGenerator.vecScale(st.nConeOut, yNorm)
          )
        );
        return { pos, st };
      };

      const xG0 = P0.x;
      const gGx = nGr;
      const gGr = -nGx;
      const evalRingSG = (p) => (p.x - xG0) * gGx + (Math.hypot(p.y, p.z) - rG0) * gGr;

      const sToeCenter = evalRingSG(evalRingToothCenter(zToe).pos);
      const sHeelCenter = evalRingSG(evalRingToothCenter(zHeel).pos);

      let sGMinBound = -1e9;
      let sGMaxBound = 1e9;
      for (const side of [+1, -1]) {
        for (const hTest of [-hdG, 0, +haG]) {
          const sLo = evalRingSG(evalRingFlankPoint(zMinExt, hTest, side).pos);
          const sHi = evalRingSG(evalRingFlankPoint(zMaxExt, hTest, side).pos);
          sGMinBound = Math.max(sGMinBound, Math.min(sLo, sHi));
          sGMaxBound = Math.min(sGMaxBound, Math.max(sLo, sHi));
        }
      }

      const sToeG = Math.max(sToeCenter, sGMinBound + 0.006);
      const sHeelG = Math.min(sHeelCenter, sGMaxBound - 0.006);

      const nodes6 = BezierSurface.chebyshevLobattoNodes(6);
      const buildRingFlankSurface = (side, sStart, sEnd, hMin, hMax) => {
        const numBracket = 36;
        const zBrackets = Array.from({ length: numBracket + 1 }, (_, k) =>
          zMinExt + (k / numBracket) * (zMaxExt - zMinExt)
        );

        const solveZAtS = (hFrac, sTarget, sBrackets) => {
          const increasing = sBrackets[numBracket] >= sBrackets[0];
          let lo = zMinExt;
          let hi = zMaxExt;
          let found = false;

          for (let k = 0; k < numBracket; k++) {
            const a = sBrackets[k];
            const b = sBrackets[k + 1];
            if ((a <= sTarget && sTarget <= b) || (b <= sTarget && sTarget <= a)) {
              lo = zBrackets[k];
              hi = zBrackets[k + 1];
              found = true;
              break;
            }
          }

          if (!found) {
            const useStart = increasing ? sTarget <= sBrackets[0] : sTarget >= sBrackets[0];
            return evalRingFlankPoint(useStart ? zMinExt : zMaxExt, hFrac, side).pos;
          }

          let sLo = evalRingSG(evalRingFlankPoint(lo, hFrac, side).pos);
          for (let iter = 0; iter < 28; iter++) {
            const mid = 0.5 * (lo + hi);
            const sMid = evalRingSG(evalRingFlankPoint(mid, hFrac, side).pos);
            if ((sLo <= sTarget && sMid <= sTarget) || (sLo >= sTarget && sMid >= sTarget)) {
              lo = mid;
              sLo = sMid;
            } else {
              hi = mid;
            }
          }
          return evalRingFlankPoint(0.5 * (lo + hi), hFrac, side).pos;
        };

        const grid = Array.from({ length: 6 }, (_, a) => {
          const hFrac = hMin + nodes6[a] * (hMax - hMin);
          const sBrackets = zBrackets.map((zv) =>
            evalRingSG(evalRingFlankPoint(zv, hFrac, side).pos)
          );
          return Array.from({ length: 6 }, (_, b) => {
            const sTarget = sStart + nodes6[b] * (sEnd - sStart);
            return solveZAtS(hFrac, sTarget, sBrackets);
          });
        });
        return BezierSurface.fitFromGrid(grid, 5, 5, nodes6, nodes6);
      };

      const ringDriveSurf = buildRingFlankSurface(+1, sToeG, sHeelG, -hdG, +haG);
      const ringCoastSurf = buildRingFlankSurface(-1, sToeG, sHeelG, -hdG, +haG);

      const ringMidArc = (drivePt, coastPt) => {
        const my = 0.5 * (drivePt.y + coastPt.y);
        const mz = 0.5 * (drivePt.z + coastPt.z);
        const rM = Math.hypot(my, mz) || 1;
        const rTarget = 0.5 * (Math.hypot(drivePt.y, drivePt.z) + Math.hypot(coastPt.y, coastPt.z));
        return { x: 0.5 * (drivePt.x + coastPt.x), y: (my / rM) * rTarget, z: (mz / rM) * rTarget };
      };

      const ringPatches = HypoidGearGenerator._buildClosedToothPatches(
        ringDriveSurf,
        ringCoastSurf,
        nodes6,
        ringMidArc,
        16,
        20
      );
      const ringToothGeometry = BezierSurface.buildGeometryFromPatches(THREE, ringPatches);

      const hExtMin = -1.78;
      const hExtMax = 0.94;
      const solvePinionAnalytical = (u, v, side, ringToothShift) => {
        const hFrac = hExtMin + u * (hExtMax - hExtMin);
        const zVal = zMinExt + v * (zMaxExt - zMinExt);
        const epsH = 1e-4;
        const epsZ = 1e-4;

        const center = evalRingFlankPoint(zVal, hFrac, side);
        const pH1 = evalRingFlankPoint(zVal, hFrac - epsH, side).pos;
        const pH2 = evalRingFlankPoint(zVal, hFrac + epsH, side).pos;
        const pZ1 = evalRingFlankPoint(Math.max(zMinExt, zVal - epsZ), hFrac, side).pos;
        const pZ2 = evalRingFlankPoint(Math.min(zMaxExt, zVal + epsZ), hFrac, side).pos;

        const dH = HypoidGearGenerator.vecSub(pH2, pH1);
        const dZ = HypoidGearGenerator.vecSub(pZ2, pZ1);
        const nRaw = HypoidGearGenerator.vecNorm(HypoidGearGenerator.vecCross(dH, dZ));

        const expectedDir = HypoidGearGenerator.vecScale(center.st.mVec, side);
        const nSign = HypoidGearGenerator.vecDot(nRaw, expectedDir) >= 0 ? 1 : -1;
        let p = center.pos;
        let nG = HypoidGearGenerator.vecScale(nRaw, nSign);

        if (ringToothShift !== 0) {
          p = HypoidGearGenerator.rotX(p, ringToothShift);
          nG = HypoidGearGenerator.rotX(nG, ringToothShift);
        }

        const m = HypoidGearGenerator.vecCross(p, nG);
        const A = omegaPVec.z * m.z + omegaPVec.x * E * nG.z;
        const B = omegaPVec.z * m.y + omegaPVec.x * E * nG.y;
        const C = (omegaG - omegaPVec.x) * m.x + omegaPVec.z * E * nG.x;

        const R = Math.hypot(A, B);
        if (R < 1e-9) {
          return { valid: false, p: { x: 0, y: 0, z: 0 }, s: 0, h: 0, r: 0, z: 0, theta: 0 };
        }
        const rawRatio = C / R;
        if (!Number.isFinite(rawRatio) || Math.abs(rawRatio) > 0.997) {
          return { valid: false, p: { x: 0, y: 0, z: 0 }, s: 0, h: 0, r: 0, z: 0, theta: 0 };
        }

        const psi = Math.atan2(B, A);
        const d = Math.acos(rawRatio);

        const phiGEst = center.st.phiG;
        const r1 = psi + d;
        const r2 = psi - d;
        const err1 = Math.abs(HypoidGearGenerator.wrapPi(r1 - phiGEst));
        const err2 = Math.abs(HypoidGearGenerator.wrapPi(r2 - phiGEst));
        const phiG = phiGEst + HypoidGearGenerator.wrapPi((err1 <= err2 ? r1 : r2) - phiGEst);

        const pWorld = HypoidGearGenerator.rotX(p, phiG);
        const phiP = (omegaP / omegaG) * phiG;
        const qWorld = HypoidGearGenerator.vecSub(pWorld, Op);
        const qUnrot = HypoidGearGenerator.rotAxis(qWorld, uP, -phiP);
        const pPinion = worldToPinionLocal(qUnrot);

        const rP = Math.hypot(pPinion.x, pPinion.y);
        if (!Number.isFinite(rP) || rP < 0.04 || pPinion.z < 0.05) {
          return { valid: false, p: { x: 0, y: 0, z: 0 }, s: 0, h: 0, r: 0, z: 0, theta: 0 };
        }

        const sP = (rP - rP0) * gPx_cone + (pPinion.z - zP0) * gPz_cone;
        const hP = (rP - rP0) * nPx_cone + (pPinion.z - zP0) * nPz_cone;
        const thetaP = Math.atan2(pPinion.y, pPinion.x);

        return { valid: true, p: pPinion, s: sP, h: hP, r: rP, z: pPinion.z, theta: thetaP };
      };

      const samplePinionConjGrid = (side, ringToothShift) => {
        const nU = 72;
        const nV = 72;
        const raw = Array.from({ length: nU + 1 }, (_, i) =>
          Array.from({ length: nV + 1 }, (_, j) =>
            solvePinionAnalytical(i / nU, j / nV, side, ringToothShift)
          )
        );

        let seedI = -1;
        let seedJ = -1;
        let bestDist2 = 1e9;
        const ci = Math.floor(nU / 2);
        const cj = Math.floor(nV / 2);
        for (let i = 0; i <= nU; i++) {
          for (let j = 0; j <= nV; j++) {
            if (!raw[i][j].valid) continue;
            const d2 = (i - ci) * (i - ci) + (j - cj) * (j - cj);
            if (d2 < bestDist2) {
              bestDist2 = d2;
              seedI = i;
              seedJ = j;
            }
          }
        }

        if (seedI >= 0) {
          const visited = Array.from({ length: nU + 1 }, () => new Uint8Array(nV + 1));
          const queue = [[seedI, seedJ]];
          visited[seedI][seedJ] = 1;
          let head = 0;
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          while (head < queue.length) {
            const [i, j] = queue[head++];
            const baseTh = raw[i][j].theta;
            for (const [di, dj] of dirs) {
              const ni = i + di;
              const nj = j + dj;
              if (ni < 0 || ni > nU || nj < 0 || nj > nV || visited[ni][nj] || !raw[ni][nj].valid) continue;
              raw[ni][nj].theta = baseTh + HypoidGearGenerator.wrapPi(raw[ni][nj].theta - baseTh);
              visited[ni][nj] = 1;
              queue.push([ni, nj]);
            }
          }
        }
        return raw;
      };

      const pinionPlusConj = samplePinionConjGrid(-1, 0);
      const pinionMinusConj = samplePinionConjGrid(+1, -(2 * Math.PI) / NG);

      const buildConjLookup = (grid) => {
        const rows = grid.length - 1;
        const cols = grid[0].length - 1;
        let posVotes = 0;
        let negVotes = 0;
        for (let i = Math.floor(rows * 0.3); i <= Math.ceil(rows * 0.7); i++) {
          for (let j = Math.floor(cols * 0.3); j <= Math.ceil(cols * 0.7); j++) {
            const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1];
            if (!a.valid || !b.valid || !c.valid) continue;
            const det = (b.s - a.s) * (c.h - a.h) - (c.s - a.s) * (b.h - a.h);
            if (det > 1e-10) posVotes++;
            else if (det < -1e-10) negVotes++;
          }
        }
        const detSign = posVotes >= negVotes ? 1 : -1;

        const tris = [];
        let sMin = 1e9, sMax = -1e9, hMin = 1e9, hMax = -1e9;
        const tryPushTri = (p0, p1, p2) => {
          if (!p0.valid || !p1.valid || !p2.valid) return;
          if (Math.abs(p1.theta - p0.theta) > 0.85 || Math.abs(p2.theta - p0.theta) > 0.85) return;
          const v0s = p1.s - p0.s, v0h = p1.h - p0.h;
          const v1s = p2.s - p0.s, v1h = p2.h - p0.h;
          const det = v0s * v1h - v1s * v0h;
          if (det * detSign <= 1e-10) return;

          const tSMin = Math.min(p0.s, p1.s, p2.s);
          const tSMax = Math.max(p0.s, p1.s, p2.s);
          const tHMin = Math.min(p0.h, p1.h, p2.h);
          const tHMax = Math.max(p0.h, p1.h, p2.h);
          if (tSMin < sMin) sMin = tSMin;
          if (tSMax > sMax) sMax = tSMax;
          if (tHMin < hMin) hMin = tHMin;
          if (tHMax > hMax) hMax = tHMax;
          tris.push({ p0, p1, p2, v0s, v0h, v1s, v1h, det, tSMin, tSMax, tHMin, tHMax });
        };

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
            tryPushTri(a, b, c);
            tryPushTri(a, c, d);
          }
        }

        const binsX = 32;
        const binsY = 32;
        const spanS = Math.max(1e-6, sMax - sMin);
        const spanH = Math.max(1e-6, hMax - hMin);
        const bins = Array.from({ length: binsX * binsY }, () => []);
        for (let tIdx = 0; tIdx < tris.length; tIdx++) {
          const t = tris[tIdx];
          const bx0 = Math.max(0, Math.min(binsX - 1, Math.floor(((t.tSMin - sMin) / spanS) * binsX)));
          const bx1 = Math.max(0, Math.min(binsX - 1, Math.floor(((t.tSMax - sMin) / spanS) * binsX)));
          const by0 = Math.max(0, Math.min(binsY - 1, Math.floor(((t.tHMin - hMin) / spanH) * binsY)));
          const by1 = Math.max(0, Math.min(binsY - 1, Math.floor(((t.tHMax - hMin) / spanH) * binsY)));
          for (let bx = bx0; bx <= bx1; bx++) {
            for (let by = by0; by <= by1; by++) {
              bins[by * binsX + bx].push(tIdx);
            }
          }
        }
        return { tris, bins, binsX, binsY, sMin, sMax, hMin, hMax, spanS, spanH };
      };

      const lookupPlus = buildConjLookup(pinionPlusConj);
      const lookupMinus = buildConjLookup(pinionMinusConj);

      const evalLookup = (lookup, sTarget, hTarget) => {
        if (lookup.tris.length === 0) {
          return { point: { x: rP0 * Math.cos(thetaP0), y: rP0 * Math.sin(thetaP0), z: zP0 }, theta: thetaP0, minW: -1 };
        }
        let bestTri = null;
        let bestMinW = -1e9;
        let bestW = null;
        const testCandidate = (t) => {
          const v2s = sTarget - t.p0.s;
          const v2h = hTarget - t.p0.h;
          const w1 = (v2s * t.v1h - t.v1s * v2h) / t.det;
          const w2 = (t.v0s * v2h - v2s * t.v0h) / t.det;
          const w0 = 1 - w1 - w2;
          const minW = Math.min(w0, w1, w2);
          if (minW > bestMinW) {
            bestMinW = minW;
            bestTri = t;
            bestW = [w0, w1, w2];
          }
        };

        const bx = Math.max(0, Math.min(lookup.binsX - 1, Math.floor(((sTarget - lookup.sMin) / lookup.spanS) * lookup.binsX)));
        const by = Math.max(0, Math.min(lookup.binsY - 1, Math.floor(((hTarget - lookup.hMin) / lookup.spanH) * lookup.binsY)));
        const binList = lookup.bins[by * lookup.binsX + bx];
        for (let k = 0; k < binList.length; k++) testCandidate(lookup.tris[binList[k]]);

        if (!bestTri || bestMinW < -0.02) {
          for (let k = 0; k < lookup.tris.length; k++) testCandidate(lookup.tris[k]);
        }

        const { p0, p1, p2 } = bestTri;
        let [w0, w1, w2] = bestW;
        if (bestMinW < 0) {
          w0 = Math.max(0, w0);
          w1 = Math.max(0, w1);
          w2 = Math.max(0, w2);
          const sum = w0 + w1 + w2 || 1;
          w0 /= sum;
          w1 /= sum;
          w2 /= sum;
        }
        const r = w0 * p0.r + w1 * p1.r + w2 * p2.r;
        const z = w0 * p0.z + w1 * p1.z + w2 * p2.z;
        const th = w0 * p0.theta + w1 * p1.theta + w2 * p2.theta;
        return { point: { x: r * Math.cos(th), y: r * Math.sin(th), z }, theta: th, minW: bestMinW };
      };

      const mnSamples = [];
      for (let i = 0; i <= 48; i++) {
        const zVal = zMinExt + (i / 48) * (zMaxExt - zMinExt);
        const st = evalPinionSpiral(zVal);
        mnSamples.push({ s: st.sP, mn: st.mn });
      }
      const evalMnAtSP = (sTarget) => {
        if (sTarget <= mnSamples[0].s) return mnSamples[0].mn;
        const last = mnSamples.length - 1;
        if (sTarget >= mnSamples[last].s) return mnSamples[last].mn;
        for (let i = 0; i < last; i++) {
          const a = mnSamples[i], b = mnSamples[i + 1];
          if (sTarget >= a.s && sTarget <= b.s) {
            const t = (sTarget - a.s) / Math.max(1e-9, b.s - a.s);
            return a.mn * (1 - t) + b.mn * t;
          }
        }
        return mnSamples[Math.floor(last / 2)].mn;
      };

      const sMidP = evalPinionSpiral(zP0).sP;
      const sToeNom = evalPinionSpiral(zToe).sP;
      const sHeelNom = evalPinionSpiral(zHeel).sP;
      const midPlusPitch = evalLookup(lookupPlus, sMidP, 0);
      const midMinusPitch = evalLookup(lookupMinus, sMidP, 0);
      const thicknessSign = midMinusPitch.theta >= midPlusPitch.theta ? 1 : -1;

      const isSValidOnBoth = (sVal) => {
        const mnLocal = evalMnAtSP(sVal);
        for (const u of [0, 0.25, 0.5, 0.75, 1.0]) {
          const hT = (-hdP + u * (haP + hdP)) * mnLocal;
          const rP = evalLookup(lookupPlus, sVal, hT);
          const rM = evalLookup(lookupMinus, sVal, hT);
          if (rP.minW < -2e-4 || rM.minW < -2e-4) return false;
          if (u === 1.0 && (rM.theta - rP.theta) * thicknessSign < 0.015) return false;
        }
        return true;
      };

      const findValidLimit = (sStart, sTarget) => {
        if (isSValidOnBoth(sTarget)) return sTarget;
        let lastOk = sStart;
        let firstFail = sTarget;
        let hitFail = false;
        for (let k = 1; k <= 40; k++) {
          const sTry = sStart + (k / 40) * (sTarget - sStart);
          if (isSValidOnBoth(sTry)) lastOk = sTry;
          else {
            firstFail = sTry;
            hitFail = true;
            break;
          }
        }
        if (!hitFail) return lastOk;
        let lo = lastOk;
        let hi = firstFail;
        for (let iter = 0; iter < 10; iter++) {
          const mid = 0.5 * (lo + hi);
          if (isSValidOnBoth(mid)) lo = mid;
          else hi = mid;
        }
        return lo - Math.sign(sTarget - sStart) * 0.006;
      };

      let sToeP = findValidLimit(sMidP, sToeNom);
      let sHeelP = findValidLimit(sMidP, sHeelNom);
      if (sHeelP - sToeP < 0.12) {
        const mid = 0.5 * (sToeP + sHeelP);
        sToeP = mid - 0.06;
        sHeelP = mid + 0.06;
      }

      const sampleCount = 17;
      const uNodes = BezierSurface.chebyshevLobattoNodes(sampleCount);
      const vNodes = BezierSurface.chebyshevLobattoNodes(sampleCount);
      let clampedQueries = 0;
      const totalQueries = sampleCount * sampleCount * 2;

      const buildPinionConjSurface = (lookup) => {
        const sampleGrid = uNodes.map((u) =>
          vNodes.map((v) => {
            const sTarget = sToeP + v * (sHeelP - sToeP);
            const mnLocal = evalMnAtSP(sTarget);
            const hTarget = (-hdP + u * (haP + hdP)) * mnLocal;
            const res = evalLookup(lookup, sTarget, hTarget);
            if (res.minW < -1e-3) clampedQueries++;
            return res.point;
          })
        );
        return HypoidGearGenerator.fitBezierLeastSquares(sampleGrid, uNodes, vNodes, 5, 4);
      };

      const pinionDriveSurf = buildPinionConjSurface(lookupPlus);
      const pinionCoastSurf = buildPinionConjSurface(lookupMinus);

      const pinionMidArc = (drivePt, coastPt) => {
        const mx = 0.5 * (drivePt.x + coastPt.x);
        const my = 0.5 * (drivePt.y + coastPt.y);
        const rM = Math.hypot(mx, my) || 1;
        const rTarget = 0.5 * (Math.hypot(drivePt.x, drivePt.y) + Math.hypot(coastPt.x, coastPt.y));
        return { x: (mx / rM) * rTarget, y: (my / rM) * rTarget, z: 0.5 * (drivePt.z + coastPt.z) };
      };

      const nodes5 = BezierSurface.chebyshevLobattoNodes(5);
      const pinionPatches = HypoidGearGenerator._buildClosedToothPatches(
        pinionDriveSurf,
        pinionCoastSurf,
        nodes5,
        pinionMidArc,
        16,
        20
      );
      const pinionToothGeometry = BezierSurface.buildGeometryFromPatches(THREE, pinionPatches);

      const ringIsoGeometry = BezierSurface.buildIsoWireframeGeometry(THREE, ringPatches, 2, 2);
      const pinionIsoGeometry = BezierSurface.buildIsoWireframeGeometry(THREE, pinionPatches, 2, 2);
      const ringDiagGeometry = BezierSurface.buildDiagnosticGeometry(THREE, ringPatches);
      const pinionDiagGeometry = BezierSurface.buildDiagnosticGeometry(THREE, pinionPatches);
      const ringNormalNeedles = BezierSurface.buildNormalNeedlesGeometry(THREE, ringPatches, 0.032);
      const pinionNormalNeedles = BezierSurface.buildNormalNeedlesGeometry(THREE, pinionPatches, 0.028);

      const lathes = HypoidGearGenerator.buildMechanicalLathes(
        THREE,
        ringDriveSurf,
        ringCoastSurf,
        pinionDriveSurf,
        pinionCoastSurf
      );

      const midSpiral = evalPinionSpiral(zP0);
      const midRingFrame = evalRingFrame(zP0);
      const buildMs = performance.now() - tStart;

      return {
        pinionToothGeometry,
        ringToothGeometry,
        ringIsoGeometry,
        pinionIsoGeometry,
        ringDiagGeometry,
        pinionDiagGeometry,
        ringNormalNeedles,
        pinionNormalNeedles,
        pinionBodyGeometry: lathes.pinionBodyGeometry,
        ringBodyGeometry: lathes.ringBodyGeometry,
        ringBodyWireGeometry: lathes.ringBodyWireGeometry,
        pinionBodyWireGeometry: lathes.pinionBodyWireGeometry,
        mechanics: lathes.mechanics,
        pinionTeeth: NP,
        ringTeeth: NG,
        offset: E,
        shaftAngleDeg,
        pinionAxisOffset: Op,
        pinionBasis: { wP, yAxis, uP },
        meshFocus: P0,
        diagnostics: {
          gammaPDeg: (gammaP * 180) / Math.PI,
          gammaGDeg: (gammaG * 180) / Math.PI,
          psiPDeg: (Math.acos(midSpiral.cosPsi) * 180) / Math.PI,
          psiGDeg: (Math.acos(midRingFrame.cosPsiG) * 180) / Math.PI,
          sToeP,
          sHeelP,
          sToeG,
          sHeelG,
          rG0,
          xG0,
          gGx,
          gGr,
          rP0,
          zP0,
          tanGammaP,
          zToe,
          zHeel,
          validPct: 100 * (1 - clampedQueries / Math.max(1, totalQueries)),
          buildMs
        }
      };
    }

  static _buildClosedToothPatches(driveSurf, coastSurf, nodesV, midArcFn, segU = 14, segV = 18) {
      const nodes3 = [0, 0.5, 1];
      const degU = driveSurf.degU;
      const nodesU = BezierSurface.chebyshevLobattoNodes(degU + 1);

      const makeCapUV = (uVal) => {
        const grid = [0, 1, 2].map((a) =>
          nodesV.map((v) => {
            const dPt = driveSurf.evaluate(uVal, v);
            const cPt = coastSurf.evaluate(uVal, v);
            if (a === 0) return dPt;
            if (a === 2) return cPt;
            return midArcFn(dPt, cPt, v);
          })
        );
        return BezierSurface.fitFromGrid(grid, 2, nodesV.length - 1, nodes3, nodesV);
      };

      const makeEndCap = (vVal) => {
        const grid = nodesU.map((u) => {
          const dPt = driveSurf.evaluate(u, vVal);
          const cPt = coastSurf.evaluate(u, vVal);
          return [dPt, midArcFn(dPt, cPt, vVal), cPt];
        });
        return BezierSurface.fitFromGrid(grid, degU, 2, nodesU, nodes3);
      };

      const topLand = makeCapUV(1);
      const rootBase = makeCapUV(0);
      const toeCap = makeEndCap(0);
      const heelCap = makeEndCap(1);

      const dMid = driveSurf.evaluate(0.5, 0.5);
      const cMid = coastSurf.evaluate(0.5, 0.5);
      const centroid = {
        x: 0.5 * (dMid.x + cMid.x),
        y: 0.5 * (dMid.y + cMid.y),
        z: 0.5 * (dMid.z + cMid.z)
      };

      const orientOutward = (surface, sU, sV) => {
        const ev = surface.evaluateWithPartials(0.5, 0.5);
        const outVec = HypoidGearGenerator.vecSub(ev.point, centroid);
        const flipWinding = HypoidGearGenerator.vecDot(outVec, ev.normal) < 0;
        return { surface, segU: sU, segV: sV, flipWinding };
      };

      return [
        orientOutward(driveSurf, segU, segV),
        orientOutward(coastSurf, segU, segV),
        orientOutward(topLand, 4, segV),
        orientOutward(rootBase, 4, segV),
        orientOutward(toeCap, segU, 4),
        orientOutward(heelCap, segU, 4)
      ];
    }
  static fitBezierLeastSquares(sampleGrid, uSamples, vSamples, degU, degV) {
      const nU = uSamples.length;
      const nV = vSamples.length;
      const colsU = degU + 1;
      const colsV = degV + 1;

      const buildPinV = (samples, deg, numCols) => {
        const n = samples.length;
        const M = Array.from({ length: n }, (_, a) =>
          Array.from({ length: numCols }, (_, i) => BezierSurface.bernstein(deg, i, samples[a]))
        );
        const MtM = Array.from({ length: numCols }, (_, r) =>
          Array.from({ length: numCols }, (_, c) => {
            let sum = 0;
            for (let a = 0; a < n; a++) sum += M[a][r] * M[a][c];
            return sum;
          })
        );
        const invMtM = BezierSurface.invertSquareMatrix(MtM);
        return Array.from({ length: numCols }, (_, i) =>
          Array.from({ length: n }, (_, a) => {
            let sum = 0;
            for (let k = 0; k < numCols; k++) sum += invMtM[i][k] * M[a][k];
            return sum;
          })
        );
      };

      const pinvU = buildPinV(uSamples, degU, colsU);
      const pinvV = buildPinV(vSamples, degV, colsV);

      const temp = Array.from({ length: colsU }, (_, i) =>
        Array.from({ length: nV }, (_, b) => {
          let x = 0, y = 0, z = 0;
          for (let a = 0; a < nU; a++) {
            const w = pinvU[i][a];
            const p = sampleGrid[a][b];
            x += w * p.x;
            y += w * p.y;
            z += w * p.z;
          }
          return { x, y, z };
        })
      );

      const ctrl = Array.from({ length: colsU }, (_, i) =>
        Array.from({ length: colsV }, (_, j) => {
          let x = 0, y = 0, z = 0;
          for (let b = 0; b < nV; b++) {
            const w = pinvV[j][b];
            const p = temp[i][b];
            x += w * p.x;
            y += w * p.y;
            z += w * p.z;
          }
          return { x, y, z };
        })
      );

      return new BezierSurface(ctrl);
    }

  static rotAxis(p, axis, ang) {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const dot = axis.x * p.x + axis.y * p.y + axis.z * p.z;
      const cx = axis.y * p.z - axis.z * p.y;
      const cy = axis.z * p.x - axis.x * p.z;
      const cz = axis.x * p.y - axis.y * p.x;
      const k = dot * (1 - c);
      return {
        x: p.x * c + cx * s + axis.x * k,
        y: p.y * c + cy * s + axis.y * k,
        z: p.z * c + cz * s + axis.z * k
      };
    }

  static buildMechanicalLathes(THREE, ringDriveSurf, ringCoastSurf, pinionDriveSurf, pinionCoastSurf) {
      const rToeD = ringDriveSurf.evaluate(0, 0);
      const rToeC = ringCoastSurf.evaluate(0, 0);
      const rHeelD = ringDriveSurf.evaluate(0, 1);
      const rHeelC = ringCoastSurf.evaluate(0, 1);
      const rHeelTipD = ringDriveSurf.evaluate(1, 1);
      const rHeelTipC = ringCoastSurf.evaluate(1, 1);

      const ringToeR = Math.min(Math.hypot(rToeD.y, rToeD.z), Math.hypot(rToeC.y, rToeC.z)) - 0.0015;
      const ringHeelR = Math.min(Math.hypot(rHeelD.y, rHeelD.z), Math.hypot(rHeelC.y, rHeelC.z)) - 0.0015;
      const ringHeelTipR = Math.max(Math.hypot(rHeelTipD.y, rHeelTipD.z), Math.hypot(rHeelTipC.y, rHeelTipC.z));
      const ringToeX = Math.max(rToeD.x, rToeC.x) + 0.0015;
      const ringHeelX = Math.max(rHeelD.x, rHeelC.x) + 0.0015;
      const ringBoreR = Math.max(0.45, ringToeR * 0.72);
      const ringOuterR = Math.max(ringHeelR + 0.036, ringHeelTipR + 0.008);
      const ringBackX = Math.max(ringToeX, ringHeelX) + 0.21;

      const ringCorners = [
        { r: ringBoreR, y: ringToeX + 0.036, fillet: 0.012, segs: 5 },
        { r: ringBoreR + 0.024, y: ringToeX + 0.016, fillet: 0.010, segs: 5 },
        { r: ringToeR - 0.012, y: ringToeX + 0.014, fillet: 0.007, segs: 4 },
        { r: ringToeR, y: ringToeX, fillet: 0.004, segs: 4 },
        { r: ringHeelR, y: ringHeelX, fillet: 0.004, segs: 4 },
        { r: ringOuterR, y: ringHeelX + 0.025, fillet: 0.012, segs: 5 },
        { r: ringOuterR, y: ringBackX, fillet: 0.026, segs: 7 },
        { r: ringBoreR, y: ringBackX, fillet: 0.016, segs: 6 }
      ];
      const ringBodyGeometry = HypoidGearGenerator.createFilletedLathe(THREE, ringCorners, 96);
      ringBodyGeometry.rotateZ(-Math.PI / 2);
      const ringBodyWireGeometry = HypoidGearGenerator.buildLatheWireframe(THREE, ringCorners, 24, 64);
      ringBodyWireGeometry.rotateZ(-Math.PI / 2);

      const pToeD = pinionDriveSurf.evaluate(0, 0);
      const pToeC = pinionCoastSurf.evaluate(0, 0);
      const pHeelD = pinionDriveSurf.evaluate(0, 1);
      const pHeelC = pinionCoastSurf.evaluate(0, 1);
      const pToeR = Math.max(0.08, Math.min(Math.hypot(pToeD.x, pToeD.y), Math.hypot(pToeC.x, pToeC.y)) - 0.0015);
      const pHeelR = Math.max(0.12, Math.min(Math.hypot(pHeelD.x, pHeelD.y), Math.hypot(pHeelC.x, pHeelC.y)) - 0.0015);
      const pToeZ = Math.min(pToeD.z, pToeC.z) - 0.001;
      const pHeelZ = Math.max(pHeelD.z, pHeelC.z) + 0.0015;
      const pShaftR = Math.min(0.21, pToeR * 0.58);
      const pJournalR = pShaftR * 1.18;
      const pSplineR = pShaftR * 0.88;
      const pThreadR = pShaftR * 0.62;

      const pinionCorners = [
        { r: 0.0005, y: pToeZ - 0.036, fillet: 0 },
        { r: pToeR * 0.72, y: pToeZ - 0.036, fillet: 0.010, segs: 5 },
        { r: pToeR * 0.94, y: pToeZ - 0.014, fillet: 0.007, segs: 4 },
        { r: pToeR, y: pToeZ, fillet: 0.004, segs: 4 },
        { r: pHeelR, y: pHeelZ, fillet: 0.004, segs: 4 },
        { r: pHeelR + 0.014, y: pHeelZ + 0.018, fillet: 0.008, segs: 5 },
        { r: pHeelR + 0.014, y: pHeelZ + 0.058, fillet: 0.014, segs: 6 },
        { r: pJournalR + 0.05, y: pHeelZ + 0.075, fillet: 0.008, segs: 5 },
        { r: pJournalR + 0.05, y: pHeelZ + 0.115, fillet: 0.006, segs: 4 },
        { r: pJournalR, y: pHeelZ + 0.12, fillet: 0.012, segs: 5 },
        { r: pJournalR, y: pHeelZ + 0.36, fillet: 0.010, segs: 5 },
        { r: pSplineR, y: pHeelZ + 0.45, fillet: 0.014, segs: 5 },
        { r: pSplineR, y: pHeelZ + 0.96, fillet: 0.006, segs: 4 },
        { r: pThreadR, y: pHeelZ + 0.97, fillet: 0.006, segs: 4 },
        { r: pThreadR, y: pHeelZ + 1.12, fillet: 0.008, segs: 4 },
        { r: pThreadR * 0.80, y: pHeelZ + 1.14, fillet: 0 },
        { r: 0.0005, y: pHeelZ + 1.14, fillet: 0 }
      ];
      const pinionBodyGeometry = HypoidGearGenerator.createFilletedLathe(THREE, pinionCorners, 72);
      pinionBodyGeometry.rotateX(Math.PI / 2);
      const pinionBodyWireGeometry = HypoidGearGenerator.buildLatheWireframe(THREE, pinionCorners, 20, 48);
      pinionBodyWireGeometry.rotateX(Math.PI / 2);

      return {
        ringBodyGeometry,
        pinionBodyGeometry,
        ringBodyWireGeometry,
        pinionBodyWireGeometry,
        mechanics: {
          ringToeR,
          ringHeelR,
          ringToeX,
          ringHeelX,
          ringBoreR,
          ringOuterR,
          ringBackX,
          pToeR,
          pHeelR,
          pToeZ,
          pHeelZ,
          pShaftR,
          pJournalR,
          pSplineR,
          pThreadR
        }
      };
    }
  static _buildFilletStrips(rawCorners) {
      const corners = rawCorners.slice();
      if (corners.length > 2) {
        const first = corners[0];
        const last = corners[corners.length - 1];
        if (Math.hypot(first.r - last.r, first.y - last.y) < 1e-6) corners.pop();
      }
      const n = corners.length;
      if (n < 3) return [];

      const cornerData = new Array(n);
      for (let i = 0; i < n; i++) {
        const prev = corners[(i - 1 + n) % n];
        const curr = corners[i];
        const next = corners[(i + 1) % n];

        const inR = curr.r - prev.r;
        const inY = curr.y - prev.y;
        const lenIn = Math.hypot(inR, inY) || 1e-9;
        const outR = next.r - curr.r;
        const outY = next.y - curr.y;
        const lenOut = Math.hypot(outR, outY) || 1e-9;

        const eIn = { r: inR / lenIn, y: inY / lenIn };
        const eOut = { r: outR / lenOut, y: outY / lenOut };
        const u1 = { r: -eIn.r, y: -eIn.y };
        const u2 = { r: eOut.r, y: eOut.y };
        const dot = Math.max(-1, Math.min(1, u1.r * u2.r + u1.y * u2.y));
        const theta = Math.acos(dot);

        const wantedFillet = curr.fillet || 0;
        if (wantedFillet > 1e-5 && curr.r > 0.008 && theta > 0.08 && theta < Math.PI - 0.08) {
          const maxD = 0.42 * Math.min(lenIn, lenOut);
          const halfTan = Math.tan(theta * 0.5);
          const d = Math.min(maxD, wantedFillet / halfTan);
          const R = d * halfTan;
          if (R > 1e-5) {
            const T1 = { r: curr.r + u1.r * d, y: curr.y + u1.y * d };
            const T2 = { r: curr.r + u2.r * d, y: curr.y + u2.y * d };
            const bisR = u1.r + u2.r;
            const bisY = u1.y + u2.y;
            const bisLen = Math.hypot(bisR, bisY) || 1;
            const distO = R / Math.sin(theta * 0.5);
            const O = { r: curr.r + (bisR / bisLen) * distO, y: curr.y + (bisY / bisLen) * distO };

            const turnCross = eIn.r * eOut.y - eIn.y * eOut.r;
            const normalSign = turnCross >= 0 ? 1 : -1;
            const a0 = Math.atan2(T1.y - O.y, T1.r - O.r);
            const a1 = Math.atan2(T2.y - O.y, T2.r - O.r);
            const da = HypoidGearGenerator.wrapPi(a1 - a0);
            const segs = curr.segs || 6;

            const arcPts = [];
            for (let s = 0; s <= segs; s++) {
              const ang = a0 + (s / segs) * da;
              arcPts.push({
                r: Math.max(0.0002, O.r + R * Math.cos(ang)),
                y: O.y + R * Math.sin(ang),
                nr: normalSign * Math.cos(ang),
                ny: normalSign * Math.sin(ang)
              });
            }
            cornerData[i] = { start: T1, end: T2, arcPts };
            continue;
          }
        }

        const pt = { r: Math.max(0.0002, curr.r), y: curr.y };
        cornerData[i] = { start: pt, end: pt, arcPts: null };
      }

      const strips = [];
      for (let i = 0; i < n; i++) {
        const p0 = cornerData[i].end;
        const nextCorner = cornerData[(i + 1) % n];
        const p1 = nextCorner.start;
        const dr = p1.r - p0.r;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dr, dy);
        if (len > 1e-6) {
          const nr = dy / len;
          const ny = -dr / len;
          strips.push([
            { r: Math.max(0.0002, p0.r), y: p0.y, nr, ny },
            { r: Math.max(0.0002, p1.r), y: p1.y, nr, ny }
          ]);
        }
        if (nextCorner.arcPts) strips.push(nextCorner.arcPts);
      }
      return strips;
    }

  static createFilletedLathe(THREE, rawCorners, radialSegments = 96) {
      const strips = HypoidGearGenerator._buildFilletStrips(rawCorners);
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      let totalLen = 0;
      const stripArc = [];
      for (const st of strips) {
        const acc = [0];
        for (let j = 1; j < st.length; j++) {
          totalLen += Math.hypot(st[j].r - st[j - 1].r, st[j].y - st[j - 1].y);
          acc.push(totalLen);
        }
        stripArc.push(acc);
      }
      const invTotalLen = totalLen > 1e-6 ? 1 / totalLen : 1;

      let baseVertex = 0;
      for (let sIdx = 0; sIdx < strips.length; sIdx++) {
        const st = strips[sIdx];
        const acc = stripArc[sIdx];
        const m = st.length;

        for (let i = 0; i <= radialSegments; i++) {
          const u = i / radialSegments;
          const phi = u * Math.PI * 2;
          const sinP = Math.sin(phi);
          const cosP = Math.cos(phi);
          for (let j = 0; j < m; j++) {
            const p = st[j];
            positions.push(p.r * sinP, p.y, p.r * cosP);
            normals.push(p.nr * sinP, p.ny, p.nr * cosP);
            uvs.push(u * 4, acc[j] * invTotalLen * 4);
          }
        }

        for (let i = 0; i < radialSegments; i++) {
          for (let j = 0; j < m - 1; j++) {
            const a = baseVertex + i * m + j;
            const b = baseVertex + (i + 1) * m + j;
            const c = baseVertex + (i + 1) * m + (j + 1);
            const d = baseVertex + i * m + (j + 1);
            indices.push(a, b, d);
            indices.push(b, c, d);
          }
        }
        baseVertex += (radialSegments + 1) * m;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      return geom;
    }

  static buildLatheWireframe(THREE, rawCorners, meridianCount = 24, ringRadialSegs = 64) {
      const strips = HypoidGearGenerator._buildFilletStrips(rawCorners);
      const positions = [];
      const offset = 0.0007;

      for (const st of strips) {
        for (let k = 0; k < meridianCount; k++) {
          const phi = (k / meridianCount) * Math.PI * 2;
          const sinP = Math.sin(phi);
          const cosP = Math.cos(phi);
          for (let j = 0; j < st.length - 1; j++) {
            const p0 = st[j];
            const p1 = st[j + 1];
            const r0 = p0.r + p0.nr * offset;
            const y0 = p0.y + p0.ny * offset;
            const r1 = p1.r + p1.nr * offset;
            const y1 = p1.y + p1.ny * offset;
            positions.push(r0 * sinP, y0, r0 * cosP, r1 * sinP, y1, r1 * cosP);
          }
        }

        const ringIndices = st.length > 2 ? [0, Math.floor(st.length / 2), st.length - 1] : [0];
        for (const j of ringIndices) {
          const p = st[j];
          const r = p.r + p.nr * offset;
          const y = p.y + p.ny * offset;
          if (r < 0.01) continue;
          for (let i = 0; i < ringRadialSegs; i++) {
            const a0 = (i / ringRadialSegs) * Math.PI * 2;
            const a1 = ((i + 1) / ringRadialSegs) * Math.PI * 2;
            positions.push(
              r * Math.sin(a0), y, r * Math.cos(a0),
              r * Math.sin(a1), y, r * Math.cos(a1)
            );
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return geom;
    }
}

globalThis.HypoidGearGenerator = HypoidGearGenerator;
if (typeof module !== 'undefined' && module.exports) module.exports = HypoidGearGenerator;