"use strict";

var assert = require("assert");

var clone = require("clone");

var shell = require("./shell");

module.exports = function(input, options, createTempPath, callback) {
  try {
    assert.ok(Array.isArray(options.targetExtent), "resample: targetExtent must be an array");
    assert.equal(4, options.targetExtent.length, "resample: targetExtent must be an array of 4 elements");
    assert.ok(Array.isArray(options.targetResolution), "resample: targetResolution must be an array");
    assert.equal(2, options.targetResolution.length, "resample: targetResolution must be an array of 2 elements");
  } catch (err) {
    return callback(err);
  }

  try {
    var output = createTempPath();
  } catch (err) {
    return callback(err);
  }

  var args = [
    "-t_srs", options.targetSRS,
    "-te", options.targetExtent[0], options.targetExtent[1], options.targetExtent[2], options.targetExtent[3],
    "-tr", options.targetResolution[0], options.targetResolution[1],
    "-tap",
    "-srcnodata", -32768,
    "-dstnodata", -32768,
    "-wm", 256, // allow GDAL to work with larger chunks (diminishing returns after 500MB, supposedly)
    "-wo", "NUM_THREADS=ALL_CPUS",
    "-multi",
    "-co", "tiled=yes",
    "-co", "compress=lzw",
    "-co", "predictor=2",
    "-r", "bilinear",
    input,
    output
  ];

  var env = clone(process.env);

  env.GDAL_CACHEMAX = 256;
  env.GDAL_DISABLE_READDIR_ON_OPEN = true;
  env.CHECK_WITH_INVERT_PROJ = true; // handle -180/180, 90/-90 correctly
  env.CPL_VSIL_CURL_ALLOWED_EXTENSIONS = ".tiff,.zip,.vrt";

  return shell("gdalwarp", args, {
    env: env,
    timeout: 10 * 60e3 // 10 minutes
  }, function (err) {
    if(err) {
      return callback(err);
    }

    return callback(null, output);
  });
};

module.exports.streaming = false;

// TODO declare memory requirements
