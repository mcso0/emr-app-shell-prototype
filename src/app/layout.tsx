import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceEntrySplashProvider } from "@/features/auth/workspace-entry-splash-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CLAiR EMR",
    template: "%s | CLAiR EMR",
  },
  description: "Dense EMR workspace shell prototype for menu, panels, tables, and drawers.",
  applicationName: "CLAiR EMR",
  appleWebApp: {
    capable: true,
    title: "CLAiR EMR",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider>
          <WorkspaceEntrySplashProvider>
            {children}
            <Toaster
              position="top-left"
              visibleToasts={3}
              offset={16}
              mobileOffset={16}
            />
          </WorkspaceEntrySplashProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
