

# bmcrusher-node

For transferring crushed data between app script and node using various plugins. 

## Installation

````
yarn add bmcrusher-node
````

## the crusher
This is a key value store client, with various back ends as plugins. Values are compressed, and if necessary spread over multiple physical records in the backend store depending on its capabilities. Different backends are supported by plugins.

This is the Node client. Alternative clients allow you to share data across multiple platforms. In addition to the Node client, there is also an Apps Script client which has a set of plugins for multilple backends. So sharing data between Apps Script and Node is just a matter of using the appropriate plugin.

There are only 3 methods in a client once intialized to a back end plugin. 

### put

Put a value. If it's too big it'll compress it and then split it into pieces. An optional expiry time is available to limit the lifetime of a kv pair. If the back end supports automatic lifecycle housekeeping (for example redis, Apps Script cache service and google cloud storage) expired items will be automatically removed sometime after expiry. Irrespective of the back end capabilities, items are never returned if they have expired.

The key should be a string, and the value can be either a string or a stringifiable object. 


````
crusher.put(key, someValue  [,expiryTimeInSeconds])
````

### get

Get a value. If it's in pieces it will reconstitute it to the original. If it's expired or doesn't exist, it'll return null. If the original input was an object, the object will be recreated.

````
crusher.get(key)
````

### remove

Remove a value
````
crusher.remove(key)
````

## Coming soon

Other values such as blobs etc will be supported shortly too. That will allow entire files such as images to be cached and reconstitued between platforms, as will various file conversions (for example between Google Sheets and Excel, or Google Docs and PDF). Watch this space for additional plugins to support these capabilities.

## Plugins

Google Apps Script has a selection of supported plugins

some of which are specific to Apps Script platform
- CacheService
- PropertyService

and others which are generic and are/will be implemented for Node as well
- Upstash (redis/graphql)
- Github
- Drive
- Google cloud storage
- One Drive


For details on Apps Script implementations, see https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/

Some of the Node plugins will be implemented and built in to this module, but you can easily build your own for alternative backends. 

## CrusherPluginUpstashService

Uses Upstash as a redis backend.

For setting up Upstash and Apps script see https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/upstash/

You'll need an Upstash account and credentials.

### Node usage


First get your upstash credentials. Choose the appropriate credential depending on whether you are reading or read/writing. 

````
const upstashrw = "xxx";
const upstashr = "xxx";
````

#### Initialize the crusher


This is a similar pattern and options as described in the Apps Script writeup in https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/upstash/. 

At a minumum you should provide a token service function that returns your upstash key. I also recommend a prefix to be applied to cache keys in case you want to use the same Upstash store for something else at some point.

````
const { CrusherPluginUpstashService } = require("bmcrusher-node");
const { upstashrw } = require("./private/secrets");

const crusher = new CrusherPluginUpstashService().init({
  tokenService: () => upstashrw,
  prefix: "/crusher/store"
});

````

Now you can use the the standard crusher.get, crusher.put and crusher.remove methods.



## CrusherPluginGitService

Uses Github as a backend.

For setting up Github and Apps script see https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/github/

You'll need a github token. The simplest is to create a personal token, since this is to be server based. For a client version, you'd want to create an oauth flow. Here's the docs for how to create a personal access token https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token

### Node usage

First get your token, created with repo scope.

````
const crusherGit = "gxxxxxxxx";
````

#### Initialize the crusher


This is a similar pattern and options as described in the Apps Script writeup in https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/github/

At a minumum you should provide a token service function that returns your github token. I also recommend a prefix to be applied to cache keys in case you want to use the same repo for something else at some point.

````
const { CrusherPluginGitService } = require("bmcrusher-node");
const { crusherGit } = require("./private/secrets");

const crusher = new CrusherPluginGitService().init({
  tokenService: () => crusherGit,
  prefix: "store",
  repo: "-crusher-store",
  owner: "brucemcpherson"
});

````

Now you can use the the standard crusher.get, crusher.put and crusher.remove methods.

## CrusherPluginGcsService

Uses Google Cloud Storage as a backend.

For setting up Github and Apps script see https://ramblings.mcpher.com/cacheplugins/apps-script-and-node-gcs/

You'll need a service account .json file with enough scope to write to the cloud storage bucket you're using for this. See https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/gcs/

### Node usage

First get your service account credentials using whichevery method you prefer. I usually do something like this

````
const _credentials = require("./bmcrusher-test-xxxxxxx.json");
const getGcpCreds = () => _credentials;
````

#### Initialize the crusher


This is a similar pattern and options as described in the Apps Script writeup in https://ramblings.mcpher.com/apps-script/apps-script-cache-crusher/gcs/

At a minumum you should provide a token service function that returns your service account credentials. I also recommend a prefix to be applied to cache keys in case you want to use the same bucket for something else at some point.

````
const { CrusherPluginGcsService } = require("bmcrusher-node");
const { getGcpCreds } = require("./private/secrets");

const gcsCrusher = new CrusherPluginGcsService().init({
  tokenService: () => getGcpCreds(),
  prefix: "/crusher/store",
  bucketName: "bmcrusher-test-bucket-store",
});

````

Now you can use the the standard crusher.get, crusher.put and crusher.remove methods.

