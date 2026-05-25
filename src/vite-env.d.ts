/// <reference types="vite/client" />

// framec-generated ES modules have no .d.ts; treat their exports as `any`.
// Each game casts the machine to its own interface where it needs one.
declare module "*.machine.js";
