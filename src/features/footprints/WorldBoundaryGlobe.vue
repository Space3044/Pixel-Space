<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type {
  BufferGeometry,
  Line,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GeoProcessor as GeoProcessorType } from '@/assets/wasm/geo/geo_wasm.js';
import { buildGeoHitIndex, findRegionByLngLat, vectorToLngLat } from './geo-hit';
import type { GeoHitIndex } from './geo-hit';

interface VisitedCoordinate {
  lat: number;
  lng: number;
}

const props = defineProps<{ visitedPlaces: string[]; visitedCoordinates?: VisitedCoordinate[] }>();

type ThreeModule = typeof import('three');
type OrbitControlsConstructor = typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;

type MapData = {
  world: unknown;
  china: unknown;
  hitIndex: GeoHitIndex;
};

interface SceneState {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControlsType;
  earth: Mesh;
  raycaster: Raycaster;
  mouse: Vector2;
  container: HTMLElement;
  animationId: number;
  hoverFrame: number;
  countryToLines: Map<string, Line[]>;
  visitedCountryNames: Set<string>;
  lastHighlightedCountry: string | null;
  resizeObserver: ResizeObserver | null;
}

const COLORS = {
  earthBase: '#111827',
  border: '#6b7280',
  chinaBorder: '#f87171',
  visitedBorder: '#10b981',
  highlight: '#fcd34d',
  atmosphere: 'rgba(53, 243, 255, 0.16)',
};

const RENDER_ORDER = {
  other: 1,
  china: 2,
  visited: 3,
  highlight: 4,
};

const SEGMENT_QUANTIZE_DEG = 0.5;

const stageRef = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const hoveredCountry = ref<string | null>(null);

let sceneState: SceneState | null = null;
let geoProcessor: GeoProcessorType | null = null;
let mapDataCache: MapData | null = null;
let mounted = false;
let initVersion = 0;
let lastMouseEvent: MouseEvent | null = null;
let visibilityObserver: IntersectionObserver | null = null;
let initializationStarted = false;

let handleResize = () => {};
let handleMouseMove = (_event: MouseEvent) => {};
let handleMouseLeave = () => {};

const normalizePlace = (place: string) =>
  place
    .trim()
    .replace(/\s+/g, '')
    .replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|地区|共和国|王国|联邦|民主共和国|合众国)$/g, '');

const isVisitedCountry = (countryName: string) => {
  if (sceneState?.visitedCountryNames.has(countryName)) return true;

  const normalizedCountry = normalizePlace(countryName.replace(/^中国-/, ''));
  return props.visitedPlaces.some((place) => {
    const normalizedPlace = normalizePlace(place.replace(/^中国-/, ''));
    return Boolean(
      normalizedCountry
      && normalizedPlace
      && (normalizedCountry.includes(normalizedPlace) || normalizedPlace.includes(normalizedCountry)),
    );
  });
};

const boundaryStatus = computed(() => {
  if (loading.value) return '正在加载边界';
  if (loadError.value) return `地图边界加载失败：${loadError.value}`;
  if (!hoveredCountry.value) return '悬停查看边界';
  return `${hoveredCountry.value} ${isVisitedCountry(hoveredCountry.value) ? '已去过' : '尚未去过'}`;
});

const loadMapData = async () => {
  if (mapDataCache) return mapDataCache;

  const [worldResponse, chinaResponse] = await Promise.all([
    fetch('/maps/world.zh.json'),
    fetch('/maps/china.json'),
  ]);

  if (!worldResponse.ok || !chinaResponse.ok) {
    throw new Error('map_assets_unavailable');
  }

  const [world, china] = await Promise.all([worldResponse.json(), chinaResponse.json()]);
  mapDataCache = { world, china, hitIndex: buildGeoHitIndex(world, china) };
  return mapDataCache;
};

