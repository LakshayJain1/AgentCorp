import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { CANVAS, ZONES, WALL_H, MEETING_AREA } from './PixiOfficeLayout';

export class OfficeRenderer {
  private app: Application;
  private officeContainer: Container;
  private officeGraphics: Graphics;
  private wallFaceGraphics: Graphics;
  private furnitureGraphics: Graphics;
  private labelsContainer: Container;

  constructor(app: Application) {
    this.app = app;
    this.officeContainer = new Container();
    this.officeContainer.zIndex = 0;
    this.app.stage.addChild(this.officeContainer);

    this.officeGraphics = new Graphics();
    this.wallFaceGraphics = new Graphics();
    this.furnitureGraphics = new Graphics();
    this.labelsContainer = new Container();
    this.officeContainer.addChild(
      this.officeGraphics,
      this.wallFaceGraphics,
      this.furnitureGraphics,
      this.labelsContainer,
    );

    this.drawOffice();
    this.drawZoneLabels();
  }

  // ─── Color helpers ────────────────────────────────────────────────────
  private darken(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private lighten(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + amount);
    const g = Math.min(255, ((color >> 8) & 0xff) + amount);
    const b = Math.min(255, (color & 0xff) + amount);
    return (r << 16) | (g << 8) | b;
  }

  // ─── Cabinet projection primitive ────────────────────────────────────
  // Draws: drop shadow → top face → front face → highlight edge
  private drawCabinet(
    g: Graphics,
    x: number, y: number, w: number, h: number,
    topColor: number,
    frontH = 7,
    shadowAlpha = 0.25,
  ): void {
    // Drop shadow (offset down-right)
    g.rect(x + 5, y + 5, w, h + frontH).fill({ color: 0x000000, alpha: shadowAlpha });
    // Top face
    g.rect(x, y, w, h).fill(topColor);
    // Front face — significantly darker
    g.rect(x, y + h, w, frontH).fill(this.darken(topColor, 0.52));
    // Top-edge highlight (catches top light)
    g.rect(x, y, w, 1).fill({ color: 0xffffff, alpha: 0.10 });
    // Ridge between top and front face
    g.rect(x, y + h, w, 1).fill({ color: 0xffffff, alpha: 0.14 });
  }

