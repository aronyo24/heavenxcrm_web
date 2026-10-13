import { cn } from "@/lib/utils"

// Brand assets live in /public (sources in /brand-source). The light
// variant has the "by Technoheaven" line in white for dark backgrounds.
const LOGO = "/heavenxcrm-logo.png"
const LOGO_LIGHT = "/heavenxcrm-logo-light.png"
const MARK = "/heavenxcrm-mark.png"

type BrandLogoProps = {
  className?: string
  // "auto" follows the app theme, "light" is for always-dark surfaces
  // such as the sidebars.
  tone?: "auto" | "dark" | "light"
}

export function BrandLogo({ className, tone = "auto" }: BrandLogoProps) {
  const img = (src: string, extra?: string) => (
    <img src={src} alt="HeavenXCRM by Technoheaven" draggable={false} className={cn("h-10 w-auto select-none", className, extra)} />
  )
  if (tone === "dark") return img(LOGO)
  if (tone === "light") return img(LOGO_LIGHT)
  return (
    <>
      {img(LOGO, "dark:hidden")}
      {img(LOGO_LIGHT, "hidden dark:block")}
    </>
  )
}

export function BrandMark({ className }: { className?: string }) {
  return <img src={MARK} alt="HeavenXCRM" draggable={false} className={cn("h-8 w-8 select-none", className)} />
}
