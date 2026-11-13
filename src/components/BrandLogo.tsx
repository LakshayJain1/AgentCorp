import Image from 'next/image'

interface BrandLogoProps {
  /** Rendered size in px (the icon is square). */
  size?: number
  className?: string
  /** Corner radius in px. Defaults to ~28% of size, matching the app-icon shape. */
  radius?: number
  priority?: boolean
}

/** The AgentCorp "AC" brand mark on its dark app-icon tile. */
export default function BrandLogo({ size = 32, className = '', radius, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/ac-icon.png"
      alt="AgentCorp"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28) }}
    />
  )
}
