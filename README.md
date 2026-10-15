# AVOcontrol Fixture Hunter 12.10.1 · Estudio

Buscador público de aparatos con catálogo completo, filtros combinables, interfaz en diez idiomas, tabla DMX y descargas de personalidades, PNG y GLB. El diseño Estudio mantiene los datos y las imágenes de la versión 12.8. Las pestañas disponibles son verdes; las que no tienen archivo son rojas.

## Estructura

- `www/index.html`: buscador en diez idiomas.
- `www/descargar/index.html`: página de descarga.
- `www/assets/`: catálogo, imágenes y modelos 3D.
- `d4/`: biblioteca pública de personalidades, conservada del repositorio anterior.
- `.github/workflows/build.yml`: compilación Android en GitHub Actions.
- `netlify.toml`: publicación web desde `www/`.
- `scripts/build-web.mjs`: comprobación de los recursos web (`npm run build`).

## APK

Al subir cambios a `main`, Actions instala dependencias, valida la web, genera el proyecto Android con Capacitor 7, compila y publica `AVOcontrol-Fixture-Hunter.apk` en Releases. También puede ejecutarse desde Actions > Build APK and web > Run workflow.

Se conserva el appId `com.avocontrol.fixturehunter`. Cada build tiene un `versionCode` creciente. Una APK instalada comprueba la última Release pública, avisa si hay una compilación posterior y permite descargarla. Android pide al usuario confirmar la instalación. También puede comprobarse desde el botón del pie de la app.

Para conservar la firma de las instalaciones anteriores, configurar una sola vez el secreto de Actions `ANDROID_KEYSTORE_BASE64` con el contenido base64 de la clave anterior `android-debug.keystore`. El archivo de firma se conserva localmente y está excluido del repositorio público y del ZIP de código. No poner su contenido en un commit, issue o mensaje. Sin este secreto el flujo se detiene con un mensaje explícito. La firma existente es para instalación manual; no es una entrega para Google Play.

La APK completa incluye la biblioteca .d4 disponible y permite descargarla sin conexión. La web y las APK ligeras anteriores consultan el directorio público del repositorio para esas descargas. La biblioteca ya está publicada. El flujo de Actions incorpora los .d4 después de sincronizar Capacitor, sin añadirlos a la web de Netlify/Cloudflare.

La APK completa 12.10.1 se ha compilado mediante GitHub Actions y firmado con la clave anterior. Las variantes ligeras anteriores se conservan como copia; para la versión actual utiliza la APK completa de Releases. Queda pendiente probar instalación y uso en un teléfono Android real.

La biblioteca recuperada contiene 21.354 archivos .d4. De los 21.608 aparatos del catálogo, 315 no tienen su archivo original disponible; se mantienen sus datos de canales y se desactiva esa descarga. El build vuelve a calcular la disponibilidad cuando se añaden archivos.

Descarga estable, después de una compilación correcta:
https://github.com/AVOcontrol/FIXTURE-HUNTER/releases/latest/download/AVOcontrol-Fixture-Hunter.apk

## Netlify

Importar este repositorio, rama `main`. La configuración del archivo `netlify.toml` fija `npm run build` y la carpeta publicada `www`. No seleccionar `copiar-en-APPS` ni la raíz como carpeta publicada. El buscador estará en `/` y la descarga en `/descargar/`.

Configuración de despliegue:
https://app.netlify.com/start/deploy?repository=https://github.com/AVOcontrol/FIXTURE-HUNTER

Este enlace abre la configuración de Netlify; no es una dirección de una web ya publicada. La URL pública la entrega Netlify después del despliegue. Al conectar el repositorio, cada cambio de `main` genera una nueva publicación web. No hay un service worker que mantenga una versión antigua en caché.

El enlace para compartir es `/descargar/`. Esta página muestra primero «Ir a Instagram» hacia `@avocontrol_solutions` y habilita APK/web al pulsarlo. Recuerda ese clic durante la sesión de la pestaña para permitir volver de Instagram o recargar. Registra únicamente el clic; no verifica que la persona haya seguido la cuenta. Los enlaces públicos directos de la APK y la aplicación siguen siendo accesibles.

## Desarrollo

