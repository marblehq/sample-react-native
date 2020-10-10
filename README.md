# Friday Home App sample - React Native

This repository contains a sample app in write in React Native with TypeScript, to show how to communicate and use the Friday Lock.

## Build and run

This sample is created using [React Native's TypeScript start package](https://reactnative.dev/docs/typescript).
In general, it should be enough to run

```sh
yarn install
```

to install all required dependencies for development.

### iOS

As the sample requires access to Bluetooth, it is much more usefull to run on an actual device instead of a simulator.

To run on iOS, the xcode tools must be installed.
Also ensure that you have setup valid certificates in the `Info.plist` so you can sign the app for development.

Running the app for development can be done with:

```sh
xed -b ios
```

### Android

The sample has not yet been tested and deployed to Android.
