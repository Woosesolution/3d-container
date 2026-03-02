import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { DragControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/DragControls.js";

const PALLET_BASE_H_MM = 100;
const PALLET_SELF_WEIGHT_KG = 70;

const productListEl = document.getElementById("productList");
const tpl = document.getElementById("productRowTpl");
const addProductBtn = document.getElementById("addProductBtn");
const buildPalletBtn = document.getElementById("buildPalletBtn");
const runBtn = document.getElementById("runBtn");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const addProductDialog = document.getElementById("addProductDialog");
const addProductForm = document.getElementById("addProductForm");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const newMassMode = document.getElementById("newMassMode");
const densityWrap = document.getElementById("densityWrap");
const weightWrap = document.getElementById("weightWrap");

const inputs = {
  containerL: document.getElementById("containerL"),
  containerW: document.getElementById("containerW"),
  containerH: document.getElementById("containerH"),
  containerMaxWeight: document.getElementById("containerMaxWeight"),
  heightLayers: document.getElementById("heightLayers"),
  widthSegments: document.getElementById("widthSegments"),
  heightFlexible: document.getElementById("heightFlexible"),
  widthFlexible: document.getElementById("widthFlexible"),
  fallbackStrategy: document.getElementById("fallbackStrategy")
};

const appState = {
  pallets: [],
  palletMeshes: [],
  dragControls: null
};

const viewer = document.getElementById("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xebf0f2);

const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 1000);
camera.position.set(12, 8, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(5, 1.5, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7b84, 0.95);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(8, 12, 4);
scene.add(dir);

const grid = new THREE.GridHelper(26, 26, 0x8aa1a8, 0xbecfd4);
grid.position.y = 0;
scene.add(grid);

const containerGroup = new THREE.Group();
scene.add(containerGroup);
const palletGroup = new THREE.Group();
scene.add(palletGroup);

window.addEventListener("resize", onResize);
addProductBtn.addEventListener("click", openAddProductDialog);
buildPalletBtn.addEventListener("click", handleBuildPallets);
runBtn.addEventListener("click", handleRun);
if (cancelAddBtn && addProductDialog) {
  cancelAddBtn.addEventListener("click", () => addProductDialog.close());
}
if (newMassMode) {
  newMassMode.addEventListener("change", syncMassModeUI);
}
if (addProductForm) {
  addProductForm.addEventListener("submit", handleAddProductSubmit);
}

addProductRow({ name: "A产品", color: "#1f77b4" });
addProductRow({ name: "B产品", color: "#e67e22", l: 500, w: 320, h: 280, density: 220, qty: 160 });
renderContainer();
onResize();
animate();
handleBuildPallets();

function syncMassModeUI() {
  if (!newMassMode || !densityWrap || !weightWrap) {
    return;
  }
  const mode = newMassMode.value;
  const useDensity = mode === "density";
  densityWrap.classList.toggle("hidden", !useDensity);
  weightWrap.classList.toggle("hidden", useDensity);
}

function openAddProductDialog() {
  if (!addProductDialog || !addProductForm || !newMassMode) {
    openPromptFallback();
    return;
  }
  syncMassModeUI();
  try {
    if (typeof addProductDialog.showModal === "function") {
      addProductDialog.showModal();
      return;
    }
    addProductDialog.setAttribute("open", "open");
  } catch {
    openPromptFallback();
  }
}

function closeAddProductDialog() {
  if (addProductDialog.open) {
    addProductDialog.close();
    return;
  }
  addProductDialog.removeAttribute("open");
}

function handleAddProductSubmit(ev) {
  ev.preventDefault();

  const name = document.getElementById("newName").value.trim() || "新产品";
  const color = document.getElementById("newColor").value || "#3f8efc";
  const l = Math.max(1, parseNumber(document.getElementById("newL").value, 600));
  const w = Math.max(1, parseNumber(document.getElementById("newW").value, 400));
  const h = Math.max(1, parseNumber(document.getElementById("newH").value, 300));
  const qty = Math.max(1, Math.floor(parseNumber(document.getElementById("newQty").value, 120)));

  const unitVolumeM3 = mmToM(l) * mmToM(w) * mmToM(h);
  const mode = newMassMode.value;
  let density = 180;

  if (mode === "unitWeight") {
    const unitWeightKg = Math.max(0.001, parseNumber(document.getElementById("newUnitWeight").value, 1));
    density = unitWeightKg / Math.max(0.000001, unitVolumeM3);
  } else {
    density = Math.max(1, parseNumber(document.getElementById("newDensity").value, 180));
  }

  addProductRow({ name, color, l, w, h, density, qty });
  closeAddProductDialog();
  handleBuildPallets();
  statusEl.textContent = `已新增 ${name}，并完成装拖计算与3D更新`;
}

function openPromptFallback() {
  const name = window.prompt("产品名称", "新产品");
  if (!name) {
    return;
  }
  const l = Math.max(1, parseNumber(window.prompt("长(mm)", "600"), 600));
  const w = Math.max(1, parseNumber(window.prompt("宽(mm)", "400"), 400));
  const h = Math.max(1, parseNumber(window.prompt("高(mm)", "300"), 300));
  const qty = Math.max(1, Math.floor(parseNumber(window.prompt("总件数", "120"), 120)));
  const mode = window.prompt("输入 d=密度 或 w=单件重量", "d");

  const unitVolumeM3 = mmToM(l) * mmToM(w) * mmToM(h);
  let density = 180;
  if ((mode || "").toLowerCase() === "w") {
    const unitWeightKg = Math.max(0.001, parseNumber(window.prompt("单件重量(kg)", "13"), 13));
    density = unitWeightKg / Math.max(0.000001, unitVolumeM3);
  } else {
    density = Math.max(1, parseNumber(window.prompt("密度(kg/m³)", "180"), 180));
  }

  addProductRow({ name: name.trim(), color: "#3f8efc", l, w, h, density, qty });
  handleBuildPallets();
  statusEl.textContent = `已新增 ${name.trim()}，并完成装拖计算与3D更新`;
}

function addProductRow(initial = {}) {
  const fragment = tpl.content.cloneNode(true);
  const row = fragment.querySelector(".product-row");

  row.querySelector(".p-name").value = initial.name ?? "新产品";
  row.querySelector(".p-color").value = initial.color ?? "#3f8efc";
  row.querySelector(".p-l").value = initial.l ?? 600;
  row.querySelector(".p-w").value = initial.w ?? 400;
  row.querySelector(".p-h").value = initial.h ?? 300;
  row.querySelector(".p-density").value = initial.density ?? 180;
  row.querySelector(".p-qty").value = initial.qty ?? 120;

  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    updateProductTitles();
    handleBuildPallets();
  });

  productListEl.appendChild(fragment);
  updateProductTitles();
}

