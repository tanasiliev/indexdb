
// Load plugins
var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    browserSync = require('browser-sync'),
    reload = browserSync.reload;

// Tasks 
gulp.task('server:dev', function() {
  browserSync({
    notify: false,
    server: ['./'],
    port: 3000
  });
});

gulp.task('watch', function() {
  gulp.watch(['./*.html'], reload);
  gulp.watch(['src/**/*.js'], reload);
});

gulp.task('build', function() {
  return gulp.src('src/**/*.js')
     .pipe(uglify())  
     .pipe(gulp.dest('built/'));
});

// public tasks 
gulp.task('default', function() {
  gulp.start('server:dev', 'watch');
});






