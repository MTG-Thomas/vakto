import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      // `vp check` = oxfmt + oxlint + type checks, so it is the single static gate.
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    sourcemap: true,
  },
});
