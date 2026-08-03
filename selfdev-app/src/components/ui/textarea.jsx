import * as React from "react"
import {
  composeRenderProps,
  TextArea as TextareaPrimitive,
} from "react-aria-components"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          "tw:flex tw:field-sizing-content tw:min-h-16 tw:w-full tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-2.5 tw:py-2 tw:text-base tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:placeholder:text-muted-foreground tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-destructive tw:aria-invalid:ring-3 tw:aria-invalid:ring-destructive/20 tw:md:text-sm tw:dark:bg-input/30 tw:dark:aria-invalid:border-destructive/50 tw:dark:aria-invalid:ring-destructive/40",
          className
        ))}
      {...props} />
  );
}

export { Textarea }
