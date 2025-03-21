"use strict";

// gulp
import gulp from "gulp";
import gulpif from "gulp-if";
import browserSync from "browser-sync";
import rename from "gulp-rename";
import replace from "gulp-replace";
//предотвращает прерывание Gulp при ошибках.
import plumber from "gulp-plumber";
//очистка папки dist/ перед сборкой.
import { deleteSync } from "del";

// html*pug
import htmlmin from "gulp-htmlmin";
import fileinclude from "gulp-file-include";
import gulppug from "gulp-pug";
import prettyHtml from "gulp-pretty-html";

// css
import * as sass from "sass";
import gulpSass from "gulp-sass";
const compSass = gulpSass(sass);

import sourcemaps from "gulp-sourcemaps";
import autoprefixer from "gulp-autoprefixer";
import cleanCSS from "gulp-clean-css";
//объединение медиазапросов для оптимизации.
import gcmq from "gulp-group-css-media-queries";
//енерация критического CSS (для ускорения загрузки страниц).
import { stream as critical } from "critical";

// js
//минификация JS.
import terser from "gulp-terser";
//обработка JS через Webpack (бандлинг, транспиляция).
import webpackStream from "webpack-stream";
import webpack from "webpack";

//img
// Оптимизация изображений через TinyPNG API, условно бесплатный
import tinypng from "gulp-tinypng-compress";
// локальная оптимизация изображений.
import gulpImg from "gulp-image";
import gulpWebp from "gulp-webp";
import gulpAvif from "gulp-avif";
import svgSprite from "gulp-svg-sprite";

let dev = false;

const path = {
  dist: {
    base: "dist/",
    html: "dist/",
    js: "dist/js/",
    css: "dist/css/",
    cssIndex: "dist/css/index.min.css",
    img: "dist/img/",
    fonts: "dist/fonts/",
  },
  src: {
    base: "src/",
    html: "src/html/*.html",
    pug: "src/pug/*.pug",
    scss: "src/scss/**/*.scss",
    js: "src/js/index.js",
    img: "src/img/**/*.*",
    svg: "src/svg/**/*.svg",
    imgF: "src/img/**/*.{jpg,jpeg,png}",
    assets: [
      "src/fonts/**/*.*",
      "src/icons/**/*.*",
      "src/video/**/*.*",
      "src/public/**/*.*",
    ],
  },
  watch: {
    html: "src/html/*.html",
    js: "src/**/*.js",
    pug: "src/**/*.pug",
    css: "src/**/*.scss",
    svg: "src/svg/**/*.svg",
    img: "src/img/**/*.*",
    imgF: "src/img/**/*.{jpg,jpeg,png}",
  },
};

// Функция для автоматического добавления тега picture, webp и avif
const addPicture = () =>
  replace(
    /<img([^>]+)src="([^"]+\.(?:jpg|jpeg|png))"([^>]*)>/gi,
    (match, attrsBefore, src, attrsAfter) => {
      // Проверяем, не находится ли <img> уже внутри <picture>
      if (match.includes("<picture")) return match;

      const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, ".webp");
      const avifSrc = src.replace(/\.(jpg|jpeg|png)$/, ".avif");
      return `<picture><source srcset="${avifSrc}" type="image/avif"><source srcset="${webpSrc}" type="image/webp"><img${attrsBefore}src="${src}"${attrsAfter}></picture>`;
    }
  );

//html
export const html = () =>
  gulp
    .src(path.src.html)
    .pipe(addPicture())
    .pipe(fileinclude())
    .pipe(
      gulpif(
        !dev,
        htmlmin({
          removeComments: true,
          collapseWhitespace: true,
        })
      )
    )
    .pipe(gulp.dest(path.dist.html))
    .pipe(browserSync.stream());

//pug
export const pug = () =>
  gulp
    .src(path.src.pug)
    .pipe(addPicture())
    .pipe(
      gulppug({
        pretty: true,
      }).on("error", function (err) {
        console.log(err.toString());
        this.emit("end");
      })
    )
    .pipe(
      gulpif(
        !dev,
        prettyHtml(),
        htmlmin({
          removeComments: true,
          collapseWhitespace: true,
        })
      )
    )
    .pipe(gulp.dest(path.dist.html))
    .pipe(browserSync.stream());

// css
export const scss = () =>
  gulp
    .src(path.src.scss)
    .pipe(gulpif(dev, sourcemaps.init()))
    .pipe(compSass().on("error", compSass.logError))
    .pipe(
      gulpif(
        !dev,
        autoprefixer({
          cascade: false,
          grid: false,
        })
      )
    )
    .pipe(gulpif(!dev, gcmq()))
    .pipe(gulpif(!dev, gulp.dest(path.dist.css)))
    .pipe(
      gulpif(
        !dev,
        cleanCSS({
          2: {
            specialComments: 0,
          },
        })
      )
    )
    .pipe(
      gulpif(
        !dev,
        rename({
          suffix: ".min",
        })
      )
    )
    .pipe(gulpif(dev, sourcemaps.write()))
    .pipe(gulp.dest(path.dist.css))
    .pipe(browserSync.stream());