  // ─── Main draw ───────────────────────────────────────────────────────
  private drawOffice(): void {
    const { officeGraphics, wallFaceGraphics, furnitureGraphics } = this;
    const W = CANVAS.width;
    const H = CANVAS.height;

    // Background
    officeGraphics.clear();
    officeGraphics.rect(0, 0, W, H).fill({ color: 0x080818 });

    // Zone floors with plank lines + perimeter darkening
    for (const zone of ZONES) {
      // Base floor
      officeGraphics.rect(zone.x, zone.y, zone.width, zone.height).fill(zone.floorColor);

      // Horizontal plank lines
      for (let ty = zone.y + 16; ty < zone.y + zone.height; ty += 16) {
        officeGraphics.rect(zone.x, ty, zone.width, 1).fill({ color: 0x000000, alpha: 0.18 });
      }

      // Perimeter ambient darkening (4-side inner shadow)
      const aw = 10; // ambient strip width
      officeGraphics.rect(zone.x, zone.y, zone.width, aw).fill({ color: 0x000000, alpha: 0.22 }); // top
      officeGraphics.rect(zone.x, zone.y + zone.height - aw, zone.width, aw).fill({ color: 0x000000, alpha: 0.28 }); // bottom
      officeGraphics.rect(zone.x, zone.y, aw, zone.height).fill({ color: 0x000000, alpha: 0.18 }); // left
      officeGraphics.rect(zone.x + zone.width - aw, zone.y, aw, zone.height).fill({ color: 0x000000, alpha: 0.18 }); // right
    }

    // Outer border
    officeGraphics.rect(1, 1, W - 2, H - 2).stroke({ width: 3, color: 0x2d2d5e });

    // Interior wall lines
    officeGraphics.moveTo(0, 155).lineTo(170, 155)
      .moveTo(0, 290).lineTo(170, 290)
      .moveTo(170, 0).lineTo(170, H)
      .moveTo(480, 0).lineTo(480, H)
      .moveTo(480, 135).lineTo(W, 135)
      .moveTo(480, 305).lineTo(W, 305)
      .moveTo(175, 340).lineTo(475, 340)
      .stroke({ width: 2, color: 0x2a2a5e });

    // Zone south-wall front faces (cabinet depth)
    // Only draw where the bottom edge doesn't sit at the canvas boundary
    wallFaceGraphics.clear();
    for (const zone of ZONES) {
      const bottom = zone.y + zone.height;
      if (bottom >= H) continue; // no face for zones flush with canvas bottom
      const faceColor = this.darken(zone.wallColor, 0.7);
      // Front face panel
      wallFaceGraphics.rect(zone.x, bottom, zone.width, WALL_H).fill(faceColor);
      // Ridge highlight at top of front face
      wallFaceGraphics.rect(zone.x, bottom, zone.width, 1).fill({ color: 0xffffff, alpha: 0.12 });
      // Base shadow at bottom of front face
      wallFaceGraphics.rect(zone.x, bottom + WALL_H - 2, zone.width, 2).fill({ color: 0x000000, alpha: 0.35 });
    }
    // Vertical wall front edge for center column (x=170)
    wallFaceGraphics.rect(170, 0, 3, H).fill({ color: 0x1a1a3a });
    // Vertical wall front edge for right column (x=480)
    wallFaceGraphics.rect(480, 0, 3, H).fill({ color: 0x1a1a3a });

    // Furniture
    furnitureGraphics.clear();
    this.drawFurniture(furnitureGraphics);
  }

  private drawFurniture(g: Graphics): void {
    this.drawCEOFurniture(g);
    this.drawHRFurniture(g);
    this.drawKitchenFurniture(g);
    this.drawDevHubFurniture(g);
    this.drawPMFurniture(g);
    this.drawDatabaseFurniture(g);
    this.drawResearcherFurniture(g);
    this.drawGamingFurniture(g);
    this.drawEntrance(g);
    this.drawLegend(g);
  }

  // ─── CEO Office ───────────────────────────────────────────────────────
  private drawCEOFurniture(g: Graphics): void {
    // Bookshelf (left wall)
    this.drawCabinet(g, 8, 10, 20, 110, 0x2a1a10, 6);
    for (let i = 0; i < 4; i++) {
      g.rect(10, 16 + i * 26, 16, 20).fill(this.lighten(0x2a1a10, 20 + i * 8));
    }

    // Executive desk
    this.drawCabinet(g, 50, 58, 70, 40, 0x4a3a2a, 9);

    // Monitor — glow screen
    g.rect(65, 42, 40, 26).fill({ color: 0x080810 });
    g.rect(67, 44, 36, 22).fill({ color: 0x00f5ff, alpha: 0.06 });
    // Screen radial glow
    g.rect(72, 47, 26, 13).fill({ color: 0x00f5ff, alpha: 0.14 });
    g.rect(67, 44, 36, 1).fill({ color: 0x00f5ff, alpha: 0.30 }); // top scanline
    // Monitor stand shadow
    g.rect(82, 68, 6, 3).fill({ color: 0x000000, alpha: 0.4 });

    // Chair (with cabinet front)
    this.drawCabinet(g, 68, 106, 32, 16, 0x2a2a40, 5);

    // Guest chairs
    this.drawCabinet(g, 28, 68, 14, 12, 0x222238, 4, 0.18);
    this.drawCabinet(g, 28, 98, 14, 12, 0x222238, 4, 0.18);

    // Plant
    this.drawPlant(g, 150, 12);

    // Thin accent line at desk bottom (floor meeting desk)
    g.rect(50, 107, 70, 1).fill({ color: 0x00f5ff, alpha: 0.12 });
  }

