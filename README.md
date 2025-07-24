This is a proof of concept React Native application that demonstrates how to use PowerSync along side the `@op-engineering/op-sqlite` for asynchronous and synchronous operations, respectively.

## Step 1: Start Metro

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using pnpm
pnpm start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using pnpm
pnpm android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using pnpm
pnpm ios
```