// js
const webpackConf = {
  mode: dev ? "development" : "production",
  devtool: dev ? "eval-source-map" : false,
  optimization: {
    minimize: false,
  },
  output: {
    filename: "index.js",
  },
  module: {
    rules: [],
  },
};

if (!dev) {
  webpackConf.module.rules.push({
    test: /\.(js)$/,
    exclude: /(node_modules)/,
    loader: "babel-loader",
  });
}

export const js = () =>
  gulp
    .src(path.src.js)
    .pipe(plumber())
    .pipe(webpackStream(webpackConf, webpack))
    .pipe(gulpif(!dev, gulp.dest(path.dist.js)))
    .pipe(gulpif(!dev, terser()))
    .pipe(
      gulpif(
        !dev,
        rename({
          suffix: ".min",
        })
      )
    )
    .pipe(gulp.dest(path.dist.js))
    .pipe(browserSync.stream());

export const img = () =>
  gulp
    .src(path.src.img, { encoding: false })
    // .pipe(gulpif(!dev, tinypng({
    // 	key: 'API_KEY',
    // 	summarize: true,
    // 	log: true
    // })))
    .pipe(
      gulpif(
        !dev,
        gulpImg({
          optipng: ["-i 1", "-strip all", "-fix", "-o7", "-force"],
          pngquant: ["--speed=1", "--force", 256],
          zopflipng: ["-y", "--lossy_8bit", "--lossy_transparent"],
          jpegRecompress: [
            "--strip",
            "--quality",
            "medium",
            "--min",
            40,
            "--max",
            80,
          ],
          mozjpeg: ["-optimize", "-progressive"],
          gifsicle: ["--optimize"],
          svgo: true,
        })
      )
    )
    .pipe(gulp.dest(path.dist.img))
    .pipe(
      browserSync.stream({
        once: true,
      })
    );

export const svg = () =>
  gulp
    .src(path.src.svg)
    .pipe(
      svgSprite({
        mode: {
          stack: {
            sprite: "../sprite.svg",
          },
        },
      })
    )
    .pipe(gulp.dest(path.dist.img))
    .pipe(
      browserSync.stream({
        once: true,
      })
    );

export const webp = () =>
  gulp
    .src(path.src.imgF, { encoding: false })
    .pipe(
      gulpWebp({
        quality: dev ? 100 : 60,
      })
    )
    .pipe(gulp.dest(path.dist.img))
    .pipe(
      browserSync.stream({
        once: true,
      })
    );

export const avif = () =>
  gulp
    .src(path.src.imgF, { encoding: false })
    .pipe(
      gulpAvif({
        quality: dev ? 100 : 50,
      })
    )
    .pipe(gulp.dest(path.dist.img))
    .pipe(
      browserSync.stream({
        once: true,
      })
    );

export const critCSS = () =>
  gulp
    .src(path.src.html)
    .pipe(
      critical({
        base: path.dist.base,
        inline: true,
        css: [path.dist.cssIndex],
      })
    )
    .on("error", (err) => {
      console.error(err.message);
    })
    .pipe(
      htmlmin({
        removeComments: true,
        collapseWhitespace: true,
      })
    )
    .pipe(gulp.dest(path.dist.base));

export const copy = () =>
  gulp
    .src(path.src.assets, {
      base: path.src.base,
    })
    .pipe(gulp.dest(path.dist.base))
    .pipe(
      browserSync.stream({
        once: true,
      })
    );

export const server = () => {
  browserSync.init({
    ui: false,
    notify: false,
    host: "localhost",
    port: 3001,
    // tunnel: true,
    server: {
      baseDir: "dist",
    },
  });

  gulp.watch(path.watch.html, html);
  // gulp.watch(path.watch.pug, pug);
  gulp.watch(path.watch.css, scss);
  gulp.watch(path.watch.js, js);
  gulp.watch(path.watch.svg, svg);
  gulp.watch(path.watch.img, img);
  gulp.watch(path.watch.imgF, webp);
  gulp.watch(path.watch.imgF, avif);
};

export const clear = (done) => {
  deleteSync([path.dist.base], {
    force: true,
  });
  done();
};

const develop = (ready) => {
  dev = true;
  ready();
};

export const base = gulp.parallel(html, scss, js, img, svg, webp, avif, copy);

export const build = gulp.series(clear, base, critCSS);

export default gulp.series(develop, base, server);