  // ─── HR Desk ──────────────────────────────────────────────────────────
  private drawHRFurniture(g: Graphics): void {
    this.drawCabinet(g, 48, 192, 72, 38, 0x4a3a2a, 9);

    // Monitor
    g.rect(63, 177, 36, 24).fill({ color: 0x080810 });
    g.rect(65, 179, 32, 20).fill({ color: 0xf472b6, alpha: 0.07 });
    g.rect(70, 181, 22, 10).fill({ color: 0xf472b6, alpha: 0.16 });
    g.rect(65, 179, 32, 1).fill({ color: 0xf472b6, alpha: 0.28 });

    // Chair
    this.drawCabinet(g, 68, 237, 28, 14, 0x222238, 5);

    // Decorative accent
    g.rect(90, 165, 18, 3).fill({ color: 0xf472b6, alpha: 0.35 });

    this.drawPlant(g, 148, 172);
  }

  // ─── Kitchen / Coffee ─────────────────────────────────────────────────
  private drawKitchenFurniture(g: Graphics): void {
    // Coffee machine
    this.drawCabinet(g, 18, 308, 52, 38, 0x3a2828, 8);
    g.rect(24, 318, 10, 14).fill({ color: 0x6a4030 });
    g.rect(40, 318, 10, 14).fill({ color: 0x6a4030 });
    // Steam glow
    g.rect(26, 314, 6, 4).fill({ color: 0xfff8e0, alpha: 0.25 });
    g.rect(42, 314, 6, 4).fill({ color: 0xfff8e0, alpha: 0.25 });

    // Round table — top face + ellipse front edge
    g.circle(100, 396, 30).fill({ color: 0x000000, alpha: 0.22 }); // shadow
    g.circle(100, 393, 30).fill({ color: 0x3a2a1a });
    g.circle(100, 393, 26).fill({ color: 0x4e3c28 });
    // Cabinet front edge of table (slightly lower)
    g.ellipse(100, 399, 26, 6).fill(this.darken(0x3a2a1a, 0.52));

    // Chairs around table
    for (const [cx, cy] of [[65, 393], [135, 393], [100, 360], [100, 426]] as [number, number][]) {
      g.circle(cx + 1, cy + 2, 8).fill({ color: 0x000000, alpha: 0.22 }); // shadow
      g.circle(cx, cy, 8).fill({ color: 0x222238 });
      g.circle(cx, cy, 5).fill(this.lighten(0x222238, 18));
    }

    // Fridge
    this.drawCabinet(g, 138, 298, 26, 42, 0x2e2e3e, 7);
    g.rect(140, 300, 22, 18).fill(this.lighten(0x2e2e3e, 12));
    g.rect(140, 320, 22, 18).fill(this.lighten(0x2e2e3e, 8));

    // Counter strip along top wall
    g.rect(0, 295, 170, 5).fill({ color: 0x1a1208, alpha: 0.6 });
  }

  // ─── Dev Hub ─────────────────────────────────────────────────────────
  private drawDevHubFurniture(g: Graphics): void {
    const clusterRows = [
      [{ x: 210, y: 10 }, { x: 310, y: 10 }],
      [{ x: 210, y: 90 }, { x: 310, y: 90 }],
      [{ x: 210, y: 170 }, { x: 310, y: 170 }],
      [{ x: 210, y: 250 }, { x: 310, y: 250 }],
    ];
    for (const row of clusterRows) {
      for (const pos of row) {
        this.drawDeskCluster(g, pos.x, pos.y);
      }
    }

    // "FOCUS > PLAN > EXECUTE" poster with cabinet depth
    this.drawCabinet(g, 400, 10, 60, 50, 0x1a1a30, 4, 0.15);
    g.rect(400, 10, 60, 50).stroke({ width: 1, color: 0x00f5ff, alpha: 0.3 });
    g.rect(408, 18, 44, 1).fill({ color: 0x00f5ff, alpha: 0.5 });
    g.rect(408, 30, 44, 1).fill({ color: 0x00f5ff, alpha: 0.5 });
    g.rect(408, 42, 44, 1).fill({ color: 0x00f5ff, alpha: 0.5 });

    // Meeting area rug hint
    g.rect(MEETING_AREA.x, MEETING_AREA.y, MEETING_AREA.width, MEETING_AREA.height)
      .fill({ color: 0x2a2a40, alpha: 0.5 });
    g.rect(MEETING_AREA.x, MEETING_AREA.y, MEETING_AREA.width, MEETING_AREA.height)
      .stroke({ width: 1, color: 0x4444aa, alpha: 0.3 });

    this.drawPlant(g, 188, 50);
    this.drawPlant(g, 458, 50);
    this.drawPlant(g, 188, 220);
    this.drawPlant(g, 458, 220);
  }

