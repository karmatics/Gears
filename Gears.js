class Gears {
  getThemeColors() {
    const THREE = this.app.THREE;
    return [
      new THREE.Color(0xff0000), // Red
      new THREE.Color(0x00ff00), // Green
      new THREE.Color(0x0044ff), // Blue
      new THREE.Color(0xffff00), // Yellow
      // new THREE.Color(0x00ffff), // Cyan
      // new THREE.Color(0xff00ff), // Magenta
      // new THREE.Color(0xff8800), // Orange
      new THREE.Color(0x8800ff), // Purple
      // new THREE.Color(0xff1493), // Pink
      //  new THREE.Color(0xccff00), // Lime
      //new THREE.Color(0x008080), // Teal
      //new THREE.Color(0x8b4513), // Brown
      //new THREE.Color(0x808080), // Gray
      //new THREE.Color(0x000080), // Navy
    ];
  }

  constructor() {
      this.app = null;
      this.meshes = [];
      this.grid = null;
      this.thickLine = null;
      this.raycastingEnabled = false;
      this._userHoverEnabled = false;
      this.intersected = null;
      this.loadedModel = null;
      this.isShiftDown = false;
      this.paintedObjectsThisStroke = new Set();
      this._accuDrawSlice = null;
      this._cadToolsLoaded = false;
      this._activeCadTool = 'orbit';
      this._accuDrawUiVisible = false;

      this.gearParams = {
        pinionTeeth: 11,
        ringTeeth: 34,
        offset: 0.42,
        shaftAngleDeg: 90,
        pressureAngleDeg: 23,
        profileShift: 0.30
      };

      this.showBodies = true;
      this.pinionMountGroup = null;
      this.pinionGroup = null;
      this.ringGearGroup = null;
      this.ringStaticGroup = null;
      this.ringCarrierCageGroup = null;
      this.pinionCageGroup = null;

      this.pinionToothGeometry = null;
      this.ringToothGeometry = null;
      this.pinionBodyGeometry = null;
      this.ringBodyGeometry = null;

      this.pinionMaterial = null;
      this.ringMaterial = null;

      this._bodyNodes = [];
      this._bodyGeomDisposables = [];
      this._bodyMatDisposables = [];

      this.pinionTeeth = 11;
      this.ringTeeth = 34;
      this.gearAngle = 0;
      this.angularSpeed = 0.35;
      this.isPaused = false;
      this._lastTime = 0;
      this._hypoidLights = [];
      this._hudPanel = null;
      this._meshFocus = { x: 0.53, y: -0.35, z: 1.32 };
      this._rebuildTimer = null;
    }
  _buildPrimitives() {
      const THREE = this.app.THREE;
      const scene = this.app.scene;

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
      keyLight.position.set(4, 6, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.72);
      fillLight.position.set(-5, 2, 4);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xfde68a, 0.65);
      rimLight.position.set(0, -4, -5);
      scene.add(rimLight);

      this._hypoidLights.push(keyLight, fillLight, rimLight);
      this._rebuildGears();
    }
  _assignColorsRandomly() {
    const colors = this.getThemeColors();
    const shuffled = [...colors].sort(() => Math.random() - 0.5);

    this.meshes.forEach((m, i) => {
      if (m.userData.locked !== true) {
        m.material.color.copy(shuffled[i % shuffled.length]);
      }
    });

    if (this.thickLine && this.thickLine.userData.locked !== true) {
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.thickLine.material.color.copy(randomColor);
    }
  }

  _setupUI() {
      if (this.env && this.env.hideUi) {
        return;
      }

      const scheduleRebuild = () => {
        if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
        this._rebuildTimer = setTimeout(() => {
          this._rebuildTimer = null;
          this._rebuildGears();
        }, 25);
      };

      const btnStyle = {
        padding: '4px 7px',
        fontSize: '11px',
        fontFamily: 'monospace',
        background: '#161b22',
        color: '#e2e8f0',
        border: '1px solid #30363d',
        borderRadius: '4px',
        cursor: 'pointer'
      };

      const bodyEl = makeElement('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '6px' }
      });

      let collapsed = false;
      const btnCollapse = makeElement('button', {
        style: {
          ...btnStyle,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1c2431',
          fontWeight: 'bold'
        },
        onclick: () => {
          collapsed = !collapsed;
          bodyEl.style.display = collapsed ? 'none' : 'flex';
          btnCollapse.textContent = collapsed ? '⚙ Hypoid Controls ▸' : '⚙ Hypoid Controls ▾';
        }
      }, '⚙ Hypoid Controls ▾');

      const bodyChk = makeElement('input', {
        type: 'checkbox',
        id: 'chkBodiesToggle',
        checked: this.showBodies
      });
      bodyChk.onchange = () => {
        this.showBodies = bodyChk.checked;
        for (const node of this._bodyNodes) {
          node.visible = this.showBodies;
        }
      };
      const bodyLbl = makeElement('label', {
        htmlFor: 'chkBodiesToggle',
        style: { fontSize: '11px', fontFamily: 'monospace', color: '#cbd5e1', cursor: 'pointer' }
      }, 'Show Mechanical Bodies');
      const bodyToggleRow = makeElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }
      }, [bodyChk, bodyLbl]);

      const btnPlay = makeElement('button', {
        style: { ...btnStyle, flex: '1' },
        onclick: () => {
          this.isPaused = !this.isPaused;
          btnPlay.textContent = this.isPaused ? '▶ Play' : '⏸ Pause';
        }
      }, '⏸ Pause');

      const btnStep = makeElement('button', {
        style: btnStyle,
        title: 'Step ring gear by +5 degrees',
        onclick: () => {
          this.isPaused = true;
          btnPlay.textContent = '▶ Play';
          this.gearAngle += (5 * Math.PI) / 180;
          const pinionAngle = -(this.ringTeeth / this.pinionTeeth) * this.gearAngle;
          if (this.ringGearGroup) this.ringGearGroup.rotation.x = this.gearAngle;
          if (this.pinionGroup) this.pinionGroup.rotation.z = pinionAngle;
          if (this.ringCarrierCageGroup) this.ringCarrierCageGroup.rotation.z = 0.5 * this.gearAngle;
          if (this.pinionCageGroup) this.pinionCageGroup.rotation.z = 0.5 * pinionAngle;
        }
      }, '+5°');

      const speedValEl = makeElement('span', {
        style: { fontSize: '10.5px', fontFamily: 'monospace', color: '#38bdf8' }
      }, this.angularSpeed.toFixed(2) + ' rad/s');

      const speedInput = makeElement('input', {
        type: 'range',
        min: '0',
        max: '1.50',
        step: '0.01',
        value: String(this.angularSpeed),
        style: { width: '100%', cursor: 'pointer' },
        oninput: (e) => {
          this.angularSpeed = parseFloat(e.target.value);
          speedValEl.textContent = this.angularSpeed.toFixed(2) + ' rad/s';
        }
      });

      const speedBox = makeElement('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '5px', background: '#0d1117', borderRadius: '4px', border: '1px solid #263042' }
      }, [
        makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'monospace' } }, [
          makeElement('span', { style: { color: '#94a3b8' } }, 'Rotation Speed'),
          speedValEl
        ]),
        speedInput,
        makeElement('div', { style: { display: 'flex', gap: '4px', marginTop: '2px' } }, [btnPlay, btnStep])
      ]);

      const sliderRefs = [];
      const makeParamRow = (label, key, min, max, step, formatFn) => {
        const valEl = makeElement('span', {
          style: { color: '#fbbf24', fontFamily: 'monospace', fontSize: '10.5px' }
        }, formatFn(this.gearParams[key]));

        const input = makeElement('input', {
          type: 'range',
          min: String(min),
          max: String(max),
          step: String(step),
          value: String(this.gearParams[key]),
          style: { width: '100%', cursor: 'pointer' },
          oninput: (e) => {
            const val = parseFloat(e.target.value);
            this.gearParams[key] = val;
            valEl.textContent = formatFn(val);
            scheduleRebuild();
          }
        });

        sliderRefs.push({ key, input, valEl, formatFn });

        return makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
          makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'monospace' } }, [
            makeElement('span', { style: { color: '#94a3b8' } }, label),
            valEl
          ]),
          input
        ]);
      };

      const paramsBox = makeElement('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px', background: '#0d1117', borderRadius: '4px', border: '1px solid #263042' }
      }, [
        makeParamRow('Pinion Teeth', 'pinionTeeth', 7, 16, 1, (v) => `${Math.round(v)}`),
        makeParamRow('Ring Teeth', 'ringTeeth', 20, 44, 1, (v) => `${Math.round(v)}`),
        makeParamRow('Hypoid Offset', 'offset', 0.10, 0.54, 0.02, (v) => v.toFixed(2)),
        makeParamRow('Shaft Angle', 'shaftAngleDeg', 70, 110, 1, (v) => `${Math.round(v)}°`),
        makeParamRow('Pressure Angle', 'pressureAngleDeg', 18, 28, 0.5, (v) => `${v.toFixed(1)}°`)
      ]);

      const btnMeshView = makeElement('button', {
        style: { ...btnStyle, flex: '1' },
        onclick: () => {
          if (!this.app?.camera || !this.app?.controls) return;
          const f = this._meshFocus || { x: 0.53, y: -0.35, z: 1.32 };
          this.app.camera.position.set(f.x + 1.15, f.y + 0.35, f.z + 1.15);
          this.app.controls.target.set(f.x, f.y, f.z);
          this.app.controls.update();
        }
      }, 'Mesh View');

      const btnFullView = makeElement('button', {
        style: { ...btnStyle, flex: '1' },
        onclick: () => {
          if (!this.app?.camera || !this.app?.controls) return;
          this.app.camera.position.set(3.35, 1.70, 3.55);
          this.app.controls.target.set(0.45, -0.22, 0.55);
          this.app.controls.update();
        }
      }, 'Full View');

      const btnReset = makeElement('button', {
        style: { ...btnStyle, width: '100%', color: '#93c5fd' },
        onclick: () => {
          Object.assign(this.gearParams, {
            pinionTeeth: 11,
            ringTeeth: 34,
            offset: 0.42,
            shaftAngleDeg: 90,
            pressureAngleDeg: 23,
            profileShift: 0.30
          });
          for (const ref of sliderRefs) {
            ref.input.value = String(this.gearParams[ref.key]);
            ref.valEl.textContent = ref.formatFn(this.gearParams[ref.key]);
          }
          this._rebuildGears();
        }
      }, 'Reset Defaults');

      bodyEl.appendChild(bodyToggleRow);
      bodyEl.appendChild(speedBox);
      bodyEl.appendChild(paramsBox);
      bodyEl.appendChild(makeElement('div', { style: { display: 'flex', gap: '4px' } }, [btnMeshView, btnFullView]));
      bodyEl.appendChild(btnReset);

      const panel = makeElement('div', {
        style: {
          position: 'absolute',
          top: '12px',
          left: '12px',
          width: '220px',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          padding: '8px',
          background: 'rgba(13, 17, 23, 0.86)',
          border: '1px solid #30363d',
          borderRadius: '8px',
          zIndex: 20,
          color: '#e2e8f0'
        }
      }, [btnCollapse, bodyEl]);

      const host = this.env?.uiContainer || this.rootElement;
      if (host) {
        host.appendChild(panel);
        this._hudPanel = panel;
      }
    }
  _buildThickLine() {
      this.thickLine = null;
    }

  _setupRaycasting() {
      this._lastTime = performance.now();
      const originalOnUpdate = this.app.onUpdateCallback;
      this.app.onUpdateCallback = () => {
        if (originalOnUpdate) originalOnUpdate();
        this._updateRaycasting();
      };
    }

  _updateRaycasting() {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - this._lastTime) * 0.001));
      this._lastTime = now;

      if (!this.isPaused && this.angularSpeed > 0 && this.ringGearGroup && this.pinionGroup) {
        this.gearAngle += this.angularSpeed * dt;
        const pinionAngle = -(this.ringTeeth / this.pinionTeeth) * this.gearAngle;
        this.ringGearGroup.rotation.x = this.gearAngle;
        this.pinionGroup.rotation.z = pinionAngle;
        if (this.ringCarrierCageGroup) this.ringCarrierCageGroup.rotation.z = 0.5 * this.gearAngle;
        if (this.pinionCageGroup) this.pinionCageGroup.rotation.z = 0.5 * pinionAngle;
      }
    }
  _loadGLB(file, feedbackElement) {
    ModelLoader.loadGLB(file, this.app, feedbackElement, (loadedModel) => {
      this._clearSceneGeometry();
      this.loadedModel = loadedModel;
      this.app.add(this.loadedModel);
      this.loadedModel.traverse((child) => {
        if (child.isMesh) {
          this.meshes.push(child);
        }
      });
    });
  }

  _clearSceneGeometry() {
    ModelLoader.clearSceneGeometry(this.app, this.meshes, this.loadedModel);
    this.loadedModel = null;
  }

  _generateSaturatedColor() {
    const THREE = this.app.THREE;
    const c = new THREE.Color(),
      v = [0, 1, Math.random()];
    v.sort(() => Math.random() - 0.5);
    return c.setRGB(v[0], v[1], v[2]), c;
  }

  _applyPaintToObject(intersect) {
    const THREE = this.app.THREE;
    const object = intersect.object;
    if (!object) return;

    object.userData.locked = true;

    if (object.isLine2) {
      const colors = this.getThemeColors();
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      object.material.color.copy(randomColor);
      return;
    }

    if (object.isMesh) {
      const newMaterial = new THREE.MeshPhysicalMaterial({});
      newMaterial.color.set(this._generateSaturatedColor());

      if (Math.random() > 0.4) {
        newMaterial.metalness = Math.random();
        newMaterial.roughness = Math.random() * 0.4;
        newMaterial.clearcoat = Math.random() > 0.5 ? Math.random() : 0.0;
        newMaterial.clearcoatRoughness = Math.random() * 0.3;
      } else {
        newMaterial.metalness = 0.0;
        newMaterial.roughness = 0.9;
        newMaterial.clearcoat = 0.0;
      }

      if (Array.isArray(object.material)) {
        const materialIndex = intersect.face.materialIndex;
        if (materialIndex !== undefined) {
          const oldMaterial = object.material[materialIndex];
          if (oldMaterial.map) newMaterial.map = oldMaterial.map;

          const newMaterials = object.material.slice();
          newMaterials[materialIndex] = newMaterial;
          object.material = newMaterials;
          if (oldMaterial.dispose) oldMaterial.dispose();
        }
      } else {
        const oldMaterial = object.material;
        if (oldMaterial.map) newMaterial.map = oldMaterial.map;

        object.material = newMaterial;
        if (oldMaterial.dispose) oldMaterial.dispose();
      }
    }
  }

  _highlight(object) {
    const THREE = this.app.THREE;
    if (!object) return;

    if (object.isMesh && object.material && object.material.emissive) {
      object.originalEmissive = object.material.emissive.getHex();
      object.material.emissive.setHex(0xff0000);
    } else if (object.isLine2) {
      object.originalColor = object.material.color.clone();
      object.material.color.lerp(new THREE.Color(0xffffff), 0.3);
    }
  }

  _unhighlight(object) {
    if (!object) return;

    if (
      object.isMesh &&
      object.material &&
      object.material.emissive &&
      object.originalEmissive !== undefined
    ) {
      object.material.emissive.setHex(object.originalEmissive);
    } else if (object.isLine2 && object.originalColor) {
      object.material.color.copy(object.originalColor);
    }
  }

  destroy() {
      this.destroyed = true;

      if (this._rebuildTimer) {
        clearTimeout(this._rebuildTimer);
        this._rebuildTimer = null;
      }

      if (this._hudPanel && this._hudPanel.parentElement) {
        this._hudPanel.parentElement.removeChild(this._hudPanel);
        this._hudPanel = null;
      }

      this._disposeGearObjects();

      const mats = ['pinionMaterial', 'ringMaterial'];
      for (const k of mats) {
        if (this[k]) {
          try { this[k].dispose(); } catch (e) {}
          this[k] = null;
        }
      }
      this._hypoidLights = [];

      if (Array.isArray(this.cleanupFns)) {
        for (const cleanup of this.cleanupFns.splice(0)) {
          try { cleanup(); } catch (error) {}
        }
      }

      if (this.rootElement?.parentElement?._vibesAppResizeObserver) {
        try {
          this.rootElement.parentElement._vibesAppResizeObserver.disconnect();
          delete this.rootElement.parentElement._vibesAppResizeObserver;
        } catch (e) {}
      }

      if (this.app && typeof this.app.destroy === 'function') {
        try { this.app.destroy(); } catch (error) {}
      }

      if (this.rootElement && this.rootElement.parentElement) {
        this.rootElement.parentElement.removeChild(this.rootElement);
      }

      this.rootElement = null;
      this.app = null;
      this.meshes = [];
      this.grid = null;
      this.thickLine = null;
      this.intersected = null;
      this.loadedModel = null;

      if (window.basic3d === this) {
        window.basic3d = null;
      }
    }

  async run(env) {
      if (this.rootElement) {
        this.destroy();
      }

      this.destroyed = false;
      this.cleanupFns = [];
      this.env = Object.assign({}, env || {});

      if (!this.env || !this.env.container) {
        throw new Error("[Gears] run() requires an environment object with a valid container.");
      }

      const parentElement = this.env.container;
      parentElement.style.position = 'relative';
      parentElement.style.width = '100%';
      parentElement.style.height = '100%';
      parentElement.style.margin = '0';
      parentElement.style.padding = '0';
      parentElement.style.overflow = 'hidden';
      parentElement.style.background = '#0b0f17';

      const canvasId = 'basic3d-canvas-' + Math.random().toString(36).slice(2);
      const canvasContainer = makeElement('div', {
        id: canvasId,
        tabIndex: 0,
        style: {
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          overflow: 'hidden',
          background: '#0b0f17',
          outline: 'none'
        }
      });
      parentElement.appendChild(canvasContainer);
      this.rootElement = canvasContainer;

      if (!parentElement._vibesAppResizeObserver && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (typeof this.onResize === 'function') {
              this.onResize(entry.contentRect.width, entry.contentRect.height);
            }
          }
        });
        ro.observe(parentElement);
        parentElement._vibesAppResizeObserver = ro;
      }

      this.app = new ThreeJSLoader(canvasId, {
        cameraPos: { x: 3.35, y: 1.70, z: 3.55 },
        enableControls: true,
        useThickLines: false,
        useRaycaster: false,
        commonLoaders: false,
        hdrPath: null,
        environment: false
      });

      await this.app.init(canvasContainer);

      const THREE = this.app.THREE || window.THREE;
      if (this.app.scene) {
        this.app.scene.background = new THREE.Color(0x0b0f17);
      }
      if (this.app.controls) {
        this.app.controls.target.set(0.45, -0.22, 0.55);
        this.app.controls.update();
      }

      const initialRect = parentElement.getBoundingClientRect();
      if (initialRect.width > 0 && initialRect.height > 0 && typeof this.onResize === 'function') {
        this.onResize(initialRect.width, initialRect.height);
      }

      this._buildPrimitives();
      this._setupUI();
      this._buildThickLine();
      this._setupRaycasting();

      window.threeApp = this.app;
      window.basic3d = this;

      return this;
    }
  onResize(width, height) {
    if (this.app && typeof this.app.resize === 'function') {
      this.app.resize(width, height);
    }
  }

  _disposeGearObjects() {
      const scene = this.app?.scene;
      if (this.ringGearGroup && scene) scene.remove(this.ringGearGroup);
      if (this.ringStaticGroup && scene) scene.remove(this.ringStaticGroup);
      if (this.pinionMountGroup && scene) scene.remove(this.pinionMountGroup);

      const geoms = ['pinionToothGeometry', 'ringToothGeometry', 'pinionBodyGeometry', 'ringBodyGeometry'];
      for (const k of geoms) {
        if (this[k]) {
          try { this[k].dispose(); } catch (e) {}
          this[k] = null;
        }
      }

      for (const g of this._bodyGeomDisposables) {
        try { g.dispose(); } catch (e) {}
      }
      this._bodyGeomDisposables = [];

      for (const m of this._bodyMatDisposables) {
        try { m.dispose(); } catch (e) {}
      }
      this._bodyMatDisposables = [];

      this._bodyNodes = [];
      this.ringGearGroup = null;
      this.ringStaticGroup = null;
      this.pinionMountGroup = null;
      this.pinionGroup = null;
      this.ringCarrierCageGroup = null;
      this.pinionCageGroup = null;
      this.meshes = [];
    }

  _rebuildGears() {
      if (!this.app || !this.app.scene) return;
      const THREE = this.app.THREE;
      const scene = this.app.scene;

      this._disposeGearObjects();

      const pair = HypoidGearGenerator.generatePair(THREE, this.gearParams);
      this.pinionTeeth = pair.pinionTeeth;
      this.ringTeeth = pair.ringTeeth;
      this.pinionToothGeometry = pair.pinionToothGeometry;
      this.ringToothGeometry = pair.ringToothGeometry;
      this.pinionBodyGeometry = pair.pinionBodyGeometry;
      this.ringBodyGeometry = pair.ringBodyGeometry;
      this._meshFocus = pair.meshFocus;

      if (!this.ringMaterial) {
        this.ringMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xcbd5e1,
          metalness: 0.86,
          roughness: 0.20,
          clearcoat: 0.25,
          clearcoatRoughness: 0.15
        });
      }
      if (!this.pinionMaterial) {
        this.pinionMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xd9a85c,
          metalness: 0.86,
          roughness: 0.20,
          clearcoat: 0.25,
          clearcoatRoughness: 0.15
        });
      }

      this.ringGearGroup = new THREE.Group();
      for (let k = 0; k < this.ringTeeth; k++) {
        const tooth = new THREE.Mesh(this.ringToothGeometry, this.ringMaterial);
        tooth.rotation.x = (k * 2 * Math.PI) / this.ringTeeth;
        this.ringGearGroup.add(tooth);
        this.meshes.push(tooth);
      }
      this.ringGearGroup.rotation.x = this.gearAngle;
      scene.add(this.ringGearGroup);

      this.pinionMountGroup = new THREE.Group();
      this.pinionMountGroup.position.set(0, -pair.offset, 0);
      const { wP, yAxis, uP } = pair.pinionBasis;
      const basisMat = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(wP.x, wP.y, wP.z),
        new THREE.Vector3(yAxis.x, yAxis.y, yAxis.z),
        new THREE.Vector3(uP.x, uP.y, uP.z)
      );
      this.pinionMountGroup.quaternion.setFromRotationMatrix(basisMat);

      this.pinionGroup = new THREE.Group();
      for (let k = 0; k < this.pinionTeeth; k++) {
        const tooth = new THREE.Mesh(this.pinionToothGeometry, this.pinionMaterial);
        tooth.rotation.z = (k * 2 * Math.PI) / this.pinionTeeth;
        this.pinionGroup.add(tooth);
        this.meshes.push(tooth);
      }
      const pinionAngle = -(this.ringTeeth / this.pinionTeeth) * this.gearAngle;
      this.pinionGroup.rotation.z = pinionAngle;
      this.pinionMountGroup.add(this.pinionGroup);
      scene.add(this.pinionMountGroup);

      this._buildDifferentialBodies(THREE, pair);

      if (this.ringCarrierCageGroup) this.ringCarrierCageGroup.rotation.z = 0.5 * this.gearAngle;
      if (this.pinionCageGroup) this.pinionCageGroup.rotation.z = 0.5 * pinionAngle;
    }
  _createTaperedRollerBearing(THREE, opts) {
      const { rIn, rOut, width, numRollers, coneAngleDeg, mats } = opts;
      const coneAng = (coneAngleDeg * Math.PI) / 180;
      const rMid = 0.5 * (rIn + rOut);
      const rollerHalfLen = width * 0.34;
      const rollerAvgR = (rOut - rIn) * 0.24;
      const rollerSmallR = rollerAvgR * 0.86;
      const rollerLargeR = rollerAvgR * 1.14;

      const innerGroup = new THREE.Group();
      const cageGroup = new THREE.Group();
      const outerGroup = new THREE.Group();

      const rTrackFront = rMid - rollerAvgR - Math.sin(coneAng) * rollerHalfLen;
      const rTrackBack = rMid - rollerAvgR + Math.sin(coneAng) * rollerHalfLen;
      const innerPts = [
        new THREE.Vector2(rIn, -width * 0.5),
        new THREE.Vector2(rTrackFront + rollerAvgR * 0.35, -width * 0.5),
        new THREE.Vector2(rTrackFront + rollerAvgR * 0.35, -width * 0.42),
        new THREE.Vector2(rTrackFront, -rollerHalfLen),
        new THREE.Vector2(rTrackBack, rollerHalfLen),
        new THREE.Vector2(rTrackBack + rollerAvgR * 0.48, rollerHalfLen + 0.015),
        new THREE.Vector2(rTrackBack + rollerAvgR * 0.48, width * 0.5),
        new THREE.Vector2(rIn, width * 0.5),
        new THREE.Vector2(rIn, -width * 0.5)
      ];
      const innerGeom = new THREE.LatheGeometry(innerPts, 48);
      innerGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(innerGeom);
      innerGroup.add(new THREE.Mesh(innerGeom, mats.race));

      // Tapered rollers & brass cage bars
      const rollerGeom = new THREE.CylinderGeometry(rollerSmallR, rollerLargeR, rollerHalfLen * 2, 16);
      const barGeom = new THREE.CylinderGeometry(rollerAvgR * 0.22, rollerAvgR * 0.22, width * 0.78, 8);
      const cageRingFrontGeom = new THREE.TorusGeometry(rMid + 0.004, rollerAvgR * 0.25, 8, 36);
      const cageRingBackGeom = new THREE.TorusGeometry(rMid + Math.sin(coneAng) * rollerHalfLen * 0.65, rollerAvgR * 0.25, 8, 36);
      this._bodyGeomDisposables.push(rollerGeom, barGeom, cageRingFrontGeom, cageRingBackGeom);

      const cageRingF = new THREE.Mesh(cageRingFrontGeom, mats.brass);
      cageRingF.position.z = -width * 0.37;
      const cageRingB = new THREE.Mesh(cageRingBackGeom, mats.brass);
      cageRingB.position.z = width * 0.37;
      cageGroup.add(cageRingF, cageRingB);

      const rollerAxis = new THREE.Vector3(-Math.sin(coneAng), 0, Math.cos(coneAng)).normalize();
      const yUp = new THREE.Vector3(0, 1, 0);
      const tiltQuat = new THREE.Quaternion().setFromUnitVectors(yUp, rollerAxis);

      for (let k = 0; k < numRollers; k++) {
        const ang = (k * 2 * Math.PI) / numRollers;
        const pivot = new THREE.Group();
        pivot.rotation.z = ang;
        const roller = new THREE.Mesh(rollerGeom, mats.roller);
        roller.position.set(rMid, 0, 0);
        roller.quaternion.copy(tiltQuat);
        pivot.add(roller);
        cageGroup.add(pivot);

        const barPivot = new THREE.Group();
        barPivot.rotation.z = ang + Math.PI / numRollers;
        const bar = new THREE.Mesh(barGeom, mats.brass);
        bar.position.set(rMid + rollerAvgR * 0.35, 0, 0);
        bar.quaternion.copy(tiltQuat);
        barPivot.add(bar);
        cageGroup.add(barPivot);
      }

      // Outer bearing cup (slightly recessed on front so rollers & brass cage stay clearly visible)
      const rCupFront = rMid + rollerAvgR * 0.92 - Math.sin(coneAng) * rollerHalfLen * 0.55;
      const rCupBack = rMid + rollerAvgR * 0.92 + Math.sin(coneAng) * rollerHalfLen;
      const outerPts = [
        new THREE.Vector2(rCupFront, -width * 0.14),
        new THREE.Vector2(rOut, -width * 0.14),
        new THREE.Vector2(rOut, width * 0.5),
        new THREE.Vector2(rCupBack + 0.015, width * 0.5),
        new THREE.Vector2(rCupBack, rollerHalfLen),
        new THREE.Vector2(rCupFront, -width * 0.14)
      ];
      const outerGeom = new THREE.LatheGeometry(outerPts, 48);
      outerGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(outerGeom);
      outerGroup.add(new THREE.Mesh(outerGeom, mats.race));

      return { innerGroup, cageGroup, outerGroup };
    }

  _buildDifferentialBodies(THREE, pair) {
      const m = pair.mechanics;
      const mats = {
        ringBlank: new THREE.MeshPhysicalMaterial({ color: 0x475569, metalness: 0.84, roughness: 0.32, clearcoat: 0.15 }),
        carrier: new THREE.MeshPhysicalMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.46, clearcoat: 0.08 }),
        pinionBlank: new THREE.MeshPhysicalMaterial({ color: 0x7c5f32, metalness: 0.82, roughness: 0.30, clearcoat: 0.15 }),
        flange: new THREE.MeshPhysicalMaterial({ color: 0x3f4a5a, metalness: 0.80, roughness: 0.36, clearcoat: 0.12 }),
        bolt: new THREE.MeshPhysicalMaterial({ color: 0xd1d5db, metalness: 0.92, roughness: 0.20 }),
        race: new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.14 }),
        roller: new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.98, roughness: 0.07 }),
        brass: new THREE.MeshPhysicalMaterial({ color: 0xc28e42, metalness: 0.86, roughness: 0.26 })
      };
      this._bodyMatDisposables.push(...Object.values(mats));

      // --- 1. RING GEAR BLANK, CARRIER CASE, 12 BOLTS & CARRIER BEARING ---
      const ringBodyGroup = new THREE.Group();
      ringBodyGroup.add(new THREE.Mesh(pair.ringBodyGeometry, mats.ringBlank));

      const rFlangeOut = m.ringBoreR + 0.19;
      const rBarrel = m.ringBoreR * 0.78;
      const rJournal = Math.max(0.24, m.ringBoreR * 0.42);
      const xB0 = m.ringBackX;
      const carrierPts = [
        new THREE.Vector2(rJournal * 0.72, xB0 + 0.02),
        new THREE.Vector2(rFlangeOut - 0.015, xB0),
        new THREE.Vector2(rFlangeOut, xB0 + 0.015),
        new THREE.Vector2(rFlangeOut, xB0 + 0.065),
        new THREE.Vector2(rBarrel, xB0 + 0.095),
        new THREE.Vector2(rBarrel, xB0 + 0.24),
        new THREE.Vector2(rBarrel * 0.84, xB0 + 0.28),
        new THREE.Vector2(rJournal + 0.04, xB0 + 0.34),
        new THREE.Vector2(rJournal, xB0 + 0.35),
        new THREE.Vector2(rJournal, xB0 + 0.60),
        new THREE.Vector2(rJournal * 0.72, xB0 + 0.60),
        new THREE.Vector2(rJournal * 0.72, xB0 + 0.02)
      ];
      const carrierGeom = new THREE.LatheGeometry(carrierPts, 48);
      carrierGeom.rotateZ(-Math.PI / 2);
      this._bodyGeomDisposables.push(carrierGeom);
      ringBodyGroup.add(new THREE.Mesh(carrierGeom, mats.carrier));

      // 12 Hex Flange Bolts around Ring Carrier Flange
      const boltHeadGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.042, 6);
      const boltWasherGeom = new THREE.CylinderGeometry(0.040, 0.040, 0.012, 16);
      boltHeadGeom.rotateZ(-Math.PI / 2);
      boltWasherGeom.rotateZ(-Math.PI / 2);
      this._bodyGeomDisposables.push(boltHeadGeom, boltWasherGeom);

      const boltRingR = m.ringBoreR + 0.105;
      for (let k = 0; k < 12; k++) {
        const ang = (k * 2 * Math.PI) / 12;
        const by = boltRingR * Math.cos(ang);
        const bz = boltRingR * Math.sin(ang);
        const washer = new THREE.Mesh(boltWasherGeom, mats.bolt);
        washer.position.set(xB0 + 0.071, by, bz);
        const head = new THREE.Mesh(boltHeadGeom, mats.bolt);
        head.position.set(xB0 + 0.098, by, bz);
        head.rotation.x = ang;
        ringBodyGroup.add(washer, head);
      }

      // Carrier Tapered Roller Bearing (oriented along +X)
      const ringBearing = this._createTaperedRollerBearing(THREE, {
        rIn: rJournal,
        rOut: rJournal + 0.15,
        width: 0.21,
        numRollers: 16,
        coneAngleDeg: 13,
        mats
      });
      const ringInnerMount = new THREE.Group();
      ringInnerMount.position.set(xB0 + 0.46, 0, 0);
      ringInnerMount.rotation.y = Math.PI / 2;
      ringInnerMount.add(ringBearing.innerGroup);
      ringBodyGroup.add(ringInnerMount);

      ringBodyGroup.visible = this.showBodies;
      this.ringGearGroup.add(ringBodyGroup);
      this._bodyNodes.push(ringBodyGroup);

      // Stationary & 0.5x cage mount for Carrier Bearing
      this.ringStaticGroup = new THREE.Group();
      this.ringStaticGroup.position.set(xB0 + 0.46, 0, 0);
      this.ringStaticGroup.rotation.y = Math.PI / 2;
      this.ringCarrierCageGroup = ringBearing.cageGroup;
      this.ringStaticGroup.add(this.ringCarrierCageGroup, ringBearing.outerGroup);
      this.ringStaticGroup.visible = this.showBodies;
      this._bodyNodes.push(this.ringStaticGroup);
      this.app.scene.add(this.ringStaticGroup);

      // --- 2. PINION BLANK, SPLINES, BEARING, COMPANION FLANGE & RETAINING NUT ---
      const pinionBodyGroup = new THREE.Group();
      pinionBodyGroup.add(new THREE.Mesh(pair.pinionBodyGeometry, mats.pinionBlank));

      // 14 Longitudinal Shaft Splines
      const splineLen = 0.40;
      const splineGeom = new THREE.BoxGeometry(0.020, 0.024, splineLen);
      this._bodyGeomDisposables.push(splineGeom);
      for (let k = 0; k < 14; k++) {
        const ang = (k * 2 * Math.PI) / 14;
        const sp = new THREE.Mesh(splineGeom, mats.pinionBlank);
        sp.position.set(m.pSplineR * Math.cos(ang), m.pSplineR * Math.sin(ang), m.pHeelZ + 0.67);
        sp.rotation.z = ang;
        pinionBodyGroup.add(sp);
      }

      // 4-Bolt Companion Flange / Yoke
      const flangeR = Math.max(m.pShaftR * 2.05, 0.34);
      const flangePts = [
        new THREE.Vector2(m.pSplineR, m.pHeelZ + 0.77),
        new THREE.Vector2(m.pSplineR + 0.07, m.pHeelZ + 0.77),
        new THREE.Vector2(m.pSplineR + 0.085, m.pHeelZ + 0.89),
        new THREE.Vector2(flangeR - 0.015, m.pHeelZ + 0.90),
        new THREE.Vector2(flangeR, m.pHeelZ + 0.915),
        new THREE.Vector2(flangeR, m.pHeelZ + 0.975),
        new THREE.Vector2(flangeR - 0.015, m.pHeelZ + 0.99),
        new THREE.Vector2(m.pSplineR + 0.04, m.pHeelZ + 0.99),
        new THREE.Vector2(m.pThreadR, m.pHeelZ + 0.99),
        new THREE.Vector2(m.pThreadR, m.pHeelZ + 0.77)
      ];
      const flangeGeom = new THREE.LatheGeometry(flangePts, 48);
      flangeGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(flangeGeom);
      pinionBodyGroup.add(new THREE.Mesh(flangeGeom, mats.flange));

      const fBoltGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.055, 6);
      fBoltGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(fBoltGeom);
      const fBoltR = flangeR * 0.74;
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2 + Math.PI / 4;
        const fb = new THREE.Mesh(fBoltGeom, mats.bolt);
        fb.position.set(fBoltR * Math.cos(ang), fBoltR * Math.sin(ang), m.pHeelZ + 1.01);
        pinionBodyGroup.add(fb);
      }

      // Pinion Retaining Hex Nut & Heavy Washer
      const nutWasherGeom = new THREE.CylinderGeometry(m.pThreadR * 1.65, m.pThreadR * 1.65, 0.018, 24);
      const nutGeom = new THREE.CylinderGeometry(m.pThreadR * 1.48, m.pThreadR * 1.48, 0.068, 6);
      nutWasherGeom.rotateX(Math.PI / 2);
      nutGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(nutWasherGeom, nutGeom);

      const nutWasher = new THREE.Mesh(nutWasherGeom, mats.bolt);
      nutWasher.position.z = m.pHeelZ + 1.00;
      const nut = new THREE.Mesh(nutGeom, mats.bolt);
      nut.position.z = m.pHeelZ + 1.045;
      pinionBodyGroup.add(nutWasher, nut);

      // Pinion Head Tapered Roller Bearing
      const pinionBearing = this._createTaperedRollerBearing(THREE, {
        rIn: m.pJournalR,
        rOut: m.pJournalR + 0.135,
        width: 0.22,
        numRollers: 14,
        coneAngleDeg: 14,
        mats
      });
      pinionBearing.innerGroup.position.z = m.pHeelZ + 0.24;
      pinionBodyGroup.add(pinionBearing.innerGroup);

      pinionBodyGroup.visible = this.showBodies;
      this.pinionGroup.add(pinionBodyGroup);
      this._bodyNodes.push(pinionBodyGroup);

      const pinionStaticBearing = new THREE.Group();
      pinionStaticBearing.position.z = m.pHeelZ + 0.24;
      this.pinionCageGroup = pinionBearing.cageGroup;
      pinionStaticBearing.add(this.pinionCageGroup, pinionBearing.outerGroup);
      pinionStaticBearing.visible = this.showBodies;
      this._bodyNodes.push(pinionStaticBearing);
      this.pinionMountGroup.add(pinionStaticBearing);
    }
}

globalThis.Gears = Gears;
window.Gears = Gears;
if (typeof module !== "undefined" && module.exports) module.exports = Gears;
