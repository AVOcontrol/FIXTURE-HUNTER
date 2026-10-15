window.FixtureHunterStatic=true;
/* De dónde saca la app los archivos .d4 cuando no hay servidor de PC.
   Prueba cada origen en orden y usa el primero que responda con un .d4 válido.
   1) "d4/"  -> archivos incluidos dentro de la propia web o APK (si existen).
   2) Repositorio público de GitHub (necesita internet). */
window.FixtureHunterD4Sources=[
  'd4/',
  'https://raw.githubusercontent.com/AVOcontrol/FIXTURE-HUNTER/main/d4/'
];
