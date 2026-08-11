"""
SERVIDOR — el arranque del juego sin pelearse con la consola.

Existe por dos motivos, los dos molestos:

1. El juego usa módulos ES, y los navegadores los bloquean sobre `file://` por
   seguridad. Abrir index.html con doble clic NO funciona y nunca va a funcionar:
   hace falta que algo lo sirva por http.
2. El servidor de serie de Python cachea con ganas, así que editabas un .js,
   recargabas y seguías viendo el viejo. Aquí se manda `no-store` y se acabó.

Además busca un puerto libre y abre el navegador solo, para que jugar sea
doble clic y ya está.

Uso:  py servidor.py [puerto]
"""

import http.server
import os
import socket
import sys
import webbrowser

PUERTO_PREFERIDO = 8000
PUERTOS_A_PROBAR = 12


class Manejador(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # Sin esto, cambiar un .js y recargar no sirve de nada: el navegador
        # sigue sirviendo el módulo viejo de su caché.
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, formato, *args):
        # Una línea por cada imagen y cada módulo llena la ventana de ruido y no
        # aporta nada a quien solo quiere jugar. Los errores sí se ven.
        codigo = args[1] if len(args) > 1 else ''
        if str(codigo).startswith(('4', '5')):
            super().log_message(formato, *args)


def puerto_libre(inicio):
    """El primer puerto que nadie esté usando, empezando por el preferido."""
    for puerto in range(inicio, inicio + PUERTOS_A_PROBAR):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', puerto)) != 0:
                return puerto
    return None


def ip_local():
    """La IP de esta maquina en la red de casa, para jugar desde el movil."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            # No manda nada: solo pregunta que interfaz usaria para salir.
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    preferido = int(sys.argv[1]) if len(sys.argv) > 1 else PUERTO_PREFERIDO
    puerto = puerto_libre(preferido)
    if puerto is None:
        print('No hay ningun puerto libre entre %d y %d.'
              % (preferido, preferido + PUERTOS_A_PROBAR - 1))
        return 1

    url = 'http://localhost:%d/' % puerto
    # Escucha en todas las interfaces para poder jugar TAMBIEN desde el movil
    # (misma wifi). El precio: mientras este abierto, cualquier aparato de tu
    # red puede entrar. En una red domestica es un precio pequeno.
    servidor = http.server.HTTPServer(('0.0.0.0', puerto), Manejador)

    print('')
    print('  RED HIDRAULICA')
    print('  ' + url)
    ip = ip_local()
    if ip:
        print('')
        print('  Desde el movil (misma wifi):  http://%s:%d/' % (ip, puerto))
    print('')
    print('  Deja esta ventana abierta mientras juegas.')
    print('  Para cerrar el juego: cierra la ventana o pulsa Ctrl+C.')
    print('')

    # Se abre DESPUES de tener el socket escuchando: si se abre antes, el
    # navegador llega a una puerta cerrada y enseña un error.
    webbrowser.open(url)

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n  Hasta la proxima.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
