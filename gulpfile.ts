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
			module: 'commonjs'
		}))
		.pipe(uglify())
		.pipe(header('#!/usr/bin/env node\n'))
		.pipe(gulp.dest('bin'));
}