  private drawDeskCluster(g: Graphics, x: number, y: number): void {
    const W = 54;
    const H = 54;
    const border = 6;
    const frontH = 7;

    // Drop shadow
    g.rect(x + 5, y + 5, W, H + frontH).fill({ color: 0x000000, alpha: 0.28 });
    // Outer body (top)
    g.rect(x, y, W, H).fill({ color: 0x3d2b1f });
    // Inner warm surface
    g.rect(x + border, y + border, W - border * 2, H - border * 2).fill({ color: 0x5d4a36 });
    // Front face
    g.rect(x, y + H, W, frontH).fill(this.darken(0x3d2b1f, 0.52));
    // Ridge
    g.rect(x, y + H, W, 1).fill({ color: 0xffffff, alpha: 0.14 });
    // Top highlight
    g.rect(x, y, W, 1).fill({ color: 0xffffff, alpha: 0.10 });

    // Glass separator
    const bw = 7;
    const bx = x + W / 2 - bw / 2;
    g.rect(bx, y, bw, H).fill({ color: 0x2d9cdb, alpha: 0.55 });
    g.rect(bx, y, 1, H).fill({ color: 0xbfe9ff, alpha: 0.5 });
    g.rect(bx + bw - 1, y, 1, H).fill({ color: 0xbfe9ff, alpha: 0.5 });

    // Workstation bases + monitors
    const cy = y + H / 2;
    g.rect(x + 8, cy - 6, 10, 12).fill({ color: 0x2e3338 });
    g.rect(x + 12, cy - 9, 8, 16).fill({ color: 0x0e0e10 });
    g.rect(x + 13, cy - 8, 6, 10).fill({ color: 0x00f5ff, alpha: 0.12 });

    g.rect(x + W - 18, cy - 6, 10, 12).fill({ color: 0x2e3338 });
    g.rect(x + W - 20, cy - 9, 8, 16).fill({ color: 0x0e0e10 });
    g.rect(x + W - 19, cy - 8, 6, 10).fill({ color: 0x00f5ff, alpha: 0.12 });
  }

  // ─── PM Desk ─────────────────────────────────────────────────────────
  private drawPMFurniture(g: Graphics): void {
    this.drawCabinet(g, 288, 382, 82, 42, 0x4a3a2a, 9);

    g.rect(308, 368, 42, 26).fill({ color: 0x080810 });
    g.rect(310, 370, 38, 22).fill({ color: 0x4ecdc4, alpha: 0.07 });
    g.rect(316, 373, 26, 12).fill({ color: 0x4ecdc4, alpha: 0.18 });
    g.rect(310, 370, 38, 1).fill({ color: 0x4ecdc4, alpha: 0.30 });

    this.drawCabinet(g, 312, 430, 30, 14, 0x222238, 5);
  }

