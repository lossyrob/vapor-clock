"use strict";

var assert = require("assert"),
    fs = require("fs"),
    https = require("https"),
    url = require("url"),
    util = require("util"),
    path = require("path");

var async = require("async"),
    holdtime = require("holdtime"),
    tmp = require("tmp");

// Set graceful cleanup so temp files are
// removed even on uncaught exeptions.
tmp.setGracefulCleanup();

// bump up the number of concurrent uploads for s3-streaming-upload
// TODO it would be better to provide an agent, but that's not currently
// possible
https.globalAgent.maxSockets = Infinity;

/**
 * Task definition:
 * name: task name
 * input: source URL
 * operations: operation[]
 * output: target URL
 *
 * operation:
 * type: warp
 * args: []
 */

module.exports = function(id, task, upload, done) {
  console.log("Processing task:", task.name);

  var outputURI;

  try {
    assert.ok(Array.isArray(task.operations), "Operations must be an array");
    assert.equal(1, task.operations.length, "Only single operation pipelines are supported at the moment");
    assert.ok(task.input, "An input is required");
    assert.ok(task.output, "An output is required (for now)");
  } catch (err) {
    return done(err);
  }

  // Inputs to operations are always arrays;
  // wrap the incoming input into an array.
  var initialInput = [task.input];

  var result = tmp.dir({
    // Delete the directory on exit, even if files exist.
    unsafeCleanup: true
  }, function(err, workingDir, manualCleanup) {
    if (err) {
      return done(err);
    }

    // Creates a temporary file path if the operation needs one.
    // This file will be cleaned up along with the entire temp directory on exit.
    var createTmpPath = function(basename) { 
      if(basename) {
        return path.join(workingDir, basename);
      } else {
        return tmp.tmpNameSync({ template: workingDir + '/XXXXXX' });
      }
    };

    // This function runs the operation per input.
    // Callback with list of output paths aggregated from each operation run.
    var runOperation = function(inputs, op, callback) {
      // TODO sanitize / check op.type (to prevent arbitrary files from being loaded)
      // likely by loading everything in that directory and not doing arbitrary
      // requires
      var operation = require("./operations/" + op.type);

      if(operation.streaming) {
        throw new Error("Streaming modes not implemented.");        
      } else {

        // Run the operation against each input.
        async.map(inputs, function(input, mapCallback) {
          operation(input, op.options, createTmpPath, function(err, outputs) {

            if(err) {
              return mapCallback(err);
            }

            // Allow operations to return either a single output
            // or multiple outputs.
            if(util.isArray(outputs)) {
              return mapCallback(null, outputs);
            } else {
              return mapCallback(null, [outputs]);
            }
          });
        }, function(err, outputsPerInput) {
          if (err) {
            return callback(err);
          }

          // Since each run of the operation produces an array of outputs,
          // what we have is a collection of outputs. Collect them into
          // a single array of outputs.
          var outputs = [];
          outputs = outputs.concat.apply(outputs, outputsPerInput);

          return callback(null, outputs);
        });
      }
    };
    
    // Fold left over each operation, taking the output of the last operation as
    // input to the next. Seed the fold with initialInput.
    return async.foldl(task.operations, initialInput, runOperation, function(err, finalOutputs) { 
      if (err) {
        return done(err);
      }

      upload(task.output, finalOutputs);
      return done(null, task.output);
    });
  });

  return result;
};
