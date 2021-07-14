const fs = require("fs");
const pify = require("pify");

const piper = (readStream, writeStream) =>
  new Promise((resolve, reject) => {
    readStream
      .pipe(writeStream)
      .on("finish", () => {
        resolve(writeStream);
      })
      .on("error", (err) => {
        console.log("failed string to stream", err);
        reject(err);
      });
  });

module.exports = {
  piffyParse: (fileName) =>
    pify(fs.readFile)(fileName, "utf8").then((data) => JSON.parse(data)),
  piffyReadStream: (fileName) => pify(fs.createReadStream(fileName)),
  piper,
};
