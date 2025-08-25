import { resolve } from "path";
const fs = require("fs");
import { defineConfig } from "vite";
import { libInjectCss } from "vite-plugin-lib-inject-css";

const outDir = "C:/xampp/htdocs/gw4.construkted.com/wp-content/themes/gowatch-child/includes/construkted/assets/js";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "ConstruktedJs",
            // the proper extensions will be added
            fileName: (format, entryName) => "construkted.js",
            formats: ["umd"]
        },
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: ["cesium"],
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    cesium: "Cesium"
                }
            }
        },
        sourcemap: true
    },
    plugins: [
        libInjectCss(),
        {
            name: "build-start",
            async buildStart(options) {}
        },
        {
            name: "build-end",
            async buildEnd(options) {}
        },
        {
            name: "build-end",
            async closeBundle(options) {
                fs.copyFile("./dist/construkted.js", outDir + "/construkted.js", (error) => {
                    if (error) {
                        console.error(error);
                    }
                });
                fs.copyFile("./dist/construkted.js.map", outDir + "/construkted.js.map", (error) => {
                    if (error) {
                        console.error(error);
                    }
                });
            }
        }
    ]
});
