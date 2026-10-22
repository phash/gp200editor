import type { Guide } from './types';

export const GP200_EDITOR_ES: Guide = {
  slug: 'valeton-gp-200-editor',
  title: 'Editor Valeton GP-200 para Windows, Mac y Linux',
  description:
    'Edita los presets de tu Valeton GP-200 en cualquier computadora: qué hace el editor oficial, dónde se queda corto y cómo lo complementa Preset Forge, gratis.',
  updated: '2026-10-22',
  intro:
    'Ajustar las perillas de la GP-200 directamente funciona, pero armar un preset en una pantalla tan pequeña es lento. Un editor en la computadora te muestra toda la cadena de señal de un vistazo y te permite guardar los presets como archivos y compartirlos. Esta guía compara las dos formas de editar la pedalera desde la PC: la app oficial de escritorio de Valeton y Preset Forge, un editor Valeton GP-200 gratuito que funciona en el navegador.',
  sections: [
    {
      heading: 'Qué hace un editor para la GP-200',
      body: [
        'Cada preset de la GP-200 es una cadena de once bloques: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB y VOL. Cada bloque contiene un efecto con hasta quince parámetros. Con un editor puedes activar y desactivar bloques, elegir el tipo de efecto, ajustar los parámetros y cambiar el orden de la cadena.',
        'Los presets se guardan como archivos .prst. Un editor lee y escribe estos archivos, así que puedes respaldar tus sonidos, descargar presets de otros guitarristas y conservar distintas versiones de un tono.',
      ],
    },
    {
      heading: 'El editor oficial de Valeton',
      body: [
        'Valeton publica su propio editor para la GP-200 como aplicación de escritorio para Windows. Se comunica con la pedalera por USB y también es la herramienta para actualizar el firmware, así que tenlo a mano aunque edites tus presets en otro lado.',
        'Fuera de Windows, las opciones escasean: no hay versión nativa para Linux, y usar la app de Windows con Wine o en una máquina virtual es complicado cuando hay de por medio un dispositivo USB MIDI.',
      ],
    },
    {
      heading: 'Preset Forge: un editor para la GP-200 en el navegador',
      body: [
        'Preset Forge es un editor gratuito y no oficial que funciona en el navegador. No hay que instalar nada, funciona en Windows, macOS, Linux y ChromeOS, y después de la primera visita también funciona sin conexión como PWA.',
      ],
      steps: [
        'Carga un archivo .prst arrastrándolo al editor, edita cada bloque y cada parámetro, y vuelve a guardarlo como archivo .prst.',
        'Conecta la GP-200 por USB para editar en vivo: cada cambio se envía a la pedalera al instante (Chrome, Edge o Firefox).',
        'Trae un preset desde la pedalera con “Cargar” y escríbelo de vuelta en un slot con “Guardar en [Slot]”.',
        'Importa presets .hlx de Line6 HX Stomp y conviértelos al formato de la GP-200 (experimental).',
        'Explora la galería de la comunidad y descarga presets filtrados por modelo de amplificador, efecto o estilo.',
        'Arma setlists con marcas de tiempo que cambian los presets de la pedalera durante una canción.',
      ],
      links: [
        { href: '/editor', label: 'Abrir el editor' },
        { href: '/gallery', label: 'Explorar la galería de presets' },
      ],
    },
    {
      heading: '¿Cuál deberías usar?',
      body: [
        'Usa la app de Valeton para actualizar el firmware y si estás en Windows y te funciona bien. Usa Preset Forge si tienes Mac, Linux o una Chromebook, si quieres editar en una computadora donde no puedes instalar programas, o si quieres compartir presets y usar setlists.',
        'Ambos trabajan con los mismos archivos .prst, así que puedes cambiar de uno a otro cuando quieras.',
      ],
    },
    {
      heading: 'Empieza en cinco minutos',
      steps: [
        'Abre preset-forge.com/editor en un navegador de escritorio con Web MIDI: Chrome, Edge o Firefox 108+.',
        'Conecta la GP-200 con un cable USB y haz clic en “Conectar GP-200”. Permite el acceso MIDI cuando el navegador lo pida.',
        'Haz clic en “Cargar” para traer el preset actual de la pedalera, o suelta un archivo .prst en la página: se envía automáticamente a la pedalera conectada.',
        'Cambia efectos y parámetros: con la pedalera conectada escuchas cada cambio de inmediato.',
        'Guarda con “Guardar en [Slot]” en la pedalera, o con “Guardar preset como archivo” en tu computadora.',
      ],
      links: [
        { href: '/guides/prst-file', label: '¿Qué es un archivo .prst?' },
        { href: '/guides/gp-200-on-linux', label: 'Usar la GP-200 en Linux' },
      ],
    },
  ],
};

