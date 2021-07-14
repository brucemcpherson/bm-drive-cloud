const { google } = require("googleapis");
const { Readable } = require("stream");
const { Utils } = require("./Utils");
const FOLDER = "application/vnd.google-apps.folder";

/**
 * actually this will generally be the promise resolution
 * @typedef {Object} StreamResource
 * @property {file} file - The GCS/Drive file resource
 * @property {stream} stream - the stream to read/write
 * @property {string} contentType - the mime type of the content
 * @property {string} fileId - the metadata file id
 * @property {number} [size] - the number of bytes - not present is write streams
 */

/**
 * get an auth object
 * @param {object} options
 * @param {object} options.credentials the content of the service accoutn JSON file
 * @param {string} options.subject the email address of the account to impersonate
 * @returns {GoogleAuth}
 */
const getAuth = ({ credentials, subject }) => {
  // use JWT uth for serviec account with a subject for impersonation
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject,
  });
  return auth.authorize().then(() => auth);
};

/**
 * get an authenticated client for Drive
 * @param {object} options
 * @param {object} options.credentials the content of the service accoutn JSON file
 * @param {string} options.subject the email address of the account to impersonate
 * @returns {Drive} a client
 */
const getClient = ({ credentials, subject }) =>
  getAuth({ credentials, subject }).then((auth) =>
    google.drive({
      version: "v3",
      auth,
    })
  );

/**
 * create a drive folder
 * @param {object} options createfile options
 * @returns {File} response
 */
const createFolder = (options) => createFile({ ...options, mimeType: FOLDER });

/**
 * create a drive file
 * @param {object} options createfile options
 * @param {string} options.name the file name
 * @param {string|stream} options.content the content
 * @param {string} [options.mimeType = "text/plain"] the mimetype
 * @param {Drive} options.client the authenticated client
 * @param {[string]} options.parents the id's of the parents (usually onlt 1)
 * @returns {File} response
 */
const createFile = ({
  name,
  mimeType = "text/plain",
  client,
  content,
  parents,
}) => {
  const requestBody = {
    name,
    mimeType,
  };
  if (parents) {
    if (!Array.isArray(parents)) parents = [parents];
    requestBody.parents = parents;
  }
  // we'll do this as a stream
  const options = {
    requestBody,
  };

  let body = null;
  if (Utils.isStream(content)) {
    body = content;
  } else if (content) {
    body = new Readable();
    body.push(content);
    body.push(null);
  }

  options.media = {
    mimeType,
    body,
  };

  return client.files.create(options);
};

/**
 *
 * @param {object} options
 * @param {string} options.path a path like '/'
 * @param {string} options.client the client to use
 * @param {boolean} options.createIfMissing whether to create missing folders if not in the path
 * @return {object} an iterator
 */
