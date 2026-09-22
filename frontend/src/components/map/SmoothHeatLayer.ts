import L from "leaflet";
import { GridCell } from "../../types/index";

export type MetricLayerType = "severity" | "lst" | "ndvi" | "builtUp" | "vulnerability";

export interface SmoothHeatLayerOptions extends L.LayerOptions {
  activeMetric?: MetricLayerType;
  minOpacity?: number;
  maxZoom?: number;
}

export class SmoothHeatLayer extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _cells: GridCell[] = [];
  private _activeMetric: MetricLayerType = "severity";
  private _palette: Uint8ClampedArray | null = null;
  private _circleCanvas: HTMLCanvasElement | null = null;
  private _circleRadius: number = 0;
  private _animFrame: number | null = null;

  constructor(cells: GridCell[], options?: SmoothHeatLayerOptions) {
    super(options);
    this._cells = cells;
    if (options?.activeMetric) {
      this._activeMetric = options.activeMetric;
    }
    this._initPalette();
  }

  public setCells(cells: GridCell[]) {
    this._cells = cells;
    this.redraw();
  }

  public setActiveMetric(metric: MetricLayerType) {
    this._activeMetric = metric;
    this._initPalette();
    this.redraw();
  }

  // Precompute 256-color lookup table with softer, transparent environmental tones
  private _initPalette() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);

    if (this._activeMetric === "ndvi") {
      // Vegetation: Low NDVI (dry/built) to High NDVI (lush green)
      grad.addColorStop(0.00, "rgb(248, 113, 113)"); // Soft Red
      grad.addColorStop(0.25, "rgb(251, 146, 60)");  // Soft Orange
      grad.addColorStop(0.50, "rgb(253, 224, 71)");  // Soft Yellow
      grad.addColorStop(0.75, "rgb(134, 239, 172)"); // Pale Green
      grad.addColorStop(1.00, "rgb(34, 197, 94)");   // Fresh Green
    } else {
      // Thermal Gradient: Visually distinct, smooth, and nicely saturated
      // < 34°C: Light Green -> 34–38°C: Light Yellow -> 38–42°C: Light Orange -> 42–45°C: Soft Red -> > 45°C: Peak Red
      grad.addColorStop(0.00, "rgb(74, 222, 128)");  // Light Green (< 34°C)
      grad.addColorStop(0.20, "rgb(134, 239, 172)"); // Pale Green
      grad.addColorStop(0.40, "rgb(250, 204, 21)");  // Warm Light Yellow (34–38°C)
      grad.addColorStop(0.65, "rgb(249, 115, 22)");  // Vibrant Light Orange (38–42°C)
      grad.addColorStop(0.85, "rgb(239, 68, 68)");   // Vivid Soft Red (42–45°C)
      grad.addColorStop(1.00, "rgb(185, 28, 28)");   // Concentrated Critical Red only at peak hotspots (> 45°C)
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    this._palette = ctx.getImageData(0, 0, 1, 256).data;
  }

  // Generate smooth radial blur kernel with soft falloff
  private _updateCircle(radius: number, blur: number) {
    const r = radius + blur;
    const c = document.createElement("canvas");
    c.width = c.height = r * 2;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.shadowOffsetX = ctx.shadowOffsetY = 2000;
    ctx.shadowBlur = blur;
    ctx.shadowColor = "black";

    ctx.beginPath();
    ctx.arc(r - 2000, r - 2000, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    this._circleCanvas = c;
    this._circleRadius = r;
  }

  onAdd(map: L.Map): this {
    const pane = map.getPane("overlayPane");
    if (!pane) return this;

    const canvas = L.DomUtil.create("canvas", "leaflet-heatmap-layer leaflet-layer") as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    const isAnimated = map.options.zoomAnimation && L.Browser.any3d;
    L.DomUtil.addClass(canvas, `leaflet-zoom-${isAnimated ? "animated" : "hide"}`);

    pane.appendChild(canvas);

    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");

    map.on("moveend", this._reset, this);
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on("zoomanim", this._animateZoom, this);
    }

    this._reset();
    return this;
  }

  onRemove(map: L.Map): this {
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    map.off("moveend", this._reset, this);
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.off("zoomanim", this._animateZoom, this);
    }
    this._canvas = null;
    this._ctx = null;
    return this;
  }

  public redraw(): this {
    if (!this._animFrame && this._map) {
      this._animFrame = L.Util.requestAnimFrame(() => {
        this._redraw();
        this._animFrame = null;
      }, this);
    }
    return this;
  }

  private _reset() {
    if (!this._map || !this._canvas) return;
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const size = this._map.getSize();
    if (this._canvas.width !== size.x || this._canvas.height !== size.y) {
      this._canvas.width = size.x;
      this._canvas.height = size.y;
    }

    this._redraw();
  }

  private _redraw() {
    if (!this._map || !this._canvas || !this._ctx || !this._palette) return;

    const ctx = this._ctx;
    const width = this._canvas.width;
    const height = this._canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Compute pixel radius based on map zoom for smooth overlap without oversaturating
    const zoom = this._map.getZoom();
    const radius = Math.max(22, Math.min(52, Math.round(22 * Math.pow(1.26, zoom - 11))));
    const blur = Math.max(16, Math.round(radius * 0.65));

    this._updateCircle(radius, blur);
    if (!this._circleCanvas) return;

    const r = this._circleRadius;

    // Draw all cell sample centers onto grayscale alpha buffer with low initial alpha
    for (let i = 0; i < this._cells.length; i++) {
      const cell = this._cells[i];
      const p = this._map.latLngToContainerPoint([cell.latitude, cell.longitude]);

      // Bounding box check
      if (p.x < -r || p.x > width + r || p.y < -r || p.y > height + r) {
        continue;
      }

      // Compute calibrated thermal intensity
      // Only true peak values (>45°C or >82 priority) reach the top red tier
      let intensity = 0.5;
      if (this._activeMetric === "severity") {
        intensity = Math.max(0.05, Math.min(1.0, (cell.heatSeverity - 20.0) / 78.0));
      } else if (this._activeMetric === "lst") {
        intensity = Math.max(0.05, Math.min(1.0, (cell.lst - 32.0) / 14.5));
      } else if (this._activeMetric === "ndvi") {
        intensity = Math.max(0.05, Math.min(1.0, (cell.ndvi - 0.05) / 0.55));
      } else if (this._activeMetric === "builtUp") {
        intensity = Math.max(0.05, Math.min(1.0, (cell.builtUp - 15.0) / 80.0));
      } else if (this._activeMetric === "vulnerability") {
        intensity = Math.max(0.05, Math.min(1.0, (cell.vulnerability - 20.0) / 75.0));
      }

      // Balanced alpha drawing for clear, vibrant thermal visualization
      ctx.globalAlpha = Math.max(0.08, Math.min(0.55, intensity * 0.52));
      ctx.drawImage(this._circleCanvas, p.x - r, p.y - r);
    }

    // Colorize the continuous alpha field using the soft gradient palette
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const pal = this._palette;

    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha > 0) {
        const offset = Math.min(255, Math.max(0, Math.round(alpha * 2.3))) * 4;
        data[i - 3] = pal[offset];     // R
        data[i - 2] = pal[offset + 1]; // G
        data[i - 1] = pal[offset + 2]; // B

        // Balanced opacity: ~60% max opacity (155/255)
        // Visually clear and distinct heat zones, while roads and water bodies remain visible beneath,
        // and all place names/labels remain razor-sharp in topLabelsPane!
        data[i] = Math.min(156, Math.max(0, Math.round(alpha * 0.82)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  private _animateZoom(e: L.ZoomAnimEvent) {
    if (!this._map || !this._canvas) return;
    const scale = this._map.getZoomScale(e.zoom);
    const offset = this._map.latLngToLayerPoint(e.center).subtract(this._map.getSize().divideBy(2));
    L.DomUtil.setTransform(this._canvas, offset, scale);
  }
}

export function createSmoothHeatLayer(cells: GridCell[], options?: SmoothHeatLayerOptions): SmoothHeatLayer {
  return new SmoothHeatLayer(cells, options);
}
