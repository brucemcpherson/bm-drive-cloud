
const path = require('path')
const piffer = require('./piffer')

const resolvePath = (p) => path.resolve(p);



/**
 * get file content for a given id
 * @param {object} options  options
 * @param {string} options.key the name
 * @param {string} options.prefix the prefix
 * @param {Bucket} options.bucket the bucket
 * @returns {File}
 */
const getWriteStream = async ({ key, bucket, prefix, contentType }) => {
  // get the stream
  const file = getFilePack({ key, bucket, prefix });
  const metadata = {
    contentType: contentType,
  };
  const writeStream = file.createWriteStream({
    metadata
  });

  return {
    file,
    writeStream,
    meta: metadata,
    contentType: metadata.contentType,
  };
};
/**
 * get file content for a given id
 * @param {object} options  options
 * @param {string} options.key the name
 * @param {string} options.prefix the prefix
 * @param {Bucket} options.bucket the bucket
 * @returns {File}
 */ 
const getReadStream = async ({ pathName }) => {
  
  const readStream = await piffer.createReadStream(pathName);

  // we also need to get the meta data because the content type will be needed
  const [f] = await file.get();
  const { metadata } = f;
  return {
    file,
    readStream,
    meta: metadata,
    contentType: metadata.contentType,
  };
};

module.exports = {
  resolvePath,
  getReadStream,
};