Node 20 o superior. `npm ci`, después `npm run build`. El build valida los recursos, copia el visor GLB local y genera la versión de compilación. Servir `www/` con HTTP local o Netlify; la APK incluye su propio servidor de recursos. Esta distribución no es un HTML autónomo para abrir con doble clic mediante `file://`.

Para Android: Java 21 y Android SDK 35; `npm run android:add`, `npm run android:version`, `npm run android:sync`, `node scripts/android-offline.mjs` y Gradle `assembleDebug` dentro de `android`. Volver a ejecutar el paso offline después de cada sincronización Capacitor. Omitir ese paso para una APK ligera. Usar la misma clave anterior al firmar.

## Recursos 3D y búsqueda por foto

Los GLB existentes se pueden girar y ampliar en el visor incluido. Se conserva la indicación de geometría recuperada o parcial. Cuatro aparatos de la propuesta tienen una previsualización grande ya preparada a partir de sus mallas; el resto conserva sus miniaturas originales y sus archivos disponibles. No se generan imágenes durante una consulta o descarga.

El catálogo y los recursos incluidos funcionan sin consultas a una IA. No se ha implementado reconocimiento por foto; esa propuesta necesita un servicio de visión y pruebas con fotos reales. Debe proponer candidatos del catálogo y permitir confirmar modelo y modo DMX antes de elegir una librería.

## Windows portable

La entrega `Fixture-Hunter-PC-v12.10.1.zip` incluye un ejecutable Windows de 64 bits y su motor Electron. Descomprimir todo y abrir `Fixture Hunter.exe`; no necesita VBS ni un servidor Node separado. Incluye los .d4 disponibles para descarga local. El cierre de la ventana termina la aplicación y sus procesos propios; esta ruta se ha probado con el ejecutable real.

El código de escritorio está en `desktop/`. Para reconstruirlo después de `npm run build`, ejecutar `node scripts/prepare-desktop.mjs` y después:

```powershell
npx @electron/packager desktop "Fixture Hunter" --platform win32 --arch x64 --electron-version 44.7.2 --icon www/favicon.ico --out dist-pc
```

La versión y checksum del runtime utilizado están en `desktop/runtime.json`. No incluir `desktop/content` ni `dist-pc` al publicar el código fuente: se regeneran a partir de `www` y `d4`.

## Cloudflare Pages

La misma carpeta `www` puede publicarse en Cloudflare Pages. `wrangler.jsonc` contiene la configuración preparada. Usar integración Git o `npx wrangler@4 pages deploy www --project-name fixture-hunter-avocontrol` después de autorizar `npx wrangler@4 login`. La app supera los 1.000 archivos que permite arrastrar al panel; sí cabe en los 20.000 que admite Wrangler y ningún recurso web supera 25 MiB.

Web publicada: https://fixture-hunter-avocontrol.pages.dev/ . Página de Instagram y descargas: https://fixture-hunter-avocontrol.pages.dev/descargar/ . La publicación se realizó con Wrangler y autorización del usuario. Se han comparado los recursos principales con la fuente local y probado búsqueda, PNG, visor GLB, tabla y vista móvil en un navegador real.

La APK y el ZIP Windows se alojan aparte, en GitHub Releases. Para actualizar la web, publicar otra vez `www` en el mismo proyecto Pages; se mantiene el enlace. El proyecto actual usa Direct Upload. Para publicaciones automáticas mediante la integración Git del panel habría que crear un proyecto Pages con Git; no convertir el actual.

Referencias: https://capacitorjs.com/docs/v7/getting-started/environment-setup , https://capacitorjs.com/docs/v7/apis/browser , https://docs.netlify.com/build/configure-builds/file-based-configuration/ y https://modelviewer.dev/docs/ .

## Idiomas de la interfaz

Diez idiomas incluidos sin servicios externos: inglés (predeterminado), español, francés, alemán, italiano, portugués, ruso, chino simplificado, hindi y árabe. El selector conserva la preferencia elegida. Los nombres originales de fabricantes, modelos, modos y atributos DMX se mantienen para identificar los archivos sin ambigüedad. El árabe usa dirección de lectura de derecha a izquierda.

## Portada 12.10.1

La portada cubre toda la ventana, bloquea el scroll y los controles que quedan detrás, y conserva el teclado dentro de los controles visibles. El selector de idioma tiene espacio propio para evitar que tape el logo. Al abrir el buscador se recupera el desplazamiento normal.
