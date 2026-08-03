"use client"

import * as React from "react"
import {
  composeRenderProps,
  Input as InputPrimitive,
} from "react-aria-components"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className) =>
        cn(
          "tw:h-9 tw:w-full tw:min-w-0 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-2.5 tw:py-1 tw:text-base tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:file:inline-flex tw:file:h-7 tw:file:border-0 tw:file:bg-transparent tw:file:text-sm tw:file:font-medium tw:file:text-foreground tw:placeholder:text-muted-foreground tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-destructive tw:aria-invalid:ring-3 tw:aria-invalid:ring-destructive/20 tw:md:text-sm tw:dark:bg-input/30 tw:dark:aria-invalid:border-destructive/50 tw:dark:aria-invalid:ring-destructive/40",
          className
        ))}
      {...props} />
  );
}

export { Input }