const resolveVisitedPlaces = (geoProcessor: GeoProcessorType) => {
  const resolvedPlaces = new Set(props.visitedPlaces.map((place) => place.trim()).filter(Boolean));

  for (const coordinate of props.visitedCoordinates ?? []) {
    if (!Number.isFinite(coordinate.lat) || !Number.isFinite(coordinate.lng)) continue;

    const exactCountryName = findRegionByLngLat(mapDataCache?.hitIndex ?? null, coordinate.lat, coordinate.lng);
    if (exactCountryName) {
      resolvedPlaces.add(exactCountryName);
      continue;
    }

    const point = geoProcessor.lat_long_to_vector3(coordinate.lat, coordinate.lng, 2.01);

    try {
      const countryName = geoProcessor.find_nearest_country(
        point.x,
        point.y,
        point.z,
        2.01,
      );

      if (countryName) {
        resolvedPlaces.add(countryName);
      }
    } finally {
      point.free?.();
    }
  }

  return [...resolvedPlaces];
};

const disposeObject = (object: Object3D) => {
  object.traverse((child) => {
    const disposable = child as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };

    disposable.geometry?.dispose();

    if (Array.isArray(disposable.material)) {
      disposable.material.forEach((material) => material.dispose());
      return;
    }

    disposable.material?.dispose();
  });
};

const disposeGeoProcessor = () => {
  geoProcessor?.free?.();
  geoProcessor = null;
};

const cleanupScene = () => {
  if (!sceneState) return;

  const { scene, renderer, controls, resizeObserver } = sceneState;
  const container = sceneState.container;

  if (sceneState.animationId) {
    cancelAnimationFrame(sceneState.animationId);
  }

  if (sceneState.hoverFrame) {
    cancelAnimationFrame(sceneState.hoverFrame);
  }

  resizeObserver?.disconnect();
  window.removeEventListener('resize', handleResize);
  container.removeEventListener('mousemove', handleMouseMove);
  container.removeEventListener('mouseleave', handleMouseLeave);

  controls.dispose();
  disposeObject(scene);
  scene.clear();
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
  container.innerHTML = '';
  sceneState = null;
  hoveredCountry.value = null;
  lastMouseEvent = null;
};

const readStageSize = (container: HTMLElement) => {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width || container.clientWidth)),
    height: Math.max(1, Math.round(rect.height || container.clientHeight)),
  };
};

