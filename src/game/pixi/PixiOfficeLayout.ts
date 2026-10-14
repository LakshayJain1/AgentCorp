import { OfficeLocation } from '@/agents/AgentTypes';

export const CANVAS = { width: 720, height: 480 };
export const WALL_H = 18; // cabinet projection front-face height in px

export interface ZoneDef {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floorColor: number;
  wallColor: number;
  role?: OfficeLocation['role'];
  label?: string;
}

// Zone layout matching reference floor plan
// Dark theme palette: warm wood, muted tans, cool blues, deep purples
export const ZONES: ZoneDef[] = [
  // Left column
  { id: 'ceo_office', name: 'CEO Office', x: 0, y: 0, width: 170, height: 155, floorColor: 0x1e1828, wallColor: 0x2a2040, role: 'ceo' },
  { id: 'hr_desk', name: 'HR Desk', x: 0, y: 160, width: 170, height: 130, floorColor: 0x1e1a14, wallColor: 0x2a2620, role: 'hr' },
  { id: 'kitchen', name: 'Kitchen / Coffee Zone', x: 0, y: 295, width: 170, height: 185, floorColor: 0x1a1410, wallColor: 0x2a2018, role: 'coffee' },

  // Center - Development & PM Area
  { id: 'dev_hub', name: 'Development & PM Area', x: 175, y: 0, width: 300, height: 340, floorColor: 0x1a1a22, wallColor: 0x2a2a3a },
  { id: 'pm_desk', name: 'Project Manager', x: 175, y: 345, width: 300, height: 135, floorColor: 0x1a1a22, wallColor: 0x2a2a3a, role: 'pm' },

  // Right column
  { id: 'database_zone', name: 'Database Zone', x: 480, y: 0, width: 240, height: 135, floorColor: 0x141a28, wallColor: 0x202a40 },
  { id: 'researcher_area', name: 'Researcher Area', x: 480, y: 140, width: 240, height: 165, floorColor: 0x141a18, wallColor: 0x202a24, role: 'researcher' },
  { id: 'gaming_zone', name: 'Gaming Zone', x: 480, y: 310, width: 240, height: 170, floorColor: 0x1a1428, wallColor: 0x2a2040, role: 'gaming' },
];

// Desk positions for each role (relative to canvas)
export const DESK_POSITIONS: Record<string, { x: number; y: number }[]> = {
  ceo: [
    { x: 85, y: 80 },   // Executive desk center
  ],
  hr: [
    { x: 85, y: 225 },  // HR desk center
  ],
  pm: [
    { x: 325, y: 410 }, // PM desk at bottom center
  ],
  engineer: [
    { x: 245, y: 100 }, // Top-left dev cluster
    { x: 325, y: 100 }, // Top-right dev cluster
    { x: 245, y: 180 }, // Bottom-left dev cluster
    { x: 325, y: 180 }, // Bottom-right dev cluster
  ],
  qa: [
    { x: 325, y: 260 }, // QA desk in dev area
  ],
  researcher: [
    { x: 530, y: 200 }, // Researcher workstation 1
    { x: 590, y: 200 }, // Researcher workstation 2
    { x: 650, y: 200 }, // Researcher workstation 3
  ],
};

// Meeting area (open space in dev hub)
export const MEETING_AREA = { x: 250, y: 260, width: 120, height: 60 };

// Wall definitions for collision detection
export const WALLS: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  // Zone dividers
  { x1: 0, y1: 155, x2: 170, y2: 155 },
  { x1: 0, y1: 290, x2: 170, y2: 290 },
  { x1: 170, y1: 0, x2: 170, y2: 480 },
  { x1: 480, y1: 0, x2: 480, y2: 480 },
  { x1: 480, y1: 135, x2: 720, y2: 135 },
  { x1: 480, y1: 305, x2: 720, y2: 305 },
  { x1: 175, y1: 340, x2: 475, y2: 340 },
];

let _locationsCache: OfficeLocation[] | null = null;

// Convert zones + desks to OfficeLocation[] for gameStore compatibility
export function toOfficeLocations(): OfficeLocation[] {
  if (_locationsCache) return _locationsCache;
  const locations: OfficeLocation[] = [];

  // Add role-based desk locations
  for (const [role, desks] of Object.entries(DESK_POSITIONS)) {
    desks.forEach((desk, i) => {
      const zone = ZONES.find(z => z.role === role);
      locations.push({
        id: `${role}_desk${desks.length > 1 ? `_${i}` : ''}`,
        name: `${role.charAt(0).toUpperCase() + role.slice(1)} Desk${desks.length > 1 ? ` ${i + 1}` : ''}`,
        x: desk.x,
        y: desk.y,
        role: role as OfficeLocation['role'],
        width: 60,
        height: 50,
      });
    });
  }

  // Add coffee/kitchen location
  locations.push({
    id: 'coffee_machine',
    name: 'Coffee Machine',
    x: 85,
    y: 390,
    role: 'coffee',
    width: 60,
    height: 50,
  });

  // Add gaming zone location
  locations.push({
    id: 'gaming_zone',
    name: 'Gaming Zone',
    x: 600,
    y: 395,
    role: 'gaming',
    width: 80,
    height: 60,
  });

  // Add meeting area
  locations.push({
    id: 'meeting_room',
    name: 'Meeting Area',
    x: MEETING_AREA.x + MEETING_AREA.width / 2,
    y: MEETING_AREA.y + MEETING_AREA.height / 2,
    role: 'meeting',
    width: MEETING_AREA.width,
    height: MEETING_AREA.height,
  });

  _locationsCache = locations;
  return locations;
}

// Collision detection helpers
export function doLinesIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return false;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function isWallBetween(x1: number, y1: number, x2: number, y2: number): boolean {
  for (const wall of WALLS) {
    if (doLinesIntersect(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
      return true;
    }
  }
  return false;
}

export function findLocationByRole(role: OfficeLocation['role']): OfficeLocation | undefined {
  const locations = toOfficeLocations();
  return locations.find(l => l.role === role);
}

export function findLocationById(id: string): OfficeLocation | undefined {
  const locations = toOfficeLocations();
  return locations.find(l => l.id === id);
}