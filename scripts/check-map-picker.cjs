const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = process.argv[2] || path.resolve(__dirname, "..");
const ts = require(path.join(root, "node_modules/typescript"));
const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
    return require(name);
  }, module, module.exports);
  cache.set(relative, module.exports);
  return module.exports;
}
const location = load("lib/map-location.ts");
assert.deepEqual(location.parseLocationPin({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
for (const pin of [null, {}, { latitude: "14", longitude: 121 }, { latitude: 91, longitude: 0 }, { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: Infinity }]) assert.equal(location.parseLocationPin(pin), null);
assert.equal(location.parseMapMessage('not json'), null);
assert.equal(location.parseMapMessage({ channel: "other", type: "pin", pin: { latitude: 0, longitude: 0 } }), null);
assert.equal(location.parseMapMessage({ channel: "boses-map-picker", type: "pin", pin: { latitude: 0, longitude: 200 } }), null);
const { osmPickerHtml } = load("lib/osm-picker-html.ts");
const html = osmPickerHtml(null);
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
scripts.forEach(script => new vm.Script(script));
const events = [], handlers = {}, tileHandlers = {};
let point, onDrag;
const map = { fitBounds() { return this; }, setMinZoom() { return this; }, getBoundsZoom() { return 16; }, getMinZoom() { return 16; }, setView() { return this; }, on(name, callback) { handlers[name] = callback; return this; }, getContainer() { return { addEventListener() {} }; }, getSize() { return { x: 390, y: 640 }; }, latLngToContainerPoint(value) { return { x: value[1], y: value[0] }; }, invalidateSize() {} };
const leaflet = {
  map: () => map,
  DomEvent: { disableClickPropagation() {} },
  latLngBounds: () => ({ pad() { return this; } }),
  polygon: () => ({ addTo() {} }),
  control: { zoom: () => ({ addTo() {} }) },
  tileLayer: () => ({ on(name, callback) { tileHandlers[name] = callback; return this; }, addTo() { tileHandlers.tileload(); return this; } }),
  divIcon: options => options,
  latLng: (lat, lng) => ({ lat, lng }),
  marker: initial => { point = initial; return { addTo() { return this; }, on(name, callback) { if (name === "dragend") onDrag = callback; return this; }, setLatLng(value) { point = value; }, getLatLng() { return point; } }; },
};
const context = vm.createContext({ document: { addEventListener() {}, getElementById() { return { style: {}, setAttribute() {}, getAttribute() { return ""; }, classList: { add() {}, remove() {} } }; } }, L: leaflet, window: { addEventListener() {}, L: leaflet, ReactNativeWebView: { postMessage: value => events.push(JSON.parse(value)) } }, clearTimeout() {}, setTimeout: callback => callback() });
scripts.forEach(script => vm.runInContext(script, context));
assert.equal(events.filter(event => event.type === "pin").length, 0, "Default map center must never become a selected pin");
handlers.click({ latlng: { lat: 14.6217392, lng: 121.0708914 } });
assert.equal(events.at(-1).pin.latitude, 14.6217392);
point = { lat: 14.62165, lng: 121.07075 }; onDrag();
assert.equal(events.at(-1).pin.latitude, 14.62165);
const { isWithinMilagrosa } = load("lib/service-area.ts");
const { MILAGROSA_BOUNDARY, MILAGROSA_BOUNDS } = load("lib/milagrosa-boundary.ts");
assert.equal(isWithinMilagrosa({ latitude: 14.6217392, longitude: 121.0708914 }), true);
assert.equal(isWithinMilagrosa({ latitude: 14.676, longitude: 121.0437 }), false);
for (const [latitude, longitude] of MILAGROSA_BOUNDARY) assert.equal(isWithinMilagrosa({ latitude, longitude }), true, "Boundary edges are selectable");
const previousPoint = { ...point };
handlers.click({ latlng: { lat: 14.676, lng: 121.0437 } });
assert.equal(events.at(-1).type, "outside");
assert.deepEqual(point, previousPoint);
point = { lat: 14.676, lng: 121.0437 }; onDrag();
assert.equal(events.at(-1).type, "outside");
assert.equal(point.lat, previousPoint.lat, "Outside drag must restore the last valid pin");
let excludedInsideBox = 0;
for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
  const latitude = MILAGROSA_BOUNDS[0][0] + (MILAGROSA_BOUNDS[1][0] - MILAGROSA_BOUNDS[0][0]) * a / 10;
  const longitude = MILAGROSA_BOUNDS[0][1] + (MILAGROSA_BOUNDS[1][1] - MILAGROSA_BOUNDS[0][1]) * b / 10;
  const inside = isWithinMilagrosa({ latitude, longitude });
  handlers.click({ latlng: { lat: latitude, lng: longitude } });
  assert.equal(events.at(-1).type, inside ? "pin" : "outside", "Native and HTML containment must agree");
  if (!inside) excludedInsideBox++;
}
assert.ok(excludedInsideBox > 0, "Restriction must follow the polygon, not just its bounding box");
const submission = load("lib/api/serviceComplaintSubmission.ts");
const input = { referenceNo: "TEST", userId: "user", category: { value: "road", label: "Road" }, location: "Test location", description: "Test concern", photoPaths: [], locationPin: { latitude: 14.6217392, longitude: 121.0708914 } };
assert.deepEqual(submission.buildServiceComplaintRow(input).full_details.locationPin, input.locationPin);
assert.equal("latitude" in submission.buildServiceComplaintRow(input), false, "Do not write unverified schema columns");
assert.equal("locationPin" in submission.buildServiceComplaintRow({ ...input, locationPin: null }).full_details, false);
assert.throws(() => submission.buildServiceComplaintRow({ ...input, locationPin: { latitude: 200, longitude: 0 } }));
assert.throws(() => submission.buildServiceComplaintRow({ ...input, locationPin: { latitude: 14.676, longitude: 121.0437 } }));
if (process.argv[3]) fs.writeFileSync(process.argv[3], html);
console.log("Map geometry, in/out-of-area tap and drag, boundary edges, and submission validation passed.");

