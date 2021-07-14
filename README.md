

# bm-drive-cloud

For transferring files between drive and gcs from node or using cloud run

# background

The idea here is to use the Google cloud storage and drive apis to stream files between them use node to control what's being copied. All the files are copied in parallel, and even more interesting a flavour of this can be deployed on Google Cloud Run - this means that you can use it from Apps Script (or anything else that can post) to transfer files blisteringly fast between Drive and Gcs



# configuration and parameter files

Transfer and authentication is controlled via JSON files.

## service account files

Service accounts are used to give bm-drive-cloud access to each of the cloud platforms. In the case of Drive, impersonation is also supported, as the concept of 'My Drive', would normally be associated with a user, rather than a service account. You can supply multiple service accounts as it's possible that you'd like to keep these with separate permissions depending on the platform.

### sa.json

This should be a combined file containing an array of the service account credentials needed to access Drive and/or GCS. Here's an example. 

````
[
  {
    "name": "drive",
    "content": {
      "type": "service_account",
      "project_id": "xxx",
      "private_key_id": "xxx",
      ...etc as downloaded from the cloud console
    }
  },
  {
    "name": "gcs",
    "content": {
      "type": "service_account",
      "project_id": "xxx",
      "private_key_id": "xxx",
      ...etc as downloaded from the cloud console
    }
  }
]
````
The name can be whatever you like, and the content should be the complete contents of the .json service account credential file. Additional info on how to set up service accounts and enable Drive delegation will come later in this documentation

## work.json

This contains the copying work required. All files mentioned are streamed simultaneously. The work files is and array of instructions, each instructions with 4 parts
| property | purpose | values |
|----|----|----|
|op| the operation| currently only cp (copy) is implemented |
|from| the 'from' platform| the source of the files to operate on |
|from.sa| service account name| this is the name you've given the service account in sa.json|
|from.type| type of platform | 'drive' or 'gcs' is supported |
|from.subject| who to impersonate | the email address of the person to impersonate - valid for drive, ignore for gcs |
|to| the 'to' platform | all the properties are the same as for 'from' |
|files|array of files| the files that this from/to applies to|
|files.from|a path| where to copy the file from using the 'from' credentials already provided|
|files.to|a path| where to copy the  file to using the 'to' credentials already provided|

### work.json example
````
[
  {
    "op": "cp",
    "from": {
      "sa": "gcs",
      "type": "gcs"
    },
    "to": {
      "sa": "drive",
      "type": "drive",
      "subject": "bruce@mcpher.com"
    },
    "files": [
      {
        "to": "/images/d.png",
        "from": "mybucketname/images/c.png"
      },
      {
        "to": "/images/e.png",
        "from": "mybucketname/images/e.png"
      }
    ]
  },
  {
    "op": "cp",
    "to": {
      "sa": "gcs",
      "type": "gcs"
    },
    "from": {
      "sa": "drive",
      "type": "drive",
      "subject": "bruce@mcpher.com"
    },
    "files": [
      {
        "from": "/images/x.png",
        "to": "somebucketname/images/x.png"
      },
      {
        "from": "xxxxxx_zzz (accepts fileids as well as folder paths)",
        "to": "someotherbucketname/images/i.png"
      }
    ]
  }
]
````

Note that files.to and files.from for Drive accept a folder path on My Drive, although files.from with a path may resolve to multiple files - in which case the latest in used. Files.from also accepts a drive fileid.

For GCS platform, the bucketname must be in the path.

Note that you can also copy between the same platform (for example from one folder in drive to another, or from one GCS bucket to another)

## result
The result from both the cli and cloud run is a summary of what was copied, along with how long each file took and the size plus the created fileId. This is the result from Cloud Run of copying multiple large files. Note that it seems to run at about 2 megabytes second on cloud run - this example was 2 30mb files simultaneously.
````
[
	[{
		"size": 33027954,
		"took": 3366,
		"to": {
			"pathName": "bmcrusher-test-bucket-store/dump/202106/14.csv",
			"type": "gcs",
			"mimeType": "text/csv",
			"fileId": "dump%2F202106%2F14.csv"
		},
		"from": {
			"pathName": "/dump/20210614.csv",
			"type": "drive",
			"mimeType": "text/csv",
			"fileId": "xxx"
		}
	}, {
		"size": 29189802,
		"took": 3035,
		"to": {
			"pathName": "bmcrusher-test-bucket-store/dump/202106/16.csv",
			"type": "gcs",
			"mimeType": "text/csv",
			"fileId": "dump%2F202106%2F16.csv"
		},
		"from": {
			"pathName": "/dump/20210616.csv",
			"type": "drive",
			"mimeType": "text/csv",
			"fileId": "xxx"
		}
	}]
]
````

