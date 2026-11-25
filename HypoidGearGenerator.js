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

      const minSafeZ = Math.max(0.30, zP0 - (rP0 / Math.max(0.15, Math.abs(tanGammaP))) * 0.60);
      const zToe = Math.max(minSafeZ + 0.12, zP0 - 0.18);
      const zHeel = zP0 + 0.28;
      const zMinExt = Math.max(minSafeZ, zToe - 0.14);
      const zMaxExt = zHeel + 0.14;

      const numSpiralSteps = 400;
      const dz = (zMaxExt - zMinExt) / numSpiralSteps;
      const zGrid = new Array(numSpiralSteps + 1);
      const thetaGrid = new Array(numSpiralSteps + 1);

      const spiralSlopeAtZ = (zVal) => {
        const rP = Math.max(0.08, rP0 + (zVal - zP0) * tanGammaP);
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
        const rP = Math.max(0.08, rP0 + (clamped - zP0) * tanGammaP);
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

      const nodes6 = BezierSurface.chebyshevLobattoNodes(6);
      const buildRingFlankSurface = (side, zStart, zEnd, hMin, hMax) => {
        const grid = Array.from({ length: 6 }, (_, a) => {
          const hFrac = hMin + nodes6[a] * (hMax - hMin);
          return Array.from({ length: 6 }, (_, b) => {
            const zVal = zStart + nodes6[b] * (zEnd - zStart);
            return evalRingFlankPoint(zVal, hFrac, side).pos;
          });
        });
        return BezierSurface.fitFromGrid(grid, 5, 5, nodes6, nodes6);
      };

      const ringDriveSurf = buildRingFlankSurface(+1, zToe, zHeel, -hdG, +haG);
      const ringCoastSurf = buildRingFlankSurface(-1, zToe, zHeel, -hdG, +haG);

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
        ringMidArc
      );
      const ringToothGeometry = BezierSurface.buildGeometryFromPatches(THREE, ringPatches);

      const hExtMin = -1.32;
      const hExtMax = 0.66;
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

        const R = Math.hypot(A, B) || 1e-12;
        const psi = Math.atan2(B, A);
        const ratio = Math.max(-1, Math.min(1, C / R));
        const d = Math.acos(ratio);

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
        const sP = (rP - rP0) * gPx_cone + (pPinion.z - zP0) * gPz_cone;
        const hP = (rP - rP0) * nPx_cone + (pPinion.z - zP0) * nPz_cone;
        const thetaP = Math.atan2(pPinion.y, pPinion.x);

        return { p: pPinion, s: sP, h: hP, r: rP, z: pPinion.z, theta: thetaP };
      };

      const samplePinionConjGrid = (side, ringToothShift) => {
        const nU = 64;
        const nV = 64;
        const raw = Array.from({ length: nU + 1 }, (_, i) =>
          Array.from({ length: nV + 1 }, (_, j) =>
            solvePinionAnalytical(i / nU, j / nV, side, ringToothShift)
          )
        );
        const refTheta = raw[Math.floor(nU / 2)][Math.floor(nV / 2)].theta;
        for (let i = 0; i <= nU; i++) {
          for (let j = 0; j <= nV; j++) {
            const prev = j > 0 ? raw[i][j - 1].theta : (i > 0 ? raw[i - 1][0].theta : refTheta);
            raw[i][j].theta = prev + HypoidGearGenerator.wrapPi(raw[i][j].theta - prev);
          }
        }
        return raw;
      };

      const pinionPlusConj = samplePinionConjGrid(-1, 0);
      const pinionMinusConj = samplePinionConjGrid(+1, -(2 * Math.PI) / NG);

      const mnSamples = [];
      for (let i = 0; i <= 40; i++) {
        const zVal = zMinExt + (i / 40) * (zMaxExt - zMinExt);
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

      const getConjSRange = (grid) => {
        let sMin = -1e9;
        let sMax = 1e9;
        for (let i = 0; i < grid.length; i++) {
          const row = grid[i];
          sMin = Math.max(sMin, Math.min(row[0].s, row[row.length - 1].s));
          sMax = Math.min(sMax, Math.max(row[0].s, row[row.length - 1].s));
        }
        return [sMin, sMax];
      };
      const [pMin1, pMax1] = getConjSRange(pinionPlusConj);
      const [pMin2, pMax2] = getConjSRange(pinionMinusConj);
      const sToeP = Math.max(evalPinionSpiral(zToe).sP, pMin1 + 0.02, pMin2 + 0.02);
      const sHeelP = Math.min(evalPinionSpiral(zHeel).sP, pMax1 - 0.02, pMax2 - 0.02);

      const evalPinionFromTriGrid = (grid, sTarget, hTarget) => {
        const rows = grid.length - 1;
        const cols = grid[0].length - 1;
        const ci = Math.floor(rows / 2);
        const cj = Math.floor(cols / 2);
        const ca = grid[ci][cj], cb = grid[ci + 1][cj], cc = grid[ci + 1][cj + 1];
        const refDet = (cb.s - ca.s) * (cc.h - ca.h) - (cc.s - ca.s) * (cb.h - ca.h);
        const detSign = refDet >= 0 ? 1 : -1;

        let bestTri = null;
        let bestMinW = -1e9;
        let bestW = null;

        const checkTri = (p0, p1, p2) => {
          const v0s = p1.s - p0.s, v0h = p1.h - p0.h;
          const v1s = p2.s - p0.s, v1h = p2.h - p0.h;
          const det = v0s * v1h - v1s * v0h;
          if (det * detSign <= 1e-12) return;
          const v2s = sTarget - p0.s, v2h = hTarget - p0.h;
          const w1 = (v2s * v1h - v1s * v2h) / det;
          const w2 = (v0s * v2h - v2s * v0h) / det;
          const w0 = 1 - w1 - w2;
          const minW = Math.min(w0, w1, w2);
          if (minW > bestMinW) {
            bestMinW = minW;
            bestTri = [p0, p1, p2];
            bestW = [w0, w1, w2];
          }
        };

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const a = grid[i][j];
            const b = grid[i + 1][j];
            const c = grid[i + 1][j + 1];
            const d = grid[i][j + 1];
            checkTri(a, b, c);
            checkTri(a, c, d);
          }
        }

        if (!bestTri) {
          const p = grid[ci][cj];
          return { x: p.r * Math.cos(p.theta), y: p.r * Math.sin(p.theta), z: p.z };
        }

        const [p0, p1, p2] = bestTri;
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
        return { x: r * Math.cos(th), y: r * Math.sin(th), z };
      };

      const sampleCount = 17;
      const uList = Array.from({ length: sampleCount }, (_, i) => i / (sampleCount - 1));
      const vList = Array.from({ length: sampleCount }, (_, j) => j / (sampleCount - 1));

      const buildPinionConjSurface = (conjGrid) => {
        const sampleGrid = uList.map((u) =>
          vList.map((v) => {
            const sTarget = sToeP + v * (sHeelP - sToeP);
            const mnLocal = evalMnAtSP(sTarget);
            const hTarget = (-hdP + u * (haP + hdP)) * mnLocal;
            return evalPinionFromTriGrid(conjGrid, sTarget, hTarget);
          })
        );
        return HypoidGearGenerator.fitBezierLeastSquares(sampleGrid, uList, vList, 4, 4);
      };

      const pinionDriveSurf = buildPinionConjSurface(pinionPlusConj);
      const pinionCoastSurf = buildPinionConjSurface(pinionMinusConj);

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
        pinionMidArc
      );
      const pinionToothGeometry = BezierSurface.buildGeometryFromPatches(THREE, pinionPatches);

      const lathes = HypoidGearGenerator.buildMechanicalLathes(THREE, ringDriveSurf, pinionDriveSurf);

      return {
        pinionToothGeometry,
        ringToothGeometry,
        pinionBodyGeometry: lathes.pinionBodyGeometry,
        ringBodyGeometry: lathes.ringBodyGeometry,
        mechanics: lathes.mechanics,
        pinionTeeth: NP,
        ringTeeth: NG,
        offset: E,
        shaftAngleDeg,
        pinionAxisOffset: Op,
        pinionBasis: { wP, yAxis, uP },
        meshFocus: P0
      };
    }
  static _buildClosedToothPatches(driveSurf, coastSurf, nodesV, midArcFn) {
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

      const orientOutward = (surface, segU, segV) => {
        const ev = surface.evaluateWithPartials(0.5, 0.5);
        const outVec = HypoidGearGenerator.vecSub(ev.point, centroid);
        const flipWinding = HypoidGearGenerator.vecDot(outVec, ev.normal) < 0;
        return { surface, segU, segV, flipWinding };
      };

      return [
        orientOutward(driveSurf, 14, 18),
        orientOutward(coastSurf, 14, 18),
        orientOutward(topLand, 4, 18),
        orientOutward(rootBase, 4, 18),
        orientOutward(toeCap, 14, 4),
        orientOutward(heelCap, 14, 4)
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

  static buildMechanicalLathes(THREE, ringDriveSurf, pinionDriveSurf) {
      // 1. Chamfered forged Ring Gear blank
      const rToeD = ringDriveSurf.evaluate(0, 0);
      const rHeelD = ringDriveSurf.evaluate(0, 1);
      const ringToeR = Math.hypot(rToeD.y, rToeD.z) - 0.002;
      const ringHeelR = Math.hypot(rHeelD.y, rHeelD.z) - 0.002;
      const ringToeX = rToeD.x + 0.004;
      const ringHeelX = rHeelD.x + 0.004;
      const ringBoreR = Math.max(0.45, ringToeR * 0.72);
      const ringOuterR = ringHeelR + 0.032;
      const ringBackX = Math.max(ringToeX, ringHeelX) + 0.21;

      const ringLathePts = [
        new THREE.Vector2(ringBoreR, ringToeX + 0.045),
        new THREE.Vector2(ringBoreR + 0.02, ringToeX + 0.025),
        new THREE.Vector2(ringToeR - 0.015, ringToeX + 0.025),
        new THREE.Vector2(ringToeR, ringToeX),
        new THREE.Vector2(ringHeelR, ringHeelX),
        new THREE.Vector2(ringOuterR, ringHeelX + 0.025),
        new THREE.Vector2(ringOuterR, ringBackX - 0.02),
        new THREE.Vector2(ringOuterR - 0.02, ringBackX),
        new THREE.Vector2(ringBoreR + 0.02, ringBackX),
        new THREE.Vector2(ringBoreR, ringBackX - 0.02),
        new THREE.Vector2(ringBoreR, ringToeX + 0.045)
      ];
      const ringBodyGeometry = new THREE.LatheGeometry(ringLathePts, 64);
      ringBodyGeometry.rotateZ(-Math.PI / 2);

      // 2. Forged Pinion cone blank + stepped bearing journal + splined drive shaft
      const pToeD = pinionDriveSurf.evaluate(0, 0);
      const pHeelD = pinionDriveSurf.evaluate(0, 1);
      const pToeR = Math.max(0.08, Math.hypot(pToeD.x, pToeD.y) - 0.002);
      const pHeelR = Math.max(0.12, Math.hypot(pHeelD.x, pHeelD.y) - 0.002);
      const pToeZ = pToeD.z + 0.002;
      const pHeelZ = pHeelD.z + 0.002;
      const pShaftR = Math.min(0.21, pToeR * 0.58);
      const pJournalR = pShaftR * 1.18;
      const pSplineR = pShaftR * 0.88;
      const pThreadR = pShaftR * 0.62;

      const pinionLathePts = [
        new THREE.Vector2(0.001, pToeZ - 0.05),
        new THREE.Vector2(pToeR * 0.68, pToeZ - 0.05),
        new THREE.Vector2(pToeR * 0.92, pToeZ - 0.02),
        new THREE.Vector2(pToeR, pToeZ),
        new THREE.Vector2(pHeelR, pHeelZ),
        new THREE.Vector2(pHeelR + 0.012, pHeelZ + 0.015),
        new THREE.Vector2(pHeelR + 0.012, pHeelZ + 0.055),
        new THREE.Vector2(pJournalR + 0.05, pHeelZ + 0.075),
        new THREE.Vector2(pJournalR + 0.05, pHeelZ + 0.115),
        new THREE.Vector2(pJournalR, pHeelZ + 0.12),
        new THREE.Vector2(pJournalR, pHeelZ + 0.36),
        new THREE.Vector2(pSplineR, pHeelZ + 0.45),
        new THREE.Vector2(pSplineR, pHeelZ + 0.96),
        new THREE.Vector2(pThreadR, pHeelZ + 0.97),
        new THREE.Vector2(pThreadR, pHeelZ + 1.12),
        new THREE.Vector2(pThreadR * 0.80, pHeelZ + 1.14),
        new THREE.Vector2(0.001, pHeelZ + 1.14)
      ];
      const pinionBodyGeometry = new THREE.LatheGeometry(pinionLathePts, 48);
      pinionBodyGeometry.rotateX(Math.PI / 2);

      return {
        ringBodyGeometry,
        pinionBodyGeometry,
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
}

globalThis.HypoidGearGenerator = HypoidGearGenerator;
if (typeof module !== 'undefined' && module.exports) module.exports = HypoidGearGenerator;