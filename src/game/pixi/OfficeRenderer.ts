import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { CANVAS, ZONES, MEETING_AREA, toOfficeLocations } from './PixiOfficeLayout';

export class OfficeRenderer {
  private app: Application;
  private officeContainer: Container;
  private officeGraphics: Graphics;
  private furnitureGraphics: Graphics;
  private labelsContainer: Container;

  constructor(app: Application) {
    this.app = app;
    this.officeContainer = new Container();
    this.officeContainer.zIndex = 0;
    this.app.stage.addChild(this.officeContainer);

    this.officeGraphics = new Graphics();
    this.furnitureGraphics = new Graphics();
    this.labelsContainer = new Container();
    this.officeContainer.addChild(this.officeGraphics, this.furnitureGraphics, this.labelsContainer);

    this.drawOffice();
    this.drawZoneLabels();
  }

  private drawOffice(): void {
    const { officeGraphics, furnitureGraphics } = this;
    const W = CANVAS.width;
    const H = CANVAS.height;

    // Background
    officeGraphics.clear();
    officeGraphics.rect(0, 0, W, H);
    officeGraphics.fill({ color: 0x0a0a1e });

    // Subtle grid pattern
    for (let x = 0; x < W; x += 8) {
      for (let y = 0; y < H; y += 8) {
        if ((x + y) % 16 === 0) {
          officeGraphics.rect(x, y, 4, 4);
          officeGraphics.fill({ color: 0x0c0c20 });
        }
      }
    }

    // Zone floors
    for (const zone of ZONES) {
      officeGraphics.rect(zone.x, zone.y, zone.width, zone.height);
      officeGraphics.fill({ color: zone.floorColor });

      // Subtle tile pattern
      for (let tx = zone.x; tx < zone.x + zone.width; tx += 16) {
        for (let ty = zone.y; ty < zone.y + zone.height; ty += 16) {
          officeGraphics.rect(tx, ty, 15, 15);
          officeGraphics.fill({ color: zone.floorColor + 0x040404, alpha: 0.3 });
        }
      }
    }

    // Walls
    officeGraphics.stroke({ width: 3, color: 0x2d2d5e, alpha: 1 });
    officeGraphics.rect(1, 1, W - 2, H - 2);
    officeGraphics.stroke();

    officeGraphics.stroke({ width: 2, color: 0x2a2a5e, alpha: 1 });
    // Left column dividers
    officeGraphics.moveTo(0, 155); officeGraphics.lineTo(170, 155);
    officeGraphics.moveTo(0, 290); officeGraphics.lineTo(170, 290);
    officeGraphics.moveTo(170, 0); officeGraphics.lineTo(170, H);
    // Right column dividers
    officeGraphics.moveTo(480, 0); officeGraphics.lineTo(480, H);
    officeGraphics.moveTo(480, 135); officeGraphics.lineTo(W, 135);
    officeGraphics.moveTo(480, 305); officeGraphics.lineTo(W, 305);
    // Center horizontal
    officeGraphics.moveTo(175, 340); officeGraphics.lineTo(475, 340);
    officeGraphics.stroke();

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

  private drawCEOFurniture(g: Graphics): void {
    // Executive desk
    g.rect(50, 60, 70, 45); g.fill({ color: 0x3a2a1a });
    g.rect(54, 64, 62, 37); g.fill({ color: 0x4a3a2a });
    // Monitor
    g.rect(65, 45, 40, 28); g.fill({ color: 0x0a0a1a });
    g.rect(67, 47, 36, 24); g.fill({ color: 0x00f5ff, alpha: 0.08 });
    // Chair
    g.rect(70, 110, 30, 20); g.fill({ color: 0x1a1a2e });
    // Bookshelf
    g.rect(8, 10, 20, 130); g.fill({ color: 0x2a1a10 });
    for (let i = 0; i < 5; i++) {
      g.rect(10, 15 + i * 25, 16, 20); g.fill({ color: 0x3a2a1a });
    }
    // Guest chairs
    g.rect(30, 70, 14, 14); g.fill({ color: 0x1a1a2e });
    g.rect(30, 100, 14, 14); g.fill({ color: 0x1a1a2e });
    // Plant
    this.drawPlant(g, 150, 15);
    // Label line
    g.rect(55, 135, 60, 1); g.fill({ color: 0x00f5ff, alpha: 0.3 });
  }

  private drawHRFurniture(g: Graphics): void {
    g.rect(50, 195, 70, 40); g.fill({ color: 0x3a2a1a });
    g.rect(54, 199, 62, 32); g.fill({ color: 0x4a3a2a });
    g.rect(65, 180, 35, 25); g.fill({ color: 0x0a0a1a });
    g.rect(67, 182, 31, 21); g.fill({ color: 0xf472b6, alpha: 0.1 });
    g.rect(70, 240, 25, 16); g.fill({ color: 0x1a1a2e });
    this.drawPlant(g, 150, 175);
  }

  private drawKitchenFurniture(g: Graphics): void {
    // Coffee machine
    g.rect(20, 310, 50, 40); g.fill({ color: 0x2a1a1a });
    g.rect(24, 314, 42, 32); g.fill({ color: 0x3a2a2a });
    g.rect(30, 320, 8, 10); g.fill({ color: 0x6a4a2a });
    g.rect(45, 320, 8, 10); g.fill({ color: 0x6a4a2a });
    // Round table
    g.circle(100, 400, 30); g.fill({ color: 0x3a2a1a });
    g.circle(100, 400, 25); g.fill({ color: 0x4a3a2a });
    // Chairs around table
    g.circle(65, 400, 8); g.fill({ color: 0x1a1a2e });
    g.circle(135, 400, 8); g.fill({ color: 0x1a1a2e });
    g.circle(100, 365, 8); g.fill({ color: 0x1a1a2e });
    g.circle(100, 435, 8); g.fill({ color: 0x1a1a2e });
    // Fridge
    g.rect(140, 300, 25, 45); g.fill({ color: 0x2a2a3a });
    g.rect(142, 302, 21, 20); g.fill({ color: 0x3a3a4a });
    g.rect(142, 324, 21, 19); g.fill({ color: 0x3a3a4a });
  }

  private drawDevHubFurniture(g: Graphics): void {
    const clusterPositions = [
      { x: 210, y: 10 }, { x: 310, y: 10 },
      { x: 210, y: 90 }, { x: 310, y: 90 },
    ];
    for (const pos of clusterPositions) {
      this.drawDeskCluster(g, pos.x, pos.y);
    }

    const cluster2Positions = [
      { x: 210, y: 170 }, { x: 310, y: 170 },
      { x: 210, y: 250 }, { x: 310, y: 250 },
    ];
    for (const pos of cluster2Positions) {
      this.drawDeskCluster(g, pos.x, pos.y);
    }

    // "FOCUS > PLAN > EXECUTE" poster
    g.rect(400, 10, 60, 50); g.fill({ color: 0x1a1a2e });
    g.rect(400, 10, 60, 50); g.stroke({ width: 1, color: 0x00f5ff, alpha: 0.3 });
    g.rect(408, 18, 44, 1); g.fill({ color: 0x00f5ff, alpha: 0.5 });
    g.rect(408, 30, 44, 1); g.fill({ color: 0x00f5ff, alpha: 0.5 });
    g.rect(408, 42, 44, 1); g.fill({ color: 0x00f5ff, alpha: 0.5 });

    this.drawPlant(g, 190, 55);
    this.drawPlant(g, 460, 55);
    this.drawPlant(g, 190, 225);
    this.drawPlant(g, 460, 225);
  }

  private drawDeskCluster(g: Graphics, x: number, y: number): void {
    const W = 54;
    const H = 54;
    const border = 6;
    // Outer dark border
    g.rect(x, y, W, H); g.fill({ color: 0x3d2b1f });
    // Inner warm brown
    g.rect(x + border, y + border, W - border * 2, H - border * 2); g.fill({ color: 0x5d4a36 });
    // Glass separator - translucent blue with highlight edges
    const bw = 7;
    const bx = x + W / 2 - bw / 2;
    g.rect(bx, y, bw, H); g.fill({ color: 0x2d9cdb, alpha: 0.55 });
    g.rect(bx, y, 1, H); g.fill({ color: 0xbfe9ff, alpha: 0.5 });
    g.rect(bx + bw - 1, y, 1, H); g.fill({ color: 0xbfe9ff, alpha: 0.5 });
    // Workstations - small gray base + slim black monitor, mirrored
    const cy = y + H / 2;
    // Left
    g.rect(x + 8, cy - 6, 10, 12); g.fill({ color: 0x2e3338 });
    g.rect(x + 12, cy - 8, 8, 16); g.fill({ color: 0x0e0e10 });
    // Right
    g.rect(x + W - 18, cy - 6, 10, 12); g.fill({ color: 0x2e3338 });
    g.rect(x + W - 20, cy - 8, 8, 16); g.fill({ color: 0x0e0e10 });
  }

  private drawPMFurniture(g: Graphics): void {
    g.rect(290, 385, 80, 45); g.fill({ color: 0x3a2a1a });
    g.rect(294, 389, 72, 37); g.fill({ color: 0x4a3a2a });
    g.rect(310, 370, 40, 28); g.fill({ color: 0x0a0a1a });
    g.rect(312, 372, 36, 24); g.fill({ color: 0x4ecdc4, alpha: 0.1 });
    g.rect(315, 433, 28, 16); g.fill({ color: 0x1a1a2e });
  }

  private drawDatabaseFurniture(g: Graphics): void {
    for (let i = 0; i < 4; i++) {
      const rx = 500 + i * 55;
      g.rect(rx, 15, 45, 100); g.fill({ color: 0x0a0a1a });
      g.rect(rx + 3, 18, 39, 94); g.fill({ color: 0x1a1a2e });
      // LEDs
      for (let j = 0; j < 6; j++) {
        g.rect(rx + 35, 22 + j * 14, 4, 4); g.fill({ color: Math.random() > 0.3 ? 0x00ff88 : 0x003322 });
        g.rect(rx + 8, 22 + j * 14, 4, 4); g.fill({ color: Math.random() > 0.3 ? 0xff4444 : 0x332222 });
      }
    }
    // Whiteboard
    g.rect(500, 100, 80, 25); g.fill({ color: 0x2a2a3a });
    g.rect(500, 100, 80, 25); g.stroke({ width: 1, color: 0x00f5ff, alpha: 0.3 });
  }

  private drawResearcherFurniture(g: Graphics): void {
    g.rect(500, 180, 200, 50); g.fill({ color: 0x3a2a1a });
    g.rect(504, 184, 192, 42); g.fill({ color: 0x4a3a2a });
    for (let i = 0; i < 4; i++) {
      const mx = 515 + i * 48;
      g.rect(mx, 165, 30, 20); g.fill({ color: 0x0a0a1a });
      g.rect(mx + 2, 167, 26, 16); g.fill({ color: 0x45b7d1, alpha: 0.1 });
    }
    g.rect(700, 150, 18, 100); g.fill({ color: 0x2a1a10 });
    for (let i = 0; i < 4; i++) {
      g.rect(702, 155 + i * 24, 14, 18); g.fill({ color: 0x3a2a1a });
    }
    this.drawPlant(g, 490, 195);
  }

  private drawGamingFurniture(g: Graphics): void {
    g.rect(530, 330, 120, 70); g.fill({ color: 0x0a0a1a });
    g.rect(534, 334, 112, 62); g.fill({ color: 0x1a1a2e });
    g.rect(538, 338, 104, 54); g.fill({ color: 0x00f5ff, alpha: 0.08 });
    g.rect(510, 335, 15, 20); g.fill({ color: 0xff0055, alpha: 0.6 });
    g.rect(655, 335, 15, 20); g.fill({ color: 0x00f5ff, alpha: 0.6 });
    g.circle(540, 430, 18); g.fill({ color: 0x4a2040 });
    g.circle(600, 440, 18); g.fill({ color: 0x2a4060 });
    g.circle(660, 430, 18); g.fill({ color: 0x6a2030 });
    g.rect(560, 410, 60, 15); g.fill({ color: 0x1a1a2e });
  }

  private drawEntrance(g: Graphics): void {
    g.rect(320, 455, 80, 20); g.fill({ color: 0x3a2a1a });
    g.rect(324, 459, 72, 12); g.fill({ color: 0x4a3a2a });
    g.rect(315, 445, 90, 30); g.stroke({ width: 2, color: 0x00f5ff, alpha: 0.3 });
    g.moveTo(360, 445); g.lineTo(360, 475); g.stroke({ width: 2, color: 0x00f5ff, alpha: 0.3 });
    this.drawPlant(g, 300, 450);
    this.drawPlant(g, 410, 450);
  }

  private drawLegend(g: Graphics): void {
    const H = CANVAS.height;
    const lx = 10;
    const ly = H - 80;

    g.rect(lx, ly, 160, 75); g.fill({ color: 0x0a0a1e, alpha: 0.85 });
    g.rect(lx, ly, 160, 75); g.stroke({ width: 1, color: 0x2d2d5e, alpha: 0.5 });

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
      g.rect(lx + 6, iy, 8, 8); g.fill({ color: item.color });
      g.rect(lx + 6, iy, 8, 8); g.stroke({ width: 1, color: 0x2d2d5e, alpha: 0.3 });

      const label = new Text({ text: item.label, style: labelStyle });
      label.position.set(lx + 18, iy - 1);
      this.labelsContainer.addChild(label);
    });
  }

  private drawZoneLabels(): void {
    const zoneStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: 0x4444aa });

    for (const zone of ZONES) {
      const label = new Text({ text: zone.name.toUpperCase(), style: zoneStyle });
      label.alpha = 0.7;
      label.position.set(zone.x + 4, zone.y + 4);
      this.labelsContainer.addChild(label);
    }
  }

  private drawPlant(g: Graphics, x: number, y: number): void {
    g.rect(x, y + 8, 12, 14); g.fill({ color: 0x1a3a1a });
    g.rect(x + 2, y, 8, 12); g.fill({ color: 0x2a5a2a });
    g.rect(x + 4, y - 2, 4, 6); g.fill({ color: 0x3a7a3a });
  }

  destroy(): void {
    this.labelsContainer.destroy({ children: true });
    this.officeContainer.destroy({ children: true });
  }
}