import { Application, Container, Sprite, Texture, Assets, Graphics, Rectangle, TilingSprite } from 'pixi.js';
import { CANVAS, ZONES } from './PixiOfficeLayout';

const ASSET_SHEET  = '/sprites/pixeloffice/PixelOfficeAssets.png';
const FLOOR_TILE   = '/sprites/floor_tile.png';
const WALL_TILE    = '/sprites/wall_top.png';
const WALL_ROWS    = 2; // how many rows the wall_top strip spans
const S = 2; // pixel-art sprite scale

function slice(base: Texture, sx: number, sy: number, sw: number, sh: number): Texture {
  return new Texture({ source: base.source, frame: new Rectangle(sx, sy, sw, sh) });
}

// Place a sprite slice at canvas position (cx, cy) = top-left
function put(
  container: Container, sheet: Texture,
  sx: number, sy: number, sw: number, sh: number,
  cx: number, cy: number, scale = S,
): Sprite {
  const t = slice(sheet, sx, sy, sw, sh);
  const sp = new Sprite(t);
  sp.scale.set(scale);
  sp.x = cx;
  sp.y = cy;
  container.addChild(sp);
  return sp;
}

export class OfficeRenderer {
  private app: Application;
  private officeContainer: Container;
  private bgLayer: Container;   // tiled floor / wall sprites
  private floorLayer: Graphics; // zone tints + wall dividers
  private spriteLayer: Container;
  private wallTiling: TilingSprite | null = null;
  private floorTiling: TilingSprite | null = null;
  private fallbackBg: Graphics | null = null;
  private wallTex: Texture | null = null;
  private floorTex: Texture | null = null;
  private currentScale = 1;
  private currentWidth = CANVAS.width;
  private currentHeight = CANVAS.height;

  constructor(app: Application) {
    this.app = app;
    this.currentWidth = app.screen.width || CANVAS.width;
    this.currentHeight = app.screen.height || CANVAS.height;
    this.currentScale = Math.min(this.currentWidth / CANVAS.width, this.currentHeight / CANVAS.height);

    this.officeContainer = new Container();
    this.officeContainer.zIndex = 0;
    this.officeContainer.scale.set(this.currentScale);
    this.app.stage.addChild(this.officeContainer);

    this.bgLayer     = new Container();
    this.floorLayer  = new Graphics();
    this.spriteLayer = new Container();
    this.officeContainer.addChild(this.bgLayer, this.floorLayer, this.spriteLayer);

    this.drawFallbackBg();
    this.drawZoneOverlays();
    this.loadBackground().catch(() => this.drawFallbackBg());
    this.loadSprites().catch(() => this.drawFallback());
  }

  // ── Dynamic Tiled background: wall_top on top (full width), floor_tile below (full area) ──
  private async loadBackground(): Promise<void> {
    const [floorTex, wallTex] = await Promise.all([
      Assets.load<Texture>(FLOOR_TILE),
      Assets.load<Texture>(WALL_TILE),
    ]);
    floorTex.source.scaleMode = 'nearest';
    wallTex.source.scaleMode  = 'nearest';
    floorTex.source.addressMode = 'repeat';
    wallTex.source.addressMode  = 'repeat';

    this.floorTex = floorTex;
    this.wallTex  = wallTex;

    const WALL_SCALE_Y  = 1.5;
    const FLOOR_SCALE_Y = 1.0;
    const fh = wallTex.height * WALL_SCALE_Y;
    const wallStripH = WALL_ROWS * fh;

    const localW = Math.max(CANVAS.width, this.currentWidth / this.currentScale);
    const localH = Math.max(CANVAS.height, this.currentHeight / this.currentScale);

    // Wall tiling across full top width
    this.wallTiling = new TilingSprite({
      texture: wallTex,
      width: localW,
      height: wallStripH,
      tileScale: { x: 1, y: WALL_SCALE_Y },
    });
    this.wallTiling.x = 0;
    this.wallTiling.y = 0;
    this.bgLayer.addChild(this.wallTiling);

    // Floor tiling across remaining canvas area
    this.floorTiling = new TilingSprite({
      texture: floorTex,
      width: localW,
      height: Math.max(0, localH - wallStripH),
      tileScale: { x: 1, y: FLOOR_SCALE_Y },
    });
    this.floorTiling.x = 0;
    this.floorTiling.y = wallStripH;
    this.bgLayer.addChild(this.floorTiling);

    if (this.fallbackBg) {
      this.bgLayer.removeChild(this.fallbackBg);
      this.fallbackBg.destroy();
      this.fallbackBg = null;
    }

    this.drawZoneOverlays();
  }

  private drawFallbackBg(): void {
    if (!this.fallbackBg) {
      this.fallbackBg = new Graphics();
      this.bgLayer.addChildAt(this.fallbackBg, 0);
    }
    const localW = Math.max(CANVAS.width, this.currentWidth / this.currentScale);
    const localH = Math.max(CANVAS.height, this.currentHeight / this.currentScale);
    this.fallbackBg.clear();
    this.fallbackBg.rect(0, 0, localW, localH).fill(0x0e0e16);
  }

