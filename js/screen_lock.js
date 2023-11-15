// Función para solicitar el modo de pantalla completa
function activarPantallaCompleta() {
    const elemento = document.documentElement; // Elemento raíz del documento (generalmente el <html>)
    
    if (elemento.requestFullscreen) {
      elemento.requestFullscreen();
    } else if (elemento.mozRequestFullScreen) { // Firefox
      elemento.mozRequestFullScreen();
    } else if (elemento.webkitRequestFullscreen) { // Chrome, Safari y Edge
      elemento.webkitRequestFullscreen();
    } else if (elemento.msRequestFullscreen) { // Internet Explorer/Edge
      elemento.msRequestFullscreen();
    }
}