export const PRST_FILE_ES: Guide = {
  slug: 'prst-file',
  title: '¿Qué es un archivo .prst? Cómo abrir presets de la Valeton GP-200',
  description:
    'Un archivo .prst es un preset de la Valeton GP-200. Descubre qué contiene, cómo abrirlo y editarlo en el navegador y cómo cargarlo en tu pedalera.',
  updated: '2026-10-22',
  intro:
    'Si descargas un preset para la GP-200 de un foro, de un amigo o de un sitio de presets, recibes un archivo que termina en .prst. Tu computadora no sabrá qué hacer con él, y si lo abres en un editor de texto solo verás caracteres sin sentido. Esta guía explica qué hay dentro de un archivo .prst y cómo abrir un archivo .prst, editarlo y usarlo.',
  sections: [
    {
      heading: 'Qué es un archivo .prst',
      body: [
        'PRST viene de preset. Un archivo .prst contiene exactamente un preset para la pedalera multiefectos Valeton GP-200. Es un archivo binario pequeño: los presets de usuario ocupan exactamente 1224 bytes. Como es binario, un editor de texto no puede mostrarlo de forma útil.',
      ],
    },
    {
      heading: 'Qué contiene',
      steps: [
        'El nombre del preset y el nombre del autor, cada uno de hasta 16 caracteres.',
        'Once bloques de efectos fijos: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB y VOL.',
        'Para cada bloque: si está activado o desactivado, qué efecto usa y hasta quince valores de parámetros.',
        'El orden de la cadena de señal, además de las asignaciones del pedal de expresión y de los controladores.',
        'Una suma de verificación (checksum) al final, que la pedalera usa para rechazar archivos dañados.',
      ],
    },
    {
      heading: 'Cómo abrir un archivo .prst',
      body: [
        'Necesitas un editor para la GP-200. Preset Forge abre archivos .prst directamente en el navegador, en Windows, macOS y Linux, sin instalar nada.',
      ],
      steps: [
        'Abre el editor.',
        'Arrastra el archivo .prst a la página, o haz clic en “Cargar preset desde disco” y elige el archivo.',
        'El editor muestra toda la cadena de señal. Haz clic en un bloque para ver y cambiar sus parámetros.',
      ],
      links: [{ href: '/editor', label: 'Abrir un archivo .prst en el editor' }],
    },
    {
      heading: 'Cómo cargar un archivo .prst en la GP-200',
      steps: [
        'Abre el archivo .prst en el editor como se describe arriba.',
        'Conecta la GP-200 por USB y haz clic en “Conectar GP-200” (Chrome, Edge o Firefox).',
        'Elige el slot de destino en la pedalera y haz clic en “Guardar en [Slot]”. El preset se escribe en la GP-200 y queda listo para tocar.',
      ],
    },
    {
      heading: 'Dónde conseguir archivos .prst',
      body: [
        'La galería de Preset Forge tiene más de 150 presets gratuitos para la GP-200, ordenados según el modelo de amplificador en el que se basan. Cada uno se descarga como archivo .prst o se abre directamente en el editor. También puedes subir tus propios presets y compartirlos con un enlace.',
      ],
      links: [
        { href: '/gallery', label: 'Presets gratis para la GP-200' },
        { href: '/amp/marshall-jcm800', label: 'Presets Marshall JCM800' },
        { href: '/amp/fender-65-twin-reverb', label: "Presets Fender '65 Twin Reverb" },
      ],
    },
    {
      heading: 'Problemas frecuentes',
      steps: [
        'El archivo no carga: verifica que sea un preset de la GP-200. Los archivos de otros modelos de Valeton no son compatibles.',
        'El archivo fue renombrado o comprimido: descomprímelo primero y asegúrate de que termine en .prst.',
        'Lo que tienes es un preset de Line6 HX Stomp (.hlx): cárgalo igual en el editor; Preset Forge lo convierte al formato de la GP-200 (experimental).',
      ],
    },
  ],
};

