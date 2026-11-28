class GearsTestJig {
  constructor(THREE, pair, opts = {}) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.name = 'GearsTestJigGroup';
    this.disposables = { geos: [], mats: [] };
    this.speedKnob = null;
    this.speedLedMat = null;
    this.maxSpeed = opts.maxSpeed || 1.5;

    this._build(pair, opts.mats || null);
  }

  _regGeo(g) {
    this.disposables.geos.push(g);
    return g;
  }

  _regMat(m) {
    this.disposables.mats.push(m);
    return m;
  }

  _build(pair, sharedMats) {
      const THREE = this.THREE;
      const m = pair.mechanics;
      const uP = pair.pinionBasis.uP;
      const wP = pair.pinionBasis.wP;
      const yAxis = pair.pinionBasis.yAxis;

      const oakWoodMat = this._regMat(new THREE.MeshStandardMaterial({ color: 0x7c4e2d, roughness: 0.72, metalness: 0.04 }));
      const walnutWoodMat = this._regMat(new THREE.MeshStandardMaterial({ color: 0x56341c, roughness: 0.76, metalness: 0.04 }));
      const castIronMat = this._regMat(new THREE.MeshStandardMaterial({ color: 0x242c38, roughness: 0.52, metalness: 0.72 }));
      const machinedAlumMat = this._regMat(new THREE.MeshStandardMaterial({ color: 0x7a8b9f, roughness: 0.30, metalness: 0.85 }));
      const motorShellMat = this._regMat(new THREE.MeshStandardMaterial({ color: 0x1b3a4b, roughness: 0.36, metalness: 0.62 }));
      const brassMat = sharedMats?.brass || this._regMat(new THREE.MeshStandardMaterial({ color: 0xc28e42, roughness: 0.25, metalness: 0.88 }));
      const boltMat = sharedMats?.bolt || this._regMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.20, metalness: 0.92 }));
      this.speedLedMat = this._regMat(new THREE.MeshStandardMaterial({
        color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.5, roughness: 0.2
      }));

      const baseY = -(m.ringOuterR + 0.58);
      const ringBrgX = m.ringBackX + 0.46;
      const ringPostX = m.ringBackX + 0.70;
      const motorZLocal = m.pHeelZ + 1.42;
      const motorEndWorldX = uP.x * (motorZLocal + 0.40);
      const motorEndWorldZ = uP.z * (motorZLocal + 0.40);

      const minX = Math.min(-0.92, motorEndWorldX - 0.52);
      const maxX = Math.max(ringPostX + 0.34, motorEndWorldX + 0.52);
      const minZ = Math.min(-1.55, motorEndWorldZ - 0.46);
      const maxZ = Math.max(1.70, motorEndWorldZ + 0.38);

      const plateW = maxX - minX;
      const plateD = maxZ - minZ;
      const centerX = 0.5 * (minX + maxX);
      const centerZ = 0.5 * (minZ + maxZ);

      // Extra-thick Craftsman Hardwood Jig Base Board
      const plateH = 0.26;
      const bedMesh = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(plateW, plateH, plateD)), oakWoodMat);
      bedMesh.position.set(centerX, baseY - plateH * 0.5, centerZ);
      this.group.add(bedMesh);

      const trimMesh = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(plateW + 0.06, 0.065, plateD + 0.06)), walnutWoodMat);
      trimMesh.position.set(centerX, baseY - plateH + 0.0325, centerZ);
      this.group.add(trimMesh);

      const boltGeo = this._regGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.045, 6));
      const bracketGeo = this._regGeo(new THREE.BoxGeometry(0.20, 0.045, 0.20));
      for (const fx of [minX + 0.18, maxX - 0.18]) {
        for (const fz of [minZ + 0.18, maxZ - 0.18]) {
          const brk = new THREE.Mesh(bracketGeo, castIronMat);
          brk.position.set(fx, baseY + 0.022, fz);
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(fx, baseY + 0.055, fz);
          this.group.add(brk, bolt);
        }
      }

      // Ring Bearing Support: Oak pedestal set BACK at ringPostX (clear of rotating carrier!), iron arm holds ONLY the static bearing cup
      const rJournal = Math.max(0.24, m.ringBoreR * 0.42);
      const rCupOut = rJournal + 0.15;
      const saddleBotY = -(rCupOut + 0.11);
      const woodH = Math.max(0.20, saddleBotY - baseY);

      const ringBasePlinth = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.42, 0.12, (rCupOut + 0.22) * 2)), walnutWoodMat);
      ringBasePlinth.position.set(ringPostX, baseY + 0.06, 0);
      const ringWoodPost = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.28, woodH, (rCupOut + 0.12) * 2)), oakWoodMat);
      ringWoodPost.position.set(ringPostX, baseY + woodH * 0.5, 0);
      this.group.add(ringBasePlinth, ringWoodPost);

      // Cantilever cast-iron saddle reaching forward from ringPostX to grip only the static bearing cup at ringBrgX
      const armLen = (ringPostX - ringBrgX) + 0.22;
      const saddle = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(armLen, 0.13, (rCupOut + 0.14) * 2)), castIronMat);
      saddle.position.set(0.5 * (ringPostX + ringBrgX) + 0.02, saddleBotY + 0.055, 0);
      const clampRingGeo = this._regGeo(new THREE.TorusGeometry(rCupOut + 0.032, 0.038, 12, 36));
      clampRingGeo.rotateY(Math.PI / 2);
      const clampRing = new THREE.Mesh(clampRingGeo, machinedAlumMat);
      clampRing.position.set(ringBrgX, 0, 0);
      this.group.add(saddle, clampRing);

      for (const sz of [-1, 1]) {
        const ear = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.16, rCupOut + 0.12, 0.10)), castIronMat);
        ear.position.set(ringBrgX, -rCupOut * 0.45, sz * (rCupOut + 0.075));
        const earBolt = new THREE.Mesh(boltGeo, boltMat);
        earBolt.position.set(ringBrgX, 0.08, sz * (rCupOut + 0.075));
        this.group.add(ear, earBolt);
      }

      // Pinion Bearing Pillow-Block (oak post set behind bearing at pWoodZ, iron saddle grips static cup at pBrgZ)
      const pinionJig = new THREE.Group();
      pinionJig.position.set(0, -pair.offset, 0);
      const basisMat = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(wP.x, wP.y, wP.z),
        new THREE.Vector3(yAxis.x, yAxis.y, yAxis.z),
        new THREE.Vector3(uP.x, uP.y, uP.z)
      );
      pinionJig.quaternion.setFromRotationMatrix(basisMat);

      const pBrgZ = m.pHeelZ + 0.24;
      const pWoodZ = m.pHeelZ + 0.36;
      const pBrgOutR = m.pJournalR + 0.135;
      const pColH = Math.max(0.25, (-pair.offset) - baseY);
      const pWoodH = Math.max(0.18, pColH - (pBrgOutR + 0.10));

      const pWoodBlock = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry((pBrgOutR + 0.18) * 2.0, pWoodH, 0.22)), oakWoodMat);
      pWoodBlock.position.set(0, -pColH + pWoodH * 0.5, pWoodZ);
      const pSaddle = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry((pBrgOutR + 0.14) * 2.0, 0.12, 0.34)), castIronMat);
      pSaddle.position.set(0, -(pBrgOutR + 0.05), 0.5 * (pBrgZ + pWoodZ));
      const pCollar = new THREE.Mesh(this._regGeo(new THREE.TorusGeometry(pBrgOutR + 0.028, 0.038, 12, 32)), machinedAlumMat);
      pCollar.position.set(0, 0, pBrgZ);
      pinionJig.add(pWoodBlock, pSaddle, pCollar);

      const couplerGeo = this._regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 20));
      couplerGeo.rotateX(Math.PI / 2);
      const coupler = new THREE.Mesh(couplerGeo, brassMat);
      coupler.position.set(0, 0, m.pHeelZ + 1.04);
      pinionJig.add(coupler);

      const motorR = 0.34;
      const motorLen = 0.68;
      const motorBodyGeo = this._regGeo(new THREE.CylinderGeometry(motorR, motorR, motorLen, 24));
      motorBodyGeo.rotateX(Math.PI / 2);
      const motorBody = new THREE.Mesh(motorBodyGeo, motorShellMat);
      motorBody.position.set(0, 0, motorZLocal);
      pinionJig.add(motorBody);

      const finGeo = this._regGeo(new THREE.CylinderGeometry(motorR + 0.042, motorR + 0.042, 0.022, 24));
      finGeo.rotateX(Math.PI / 2);
      for (let f = -3; f <= 3; f++) {
        const fin = new THREE.Mesh(finGeo, machinedAlumMat);
        fin.position.set(0, 0, motorZLocal + f * 0.072);
        pinionJig.add(fin);
      }

      const endCapGeo = this._regGeo(new THREE.SphereGeometry(motorR, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5));
      endCapGeo.rotateX(Math.PI / 2);
      const endCap = new THREE.Mesh(endCapGeo, castIronMat);
      endCap.position.set(0, 0, motorZLocal + motorLen * 0.5);
      const jBox = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.22, 0.14, 0.22)), brassMat);
      jBox.position.set(0, motorR + 0.06, motorZLocal - 0.04);
      pinionJig.add(endCap, jBox);

      const mWoodH = Math.max(0.18, pColH - (motorR + 0.06));
      const motorFootWood = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.64, mWoodH, 0.56)), walnutWoodMat);
      motorFootWood.position.set(0, -pColH + mWoodH * 0.5, motorZLocal);
      const motorSaddle = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.56, 0.14, 0.46)), castIronMat);
      motorSaddle.position.set(0, -(motorR + 0.02), motorZLocal);
      pinionJig.add(motorFootWood, motorSaddle);

      this.group.add(pinionJig);

      const consoleGrp = new THREE.Group();
      consoleGrp.position.set(minX + 0.38, baseY + 0.09, maxZ - 0.30);
      consoleGrp.rotation.y = 0.48;

      const consoleBox = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.52, 0.18, 0.38)), walnutWoodMat);
      consoleGrp.add(consoleBox);

      const faceGrp = new THREE.Group();
      faceGrp.position.set(0, 0.098, 0.01);
      faceGrp.rotation.x = -0.35;
      consoleGrp.add(faceGrp);

      const facePlate = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.46, 0.022, 0.32)), machinedAlumMat);
      faceGrp.add(facePlate);

      const ledArcGeo = this._regGeo(new THREE.TorusGeometry(0.10, 0.014, 8, 28, Math.PI * 1.45));
      ledArcGeo.rotateX(-Math.PI / 2);
      ledArcGeo.rotateY(Math.PI * 0.775);
      const ledArc = new THREE.Mesh(ledArcGeo, this.speedLedMat);
      ledArc.position.set(-0.07, 0.016, 0.01);
      faceGrp.add(ledArc);

      const knobGrp = new THREE.Group();
      knobGrp.position.set(-0.07, 0.036, 0.01);
      const knobMesh = new THREE.Mesh(this._regGeo(new THREE.CylinderGeometry(0.062, 0.070, 0.045, 20)), castIronMat);
      const pointerMesh = new THREE.Mesh(this._regGeo(new THREE.BoxGeometry(0.014, 0.014, 0.056)), this.speedLedMat);
      pointerMesh.position.set(0, 0.024, -0.024);
      knobGrp.add(knobMesh, pointerMesh);
      faceGrp.add(knobGrp);

      const pwrBtn = new THREE.Mesh(this._regGeo(new THREE.CylinderGeometry(0.052, 0.056, 0.038, 20)), this.speedLedMat);
      pwrBtn.position.set(0.12, 0.028, 0.01);
      faceGrp.add(pwrBtn);

      this.speedKnob = knobGrp;
      this.group.add(consoleGrp);

      this.group.traverse((obj) => { if (obj.isMesh) obj.userData.gearAction = 'openSettings'; });
      consoleGrp.traverse((obj) => { if (obj.isMesh) obj.userData.gearAction = 'toggleMotor'; });

      this.setSpeed(opts.angularSpeed !== undefined ? opts.angularSpeed : 0.35);
    }
  setSpeed(radPerSec) {
      const absSpd = Math.abs(Number(radPerSec || 0));
      const frac = Math.max(0, Math.min(1, absSpd / this.maxSpeed));
      if (this.speedKnob) {
        this.speedKnob.rotation.y = (0.5 - frac) * Math.PI * 1.45;
      }
      if (this.speedLedMat) {
        if (frac <= 0.01) {
          this.speedLedMat.color.setHex(0xef4444);
          this.speedLedMat.emissive.setHex(0xb91c1c);
          this.speedLedMat.emissiveIntensity = 0.65;
        } else if (frac < 0.5) {
          this.speedLedMat.color.setHex(0x38bdf8);
          this.speedLedMat.emissive.setHex(0x38bdf8);
          this.speedLedMat.emissiveIntensity = 1.0 + frac * 1.6;
        } else {
          this.speedLedMat.color.setHex(0xf59e0b);
          this.speedLedMat.emissive.setHex(0xf59e0b);
          this.speedLedMat.emissiveIntensity = 1.3 + frac * 1.8;
        }
      }
    }
  setVisible(vis) {
    this.group.visible = Boolean(vis);
  }

  dispose() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    for (const g of this.disposables.geos) {
      try { g.dispose(); } catch (e) {}
    }
    for (const m of this.disposables.mats) {
      try { m.dispose(); } catch (e) {}
    }
    this.disposables.geos = [];
    this.disposables.mats = [];
    this.speedKnob = null;
    this.speedLedMat = null;
  }

  setEnvMap(envMap) {
      for (const m of this.disposables.mats) {
        if (m && m !== this.speedLedMat && m.metalness > 0.3) {
          m.envMap = envMap || null;
          m.envMapIntensity = envMap ? 1.15 : 1.0;
          m.needsUpdate = true;
        }
      }
    }
}

globalThis.GearsTestJig = GearsTestJig;
if (typeof window !== 'undefined') window.GearsTestJig = GearsTestJig;
if (typeof module !== 'undefined' && module.exports) module.exports = GearsTestJig;