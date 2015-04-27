"use strict";

var assert = require("assert");

var shell = require("./shell");

module.exports = function(input, options, createTempPath, callback) {
  try {
    assert.ok(options.targetSRS, "reproject: Target SRS is required");
  } catch (err) {
    return callback(err);
  }

  try {
    var output = createTempPath();
  } catch (err) {
    return callback(err);
  }

  var args = [
    "-q",
    "-t_srs", options.targetSRS,
    "-wo", "NUM_THREADS=ALL_CPUS",
    "-multi",
    "-co", "tiled=yes",
    "-co", "compress=lzw",
    "-co", "predictor=2",
    "-r", "bilinear",
    input,
    output
  ];

  if (options.srcNoData != null) {
    args.unshift("-srcnodata", options.srcNoData);
  }

  if (options.dstNoData != null) {
    args.unshift("-dstnodata", options.dstNoData);
  }

  return shell("gdalwarp", args, {}, function(err) {
    if (err) { 
      return callback(err);
    }

    return callback(null, output);
  });
};

module.exports.streaming = false;