function updateProductTitles() {
  [...productListEl.querySelectorAll(".product-row")].forEach((row, i) => {
    row.querySelector(".product-title").textContent = `产品 ${i + 1}`;
  });
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getConfig() {
  const container = {
    L: Math.max(100, parseNumber(inputs.containerL.value, 12032)),
    W: Math.max(100, parseNumber(inputs.containerW.value, 2352)),
    H: Math.max(100, parseNumber(inputs.containerH.value, 2698)),
    maxWeight: Math.max(1, parseNumber(inputs.containerMaxWeight.value, 26000))
  };

  const rules = {
    heightLayers: Math.max(1, Math.floor(parseNumber(inputs.heightLayers.value, 3))),
    widthSegments: Math.max(1, Math.floor(parseNumber(inputs.widthSegments.value, 2))),
    heightFlexible: (inputs.heightFlexible?.value || "yes") === "yes",
    widthFlexible: (inputs.widthFlexible?.value || "yes") === "yes",
    fallbackStrategy: inputs.fallbackStrategy?.value || "auto"
  };
  if (!rules.heightFlexible && !rules.widthFlexible) {
    rules.fallbackStrategy = "strict";
  }

  const products = [...productListEl.querySelectorAll(".product-row")].map((row, i) => ({
    id: `p-${i + 1}`,
    name: row.querySelector(".p-name").value || `产品${i + 1}`,
    color: row.querySelector(".p-color").value || "#3f8efc",
    l: Math.max(1, parseNumber(row.querySelector(".p-l").value, 600)),
    w: Math.max(1, parseNumber(row.querySelector(".p-w").value, 400)),
    h: Math.max(1, parseNumber(row.querySelector(".p-h").value, 300)),
    density: Math.max(1, parseNumber(row.querySelector(".p-density").value, 180)),
    qty: Math.max(1, Math.floor(parseNumber(row.querySelector(".p-qty").value, 120)))
  }));

  return { container, rules, products };
}

function mmToM(v) {
  return v / 1000;
}

function calcCandidate(product, container, seg, layers, layoutMode) {
  const unitVolumeM3 = mmToM(product.l) * mmToM(product.w) * mmToM(product.h);
  const unitWeightKg = unitVolumeM3 * product.density;
  const dims = [product.l, product.w, product.h].map((v) => Math.max(1, v)).sort((a, b) => a - b);
  const thickness = dims[0];
  const face = dims[1];
  const lengthDim = dims[2];
  const layerSlotH = container.H / layers;

  let unitsPerPallet = 0;
  let palletW = 0;
  let palletH = 0;
  let mode = layoutMode;
  let mixedOrientation = layoutMode === "mixed";
  let reason = "";
  let templates = [];
  let palletsNeeded = 0;
  let loadablePalletsForQty = 0;
  let maxPalletsBySpace = 0;
  let maxPalletsByWeight = 0;
  let maxPalletsInContainer = 0;
  let maxPcsInContainer = 0;
  let fullPalletWeight = 0;
  const palletL = lengthDim;
  const maxRowsLen = palletL > 0 ? Math.floor(container.L / palletL) : 0;

  if (layoutMode === "flat") {
    const flatWidthNeed = seg * face;
    const pcsFlat = Math.floor((layerSlotH - PALLET_BASE_H_MM) / thickness);
    const flatPalletH = pcsFlat > 0 ? pcsFlat * thickness + PALLET_BASE_H_MM : 0;
    const flatWeight = pcsFlat > 0 ? pcsFlat * unitWeightKg + PALLET_SELF_WEIGHT_KG : 0;

    if (flatWidthNeed <= container.W && pcsFlat > 0 && flatPalletH > 0) {
      unitsPerPallet = pcsFlat;
      palletW = face;
      palletH = flatPalletH;
      fullPalletWeight = flatWeight;
      templates = [{ kind: "flat", units: pcsFlat, W: face, H: flatPalletH, mixed: false }];
      palletsNeeded = Math.ceil(product.qty / pcsFlat);
      maxPalletsBySpace = maxRowsLen * seg * layers;
      maxPalletsByWeight = Math.floor(container.maxWeight / Math.max(0.0001, flatWeight));
      maxPalletsInContainer = Math.min(maxPalletsBySpace, maxPalletsByWeight);
      maxPcsInContainer = maxPalletsInContainer * pcsFlat;
      loadablePalletsForQty = Math.min(maxPalletsInContainer, palletsNeeded);
    } else {
      reason = flatWidthNeed > container.W ? `宽度无法放下 ${seg} 宽平放（需要${flatWidthNeed}mm, 柜宽${container.W}mm）` : "高度不足以装片";
    }
  } else if (layoutMode === "mixed") {
    // 混装定义：柜内同时存在“横托”和“竖托”，单个托盘内不混。
    // 这里按 2 宽模式：1 个横托 + 1 个竖托（竖托高度=face+100）。
    const pcsFlat = Math.floor((layerSlotH - PALLET_BASE_H_MM) / thickness);
    const flatPalletH = pcsFlat > 0 ? pcsFlat * thickness + PALLET_BASE_H_MM : 0;
    const vertPalletH = face + PALLET_BASE_H_MM;
    const maxVertWidth = container.W - face;
    const pcsVert = Math.floor(maxVertWidth / thickness);
    const flatWeight = pcsFlat > 0 ? pcsFlat * unitWeightKg + PALLET_SELF_WEIGHT_KG : 0;
    const vertWeight = pcsVert > 0 ? pcsVert * unitWeightKg + PALLET_SELF_WEIGHT_KG : 0;

    if (
      seg === 2 &&
      pcsFlat > 0 &&
      pcsVert > 0 &&
      face + thickness <= container.W &&
      flatPalletH <= layerSlotH &&
      vertPalletH <= layerSlotH
    ) {
      mode = "mixed";
      mixedOrientation = true;
      unitsPerPallet = Math.round(((pcsFlat + pcsVert) / 2) * 10) / 10;
      palletW = face + thickness;
      palletH = Math.max(flatPalletH, vertPalletH);
      fullPalletWeight = Math.round(((flatWeight + vertWeight) / 2) * 10) / 10;
      templates = [
        { kind: "flat", units: pcsFlat, W: face, H: flatPalletH, mixed: true },
        { kind: "vertical", units: pcsVert, W: thickness, H: vertPalletH, mixed: true }
      ];

      const pairsNeeded = Math.ceil(product.qty / (pcsFlat + pcsVert));
      const maxPairsBySpace = maxRowsLen * layers;
      const pairWeight = flatWeight + vertWeight;
      const maxPairsByWeight = Math.floor(container.maxWeight / Math.max(0.0001, pairWeight));
      const maxPairs = Math.min(maxPairsBySpace, maxPairsByWeight);
      maxPalletsBySpace = maxPairsBySpace * 2;
      maxPalletsByWeight = maxPairsByWeight * 2;
      maxPalletsInContainer = maxPairs * 2;
      maxPcsInContainer = maxPairs * (pcsFlat + pcsVert);
      palletsNeeded = pairsNeeded * 2;
      loadablePalletsForQty = Math.min(maxPalletsInContainer, palletsNeeded);
    } else {
      reason = `横+竖混装不可行（需要2宽，且竖托高度${vertPalletH}mm需<=每层高度${layerSlotH.toFixed(0)}mm）`;
    }
  }

  const fitCheck = palletL <= container.L && templates.length > 0;

  return {
    ...product,
    unitVolumeM3,
    unitWeightKg,
    unitsPerPallet,
    unitsPerPalletRaw: templates.length ? unitsPerPallet : 0,
    unitsAlongW: mode === "flat" ? seg : mode === "mixed" ? 2 : 0,
    unitsAlongH: 0,
    palletL,
    palletW,
    palletH,
    fullPalletWeight,
    palletsNeeded,
    loadablePalletsForQty,
    maxPalletsBySpace,
    maxPalletsByWeight,
    maxPalletsInContainer,
    maxPcsInContainer,
    fitCheck,
    mode,
    mixedOrientation,
    reason,
    seg,
    layers,
    palletTemplates: templates
  };
}

function pickBestCandidate(candidates) {
  const valid = candidates.filter((c) => c.fitCheck);
  if (!valid.length) {
    return candidates[0];
  }
  return valid.sort((a, b) => {
    if (b.maxPcsInContainer !== a.maxPcsInContainer) return b.maxPcsInContainer - a.maxPcsInContainer;
    if (b.maxPalletsInContainer !== a.maxPalletsInContainer) return b.maxPalletsInContainer - a.maxPalletsInContainer;
    return b.unitsPerPallet - a.unitsPerPallet;
  })[0];
}

function getPalletPlan(product, rules, container) {
  const targetSeg = Math.max(1, rules.widthSegments);
  const targetLayers = Math.max(1, rules.heightLayers);
  const strategy = rules.fallbackStrategy;
  const layerOptions = rules.heightFlexible
    ? Array.from({ length: targetLayers }, (_, i) => i + 1)
    : [targetLayers];
  const segOptions = rules.widthFlexible
    ? Array.from({ length: targetSeg }, (_, i) => i + 1)
    : [targetSeg];

  const baseFlat = calcCandidate(product, container, targetSeg, targetLayers, "flat");
  const oneWide = calcCandidate(product, container, 1, targetLayers, "flat");
  const mixed = calcCandidate(product, container, 2, targetLayers, "mixed");

  let candidateList = [];
  if (strategy === "strict") candidateList = [baseFlat];
  if (strategy === "oneWide") {
    candidateList = rules.widthFlexible || targetSeg === 1 ? [oneWide] : [baseFlat];
  }
  if (strategy === "mixed") {
    candidateList = rules.widthFlexible || targetSeg === 2 ? [mixed] : [baseFlat];
  }
  if (strategy === "auto") {
    for (const l of layerOptions) {
      for (const s of segOptions) {
        candidateList.push(calcCandidate(product, container, s, l, "flat"));
      }
      if (segOptions.includes(2)) {
        candidateList.push(calcCandidate(product, container, 2, l, "mixed"));
      }
    }
  }

  const selected = pickBestCandidate(candidateList);
  const suggestion = [
    !baseFlat.fitCheck ? `目标${targetSeg}宽不可行` : "",
    oneWide.fitCheck ? `可改1宽(每托${oneWide.unitsPerPallet}片)` : "",
    mixed.fitCheck ? `可用横+竖(每托${mixed.unitsPerPallet}片)` : ""
  ]
    .filter(Boolean)
    .join("；");

  return {
    ...selected,
    suggestion
  };
}

function generatePallets(config) {
  const plans = config.products.map((p) => getPalletPlan(p, config.rules, config.container));
  const pallets = [];

  plans.forEach((plan) => {
    if (!plan.palletTemplates?.length || plan.loadablePalletsForQty <= 0) {
      return;
    }
    let idx = 0;
    if (plan.mode === "mixed") {
      const pairs = Math.floor(plan.loadablePalletsForQty / 2);
      for (let p = 0; p < pairs; p += 1) {
        for (const tpl of plan.palletTemplates) {
          idx += 1;
          pallets.push({
            id: `${plan.id}-pl-${idx}`,
            name: `${plan.name}-${tpl.kind === "vertical" ? "竖托" : "横托"}${p + 1}`,
            productId: plan.id,
            color: plan.color,
            baseL: plan.palletL,
            baseW: tpl.W,
            L: plan.palletL,
            W: tpl.W,
            H: tpl.H,
            weight: tpl.units * plan.unitWeightKg + PALLET_SELF_WEIGHT_KG,
            units: tpl.units,
            mixedOrientation: true,
            position: null,
            rotated: false
          });
        }
      }
      return;
    }

    for (let i = 0; i < plan.loadablePalletsForQty; i += 1) {
      idx += 1;
      const tpl = plan.palletTemplates[0];
      pallets.push({
        id: `${plan.id}-pl-${idx}`,
        name: `${plan.name}-托盘${i + 1}`,
        productId: plan.id,
        color: plan.color,
        baseL: plan.palletL,
        baseW: tpl.W,
        L: plan.palletL,
        W: tpl.W,
        H: tpl.H,
        weight: tpl.units * plan.unitWeightKg + PALLET_SELF_WEIGHT_KG,
        units: tpl.units,
        mixedOrientation: false,
        position: null,
        rotated: false
      });
    }
  });

  return { plans, pallets };
}

function renderContainer() {
  containerGroup.clear();
  const cfg = getConfig().container;
  const L = mmToM(cfg.L);
  const W = mmToM(cfg.W);
  const H = mmToM(cfg.H);

  const geometry = new THREE.BoxGeometry(L, H, W);
  const material = new THREE.MeshBasicMaterial({ color: 0x1d7f74, transparent: true, opacity: 0.05 });
  const box = new THREE.Mesh(geometry, material);
  box.position.set(L / 2, H / 2, 0);
  containerGroup.add(box);

  const edges = new THREE.EdgesGeometry(geometry);
  const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0f4a43 }));
  lines.position.copy(box.position);
  containerGroup.add(lines);
}