const createBoundaryScene = (
  three: ThreeModule,
  OrbitControls: OrbitControlsConstructor,
  geoProcessor: GeoProcessorType,
) => {
  const container = stageRef.value;
  if (!container) return;

  const {
    Scene: ThreeScene,
    PerspectiveCamera: ThreePerspectiveCamera,
    WebGLRenderer: ThreeWebGLRenderer,
    SphereGeometry: ThreeSphereGeometry,
    MeshBasicMaterial: ThreeMeshBasicMaterial,
    Mesh: ThreeMesh,
    Vector2: ThreeVector2,
    Vector3: ThreeVector3,
    Raycaster: ThreeRaycaster,
    Group: ThreeGroup,
    BufferGeometry: ThreeBufferGeometry,
    Float32BufferAttribute: ThreeFloat32BufferAttribute,
    LineBasicMaterial: ThreeLineBasicMaterial,
    LineSegments: ThreeLineSegments,
    FrontSide: ThreeFrontSide,
  } = three;

  const { width, height } = readStageSize(container);
  const scene = new ThreeScene();
  scene.background = null;

  const camera = new ThreePerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.copy(new ThreeVector3(-2.1, 3.41, -6.5));
  if (container.clientWidth < 640) {
    camera.position.set(-2.1, 3.41, -8.0);
  }
  camera.lookAt(0, 0, 0);

  const renderer = new ThreeWebGLRenderer({
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true,
    precision: 'highp',
  });
  renderer.sortObjects = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.domElement.className = 'boundary-globe-canvas';
  renderer.domElement.setAttribute('aria-label', '旅行足迹边界地球');
  container.appendChild(renderer.domElement);

  const earthGeometry = new ThreeSphereGeometry(2.0, 64, 64);
  const earthMaterial = new ThreeMeshBasicMaterial({
    color: COLORS.earthBase,
    side: ThreeFrontSide,
    transparent: true,
    opacity: 0.92,
  });
  const earth = new ThreeMesh(earthGeometry, earthMaterial);
  earth.renderOrder = 1;
  scene.add(earth);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.rotateSpeed = 0.2;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.12;
  controls.minDistance = 3.6;
  controls.maxDistance = 15;
  controls.minPolarAngle = Math.PI * 0.1;
  controls.maxPolarAngle = Math.PI * 0.9;
  controls.target.set(0, 0, 0);
  controls.update();

  const countryToLines = new Map<string, Line[]>();
  const visitedCountryNames = new Set<string>();
  const countryGroup = new ThreeGroup();
  earth.add(countryGroup);

  const boundaryLines = geoProcessor.get_boundary_lines();

  const resolveRegionPriority = (regionName: string, isVisited: boolean) => {
    if (isVisited) return RENDER_ORDER.visited;
    if (regionName === '中国' || regionName.startsWith('中国-')) return RENDER_ORDER.china;
    return RENDER_ORDER.other;
  };

  const quantize = (value: number) => Math.round(value / SEGMENT_QUANTIZE_DEG);
  const pointKey = (lng: number, lat: number) => `${quantize(lng)},${quantize(lat)}`;
  const segmentKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const segmentPriority = new Map<string, number>();
  for (const boundaryLine of boundaryLines) {
    const points = Array.isArray(boundaryLine.points) ? boundaryLine.points : [];
    if (points.length <= 1) continue;

    const priority = resolveRegionPriority(boundaryLine.region_name, boundaryLine.is_visited);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const llA = vectorToLngLat(a.x, a.y, a.z);
      const llB = vectorToLngLat(b.x, b.y, b.z);
      const key = segmentKey(pointKey(llA.lng, llA.lat), pointKey(llB.lng, llB.lat));
      const existing = segmentPriority.get(key);
      if (existing === undefined || priority > existing) {
        segmentPriority.set(key, priority);
      }
    }
  }

  for (const boundaryLine of boundaryLines) {
    const points = Array.isArray(boundaryLine.points) ? boundaryLine.points : [];
    if (points.length <= 1) continue;

    const regionName = boundaryLine.region_name;
    const isVisited = boundaryLine.is_visited;
    const isChina = regionName === '中国' || regionName.startsWith('中国-');
    const priority = resolveRegionPriority(regionName, isVisited);

    const positions: number[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const llA = vectorToLngLat(a.x, a.y, a.z);
      const llB = vectorToLngLat(b.x, b.y, b.z);
      const key = segmentKey(pointKey(llA.lng, llA.lat), pointKey(llB.lng, llB.lat));
      if (segmentPriority.get(key) !== priority) continue;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    if (positions.length === 0) {
      if (isVisited) visitedCountryNames.add(regionName);
      continue;
    }

    let borderColor = COLORS.border;
    let baseRenderOrder = RENDER_ORDER.other;

    if (isVisited) {
      borderColor = COLORS.visitedBorder;
      baseRenderOrder = RENDER_ORDER.visited;
      visitedCountryNames.add(regionName);
    } else if (isChina) {
      borderColor = COLORS.chinaBorder;
      baseRenderOrder = RENDER_ORDER.china;
    }

    const lineGeometry = new ThreeBufferGeometry();
    lineGeometry.setAttribute('position', new ThreeFloat32BufferAttribute(positions, 3));

    const lineMaterial = new ThreeLineBasicMaterial({
      color: borderColor,
      linewidth: isVisited ? 1.8 : 1.2,
      transparent: true,
      opacity: isVisited ? 0.95 : 0.85,
      depthTest: false,
      depthWrite: false,
    });
    const line = new ThreeLineSegments(lineGeometry, lineMaterial) as unknown as Line;
    line.frustumCulled = false;
    line.userData = {
      name: regionName,
      isVisited,
      originalColor: borderColor,
      originalOpacity: lineMaterial.opacity,
      originalRenderOrder: baseRenderOrder,
      highlightColor: COLORS.highlight,
    };
    line.renderOrder = baseRenderOrder;
    countryGroup.add(line);

    const lines = countryToLines.get(regionName);
    if (lines) {
      lines.push(line);
    } else {
      countryToLines.set(regionName, [line]);
    }
  }

  const raycaster = new ThreeRaycaster();
  const mouse = new ThreeVector2();
  let lastHighlightedCountry: string | null = null;

  const resetCountryHighlight = (countryName: string | null) => {
    if (!countryName) return;

    const lines = countryToLines.get(countryName);
    if (!lines) return;

    for (const line of lines) {
      if (line.material instanceof ThreeLineBasicMaterial) {
        line.material.color.set(line.userData.originalColor);
        line.material.opacity = line.userData.originalOpacity;
        line.material.needsUpdate = true;
      }

      line.renderOrder = line.userData.originalRenderOrder;
    }
  };

  const applyCountryHighlight = (countryName: string | null) => {
    if (!countryName) return;

    const lines = countryToLines.get(countryName);
    if (!lines) return;

    for (const line of lines) {
      if (line.material instanceof ThreeLineBasicMaterial) {
        line.material.color.set(line.userData.highlightColor);
        line.material.opacity = line.userData.originalOpacity;
        line.material.needsUpdate = true;
      }

      line.renderOrder = RENDER_ORDER.highlight;
    }
  };

  const updateHighlight = (countryName: string | null) => {
    if (countryName === lastHighlightedCountry) return;

    resetCountryHighlight(lastHighlightedCountry);
    applyCountryHighlight(countryName);
    lastHighlightedCountry = countryName;
    if (sceneState) {
      sceneState.lastHighlightedCountry = countryName;
    }
  };

  const findCountryFromMouse = (event: MouseEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);

    const earthIntersects = raycaster.intersectObject(earth, false);
    const intersection = earthIntersects[0];
    if (!intersection) return null;

    const point = intersection.point;
    const latLng = vectorToLngLat(point.x, point.y, point.z);
    const exactHit = findRegionByLngLat(mapDataCache?.hitIndex ?? null, latLng.lat, latLng.lng);
    if (exactHit) return exactHit;

    return geoProcessor.find_nearest_country(
      point.x,
      point.y,
      point.z,
      2.01,
    ) ?? null;
  };

  const render = () => {
    renderer.render(scene, camera);
  };

  const animate = () => {
    if (!sceneState) return;

    controls.autoRotate = true;
    controls.update();
    render();
    sceneState.animationId = requestAnimationFrame(animate);
  };

  handleMouseMove = (event: MouseEvent) => {
    lastMouseEvent = event;
    if (!sceneState || sceneState.hoverFrame) return;

    sceneState.hoverFrame = requestAnimationFrame(() => {
      if (!sceneState) return;
      sceneState.hoverFrame = 0;
      if (!lastMouseEvent) return;

      const countryName = findCountryFromMouse(lastMouseEvent);
      updateHighlight(countryName);
      hoveredCountry.value = countryName;
      controls.autoRotate = true;
      render();
    });
  };

  handleMouseLeave = () => {
    if (sceneState?.hoverFrame) {
      cancelAnimationFrame(sceneState.hoverFrame);
      sceneState.hoverFrame = 0;
    }
    updateHighlight(null);
    hoveredCountry.value = null;
    lastMouseEvent = null;
    render();
  };

  handleResize = () => {
    if (!sceneState) return;

    const nextSize = readStageSize(container);
    camera.aspect = nextSize.width / nextSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(nextSize.width, nextSize.height);
    render();
  };

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
  resizeObserver?.observe(container);
  window.addEventListener('resize', handleResize, { passive: true });
  container.addEventListener('mousemove', handleMouseMove, { passive: true });
  container.addEventListener('mouseleave', handleMouseLeave, { passive: true });

  const nextSceneState: SceneState = {
    scene,
    camera,
    renderer,
    controls,
    earth,
    raycaster,
    mouse,
    container,
    animationId: 0,
    hoverFrame: 0,
    countryToLines,
    visitedCountryNames,
    lastHighlightedCountry,
    resizeObserver,
  };
  sceneState = nextSceneState;

  render();
  nextSceneState.animationId = requestAnimationFrame(animate);
};

