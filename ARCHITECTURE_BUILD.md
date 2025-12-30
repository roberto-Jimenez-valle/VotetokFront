# 🏗️ Arquitectura de Compilación - VouTop Mobile

```
┌─────────────────────────────────────────────────────────────────┐
│                         DESARROLLO LOCAL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Desarrollador escribe código en:                               │
│  ├── src/              (SvelteKit App)                          │
│  ├── android/          (Código nativo Android)                  │
│  └── ios/              (Código nativo iOS)                      │
│                                                                  │
│  Comandos útiles:                                               │
│  ├── npm run dev                (desarrollo web)                │
│  ├── npm run mobile:sync        (sincronizar cambios)           │
│  ├── npm run mobile:android     (abrir Android Studio)          │
│  └── npm run mobile:ios         (abrir Xcode - macOS)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ git push origin main
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GITHUB REPOSITORY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Código subido a GitHub activa:                                 │
│  └── .github/workflows/build-mobile-apps.yml                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Trigger automático
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GITHUB ACTIONS CI/CD                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────┐     │
│  │   BUILD ANDROID        │    │   BUILD iOS            │     │
│  │   (Ubuntu Runner)      │    │   (macOS Runner)       │     │
│  ├────────────────────────┤    ├────────────────────────┤     │
│  │ 1. Checkout código     │    │ 1. Checkout código     │     │
│  │ 2. Setup Node.js 20    │    │ 2. Setup Node.js 20    │     │
│  │ 3. npm ci              │    │ 3. npm ci              │     │
│  │ 4. npm run build       │    │ 4. npm run build       │     │
│  │ 5. Setup Java 17       │    │ 5. Setup Xcode         │     │
│  │ 6. cap sync android    │    │ 6. cap sync ios        │     │
│  │ 7. gradlew assembleRel │    │ 7. pod install         │     │
│  │ 8. Firmar APK (opt)    │    │ 8. xcodebuild archive  │     │
│  │ 9. Upload artifact     │    │ 9. xcodebuild export   │     │
│  └────────────────────────┘    │ 10. Upload artifact    │     │
│           │                     └────────────────────────┘     │
│           │                              │                      │
│           └──────────────┬───────────────┘                      │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ARTIFACTS & RELEASES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Archivos generados:                                            │
│  ├── android-apk/                                               │
│  │   └── app-release.apk       (Android APK)                   │
│  └── ios-ipa/                                                   │
│      └── App.ipa                (iOS IPA)                       │
│                                                                  │
│  Disponibles en:                                                │
│  ├── Actions → Workflow Run → Artifacts (30 días)              │
│  └── Releases → Latest Release (permanente)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DISTRIBUCIÓN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ANDROID:                                                        │
│  ├── Descarga directa del APK                                   │
│  ├── Instalación manual en dispositivo                          │
│  └── O subir a Google Play Console                              │
│                                                                  │
│  iOS:                                                            │
│  ├── Instalar con Xcode (desarrollo)                            │
│  ├── Distribuir con TestFlight (beta testing)                   │
│  └── O publicar en App Store (producción)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Opciones de Firma (Opcional)

### Android Signing (Recomendado para distribución)
```
GitHub Secrets:
├── ANDROID_SIGNING_KEY         (keystore en Base64)
├── ANDROID_KEY_ALIAS           (alias de la key)
├── ANDROID_KEYSTORE_PASSWORD   (password del keystore)
└── ANDROID_KEY_PASSWORD        (password de la key)
```

### iOS Signing (Necesario para App Store)
```
Requiere:
├── Apple Developer Account ($99/año)
├── Certificado de distribución
├── Perfil de aprovisionamiento
└── App Store Connect API Key
```

## ⚡ Flujo de Trabajo Típico

```
1. Desarrollar → npm run dev
2. Probar → npm run mobile:sync && npm run mobile:android
3. Commit → git add . && git commit -m "..."
4. Push → git push origin main
5. Esperar GitHub Actions → ☕ (10-15 min)
6. Descargar apps → GitHub Releases o Artifacts
7. Distribuir → Instalar directamente o subir a tiendas
```

## 📊 Tiempos Estimados

- Build Android: ~5-8 minutos
- Build iOS: ~10-15 minutos
- Build ambos en paralelo: ~15 minutos
- Descarga artifacts: ~1-2 minutos

## 🎯 Ventajas de esta Arquitectura

✅ **Compilación automatizada** - No necesitas macOS para iOS
✅ **Builds consistentes** - Mismo entorno cada vez
✅ **Versionado automático** - Cada build tiene su número
✅ **Artifacts seguros** - Almacenados en GitHub
✅ **Distribución fácil** - Descarga directa o releases
✅ **CI/CD completo** - Desde código a app instalable

## 🛠️ Personalización

Puedes modificar el workflow para:
- Ejecutar tests antes de compilar
- Notificaciones (Slack, Discord, Email)
- Deploy automático a Play Store/App Store
- Compilar solo en tags (v1.0.0, v1.1.0, etc.)
- Generar changelogs automáticos
