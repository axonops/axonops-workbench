# AxonOps™ Workbench for Apache Cassandra®
Apache Cassandra, Cassandra and Apache are either registered trademarks or trademarks of the Apache Software Foundation (http://www.apache.org/) in the United States and/or other countries and are used with permission. The Apache Software Foundation has no affiliation with and does not endorse or review AxonOps Workbench


## Download and install

Browse to the [releases](https://github.com/axonops/axonops-workbench-cassandra/releases) and select the package for your Operating System. We prebuild distributions for

- OSX (Intel and Apple chips)
- Linux (RedHat, Debian and others)
- Windows (Intel)

## Development

If you would like to run it in development, please follow the instructions below.

### Requirements

- nodejs >= 20.15.0
- npm >= 10.7.0

### Installation & Running

- Clone this repository
- Run `npm i` to install the nodejs dependencies
- Execute `npm start` to run it in development mode

> **_NOTE:_** You can set the environment variable `AXONOPS_DEV_TOOLS=true` to open the developer tools on start up

### Packaging

If you'd like to create your own distribution package, you will need to install `electron-builder` and then run the following:

```sh
# builds linux deb, rpm and tar.gz
npm run linux
# OSX dmg and zip
npm run mac
# windows
npm run win
```

See the `packages.json` for other build options.


THIS IS IN-DEVELOPMENT - DO NOT USE
=======

![signs-38588_1280](https://github.com/axonops/axonops-workbench-cassandra/assets/163300/0732fa17-37c5-4509-9595-a4163337680e)

