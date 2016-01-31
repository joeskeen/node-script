/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/gulp/gulp.d.ts" />
/// <reference path="typings/gulp-typescript/gulp-typescript.d.ts" />
/// <reference path="typings/gulp-uglify/gulp-uglify.d.ts" />

import gulp = require('gulp');
import ts = require('gulp-typescript');
import uglify = require('gulp-uglify');
const header = require('gulp-header');

gulp.task('build', build);

function build() {
	return gulp.src('src/*.ts')
                .pipe(ts({
                    target: 'ES2015',
                    module: 'commonjs'
                }))
                // .pipe(uglify()) //TODO: uglify doesn't seem to work with ES6
                .pipe(header('#!/usr/bin/env node\n'))
                .pipe(gulp.dest('bin'));
}