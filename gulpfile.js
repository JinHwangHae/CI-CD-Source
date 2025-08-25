/* eslint-disable */

const gulp = require("gulp");
const execSync = require("child_process").execSync;
const { watch } = gulp;
const connect = require("gulp-connect");
const browserSync = require("browser-sync").create();

// For development, it is now possible to use 'gulp webserver'
// from the command line to start the server (default port is 8080)

const port = 1237;

gulp.task(
    "webserver",
    gulp.series(async function () {
        connect.server({
            port: port,
            https: false,
            livereload: true
        });
    })
);

gulp.task("pack", async function () {
    try {
        execSync("rollup -c", { stdio: "inherit" });
    } catch (e) {
        console.error(e);
    }
});

gulp.task("reload", async function () {
    browserSync.reload();
});

gulp.task("copy-build", function () {
    return gulp
        .src("./construkted.js*")
        .pipe(
            gulp.dest(
                "C:/xampp/htdocs/gw4.construkted.com/wp-content/themes/gowatch-child/includes/construkted/assets/js"
            )
        );
});

gulp.task(
    "default",
    gulp.parallel("pack", "copy-build", "webserver", async function () {
        browserSync.init({
            injectChanges: true,
            proxy: `http://localhost:${port}/`
        });

        let watchlist = [
            "./index.html",
            "src/**/*.ts",
            "src/**/*.js",
            "src/**/*.less",
            "src/**/*.css",
            "src/**/*.less"
        ];

        watch(watchlist, gulp.series("pack", "copy-build", "reload"));
    })
);

gulp.task("build", async function () {
    execSync("rollup -c ./rollup.config.release.js");

    execSync(
        "javascript-obfuscator build/minimized_construkted.js -o build/construkted.js --compact true --source-map true"
    );
});
