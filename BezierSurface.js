class BezierSurface {
  constructor(controlPoints) {
    this.controlPoints = controlPoints;
    this.degU = controlPoints.length - 1;
    this.degV = controlPoints[0].length - 1;
  }

  static binomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let res = 1;
    const m = Math.min(k, n - k);
    for (let i = 1; i <= m; i++) {
      res = (res * (n - m + i)) / i;
    }
    return res;
  }

  static bernstein(n, i, t) {
    if (i < 0 || i > n) return 0;
    const u = 1 - t;
    return BezierSurface.binomial(n, i) * Math.pow(t, i) * Math.pow(u, n - i);
  }

  static bernsteinDeriv(n, i, t) {
    if (n === 0) return 0;
    const b1 = i > 0 ? BezierSurface.bernstein(n - 1, i - 1, t) : 0;
    const b2 = i < n ? BezierSurface.bernstein(n - 1, i, t) : 0;
    return n * (b1 - b2);
  }

  static chebyshevLobattoNodes(count) {
    const nodes = [];
    const n = count - 1;
    for (let k = 0; k <= n; k++) {
      nodes.push(0.5 * (1 - Math.cos((k * Math.PI) / n)));
    }
    return nodes;
  }

  static invertSquareMatrix(mat) {
    const n = mat.length;
    const a = mat.map((row) => row.slice());
    const inv = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    );

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxAbs = Math.abs(a[col][col]);
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(a[r][col]);
        if (v > maxAbs) {
          maxAbs = v;
          pivotRow = r;
        }
      }
      if (maxAbs < 1e-12) {
        throw new Error('Singular matrix in BezierSurface.invertSquareMatrix');
      }
      if (pivotRow !== col) {
        const tmpA = a[col];
        a[col] = a[pivotRow];
        a[pivotRow] = tmpA;
        const tmpI = inv[col];
        inv[col] = inv[pivotRow];
        inv[pivotRow] = tmpI;
      }

      const diag = a[col][col];
      for (let c = 0; c < n; c++) {
        a[col][c] /= diag;
        inv[col][c] /= diag;
      }

      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = a[r][col];
        if (factor === 0) continue;
        for (let c = 0; c < n; c++) {
          a[r][c] -= factor * a[col][c];
          inv[r][c] -= factor * inv[col][c];
        }
      }
    }
    return inv;
  }

  static fitFromGrid(grid, degU, degV, uNodes, vNodes) {
    const rows = grid.length;
    const cols = grid[0].length;
    const uPts = uNodes || BezierSurface.chebyshevLobattoNodes(rows);
    const vPts = vNodes || BezierSurface.chebyshevLobattoNodes(cols);

    if (rows !== degU + 1 || cols !== degV + 1) {
      throw new Error('fitFromGrid expects grid dimensions (degU+1) x (degV+1).');
    }

    const mu = Array.from({ length: rows }, (_, a) =>
      Array.from({ length: rows }, (_, i) => BezierSurface.bernstein(degU, i, uPts[a]))
    );
    const mv = Array.from({ length: cols }, (_, b) =>
      Array.from({ length: cols }, (_, j) => BezierSurface.bernstein(degV, j, vPts[b]))
    );

    const invU = BezierSurface.invertSquareMatrix(mu);
    const invV = BezierSurface.invertSquareMatrix(mv);

    const temp = Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, b) => {
        let x = 0, y = 0, z = 0;
        for (let a = 0; a < rows; a++) {
          const w = invU[i][a];
          const p = grid[a][b];
          x += w * p.x;
          y += w * p.y;
          z += w * p.z;
        }
        return { x, y, z };
      })
    );

    const ctrl = Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => {
        let x = 0, y = 0, z = 0;
        for (let b = 0; b < cols; b++) {
          const w = invV[j][b];
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

  evaluate(u, v) {
    const bu = [];
    const bv = [];
    for (let i = 0; i <= this.degU; i++) bu.push(BezierSurface.bernstein(this.degU, i, u));
    for (let j = 0; j <= this.degV; j++) bv.push(BezierSurface.bernstein(this.degV, j, v));

    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= this.degU; i++) {
      const row = this.controlPoints[i];
      const wu = bu[i];
      for (let j = 0; j <= this.degV; j++) {
        const w = wu * bv[j];
        const p = row[j];
        x += w * p.x;
        y += w * p.y;
        z += w * p.z;
      }
    }
    return { x, y, z };
  }

  evaluateWithPartials(u, v) {
    const bu = [], dbu = [], bv = [], dbv = [];
    for (let i = 0; i <= this.degU; i++) {
      bu.push(BezierSurface.bernstein(this.degU, i, u));
      dbu.push(BezierSurface.bernsteinDeriv(this.degU, i, u));
    }
    for (let j = 0; j <= this.degV; j++) {
      bv.push(BezierSurface.bernstein(this.degV, j, v));
      dbv.push(BezierSurface.bernsteinDeriv(this.degV, j, v));
    }

    let px = 0, py = 0, pz = 0;
    let ux = 0, uy = 0, uz = 0;
    let vx = 0, vy = 0, vz = 0;

    for (let i = 0; i <= this.degU; i++) {
      const row = this.controlPoints[i];
      const wU = bu[i];
      const dwU = dbu[i];
      for (let j = 0; j <= this.degV; j++) {
        const wV = bv[j];
        const dwV = dbv[j];
        const p = row[j];

        const w = wU * wV;
        px += w * p.x;
        py += w * p.y;
        pz += w * p.z;

        const wu = dwU * wV;
        ux += wu * p.x;
        uy += wu * p.y;
        uz += wu * p.z;

        const wv = wU * dwV;
        vx += wv * p.x;
        vy += wv * p.y;
        vz += wv * p.z;
      }
    }

    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const nLen = Math.hypot(nx, ny, nz) || 1;

    return {
      point: { x: px, y: py, z: pz },
      du: { x: ux, y: uy, z: uz },
      dv: { x: vx, y: vy, z: vz },
      normal: { x: nx / nLen, y: ny / nLen, z: nz / nLen }
    };
  }

  sampleMeshData(segU, segV, flipWinding = false) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const sign = flipWinding ? -1 : 1;

    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      for (let j = 0; j <= segV; j++) {
        const v = j / segV;
        const ev = this.evaluateWithPartials(u, v);
        positions.push(ev.point.x, ev.point.y, ev.point.z);
        normals.push(ev.normal.x * sign, ev.normal.y * sign, ev.normal.z * sign);
        uvs.push(u, v);
      }
    }

    const stride = segV + 1;
    for (let i = 0; i < segU; i++) {
      for (let j = 0; j < segV; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        if (flipWinding) {
          indices.push(a, c, b);
          indices.push(a, d, c);
        } else {
          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
    }

    return { positions, normals, uvs, indices };
  }

  static buildGeometryFromPatches(THREE, patches) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vertexOffset = 0;

    for (const item of patches) {
      const data = item.surface.sampleMeshData(item.segU, item.segV, item.flipWinding);
      for (let k = 0; k < data.positions.length; k++) positions.push(data.positions[k]);
      for (let k = 0; k < data.normals.length; k++) normals.push(data.normals[k]);
      for (let k = 0; k < data.uvs.length; k++) uvs.push(data.uvs[k]);
      for (let k = 0; k < data.indices.length; k++) indices.push(data.indices[k] + vertexOffset);
      vertexOffset += data.positions.length / 3;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
  }

  static buildIsoWireframeGeometry(THREE, patches, strideU = 2, strideV = 2, normalOffset = 0.0006) {
      const positions = [];

      for (const item of patches) {
        const segU = item.segU;
        const segV = item.segV;
        const sign = item.flipWinding ? -1 : 1;
        const grid = Array.from({ length: segU + 1 }, (_, i) => {
          const u = i / segU;
          return Array.from({ length: segV + 1 }, (_, j) => {
            const v = j / segV;
            const ev = item.surface.evaluateWithPartials(u, v);
            return {
              x: ev.point.x + ev.normal.x * sign * normalOffset,
              y: ev.point.y + ev.normal.y * sign * normalOffset,
              z: ev.point.z + ev.normal.z * sign * normalOffset
            };
          });
        });

        const uIndices = [];
        for (let i = 0; i <= segU; i += strideU) uIndices.push(i);
        if (uIndices[uIndices.length - 1] !== segU) uIndices.push(segU);

        for (const i of uIndices) {
          for (let j = 0; j < segV; j++) {
            const a = grid[i][j];
            const b = grid[i][j + 1];
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }

        const vIndices = [];
        for (let j = 0; j <= segV; j += strideV) vIndices.push(j);
        if (vIndices[vIndices.length - 1] !== segV) vIndices.push(segV);

        for (const j of vIndices) {
          for (let i = 0; i < segU; i++) {
            const a = grid[i][j];
            const b = grid[i + 1][j];
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return geom;
    }

  static buildDiagnosticGeometry(THREE, patches) {
      const palette = [
        [0.16, 0.78, 0.52],
        [0.95, 0.42, 0.36],
        [0.98, 0.75, 0.22],
        [0.42, 0.50, 0.62],
        [0.22, 0.80, 0.96],
        [0.86, 0.44, 0.92]
      ];

      const positions = [];
      const normals = [];
      const colors = [];
      const indices = [];
      let vertexOffset = 0;

      for (let pIdx = 0; pIdx < patches.length; pIdx++) {
        const item = patches[pIdx];
        const col = item.color || palette[pIdx % palette.length];
        const data = item.surface.sampleMeshData(item.segU, item.segV, item.flipWinding);
        const vCount = data.positions.length / 3;
        for (let k = 0; k < data.positions.length; k++) positions.push(data.positions[k]);
        for (let k = 0; k < data.normals.length; k++) normals.push(data.normals[k]);
        for (let k = 0; k < vCount; k++) colors.push(col[0], col[1], col[2]);
        for (let k = 0; k < data.indices.length; k++) indices.push(data.indices[k] + vertexOffset);
        vertexOffset += vCount;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setIndex(indices);
      return geom;
    }

  static buildNormalNeedlesGeometry(THREE, patches, length = 0.032) {
      const positions = [];
      const samples = [0.15, 0.5, 0.85];

      for (const item of patches) {
        const sign = item.flipWinding ? -1 : 1;
        for (const u of samples) {
          for (const v of samples) {
            const ev = item.surface.evaluateWithPartials(u, v);
            const nx = ev.normal.x * sign;
            const ny = ev.normal.y * sign;
            const nz = ev.normal.z * sign;
            positions.push(
              ev.point.x, ev.point.y, ev.point.z,
              ev.point.x + nx * length, ev.point.y + ny * length, ev.point.z + nz * length
            );
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return geom;
    }
}

globalThis.BezierSurface = BezierSurface;
if (typeof module !== 'undefined' && module.exports) module.exports = BezierSurface;