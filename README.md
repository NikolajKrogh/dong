# DONG

A mobile application supporting the drinking game DONG.

## About The Project

This React Native application was developed to improve the experience of playing drinking game **DONG**. 
It provides a digital platform for:

- Managing game rules  
- Retrieving matches in a time window
- Retrieving livescores

## Getting Started

Follow these simple steps to get the application running on your device.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) and npm on your development machine  
- [Expo CLI](https://docs.expo.dev/get-started/installation/) for React Native development  
- A text editor or IDE of your choice (e.g., Visual Studio Code)
- An Android device/emulator for testing

### Installation

1. Install dependencies:
```bash
npm install 
```
2. Start the app in development mode:

For web preview:
```bash
npx expo start --dev-client
```
For Android preview:
```bash
npx expo run:android
```

### Building The Application

Local build:
```bash
eas build --platform android --profile preview --local
```
Remote build using EAS Build services:
```bash
eas build --platform android --profile development
```

### Contributing
Contributions are welcome! Feel free to submit pull requests or open issues to improve the application.
