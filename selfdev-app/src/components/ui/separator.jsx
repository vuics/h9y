"use client"

import { Separator as SeparatorPrimitive } from "react-aria-components"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "tw:block tw:shrink-0 tw:border-0 tw:bg-border tw:aria-[orientation=horizontal]:h-px tw:aria-[orientation=horizontal]:w-full tw:aria-[orientation=vertical]:w-px tw:aria-[orientation=vertical]:self-stretch tw:[:is(hr)]:h-px tw:[:is(hr)]:w-full",
        className
      )}
      {...props} />
  );
}

export { Separator }