const initializeGlobe = async () => {
  const version = ++initVersion;
  loading.value = true;
  loadError.value = null;

  try {
    const [mapData, wasm, three, controlsModule] = await Promise.all([
      loadMapData(),
      import('@/assets/wasm/geo/geo_wasm.js'),
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ]);

    await wasm.default();
    if (!mounted || version !== initVersion) return;

    const nextGeoProcessor = new wasm.GeoProcessor();
    nextGeoProcessor.process_geojson(
      JSON.stringify(mapData.world),
      JSON.stringify(mapData.china),
      JSON.stringify(props.visitedPlaces),
      2.01,
    );
    const resolvedVisitedPlaces = resolveVisitedPlaces(nextGeoProcessor);
    nextGeoProcessor.process_geojson(
      JSON.stringify(mapData.world),
      JSON.stringify(mapData.china),
      JSON.stringify(resolvedVisitedPlaces),
      2.01,
    );

    if (!mounted || version !== initVersion) {
      nextGeoProcessor.free();
      return;
    }

    cleanupScene();
    disposeGeoProcessor();
    geoProcessor = nextGeoProcessor;
    createBoundaryScene(three, controlsModule.OrbitControls, geoProcessor);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (mounted && version === initVersion) {
      loading.value = false;
    }
  }
};