  // ─── Database Zone ────────────────────────────────────────────────────
  private drawDatabaseFurniture(g: Graphics): void {
    for (let i = 0; i < 4; i++) {
      const rx = 498 + i * 55;
      // Server rack with cabinet depth
      this.drawCabinet(g, rx, 14, 46, 98, 0x141422, 8, 0.3);
      g.rect(rx + 3, 17, 40, 90).fill({ color: 0x1e1e30 });
      // LEDs
      for (let j = 0; j < 6; j++) {
        const isGreen = Math.random() > 0.3;
        g.rect(rx + 36, 22 + j * 14, 4, 4).fill(isGreen ? 0x00ff88 : 0x003322);
        g.rect(rx + 8, 22 + j * 14, 4, 4).fill(Math.random() > 0.3 ? 0xff4444 : 0x332222);
      }
      // Front panel vents
      for (let j = 0; j < 8; j++) {
        g.rect(rx + 14, 20 + j * 12, 18, 2).fill({ color: 0x000000, alpha: 0.5 });
      }
    }

    // Whiteboard
    this.drawCabinet(g, 498, 100, 82, 24, 0x282838, 5, 0.15);
    g.rect(498, 100, 82, 24).stroke({ width: 1, color: 0x00f5ff, alpha: 0.25 });
    // Whiteboard writing lines
    g.rect(506, 107, 50, 1).fill({ color: 0x00f5ff, alpha: 0.35 });
    g.rect(506, 114, 35, 1).fill({ color: 0x00f5ff, alpha: 0.35 });
  }

  // ─── Researcher Area ─────────────────────────────────────────────────
  private drawResearcherFurniture(g: Graphics): void {
    // Long bench desk
    this.drawCabinet(g, 498, 178, 200, 48, 0x4a3a2a, 9);
    // Four monitors
    for (let i = 0; i < 4; i++) {
      const mx = 510 + i * 48;
      g.rect(mx, 162, 32, 20).fill({ color: 0x080810 });
      g.rect(mx + 2, 164, 28, 16).fill({ color: 0x45b7d1, alpha: 0.07 });
      g.rect(mx + 6, 167, 20, 9).fill({ color: 0x45b7d1, alpha: 0.18 });
      g.rect(mx + 2, 164, 28, 1).fill({ color: 0x45b7d1, alpha: 0.28 });
    }

    // Bookshelf (right wall)
    this.drawCabinet(g, 698, 148, 20, 98, 0x2a1a10, 6);
    for (let i = 0; i < 4; i++) {
      g.rect(700, 154 + i * 24, 16, 18).fill(this.lighten(0x2a1a10, 16 + i * 6));
    }

    this.drawPlant(g, 488, 192);
  }

  // ─── Gaming Zone ─────────────────────────────────────────────────────
  private drawGamingFurniture(g: Graphics): void {
    // Big screen / TV
    this.drawCabinet(g, 528, 326, 124, 68, 0x0e0e1c, 10, 0.3);
    g.rect(532, 330, 116, 60).fill({ color: 0x141428 });
    g.rect(536, 334, 108, 52).fill({ color: 0x00f5ff, alpha: 0.07 });
    // Screen scanlines
    for (let sy = 336; sy < 386; sy += 5) {
      g.rect(537, sy, 106, 1).fill({ color: 0x000000, alpha: 0.25 });
    }
    // Screen edge glow
    g.rect(532, 330, 116, 2).fill({ color: 0x00f5ff, alpha: 0.25 });
    g.rect(532, 388, 116, 2).fill({ color: 0x00f5ff, alpha: 0.12 });

    // Side accent panels
    this.drawCabinet(g, 508, 332, 16, 22, 0x3a0a1a, 5, 0.2);
    g.rect(510, 334, 12, 18).fill({ color: 0xff0055, alpha: 0.55 });

    this.drawCabinet(g, 656, 332, 16, 22, 0x0a1a2a, 5, 0.2);
    g.rect(658, 334, 12, 18).fill({ color: 0x00f5ff, alpha: 0.55 });

    // Gaming chairs (bean bag style)
    for (const [cx, cy, col] of [
      [540, 426, 0x4a2040], [600, 438, 0x2a4060], [660, 426, 0x6a2030],
    ] as [number, number, number][]) {
      g.circle(cx + 2, cy + 4, 18).fill({ color: 0x000000, alpha: 0.28 }); // shadow
      g.circle(cx, cy, 18).fill(col);
      g.circle(cx - 2, cy - 3, 10).fill(this.lighten(col, 28));
    }

    // Console table
    this.drawCabinet(g, 558, 406, 64, 14, 0x1a1a2e, 5);
  }

