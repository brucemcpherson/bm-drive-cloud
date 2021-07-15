/**
 * libary for use with Going Gas Videos
 * Utils contains useful functions
 * @namespace
 */

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

  ns.getMimeType = (fileName) => mime.lookup(fileName);
  ns.getExtension = (mimeType) => mime.extension(mimeType);
  ns.getFileExtension = (fileName) => ns.getExtension(ns.getMimeType(fileName));

  ns.isStream = (test) => isReadableStream(test) || isWritableStream(test);

  ns.fsReadStream = (name) => fs.createReadStream(name);
  ns.fsWriteStream = (name) => fs.createWriteStream(name);


  /**
   * test for a date objec
   * @param {*} ob the on to test
   * @return {boolean} t/f
   */
  ns.isDateObject = function (ob) {
    return ns.isObject(ob) && ob.constructor && ob.constructor.name === "Date";
  };


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