export const GP200_ON_LINUX_ES: Guide = {
  slug: 'gp-200-on-linux',
  title: 'Cómo usar la Valeton GP-200 en Linux',
  description:
    'El editor oficial de la Valeton GP-200 solo funciona en Windows. Así puedes editar y controlar en vivo tu GP-200 en Linux con Preset Forge en Chrome, Chromium o Firefox.',
  updated: '2026-10-22',
  intro:
    'La Valeton GP-200 es una pedalera multiefectos muy completa, pero su editor oficial solo funciona en Windows. Si usas Linux (Mint, Ubuntu, Fedora, Arch o cualquier otra distro), no necesitas un arranque dual ni una máquina virtual con Windows solo para ajustar tu tono. Preset Forge funciona completamente en el navegador y es el único editor para la GP-200 con soporte real para Linux. Esta guía cubre todo el flujo de trabajo para usar la GP-200 en Linux: editar presets y controlar la pedalera en vivo por USB MIDI directamente desde tu PC.',
  sections: [
    {
      heading: 'Por qué los usuarios de Linux necesitan otro editor',
      body: [
        'Valeton distribuye su editor para la GP-200 como aplicación de escritorio para Windows. No hay versión nativa para Linux, y tampoco para macOS. Durante años, eso obligó a los guitarristas en Linux a editar presets a mano en la pequeña pantalla de la pedalera, o a tener una computadora con Windows solo para ajustar el sonido.',
        'Preset Forge reemplaza ese flujo de trabajo. Es una aplicación web: ábrela en el navegador, carga un archivo .prst y edita cada slot de efecto, cada parámetro y toda la cadena de señal. No se instala nada, y tus presets nunca salen de tu computadora a menos que decidas compartirlos.',
      ],
    },
    {
      heading: 'Qué necesitas',
      body: [
        'La edición de presets funciona en cualquier navegador moderno en Linux. El control en vivo por USB MIDI, es decir, enviar los cambios a la pedalera en tiempo real, necesita la API Web MIDI. En Linux eso significa un navegador basado en Chromium (Chrome, Chromium, Brave, Edge) o Firefox 108 o posterior. La primera vez que conectas, Firefox ofrece instalar un pequeño complemento de permisos del sitio para MIDI; acéptalo una vez y a partir de ahí Firefox pide el acceso MIDI igual que Chrome. Los navegadores basados en WebKit, como GNOME Web, no implementan Web MIDI.',
      ],
      steps: [
        'Una PC con Linux (probado en Linux Mint; funciona cualquier distro con un Chromium o Firefox actualizado).',
        'Chrome, Chromium, Brave, Edge o Firefox 108+ para el MIDI en vivo; para editar sin conexión sirve cualquier navegador.',
        'Un cable USB para conectar la GP-200 (solo necesario para editar en vivo).',
        'Opcionalmente, tus archivos de presets .prst.',
      ],
    },
    {
      heading: 'Editar presets en el navegador',
      steps: [
        'Abre el editor en preset-forge.com/editor.',
        'Arrastra un archivo .prst a la página, o empieza con un preset de la galería de la comunidad.',
        'Ajusta cualquier efecto: activa y desactiva slots, cambia el tipo de efecto y gira las perillas de los parámetros.',
        'Reordena la cadena de señal arrastrando los slots; si usas el teclado, enfoca un slot y muévelo con las flechas.',
        'Guarda el preset editado como archivo .prst, listo para enviarlo en vivo o copiarlo al dispositivo.',
      ],
    },
    {
      heading: 'Conectar la GP-200 por USB MIDI en Linux',
      body: [
        'La GP-200 es un dispositivo USB MIDI class-compliant, así que Linux la reconoce sin ningún driver. ALSA la pone a disposición del navegador automáticamente: para el uso normal no hace falta configurar reglas udev ni módulos del kernel.',
      ],
      steps: [
        'Conecta la GP-200 a tu computadora con un cable USB y enciéndela.',
        'Abre el editor en Chrome, Chromium o Firefox y haz clic en “Conectar GP-200”.',
        'El navegador pide permiso para acceder a dispositivos MIDI (incluido SysEx). Haz clic en Permitir: eso es lo que deja que Preset Forge se comunique con la pedalera. En Firefox, la primera conexión instala antes, una sola vez, un complemento de permisos MIDI.',
        'Preset Forge pasa por Identity, comprobación de firmware y nombres de slots; luego la barra del dispositivo, arriba, muestra la pedalera conectada.',
        'Edita como siempre: activar efectos, cambiar parámetros y reordenar la cadena se envía a la GP-200 al instante. Usa “Cargar” para traer un preset del dispositivo y “Guardar en [Slot]” para escribir tus cambios de vuelta.',
        'Si cargas un archivo .prst con la pedalera conectada, Preset Forge envía el preset completo a la GP-200 automáticamente, bloque por bloque, con una barra de progreso en la barra del dispositivo. Puedes seguir editando mientras tanto; cargar otro preset o desconectar cancela el envío en curso. El preset enviado es una vista previa en vivo hasta que lo guardes en un slot.',
      ],
    },
    {
      heading: 'Solución de problemas en Linux',
      steps: [
        '“Conectar GP-200” no hace nada o no aparece la solicitud de permiso: probablemente estás en Safari u otro navegador WebKit, o en un móvil o tablet: los navegadores móviles no admiten Web MIDI. Usa Chrome, Chromium, Brave, Edge o Firefox 108+ en el escritorio. En Firefox, comprueba que aceptaste el complemento de permisos MIDI.',
        'La pedalera no aparece en la lista: asegúrate de que ninguna otra aplicación (un DAW, otra pestaña del navegador o una herramienta MIDI) esté usando el dispositivo, porque ALSA da acceso exclusivo. Ciérrala y vuelve a conectar.',
        'Se bloqueó el permiso: haz clic en el ícono del candado / MIDI en la barra de direcciones, vuelve a habilitar MIDI para preset-forge.com y recarga la página.',
        'Diferencias de firmware: Preset Forge está verificado con el firmware 1.8.0. Otras versiones suelen funcionar, pero si algo se comporta de forma extraña, revisa primero tu versión de firmware.',
      ],
    },
    {
      heading: '¿Funciona sin conexión?',
      body: [
        'Sí. Preset Forge es una PWA, así que después de tu primera visita el editor carga sin conexión, algo muy útil en la sala de ensayo o en un escenario sin Wi-Fi. La galería de la comunidad y la función de compartir necesitan internet, pero la edición y el control en vivo por USB MIDI no.',
      ],
    },
  ],
};

export const GUIDES_ES: Record<string, Guide> = {
  [GP200_EDITOR_ES.slug]: GP200_EDITOR_ES,
  [PRST_FILE_ES.slug]: PRST_FILE_ES,
  [GP200_ON_LINUX_ES.slug]: GP200_ON_LINUX_ES,
};
