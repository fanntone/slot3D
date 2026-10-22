// 體素工具：把像素圖（字串列）擠出成方塊幾何，並做麥塊式的方向性明暗（頂面亮、底面暗）。
import * as THREE from 'three';

const FACE_SHADE = { px: 0.8, nx: 0.8, py: 1.0, ny: 0.55, pz: 0.92, nz: 0.6 };
const DIRS = {
  px: { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  nx: { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  py: { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  ny: { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  pz: { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  nz: { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
};

const colorCache = new Map();
export function hexToRgb(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    const col = new THREE.Color(hex);
    c = [col.r, col.g, col.b];
    colorCache.set(hex, c);
  }
  return c;
}

/**
 * 從 3D 體素函式建立幾何。
 * @param {object} opts
 * @param {number} opts.w,h,d 尺寸
 * @param {(x:number,y:number,z:number)=>string|null} opts.at 回傳該體素顏色（hex）或 null
 * @param {number} [opts.unit=1] 每體素邊長
 * @param {boolean} [opts.center=true] 以中心為原點
 */
export function buildVoxels({ w, h, d, at, unit = 1, center = true, shade = FACE_SHADE }) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const ox = center ? -w / 2 : 0;
  const oy = center ? -h / 2 : 0;
  const oz = center ? -d / 2 : 0;
  const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < w && y < h && z < d && !!at(x, y, z);
  let v = 0;
  for (let z = 0; z < d; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const hex = at(x, y, z);
        if (!hex) continue;
        const rgb = hexToRgb(hex);
        for (const [key, dir] of Object.entries(DIRS)) {
          const [nx, ny, nz] = dir.n;
          if (solid(x + nx, y + ny, z + nz)) continue;
          const s = shade[key];
          for (const [cx, cy, cz] of dir.corners) {
            positions.push((x + cx + ox) * unit, (y + cy + oy) * unit, (z + cz + oz) * unit);
            normals.push(nx, ny, nz);
            colors.push(rgb[0] * s, rgb[1] * s, rgb[2] * s);
          }
          indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
          v += 4;
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 像素圖擠出：rows 是等寬字串，每個字元查 palette；'.' 或空白為透明。
 * depth 為擠出厚度；bevel 為 true 時最外圈像素厚度減一（圓潤感）。
 */
export function extrudePixels(rows, palette, { depth = 2, unit = 1, bevel = true, backColor = null } = {}) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px = (x, y) => {
    const ch = rows[h - 1 - y]?.[x];
    if (!ch || ch === '.' || ch === ' ') return null;
    return palette[ch] ?? null;
  };
  const edge = (x, y) => !px(x - 1, y) || !px(x + 1, y) || !px(x, y - 1) || !px(x, y + 1);
  return buildVoxels({
    w,
    h,
    d: depth,
    unit,
    at: (x, y, z) => {
      const c = px(x, y);
      if (!c) return null;
      if (bevel && depth > 1 && z === depth - 1 && edge(x, y)) return null;
      if (backColor && z === 0 && depth > 1) return backColor;
      return c;
    },
  });
}

// 多層體素（每層一張像素圖，由後到前），用來做有厚度變化的模型。
export function stackLayers(layers, palette, { unit = 1 } = {}) {
  const d = layers.length;
  const h = Math.max(...layers.map((l) => l.length));
  const w = Math.max(...layers.flatMap((l) => l.map((r) => r.length)));
  return buildVoxels({
    w,
    h,
    d,
    unit,
    at: (x, y, z) => {
      const rows = layers[z];
      const ch = rows[rows.length - 1 - y]?.[x];
      if (!ch || ch === '.' || ch === ' ') return null;
      return palette[ch] ?? null;
    },
  });
}

export const voxelMaterial = (opts = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });

// 單色方塊（已烘焙明暗），給粒子與簡單裝飾用。
const cubeCache = new Map();
export function shadedCube(hex) {
  let g = cubeCache.get(hex);
  if (!g) {
    g = buildVoxels({ w: 1, h: 1, d: 1, at: () => hex });
    cubeCache.set(hex, g);
  }
  return g;
}