const folderIterator = ({ path = "", client, createIfMissing = false }) => {
  // we don't allow createifmissing at top level

  const extractFiles = (res) =>
    res && res.data && res.data.files && res.data.files[0] && res.data.files;

  const getItem = ({ name, parents }) => {
    q = `name='${name}' and mimeType = '${FOLDER}' and trashed = false and 'me' in owners`;
    const options = {
      q,
    };
    options.q += ` and '${parents ? parents[0] : "root"}' in parents`;

    return client.files
      .list(options)
      .then((res) => {
        return res;
      })
      .catch((error) => {
        console.log(error);
        return Promise.reject(error);
      });
  };

  const paths = path.trim().replace(/^\//, "").replace(/\.$/, "").split("/");

  return {
    // will be selected in for await of..
    [Symbol.asyncIterator]() {
      return {
        paths,
        parents: null,
        ids: [],
        hasNext() {
          return this.paths.length;
        },

        next() {
          if (!this.hasNext())
            return Promise.resolve({
              done: true,
            });

          const name = this.paths.shift();
          const parents = this.parents && this.parents.map((f) => f.id);

          return getItem({ name, parents }).then((res) => {
            const value = extractFiles(res);
            this.parents = value;

            if (!value) {
              return (
                createIfMissing && path && path !== "/"
                  ? createFolder({
                      client,
                      name,
                      parents,
                    })
                  : Promise.resolve({ data: { id: "root" } })
              ).then((res) => {
                this.parents = [res.data];

                if (!this.parents) {
                  console.log("...couldnt find/create folder", name);
                  return Promise.reject("giving up");
                } else {
                  if (this.parents[0].id === "root") {
                    console.log(
                      "...warning - you've written a file to mydrive root"
                    );
                  } else {
                    console.log("...created folder", name, this.parents);
                  }
                  return {
                    done: false,
                    value: this.parents,
                  };
                }
              });
            } else {
              return {
                done: false,
                value,
              };
            }
          });
        },
      };
    },
  };
};

/**
 * get files that match a given name
 * @param {object} options  options
 * @param {string} options.name the file name
 * @param {Drive} options.client the authenticated client
 * @param {[string]} options.parents the id's of the parents (usually only 1)
 * @returns {[File]} files
 */
const getFilesByName = ({ parents, client, name }) => {
  const options = {
    q: `name='${name}' and trashed = false and 'me' in owners`,
    orderBy: "modifiedTime desc",
  };
  options.q += ` and '${parents ? parents[0] : "root"}' in parents`;
  return client.files.list(options).then((res) => {
    const files = res && res.data && res.data.files;
    // it's always possible there are multiple versions, even though they get cleaned up
    return files;
  });
};

/**
 * get file content for a given id
 * @param {object} options  options
 * @param {string} options.fileId the file id
 * @param {Drive} options.client the authenticated client
 * @returns {StreamResource} 
 */
const getFilePack = async ({ fileId, client }) => {
  
  // first we want the contentype
  const file = await client.files.get({ fileId, fields: "mimeType, id, size" })
  if (file.status !== 200) throw new Error(`failed to get Drive file ${fileId} ${file.statusText}`)

  // now get a stream to that
  return client.files
    .get(
      {
        alt: "media",
        fileId,
      },
      {
        responseType: "stream"
      }
    )
    .then((resource) => ({
      file,
      fileId: file.data.id,
      stream: resource.data,
      contentType: file.data.mimeType,
      size: parseInt(file.data.size)
    }));
};

/**
 * get the id of a folder at the end of a path /a/b/c returns the drive file for c
 * @param {object} options  options
 * @param {string} options.path the path
 * @param {Drive} options.client the authenticated client
 * @returns {File} the parent folder at the end of the path
 */

const getFolder = async ({ client, path, createIfMissing = true }) => {
  let parent = null;
  for await (let folder of folderIterator({
    client,
    path,
    createIfMissing,
  })) {
    parent = folder;
  }
  return parent && parent[0];
};

const createDriveFile = async ({ client, parsed, contentType, content }) => {
  // first find the parent folder
  // get the stream
  const folder = await getFolder({ client, path: parsed.dir });
  if (!folder.id)
    throw new Error(`couldnt find/create folder ${parsed.dir} on drive`);

  // now make the file
  return createFile({
    client,
    name: parsed.base,
    mimeType: contentType,
    content,
    parents: [folder.id],
  });
};

const streamFileToDrive = async ({ client, parsed, contentType, content }) => {
  const file = await createFile({ client, parsed, contentType, content });
  if (file.status !== 200) throw new Error(`Failed to write file to Drive - ${parsed.pathName} : ${file.statusText}`)

  return {
    fileId: file.data.id,
    contentType: file.data.mimeType,
    stream: content,
    file
  }

}

const getDriveFile = ({ client, parsed }) => {
  // it's possible that we have an ID - so try that first
  return getFilePack({ fileId: parsed.base, client }).catch((err) => {
    // first find the parent folder
    return getFolder({
      client,
      path: parsed.dir,
      createIfMissing: false,
    }).then((folder) => {
      if (!folder.id)
        throw new Error(`couldnt find folder ${parsed.dir} on drive`);

      return getFilesByName({
        parents: [folder.id],
        client,
        name: parsed.base,
      }).then((files) => {
        // there maybe more than 1 file - but [0] should be the latest
        const [file] = files;
        if (files.length > 1) {
          console.log(
            `...warning - there were ${files.length} matches for ${parsed.dir} ${parsed.base}`
          );
        } else if (!files.length) {
          throw new Error(
            `no drive files found for ${parsed.dir} ${parsed.base}`
          );
        }
        return getFilePack({ client, fileId: file.id });
      });
    });
  });
};

module.exports = {
  createFile,
  getClient,
  getFolder,
  getFilesByName,
  createFolder,
  createDriveFile,
  getDriveFile,
  getFilePack,
  streamFileToDrive
};