const startInitialization = () => {
  if (!mounted || initializationStarted) return;
  initializationStarted = true;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  void initializeGlobe();
};

const startWhenVisible = () => {
  if (!stageRef.value || typeof IntersectionObserver === 'undefined') {
    startInitialization();
    return;
  }

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) startInitialization();
    },
    { rootMargin: '240px 0px' },
  );
  visibilityObserver.observe(stageRef.value);
};

onMounted(() => {
  mounted = true;
  startWhenVisible();
});

watch(
  () => [
    props.visitedPlaces.join('\u0000'),
    props.visitedCoordinates?.map((coordinate) => `${coordinate.lat},${coordinate.lng}`).join('\u0000') ?? '',
  ].join('\u0001'),
  () => {
    if (!mounted || !initializationStarted) return;
    void initializeGlobe();
  },
);

onBeforeUnmount(() => {
  mounted = false;
  initVersion += 1;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  cleanupScene();
  disposeGeoProcessor();
});
</script>

<template>
  <figure class="boundary-globe">
    <div ref="stageRef" class="boundary-globe-stage" />

    <figcaption class="boundary-globe-status" :class="{ 'is-active': hoveredCountry }">
      <span>{{ boundaryStatus }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.boundary-globe {
  position: relative;
  display: grid;
  min-height: min(74svh, 46rem);
  place-items: center;
  margin: 0;
  padding: 0;
  overflow: visible;
  isolation: isolate;
}

.boundary-globe::before,
.boundary-globe::after {
  content: '';
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
}

.boundary-globe::before {
  width: min(76svh, 47rem, 94%);
  aspect-ratio: 1;
  border: 1px solid rgba(53, 243, 255, 0.1);
  box-shadow: 0 0 38px rgba(53, 243, 255, 0.08);
  transform: rotateX(66deg) rotateZ(-12deg);
}

.boundary-globe::after {
  width: min(82svh, 51rem, 98%);
  aspect-ratio: 1;
  border: 1px solid rgba(16, 185, 129, 0.08);
  transform: rotateX(72deg) rotateZ(46deg);
}

.boundary-globe-stage {
  position: relative;
  z-index: 1;
  width: min(78svh, 49rem, 100%);
  aspect-ratio: 1;
  height: auto;
  min-height: 24rem;
  cursor: default;
  touch-action: none;
  user-select: none;
}

.boundary-globe-stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  cursor: default;
  outline: none;
  touch-action: none;
}

.boundary-globe-status {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: calc(50% + min(30svh, 18.5rem));
  bottom: auto;
  max-width: min(28rem, 84%);
  transform: translateX(-50%);
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 4px;
  background: rgba(2, 6, 23, 0.76);
  color: rgba(226, 232, 240, 0.82);
  font-size: 0.82rem;
  font-weight: 760;
  letter-spacing: 0.04em;
  text-align: center;
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 36px rgba(2, 6, 23, 0.24);
  transition: border-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.boundary-globe-status.is-active {
  border-color: rgba(252, 211, 77, 0.38);
  color: rgb(255, 251, 235);
}

@media (max-width: 720px) {
  .boundary-globe {
    min-height: 26rem;
  }

  .boundary-globe-stage {
    width: min(100%, 31rem);
    aspect-ratio: 1;
    height: auto;
    min-height: 0;
  }

  .boundary-globe-status {
    top: calc(50% + min(30vw, 10rem));
  }
}
</style>
