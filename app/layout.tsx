import type { Metadata } from "next";
import { Lustria, DM_Sans, Martian_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const lustria = Lustria({
  variable: "--font-lustria",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rhea — Autonomous Incident Response",
  description:
    "Rhea is an autonomous DevOps agent that investigates production incidents, diagnoses root causes, and executes remediations in secure sandboxes.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(lustria.variable, dmSans.variable, martianMono.variable)} lang="en">
      <body>
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
