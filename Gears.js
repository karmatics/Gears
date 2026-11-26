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
          this.buildInto = this.buildIntoInstance.bind(this);

          this.gearParams = {
            pinionTeeth: 11,
            ringTeeth: 34,
            offset: 0.42,
            shaftAngleDeg: 90,
            pressureAngleDeg: 23,
            profileShift: 0.30
          };

          this.showBodies = true;
          this.renderMode = 'machined';
          this.envMode = 'venice';
          this.showEnvBackdrop = false;
          this.showDiffWireframe = false;
          this.showCarWireframe = false;
          this.showAxesOverlay = false;
          this.showNormalsOverlay = false;
          this.carAsset = null;

          this.matSettings = {
            preset: 'steel_bronze',
            ringColor: '#cbd5e1',
            pinionColor: '#d9a85c',
            metalness: 0.88,
            roughness: 0.20,
            envIntensity: 1.25
          };

          this.pinionMountGroup = null;
          this.pinionGroup = null;
          this.ringGearGroup = null;
          this.ringStaticGroup = null;
          this.ringCarrierCageGroup = null;
          this.pinionCageGroup = null;
          this.debugOverlayGroup = null;
          this.diffWireGroup = null;
          this.carWireGroup = null;
          this.carWheelL = null;
          this.carWheelR = null;
          this.carDriveshaft = null;

          this.pinionToothGeometry = null;
          this.ringToothGeometry = null;
          this.ringIsoGeometry = null;
          this.pinionIsoGeometry = null;
          this.ringDiagGeometry = null;
          this.pinionDiagGeometry = null;
          this.ringNormalNeedles = null;
          this.pinionNormalNeedles = null;
          this.pinionBodyGeometry = null;
          this.ringBodyGeometry = null;
          this.ringBodyWireGeometry = null;
          this.pinionBodyWireGeometry = null;

          this.pinionMaterial = null;
          this.ringMaterial = null;
          this.diagPatchMaterial = null;
          this.ringToothMeshes = [];
          this.pinionToothMeshes = [];
          this._isoToothNodes = [];
          this._isoBodyNodes = [];
          this._normalNodes = [];
          this._bodyMeshMaterials = [];

          this._bodyNodes = [];
          this._bodyGeomDisposables = [];
          this._bodyMatDisposables = [];
          this._carDisposables = [];

          this._studioEnvRT = null;
          this._studioEnvMap = null;
          this._zebraEnvRT = null;
          this._zebraEnvMap = null;
          this._veniceEnvMap = null;
          this._veniceRequested = false;
          this._machinedBumpMap = null;
          this._machinedRoughMap = null;

          this.pinionTeeth = 11;
          this.ringTeeth = 34;
          this.gearAngle = 0;
          this.angularSpeed = 0.35;
          this.isPaused = false;
          this._lastTime = 0;
          this._hypoidLights = [];
          this._hudPanel = null;
          this._telemetryEl = null;
          this._meshFocus = { x: 0.53, y: -0.35, z: 1.32 };
          this._lastPairData = null;
          this._rebuildTimer = null;
        }
  _buildPrimitives() {
        const THREE = this.app.THREE;
        const scene = this.app.scene;

        this._buildStudioEnvironments();
        this._createMachinedMetalMaps(THREE);
        this._setEnvironmentMode(this.envMode);

        const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        keyLight.position.set(4, 6, 5);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.72);
        fillLight.position.set(-5, 2, 4);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xfde68a, 0.65);
        rimLight.position.set(0, -4, -5);
        scene.add(rimLight);

        this._hypoidLights.push(keyLight, fillLight, rimLight);

        if (typeof DropInAsset !== 'undefined' && !this.carAsset) {
          this.carAsset = new DropInAsset(this.app, {
            name: 'Car Model',
            targetLength: 41.6,
            groundY: -3.7,
            rearAxleFraction: 0.21,
            revealCenter: { x: 0.25, y: -0.15, z: 0.25 },
            defaultCutawayRadius: 3.8,
            onLoad: () => {
              if (this.carWireGroup) this.carWireGroup.visible = false;
              this.carAsset.frameCamera();
            },
            onClear: () => {
              if (this.carWireGroup) this.carWireGroup.visible = this.showCarWireframe;
            }
          });
          if (this.rootElement) {
            this.carAsset.bindDropTarget(this.rootElement);
          }
        }

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
          if (this.env && this.env.hideUi) return;

          const scheduleRebuild = () => {
            if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
            this._rebuildTimer = setTimeout(() => {
              this._rebuildTimer = null;
              this._rebuildGears();
            }, 25);
          };

          const btnStyle = {
            padding: '4px 6px',
            fontSize: '10.5px',
            fontFamily: 'monospace',
            background: '#161b22',
            color: '#e2e8f0',
            border: '1px solid #30363d',
            borderRadius: '4px',
            cursor: 'pointer'
          };

          const makeSection = (title, openInitially, children) => {
            const content = makeElement('div', {
              style: { display: openInitially ? 'flex' : 'none', flexDirection: 'column', gap: '5px', padding: '5px', background: '#0d1117', borderRadius: '4px', border: '1px solid #263042' }
            }, children);
            let open = openInitially;
            const hdr = makeElement('button', {
              style: { ...btnStyle, width: '100%', textAlign: 'left', background: '#161f2e', color: '#93c5fd', fontWeight: 'bold', fontSize: '10px' },
              onclick: () => {
                open = !open;
                content.style.display = open ? 'flex' : 'none';
                hdr.textContent = (open ? '▾ ' : '▸ ') + title;
              }
            }, (open ? '▾ ' : '▸ ') + title);
            return makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } }, [hdr, content]);
          };

          const makeChk = (id, label, initial, onChange) => {
            const chk = makeElement('input', { type: 'checkbox', id, checked: initial });
            chk.onchange = () => onChange(chk.checked);
            const lbl = makeElement('label', { htmlFor: id, style: { fontSize: '10.5px', fontFamily: 'monospace', color: '#cbd5e1', cursor: 'pointer' } }, label);
            return {
              chk,
              row: makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [chk, lbl])
            };
          };

          const bodyEl = makeElement('div', {
            style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '5px' }
          });

          let collapsed = false;
          const btnCollapse = makeElement('button', {
            style: { ...btnStyle, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c2431', fontWeight: 'bold', fontSize: '11px' },
            onclick: () => {
              collapsed = !collapsed;
              bodyEl.style.display = collapsed ? 'none' : 'flex';
              btnCollapse.textContent = collapsed ? '⚙ Hypoid Controls ▸' : '⚙ Hypoid Controls ▾';
            }
          }, '⚙ Hypoid Controls ▾');

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
              if (this.carWheelL) this.carWheelL.rotation.x = this.gearAngle;
              if (this.carWheelR) this.carWheelR.rotation.x = this.gearAngle;
              if (this.carDriveshaft) this.carDriveshaft.rotation.z = pinionAngle;
            }
          }, '+5°');

          const speedValEl = makeElement('span', { style: { fontSize: '10px', fontFamily: 'monospace', color: '#38bdf8' } }, this.angularSpeed.toFixed(2) + ' rad/s');
          const speedInput = makeElement('input', {
            type: 'range', min: '0', max: '1.50', step: '0.01', value: String(this.angularSpeed), style: { width: '100%', cursor: 'pointer' },
            oninput: (e) => {
              this.angularSpeed = parseFloat(e.target.value);
              speedValEl.textContent = this.angularSpeed.toFixed(2) + ' rad/s';
            }
          });

          const sliderRefs = [];
          const makeParamRow = (label, key, min, max, step, formatFn) => {
            const valEl = makeElement('span', { style: { color: '#fbbf24', fontFamily: 'monospace', fontSize: '10px' } }, formatFn(this.gearParams[key]));
            const input = makeElement('input', {
              type: 'range', min: String(min), max: String(max), step: String(step), value: String(this.gearParams[key]), style: { width: '100%', cursor: 'pointer' },
              oninput: (e) => {
                const val = parseFloat(e.target.value);
                this.gearParams[key] = val;
                valEl.textContent = formatFn(val);
                scheduleRebuild();
              }
            });
            sliderRefs.push({ key, input, valEl, formatFn });
            return makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
              makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
                makeElement('span', { style: { color: '#94a3b8' } }, label), valEl
              ]),
              input
            ]);
          };

          const modes = [
            { id: 'machined', label: 'Machined' },
            { id: 'isomesh', label: 'Iso-Mesh' },
            { id: 'xray', label: 'X-Ray' },
            { id: 'zebra', label: 'Zebra' },
            { id: 'patches', label: 'Patches' }
          ];
          const modeBtns = {};
          const syncModeBtns = () => {
            for (const m of modes) {
              const on = this.renderMode === m.id;
              modeBtns[m.id].style.background = on ? '#1d4ed8' : '#161b22';
              modeBtns[m.id].style.borderColor = on ? '#60a5fa' : '#30363d';
              modeBtns[m.id].style.color = on ? '#ffffff' : '#94a3b8';
            }
          };
          const modeRow = makeElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } }, modes.map((m) => {
            const b = makeElement('button', {
              style: { ...btnStyle, fontSize: '9.5px', padding: '3px 5px', flex: '1 1 30%' },
              onclick: () => {
                this.renderMode = m.id;
                syncModeBtns();
                this._applyMaterialStyle();
              }
            }, m.label);
            modeBtns[m.id] = b;
            return b;
          }));
          syncModeBtns();

          const presets = {
            steel_bronze: { label: 'Steel & Bronze', ring: '#cbd5e1', pinion: '#d9a85c', metal: 0.88, rough: 0.20 },
            cobalt_gold: { label: 'Cobalt & Gold', ring: '#3b82f6', pinion: '#f59e0b', metal: 0.90, rough: 0.16 },
            titanium_copper: { label: 'Titanium & Copper', ring: '#94a3b8', pinion: '#d97757', metal: 0.92, rough: 0.22 },
            crimson_gun: { label: 'Gunmetal & Crimson', ring: '#475569', pinion: '#e11d48', metal: 0.84, rough: 0.18 },
            emerald_brass: { label: 'Emerald & Brass', ring: '#10b981', pinion: '#eab308', metal: 0.86, rough: 0.18 },
            cad_clay: { label: 'CAD Clay', ring: '#e2e8f0', pinion: '#cbd5e1', metal: 0.08, rough: 0.55 }
          };

          const ringColInput = makeElement('input', { type: 'color', value: this.matSettings.ringColor, style: { width: '28px', height: '18px', border: 'none', background: 'none', cursor: 'pointer' } });
          const pinColInput = makeElement('input', { type: 'color', value: this.matSettings.pinionColor, style: { width: '28px', height: '18px', border: 'none', background: 'none', cursor: 'pointer' } });

          const makeMatSlider = (label, key, min, max, step) => {
            const valEl = makeElement('span', { style: { color: '#38bdf8', fontFamily: 'monospace', fontSize: '10px' } }, this.matSettings[key].toFixed(2));
            const inp = makeElement('input', {
              type: 'range', min: String(min), max: String(max), step: String(step), value: String(this.matSettings[key]), style: { width: '100%', cursor: 'pointer' },
              oninput: (e) => {
                this.matSettings[key] = parseFloat(e.target.value);
                valEl.textContent = this.matSettings[key].toFixed(2);
                this._applyMaterialStyle();
              }
            });
            return {
              inp, valEl,
              el: makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
                makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
                  makeElement('span', { style: { color: '#94a3b8' } }, label), valEl
                ]),
                inp
              ])
            };
          };

          const metalSl = makeMatSlider('Metalness', 'metalness', 0, 1, 0.02);
          const roughSl = makeMatSlider('Roughness', 'roughness', 0.03, 0.85, 0.02);
          const envSl = makeMatSlider('Env Intensity', 'envIntensity', 0, 2.5, 0.05);

          const presetSel = makeElement('select', {
            style: { ...btnStyle, width: '100%', fontSize: '10px' },
            onchange: (e) => {
              const p = presets[e.target.value];
              if (!p) return;
              this.matSettings.preset = e.target.value;
              this.matSettings.ringColor = p.ring;
              this.matSettings.pinionColor = p.pinion;
              this.matSettings.metalness = p.metal;
              this.matSettings.roughness = p.rough;
              ringColInput.value = p.ring;
              pinColInput.value = p.pinion;
              metalSl.inp.value = String(p.metal);
              metalSl.valEl.textContent = p.metal.toFixed(2);
              roughSl.inp.value = String(p.rough);
              roughSl.valEl.textContent = p.rough.toFixed(2);
              this._applyMaterialStyle();
            }
          }, Object.entries(presets).map(([k, v]) => makeElement('option', { value: k, selected: k === this.matSettings.preset }, v.label)));

          ringColInput.oninput = (e) => { this.matSettings.ringColor = e.target.value; this._applyMaterialStyle(); };
          pinColInput.oninput = (e) => { this.matSettings.pinionColor = e.target.value; this._applyMaterialStyle(); };

          const envSel = makeElement('select', {
            style: { ...btnStyle, width: '100%', fontSize: '10px' },
            onchange: (e) => this._setEnvironmentMode(e.target.value)
          }, [
            makeElement('option', { value: 'venice', selected: this.envMode === 'venice' }, 'Env: Venice Waterfront HDR'),
            makeElement('option', { value: 'studio', selected: this.envMode === 'studio' }, 'Env: Studio Softbox'),
            makeElement('option', { value: 'none', selected: this.envMode === 'none' }, 'Env: Lights Only')
          ]);

          const envBgRow = makeChk('chkEnvBg', 'Show HDR Backdrop', this.showEnvBackdrop, (v) => {
            this.showEnvBackdrop = v;
            this._setEnvironmentMode(this.envMode);
          }).row;

          const bodiesRow = makeChk('chkBodiesToggle', 'Show Mechanical Bodies', this.showBodies, (v) => {
            this.showBodies = v;
            for (const node of this._bodyNodes) node.visible = v;
          }).row;

          const diffWireRow = makeChk('chkDiffWire', 'Diff Housing Wireframe', this.showDiffWireframe, (v) => {
            this.showDiffWireframe = v;
            if (this.diffWireGroup) this.diffWireGroup.visible = v;
          }).row;

          const carChkObj = makeChk('chkCarWire', 'Wireframe Car Fallback', this.showCarWireframe, (v) => {
            this.showCarWireframe = v;
            if (this.carWireGroup) this.carWireGroup.visible = v;
          });

          const axesRow = makeChk('chkAxesOverlay', 'Axes, Offset (E) & Cones', this.showAxesOverlay, (v) => {
            this.showAxesOverlay = v;
            if (this.debugOverlayGroup) this.debugOverlayGroup.visible = v;
          }).row;

          const normRow = makeChk('chkNormOverlay', 'Tooth Normal Needles', this.showNormalsOverlay, (v) => {
            this.showNormalsOverlay = v;
            for (const n of this._normalNodes) n.visible = v;
          }).row;

          const applyGearPreset = (cfg) => {
            Object.assign(this.gearParams, cfg);
            for (const ref of sliderRefs) {
              ref.input.value = String(this.gearParams[ref.key]);
              ref.valEl.textContent = ref.formatFn(this.gearParams[ref.key]);
            }
            this._rebuildGears();
          };
          const devPresetsRow = makeElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } }, [
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', flex: '1 1 45%' }, onclick: () => applyGearPreset({ pinionTeeth: 10, ringTeeth: 26, offset: 0.32, shaftAngleDeg: 84, pressureAngleDeg: 22.5 }) }, 'Highway 84°'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', flex: '1 1 45%' }, onclick: () => applyGearPreset({ pinionTeeth: 7, ringTeeth: 41, offset: 0.48, shaftAngleDeg: 90, pressureAngleDeg: 24 }) }, 'Crawler 7:41'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', flex: '1 1 45%' }, onclick: () => applyGearPreset({ pinionTeeth: 9, ringTeeth: 35, offset: 0.46, shaftAngleDeg: 72, pressureAngleDeg: 23 }) }, 'Stress 72°'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', flex: '1 1 45%' }, onclick: () => applyGearPreset({ pinionTeeth: 9, ringTeeth: 35, offset: 0.46, shaftAngleDeg: 108, pressureAngleDeg: 23 }) }, 'Stress 108°')
          ]);

          this._telemetryEl = makeElement('pre', {
            style: { margin: '0', padding: '4px', fontSize: '9.5px', lineHeight: '1.35', fontFamily: 'monospace', color: '#a5f3fc', background: '#090d14', borderRadius: '3px', border: '1px solid #1e293b', whiteSpace: 'pre-wrap' }
          }, 'Ready');
          this._updateTelemetry();

          const btnMeshView = makeElement('button', {
            style: { ...btnStyle, flex: '1' },
            onclick: () => {
              if (!this.app?.camera || !this.app?.controls) return;
              const f = this._meshFocus || { x: 0.53, y: -0.35, z: 1.32 };
              this.app.camera.position.set(f.x + 1.15, f.y + 0.35, f.z + 1.15);
              this.app.controls.target.set(f.x, f.y, f.z);
              this.app.controls.update();
            }
          }, 'Mesh');

          const btnFullView = makeElement('button', {
            style: { ...btnStyle, flex: '1' },
            onclick: () => {
              if (!this.app?.camera || !this.app?.controls) return;
              this.app.camera.position.set(3.35, 1.70, 3.55);
              this.app.controls.target.set(0.45, -0.22, 0.55);
              this.app.controls.update();
            }
          }, 'Axle');

          const btnCarView = makeElement('button', {
            style: { ...btnStyle, flex: '1', color: '#38bdf8' },
            onclick: () => {
              if (!this.app?.camera || !this.app?.controls) return;
              if (this.carAsset?.hasModel()) {
                this.carAsset.setVisible(true);
                this.carAsset.frameCamera();
              } else {
                this.showCarWireframe = true;
                carChkObj.chk.checked = true;
                if (this.carWireGroup) this.carWireGroup.visible = true;
                this.app.camera.position.set(24, 13, 34);
                this.app.controls.target.set(0, 1.0, 12.0);
                this.app.controls.update();
              }
            }
          }, 'Car');

          const btnReset = makeElement('button', {
            style: { ...btnStyle, width: '100%', color: '#93c5fd' },
            onclick: () => applyGearPreset({ pinionTeeth: 11, ringTeeth: 34, offset: 0.42, shaftAngleDeg: 90, pressureAngleDeg: 23, profileShift: 0.30 })
          }, 'Reset Defaults');

          // AccuDraw CAD Lego Slice Controls
          const adReadout = makeElement('div', {
            style: { fontSize: '9.5px', fontFamily: 'monospace', color: '#00f2fe', textAlign: 'center', padding: '3px', background: '#090d14', border: '1px solid #1e293b', borderRadius: '3px' }
          }, 'DX: 0.000  DY: 0.000');
          const adControlsWrap = makeElement('div', { style: { display: 'none', flexDirection: 'column', gap: '4px' } });
          const adToolBtns = {};
          const syncAdToolBtns = () => {
            Object.entries(adToolBtns).forEach(([id, b]) => {
              const on = this._activeCadTool === id;
              b.style.background = on ? '#00f2fe' : '#161b22';
              b.style.color = on ? '#050811' : '#e2e8f0';
              b.style.fontWeight = on ? 'bold' : 'normal';
            });
          };
          const btnToggleAd = makeElement('button', {
            style: { ...btnStyle, width: '100%', color: '#00f2fe', borderColor: '#00f2fe55' },
            onclick: async () => {
              if (this._accuDrawSlice) {
                await this.toggleAccuDraw(false);
              } else {
                btnToggleAd.textContent = '⏳ Loading AccuDraw...';
                await this.toggleAccuDraw(true);
              }
            }
          }, '🧭 Load AccuDraw');

          this._accuDrawUiRefs = {
            readout: adReadout,
            syncToolBtns: syncAdToolBtns,
            onStateChange: (active) => {
              btnToggleAd.textContent = active ? '🧭 Unload AccuDraw' : '🧭 Load AccuDraw';
              adControlsWrap.style.display = active ? 'flex' : 'none';
              syncAdToolBtns();
            }
          };

          const adToolRow = makeElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } },
            [
              ['orbit', 'Orbit'],
              ['path', 'Line'],
              ['curve', 'Curve'],
              ['rectangle', 'Rect'],
              ['circle', 'Circle']
            ].map(([id, lbl]) => {
              const b = makeElement('button', {
                style: { ...btnStyle, flex: '1', fontSize: '9.5px', padding: '3px 4px' },
                onclick: () => this.setAccuDrawTool(id)
              }, lbl);
              adToolBtns[id] = b;
              return b;
            })
          );
          const adPlaneRow = makeElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } }, [
            ...['top', 'front', 'side', 'view'].map((p) =>
              makeElement('button', {
                style: { ...btnStyle, flex: '1', fontSize: '9.5px', padding: '2px 4px' },
                onclick: () => this._accuDrawSlice?.setPlane(p)
              }, p[0].toUpperCase())
            ),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', padding: '2px 5px' }, title: 'Toggle Rect/Polar [Space]', onclick: () => this._accuDrawSlice?.logic?.switchMode() }, 'Spc'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', padding: '2px 5px' }, title: 'Smart Lock [L]', onclick: () => this._accuDrawSlice?.logic?.handleSmartLock() }, 'L'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', padding: '2px 5px' }, title: 'Set Origin [G]', onclick: () => { const pt = this._accuDrawSlice?.adapter?.getLastWorldPoint(); if (pt) this._accuDrawSlice.setOrigin(pt); } }, 'G'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', padding: '2px 5px' }, title: 'Align to Surface Normal [Q]', onclick: () => this._accuDrawSlice?.adapter?.handleKeyDown?.({ key: 'q', preventDefault() {}, stopPropagation() {} }) }, 'Q'),
            makeElement('button', { style: { ...btnStyle, fontSize: '9.5px', padding: '2px 5px', color: '#f87171' }, title: 'Clear CAD strokes', onclick: () => this._accuDrawSlice?.clearElements() }, 'Clr')
          ]);
          adControlsWrap.append(adToolRow, adPlaneRow, adReadout);

          bodyEl.appendChild(bodiesRow);
          bodyEl.appendChild(makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '5px', background: '#0d1117', borderRadius: '4px', border: '1px solid #263042' } }, [
            makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
              makeElement('span', { style: { color: '#94a3b8' } }, 'Rotation Speed'), speedValEl
            ]),
            speedInput,
            makeElement('div', { style: { display: 'flex', gap: '4px', marginTop: '2px' } }, [btnPlay, btnStep])
          ]));

          bodyEl.appendChild(makeSection('AccuDraw CAD Overlay', false, [btnToggleAd, adControlsWrap]));

          if (this.carAsset) {
            bodyEl.appendChild(makeSection('Car GLB Drop-In & Reveal', true, [this.carAsset.buildUI()]));
          }

          bodyEl.appendChild(makeSection('Gear Geometry', false, [
            makeParamRow('Pinion Teeth', 'pinionTeeth', 7, 16, 1, (v) => `${Math.round(v)}`),
            makeParamRow('Ring Teeth', 'ringTeeth', 20, 44, 1, (v) => `${Math.round(v)}`),
            makeParamRow('Hypoid Offset', 'offset', 0.10, 0.54, 0.02, (v) => v.toFixed(2)),
            makeParamRow('Shaft Angle', 'shaftAngleDeg', 70, 110, 1, (v) => `${Math.round(v)}°`),
            makeParamRow('Pressure Angle', 'pressureAngleDeg', 18, 28, 0.5, (v) => `${v.toFixed(1)}°`)
          ]));

          bodyEl.appendChild(makeSection('Render, Materials & HDR', false, [
            modeRow,
            presetSel,
            makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' } }, [
              makeElement('span', {}, 'Ring'), ringColInput, makeElement('span', {}, 'Pinion'), pinColInput
            ]),
            metalSl.el,
            roughSl.el,
            envSl.el,
            envSel,
            envBgRow
          ]));

          bodyEl.appendChild(makeSection('Mechanism & Wireframe', false, [
            diffWireRow,
            carChkObj.row
          ]));

          bodyEl.appendChild(makeSection('Dev & Diagnostics', false, [
            axesRow,
            normRow,
            devPresetsRow,
            this._telemetryEl
          ]));

          bodyEl.appendChild(makeElement('div', { style: { display: 'flex', gap: '4px' } }, [btnMeshView, btnFullView, btnCarView]));
          bodyEl.appendChild(btnReset);

          const panel = makeElement('div', {
            style: {
              position: 'absolute', top: '12px', left: '12px', width: '264px', maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto', padding: '8px', background: 'rgba(13, 17, 23, 0.88)',
              border: '1px solid #30363d', borderRadius: '8px', zIndex: 20, color: '#e2e8f0'
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
        if (this.carWheelL) this.carWheelL.rotation.x = this.gearAngle;
        if (this.carWheelR) this.carWheelR.rotation.x = this.gearAngle;
        if (this.carDriveshaft) this.carDriveshaft.rotation.z = pinionAngle;
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

          if (this._accuDrawSlice) {
            try { this._accuDrawSlice.destroy(); } catch (e) {}
            this._accuDrawSlice = null;
          }
          this._accuDrawUiRefs = null;

          if (this._rebuildTimer) {
            clearTimeout(this._rebuildTimer);
            this._rebuildTimer = null;
          }

          if (this.carAsset) {
            try { this.carAsset.destroy(); } catch (e) {}
            this.carAsset = null;
          }

          if (this._hudPanel && this._hudPanel.parentElement) {
            this._hudPanel.parentElement.removeChild(this._hudPanel);
            this._hudPanel = null;
          }

          this._disposeGearObjects();

          if (this.rootGroup && this.rootGroup.parent) {
            this.rootGroup.parent.remove(this.rootGroup);
          }
          this.rootGroup = null;

          for (const k of ['pinionMaterial', 'ringMaterial', 'diagPatchMaterial']) {
            if (this[k]) {
              try { this[k].dispose(); } catch (e) {}
              this[k] = null;
            }
          }
          for (const k of ['_studioEnvRT', '_zebraEnvRT', '_machinedBumpMap', '_machinedRoughMap']) {
            if (this[k]) {
              try { this[k].dispose(); } catch (e) {}
              this[k] = null;
            }
          }
          this._studioEnvMap = null;
          this._zebraEnvMap = null;
          this._veniceEnvMap = null;
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
      if (this.debugOverlayGroup && scene) scene.remove(this.debugOverlayGroup);
      if (this.diffWireGroup && scene) scene.remove(this.diffWireGroup);
      if (this.carWireGroup && scene) scene.remove(this.carWireGroup);

      const geoms = [
        'pinionToothGeometry', 'ringToothGeometry',
        'ringIsoGeometry', 'pinionIsoGeometry',
        'ringDiagGeometry', 'pinionDiagGeometry',
        'ringNormalNeedles', 'pinionNormalNeedles',
        'pinionBodyGeometry', 'ringBodyGeometry',
        'ringBodyWireGeometry', 'pinionBodyWireGeometry'
      ];
      for (const k of geoms) {
        if (this[k]) {
          try { this[k].dispose(); } catch (e) {}
          this[k] = null;
        }
      }

      for (const g of this._bodyGeomDisposables) { try { g.dispose(); } catch (e) {} }
      this._bodyGeomDisposables = [];

      for (const m of this._bodyMatDisposables) { try { m.dispose(); } catch (e) {} }
      this._bodyMatDisposables = [];

      for (const d of this._carDisposables) { try { d.dispose(); } catch (e) {} }
      this._carDisposables = [];

      this._bodyNodes = [];
      this._isoToothNodes = [];
      this._isoBodyNodes = [];
      this._normalNodes = [];
      this._bodyMeshMaterials = [];
      this.ringToothMeshes = [];
      this.pinionToothMeshes = [];
      this.ringGearGroup = null;
      this.ringStaticGroup = null;
      this.pinionMountGroup = null;
      this.pinionGroup = null;
      this.ringCarrierCageGroup = null;
      this.pinionCageGroup = null;
      this.debugOverlayGroup = null;
      this.diffWireGroup = null;
      this.carWireGroup = null;
      this.carWheelL = null;
      this.carWheelR = null;
      this.carDriveshaft = null;
      this.meshes = [];
    }

  _rebuildGears() {
        if (!this.app || !this.app.scene) return;
        const THREE = this.app.THREE;
        const scene = this.app.scene;

        this._disposeGearObjects();

        const pair = HypoidGearGenerator.generatePair(THREE, this.gearParams);
        this._lastPairData = pair;
        this.pinionTeeth = pair.pinionTeeth;
        this.ringTeeth = pair.ringTeeth;
        this.pinionToothGeometry = pair.pinionToothGeometry;
        this.ringToothGeometry = pair.ringToothGeometry;
        this.ringIsoGeometry = pair.ringIsoGeometry;
        this.pinionIsoGeometry = pair.pinionIsoGeometry;
        this.ringDiagGeometry = pair.ringDiagGeometry;
        this.pinionDiagGeometry = pair.pinionDiagGeometry;
        this.ringNormalNeedles = pair.ringNormalNeedles;
        this.pinionNormalNeedles = pair.pinionNormalNeedles;
        this.pinionBodyGeometry = pair.pinionBodyGeometry;
        this.ringBodyGeometry = pair.ringBodyGeometry;
        this.ringBodyWireGeometry = pair.ringBodyWireGeometry;
        this.pinionBodyWireGeometry = pair.pinionBodyWireGeometry;
        this._meshFocus = pair.meshFocus;

        if (!this.ringMaterial) {
          this.ringMaterial = new THREE.MeshPhysicalMaterial({ color: this.matSettings.ringColor, metalness: 0.88, roughness: 0.20 });
        }
        if (!this.pinionMaterial) {
          this.pinionMaterial = new THREE.MeshPhysicalMaterial({ color: this.matSettings.pinionColor, metalness: 0.88, roughness: 0.20 });
        }
        if (!this.diagPatchMaterial) {
          this.diagPatchMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.36 });
        }

        const isoRingMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 });
        const isoPinMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.82 });
        const normMat = new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.90 });
        this._bodyMatDisposables.push(isoRingMat, isoPinMat, normMat);

        this.ringGearGroup = new THREE.Group();
        for (let k = 0; k < this.ringTeeth; k++) {
          const ang = (k * 2 * Math.PI) / this.ringTeeth;
          const tooth = new THREE.Mesh(this.ringToothGeometry, this.ringMaterial);
          tooth.rotation.x = ang;
          this.ringGearGroup.add(tooth);
          this.meshes.push(tooth);
          this.ringToothMeshes.push(tooth);

          const iso = new THREE.LineSegments(this.ringIsoGeometry, isoRingMat);
          iso.rotation.x = ang;
          iso.visible = false;
          this.ringGearGroup.add(iso);
          this._isoToothNodes.push(iso);

          if (k === 0 && this.ringNormalNeedles) {
            const nn = new THREE.LineSegments(this.ringNormalNeedles, normMat);
            nn.visible = this.showNormalsOverlay;
            this.ringGearGroup.add(nn);
            this._normalNodes.push(nn);
          }
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
          const ang = (k * 2 * Math.PI) / this.pinionTeeth;
          const tooth = new THREE.Mesh(this.pinionToothGeometry, this.pinionMaterial);
          tooth.rotation.z = ang;
          this.pinionGroup.add(tooth);
          this.meshes.push(tooth);
          this.pinionToothMeshes.push(tooth);

          const iso = new THREE.LineSegments(this.pinionIsoGeometry, isoPinMat);
          iso.rotation.z = ang;
          iso.visible = false;
          this.pinionGroup.add(iso);
          this._isoToothNodes.push(iso);

          if (k === 0 && this.pinionNormalNeedles) {
            const nn = new THREE.LineSegments(this.pinionNormalNeedles, normMat);
            nn.visible = this.showNormalsOverlay;
            this.pinionGroup.add(nn);
            this._normalNodes.push(nn);
          }
        }
        const pinionAngle = -(this.ringTeeth / this.pinionTeeth) * this.gearAngle;
        this.pinionGroup.rotation.z = pinionAngle;
        this.pinionMountGroup.add(this.pinionGroup);
        scene.add(this.pinionMountGroup);

        this._buildDifferentialBodies(THREE, pair);
        this._buildDebugOverlays(THREE, pair);
        this._buildCarWireframe(THREE, pair);

        if (this.carAsset) {
          this.carAsset.setRevealCenter(
            pair.meshFocus.x * 0.45,
            -pair.offset * 0.45,
            pair.meshFocus.z * 0.25
          );
          this.carAsset.setFallbackMovieGroup(this.carWireGroup);
        }

        if (this.ringCarrierCageGroup) this.ringCarrierCageGroup.rotation.z = 0.5 * this.gearAngle;
        if (this.pinionCageGroup) this.pinionCageGroup.rotation.z = 0.5 * pinionAngle;
        if (this.carWheelL) this.carWheelL.rotation.x = this.gearAngle;
        if (this.carWheelR) this.carWheelR.rotation.x = this.gearAngle;
        if (this.carDriveshaft) this.carDriveshaft.rotation.z = pinionAngle;

        this._applyMaterialStyle();
        this._updateTelemetry();
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
      const innerCorners = [
        { r: rIn, y: -width * 0.5, fillet: 0.008, segs: 4 },
        { r: rTrackFront + rollerAvgR * 0.35, y: -width * 0.5, fillet: 0.006, segs: 4 },
        { r: rTrackFront + rollerAvgR * 0.35, y: -width * 0.42, fillet: 0.005, segs: 4 },
        { r: rTrackFront, y: -rollerHalfLen, fillet: 0.006, segs: 4 },
        { r: rTrackBack, y: rollerHalfLen, fillet: 0.006, segs: 4 },
        { r: rTrackBack + rollerAvgR * 0.48, y: rollerHalfLen + 0.015, fillet: 0.005, segs: 4 },
        { r: rTrackBack + rollerAvgR * 0.48, y: width * 0.5, fillet: 0.008, segs: 4 },
        { r: rIn, y: width * 0.5, fillet: 0.008, segs: 4 }
      ];
      const innerGeom = HypoidGearGenerator.createFilletedLathe(THREE, innerCorners, 64);
      innerGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(innerGeom);
      innerGroup.add(new THREE.Mesh(innerGeom, mats.race));

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
      const tiltQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rollerAxis);

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

      const rCupFront = rMid + rollerAvgR * 0.92 - Math.sin(coneAng) * rollerHalfLen * 0.55;
      const rCupBack = rMid + rollerAvgR * 0.92 + Math.sin(coneAng) * rollerHalfLen;
      const outerCorners = [
        { r: rCupFront, y: -width * 0.14, fillet: 0.006, segs: 4 },
        { r: rOut, y: -width * 0.14, fillet: 0.010, segs: 5 },
        { r: rOut, y: width * 0.5, fillet: 0.010, segs: 5 },
        { r: rCupBack + 0.015, y: width * 0.5, fillet: 0.006, segs: 4 },
        { r: rCupBack, y: rollerHalfLen, fillet: 0.006, segs: 4 }
      ];
      const outerGeom = HypoidGearGenerator.createFilletedLathe(THREE, outerCorners, 64);
      outerGeom.rotateX(Math.PI / 2);
      this._bodyGeomDisposables.push(outerGeom);
      outerGroup.add(new THREE.Mesh(outerGeom, mats.race));

      return { innerGroup, cageGroup, outerGroup };
    }

  _buildDifferentialBodies(THREE, pair) {
      const m = pair.mechanics;
      const regMat = (colorHex, metalness, roughness, isAccent = false) => {
        const mat = new THREE.MeshPhysicalMaterial({ color: colorHex, metalness, roughness, clearcoat: 0.16 });
        this._bodyMatDisposables.push(mat);
        this._bodyMeshMaterials.push({ mat, baseColor: colorHex, baseMetal: metalness, baseRough: roughness, isAccent });
        return mat;
      };

      const mats = {
        ringBlank: regMat(0x475569, 0.86, 0.28),
        carrier: regMat(0x334155, 0.72, 0.42),
        pinionBlank: regMat(0x8a6a38, 0.84, 0.26, true),
        flange: regMat(0x3f4a5a, 0.82, 0.32),
        bolt: regMat(0xd1d5db, 0.92, 0.18),
        race: regMat(0xe2e8f0, 0.94, 0.14),
        roller: regMat(0xf8fafc, 0.98, 0.07),
        brass: regMat(0xc28e42, 0.88, 0.24, true)
      };

      const wireMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 });
      this._bodyMatDisposables.push(wireMat);

      // 1. Ring Gear Blank, Carrier Case, 12 Bolts & Carrier Bearing
      const ringBodyGroup = new THREE.Group();
      ringBodyGroup.add(new THREE.Mesh(pair.ringBodyGeometry, mats.ringBlank));
      if (pair.ringBodyWireGeometry) {
        const rw = new THREE.LineSegments(pair.ringBodyWireGeometry, wireMat);
        rw.visible = this.renderMode === 'isomesh' || this.renderMode === 'xray';
        ringBodyGroup.add(rw);
        this._isoBodyNodes.push(rw);
      }

      const rFlangeOut = m.ringBoreR + 0.19;
      const rBarrel = m.ringBoreR * 0.78;
      const rJournal = Math.max(0.24, m.ringBoreR * 0.42);
      const xB0 = m.ringBackX;
      const carrierCorners = [
        { r: rJournal * 0.72, y: xB0 + 0.02, fillet: 0.010, segs: 4 },
        { r: rFlangeOut, y: xB0, fillet: 0.014, segs: 5 },
        { r: rFlangeOut, y: xB0 + 0.065, fillet: 0.012, segs: 5 },
        { r: rBarrel, y: xB0 + 0.095, fillet: 0.022, segs: 6 },
        { r: rBarrel, y: xB0 + 0.24, fillet: 0.024, segs: 6 },
        { r: rBarrel * 0.84, y: xB0 + 0.28, fillet: 0.016, segs: 5 },
        { r: rJournal + 0.04, y: xB0 + 0.34, fillet: 0.012, segs: 5 },
        { r: rJournal, y: xB0 + 0.35, fillet: 0.012, segs: 5 },
        { r: rJournal, y: xB0 + 0.60, fillet: 0.010, segs: 4 },
        { r: rJournal * 0.72, y: xB0 + 0.60, fillet: 0.008, segs: 4 }
      ];
      const carrierGeom = HypoidGearGenerator.createFilletedLathe(THREE, carrierCorners, 72);
      carrierGeom.rotateZ(-Math.PI / 2);
      const carrierWireGeom = HypoidGearGenerator.buildLatheWireframe(THREE, carrierCorners, 20, 48);
      carrierWireGeom.rotateZ(-Math.PI / 2);
      this._bodyGeomDisposables.push(carrierGeom, carrierWireGeom);
      ringBodyGroup.add(new THREE.Mesh(carrierGeom, mats.carrier));
      const cw = new THREE.LineSegments(carrierWireGeom, wireMat);
      cw.visible = this.renderMode === 'isomesh' || this.renderMode === 'xray';
      ringBodyGroup.add(cw);
      this._isoBodyNodes.push(cw);

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

      const ringBearing = this._createTaperedRollerBearing(THREE, {
        rIn: rJournal, rOut: rJournal + 0.15, width: 0.21, numRollers: 16, coneAngleDeg: 13, mats
      });
      const ringInnerMount = new THREE.Group();
      ringInnerMount.position.set(xB0 + 0.46, 0, 0);
      ringInnerMount.rotation.y = Math.PI / 2;
      ringInnerMount.add(ringBearing.innerGroup);
      ringBodyGroup.add(ringInnerMount);

      ringBodyGroup.visible = this.showBodies;
      this.ringGearGroup.add(ringBodyGroup);
      this._bodyNodes.push(ringBodyGroup);

      this.ringStaticGroup = new THREE.Group();
      this.ringStaticGroup.position.set(xB0 + 0.46, 0, 0);
      this.ringStaticGroup.rotation.y = Math.PI / 2;
      this.ringCarrierCageGroup = ringBearing.cageGroup;
      this.ringStaticGroup.add(this.ringCarrierCageGroup, ringBearing.outerGroup);
      this.ringStaticGroup.visible = this.showBodies;
      this._bodyNodes.push(this.ringStaticGroup);
      this.app.scene.add(this.ringStaticGroup);

      // 2. Pinion Blank, Splines, Bearing, Companion Flange & Retaining Nut
      const pinionBodyGroup = new THREE.Group();
      pinionBodyGroup.add(new THREE.Mesh(pair.pinionBodyGeometry, mats.pinionBlank));
      if (pair.pinionBodyWireGeometry) {
        const pw = new THREE.LineSegments(pair.pinionBodyWireGeometry, wireMat);
        pw.visible = this.renderMode === 'isomesh' || this.renderMode === 'xray';
        pinionBodyGroup.add(pw);
        this._isoBodyNodes.push(pw);
      }

      const splineGeom = new THREE.BoxGeometry(0.020, 0.024, 0.40);
      this._bodyGeomDisposables.push(splineGeom);
      for (let k = 0; k < 14; k++) {
        const ang = (k * 2 * Math.PI) / 14;
        const sp = new THREE.Mesh(splineGeom, mats.pinionBlank);
        sp.position.set(m.pSplineR * Math.cos(ang), m.pSplineR * Math.sin(ang), m.pHeelZ + 0.67);
        sp.rotation.z = ang;
        pinionBodyGroup.add(sp);
      }

      const flangeR = Math.max(m.pShaftR * 2.05, 0.34);
      const flangeCorners = [
        { r: m.pSplineR, y: m.pHeelZ + 0.77, fillet: 0.008, segs: 4 },
        { r: m.pSplineR + 0.07, y: m.pHeelZ + 0.77, fillet: 0.014, segs: 5 },
        { r: m.pSplineR + 0.085, y: m.pHeelZ + 0.89, fillet: 0.018, segs: 5 },
        { r: flangeR, y: m.pHeelZ + 0.90, fillet: 0.014, segs: 5 },
        { r: flangeR, y: m.pHeelZ + 0.99, fillet: 0.014, segs: 5 },
        { r: m.pThreadR, y: m.pHeelZ + 0.99, fillet: 0.006, segs: 4 },
        { r: m.pThreadR, y: m.pHeelZ + 0.77, fillet: 0 }
      ];
      const flangeGeom = HypoidGearGenerator.createFilletedLathe(THREE, flangeCorners, 72);
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

      const pinionBearing = this._createTaperedRollerBearing(THREE, {
        rIn: m.pJournalR, rOut: m.pJournalR + 0.135, width: 0.22, numRollers: 14, coneAngleDeg: 14, mats
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
  _buildStudioEnvironments() {
      const THREE = this.app.THREE;
      const renderer = this.app.renderer;
      if (!renderer || !THREE) return;

      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      // Procedural Studio Softbox Map
      const sCanvas = document.createElement('canvas');
      sCanvas.width = 512;
      sCanvas.height = 256;
      const sCtx = sCanvas.getContext('2d');
      const bgGrad = sCtx.createLinearGradient(0, 0, 0, 256);
      bgGrad.addColorStop(0.0, '#1e293b');
      bgGrad.addColorStop(0.45, '#0f172a');
      bgGrad.addColorStop(0.55, '#090d16');
      bgGrad.addColorStop(1.0, '#182234');
      sCtx.fillStyle = bgGrad;
      sCtx.fillRect(0, 0, 512, 256);

      const drawSoftbox = (x, y, w, h, innerCol, outerCol) => {
        const g = sCtx.createRadialGradient(x + w * 0.5, y + h * 0.5, 4, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.65);
        g.addColorStop(0, innerCol);
        g.addColorStop(1, outerCol);
        sCtx.fillStyle = g;
        sCtx.fillRect(x, y, w, h);
      };
      drawSoftbox(40, 20, 160, 70, 'rgba(255, 252, 244, 0.98)', 'rgba(255, 252, 244, 0)');
      drawSoftbox(290, 28, 170, 58, 'rgba(186, 220, 255, 0.85)', 'rgba(186, 220, 255, 0)');
      drawSoftbox(180, 165, 220, 55, 'rgba(253, 224, 155, 0.42)', 'rgba(253, 224, 155, 0)');
      sCtx.fillStyle = 'rgba(255, 255, 255, 0.90)';
      sCtx.fillRect(85, 50, 95, 14);
      sCtx.fillRect(340, 62, 110, 10);

      const studioTex = new THREE.CanvasTexture(sCanvas);
      studioTex.mapping = THREE.EquirectangularReflectionMapping;
      if ('SRGBColorSpace' in THREE) studioTex.colorSpace = THREE.SRGBColorSpace;
      this._studioEnvRT = pmrem.fromEquirectangular(studioTex);
      this._studioEnvMap = this._studioEnvRT.texture;
      studioTex.dispose();

      // CAD Zebra Surface Check Map
      const zCanvas = document.createElement('canvas');
      zCanvas.width = 512;
      zCanvas.height = 256;
      const zCtx = zCanvas.getContext('2d');
      const stripes = 28;
      const sw = zCanvas.width / stripes;
      for (let i = 0; i < stripes; i++) {
        zCtx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#05070b';
        zCtx.fillRect(i * sw, 0, sw + 0.5, zCanvas.height);
      }
      const zebraTex = new THREE.CanvasTexture(zCanvas);
      zebraTex.mapping = THREE.EquirectangularReflectionMapping;
      zebraTex.minFilter = THREE.LinearFilter;
      zebraTex.magFilter = THREE.LinearFilter;
      if ('SRGBColorSpace' in THREE) zebraTex.colorSpace = THREE.SRGBColorSpace;
      this._zebraEnvRT = pmrem.fromEquirectangular(zebraTex);
      this._zebraEnvMap = this._zebraEnvRT.texture;
      zebraTex.dispose();

      pmrem.dispose();
    }

  _createMachinedMetalMaps(THREE) {
      if (this._machinedBumpMap && this._machinedRoughMap) return;

      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y++) {
        const band = Math.sin(y * 1.45) * 14 + Math.sin(y * 0.37) * 9;
        const noise = ((y * 73) % 19) - 9;
        const val = Math.max(40, Math.min(220, Math.round(128 + band + noise)));
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(0, y, 256, 1);
      }
      const bump = new THREE.CanvasTexture(c);
      bump.wrapS = THREE.RepeatWrapping;
      bump.wrapT = THREE.RepeatWrapping;
      bump.repeat.set(2, 6);
      this._machinedBumpMap = bump;

      const rc = document.createElement('canvas');
      rc.width = 256;
      rc.height = 256;
      const rctx = rc.getContext('2d');
      for (let y = 0; y < 256; y++) {
        const delta = Math.round(Math.sin(y * 1.45) * 20 + (((y * 41) % 17) - 8));
        const v = Math.max(140, Math.min(245, 200 + delta));
        rctx.fillStyle = `rgb(${v},${v},${v})`;
        rctx.fillRect(0, y, 256, 1);
      }
      const rough = new THREE.CanvasTexture(rc);
      rough.wrapS = THREE.RepeatWrapping;
      rough.wrapT = THREE.RepeatWrapping;
      rough.repeat.set(2, 6);
      this._machinedRoughMap = rough;
    }
  async _setEnvironmentMode(mode) {
      const THREE = this.app?.THREE;
      const scene = this.app?.scene;
      if (!scene || !THREE) return;
      if (mode) this.envMode = mode;

      const effective = this.renderMode === 'zebra' ? 'zebra' : this.envMode;

      if (effective === 'zebra') {
        scene.environment = this._zebraEnvMap || this._studioEnvMap;
        scene.background = new THREE.Color(0x0b0f17);
        return;
      }

      if (effective === 'none') {
        scene.environment = null;
        scene.background = new THREE.Color(0x0b0f17);
        return;
      }

      if (effective === 'studio') {
        scene.environment = this._studioEnvMap;
        scene.background = new THREE.Color(0x0b0f17);
        return;
      }

      if (effective === 'venice') {
        if (!this._veniceEnvMap && !this._veniceRequested && typeof this.app.loadEnvironment === 'function') {
          this._veniceRequested = true;
          scene.environment = this._studioEnvMap;
          try {
            const loaded = await this.app.loadEnvironment('/assets/venice_sunset_1k.hdr');
            if (loaded) this._veniceEnvMap = loaded;
          } catch (e) {}
        }
        const chosen = this._veniceEnvMap || this._studioEnvMap;
        scene.environment = chosen;
        if (this.showEnvBackdrop && chosen) {
          scene.background = chosen;
          scene.backgroundBlurriness = 0.28;
        } else {
          scene.background = new THREE.Color(0x0b0f17);
        }
      }
    }

  _applyMaterialStyle() {
        if (!this.ringMaterial || !this.pinionMaterial || !this.app?.THREE) return;
        const THREE = this.app.THREE;
        const mode = this.renderMode;
        const s = this.matSettings;

        this._setEnvironmentMode(this.envMode);

        const useDiag = mode === 'patches';
        for (const m of this.ringToothMeshes) {
          m.geometry = useDiag && this.ringDiagGeometry ? this.ringDiagGeometry : this.ringToothGeometry;
          m.material = useDiag && this.diagPatchMaterial ? this.diagPatchMaterial : this.ringMaterial;
        }
        for (const m of this.pinionToothMeshes) {
          m.geometry = useDiag && this.pinionDiagGeometry ? this.pinionDiagGeometry : this.pinionToothGeometry;
          m.material = useDiag && this.diagPatchMaterial ? this.diagPatchMaterial : this.pinionMaterial;
        }

        const showIso = mode === 'isomesh' || mode === 'xray';
        for (const n of this._isoToothNodes) n.visible = showIso;
        for (const n of this._isoBodyNodes) n.visible = showIso;

        const configureToothMat = (mat, hexCol) => {
          mat.bumpMap = mode === 'machined' ? this._machinedBumpMap : null;
          mat.bumpScale = mode === 'machined' ? 0.0014 : 0;
          mat.roughnessMap = mode === 'machined' ? this._machinedRoughMap : null;

          if (mode === 'zebra') {
            mat.color.set(0xffffff);
            mat.metalness = 1.0;
            mat.roughness = 0.02;
            mat.clearcoat = 0.0;
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;
            mat.envMapIntensity = 1.6;
          } else if (mode === 'xray') {
            mat.color.set(hexCol);
            mat.metalness = 0.20;
            mat.roughness = 0.22;
            mat.clearcoat = 0.4;
            mat.transparent = true;
            mat.opacity = 0.28;
            mat.depthWrite = false;
            mat.envMapIntensity = 0.8;
          } else if (mode === 'isomesh') {
            mat.color.set(hexCol).lerp(new THREE.Color(0x0f172a), 0.55);
            mat.metalness = Math.min(0.45, s.metalness * 0.5);
            mat.roughness = Math.max(0.42, s.roughness);
            mat.clearcoat = 0.08;
            mat.transparent = true;
            mat.opacity = 0.90;
            mat.depthWrite = true;
            mat.envMapIntensity = s.envIntensity * 0.65;
          } else {
            mat.color.set(hexCol);
            mat.metalness = s.metalness;
            mat.roughness = s.roughness;
            mat.clearcoat = s.metalness > 0.4 ? 0.25 : 0.08;
            mat.clearcoatRoughness = Math.max(0.05, s.roughness * 0.75);
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;
            mat.envMapIntensity = s.envIntensity;
          }
          mat.needsUpdate = true;
        };

        configureToothMat(this.ringMaterial, s.ringColor);
        configureToothMat(this.pinionMaterial, s.pinionColor);

        for (const item of this._bodyMeshMaterials) {
          const m = item.mat;
          m.bumpMap = mode === 'machined' ? this._machinedBumpMap : null;
          m.bumpScale = mode === 'machined' ? 0.0018 : 0;
          if (mode === 'zebra') {
            m.color.set(0xffffff);
            m.metalness = 1.0;
            m.roughness = 0.02;
            m.transparent = false;
            m.opacity = 1.0;
            m.depthWrite = true;
            m.envMapIntensity = 1.6;
          } else if (mode === 'xray') {
            m.color.set(item.baseColor);
            m.metalness = 0.15;
            m.roughness = 0.3;
            m.transparent = true;
            m.opacity = 0.18;
            m.depthWrite = false;
            m.envMapIntensity = 0.6;
          } else if (mode === 'isomesh') {
            m.color.set(item.baseColor).lerp(new THREE.Color(0x0b1220), 0.55);
            m.metalness = 0.35;
            m.roughness = 0.55;
            m.transparent = true;
            m.opacity = 0.88;
            m.depthWrite = true;
            m.envMapIntensity = s.envIntensity * 0.5;
          } else {
            m.color.set(item.baseColor);
            m.metalness = item.isAccent ? Math.max(0.5, s.metalness) : Math.min(0.95, item.baseMetal * (0.4 + 0.6 * s.metalness));
            m.roughness = Math.max(0.04, item.baseRough * (0.5 + 1.5 * s.roughness));
            m.transparent = false;
            m.opacity = 1.0;
            m.depthWrite = true;
            m.envMapIntensity = s.envIntensity;
          }
          m.needsUpdate = true;
        }

        for (const n of this._normalNodes) n.visible = this.showNormalsOverlay;
        if (this.debugOverlayGroup) this.debugOverlayGroup.visible = this.showAxesOverlay;
        if (this.diffWireGroup) this.diffWireGroup.visible = this.showDiffWireframe;
        if (this.carWireGroup) {
          this.carWireGroup.visible = this.showCarWireframe && !(this.carAsset && this.carAsset.hasModel());
        }
      }
  _buildDebugOverlays(THREE, pair) {
      const d = pair.diagnostics;
      const g = new THREE.Group();

      const makeLine = (pts, color) => {
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92 });
        this._bodyGeomDisposables.push(geom);
        this._bodyMatDisposables.push(mat);
        return new THREE.Line(geom, mat);
      };

      // Ring Axis (X), Pinion Axis (uP at y=-E), and Offset E line
      g.add(makeLine([new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(2.2, 0, 0)], 0x38bdf8));
      const uP = pair.pinionBasis.uP;
      const eOff = pair.offset;
      g.add(makeLine([
        new THREE.Vector3(-uP.x * 0.4, -eOff, -uP.z * 0.4),
        new THREE.Vector3(uP.x * 3.1, -eOff, uP.z * 3.1)
      ], 0xfbbf24));
      g.add(makeLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -eOff, 0)], 0xf43f5e));

      const p0Geom = new THREE.SphereGeometry(0.045, 16, 16);
      const p0Mat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      this._bodyGeomDisposables.push(p0Geom);
      this._bodyMatDisposables.push(p0Mat);
      const p0Sphere = new THREE.Mesh(p0Geom, p0Mat);
      p0Sphere.position.set(pair.meshFocus.x, pair.meshFocus.y, pair.meshFocus.z);
      g.add(p0Sphere);

      // Wire pitch cone circles for ring & pinion
      const ringConeMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.45 });
      const pinConeMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.45 });
      this._bodyMatDisposables.push(ringConeMat, pinConeMat);

      const addWireCircleX = (xVal, rad, mat, target) => {
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          pts.push(new THREE.Vector3(xVal, rad * Math.cos(a), rad * Math.sin(a)));
        }
        const cg = new THREE.BufferGeometry().setFromPoints(pts);
        this._bodyGeomDisposables.push(cg);
        target.add(new THREE.Line(cg, mat));
      };
      addWireCircleX(d.xG0 + d.sToeG * d.gGx, d.rG0 + d.sToeG * d.gGr, ringConeMat, g);
      addWireCircleX(d.xG0 + d.sHeelG * d.gGx, d.rG0 + d.sHeelG * d.gGr, ringConeMat, g);

      const pConeGroup = new THREE.Group();
      pConeGroup.position.copy(this.pinionMountGroup.position);
      pConeGroup.quaternion.copy(this.pinionMountGroup.quaternion);
      const addWireCircleZ = (zVal, rad, mat, target) => {
        const pts = [];
        for (let i = 0; i <= 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          pts.push(new THREE.Vector3(rad * Math.cos(a), rad * Math.sin(a), zVal));
        }
        const cg = new THREE.BufferGeometry().setFromPoints(pts);
        this._bodyGeomDisposables.push(cg);
        target.add(new THREE.Line(cg, mat));
      };
      addWireCircleZ(d.zToe, d.rP0 + (d.zToe - d.zP0) * d.tanGammaP, pinConeMat, pConeGroup);
      addWireCircleZ(d.zHeel, d.rP0 + (d.zHeel - d.zP0) * d.tanGammaP, pinConeMat, pConeGroup);
      g.add(pConeGroup);

      g.visible = this.showAxesOverlay;
      this.debugOverlayGroup = g;
      this.app.scene.add(g);
    }

  _buildCarWireframe(THREE, pair) {
        const m = pair.mechanics;
        const scene = this.app.scene;
        const disposeList = this._carDisposables;

        const addSegments = (parent, segPairs, color, opacity = 0.55) => {
          const pos = [];
          for (const [a, b] of segPairs) pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
          disposeList.push(geom, mat);
          const ls = new THREE.LineSegments(geom, mat);
          parent.add(ls);
          return ls;
        };

        const addCircleSegs = (segPairs, cx, cy, cz, r, axis, steps = 28) => {
          for (let i = 0; i < steps; i++) {
            const a0 = (i / steps) * Math.PI * 2;
            const a1 = ((i + 1) / steps) * Math.PI * 2;
            if (axis === 'x') {
              segPairs.push([[cx, cy + r * Math.cos(a0), cz + r * Math.sin(a0)], [cx, cy + r * Math.cos(a1), cz + r * Math.sin(a1)]]);
            } else {
              segPairs.push([[cx + r * Math.cos(a0), cy + r * Math.sin(a0), cz], [cx + r * Math.cos(a1), cy + r * Math.sin(a1), cz]]);
            }
          }
        };

        const diffG = new THREE.Group();
        const dSegs = [];
        const pumpkinR = m.ringOuterR + 0.30;
        const pumpkinX = m.ringBackX * 0.45;
        addCircleSegs(dSegs, pumpkinX, 0, 0, pumpkinR, 'x', 36);
        addCircleSegs(dSegs, m.ringToeX - 0.16, 0, 0, pumpkinR * 0.82, 'x', 28);
        addCircleSegs(dSegs, m.ringBackX + 0.62, 0, 0, pumpkinR * 0.62, 'x', 28);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const c = Math.cos(a), s = Math.sin(a);
          dSegs.push([[m.ringToeX - 0.16, pumpkinR * 0.82 * c, pumpkinR * 0.82 * s], [pumpkinX, pumpkinR * c, pumpkinR * s]]);
          dSegs.push([[pumpkinX, pumpkinR * c, pumpkinR * s], [m.ringBackX + 0.62, pumpkinR * 0.62 * c, pumpkinR * 0.62 * s]]);
        }
        const tubeR = 0.24;
        addCircleSegs(dSegs, -7.8, 0, 0, tubeR, 'x', 18);
        addCircleSegs(dSegs, 7.8, 0, 0, tubeR, 'x', 18);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const c = Math.cos(a) * tubeR, s = Math.sin(a) * tubeR;
          dSegs.push([[-7.8, c, s], [m.ringToeX - 0.16, c, s]]);
          dSegs.push([[m.ringBackX + 0.62, c, s], [7.8, c, s]]);
        }
        addSegments(diffG, dSegs, 0x38bdf8, 0.48);

        const spSegs = [];
        const spX = m.ringBackX + 0.30;
        addCircleSegs(spSegs, spX - 0.22, 0, 0, 0.26, 'x', 16);
        addCircleSegs(spSegs, spX + 0.22, 0, 0, 0.26, 'x', 16);
        spSegs.push([[spX, -0.34, 0], [spX, 0.34, 0]]);
        spSegs.push([[-7.8, 0, 0], [spX - 0.22, 0, 0]]);
        spSegs.push([[spX + 0.22, 0, 0], [7.8, 0, 0]]);
        const spiderLines = addSegments(this.ringGearGroup, spSegs, 0xfbbf24, 0.45);
        this._isoBodyNodes.push(spiderLines);

        diffG.visible = this.showDiffWireframe;
        this.diffWireGroup = diffG;
        scene.add(diffG);

        const carG = new THREE.Group();
        const trackHalf = 8.4;
        const wheelR = 3.7;
        const frontZ = 28.0;
        const groundY = -wheelR;

        const makeWireWheel = (x, y, z) => {
          const wg = new THREE.Group();
          wg.position.set(x, y, z);
          const wSegs = [];
          const tireW = 1.3;
          addCircleSegs(wSegs, -tireW, 0, 0, wheelR, 'x', 32);
          addCircleSegs(wSegs, tireW, 0, 0, wheelR, 'x', 32);
          addCircleSegs(wSegs, -tireW, 0, 0, wheelR * 0.62, 'x', 20);
          addCircleSegs(wSegs, tireW, 0, 0, wheelR * 0.62, 'x', 20);
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            wSegs.push([[-tireW, wheelR * c, wheelR * s], [tireW, wheelR * c, wheelR * s]]);
            if (k % 2 === 0) wSegs.push([[0, 0, 0], [0, wheelR * c, wheelR * s]]);
          }
          addSegments(wg, wSegs, 0x94a3b8, 0.55);
          return wg;
        };

        this.carWheelL = makeWireWheel(-trackHalf, 0, 0);
        this.carWheelR = makeWireWheel(trackHalf, 0, 0);
        const wheelFL = makeWireWheel(-trackHalf, 0, frontZ);
        const wheelFR = makeWireWheel(trackHalf, 0, frontZ);
        carG.add(this.carWheelL, this.carWheelR, wheelFL, wheelFR);

        const dsG = new THREE.Group();
        const uP = pair.pinionBasis.uP;
        const flangeZ = m.pHeelZ + 1.02;
        const dsStart = [uP.x * flangeZ, -pair.offset, uP.z * flangeZ];
        const dsEnd = [0, -pair.offset * 0.5, 17.5];
        dsG.position.set(dsStart[0], dsStart[1], dsStart[2]);
        const dsVec = new THREE.Vector3(dsEnd[0] - dsStart[0], dsEnd[1] - dsStart[1], dsEnd[2] - dsStart[2]);
        const dsLen = dsVec.length();
        dsG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dsVec.clone().normalize());
        const dsSegs = [];
        const dsR = 0.26;
        addCircleSegs(dsSegs, 0, 0, 0.2, dsR, 'z', 14);
        addCircleSegs(dsSegs, 0, 0, dsLen * 0.5, dsR, 'z', 14);
        addCircleSegs(dsSegs, 0, 0, dsLen, dsR, 'z', 14);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          dsSegs.push([[dsR * Math.cos(a), dsR * Math.sin(a), 0.2], [dsR * Math.cos(a), dsR * Math.sin(a), dsLen]]);
        }
        addSegments(dsG, dsSegs, 0xfbbf24, 0.72);
        this.carDriveshaft = dsG;
        carG.add(dsG);

        const cSegs = [];
        cSegs.push([[-trackHalf, 0, frontZ], [trackHalf, 0, frontZ]]);
        const box = (x0, y0, z0, x1, y1, z1) => {
          cSegs.push(
            [[x0, y0, z0], [x1, y0, z0]], [[x1, y0, z0], [x1, y1, z0]], [[x1, y1, z0], [x0, y1, z0]], [[x0, y1, z0], [x0, y0, z0]],
            [[x0, y0, z1], [x1, y0, z1]], [[x1, y0, z1], [x1, y1, z1]], [[x1, y1, z1], [x0, y1, z1]], [[x0, y1, z1], [x0, y0, z1]],
            [[x0, y0, z0], [x0, y0, z1]], [[x1, y0, z0], [x1, y0, z1]], [[x1, y1, z0], [x1, y1, z1]], [[x0, y1, z0], [x0, y1, z1]]
          );
        };
        box(-1.3, -1.2, 17.5, 1.3, 1.4, 22.8);
        box(-2.4, -1.1, 23.0, 2.4, 3.0, 31.0);

        const bodyX = trackHalf + 0.6;
        const profilePts = [
          [groundY + 1.1, -6.2], [groundY + 5.8, -5.8], [groundY + 6.5, -2.0],
          [groundY + 9.4, 3.8], [groundY + 9.6, 12.8], [groundY + 6.4, 19.6],
          [groundY + 5.2, 33.2], [groundY + 3.6, 35.4], [groundY + 1.0, 35.0],
          [groundY + 1.0, 32.0], [groundY + 4.3, 30.8], [groundY + 4.3, 25.2],
          [groundY + 1.0, 24.0], [groundY + 1.0, 4.0], [groundY + 4.3, 2.8],
          [groundY + 4.3, -2.8], [groundY + 1.0, -4.0], [groundY + 1.1, -6.2]
        ];
        for (const sx of [-bodyX, bodyX]) {
          for (let i = 0; i < profilePts.length - 1; i++) {
            cSegs.push([
              [sx, profilePts[i][0], profilePts[i][1]],
              [sx, profilePts[i + 1][0], profilePts[i + 1][1]]
            ]);
          }
        }
        const crossIdx = [0, 1, 3, 4, 5, 6, 7, 8];
        for (const idx of crossIdx) {
          const py = profilePts[idx][0];
          const pz = profilePts[idx][1];
          const halfW = (idx === 3 || idx === 4) ? bodyX * 0.78 : bodyX;
          cSegs.push([[-halfW, py, pz], [halfW, py, pz]]);
        }
        const roofW = bodyX * 0.78;
        for (const signX of [-1, 1]) {
          cSegs.push(
            [[signX * bodyX, groundY + 6.5, -2.0], [signX * roofW, groundY + 9.4, 3.8]],
            [[signX * roofW, groundY + 9.4, 3.8], [signX * roofW, groundY + 9.6, 12.8]],
            [[signX * roofW, groundY + 9.6, 12.8], [signX * bodyX, groundY + 6.4, 19.6]]
          );
        }

        addSegments(carG, cSegs, 0x38bdf8, 0.34);

        carG.visible = this.showCarWireframe && !(this.carAsset && this.carAsset.hasModel());
        this.carWireGroup = carG;
        scene.add(carG);
      }
  _updateTelemetry() {
      if (!this._telemetryEl || !this._lastPairData) return;
      const p = this._lastPairData;
      const d = p.diagnostics;
      const ratio = (p.ringTeeth / p.pinionTeeth).toFixed(2);
      this._telemetryEl.textContent =
        `Ratio: ${ratio}:1 (${p.ringTeeth}/${p.pinionTeeth})\n` +
        `Cone γp/γg: ${d.gammaPDeg.toFixed(1)}° / ${d.gammaGDeg.toFixed(1)}°\n` +
        `Spiral ψp/ψg: ${d.psiPDeg.toFixed(1)}° / ${d.psiGDeg.toFixed(1)}°\n` +
        `Pinion s: [${d.sToeP.toFixed(2)}, ${d.sHeelP.toFixed(2)}]\n` +
        `Conj Valid: ${d.validPct.toFixed(1)}% | ${d.buildMs.toFixed(0)} ms`;
    }

  static buildInto(THREE, parentObj, opts = {}) {
        const g = new Gears();
        if (opts.gearParams) Object.assign(g.gearParams, opts.gearParams);
        if (opts.showBodies !== undefined) g.showBodies = Boolean(opts.showBodies);
        if (opts.renderMode) g.renderMode = opts.renderMode;
        if (opts.angularSpeed !== undefined) g.angularSpeed = opts.angularSpeed;
        return g.buildIntoInstance(THREE, parentObj, opts);
      }

  buildIntoInstance(THREE, parentObj, opts = {}) {
        const group = new THREE.Group();
        group.name = 'GearsRoot';
        if (opts.scale !== undefined) group.scale.setScalar(opts.scale);
        if (parentObj && group.parent !== parentObj) {
          parentObj.add(group);
        }
        let hasEnv = Boolean(opts.app?.environment);
        if (!hasEnv && parentObj) {
          let cur = parentObj;
          while (cur) {
            if (cur.isScene && cur.environment) { hasEnv = true; break; }
            cur = cur.parent;
          }
        }
        if (!hasEnv) {
          this.matSettings.metalness = 0.38;
          this.matSettings.roughness = 0.32;
        }
        this.rootGroup = group;
        this.app = opts.app || { THREE, scene: group };
        this._createMachinedMetalMaps(THREE);
        this._rebuildGears();
        group.userData.gearsInstance = this;
        return group;
      }
  stepAnimation(dt = 0.016) {
        if (this.isPaused || this.angularSpeed <= 0 || !this.ringGearGroup || !this.pinionGroup) return;
        const clampedDt = Math.min(0.05, Math.max(0, dt));
        this.gearAngle += this.angularSpeed * clampedDt;
        const pinionAngle = -(this.ringTeeth / this.pinionTeeth) * this.gearAngle;
        this.ringGearGroup.rotation.x = this.gearAngle;
        this.pinionGroup.rotation.z = pinionAngle;
        if (this.ringCarrierCageGroup) this.ringCarrierCageGroup.rotation.z = 0.5 * this.gearAngle;
        if (this.pinionCageGroup) this.pinionCageGroup.rotation.z = 0.5 * pinionAngle;
        if (this.carWheelL) this.carWheelL.rotation.x = this.gearAngle;
        if (this.carWheelR) this.carWheelR.rotation.x = this.gearAngle;
        if (this.carDriveshaft) this.carDriveshaft.rotation.z = pinionAngle;
      }

  async toggleAccuDraw(forceState = null) {
      if (!this.app || typeof this.app.loadAccuDraw !== 'function') return null;
      const wantOpen = forceState !== null ? Boolean(forceState) : !this._accuDrawSlice;
      if (!wantOpen) {
        if (this._accuDrawSlice) {
          try { this._accuDrawSlice.destroy(); } catch (e) {}
          this._accuDrawSlice = null;
        }
        this._cadToolsLoaded = false;
        this._activeCadTool = 'orbit';
        this._accuDrawUiVisible = false;
        if (this._accuDrawUiRefs?.onStateChange) this._accuDrawUiRefs.onStateChange(false);
        return null;
      }

      if (this._accuDrawSlice) return this._accuDrawSlice;

      const meshPt = this._meshFocus || { x: 0.53, y: -0.35, z: 1.32 };
      this._accuDrawSlice = await this.app.loadAccuDraw({
        size: 0.65,
        center: [meshPt.x, meshPt.y, meshPt.z],
        active: true,
        showUi: false,
        keyboard: true,
        snapping: true,
        viewMode: 'modifiers',
        wheelZoomMode: 'always',
        keyboardContainer: this.rootElement,
        extraContainers: this._hudPanel ? [this._hudPanel] : [],
        onActiveChange: (active) => {
          this._accuDrawUiRefs?.onStateChange?.(active);
        },
        onMotion: (delta, logic) => {
          const el = this._accuDrawUiRefs?.readout;
          if (!el || !delta) return;
          const locks = [];
          if (logic.isLocked?.x) locks.push('X');
          if (logic.isLocked?.y) locks.push('Y');
          if (logic.isLocked?.z) locks.push('Z');
          const tag = locks.length ? ` [${locks.join('+')}]` : '';
          if (logic.inputActive) {
            el.textContent = `${logic.currentAxis.toUpperCase()}: "${logic.inputBuffer}"${tag}`;
          } else if (logic.mode === 'polar') {
            el.textContent = `D:${delta.dist.toFixed(3)} ∠:${delta.angle.toFixed(1)}°${tag}`;
          } else {
            el.textContent = `DX:${delta.x.toFixed(3)} DY:${delta.y.toFixed(3)}${tag}`;
          }
        },
        onToolChange: (cmd) => {
          if (!cmd || !this._accuDrawSlice?.adapter?.commands) return;
          const match = Object.keys(this._accuDrawSlice.adapter.commands)
            .find((k) => this._accuDrawSlice.adapter.commands[k] === cmd);
          if (match) {
            this._activeCadTool = match;
            this._accuDrawUiRefs?.syncToolBtns?.();
          }
        }
      });

      await this.setAccuDrawTool('path');
      return this._accuDrawSlice;
    }
  async setAccuDrawTool(toolId) {
      if (toolId !== 'orbit' && !this._accuDrawSlice) {
        await this.toggleAccuDraw(true);
      }
      this._activeCadTool = toolId;
      if (this._accuDrawSlice) {
        await this._accuDrawSlice.setTool(toolId);
        if (toolId !== 'orbit') this._cadToolsLoaded = true;
      }
      this._accuDrawUiRefs?.syncToolBtns?.();
    }

  static buildWirePreview(THREE, opts = {}) {
      const scale = opts.scale !== undefined ? opts.scale : 0.35;
      const grp = new THREE.Group();
      grp.name = 'GearsWirePreview';
      grp.scale.setScalar(scale);

      const segs = [];
      const addCircleX = (x, r, steps = 32) => {
        for (let i = 0; i < steps; i++) {
          const a0 = (i / steps) * Math.PI * 2;
          const a1 = ((i + 1) / steps) * Math.PI * 2;
          segs.push(
            x, r * Math.cos(a0), r * Math.sin(a0),
            x, r * Math.cos(a1), r * Math.sin(a1)
          );
        }
      };
      const addCircleZ = (z, cy, r, steps = 24) => {
        for (let i = 0; i < steps; i++) {
          const a0 = (i / steps) * Math.PI * 2;
          const a1 = ((i + 1) / steps) * Math.PI * 2;
          segs.push(
            r * Math.cos(a0), cy + r * Math.sin(a0), z,
            r * Math.cos(a1), cy + r * Math.sin(a1), z
          );
        }
      };

      // Ring gear wireframe circles + bore + axes
      addCircleX(0.35, 1.38, 36);
      addCircleX(0.55, 1.48, 36);
      addCircleX(0.55, 0.72, 24);
      addCircleX(0.95, 0.42, 20);
      // Pinion pitch circles & shaft
      addCircleZ(1.22, -0.42, 0.38, 20);
      addCircleZ(1.62, -0.42, 0.54, 24);
      addCircleZ(2.45, -0.42, 0.22, 16);
      segs.push(-0.6, 0, 0, 1.4, 0, 0);
      segs.push(0, -0.42, 0.8, 0, -0.42, 2.7);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
      grp.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 })));
      return grp;
    }
}

globalThis.Gears = Gears;
window.Gears = Gears;
if (typeof module !== "undefined" && module.exports) module.exports = Gears;
