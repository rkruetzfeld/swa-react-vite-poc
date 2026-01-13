// scripts/generate-sample-data.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outRoot = path.join(root, "public", "sample-data");
const linesDir = path.join(outRoot, "estimate-lines");

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function uuid() {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function isoDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function isoDaysFrom(iso, daysFrom) {
  const d = new Date(iso);
  d.setDate(d.getDate() + daysFrom);
  return d.toISOString();
}

// Keep these stable-ish and realistic
const STATUSES = ["Draft", "Submitted", "Approved", "Completed"];
const CLIENTS = [
  "Custom Solutions Inc.",
  "Camtom Syites",
  "Perichen Gretet",
  "Gatom Sjites",
  "Coculse Serviets",
  "North Ridge Civil",
  "Blue Pine Infrastructure",
  "Westland Construction",
  "Valley & Sons",
  "Evergreen Works"
];

const TITLES = [
  "Bridge deck rehab — Phase 1",
  "Road widening — Segment B",
  "Drainage improvements",
  "Culvert replacement program",
  "Paving rehab — corridor pricing",
  "Retaining wall repairs",
  "Slope stabilization",
  "Intersection upgrade",
  "Shoulder grading",
  "Erosion protection"
];

// Item catalog (drives dropdown + lookup)
const ITEMS = [
  { section: "Mobilization", costCode: "60-MOB-100-001", description: "Mobilization (LS)", uom: "LS", defaultUnitRate: 35000 },
  { section: "Earthworks", costCode: "60-EARTH-210-010", description: "Excavation (m3)", uom: "m3", defaultUnitRate: 18.5 },
  { section: "Earthworks", costCode: "60-EARTH-220-020", description: "Fill import & place (m3)", uom: "m3", defaultUnitRate: 24.0 },
  { section: "Drainage", costCode: "60-DRAIN-310-005", description: "Culvert supply & install (m)", uom: "m", defaultUnitRate: 420.0 },
  { section: "Paving", costCode: "60-PAVE-410-030", description: "Asphalt paving (t)", uom: "t", defaultUnitRate: 155.0 },
  { section: "Structures", costCode: "60-STR-510-001", description: "Concrete placement (m3)", uom: "m3", defaultUnitRate: 420.0 },
  { section: "Traffic", costCode: "60-TRAF-610-010", description: "Traffic control (day)", uom: "day", defaultUnitRate: 3200.0 },
  { section: "General", costCode: "60-GEN-900-001", description: "Project management (day)", uom: "day", defaultUnitRate: 1800.0 }
];

function weightedStatus() {
  // A bit more realistic distribution
  const r = Math.random();
  if (r < 0.35) return "Draft";
  if (r < 0.55) return "Submitted";
  if (r < 0.75) return "Approved";
  return "Completed";
}

function generateHeaders(count) {
  const headers = [];
  for (let i = 0; i < count; i++) {
    const id = (1000 + i).toString();
    const status = weightedStatus();
    const daysAgo = randInt(1, 365 * 2);
    const created = isoDaysAgo(daysAgo);
    const due = isoDaysFrom(created, randInt(7, 45));

    headers.push({
      estimateId: id,
      client: pick(CLIENTS),
      title: pick(TITLES),
      status,
      dateCreated: created,
      dueDate: due,
      lastUpdated: isoDaysFrom(created, randInt(0, 30))
    });
  }
  return headers;
}

function generateLinesForEstimate(estimateId, lineCount) {
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    const it = ITEMS[i % ITEMS.length];
    const qty = randInt(1, 12);
    const rateJitter = 1 + (Math.random() * 0.12 - 0.06); // +/-6%
    const unitRate = Math.round(it.defaultUnitRate * rateJitter * 100) / 100;

    lines.push({
      lineId: uuid(),
      lineNo: i + 1,
      section: it.section,
      costCode: it.costCode,
      description: it.description,
      uom: it.uom,
      qty,
      unitRate,
      notes: ""
    });
  }
  return lines;
}

function main() {
  mkdirp(outRoot);
  mkdirp(linesDir);

  // 300 estimate headers
  const headers = generateHeaders(300);

  // Items catalog
  writeJson(path.join(outRoot, "items.json"), ITEMS);

  // Header file
  writeJson(path.join(outRoot, "estimates.json"), headers);

  // Lines: 50% big (300-1000), 50% smaller (30-120)
  const bigSet = new Set();
  while (bigSet.size < 150) {
    bigSet.add(headers[randInt(0, headers.length - 1)].estimateId);
  }

  for (const h of headers) {
    const isBig = bigSet.has(h.estimateId);
    const count = isBig ? randInt(300, 1000) : randInt(30, 120);
    const lines = generateLinesForEstimate(h.estimateId, count);
    writeJson(path.join(linesDir, `${h.estimateId}.json`), lines);
  }

  console.log(`✅ Generated:
  - ${headers.length} estimates: ${path.join(outRoot, "estimates.json")}
  - ${ITEMS.length} items: ${path.join(outRoot, "items.json")}
  - ${headers.length} line files: ${linesDir}\\<id>.json
  - Big estimates (300-1000 lines): 150`);
}

main();