  // ── Responsive Resize: seamlessly adjusts wall, floor, and zone dividers ──
  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.currentWidth = width;
    this.currentHeight = height;

    const scale = Math.min(width / CANVAS.width, height / CANVAS.height);
    this.currentScale = scale;
    this.officeContainer.scale.set(scale);

    const localW = Math.max(CANVAS.width, width / scale);
    const localH = Math.max(CANVAS.height, height / scale);

    const WALL_SCALE_Y = 1.5;
    const fh = this.wallTex ? this.wallTex.height * WALL_SCALE_Y : 30;
    const wallStripH = WALL_ROWS * fh;

    if (this.wallTiling) {
      this.wallTiling.width = localW;
      this.wallTiling.height = wallStripH;
    }

    if (this.floorTiling) {
      this.floorTiling.width = localW;
      this.floorTiling.height = Math.max(0, localH - wallStripH);
      this.floorTiling.y = wallStripH;
    }

    if (this.fallbackBg) {
      this.drawFallbackBg();
    }

    this.drawZoneOverlays();
  }

  // ── Zone borders + wall dividers + baseboard depth trim ───────────────────
  private drawZoneOverlays(): void {
    const g = this.floorLayer;
    g.clear();

    const localW = Math.max(CANVAS.width, this.currentWidth / this.currentScale);
    const localH = Math.max(CANVAS.height, this.currentHeight / this.currentScale);

    // Subtle zone floor tints & outlines
    for (const zone of ZONES) {
      let zw = zone.width;
      let zh = zone.height;

      // Stretch right-column zones to right wall
      if (zone.x + zone.width >= 715) {
        zw = localW - zone.x;
      }
      // Stretch bottom-row zones to bottom wall
      if (zone.y + zone.height >= 475) {
        zh = localH - zone.y;
      }

      // Subtle room floor tint
      g.rect(zone.x, zone.y, zw, zh).fill({ color: zone.floorColor, alpha: 0.2 });
      // Zone border
      g.rect(zone.x, zone.y, zw, zh).stroke({ width: 1, color: zone.wallColor, alpha: 0.45 });
    }

    // Primary wall dividers
    const ls = { width: 2 as number, color: 0x3a3a5a as number, alpha: 0.9 as number };
    // Vertical divider between Left & Center (x = 170)
    g.moveTo(170, 0).lineTo(170, localH).stroke(ls);
    // Vertical divider between Center & Right (x = 480)
    g.moveTo(480, 0).lineTo(480, localH).stroke(ls);

    // Left column horizontal dividers
    g.moveTo(  0, 155).lineTo(170, 155).stroke(ls);
    g.moveTo(  0, 290).lineTo(170, 290).stroke(ls);

    // Right column horizontal dividers (stretched all the way to localW)
    g.moveTo(480, 135).lineTo(localW, 135).stroke(ls);
    g.moveTo(480, 305).lineTo(localW, 305).stroke(ls);

    // Center column divider (Dev Hub / PM)
    g.moveTo(175, 340).lineTo(475, 340).stroke(ls);

    // Baseboard trim at bottom of top wall (y = 60) spanning left to right
    g.moveTo(0, 60).lineTo(localW, 60).stroke({ width: 2, color: 0x1f1f2e, alpha: 0.95 });
    // Soft drop shadow cast from wall onto floor
    g.rect(0, 61, localW, 5).fill({ color: 0x000000, alpha: 0.25 });
  }

  // ── Sprite furniture ─────────────────────────────────────────────────────
  private async loadSprites(): Promise<void> {
    const sheet = await Assets.load<Texture>(ASSET_SHEET);
    sheet.source.scaleMode = 'nearest';

    const c = this.spriteLayer;
    // shorthand: put(c, sheet, srcX, srcY, srcW, srcH, canvasX, canvasY, scale?)
    const p = (sx:number,sy:number,sw:number,sh:number,cx:number,cy:number,sc=S) =>
      put(c, sheet, sx,sy,sw,sh, cx,cy, sc);

    // Asset crop coordinates (from PixelOfficeAssets.png, 256×160):
    //  Desk/bench     : 85, 47,  26, 16
    //  Plant          : 170, 65, 14, 19
    //  Green sofa     : 119, 66, 33, 15
    //  White sofa/rack: 84,  70, 26, 20
    //  Server rack A  : 59,  96, 26, 21
    //  Server rack B  : 88,  96, 26, 21
    //  Server cabinet : 98, 120, 16, 31
    //  Orange sofa    : 120,121, 33, 16
    //  Vending machine: 159,123, 24, 34
    //  Snack shelf    : 184,126, 24, 31
    //  Coffee machine : 188, 63, 17, 19
    //  Cat            : 3,  132, 17, 23
    //  Dog            : 22, 132, 17, 23
    //  Char A         : 2,  105, 15, 23
    //  Char B         : 19, 104, 19, 24

    // ── CEO Office  (zone 0,0 170×155) ─────────────────────────────────────
    p( 85, 47, 26, 16,  30,  68);  // desk L
    p( 85, 47, 26, 16,  92,  68);  // desk R
    p(170, 65, 14, 19, 140,  15);  // plant

    // ── HR Desk  (zone 0,160 170×130) ──────────────────────────────────────
    p( 85, 47, 26, 16,  30, 213);  // desk L
    p( 85, 47, 26, 16,  92, 213);  // desk R

    // ── Kitchen  (zone 0,295 170×185) ──────────────────────────────────────
    p(159,123, 24, 34,   8, 305);  // vending machine
    p(184,126, 24, 31,  62, 308);  // snack shelf
    p(170, 65, 14, 19, 138, 300);  // plant
    p(188, 63, 17, 19,  45, 375);  // coffee machine

    // ── Dev Hub  (zone 175,0 300×340) ──────────────────────────────────────
    // Engineer desks: DESK_POSITIONS engineer = (245,100),(325,100),(245,180),(325,180)
    // top-left = center - (sw*S/2, sh*S/2)
    p( 85, 47, 26, 16, 219,  84);  // eng desk 0
    p( 85, 47, 26, 16, 299,  84);  // eng desk 1
    p( 85, 47, 26, 16, 219, 164);  // eng desk 2
    p( 85, 47, 26, 16, 299, 164);  // eng desk 3
    // QA desk at (325,260)
    p( 85, 47, 26, 16, 299, 252);  // qa desk
    // Meeting area sofas (MEETING_AREA 250,260 120×60) — offset below QA row
    p(119, 66, 33, 15, 226, 270);  // green sofa left
    p(119, 66, 33, 15, 350, 270);  // green sofa right
    p( 84, 70, 26, 20, 288, 268);  // white sofa / table centre
    // Plants
    p(170, 65, 14, 19, 456,   4);  // dev hub corner plant
    p(170, 65, 14, 19, 182,   4);  // dev hub opposite corner

    // ── PM Desk  (zone 175,345 300×135) ────────────────────────────────────
    // PM desk at (325,410) — add two more neighbours
    p( 85, 47, 26, 16, 238, 388);  // desk L
    p( 85, 47, 26, 16, 299, 388);  // desk C (PM desk_center ~325,410 adjusted)
    p( 85, 47, 26, 16, 360, 388);  // desk R

    // ── Database Zone  (zone 480,0 240×135) ────────────────────────────────
    p( 59, 96, 26, 21, 490,  18);  // server rack A
    p( 88, 96, 26, 21, 548,  18);  // server rack B
    p( 59, 96, 26, 21, 606,  18);  // server rack A
    p( 88, 96, 26, 21, 664,  18);  // server rack B
    p( 98,120, 16, 31, 697,  10);  // tall server cabinet

    // ── Researcher Area  (zone 480,140 240×165) ─────────────────────────────
    // Researcher desks: (530,200),(590,200),(650,200)
    p( 85, 47, 26, 16, 504, 184);  // researcher desk 0
    p( 85, 47, 26, 16, 564, 184);  // researcher desk 1
    p( 85, 47, 26, 16, 624, 184);  // researcher desk 2
    p(170, 65, 14, 19, 696, 145);  // plant

    // ── Gaming Zone  (zone 480,310 240×170) ────────────────────────────────
    p(120,121, 33, 16, 490, 352);  // orange sofa L
    p(120,121, 33, 16, 578, 352);  // orange sofa R
    p(119, 66, 33, 15, 648, 370);  // green sofa
  }

  // ── Graphics fallback when sprite sheet fails to load ────────────────────
  private drawFallback(): void {
    const g = new Graphics();
    this.officeContainer.addChild(g);

    const desk = (x: number, y: number) => g.rect(x, y, 52, 16).fill(0x4a3020);

    desk(30, 68); desk(92, 68);   // CEO
    desk(30, 213); desk(92, 213); // HR
    desk(299, 388); // PM
    [[219,84],[299,84],[219,164],[299,164]].forEach(([x,y]) => desk(x,y));   // Eng
    [[504,184],[564,184],[624,184]].forEach(([x,y]) => desk(x,y));           // Research
    [490,548,606,664].forEach(x => g.rect(x, 18, 52, 100).fill(0x1a2a3a)); // DB racks
    [490,578].forEach(x => g.rect(x, 352, 66, 32).fill(0x5a2a10));         // Sofas
    g.rect(8, 305, 48, 68).fill(0x3a4a5a); // Vending
    g.rect(62, 308, 48, 62).fill(0x2a3a2a); // Snack shelf
  }

  destroy(): void {
    this.wallTiling?.destroy();
    this.floorTiling?.destroy();
    this.fallbackBg?.destroy();
    this.spriteLayer.destroy({ children: true });
    this.officeContainer.destroy({ children: true });
  }
}
