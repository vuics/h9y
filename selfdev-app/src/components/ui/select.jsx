import * as React from "react"
import {
  Button as ButtonPrimitive,
  composeRenderProps,
  Header as HeaderPrimitive,
  ListBoxItem as ListBoxItemPrimitive,
  ListBox as ListBoxPrimitive,
  ListBoxSection as ListBoxSectionPrimitive,
  Popover as PopoverPrimitive,
  SearchField,
  Select as SelectPrimitive,
  SelectValue as SelectValuePrimitive,
  Separator as SeparatorPrimitive,
} from "react-aria-components";

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ChevronDownIcon, SearchIcon, CheckIcon } from "lucide-react"

function Select(
  {
    className,
    ...props
  }
) {
  return (<SelectPrimitive data-slot="select" className={cn("tw:w-fit", className)} {...props} />);
}

function SelectGroup(
  {
    className,
    ...props
  }
) {
  return (
    <ListBoxSectionPrimitive
      data-slot="select-group"
      className={cn("tw:scroll-my-1 tw:p-1", className)}
      {...props} />
  );
}

function SelectValue(
  {
    className,
    children,
    ...props
  }
) {
  return (
    <SelectValuePrimitive
      data-slot="select-value"
      className={cn(
        "tw:flex tw:flex-1 tw:text-left tw:data-placeholder:text-muted-foreground",
        className
      )}
      {...props}>
      {typeof children === "function"
        ? children
        : ({ selectedItems, selectedText, defaultChildren }) =>
            selectedItems.length > 1 ? selectedText : defaultChildren}
    </SelectValuePrimitive>
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-1.5 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:py-2 tw:pr-2 tw:pl-2.5 tw:text-sm tw:whitespace-nowrap tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-destructive tw:aria-invalid:ring-3 tw:aria-invalid:ring-destructive/20 tw:data-placeholder:text-muted-foreground tw:data-[size=default]:h-9 tw:data-[size=sm]:h-8 tw:*:data-[slot=select-value]:line-clamp-1 tw:*:data-[slot=select-value]:flex tw:*:data-[slot=select-value]:items-center tw:*:data-[slot=select-value]:gap-1.5 tw:dark:bg-input/30 tw:dark:hover:bg-input/50 tw:dark:aria-invalid:border-destructive/50 tw:dark:aria-invalid:ring-destructive/40 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}>
      {children}
      <ChevronDownIcon className="tw:pointer-events-none tw:size-4 tw:text-muted-foreground" />
    </ButtonPrimitive>
  );
}

function SelectContent({
  className,
  children,
  placement = "bottom",
  offset = 4,
  crossOffset = 0,
  ...props
}) {
  return (
    <SelectPopover
      className={className}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      {...props}>
      <SelectList>{children}</SelectList>
    </SelectPopover>
  );
}

function SelectPopover({
  className,
  children,
  placement = "bottom start",
  offset = 4,
  crossOffset = 0,
  // Non-modal on purpose. A modal popover scroll-locks the page by setting
  // `overflow: hidden` on <html>, but this app also makes <body> a scroll
  // container (`body, html { height: 100% }`). The scroll offset is then
  // counted on both, so opening a select while scrolled down pushed the whole
  // app twice the scroll distance off-screen and the page went blank.
  isNonModal = true,
  ...props
}) {
  return (
    <PopoverPrimitive
      data-slot="select-content"
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      isNonModal={isNonModal}
      // min-w rather than a fixed w: locking the popover to the trigger width
      // clipped every option label longer than the trigger.
      className={cn(
        "tw: tw: tw:relative tw:isolate tw:z-50 tw:min-w-(--trigger-width) tw:max-w-[min(28rem,calc(100vw-1rem))] tw:origin-(--trigger-anchor-point) tw:overflow-hidden tw:rounded-md tw:bg-popover tw:text-popover-foreground tw:shadow-md tw:ring-1 tw:ring-foreground/10 tw:duration-100 tw:data-entering:animate-in tw:data-entering:fade-in-0 tw:data-entering:zoom-in-95 tw:data-exiting:animate-out tw:data-exiting:fade-out-0 tw:data-exiting:zoom-out-95 tw:data-[placement=bottom]:slide-in-from-top-2 tw:data-[placement=left]:slide-in-from-right-2 tw:data-[placement=right]:slide-in-from-left-2 tw:data-[placement=top]:slide-in-from-bottom-2 tw:**:data-[slot$=-item]:data-focused:bg-foreground/10",
        className
      )}
      {...props}>
      {children}
    </PopoverPrimitive>
  );
}

function SelectList(
  {
    className,
    ...props
  }
) {
  return (
    <ListBoxPrimitive
      data-slot="select-list"
      className={cn(
        "tw:group/select-list tw:max-h-[inherit] tw:overflow-x-hidden tw:overflow-y-auto tw:p-0 tw:outline-hidden",
        className
      )}
      {...props} />
  );
}

function SelectInput({
  className,
  ...props
}) {
  return (
    <SearchField
      {...props}
      autoFocus
      data-slot="select-input-wrapper"
      className={cn("tw:p-1 tw:pb-0", className)}>
      <InputGroup>
        <InputGroupInput
          data-slot="select-input"
          className="tw:[&::-webkit-search-cancel-button]:hidden" />
        <InputGroupAddon>
          <SearchIcon className="tw:size-4 tw:shrink-0 tw:opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </SearchField>
  );
}

function SelectLabel({
  className,
  ...props
}) {
  return (
    <HeaderPrimitive
      data-slot="select-label"
      className={cn("tw:px-2 tw:py-1.5 tw:text-xs tw:text-muted-foreground", className)}
      {...props} />
  );
}

function SelectItem({
  className,
  children,
  ...props
}) {
  return (
    <ListBoxItemPrimitive
      data-slot="select-item"
      textValue={typeof children === "string" ? children : undefined}
      className={cn(
        "tw:relative tw:flex tw:w-full tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-8 tw:pl-2 tw:text-sm tw:outline-hidden tw:select-none tw:focus:bg-accent tw:focus:text-accent-foreground tw:not-data-[variant=destructive]:focus:**:text-accent-foreground tw:data-focused:bg-accent tw:data-focused:text-accent-foreground tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4 tw:*:[span]:last:flex tw:*:[span]:last:items-center tw:*:[span]:last:gap-2",
        className
      )}
      {...props}>
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span className="tw:flex tw:flex-1 tw:shrink-0 tw:gap-2 tw:whitespace-nowrap">
            {children}
          </span>
          <span
            className="tw:pointer-events-none tw:absolute tw:right-2 tw:flex tw:size-4 tw:items-center tw:justify-center">
            {isSelected ? (
              <CheckIcon className="tw:pointer-events-none" />
            ) : null}
          </span>
        </>
      ))}
    </ListBoxItemPrimitive>
  );
}

function SelectSeparator({
  className,
  ...props
}) {
  return (
    <SeparatorPrimitive
      data-slot="select-separator"
      className={cn("tw:pointer-events-none tw:-mx-1 tw:my-1 tw:h-px tw:bg-border", className)}
      {...props} />
  );
}

function SelectEmpty({
  className,
  ...props
}) {
  return (
    <div
      data-slot="select-empty"
      className={cn(
        "tw:hidden tw:w-full tw:justify-center tw:py-2 tw:text-center tw:text-sm tw:text-muted-foreground tw:group-data-empty/select-list:flex",
        className
      )}
      {...props} />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectInput,
  SelectItem,
  SelectLabel,
  SelectList,
  SelectPopover,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectEmpty,
}
