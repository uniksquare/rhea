import { SignInForm } from "./signin-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Rhea",
  description:
    "Sign in to Rhea, the autonomous incident response & DevOps agent.",
};

export default function SignInPage() {
  return <SignInForm />;
}
