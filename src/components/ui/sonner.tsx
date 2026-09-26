"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import styles from "./sonner.module.css"
import {
  CircleCheckIcon,
  CircleCloseIcon,
  InfoIcon,
  LoaderIcon,
  WarningIcon,
} from "@/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={`toaster group ${styles.toaster}`}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <WarningIcon className="size-4" />
        ),
        error: (
          <CircleCloseIcon className="size-4" />
        ),
        loading: (
          <LoaderIcon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--emr-border-strong)",
          "--border-radius": "var(--clair-radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButton: true,
        closeButtonAriaLabel: "토스트 닫기",
        style: {
          boxShadow: "var(--clair-shadow-xl)",
          paddingRight: "44px",
        },
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
