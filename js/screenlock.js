// Función para solicitar un bloqueo de pantalla
async function solicitarBloqueoPantalla() {
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      console.log('Bloqueo de pantalla activado.');
      
      // Escuchar el evento "release" para liberar el bloqueo cuando sea necesario
      wakeLock.addEventListener('release', () => {
        console.log('Bloqueo de pantalla liberado.');
      });
  
      // Puedes mantener el bloqueo de pantalla activo mientras sea necesario
      // await new Promise(resolve => setTimeout(resolve, 60000)); // Ejemplo: mantener activo durante 60 segundos
    } catch (error) {
      console.error('Error al solicitar el bloqueo de pantalla:', error);
    }
  }
  
  // Llama a la función para solicitar el bloqueo de pantalla cuando sea necesario
  solicitarBloqueoPantalla();