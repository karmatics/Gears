class DropInAsset {
  constructor(app, options = {}) {
    this.app = app;
    const THREE = app?.THREE || globalThis.THREE;
    this.THREE = THREE;

    this.options = Object.assign({
      name: 'Car Model',
      targetLength: 41.6,
      groundY: -3.7,
      rearAxleFraction: 0.21,
      revealCenter: { x: 0.2, y: -0.1, z: 0.2 },
      defaultCutawayRadius: 3.8,
      cutawaySoftness: 0.28,
      cutawayEdgeColor: 0x38bdf8,
      renderOrderBase: 10,
      autoStripGround: true,
      referenceBounds: null,
      fallbackMovieGroup: null,
      onLoad: null,
      onClear: null,
      onChange: null
    }, options);

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'DropInAssetRoot';

    this.assetRoot = new THREE.Group();
    this.alignGroup = new THREE.Group();
    this.contentGroup = new THREE.Group();
    this.alignGroup.add(this.contentGroup);

    this.prepassAlignGroup = new THREE.Group();
    this.prepassGroup = new THREE.Group();
    this.prepassAlignGroup.add(this.prepassGroup);

    this.assetRoot.add(this.alignGroup);
    this.assetRoot.add(this.prepassAlignGroup);
    this.rootGroup.add(this.assetRoot);

    this.fitGuideGroup = new THREE.Group();
    this.fitGuideGroup.visible = false;
    this.rootGroup.add(this.fitGuideGroup);

    if (this.app?.scene) {
      this.app.scene.add(this.rootGroup);
    }

    const rc = this.options.revealCenter;
    this._sharedUniforms = {
      uRevealCenter: { value: new THREE.Vector3(rc.x, rc.y, rc.z) },
      uRevealRadius: { value: this.options.defaultCutawayRadius },
      uRevealSoftness: { value: this.options.cutawaySoftness },
      uRevealMode: { value: 0.0 },
      uRevealEdgeColor: { value: new THREE.Color(this.options.cutawayEdgeColor) }
    };

    this._prepassMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    this._patchMaterialForReveal(this._prepassMaterial, true);

    this._loadedScene = null;
    this._loadedFileName = '';
    this._assetMeshes = [];
    this._assetMaterials = new Set();
    this._overrideMat = null;
    this._disposables = [];
    this._fitGuideDisposables = [];

    this._modelNorm = {
      autoScale: 1,
      center: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
      meshCount: 0,
      strippedCount: 0
    };

    this.state = {
      visible: true,
      revealMode: 'shell',
      opacity: 0.34,
      cutawayRadius: this.options.defaultCutawayRadius,
      stripGround: this.options.autoStripGround,
      showFitGuide: false,
      materialOverride: 'original',
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: 1
    };

    this._gltfLoader = null;
    this._dracoAttempted = false;
    this._dropOverlay = null;
    this._dropCleanup = null;
    this._movieActive = false;
    this._movieRaf = null;
    this._moviePrevDamping = null;
    this._movieCancelOnInteract = null;

    this._uiRefs = {};
    this._buildFitGuide();
  }

  _el(tag, attrs = {}, ...children) {
    if (typeof globalThis.makeElement === 'function') {
      return globalThis.makeElement(tag, attrs, ...children);
    }
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'className') el.className = v;
      else if (k === 'htmlFor') el.htmlFor = v;
      else if (k === 'textContent' || k === 'innerHTML') el[k] = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (typeof v === 'boolean') {
        if (v) el.setAttribute(k, '');
        else el.removeAttribute(k);
      } else if (v !== undefined && v !== null) {
        el.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat()) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c instanceof Node) el.appendChild(c);
    }
    return el;
  }

  hasModel() {
    return Boolean(this._loadedScene);
  }

  getFileName() {
    return this._loadedFileName;
  }

  setRevealCenter(x, y, z) {
    if (typeof x === 'object' && x !== null) {
      this._sharedUniforms.uRevealCenter.value.set(x.x || 0, x.y || 0, x.z || 0);
    } else {
      this._sharedUniforms.uRevealCenter.value.set(x || 0, y || 0, z || 0);
    }
    this._updateFitGuideLabels();
  }

  setFallbackMovieGroup(group) {
    this.options.fallbackMovieGroup = group || null;
  }

  async _ensureLoader() {
    if (this._gltfLoader) return this._gltfLoader;
    const THREE = this.THREE;
    let loader = null;

    if (this.app?.modules?.GLTFLoader) {
      loader = new this.app.modules.GLTFLoader();
    } else if (this.app?.loaders?.gltf) {
      loader = this.app.loaders.gltf;
    }

    if (loader && !this._dracoAttempted && typeof this.app?._fetchAndRewrite === 'function') {
      this._dracoAttempted = true;
      try {
        const CDN = 'https://cdn.jsdelivr.net/npm/three@0.153.0';
        const mod = await this.app._fetchAndRewrite(
          CDN + '/examples/jsm/loaders/DRACOLoader.js',
          CDN + '/build/three.module.js',
          1
        ).then((u) => import(u));
        if (mod?.DRACOLoader) {
          const draco = new mod.DRACOLoader();
          draco.setDecoderPath(CDN + '/examples/jsm/libs/draco/');
          loader.setDRACOLoader(draco);
        }
      } catch (e) {
        console.warn('[DropInAsset] DRACOLoader setup note:', e.message);
      }
    }

    if (!loader && THREE?.GLTFLoader) {
      loader = new THREE.GLTFLoader();
    }
    if (!loader) {
      throw new Error('GLTFLoader is not available in ThreeJSLoader.');
    }
    this._gltfLoader = loader;
    return loader;
  }

  async loadFile(file) {
    if (!file) return null;
    const lower = (file.name || '').toLowerCase();
    if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
      this._setStatus('Please drop a .glb or .gltf file.', '#f87171');
      return null;
    }
    this._setStatus(`Loading ${file.name}...`, '#38bdf8');
    const buffer = await file.arrayBuffer();
    return await this._parseArrayBuffer(buffer, file.name);
  }

  async loadUrl(url, label) {
    const name = label || url.split('/').pop() || 'model.glb';
    this._setStatus(`Fetching ${name}...`, '#38bdf8');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    const buffer = await res.arrayBuffer();
    return await this._parseArrayBuffer(buffer, name);
  }

  async _parseArrayBuffer(buffer, fileName) {
    const loader = await this._ensureLoader();
    return await new Promise((resolve, reject) => {
      loader.parse(
        buffer,
        '',
        (gltf) => {
          this._mountLoadedScene(gltf.scene, fileName);
          resolve(this.getInfo());
        },
        (err) => {
          const msg = err?.message || String(err);
          this._setStatus('Parse failed: ' + msg, '#f87171');
          reject(err);
        }
      );
    });
  }

  _mountLoadedScene(sceneObj, fileName) {
    const THREE = this.THREE;
    this.clear(true);

    this._loadedScene = sceneObj;
    this._loadedFileName = fileName || 'model.glb';

    sceneObj.updateMatrixWorld(true);
    const meshEntries = [];
    sceneObj.traverse((node) => {
      if (node.isMesh) {
        const box = new THREE.Box3().setFromObject(node);
        const size = box.getSize(new THREE.Vector3());
        const triCount = node.geometry?.index
          ? node.geometry.index.count / 3
          : (node.geometry?.attributes?.position?.count || 0) / 3;
        meshEntries.push({
          mesh: node,
          box,
          size,
          areaXZ: size.x * size.z,
          triCount
        });
      }
    });

    this._detectGroundPlanes(meshEntries);

    const coreBox = new THREE.Box3();
    let strippedCount = 0;
    for (const entry of meshEntries) {
      if (entry.mesh.userData._isDetectedGround) {
        strippedCount++;
        if (this.state.stripGround) continue;
      }
      coreBox.union(entry.box);
    }
    if (coreBox.isEmpty()) {
      coreBox.setFromObject(sceneObj);
    }

    const rawSize = coreBox.getSize(new THREE.Vector3());
    const rawCenter = coreBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
    const autoScale = this.options.targetLength / maxDim;

    this._modelNorm = {
      autoScale,
      center: { x: rawCenter.x, y: rawCenter.y, z: rawCenter.z },
      size: { x: rawSize.x, y: rawSize.y, z: rawSize.z },
      min: { x: coreBox.min.x, y: coreBox.min.y, z: coreBox.min.z },
      max: { x: coreBox.max.x, y: coreBox.max.y, z: coreBox.max.z },
      meshCount: meshEntries.length,
      strippedCount
    };

    this.alignGroup.scale.setScalar(autoScale);
    this.alignGroup.position.set(
      -rawCenter.x * autoScale,
      -rawCenter.y * autoScale,
      -rawCenter.z * autoScale
    );
    this.prepassAlignGroup.scale.copy(this.alignGroup.scale);
    this.prepassAlignGroup.position.copy(this.alignGroup.position);

    this._assetMeshes = [];
    this._assetMaterials.clear();

    sceneObj.traverse((node) => {
      if (!node.isMesh) return;
      this._assetMeshes.push(node);
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        if (!m) continue;
        if (!this._assetMaterials.has(m)) {
          this._snapshotMaterial(m);
          this._patchMaterialForReveal(m, false);
          this._assetMaterials.add(m);
        }
      }
    });

    this.contentGroup.add(sceneObj);
    this._rebuildPrepassHierarchy(sceneObj);

    this.state.visible = true;
    this.state.rx = 0;
    this.state.ry = 0;
    this.state.rz = 0;
    this.state.scale = 1;
    this.assetRoot.rotation.set(0, 0, 0);
    this.assetRoot.scale.setScalar(1);
    this.snapToReference('auto');

    this._applyGroundVisibility();
    this._applyRevealStyle();
    this._syncUI();

    const stripNote = strippedCount > 0 ? ` • ${strippedCount} floor stripped` : '';
    this._setStatus(`${this._loadedFileName} (${meshEntries.length} meshes${stripNote})`, '#34d399');

    if (typeof this.options.onLoad === 'function') {
      this.options.onLoad(this.getInfo());
    }
  }

  _detectGroundPlanes(entries) {
    if (!entries.length) return;

    const nonFlatBox = new this.THREE.Box3();
    for (const e of entries) {
      const horiz = Math.max(e.size.x, e.size.z, 1e-6);
      const isFlat = e.size.y / horiz < 0.03;
      if (!isFlat) nonFlatBox.union(e.box);
    }

    const refBox = nonFlatBox.isEmpty()
      ? entries.reduce((acc, e) => acc.union(e.box), new this.THREE.Box3())
      : nonFlatBox;
    const refSize = refBox.getSize(new this.THREE.Vector3());
    const refArea = Math.max(1e-6, refSize.x * refSize.z);
    const refBottomY = refBox.min.y;
    const refHeight = Math.max(1e-6, refSize.y);

    for (const e of entries) {
      const name = (e.mesh.name || '').toLowerCase();
      const parentName = (e.mesh.parent?.name || '').toLowerCase();
      const horiz = Math.max(e.size.x, e.size.z, 1e-6);
      const isFlat = e.size.y / horiz < 0.035;
      const areaRatio = e.areaXZ / refArea;
      const nearBottom = e.box.max.y <= refBottomY + 0.10 * refHeight;
      const nameLooksFloor = /\b(floor|ground|plane|shadow|backdrop|stage|platform|pedestal|turntable)\b/.test(name + ' ' + parentName);

      const isGround =
        (isFlat && areaRatio > 1.35) ||
        (isFlat && nearBottom && e.triCount <= 32 && areaRatio > 0.72) ||
        (nameLooksFloor && isFlat && areaRatio > 0.45);

      e.mesh.userData._isDetectedGround = Boolean(isGround);
    }
  }

  _rebuildPrepassHierarchy(rootObj) {
    while (this.prepassGroup.children.length > 0) {
      this.prepassGroup.remove(this.prepassGroup.children[0]);
    }
    const cloneNode = (src) => {
      let dst;
      if (src.isMesh && !src.isSkinnedMesh && !src.isInstancedMesh) {
        dst = new this.THREE.Mesh(src.geometry, this._prepassMaterial);
        dst.renderOrder = this.options.renderOrderBase;
        dst.frustumCulled = src.frustumCulled;
        src.userData._prepassMesh = dst;
      } else {
        dst = new this.THREE.Group();
      }
      dst.position.copy(src.position);
      dst.quaternion.copy(src.quaternion);
      dst.scale.copy(src.scale);
      dst.visible = src.visible;
      for (const child of src.children) {
        dst.add(cloneNode(child));
      }
      return dst;
    };
    this.prepassGroup.add(cloneNode(rootObj));
  }

  _snapshotMaterial(mat) {
    mat.userData = mat.userData || {};
    if (mat.userData._dropInOrig) return;
    mat.userData._dropInOrig = {
      transparent: Boolean(mat.transparent),
      opacity: mat.opacity !== undefined ? mat.opacity : 1,
      depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
      depthFunc: mat.depthFunc !== undefined ? mat.depthFunc : this.THREE.LessEqualDepth,
      wireframe: Boolean(mat.wireframe),
      side: mat.side !== undefined ? mat.side : this.THREE.FrontSide
    };
  }

  _patchMaterialForReveal(mat, isPrepass = false) {
    if (!mat || mat.userData?._dropInPatched) return;
    mat.userData = mat.userData || {};
    mat.userData._dropInPatched = true;

    const uniforms = this._sharedUniforms;
    const prevKey = typeof mat.customProgramCacheKey === 'function' ? mat.customProgramCacheKey() : '';
    const prevCompile = mat.onBeforeCompile;

    mat.customProgramCacheKey = () =>
      (prevKey ? prevKey + '|' : '') + (isPrepass ? 'dropin_pre_v1' : 'dropin_rev_v1');

    mat.onBeforeCompile = (shader, renderer) => {
      if (typeof prevCompile === 'function') prevCompile.call(mat, shader, renderer);

      shader.uniforms.uRevealCenter = uniforms.uRevealCenter;
      shader.uniforms.uRevealRadius = uniforms.uRevealRadius;
      shader.uniforms.uRevealSoftness = uniforms.uRevealSoftness;
      shader.uniforms.uRevealMode = uniforms.uRevealMode;
      shader.uniforms.uRevealEdgeColor = uniforms.uRevealEdgeColor;

      if (
        shader.vertexShader.includes('#include <common>') &&
        shader.vertexShader.includes('#include <project_vertex>') &&
        !shader.vertexShader.includes('vDropInWorldPos')
      ) {
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vDropInWorldPos;'
          )
          .replace(
            '#include <project_vertex>',
            `vec4 dropInWp = modelMatrix * vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              dropInWp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
            #endif
            vDropInWorldPos = dropInWp.xyz;
            #include <project_vertex>`
          );
      }

      if (
        shader.fragmentShader.includes('#include <common>') &&
        shader.fragmentShader.includes('#include <clipping_planes_fragment>') &&
        !shader.fragmentShader.includes('vDropInWorldPos')
      ) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform vec3 uRevealCenter;
            uniform float uRevealRadius;
            uniform float uRevealSoftness;
            uniform float uRevealMode;
            uniform vec3 uRevealEdgeColor;
            varying vec3 vDropInWorldPos;`
          )
          .replace(
            '#include <clipping_planes_fragment>',
            `if (uRevealMode > 0.5) {
              float dropInDist = distance(vDropInWorldPos, uRevealCenter);
              if (dropInDist < uRevealRadius) {
                discard;
              }
            }
            #include <clipping_planes_fragment>`
          );

        if (!isPrepass && shader.fragmentShader.includes('#include <dithering_fragment>')) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            if (uRevealMode > 0.5 && uRevealSoftness > 0.001) {
              float dropInDistEnd = distance(vDropInWorldPos, uRevealCenter);
              float dropInBand = 1.0 - smoothstep(uRevealRadius, uRevealRadius + uRevealSoftness, dropInDistEnd);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, uRevealEdgeColor, dropInBand * 0.85);
            }`
          );
        }
      }
    };
    mat.needsUpdate = true;
  }

  _applyGroundVisibility() {
    for (const m of this._assetMeshes) {
      const hidden = Boolean(this.state.stripGround && m.userData._isDetectedGround);
      m.visible = !hidden;
      if (m.userData._prepassMesh) {
        m.userData._prepassMesh.visible = !hidden;
      }
    }
  }

  _getOverrideMaterial() {
    const mode = this.state.materialOverride;
    if (mode === 'original') return null;

    if (!this._overrideMat) {
      this._overrideMat = new this.THREE.MeshPhysicalMaterial({
        color: 0xdbe2ea,
        metalness: 0.15,
        roughness: 0.45,
        clearcoat: 0.2
      });
      this._snapshotMaterial(this._overrideMat);
      this._patchMaterialForReveal(this._overrideMat, false);
    }

    if (mode === 'clay') {
      this._overrideMat.color.setHex(0xd8dee6);
      this._overrideMat.metalness = 0.08;
      this._overrideMat.roughness = 0.58;
      this._overrideMat.clearcoat = 0.12;
    } else if (mode === 'matte') {
      this._overrideMat.color.setHex(0x283244);
      this._overrideMat.metalness = 0.25;
      this._overrideMat.roughness = 0.72;
      this._overrideMat.clearcoat = 0.08;
    } else if (mode === 'silver') {
      this._overrideMat.color.setHex(0xcbd5e1);
      this._overrideMat.metalness = 0.88;
      this._overrideMat.roughness = 0.20;
      this._overrideMat.clearcoat = 0.45;
    }
    return this._overrideMat;
  }

  _applyRevealStyle() {
    const THREE = this.THREE;
    const mode = this.state.revealMode;
    const isShell = mode === 'shell' || mode === 'shell-cutaway';
    const isCutaway = mode === 'cutaway' || mode === 'shell-cutaway';
    const isWire = mode === 'wireframe';

    this.assetRoot.visible = this.state.visible;
    this.prepassAlignGroup.visible = isShell && this.state.visible;
    this._sharedUniforms.uRevealMode.value = isCutaway ? 1.0 : 0.0;
    this._sharedUniforms.uRevealRadius.value = this.state.cutawayRadius;

    const overrideMat = this._getOverrideMaterial();

    const styleMat = (m) => {
      if (!m) return;
      const orig = m.userData?._dropInOrig;
      if (isShell) {
        m.transparent = true;
        m.opacity = this.state.opacity;
        m.depthWrite = false;
        m.depthFunc = THREE.LessEqualDepth;
        m.wireframe = false;
      } else if (isWire) {
        m.transparent = true;
        m.opacity = Math.max(0.25, this.state.opacity);
        m.depthWrite = true;
        m.depthFunc = THREE.LessEqualDepth;
        m.wireframe = true;
      } else {
        m.transparent = orig ? orig.transparent : false;
        m.opacity = orig ? orig.opacity : 1.0;
        m.depthWrite = orig ? orig.depthWrite : true;
        m.depthFunc = orig ? orig.depthFunc : THREE.LessEqualDepth;
        m.wireframe = orig ? orig.wireframe : false;
      }
      m.needsUpdate = true;
    };

    for (const m of this._assetMeshes) {
      if (!m.userData._origMeshMat) {
        m.userData._origMeshMat = m.material;
      }
      if (overrideMat) {
        m.material = overrideMat;
      } else {
        m.material = m.userData._origMeshMat;
      }
      m.renderOrder = this.options.renderOrderBase + 1;

      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) styleMat(mat);
    }

    if (overrideMat) styleMat(overrideMat);
  }

  _applyTransformToScene() {
    const D2R = Math.PI / 180;
    this.assetRoot.position.set(this.state.x, this.state.y, this.state.z);
    this.assetRoot.rotation.set(this.state.rx * D2R, this.state.ry * D2R, this.state.rz * D2R);
    this.assetRoot.scale.setScalar(this.state.scale);
    this.assetRoot.updateMatrixWorld(true);
    this._updateFitGuideLabels();
    if (typeof this.options.onChange === 'function') {
      this.options.onChange(this.getTransform());
    }
  }

  _computeCurrentWorldBox() {
    const THREE = this.THREE;
    const box = new THREE.Box3();
    if (!this._loadedScene) return box;
    this.assetRoot.updateMatrixWorld(true);
    for (const m of this._assetMeshes) {
      if (!m.visible) continue;
      box.expandByObject(m);
    }
    return box;
  }

  snapToReference(mode = 'auto') {
    if (!this._loadedScene) return;

    if (mode === 'auto') {
      this.state.x = 0;
      this.state.y = 0;
      this.state.z = 0;
      this._applyTransformToScene();
      const b = this._computeCurrentWorldBox();
      if (!b.isEmpty()) {
        const size = b.getSize(new this.THREE.Vector3());
        const center = b.getCenter(new this.THREE.Vector3());
        this.state.x -= center.x;
        this.state.y += this.options.groundY - b.min.y;
        const rearAxleZ = b.min.z + this.options.rearAxleFraction * size.z;
        this.state.z -= rearAxleZ;
      }
    } else if (mode === 'floor') {
      this._applyTransformToScene();
      const b = this._computeCurrentWorldBox();
      if (!b.isEmpty()) {
        this.state.y += this.options.groundY - b.min.y;
      }
    } else if (mode === 'centerX') {
      this._applyTransformToScene();
      const b = this._computeCurrentWorldBox();
      if (!b.isEmpty()) {
        const center = b.getCenter(new this.THREE.Vector3());
        this.state.x -= center.x;
      }
    } else if (mode === 'rearToDiff') {
      this._applyTransformToScene();
      const b = this._computeCurrentWorldBox();
      if (!b.isEmpty()) {
        const size = b.getSize(new this.THREE.Vector3());
        const rearAxleZ = b.min.z + this.options.rearAxleFraction * size.z;
        const rc = this._sharedUniforms.uRevealCenter.value;
        this.state.z += rc.z - rearAxleZ;
      }
    }

    this._applyTransformToScene();
    this._syncUI();
  }

  rotateStep(axis, deg = 90) {
    const key = axis === 'x' ? 'rx' : axis === 'y' ? 'ry' : 'rz';
    let next = (this.state[key] + deg) % 360;
    if (next > 180) next -= 360;
    if (next <= -180) next += 360;
    this.state[key] = next;
    this._applyTransformToScene();
    this._syncUI();
  }

  setPosition(x, y, z) {
    this.state.x = Number(x) || 0;
    this.state.y = Number(y) || 0;
    this.state.z = Number(z) || 0;
    this._applyTransformToScene();
    this._syncUI();
  }

  setRotationDeg(rx, ry, rz) {
    this.state.rx = Number(rx) || 0;
    this.state.ry = Number(ry) || 0;
    this.state.rz = Number(rz) || 0;
    this._applyTransformToScene();
    this._syncUI();
  }

  setUniformScale(s) {
    this.state.scale = Math.max(0.05, Math.min(10, Number(s) || 1));
    this._applyTransformToScene();
    this._syncUI();
  }

  getTransform() {
    return {
      x: Number(this.state.x.toFixed(3)),
      y: Number(this.state.y.toFixed(3)),
      z: Number(this.state.z.toFixed(3)),
      rx: Number(this.state.rx.toFixed(1)),
      ry: Number(this.state.ry.toFixed(1)),
      rz: Number(this.state.rz.toFixed(1)),
      scale: Number(this.state.scale.toFixed(3))
    };
  }

  setTransform(cfg = {}) {
    if (cfg.x !== undefined) this.state.x = Number(cfg.x) || 0;
    if (cfg.y !== undefined) this.state.y = Number(cfg.y) || 0;
    if (cfg.z !== undefined) this.state.z = Number(cfg.z) || 0;
    if (cfg.rx !== undefined) this.state.rx = Number(cfg.rx) || 0;
    if (cfg.ry !== undefined) this.state.ry = Number(cfg.ry) || 0;
    if (cfg.rz !== undefined) this.state.rz = Number(cfg.rz) || 0;
    if (cfg.scale !== undefined) this.state.scale = Math.max(0.05, Math.min(10, Number(cfg.scale) || 1));
    this._applyTransformToScene();
    this._syncUI();
  }

  setVisible(visible) {
    this.state.visible = Boolean(visible);
    this._applyRevealStyle();
    this._syncUI();
  }

  setRevealMode(mode) {
    this.state.revealMode = mode;
    this._applyRevealStyle();
    this._syncUI();
  }

  setOpacity(alpha) {
    this.state.opacity = Math.max(0.04, Math.min(1.0, Number(alpha)));
    this._applyRevealStyle();
    this._syncUI();
  }

  setCutawayRadius(r) {
    this.state.cutawayRadius = Math.max(0.2, Math.min(35.0, Number(r)));
    this._sharedUniforms.uRevealRadius.value = this.state.cutawayRadius;
    this._syncUI();
  }

  setStripGround(enabled) {
    this.state.stripGround = Boolean(enabled);
    this._applyGroundVisibility();
    this._updateFitGuideLabels();
    this._syncUI();
  }

  setMaterialOverride(mode) {
    this.state.materialOverride = mode || 'original';
    this._applyRevealStyle();
    this._syncUI();
  }

  setShowFitGuide(show) {
    this.state.showFitGuide = Boolean(show);
    this.fitGuideGroup.visible = this.state.showFitGuide;
    this._updateFitGuideLabels();
    this._syncUI();
  }

  getInfo() {
    return {
      fileName: this._loadedFileName,
      hasModel: this.hasModel(),
      norm: this._modelNorm,
      transform: this.getTransform(),
      revealMode: this.state.revealMode,
      opacity: this.state.opacity,
      cutawayRadius: this.state.cutawayRadius
    };
  }

  getSuggestedCameraPose() {
    if (!this._loadedScene) {
      return { pos: { x: 24, y: 13, z: 34 }, target: { x: 0, y: 1.0, z: 12.0 } };
    }
    const b = this._computeCurrentWorldBox();
    if (b.isEmpty()) {
      return { pos: { x: 24, y: 13, z: 34 }, target: { x: 0, y: 1.0, z: 12.0 } };
    }
    const center = b.getCenter(new this.THREE.Vector3());
    const size = b.getSize(new this.THREE.Vector3());
    const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
    return {
      pos: {
        x: center.x + radius * 1.15,
        y: center.y + radius * 0.48,
        z: center.z - radius * 1.05
      },
      target: { x: center.x, y: center.y, z: center.z }
    };
  }

  frameCamera() {
    if (!this.app?.camera || !this.app?.controls) return;
    const pose = this.getSuggestedCameraPose();
    this.app.camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    this.app.controls.target.set(pose.target.x, pose.target.y, pose.target.z);
    this.app.controls.update();
  }

  _buildFitGuide() {
    const THREE = this.THREE;
    const bounds = this.options.referenceBounds || {
      min: [-9.0, this.options.groundY, -6.2],
      max: [9.0, 5.9, 35.4]
    };

    const [x0, y0, z0] = bounds.min;
    const [x1, y1, z1] = bounds.max;
    const segs = [
      [[x0, y0, z0], [x1, y0, z0]], [[x1, y0, z0], [x1, y1, z0]], [[x1, y1, z0], [x0, y1, z0]], [[x0, y1, z0], [x0, y0, z0]],
      [[x0, y0, z1], [x1, y0, z1]], [[x1, y0, z1], [x1, y1, z1]], [[x1, y1, z1], [x0, y1, z1]], [[x0, y1, z1], [x0, y0, z1]],
      [[x0, y0, z0], [x0, y0, z1]], [[x1, y0, z0], [x1, y0, z1]], [[x1, y1, z0], [x1, y1, z1]], [[x0, y1, z0], [x0, y1, z1]],
      [[-10.5, 0, 0], [10.5, 0, 0]], [[0, -3.7, 0], [0, 3.0, 0]],
      [[-10.5, 0, 28], [10.5, 0, 28]]
    ];
    const pos = [];
    for (const [a, b] of segs) pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
    this._fitGuideDisposables.push(geom, mat);
    this.fitGuideGroup.add(new THREE.LineSegments(geom, mat));

    const ringPts = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0));
    }
    const rGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
    const rMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 });
    this._fitGuideDisposables.push(rGeom, rMat);
    const ringLine = new THREE.Line(rGeom, rMat);
    ringLine.rotation.y = Math.PI / 2;
    this.fitGuideGroup.add(ringLine);
  }

  _updateFitGuideLabels() {
    if (!this._uiRefs.fitEl) return;
    if (!this._loadedScene) {
      this._uiRefs.fitEl.textContent = 'No GLB loaded — drop a car .glb onto viewport.';
      return;
    }
    const b = this._computeCurrentWorldBox();
    if (b.isEmpty()) {
      this._uiRefs.fitEl.textContent = 'Model hidden.';
      return;
    }
    const sz = b.getSize(new this.THREE.Vector3());
    const ct = b.getCenter(new this.THREE.Vector3());
    const rc = this._sharedUniforms.uRevealCenter.value;
    const estRearZ = b.min.z + this.options.rearAxleFraction * sz.z;
    this._uiRefs.fitEl.textContent =
      `Size W×H×L: ${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)}\n` +
      `Floor ΔY: ${(b.min.y - this.options.groundY).toFixed(2)} | Center X: ${ct.x.toFixed(2)}\n` +
      `Est Rear Axle ΔZ to Diff: ${(estRearZ - rc.z).toFixed(2)}`;
  }

  bindDropTarget(element) {
    if (!element) return;
    if (this._dropCleanup) this._dropCleanup();

    const overlay = this._el('div', {
      style: {
        position: 'absolute',
        inset: '0',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(14, 23, 38, 0.78)',
        border: '3px dashed #38bdf8',
        color: '#e0f2fe',
        fontFamily: 'monospace',
        fontSize: '16px',
        fontWeight: 'bold',
        letterSpacing: '0.03em',
        zIndex: '60',
        pointerEvents: 'none'
      }
    }, `Drop .glb / .gltf ${this.options.name} here`);
    element.appendChild(overlay);
    this._dropOverlay = overlay;

    let dragDepth = 0;
    const onDragEnter = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      dragDepth++;
      overlay.style.display = 'flex';
    };
    const onDragOver = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      overlay.style.display = 'flex';
    };
    const onDragLeave = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) overlay.style.display = 'none';
    };
    const onDrop = (e) => {
      dragDepth = 0;
      overlay.style.display = 'none';
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      const f = files[0];
      const lower = (f.name || '').toLowerCase();
      if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
        e.preventDefault();
        e.stopPropagation();
        this.loadFile(f).catch((err) => console.error('[DropInAsset]', err));
      }
    };

    element.addEventListener('dragenter', onDragEnter);
    element.addEventListener('dragover', onDragOver);
    element.addEventListener('dragleave', onDragLeave);
    element.addEventListener('drop', onDrop);

    this._dropCleanup = () => {
      element.removeEventListener('dragenter', onDragEnter);
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', onDragLeave);
      element.removeEventListener('drop', onDrop);
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      this._dropOverlay = null;
    };
  }

  playShowcaseMovie(opts = {}) {
    if (this._movieActive) {
      this.stopShowcaseMovie();
      return false;
    }
    const camera = this.app?.camera;
    const controls = this.app?.controls;
    if (!camera || !controls) return false;

    const THREE = this.THREE;
    const hasGlb = this.hasModel();
    const fallbackGroup = this.options.fallbackMovieGroup;

    const rc = this._sharedUniforms.uRevealCenter.value.clone();
    const carPose = hasGlb
      ? this.getSuggestedCameraPose()
      : { pos: { x: 24, y: 13, z: 34 }, target: { x: 0, y: 1.0, z: 12.0 } };

    const basePosY = this.state.y;
    const targetOpacity = this.state.opacity > 0.08 ? this.state.opacity : 0.34;
    const targetCutR = Math.max(3.6, this.state.cutawayRadius);
    const totalMs = opts.durationMs || 9800;

    if (hasGlb) {
      this.state.visible = false;
      this.assetRoot.visible = false;
      this.prepassAlignGroup.visible = false;
    } else if (fallbackGroup) {
      fallbackGroup.visible = false;
    }

    this._movieActive = true;
    this._moviePrevDamping = controls.enableDamping;
    controls.enableDamping = false;
    this._syncMovieBtn();

    this._movieCancelOnInteract = () => {
      this.stopShowcaseMovie();
    };
    controls.addEventListener('start', this._movieCancelOnInteract);

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpV3 = (a, b, t) => new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

    const pClose = new THREE.Vector3(rc.x + 2.5, rc.y + 0.9, rc.z + 2.7);
    const tClose = rc.clone();

    const pMid = new THREE.Vector3(10.5, 4.2, -9.5);
    const tMid = new THREE.Vector3(0, 0.2, 5.5);

    const pWide = new THREE.Vector3(carPose.pos.x, carPose.pos.y, carPose.pos.z);
    const tWide = new THREE.Vector3(carPose.target.x, carPose.target.y, carPose.target.z);

    const pFinal = new THREE.Vector3(rc.x - 11.0, rc.y + 4.4, rc.z - 12.5);
    const tFinal = new THREE.Vector3(rc.x, rc.y + 0.3, rc.z + 3.2);

    const startTime = performance.now();
    const tick = (now) => {
      if (!this._movieActive) return;
      const elapsed = now - startTime;
      const u = Math.min(1, elapsed / totalMs);

      if (u < 0.24) {
        const k = easeInOut(u / 0.24);
        const orbitAng = k * 0.45;
        const p = pClose.clone().sub(tClose).applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitAng).add(tClose);
        camera.position.copy(p);
        controls.target.copy(tClose);
      } else if (u < 0.56) {
        const k = easeInOut((u - 0.24) / 0.32);
        camera.position.copy(lerpV3(pClose, pWide, k));
        controls.target.copy(lerpV3(tClose, tWide, k));

        if (hasGlb) {
          this.state.visible = true;
          this.state.revealMode = 'shell';
          this.state.opacity = Math.max(0.05, k * 0.92);
          this.state.y = basePosY + (1 - k) * 4.5;
          this._applyTransformToScene();
          this._applyRevealStyle();
        } else if (fallbackGroup && k > 0.2) {
          fallbackGroup.visible = true;
        }
      } else if (u < 0.88) {
        const k = easeInOut((u - 0.56) / 0.32);
        const camMid = lerpV3(pWide, pMid, Math.min(1, k * 1.3));
        camera.position.copy(lerpV3(camMid, pFinal, k));
        controls.target.copy(lerpV3(tWide, tFinal, k));

        if (hasGlb) {
          this.state.y = basePosY;
          this.state.revealMode = 'shell-cutaway';
          this.state.opacity = lerp(0.88, targetOpacity, k);
          this.state.cutawayRadius = lerp(0.3, targetCutR, k);
          this._applyTransformToScene();
          this._applyRevealStyle();
        }
      } else {
        const k = easeInOut((u - 0.88) / 0.12);
        const sweep = (k - 0.5) * 0.12;
        const p = pFinal.clone().sub(tFinal).applyAxisAngle(new THREE.Vector3(0, 1, 0), sweep).add(tFinal);
        camera.position.copy(p);
        controls.target.copy(tFinal);
      }

      controls.update();

      if (u < 1) {
        this._movieRaf = requestAnimationFrame(tick);
      } else {
        this.stopShowcaseMovie(true);
      }
    };

    this._movieRaf = requestAnimationFrame(tick);
    return true;
  }

  stopShowcaseMovie(finished = false) {
    if (!this._movieActive) return;
    this._movieActive = false;
    if (this._movieRaf) {
      cancelAnimationFrame(this._movieRaf);
      this._movieRaf = null;
    }
    const controls = this.app?.controls;
    if (controls) {
      if (this._movieCancelOnInteract) {
        controls.removeEventListener('start', this._movieCancelOnInteract);
        this._movieCancelOnInteract = null;
      }
      if (this._moviePrevDamping !== null) {
        controls.enableDamping = this._moviePrevDamping;
        this._moviePrevDamping = null;
      }
      controls.update();
    }
    if (!finished && this.hasModel() && !this.state.visible) {
      this.state.visible = true;
      this._applyRevealStyle();
    }
    this._syncUI();
    this._syncMovieBtn();
  }

  _syncMovieBtn() {
    if (!this._uiRefs.movieBtn) return;
    this._uiRefs.movieBtn.textContent = this._movieActive ? '⏹ Stop Movie' : '🎬 Reveal Movie';
    this._uiRefs.movieBtn.style.background = this._movieActive ? '#991b1b' : '#1e3a5f';
    this._uiRefs.movieBtn.style.borderColor = this._movieActive ? '#f87171' : '#38bdf8';
  }

  _setStatus(msg, color = '#94a3b8') {
    if (this._uiRefs.statusEl) {
      this._uiRefs.statusEl.textContent = msg;
      this._uiRefs.statusEl.style.color = color;
    }
  }

  _syncUI() {
    const r = this._uiRefs;
    if (!r.root) return;

    if (r.visChk) r.visChk.checked = this.state.visible;
    if (r.stripChk) r.stripChk.checked = this.state.stripGround;
    if (r.fitChk) r.fitChk.checked = this.state.showFitGuide;
    if (r.matSel) r.matSel.value = this.state.materialOverride;

    if (r.modeBtns) {
      for (const [id, btn] of Object.entries(r.modeBtns)) {
        const on = this.state.revealMode === id;
        btn.style.background = on ? '#1d4ed8' : '#161b22';
        btn.style.borderColor = on ? '#60a5fa' : '#30363d';
        btn.style.color = on ? '#ffffff' : '#94a3b8';
      }
    }

    if (r.opInput) {
      r.opInput.value = String(this.state.opacity);
      r.opVal.textContent = this.state.opacity.toFixed(2);
    }
    if (r.cutInput) {
      r.cutInput.value = String(this.state.cutawayRadius);
      r.cutVal.textContent = this.state.cutawayRadius.toFixed(1);
    }
    if (r.scaleInput) {
      r.scaleInput.value = String(this.state.scale);
      r.scaleVal.textContent = this.state.scale.toFixed(2) + '×';
    }
    if (r.posInputs) {
      for (const axis of ['x', 'y', 'z']) {
        r.posInputs[axis].inp.value = String(this.state[axis]);
        r.posInputs[axis].val.textContent = this.state[axis].toFixed(2);
      }
    }
    if (r.rotLabel) {
      r.rotLabel.textContent = `Rot: ${Math.round(this.state.rx)}°, ${Math.round(this.state.ry)}°, ${Math.round(this.state.rz)}°`;
    }
    if (r.jsonBox && document.activeElement !== r.jsonBox) {
      r.jsonBox.value = JSON.stringify(this.getTransform());
    }
    this._updateFitGuideLabels();
  }

  buildUI() {
    const el = this._el.bind(this);
    const btnStyle = {
      padding: '4px 6px',
      fontSize: '10px',
      fontFamily: 'monospace',
      background: '#161b22',
      color: '#e2e8f0',
      border: '1px solid #30363d',
      borderRadius: '4px',
      cursor: 'pointer'
    };

    const fileInput = el('input', {
      type: 'file',
      accept: '.glb,.gltf',
      style: { display: 'none' },
      onchange: (e) => {
        const f = e.target.files?.[0];
        if (f) this.loadFile(f).catch((err) => console.error('[DropInAsset]', err));
        e.target.value = '';
      }
    });

    const dropZone = el('div', {
      style: {
        border: '1px dashed #38bdf8',
        borderRadius: '5px',
        padding: '6px',
        textAlign: 'center',
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#bae6fd',
        background: '#0a1424',
        cursor: 'pointer'
      },
      onclick: () => fileInput.click()
    }, 'Drop .glb Car Here (or Click)');

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.style.background = '#132744';
    };
    dropZone.ondragleave = () => {
      dropZone.style.background = '#0a1424';
    };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.background = '#0a1424';
      const f = e.dataTransfer?.files?.[0];
      if (f) this.loadFile(f).catch((err) => console.error('[DropInAsset]', err));
    };

    const statusEl = el('div', {
      style: { fontSize: '9.5px', fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-word' }
    }, 'No GLB loaded (drop anytime).');

    const visChk = el('input', {
      type: 'checkbox',
      id: 'chkDropInVis',
      checked: this.state.visible,
      onchange: () => this.setVisible(visChk.checked)
    });
    const visLbl = el('label', {
      htmlFor: 'chkDropInVis',
      style: { fontSize: '10px', fontFamily: 'monospace', color: '#cbd5e1', cursor: 'pointer' }
    }, 'Show Car');

    const movieBtn = el('button', {
      style: { ...btnStyle, flex: '1', background: '#1e3a5f', borderColor: '#38bdf8', color: '#e0f2fe', fontWeight: 'bold' },
      onclick: () => this.playShowcaseMovie()
    }, '🎬 Reveal Movie');

    const clearBtn = el('button', {
      style: { ...btnStyle, color: '#fca5a5' },
      title: 'Unload dropped car GLB',
      onclick: () => this.clear()
    }, '✕');

    const modes = [
      { id: 'solid', label: 'Solid' },
      { id: 'shell', label: 'Shell' },
      { id: 'cutaway', label: 'Cutaway' },
      { id: 'shell-cutaway', label: 'Shell+Cut' },
      { id: 'wireframe', label: 'Wire' }
    ];
    const modeBtns = {};
    const modeRow = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } }, modes.map((m) => {
      const b = el('button', {
        style: { ...btnStyle, fontSize: '9.5px', padding: '3px 4px', flex: '1 1 30%' },
        onclick: () => this.setRevealMode(m.id)
      }, m.label);
      modeBtns[m.id] = b;
      return b;
    }));

    const opVal = el('span', { style: { color: '#38bdf8', fontFamily: 'monospace', fontSize: '10px' } }, this.state.opacity.toFixed(2));
    const opInput = el('input', {
      type: 'range', min: '0.04', max: '1.00', step: '0.02', value: String(this.state.opacity),
      style: { width: '100%', cursor: 'pointer' },
      oninput: () => this.setOpacity(parseFloat(opInput.value))
    });

    const cutVal = el('span', { style: { color: '#38bdf8', fontFamily: 'monospace', fontSize: '10px' } }, this.state.cutawayRadius.toFixed(1));
    const cutInput = el('input', {
      type: 'range', min: '0.4', max: '24.0', step: '0.2', value: String(this.state.cutawayRadius),
      style: { width: '100%', cursor: 'pointer' },
      oninput: () => this.setCutawayRadius(parseFloat(cutInput.value))
    });

    const stripChk = el('input', {
      type: 'checkbox',
      id: 'chkDropStripGround',
      checked: this.state.stripGround,
      onchange: () => this.setStripGround(stripChk.checked)
    });
    const stripLbl = el('label', {
      htmlFor: 'chkDropStripGround',
      style: { fontSize: '10px', fontFamily: 'monospace', color: '#cbd5e1', cursor: 'pointer' }
    }, 'Strip Ground');

    const fitChk = el('input', {
      type: 'checkbox',
      id: 'chkDropFitGuide',
      checked: this.state.showFitGuide,
      onchange: () => this.setShowFitGuide(fitChk.checked)
    });
    const fitLbl = el('label', {
      htmlFor: 'chkDropFitGuide',
      style: { fontSize: '10px', fontFamily: 'monospace', color: '#cbd5e1', cursor: 'pointer' }
    }, 'Check Fit');

    const fitEl = el('pre', {
      style: {
        margin: '0',
        padding: '4px',
        fontSize: '9.5px',
        lineHeight: '1.35',
        fontFamily: 'monospace',
        color: '#a5f3fc',
        background: '#090d14',
        borderRadius: '3px',
        border: '1px solid #1e293b',
        whiteSpace: 'pre-wrap'
      }
    }, '');

    // Position, 90° Rotation & Scale Sub-panel
    const rotLabel = el('div', { style: { fontSize: '9.5px', fontFamily: 'monospace', color: '#fbbf24' } }, 'Rot: 0°, 0°, 0°');
    const rotBtns = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } }, [
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('x', -90) }, 'X-90°'),
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('x', 90) }, 'X+90°'),
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('y', -90) }, 'Y-90°'),
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('y', 90) }, 'Y+90°'),
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('z', -90) }, 'Z-90°'),
      el('button', { style: { ...btnStyle, flex: '1 1 30%', fontSize: '9.5px' }, onclick: () => this.rotateStep('z', 90) }, 'Z+90°')
    ]);

    const snapRow = el('div', { style: { display: 'flex', gap: '3px' } }, [
      el('button', { style: { ...btnStyle, flex: '1', fontSize: '9.5px' }, onclick: () => this.snapToReference('floor') }, 'Floor'),
      el('button', { style: { ...btnStyle, flex: '1', fontSize: '9.5px' }, onclick: () => this.snapToReference('centerX') }, 'Ctr X'),
      el('button', { style: { ...btnStyle, flex: '1', fontSize: '9.5px' }, onclick: () => this.snapToReference('rearToDiff') }, 'Rear→Diff'),
      el('button', { style: { ...btnStyle, flex: '1', fontSize: '9.5px', color: '#93c5fd' }, onclick: () => this.snapToReference('auto') }, 'Auto')
    ]);

    const scaleVal = el('span', { style: { color: '#fbbf24', fontFamily: 'monospace', fontSize: '10px' } }, '1.00×');
    const scaleInput = el('input', {
      type: 'range', min: '0.20', max: '2.50', step: '0.02', value: '1',
      style: { width: '100%', cursor: 'pointer' },
      oninput: () => this.setUniformScale(parseFloat(scaleInput.value))
    });

    const posInputs = {};
    const makePosSlider = (label, axis, min, max, step) => {
      const val = el('span', { style: { color: '#38bdf8', fontFamily: 'monospace', fontSize: '10px' } }, '0.00');
      const inp = el('input', {
        type: 'range', min: String(min), max: String(max), step: String(step), value: '0',
        style: { width: '100%', cursor: 'pointer' },
        oninput: () => {
          this.state[axis] = parseFloat(inp.value);
          this._applyTransformToScene();
          this._syncUI();
        }
      });
      posInputs[axis] = { inp, val };
      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
          el('span', { style: { color: '#94a3b8' } }, label), val
        ]),
        inp
      ]);
    };

    const matSel = el('select', {
      style: { ...btnStyle, width: '100%', fontSize: '10px' },
      onchange: (e) => this.setMaterialOverride(e.target.value)
    }, [
      el('option', { value: 'original' }, 'Car Mat: Original'),
      el('option', { value: 'clay' }, 'Car Mat: Studio Clay'),
      el('option', { value: 'matte' }, 'Car Mat: Dark Matte'),
      el('option', { value: 'silver' }, 'Car Mat: Machined Silver')
    ]);

    const jsonBox = el('textarea', {
      rows: '2',
      style: {
        width: '100%',
        padding: '4px',
        fontSize: '9.5px',
        fontFamily: 'monospace',
        background: '#05080f',
        color: '#a5f3fc',
        border: '1px solid #263042',
        borderRadius: '3px',
        resize: 'vertical'
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          try {
            const parsed = JSON.parse(jsonBox.value);
            this.setTransform(parsed);
            this._setStatus('Applied JSON transform.', '#34d399');
          } catch (err) {
            this._setStatus('Invalid JSON: ' + err.message, '#f87171');
          }
        }
      }
    });

    const applyJsonBtn = el('button', {
      style: { ...btnStyle, fontSize: '9.5px', width: '100%' },
      onclick: () => {
        try {
          const parsed = JSON.parse(jsonBox.value);
          this.setTransform(parsed);
          this._setStatus('Applied JSON transform.', '#34d399');
        } catch (err) {
          this._setStatus('Invalid JSON: ' + err.message, '#f87171');
        }
      }
    }, 'Apply JSON Transform');

    let xformOpen = false;
    const xformBody = el('div', {
      style: { display: 'none', flexDirection: 'column', gap: '4px', padding: '4px', background: '#090d14', borderRadius: '4px', border: '1px solid #1e293b' }
    }, [
      rotLabel,
      rotBtns,
      snapRow,
      el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
        el('span', { style: { color: '#94a3b8' } }, 'Scale'), scaleVal
      ]),
      scaleInput,
      makePosSlider('Pos X', 'x', -24, 24, 0.2),
      makePosSlider('Pos Y', 'y', -16, 16, 0.2),
      makePosSlider('Pos Z', 'z', -30, 36, 0.2),
      matSel,
      jsonBox,
      applyJsonBtn
    ]);

    const xformToggle = el('button', {
      style: { ...btnStyle, width: '100%', textAlign: 'left', background: '#111927', color: '#cbd5e1', fontSize: '10px' },
      onclick: () => {
        xformOpen = !xformOpen;
        xformBody.style.display = xformOpen ? 'flex' : 'none';
        xformToggle.textContent = (xformOpen ? '▾ ' : '▸ ') + 'Position, 90° Rotate & Scale';
      }
    }, '▸ Position, 90° Rotate & Scale');

    const root = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
      fileInput,
      dropZone,
      statusEl,
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [visChk, visLbl]),
        movieBtn,
        clearBtn
      ]),
      modeRow,
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
          el('span', { style: { color: '#94a3b8' } }, 'Shell Translucency'), opVal
        ]),
        opInput
      ]),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace' } }, [
          el('span', { style: { color: '#94a3b8' } }, 'Cutaway Radius'), cutVal
        ]),
        cutInput
      ]),
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [stripChk, stripLbl]),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [fitChk, fitLbl])
      ]),
      fitEl,
      xformToggle,
      xformBody
    ]);

    this._uiRefs = {
      root, statusEl, visChk, movieBtn, modeBtns,
      opInput, opVal, cutInput, cutVal, stripChk, fitChk, fitEl,
      rotLabel, scaleInput, scaleVal, posInputs, matSel, jsonBox
    };

    this._syncUI();
    return root;
  }

  clear(keepUiStatus = false) {
    this.stopShowcaseMovie();

    if (this._loadedScene) {
      this.contentGroup.remove(this._loadedScene);
      this._loadedScene.traverse((node) => {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          const orig = node.userData?._origMeshMat;
          const mats = Array.isArray(orig || node.material) ? (orig || node.material) : [orig || node.material];
          for (const m of mats) {
            if (!m) continue;
            for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
              if (m[k] && typeof m[k].dispose === 'function') m[k].dispose();
            }
            if (typeof m.dispose === 'function') m.dispose();
          }
        }
      });
      this._loadedScene = null;
    }

    while (this.prepassGroup.children.length > 0) {
      this.prepassGroup.remove(this.prepassGroup.children[0]);
    }

    this._assetMeshes = [];
    this._assetMaterials.clear();
    this._loadedFileName = '';

    if (!keepUiStatus) {
      this._setStatus('No GLB loaded (drop anytime).', '#94a3b8');
      this._syncUI();
      if (typeof this.options.onClear === 'function') this.options.onClear();
    }
  }

  destroy() {
    this.clear(true);
    if (this._dropCleanup) {
      this._dropCleanup();
      this._dropCleanup = null;
    }
    if (this._prepassMaterial) {
      try { this._prepassMaterial.dispose(); } catch (e) {}
      this._prepassMaterial = null;
    }
    if (this._overrideMat) {
      try { this._overrideMat.dispose(); } catch (e) {}
      this._overrideMat = null;
    }
    for (const d of this._fitGuideDisposables) {
      try { d.dispose(); } catch (e) {}
    }
    this._fitGuideDisposables = [];
    if (this.app?.scene && this.rootGroup) {
      this.app.scene.remove(this.rootGroup);
    }
    this._uiRefs = {};
  }
}

globalThis.DropInAsset = DropInAsset;
if (typeof window !== 'undefined') window.DropInAsset = DropInAsset;
if (typeof module !== 'undefined' && module.exports) module.exports = DropInAsset;