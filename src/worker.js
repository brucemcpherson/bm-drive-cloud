const path = require("path");
const mime = require("mime-types");
const { piffyParse, piper } = require("./piffer");
const gcs = require("./bmgcs");
const fst = require("./bmfs");
const drv = require("./bmdrive");

/**
 * actually this will generally be the promise resolution
 * @typedef {Object} StreamResource
 * @property {file} file - The GCS/Drive file resource
 * @property {stream} stream - the stream to read/write
 * @property {string} contentType - the mime type of the content
 * @property {string} fileId - the metadata file id
 */

// get the content of the consolidated service account file
const getSaContent = (fileName) => piffyParse(fileName);
// get the content of the work file
const getWorkContent = (fileName) => piffyParse(fileName);

// get all the param content
const getContent = async (argv) => {
  const [saContent, workContent] = await Promise.all([
    getSaContent(argv.s),
    getWorkContent(argv.w),
  ]);
  return {
    saContent,
    workContent,
  };
};

// get and validate content and assign the sa details to each work item
const validateContent = async ({ work, sa }) => {
  const pack = work.map((f) => {
    return {
      ...f,
      from: {
        ...f.from,
        saContent: sa.find((s) => f.from.sa === s.name),
      },
      to: {
        ...f.to,
        saContent: sa.find((s) => f.to.sa === s.name),
      },
    };
  });
  const ops = ["cp"];
  if (pack.some((f) => ops.indexOf(f.op) === -1))
    throw new Error("only ops allowed are " + ops.join(","));
  if (
    pack.some((f) => !f.from.saContent && !isFs(f.from)) ||
    pack.some((f) => !f.to.saContent && !isFs(f.to))
  )
    throw new Error("missing sa content");
  return pack;
};

/**
 * @param {object[]} pack the work package
 * @returns {object} the work package
 */
const getWork = (pack) => {
  return pack.map((f) => {
    return {
      ...f,
      files: f.files.map((t) => ({
        from: {
          pathName: t.from,
        },
        to: {
          pathName: t.to,
        },
      })),
    };
  });
};

const isGcs = (platform) => platform.type === "gcs";
const isDrive = (platform) => platform.type === "drive";
const isFs = (platform) => platform.type === "fs";
const checkType = (platform) => {
  if (!isValid(platform))
    throw new Error(`Invalid/unkown platform: ${platform.type}`);
};
const isValid = (platform) =>
  isGcs(platform) || isDrive(platform) || isFs(platform);

/**
 * get an input stream for the specific package
 * @param {object} platform
 * @returns {StreamResource} including the readstream
 */
const getInput = async (platform) => {
  switch (platform.type) {
    case "drive":
      // the client is async for drive && streaming is part for the file creation
      return platform.client.then((client) =>
        drv
          .getDriveFile({
            client,
            parsed: platform.parsed,
          })
      );
    
    case "gcs":
      return gcs.getReadStream({
        key: platform.fullName,
        prefix: "",
        bucket: platform.client,
      });
    default:
      checkType(platform);
  }
};
const took = (t) => {
  const elapsed = new Date().getTime() - t;
  return {
    elapsed,
    message: `transfer time ${Math.round(elapsed / 1000)} sec(s)`
  };
}
/**
 * get an output stream for the specific package, and pipe to it
 * @param {object} platform
 * @param {StreamResource} input input stream & metadata
 * @returns {object} including the writestrream
 */
const streamCopy = async (platform, input) => {
  // if content not provided, impute it from from the filename
  contentType = input.contentType || platform.mimeType;
  const t = new Date().getTime();
  switch (platform.type) {
    case "gcs":
      // the client is the bucket, already synced for gcs
      const bucket = platform.client;
      return gcs
        .getWriteStream({
          key: platform.fullName,
          prefix: "",
          bucket,
          contentType,
        })
        .then((output) => piper(input.stream, output.stream)
        .then(() => {
          // we can store the input id back into the work stream as we may not have known it before
          return {
            input,
            output,
            took: took(t)
          }
        }));

    case "drive":
      // the client is async for drive && streaming is part for the file creation
      return platform.client.then((client) =>
        drv
          .streamFileToDrive({
            client,
            parsed: platform.parsed,
            contentType,
            content: input.stream,
          })
          .then((output) => {
            return {
              input,
              output,
              took: took(t)
            }
          })
      );
  }
};

const getBucket = ({ pathName }) => {
  return pathName.replace(/^\/?\/?([^\/]+)(.*)/, "$1,$2").split(",");
};

const addClient = async (platform) => {
  switch (platform.type) {
    case "gcs":
      platform.client = gcs.getStorage({
        credentials: platform.saContent.content,
      });
      return platform;

    case "drive":
      // this'll be a promise to the client
      platform.client = drv.getClient({
        credentials: platform.saContent.content,
        subject: platform.subject,
      });

      return platform;

    default:
      throw new Error(`unknown platform type ${platform.type}`);
  }
};

const addFile = (platform, file) => {
  const [bucketName, theRest] = getBucket(file);
  file.fullName = isGcs(platform)
    ? theRest
    : isFs(platform)
    ? fst.resolvePath(file.pathName)
    : file.pathName;
  file.type = platform.type;
  file.bucketName = bucketName;

  // we can also split the fullname into components
  file.parsed = path.parse(file.fullName);
  file.mimeType = mime.lookup(file.parsed.ext);

  if (!isValid(file)) throw new Error(`Unknown transfer type:${file.type}`);
  file.client = isGcs(platform)
    ? gcs.getBucket({
        storage: platform.client,
        bucketName,
      })
    : platform.client;

  return file;
};

/**
 * executes the whole thing
 */
const execute = async (pack) => {
  // get what needs done and check it's valid
  const work = getWork(pack);

  // add the clients, some of which may async
  work.forEach((d) => {
    addClient(d.to);
    addClient(d.from);
  });

  // assign clients for each file
  work.forEach((d) => {
    // sort out the filenames/bucketnames
    d.files.forEach((f) => {
      addFile(d.to, f.to);
      addFile(d.from, f.from);
    });
  });

  return Promise.all(
    work.map((d) => {
      return Promise.all(
        d.files.map((file) => {
          return getInput(file.from).then((input) =>
            streamCopy(file.to, input).then((resource) => {
              // useful for drive when the file was found by Id
              file.from.fileId = resource.input.fileId
              file.to.fileId = resource.output.fileId
              file.took = resource.took.elapsed
              file.size = resource.input.size
              console.log(
                `...${resource.took.message}: ${file.from.pathName}(${file.from.type}) -> ${file.to.pathName}(${file.to.type})`
              );
            })
          );
        })
      );
    })
  ).then (()=>cleanResult(work));
};
const cleanResult = (work) => {
  // don't want to return a lot of unnecessary stuff
  const red = (ob) => ["pathName", "type", "mimeType", "fileId"].reduce((p, c) => {
    p[c] = ob[c];
    return p;
  }, {});

  return work.map(w => w.files.map(f => {
    return {
      size: f.size,
      took: f.took,
      to: red(f.to),
      from: red(f.from)
    }
  }))
}
module.exports = {
  execute,
  validateContent,
  getContent,
};
