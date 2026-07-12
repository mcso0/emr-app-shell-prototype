import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "./button";

type ButtonGroupSize = "xs" | "sm" | "default" | "lg";

type ButtonGroupProps = ComponentProps<"div">;

type ButtonGroupButtonProps = ButtonProps & {
  position: "leading" | "trailing";
};

type ButtonGroupPrimaryButtonProps = Omit<
  ButtonGroupButtonProps,
  "position" | "size"
> & {
  size?: ButtonGroupSize;
};

type ButtonGroupIconButtonProps = Omit<
  ButtonGroupButtonProps,
  "position" | "size"
> & {
  size?: ButtonGroupSize;
};

const iconButtonSizeByGroupSize = {
  xs: "icon-xs",
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
} as const;

const iconSizeClassNameByGroupSize = {
  xs: "[&_svg:not([class*='size-'])]:!size-[14px]",
  sm: "[&_svg:not([class*='size-'])]:!size-4",
  default: "[&_svg:not([class*='size-'])]:!size-4",
  lg: "[&_svg:not([class*='size-'])]:!size-4",
} as const;

function ButtonGroup({ className, ...props }: ButtonGroupProps) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn("inline-flex isolate items-stretch", className)}
      {...props}
    />
  );
}

function ButtonGroupButton({
  className,
  position,
  ...props
}: ButtonGroupButtonProps) {
  return (
    <Button
      data-button-group-segment={position}
      className={cn(
        "relative !border-0 shadow-none hover:shadow-none active:shadow-none aria-expanded:shadow-none focus-visible:z-10",
        position === "leading" ? "!rounded-r-none" : "!rounded-l-none",
        className,
      )}
      {...props}
    />
  );
}

function ButtonGroupPrimaryButton({
  size = "default",
  ...props
}: ButtonGroupPrimaryButtonProps) {
  return <ButtonGroupButton position="leading" size={size} {...props} />;
}

function ButtonGroupDivider({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="button-group-divider"
      className={cn(
        "z-10 w-px shrink-0 self-stretch bg-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ButtonGroupIconButton({
  className,
  size = "default",
  ...props
}: ButtonGroupIconButtonProps) {
  return (
    <ButtonGroupButton
      position="trailing"
      size={iconButtonSizeByGroupSize[size]}
      className={cn(iconSizeClassNameByGroupSize[size], className)}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
};
export type { ButtonGroupSize };
