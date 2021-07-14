const { Storage } = require("@google-cloud/storage");


/**
 * actually this will generally be the promise resolution
 * @typedef {Object} StreamResource
 * @property {file} file - The GCS/Drive file resource
 * @property {stream} stream - the stream to read/write
 * @property {string} contentType - the mime type of the content
 * @property {string} fileId - the metadata file id
 * @property {number} [size] - size in bytes - may not be present on writestreams
 */

// get an authenticated cloud storage handle
const getStorage = ({ credentials }) => {
  const { projectId } = credentials;
  return new Storage({
    projectId,
    credentials,
  });
};

// get the bucket object
const getBucket = ({ storage, bucketName }) =>
  storage.bucket(bucketName);

const makeName = ({ key, prefix }) =>
  (prefix + "/" + key).replace(/\/+/g, "/").replace(/^\//, "");

const getFilePack = ({ key, bucket, prefix }) =>
  bucket.file(makeName({ prefix, key }));

const exists = ({ key, bucket, prefix }) =>
  getFilePack({ key, bucket, prefix }).exists()[0];

/**
 * get file content for a given id
 * @param {object} options  options
 * @param {string} options.key the name
 * @param {string} options.prefix the prefix
 * @param {Bucket} options.bucket the bucket
 * @returns {StreamResource}
 */
const getWriteStream = async ({ key, bucket, prefix, contentType }) => {
  // get the stream
  const file = getFilePack({ key, bucket, prefix });
  const metadata = {
    contentType: contentType,
  };
  const writeStream = file.createWriteStream({
    metadata,
  });


  return {
    file,
    stream: writeStream,
    fileId: file.id,
    contentType: metadata.contentType,
  };
};



/**
 * get file content for a given id
 * @param {object} options  options
 * @param {string} options.key the name
 * @param {string} options.prefix the prefix
 * @param {Bucket} options.bucket the bucket
 * @returns {StreamResource} stuff about the file
 */
const getReadStream = async ({ key, bucket, prefix }) => {
  // get the stream
  const file = bucket.file(makeName({ prefix, key }));
  const readStream = file.createReadStream();
  // we also need to get the meta data because the content type will be needed
  const [f] = await file.get();
  const { metadata } = f;
  return {
    file,
    stream: readStream,
    fileId: metadata.id,
    contentType: metadata.contentType,
    size: parseInt(metadata.size)
  };
};

module.exports = {
  getBucket,
  getWriteStream,
  getReadStream,
  exists,
  getStorage
};