function clearPalletMeshes() {
  if (appState.dragControls) {
    appState.dragControls.dispose();
    appState.dragControls = null;
  }
  appState.palletMeshes = [];
  palletGroup.clear();
}

function makePalletMesh(pallet) {
  const geo = new THREE.BoxGeometry(mmToM(pallet.L), mmToM(pallet.H), mmToM(pallet.W));
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pallet.color),
    roughness: 0.45,
    metalness: 0.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.pallet = pallet;
  if (pallet.mixedOrientation) {
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffb703 })
    );
    mesh.add(edge);
  }
  return mesh;
}

function buildMeshesFromPallets(pallets) {
  clearPalletMeshes();

  pallets.forEach((pallet) => {
    const mesh = makePalletMesh(pallet);
    const y = mmToM(pallet.H) / 2;
    const x = mmToM(pallet.L) / 2;
    const z = -mmToM(getConfig().container.W) / 2 + mmToM(pallet.W) / 2;
    mesh.position.set(x, y, z);
    pallet.position = { x, y, z };
    palletGroup.add(mesh);
    appState.palletMeshes.push(mesh);
  });
}

function getBounds(mesh, overridePos = null) {
  const p = mesh.userData.pallet;
  const pos = overridePos || mesh.position;
  const l = mmToM(p.L);
  const h = mmToM(p.H);
  const w = mmToM(p.W);

  return {
    minX: pos.x - l / 2,
    maxX: pos.x + l / 2,
    minY: pos.y - h / 2,
    maxY: pos.y + h / 2,
    minZ: pos.z - w / 2,
    maxZ: pos.z + w / 2
  };
}

