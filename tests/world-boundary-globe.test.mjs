import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const componentPath = 'src/features/footprints/WorldBoundaryGlobe.vue';
const component = existsSync(componentPath) ? readFileSync(componentPath, 'utf8') : '';
const packageJson = existsSync('package.json') ? JSON.parse(readFileSync('package.json', 'utf8')) : {};

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('WorldBoundaryGlobe uses the original Three and WASM boundary pipeline', () => {
  assert.match(component, /defineProps<\{\s*visitedPlaces:\s*string\[\]/);
  assert.match(component, /visitedCoordinates\?:\s*VisitedCoordinate\[\]/);
  assert.match(component, /ref<HTMLElement \| null>/);
  assert.match(component, /import\('three'\)/);
  assert.match(component, /import\('three\/examples\/jsm\/controls\/OrbitControls\.js'\)/);
  assert.match(component, /import\('@\/assets\/wasm\/geo\/geo_wasm\.js'\)/);
  assert.match(component, /new wasm\.GeoProcessor\(\)/);
  assert.match(component, /\.process_geojson\(/);
  assert.match(component, /JSON\.stringify\(props\.visitedPlaces\)/);
  assert.match(component, /,\s*2\.01,\s*\)/);
  assert.match(component, /geoProcessor\.get_boundary_lines\(\)/);
  assert.match(component, /fetch\('\/maps\/world\.zh\.json'/);
  assert.match(component, /fetch\('\/maps\/china\.json'/);
  assert.doesNotMatch(component, /Path2D|CanvasRenderingContext2D|ctx\.|projectPoint|latLngToVector/);
});

test('WorldBoundaryGlobe defers heavy initialization until the globe is near the viewport', () => {
  assert.match(component, /let visibilityObserver: IntersectionObserver \| null = null/);
  assert.match(component, /let initializationStarted = false/);
  assert.match(component, /const startWhenVisible = \(\) => \{/);
  assert.match(component, /new IntersectionObserver/);
  assert.match(component, /rootMargin:\s*'240px 0px'/);
  assert.match(component, /visibilityObserver\.observe\(stageRef\.value\)/);
  assert.doesNotMatch(component, /onMounted\(\(\) => \{\s*mounted = true;\s*void initializeGlobe\(\);/s);
});

test('WorldBoundaryGlobe allows static map JSON to use normal browser cache', () => {
  assert.match(component, /fetch\('\/maps\/world\.zh\.json'\)/);
  assert.match(component, /fetch\('\/maps\/china\.json'\)/);
  assert.doesNotMatch(component, /Cache-Control': 'no-cache'|Cache-Control": "no-cache"/);
});

test('WorldBoundaryGlobe resolves lit regions from latitude and longitude before processing boundaries', () => {
  assert.match(component, /interface VisitedCoordinate\s*\{\s*lat:\s*number;\s*lng:\s*number;\s*\}/s);
  assert.match(component, /import \{ buildGeoHitIndex,\s*findRegionByLngLat,\s*vectorToLngLat \} from '\.\/geo-hit'/);
  assert.match(component, /hitIndex:\s*GeoHitIndex/);
  assert.match(component, /buildGeoHitIndex\(world,\s*china\)/);
  assert.match(component, /const resolveVisitedPlaces = \(/);
  assert.match(component, /props\.visitedCoordinates \?\?/);
  assert.match(component, /findRegionByLngLat\(mapDataCache\?\.hitIndex\s*\?\?\s*null,\s*coordinate\.lat,\s*coordinate\.lng\)/);
  assert.match(component, /geoProcessor\.find_nearest_country\(\s*point\.x,\s*point\.y,\s*point\.z,\s*2\.01,\s*\)/s);
  assert.match(component, /JSON\.stringify\(resolvedVisitedPlaces\)/);
  assert.match(component, /props\.visitedCoordinates\?\.map\(\(coordinate\) => `\$\{coordinate\.lat\},\$\{coordinate\.lng\}`\)\.join\('\\u0000'\)/);
});

test('WorldBoundaryGlobe creates a Three sphere with the original camera and renderer settings', () => {
  assert.match(component, /new ThreeScene\(\)/);
  assert.match(component, /new ThreePerspectiveCamera\(\s*45,/);
  assert.match(component, /new ThreeWebGLRenderer\(\{\s*antialias:\s*true,\s*alpha:\s*true,\s*logarithmicDepthBuffer:\s*true/s);
  assert.match(component, /renderer\.setClearColor\(0x000000,\s*0\)/);
  assert.match(component, /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio,\s*2\)\)/);
  assert.match(component, /new ThreeSphereGeometry\(2\.0,\s*64,\s*64\)/);
  assert.match(component, /new ThreeMeshBasicMaterial\(/);
  assert.match(component, /earth\.renderOrder = 1/);
  assert.match(component, /camera\.position\.copy\(new ThreeVector3\(-2\.1,\s*3\.41,\s*-6\.5\)\)/);
});

test('WorldBoundaryGlobe keeps OrbitControls behavior close to the original project', () => {
  assert.match(component, /new OrbitControls\(camera,\s*renderer\.domElement\)/);
  assert.match(component, /controls\.enableDamping = true/);
  assert.match(component, /controls\.dampingFactor = 0\.25/);
  assert.match(component, /controls\.rotateSpeed = 0\.2/);
  assert.match(component, /controls\.autoRotate = true/);
  assert.match(component, /controls\.autoRotateSpeed = 0\.12/);
  assert.match(component, /controls\.minDistance = 3\.6/);
  assert.match(component, /controls\.maxDistance = 15/);
  assert.match(component, /controls\.minPolarAngle = Math\.PI \* 0\.1/);
  assert.match(component, /controls\.maxPolarAngle = Math\.PI \* 0\.9/);
  assert.doesNotMatch(component, /hoveredCountry[^]*controls\.autoRotate = false|autoRotate = false/);
});

test('WorldBoundaryGlobe applies original boundary color and render-order semantics', () => {
  assert.match(component, /earthBase:\s*'#111827'/);
  assert.match(component, /visitedBorder:\s*'#10b981'/);
  assert.match(component, /chinaBorder:\s*'#f87171'/);
  assert.match(component, /border:\s*'#6b7280'/);
  assert.match(component, /highlight:\s*'#fcd34d'/);
  assert.match(component, /const RENDER_ORDER = \{\s*other:\s*1,\s*china:\s*2,\s*visited:\s*3,\s*highlight:\s*4,/s);
  assert.match(component, /const resolveRegionPriority = \(regionName: string, isVisited: boolean\) => \{/);
  assert.match(component, /if \(isVisited\) return RENDER_ORDER\.visited/);
  assert.match(component, /if \(regionName === '中国' \|\| regionName\.startsWith\('中国-'\)\) return RENDER_ORDER\.china/);
  assert.match(component, /const isChina = regionName === '中国' \|\| regionName\.startsWith\('中国-'\)/);
  assert.match(component, /if \(isVisited\) \{\s*borderColor = COLORS\.visitedBorder;/s);
  assert.match(component, /baseRenderOrder = RENDER_ORDER\.visited/);
  assert.match(component, /baseRenderOrder = RENDER_ORDER\.china/);
  assert.match(component, /line\.renderOrder = baseRenderOrder/);
  assert.match(component, /linewidth:\s*isVisited \? 1\.8 : 1\.2/);
  assert.match(component, /opacity:\s*isVisited \? 0\.95 : 0\.85/);
});

test('WorldBoundaryGlobe uses exact GeoJSON hover before WASM nearest fallback and line highlighting', () => {
  assert.match(component, /geoProcessor\.find_nearest_country\(/);
  assert.match(component, /const latLng = vectorToLngLat\(point\.x,\s*point\.y,\s*point\.z\)/);
  assert.match(component, /const exactHit = findRegionByLngLat\(mapDataCache\?\.hitIndex\s*\?\?\s*null,\s*latLng\.lat,\s*latLng\.lng\)/);
  assert.match(component, /if \(exactHit\) return exactHit/);
  assert.match(component, /new ThreeRaycaster\(\)/);
  assert.match(component, /raycaster\.setFromCamera\(mouse,\s*camera\)/);
  assert.match(component, /raycaster\.intersectObject\(earth,\s*false\)/);
  assert.match(component, /const countryToLines = new Map<string,\s*Line\[\]>\(\)/);
  assert.match(component, /const resetCountryHighlight/);
  assert.match(component, /const applyCountryHighlight/);
  assert.match(component, /lastHighlightedCountry/);
  assert.match(component, /悬停查看边界/);
  assert.match(component, /已去过/);
  assert.match(component, /尚未去过/);
});

test('WorldBoundaryGlobe highlights hovered boundaries through existing line materials', () => {
  assert.match(component, /const resetCountryHighlight/);
  assert.match(component, /const applyCountryHighlight/);
  assert.match(component, /line\.userData\.originalOpacity/);
  assert.match(component, /line\.material\.color\.set\(line\.userData\.highlightColor\)/);
  assert.match(component, /line\.renderOrder = RENDER_ORDER\.highlight/);
  assert.match(component, /line\.material\.opacity = line\.userData\.originalOpacity/);
});

test('WorldBoundaryGlobe renders only boundary globe without image location markers or extra copy', () => {
  assert.doesNotMatch(component, /location_lat|location_lng|footprint-marker|new maplibre\.Marker|maplibre-gl/);
  assert.doesNotMatch(component, /<small|球体仅展示国家与省级边界|仅边界/);
  assert.doesNotMatch(component, /cursor:\s*pointer/);
  assert.match(component, /class="boundary-globe-status"\s+:class="\{ 'is-active': hoveredCountry \}"/);
  assert.match(component, /\.boundary-globe-status\s*\{[^}]*top:\s*calc\(50% \+ min\(30svh,\s*18\.5rem\)\);/s);
  assert.match(component, /\.boundary-globe-status\s*\{[^}]*bottom:\s*auto;/s);
  assert.match(component, /cursor:\s*default/);
});

test('WorldBoundaryGlobe keeps the mobile canvas centered inside the card content width', () => {
  assert.match(component, /@media \(max-width:\s*720px\)\s*\{[\s\S]*\.boundary-globe-stage\s*\{[\s\S]*width:\s*min\(100%,\s*31rem\);[\s\S]*aspect-ratio:\s*1;[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;/);
  assert.doesNotMatch(component, /width:\s*min\(92vw,\s*31rem\)/);
});

test('WorldBoundaryGlobe cleans up WebGL resources and listeners', () => {
  assert.match(component, /cancelAnimationFrame\(sceneState\.animationId\)/);
  assert.match(component, /controls\.dispose\(\)/);
  assert.match(component, /renderer\.dispose\(\)/);
  assert.match(component, /renderer\.forceContextLoss\(\)/);
  assert.match(component, /window\.removeEventListener\('resize',\s*handleResize\)/);
  assert.match(component, /container\.removeEventListener\('mousemove',\s*handleMouseMove\)/);
  assert.match(component, /scene\.clear\(\)/);
});

test('WorldBoundaryGlobe assets and dependencies are present', () => {
  assert.ok(existsSync('public/maps/world.zh.json'));
  assert.ok(existsSync('public/maps/china.json'));
  assert.ok(existsSync('src/assets/wasm/geo/geo_wasm.js'));
  assert.ok(existsSync('src/assets/wasm/geo/geo_wasm_bg.wasm'));
  assert.ok(packageJson.dependencies?.three);
  assert.ok(packageJson.devDependencies?.['@types/three']);
});
