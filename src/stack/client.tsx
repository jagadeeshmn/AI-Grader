import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  tokenStore: "nextjs-cookie",
  urls: {
    afterSignUp: "/after-sign-up",
    afterSignIn: "/after-sign-in",
  },
});
