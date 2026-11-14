import type { Icon } from '@phosphor-icons/react';
import {
  Crown, ClipboardText, Flask, Code, MagnifyingGlass, UsersThree, Briefcase, Coins, Gear, Robot,
} from '@phosphor-icons/react';

const ROLE_ICONS: Record<string, Icon> = {
  ceo: Crown,
  pm: ClipboardText,
  researcher: Flask,
  engineer: Code,
  qa: MagnifyingGlass,
  hr: UsersThree,
  sales: Briefcase,
  finance: Coins,
  ops: Gear,
};

/** Phosphor icon for an agent role (case-insensitive); falls back to a robot. */
export default function RoleIcon({
  role, size = 16, weight = 'duotone', className,
}: { role?: string; size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; className?: string }) {
  const I = ROLE_ICONS[(role || '').toLowerCase()] ?? Robot;
  return <I size={size} weight={weight} className={className} aria-hidden />;
}
