import React from "react";
import type { LinkProps } from "next/link";
import { fn } from "storybook/test";
import { formatUrl } from "next/dist/shared/lib/router/utils/format-url";

// Storybook's bundled mock prevents default before the source handler runs.
// Match Next's handler-first contract while keeping all navigation inert.
export const linkAction = fn().mockName("next/link::Link");
export const useLinkStatus = fn(() => ({ pending: false })).mockName("next/link::useLinkStatus");
type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & LinkProps;
export const Link = React.forwardRef<HTMLAnchorElement, Props>(function StorybookLink({
  href, as, replace, scroll, shallow, prefetch, passHref, legacyBehavior, locale,
  onClick, onNavigate, children, ...rest
}, ref) {
  const hrefString = typeof (as ?? href) === "string" ? String(as ?? href) : formatUrl((as ?? href) as Parameters<typeof formatUrl>[0]);
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, sourceHandler = onClick) => {
    sourceHandler?.(event);
    const cancelled = event.defaultPrevented;
    // Never leave Storybook, including external, download and modified clicks.
    event.preventDefault();
    const target = event.currentTarget.getAttribute("target");
    if (cancelled || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target && target !== "_self") || event.currentTarget.hasAttribute("download")) return;
    const url = new URL(hrefString, window.location.href);
    if (url.origin !== window.location.origin) return;
    let navigationCancelled = false;
    onNavigate?.({ preventDefault: () => { navigationCancelled = true; } });
    if (!navigationCancelled) linkAction(hrefString, { replace, scroll, shallow, prefetch, locale });
  };
  if (legacyBehavior) {
    const child = React.Children.only(children) as React.ReactElement<React.ComponentPropsWithRef<"a">>;
    return React.cloneElement(child, {
      ...rest,
      ref: ref ?? child.props.ref,
      onClick: event => handleClick(event, child.props.onClick),
      ...((passHref || (child.type === "a" && !child.props.href)) ? { href: hrefString } : {}),
    });
  }
  return <a {...rest} ref={ref} href={hrefString} onClick={event => handleClick(event)}>{children}</a>;
});
export default Link;
