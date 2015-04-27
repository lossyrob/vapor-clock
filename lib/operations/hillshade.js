"use strict";

var shell = require("./shell");

module.exports = function(input, options, createTempPath, callback) {
  options = options || {};

  // TODO zfactor
  // TODO azimuth
  // TODO combined
  // TODO algorithm
  options.scale = options.scale || 1;

  try {
    var output = createTempPath();
  } catch (err) {
    return callback(err);
  }

  var args = [
    "hillshade",
    "-q",
    "-s", options.scale,
    "-co", "tiled=yes",
    "-co", "compress=lzw",
    "-co", "predictor=2",
    input,
    output
  ];

  return shell("gdaldem", args, {}, function(err) {
    if (err) {
      return callback(err);
    }
    
    return callback(null, output);
  });
};

module.exports.streaming = false;

