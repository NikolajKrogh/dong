# DONG

This project was started to create an app to support the drinking game "DONG".

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

View on the web:
```bash
npx expo start --dev-client
```

View on an android
```bash
npx expo run:android 
```

## Compiling the app

### Local

```bash
eas build --platform android --local --profile development
```

### Remote

```bash
eas build --platform android --profile development
```