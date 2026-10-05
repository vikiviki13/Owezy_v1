# Owezy Mobile App (Android & iOS)

This folder contains the complete native mobile projects for **Android** and **iOS** generated from the Owezy codebase using Capacitor.

## Project Structure

```
Mobile app/
├── android/            # Native Android project (Gradle, Kotlin/Java, AndroidManifest)
│   ├── app/
│   │   ├── src/main/   # Android source code, AndroidManifest.xml, assets, res
│   │   └── build.gradle
│   ├── build.gradle
│   └── gradlew.bat
└── ios/                # Native iOS project (Xcode workspace, Swift)
    └── App/
        ├── App/
        │   ├── public/ # Packaged web assets
        │   └── ...
        └── App.xcworkspace
```

---

## Configuration

The root configuration file is [capacitor.config.ts](../../capacitor.config.ts):
- **App Name**: `Owezy`
- **Application ID / Bundle ID**: `com.owezy.app`
- **Web Build Dir**: `dist`
- **Android Path**: `Mobile app/android` (Configured for direct `.apk` output)
- **iOS Path**: `Mobile app/ios`

---

## How to Build the Mobile App

### 1. Sync Latest Web Code to Mobile Platforms
Whenever you update code in the main web app, run:
```bash
npm run cap:sync
```
This builds the latest frontend (`dist/`) and copies all assets & native plugin bindings directly into `Mobile app/android` and `Mobile app/ios`.

---

### 2. Android (Building APK)

#### Prerequisites:
- **Java Development Kit (JDK 17 or 21)** (Installed on this machine: Microsoft OpenJDK 17 at `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`)
- **Android Studio** (or Android SDK command-line tools with Platform 34/35/36)

#### Option A: Using Android Studio (Recommended)
1. Open **Android Studio**.
2. Select **Open** and select the folder:
   `e:\Personal Projects\Owezy_v1\Mobile app\android`
   (or run `npm run cap:open:android`).
3. Allow Gradle to sync.
4. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
5. Your debug APK will be generated at:
   `Mobile app/android/app/build/outputs/apk/debug/app-debug.apk`

#### Option B: From Command Line
In PowerShell:
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd "Mobile app\android"
.\gradlew.bat assembleDebug
```
The APK will be generated at:
`Mobile app/android/app/build/outputs/apk/debug/app-debug.apk`

---

### 3. iOS (Running & Building on macOS)

#### Prerequisites:
- **macOS** with **Xcode 15+** installed
- **CocoaPods** or Swift Package Manager (Capacitor 8 uses Swift Package Manager natively)

#### Steps:
1. Transfer or clone the project on a Mac.
2. In the project root, run:
   ```bash
   npm run cap:open:ios
   ```
   (This opens `Mobile app/ios/App/App.xcworkspace` in Xcode).
3. In Xcode, select your signing team under **Signing & Capabilities**.
4. Select your connected iPhone or simulator and click **Run** or **Product → Archive** to build the iOS app.