# how to run

clone this repo, and set up your work.json and sa.json files

## from cli
````
node localindex -s sa/sa.json -w jsons/work.json
````
## as an express app

this is normally run from cloud run, but you can test it out with curl.

this will kick off a server
````
node index
````

The post body is consists of the sa and work jsons combined - like this
````
{
  work: { ... the content of work.json },
  sa: {... the content of sa.json}
}
````

If your json files are separate, you can combine them to post with curl like this
````
curl -X POST -H "Content-Type:application/json"  -d "{\"work\":$(cat jsons/work.json),\"sa\":$(cat sa/sa.json)}" \
http://localhost:8080
````
## from cloud run

There's a fair bit of setup to go through to set up your cloud run endpoint

### authenticate
First make sure you are logged in to gcloud (otherwise you'll have all sorts of worrying and surprising errors)

````
gcloud auth login
````
### Build a container

You can use the Dockerfile in the repo. Here my project id is 'bmcrusher-test' and my build is going to be called 'bm-drive-cloud'. This will use cloud build to create a container, and will also upload to the cloud registry. There are various apis it needs to enable in your project, but the build process generally asks if it can. You'll need billing enabled on your project, but cloud run has a generous free tier.

````
gcloud builds submit --tag gcr.io/bmcrusher-test/bm-drive-cloud
````

### deploy the container

This will deploy and create an endpoint for your app on cloud run. You'll be asked a few things - you'll most likely want to pick 'Cloud Run (fully managed)', and the service name as the default. There are some hints during the dialog on how to make your choices permament for the future if you want to.

Next you'll be asked for a region - probably best to pick the same one that your cloud storage is hosted at.

Finally you'll be asked whether unauthenticated invocations are allowed. We'll deal with authentication (to the cloud run endpoint) later. Authentication is already of course in place to Drive and Storage using your service accounts in sa.json. This applies just to be able to invoke the cloud run endpoint at all. For now, just allow unauthenticated invocations.

````
gcloud run deploy --image gcr.io/bmcrusher-test/bm-drive-cloud

````
There will be a link to a log file displayed you can look at to check if there are any deployment errors

### test cloud run

At the end of the deployment you'll see something like this
````
Service [bm-drive-cloud] revision [bm-drive-cloud-xxxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://bm-drive-cloud-zzzzzz.run.app
````
The service URL is how to you access your app via a post, so we can just repeat the curl command from previously to test it, this time using the service URL
````
curl -X POST -H "Content-Type:application/json"  -d "{\"work\":$(cat jsons/work.json),\"sa\":$(cat sa/sa.json)}" \
https://bm-drive-cloud-zzzzzz.run.app
````

You can see the log files from the cloud console under cloud run.

# setting up the service accounts

You need to create service accounts with storage and drive permissions (or you could use one with both permissions), download the key file(s) and set up your sa.json file as described earlier. If you are using Drive, you'll also need to enable G suite delegation and allow it to access Drive Scopes. All this is desperately yawn-making stuff, so I won't repeat it here - but you can see some screen shots of how here https://ramblings.mcpher.com/cacheplugins/drive-async-iterators/

# plugins

Currently this only supports Drive and GCS. However its a plugin architecture, so we can add other providers like DropBox and of course local files from Node too - watch this space.

# todo

Error handling still needs some work, and I'll be releasing the core of this as an npm module shortly so you can build your own wrapper apps easily.

# apps script

I'll post an Apps Script demo of this shortly - but it's just a vanilla UrlFetchApp post

# cloud run authentication

I'll cover how to protect your cloud run end point with authentication in another post

# collaboration

If you want to participate in more development of this ping me at bruce@mcpher.com

Bruce Mcpherson - July 2021