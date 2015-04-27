"use strict";

var assert = require("assert"),
    util = require("util"),
    path = require("path"),
    async = require("async");

var shell = require("./shell");

module.exports = function(input, options, createTempPath, callback) {
  try {
    assert.ok(options.targetCols, "chunk: Target cols is required");
    assert.ok(options.targetRows, "chunk: Target rows is required");
    assert.ok(options.sourceCols, "chunk: Source cols is required");
    assert.ok(options.sourceRows, "chunk: Source rows is required");
  } catch (err) {
    return callback(err);
  }

  var cols = options.sourceCols;
  var rows = options.sourceRows;
  var chunkCols = options.targetCols;
  var chunkRows = options.targetRows;
  var inputName = path.basename(input, path.extname(input));

  var outputs = [];

  var tileCoords = [];
  for(var row = 0; row < rows; row += chunkRows) {
    for(var col = 0; col < cols; col += chunkCols) {
      tileCoords.push([col, row]);
    }
  }

  return async.mapSeries(tileCoords, function (item, mapCallback) {
    var col = item[0];
    var row = item[1];

    try {
      var output = createTempPath(util.format("%s_%d_%d.tiff", inputName, col / chunkCols, row / chunkRows));
    } catch (err) {
      return mapCallback(err);
    }

    var args = [
      "-srcwin", col, row, chunkCols, chunkRows,
      input,
      output
    ];

    return shell("gdal_translate", args, {}, function(err) {
      if (err) {
        return mapCallback(err);
      }

      console.log(output);
      return mapCallback(null, output);
    });
  }, function (err, outputs) {
    if (err) {
      return callback(err);
    }
    
    return callback(null, outputs);
  });
};

module.exports.streaming = false;