function intersects(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function isInsideContainer(bounds, container) {
  const L = mmToM(container.L);
  const W = mmToM(container.W);
  const H = mmToM(container.H);

  return (
    bounds.minX >= 0 &&
    bounds.maxX <= L &&
    bounds.minY >= 0 &&
    bounds.maxY <= H &&
    bounds.minZ >= -W / 2 &&
    bounds.maxZ <= W / 2
  );
}

function autoPlacePallets(pallets, container) {
  const placed = [];
  const step = 0.08;

  for (const pallet of pallets) {
    pallet.L = pallet.baseL;
    pallet.W = pallet.baseW;
    pallet.rotated = false;

    const options = [{ L: pallet.baseL, W: pallet.baseW, rotated: false }];

    let found = null;
    for (const option of options) {
      const l = mmToM(option.L);
      const w = mmToM(option.W);
      const h = mmToM(pallet.H);

      if (l > mmToM(container.L) || w > mmToM(container.W) || h > mmToM(container.H)) {
        continue;
      }

      for (let y = h / 2; y <= mmToM(container.H) - h / 2 + 1e-6; y += h) {
        let yHit = false;
        for (let x = l / 2; x <= mmToM(container.L) - l / 2 + 1e-6; x += step) {
          let hit = false;
          for (let z = -mmToM(container.W) / 2 + w / 2; z <= mmToM(container.W) / 2 - w / 2 + 1e-6; z += step) {
            const candidate = {
              minX: x - l / 2,
              maxX: x + l / 2,
              minY: y - h / 2,
              maxY: y + h / 2,
              minZ: z - w / 2,
              maxZ: z + w / 2
            };

            const collide = placed.some((item) => intersects(candidate, item.bounds));
            if (!collide) {
              found = { x, y, z, option };
              hit = true;
              break;
            }
          }
          if (hit) {
            yHit = true;
            break;
          }
        }
        if (yHit) {
          break;
        }
      }
      if (found) {
        break;
      }
    }

    if (!found) {
      return { ok: false, reason: `托盘 ${pallet.name} 无法找到可放置位置` };
    }

    pallet.position = { x: found.x, y: found.y, z: found.z };
    pallet.rotated = false;

    placed.push({ pallet, bounds: getPalletBounds(pallet) });
  }

  return { ok: true, placed };
}

function getPalletBounds(pallet) {
  const pos = pallet.position;
  const l = mmToM(pallet.L);
  const h = mmToM(pallet.H);
  const w = mmToM(pallet.W);
  return {
    minX: pos.x - l / 2,
    maxX: pos.x + l / 2,
    minY: pos.y - h / 2,
    maxY: pos.y + h / 2,
    minZ: pos.z - w / 2,
    maxZ: pos.z + w / 2
  };
}

function renderPalletPositions() {
  clearPalletMeshes();
  appState.pallets.forEach((pallet) => {
    const mesh = makePalletMesh(pallet);
    if (pallet.position) {
      mesh.position.set(pallet.position.x, pallet.position.y, pallet.position.z);
    } else {
      const y = mmToM(pallet.H) / 2;
      const x = mmToM(pallet.L) / 2;
      const z = -mmToM(getConfig().container.W) / 2 + mmToM(pallet.W) / 2;
      mesh.position.set(x, y, z);
      pallet.position = { x, y, z };
    }
    palletGroup.add(mesh);
    appState.palletMeshes.push(mesh);
  });
}

function enableManualDrag() {
  if (appState.dragControls) {
    appState.dragControls.dispose();
  }

  appState.dragControls = new DragControls(appState.palletMeshes, camera, renderer.domElement);

  appState.dragControls.addEventListener("dragstart", (ev) => {
    controls.enabled = false;
    ev.object.userData.prev = ev.object.position.clone();
  });

  appState.dragControls.addEventListener("drag", (ev) => {
    const pallet = ev.object.userData.pallet;
    ev.object.position.y = mmToM(pallet.H) / 2;
  });

  appState.dragControls.addEventListener("dragend", (ev) => {
    controls.enabled = true;

    const cfg = getConfig().container;
    const current = ev.object;
    const bounds = getBounds(current);
    const inside = isInsideContainer(bounds, cfg);

    let collide = false;
    for (const m of appState.palletMeshes) {
      if (m === current) {
        continue;
      }
      if (intersects(bounds, getBounds(m))) {
        collide = true;
        break;
      }
    }

    if (!inside || collide) {
      current.position.copy(current.userData.prev);
      statusEl.textContent = !inside ? "放不进去：超出柜体边界" : "放不进去：与其他托盘碰撞";
      return;
    }

    const pallet = current.userData.pallet;
    pallet.position = { x: current.position.x, y: current.position.y, z: current.position.z };
    statusEl.textContent = `已放置 ${pallet.name}`;
  });
}

function updateSummary(plans, pallets, extra = "") {
  const containerPalletCount = pallets.length;
  const containerWeight = pallets.reduce((s, p) => s + p.weight, 0);

  const rows = plans
    .map(
      (p) => `
      <tr>
        <td>${p.name}</td>
        <td>${p.palletL.toFixed(0)} x ${p.palletW.toFixed(0)} x ${p.palletH.toFixed(0)}</td>
        <td>${
          p.mode === "mixed"
            ? `横托${p.palletTemplates[0]?.units || 0} / 竖托${p.palletTemplates[1]?.units || 0}`
            : `${p.unitsPerPallet}`
        }</td>
        <td>${p.maxPalletsInContainer}</td>
        <td>${p.maxPcsInContainer}</td>
        <td>${
          p.mode === "mixed"
            ? `横托${(p.palletTemplates[0]?.units * p.unitWeightKg + PALLET_SELF_WEIGHT_KG).toFixed(1)} / 竖托${(p.palletTemplates[1]?.units * p.unitWeightKg + PALLET_SELF_WEIGHT_KG).toFixed(1)}`
            : `${p.fullPalletWeight.toFixed(1)}`
        }</td>
        <td>${
          p.fitCheck
            ? `${p.layers}高${p.seg}宽-${p.mode === "mixed" ? "混装(横+竖)" : "平放"}${p.suggestion ? `；建议：${p.suggestion}` : ""}`
            : `${p.reason}${p.suggestion ? `；建议：${p.suggestion}` : ""}`
        }</td>
      </tr>`
    )
    .join("");

  summaryEl.innerHTML = `
    <div>整柜装托数: <strong>${containerPalletCount}</strong> 托</div>
    <div>整柜总重量: <strong>${containerWeight.toFixed(1)} kg</strong></div>
    <table class="summary-table">
      <thead>
        <tr><th>产品</th><th>托盘尺寸(mm)</th><th>pc/托</th><th>最多可装(托/柜)</th><th>总共pcs/柜</th><th>一托重量(kg,含托盘)</th><th>摆放/提示</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div>${extra}</div>
  `;
}

function handleBuildPallets() {
  const config = getConfig();
  renderContainer();

  const { plans, pallets } = generatePallets(config);
  appState.pallets = pallets;

  buildMeshesFromPallets(pallets);
  updateSummary(plans, pallets, "已按柜内最大可装能力计算并生成彩色托盘3D块。");
  const widthFail = plans.filter((p) => !p.fitCheck && p.reason.includes("宽度无法放下"));
  if (widthFail.length) {
    const msg = widthFail.map((p) => `${p.name}: ${p.reason}${p.suggestion ? `；建议：${p.suggestion}` : ""}`).join(" | ");
    statusEl.textContent = msg;
    return;
  }

  const overLimit = plans.filter((p) => p.fitCheck && p.maxPcsInContainer < p.qty);
  if (overLimit.length) {
    const tips = overLimit
      .map((p) =>
        p.mode === "mixed"
          ? `${p.name}: 最多 ${p.maxPalletsInContainer} 托, 横托${p.palletTemplates[0]?.units || 0}/竖托${p.palletTemplates[1]?.units || 0} pc, 共 ${p.maxPcsInContainer} pcs`
          : `${p.name}: 最多 ${p.maxPalletsInContainer} 托, ${p.unitsPerPallet} pc/托, 共 ${p.maxPcsInContainer} pcs`
      )
      .join(" | ");
    statusEl.textContent = `装不下，按上限计算。${tips}`;
    return;
  }
  statusEl.textContent = "托盘已生成";
}

function handleRun() {
  if (!appState.pallets.length) {
    handleBuildPallets();
  }

  const mode = document.querySelector("input[name='mode']:checked")?.value || "auto";
  const config = getConfig();

  const totalWeight = appState.pallets.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight > config.container.maxWeight) {
    statusEl.textContent = `超限重：${totalWeight.toFixed(1)}kg > ${config.container.maxWeight}kg`;
    return;
  }

  if (mode === "auto") {
    const result = autoPlacePallets(appState.pallets, config.container);
    if (!result.ok) {
      statusEl.textContent = `自动装柜失败：${result.reason}`;
      renderPalletPositions();
      return;
    }
    renderPalletPositions();
    if (appState.dragControls) {
      appState.dragControls.dispose();
      appState.dragControls = null;
    }
    statusEl.textContent = `自动装柜完成，共放入 ${appState.pallets.length} 托`;
    return;
  }

  renderPalletPositions();
  enableManualDrag();
  statusEl.textContent = "已进入手动拖拽模式，若碰撞或越界会自动回退。";
}

function onResize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.__openAddProductDialog = openAddProductDialog;
window.__handleBuildPallets = handleBuildPallets;
window.__handleRun = handleRun;
