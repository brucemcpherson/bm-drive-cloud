/**
 * libary for use with Going Gas Videos
 * Utils contains useful functions
 * @namespace
 */
const delay = require("delay");
const crypto = require("crypto");
const EventEmitter = require("events");
const fs = require("fs");
const mime = require("mime-types");

const Utils = (function (ns) {
  const isReadableStream = (test) => {
    return (
      test && test instanceof EventEmitter && typeof test.read === "function"
    );
  };

  const isWritableStream = (test) => {
    return (
      test &&
      test instanceof EventEmitter &&
      typeof test.write === "function" &&
      typeof test.end === "function"
    );
  };

  ns.reqClosure = (closure) => ({
    text: () => closure.then((r) => r.text()),
    json: () => closure.then((r) => r.json()),
    bytes: () => closure.then((r) => r.bytes()),
    readStream: () => closure.then((r) => {
      const s = r.readStream()
      console.log(s)
      return s
    }),
  });

  ns.getMimeType = (fileName) => mime.lookup(fileName);
  ns.getExtension = (mimeType) => mime.extension(mimeType);
  ns.getFileExtension = (fileName) => ns.getExtension(ns.getMimeType(fileName));

  ns.isStream = (test) => isReadableStream(test) || isWritableStream(test);

  ns.fsReadStream = (name) => fs.createReadStream(name);
  ns.fsWriteStream = (name) => fs.createWriteStream(name);

  /**
   * not really a blob test, but I'm marking blobs with blob = true to emulate apps script
   * @param {*} ob the on to test
   * @return {boolean} t/f
   */
  ns.isBlob = (ob) => ob && ob.blob;

  /**
   * test for a date objec
   * @param {*} ob the on to test
   * @return {boolean} t/f
   */
  ns.isDateObject = function (ob) {
    return ns.isObject(ob) && ob.constructor && ob.constructor.name === "Date";
  };
  /**
   * recursive rateLimitExpBackoff()
   * @param {function} callBack some function to call that might return rate limit exception
   * @param {object} options properties as below
   * @param {number} [attempts=1] optional the attempt number of this instance - usually only used recursively and not user supplied
   * @param {number} [options.sleepFor=750] optional amount of time to sleep for on the first failure in missliseconds
   * @param {number} [options.maxAttempts=5] optional maximum number of amounts to try
   * @param {boolean} [options.logAttempts=true] log re-attempts to Logger
   * @param {function} [options.checker] function to check whether error is retryable
   * @param {function} [options.lookahead] function to check response and force retry (passes response,attemprs)
   * @return {*} results of the callback
   */

  ns.expBackoff = function (callBack, options, attempts) {
    //sleepFor = Math.abs(options.sleepFor ||

    options = options || {};
    optionsDefault = {
      sleepFor: 750,
      maxAttempts: 5,
      checker: errorQualifies,
      logAttempts: true,
    };

    // mixin
    Object.keys(optionsDefault).forEach(function (k) {
      if (!options.hasOwnProperty(k)) {
        options[k] = optionsDefault[k];
      }
    });

    // for recursion
    attempts = attempts || 1;

    // make sure that the checker is really a function
    if (typeof options.checker !== "function") {
      throw ns.errorStack("if you specify a checker it must be a function");
    }

    // check properly constructed
    if (!callBack || typeof callBack !== "function") {
      throw ns.errorStack(
        "you need to specify a function for rateLimitBackoff to execute"
      );
    }

    const waitABit = async (theErr) => {
      //give up?
      if (attempts > options.maxAttempts) {
        throw errorStack(
          theErr + " (tried backing off " + (attempts - 1) + " times"
        );
      } else {
        // wait for some amount of time based on how many times we've tried plus a small random bit to avoid races
        return await delay(
          Math.pow(2, attempts) * options.sleepFor +
            Math.round(Math.random() * options.sleepFor)
        );
      }
    };

    // try to execute it
    try {
      var response = callBack(options, attempts);

      // maybe not throw an error but is problem nevertheless
      if (options.lookahead && options.lookahead(response, attempts)) {
        if (options.logAttempts) {
          Logger.log("backoff lookahead:" + attempts);
        }
        waitABit("lookahead:");
        return ns.expBackoff(callBack, options, attempts + 1);
      }
      return response;
    } catch (err) {
      // there was an error
      if (options.logAttempts) {
        Logger.log("backoff " + attempts + ":" + err);
      }

      // failed due to rate limiting?
      if (options.checker(err)) {
        waitABit(err);
        return ns.expBackoff(callBack, options, attempts + 1);
      } else {
        // some other error
        throw ns.errorStack(err);
      }
    }
  };

  /**
   * get the stack
   * @param {Error} e the error
   * @return {string} the stack trace
   */
  ns.errorStack = function (e) {
    try {
      // throw a fake error
      throw new Error(); //x is undefined and will fail under use struct- ths will provoke an error so i can get the call stack
    } catch (err) {
      return "Error:" + e + "\n" + err.stack.split("\n").slice(1).join("\n");
    }
  };

  // default checker
  function errorQualifies(errorText) {
    return [
      "Exception: Service invoked too many times",
      "Exception: Rate Limit Exceeded",
      "Exception: Quota Error: User Rate Limit Exceeded",
      "Service error:",
      "Exception: Service error:",
      "Exception: User rate limit exceeded",
      "Exception: Internal error. Please try again.",
      "Exception: Cannot execute AddColumn because another task",
      "Service invoked too many times in a short time:",
      "Exception: Internal error.",
      "User Rate Limit Exceeded",
      "Exception: Превышен лимит: DriveApp.",
      "Exception: Address unavailable",
      "Exception: Timeout",
      "GoogleJsonResponseException: Rate Limit Exceeded",
    ].some(function (e) {
      return errorText.toString().slice(0, e.length) == e;
    });
  }

  /**
   * generateUniqueString
   * get a unique string
   * @param {number} optAbcLength the length of the alphabetic prefix
   * @return {string} a unique string
   **/
  ns.generateUniqueString = function (optAbcLength) {
    var abcLength = ns.isUndefined(optAbcLength) ? 3 : optAbcLength;
    return new Date().getTime().toString(36) + ns.arbitraryString(abcLength);
  };

  /**
   * get an arbitrary alpha string
   * @param {number} length of the string to generate
   * @return {string} an alpha string
   **/
  ns.arbitraryString = function (length) {
    var s = "";
    for (var i = 0; i < length; i++) {
      s += String.fromCharCode(ns.randBetween(97, 122));
    }
    return s;
  };

  /**
   * randBetween
   * get an random number between x and y
   * @param {number} min the lower bound
   * @param {number} max the upper bound
   * @return {number} the random number
   **/
  ns.randBetween = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  /**
   * check if item is undefined
   * @param {*} item the item to check
   * @return {boolean} whether it is undefined
   **/
  ns.isUndefined = function (item) {
    return typeof item === "undefined";
  };

  /**
   * isObject
   * check if an item is an object
   * @param {object} obj an item to be tested
   * @return {boolean} whether its an object
   **/
  ns.isObject = function (obj) {
    return obj === Object(obj);
  };

  /**
   * checksum
   * create a checksum on some string or object
   * @param {*} o the thing to generate a checksum for
   * @return {number} the checksum
   **/
  ns.checksum = function (o) {
    // just some random start number
    var c = 23;
    if (!ns.isUndefined(o)) {
      var s =
        ns.isObject(o) || Array.isArray(o) ? JSON.stringify(o) : o.toString();
      for (var i = 0; i < s.length; i++) {
        c += s.charCodeAt(i) * (i + 1);
      }
    }

    return c;
  };

  /**
   * @param {[*]} arguments unspecified number and type of args
   * @return {string} a digest of the arguments to use as a key
   */
  ns.keyDigest = function () {
    // conver args to an array and digest them
    const t = Buffer.from(
      Array.prototype.slice
        .call(arguments)
        .map(function (d) {
          return Object(d) === d ? JSON.stringify(d) : d.toString();
        })
        .join("-")
    );

    //creating hash object
    const hash = crypto.createHash("sha1");
    //passing the data to be hashed
    const data = hash.update(t, "utf-8");
    //Creating the hash in the required format
    return data.digest("base64");
  };

  /**
   * digest a blob
   * @param {Blob} blob the blob
   * @return {string} the sha1 of the blob
   */
  ns.blobDigest = function (blob) {
    return ns.keyDigest(blob.getBytes().toString("base64"));
  };

  /**
   * see if something is undefined
   * @param {*} value the value to check
   * @return {bool} whether it was undefined
   */
  ns.isUndefined = function (value) {
    return typeof value === typeof undefined;
  };

  return ns;
})({});

module.exports = {
  Utils,
};