  // ─── Entrance ────────────────────────────────────────────────────────
  private drawEntrance(g: Graphics): void {
    // Door mat
    this.drawCabinet(g, 318, 453, 84, 18, 0x3a2a1a, 5, 0.2);
    g.rect(322, 457, 76, 10).fill({ color: 0x4a3a2a });
    // Door frame
    g.rect(313, 443, 94, 32).stroke({ width: 2, color: 0x00f5ff, alpha: 0.3 });
    g.moveTo(360, 443).lineTo(360, 475).stroke({ width: 2, color: 0x00f5ff, alpha: 0.3 });

    this.drawPlant(g, 298, 448);
    this.drawPlant(g, 408, 448);
  }

  // ─── Legend ──────────────────────────────────────────────────────────
  private drawLegend(g: Graphics): void {
    const H = CANVAS.height;
    const lx = 8;
    const ly = H - 80;

    g.rect(lx, ly, 162, 75).fill({ color: 0x08081a, alpha: 0.90 });
    g.rect(lx, ly, 162, 75).stroke({ width: 1, color: 0x2d2d5e, alpha: 0.5 });
    // Cabinet front edge on legend panel
    g.rect(lx, ly + 75, 162, 4).fill(this.darken(0x08081a, 0.5));

    const items = [
      { color: 0x1e1828, label: 'CEO Office' },
      { color: 0x1e1a14, label: 'HR Desk' },
      { color: 0x141a28, label: 'Database' },
      { color: 0x141a18, label: 'Researcher' },
      { color: 0x1a1a22, label: 'Dev & PM' },
      { color: 0x1a1428, label: 'Gaming' },
      { color: 0x1a1410, label: 'Kitchen' },
    ];

    const labelStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: 0x8888aa });
    items.forEach((item, i) => {
      const iy = ly + 8 + i * 10;
      g.rect(lx + 6, iy, 8, 8).fill(item.color);
      g.rect(lx + 6, iy, 8, 8).stroke({ width: 1, color: 0x2d2d5e, alpha: 0.3 });
      const label = new Text({ text: item.label, style: labelStyle });
      label.position.set(lx + 18, iy - 1);
      this.labelsContainer.addChild(label);
    });
  }

  // ─── Plant (circle-based foliage) ────────────────────────────────────
  private drawPlant(g: Graphics, x: number, y: number): void {
    // Pot with cabinet front
    this.drawCabinet(g, x - 1, y + 10, 14, 10, 0x3a2010, 4, 0.2);
    // Stem
    g.rect(x + 5, y + 5, 2, 8).fill({ color: 0x1a4a1a });
    // Foliage circles (layered for depth)
    g.circle(x + 6, y + 8, 7).fill({ color: 0x1a4a1a }); // back/shadow
    g.circle(x + 3, y + 4, 6).fill({ color: 0x2a6a2a });
    g.circle(x + 9, y + 4, 6).fill({ color: 0x256625 });
    g.circle(x + 6, y + 1, 5).fill({ color: 0x3a8a3a }); // top/lit
    // Highlight dot
    g.circle(x + 4, y, 2).fill({ color: 0x5aaa5a, alpha: 0.7 });
  }

  // ─── Zone labels ─────────────────────────────────────────────────────
  private drawZoneLabels(): void {
    const zoneStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: 0x5555bb });
    for (const zone of ZONES) {
      const label = new Text({ text: zone.name.toUpperCase(), style: zoneStyle });
      label.alpha = 0.65;
      label.position.set(zone.x + 5, zone.y + 5);
      this.labelsContainer.addChild(label);
    }
  }

  destroy(): void {
    this.labelsContainer.destroy({ children: true });
    this.officeContainer.destroy({ children: true });
  }
}
