# 📱 Guía de Compilación Automática - VouTop Mobile Apps

Este documento explica cómo configurar y usar GitHub Actions para compilar automáticamente las aplicaciones Android e iOS de VouTop.

## 🚀 Configuración Inicial

### 1. Preparación del Proyecto

El proyecto ya está configurado con:
- ✅ Capacitor para Android
- ✅ Capacitor para iOS
- ✅ GitHub Actions workflow

### 2. Configurar Secretos en GitHub (Opcional para firmado)

Para firmar las aplicaciones automáticamente, necesitas agregar los siguientes secretos en GitHub:

#### Secretos de Android (Opcional)
1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Agrega los siguientes secretos:
   - `ANDROID_SIGNING_KEY`: Tu keystore codificado en Base64
   - `ANDROID_KEY_ALIAS`: El alias de tu key
   - `ANDROID_KEYSTORE_PASSWORD`: Contraseña del keystore
   - `ANDROID_KEY_PASSWORD`: Contraseña de la key

**Para generar el keystore en Base64:**
```bash
# 1. Crear keystore (si no lo tienes)
keytool -genkey -v -keystore voutop.keystore -alias voutop -keyalg RSA -keysize 2048 -validity 10000

# 2. Convertir a Base64
# En Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("voutop.keystore")) | Set-Content voutop-base64.txt

# En Linux/Mac:
base64 voutop.keystore > voutop-base64.txt
```

#### Secretos de iOS (Para firma en App Store)
Para distribuir en App Store Connect, necesitarás:
- Certificado de desarrollador de Apple
- Perfil de aprovisionamiento
- App Store Connect API Key

*Nota: La compilación básica de iOS no requiere estos secretos, pero generará una IPA sin firmar.*

## 🔨 Cómo Compilar las Apps

### Opción 1: Compilación Manual (Recomendado)

1. Ve a tu repositorio en GitHub
2. Click en **Actions** (en el menú superior)
3. Selecciona **Build Mobile Apps** en la barra lateral
4. Click en **Run workflow** (botón a la derecha)
5. Selecciona qué compilar:
   - ☑️ Build Android APK
   - ☑️ Build iOS IPA
6. Click en **Run workflow**

### Opción 2: Compilación Automática

El workflow se ejecuta automáticamente cuando:
- Haces push a la rama `main`
- Modificas archivos en: `android/`, `ios/`, `src/`, `capacitor.config.ts`

## 📦 Descargar las Apps Compiladas

### Método 1: Desde el Workflow
1. Ve a **Actions** → **Build Mobile Apps**
2. Click en el workflow ejecutado (el más reciente)
3. Baja hasta **Artifacts**
4. Descarga:
   - `android-apk` - Aplicación Android (.apk)
   - `ios-ipa` - Aplicación iOS (.ipa)

### Método 2: Desde Releases
1. Ve a la sección **Releases** de tu repositorio
2. La última release contendrá ambos archivos:
   - `app-release.apk` - Para Android
   - `App.ipa` - Para iOS

## 📱 Instalar las Apps

### Android
1. Descarga el archivo `.apk`
2. En tu dispositivo Android:
   - Abre Configuración → Seguridad
   - Habilita "Instalar apps de fuentes desconocidas"
3. Abre el archivo APK descargado
4. Sigue las instrucciones para instalar

### iOS
Para instalar en iOS necesitas:
1. **Para desarrollo/prueba**: 
   - Xcode instalado en Mac
   - Dispositivo iOS conectado
   - Certificado de desarrollador
   
2. **Para distribución**: 
   - Subir a TestFlight (requiere Apple Developer Program - $99/año)
   - O usar servicios de distribución como Diawi, TestFairy, etc.

**Comando para instalar IPA en desarrollo:**
```bash
# Con Xcode instalado:
xcrun simctl install booted App.ipa  # Para simulador
# O arrastra el IPA a Xcode → Window → Devices and Simulators
```

## 🔧 Solución de Problemas

### El workflow falla en Android
- Verifica que los archivos en `android/` estén commitados
- Revisa los logs del workflow para errores específicos
- Asegúrate de que el código compila localmente con `npm run build`

### El workflow falla en iOS
- iOS requiere macOS para compilar (GitHub Actions usa macOS)
- Verifica que CocoaPods esté correctamente configurado
- Revisa los logs del workflow

### Las apps se compilan pero no se instalan
- **Android**: Habilita instalación de fuentes desconocidas
- **iOS**: Necesitas firma válida o TestFlight para distribución

## 📝 Comandos Útiles Locales

```bash
# Compilar web app
npm run build

# Sincronizar Capacitor
npx cap sync

# Abrir proyecto Android en Android Studio
npx cap open android

# Abrir proyecto iOS en Xcode (requiere macOS)
npx cap open ios

# Compilar Android APK localmente
cd android && ./gradlew assembleRelease

# Ver logs de Capacitor
npx cap run android --livereload
npx cap run ios --livereload
```

## 🎯 Próximos Pasos

1. **Firma de Android**: Configura los secretos para firmar automáticamente
2. **TestFlight**: Configura distribución para iOS
3. **Play Store**: Sube la APK firmada a Google Play Console
4. **App Store**: Configura distribución automática con Fastlane

## 📚 Recursos Adicionales

- [Capacitor Documentation](https://capacitorjs.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Android Signing](https://developer.android.com/studio/publish/app-signing)
- [iOS Distribution](https://developer.apple.com/distribution/)

---

**Última actualización**: Diciembre 2025
**Versión de Capacitor**: 8.0.0
