/**
 * CONFIG — todos los parámetros ajustables del juego.
 *
 * Ningún otro módulo define números "mágicos". Si quieres cambiar el
 * equilibrio o el aspecto, se toca aquí y solo aquí: motor y datos separados.
 *
 * Esta es la versión INCREMENTAL/CLICKER: el jugador bombea agua a golpe de
 * clic, la almacena en un depósito y abastece a una población. La versión de
 * estrategia sobre terreno vive en la rama `master`.
 */

export const CONFIG = {

  /* ---------- LA POBLACIÓN A ABASTECER ----------
     De momento una sola. El juego arranca con ella sedienta. */
  poblacion: {
    nombre: 'Villagua',
    habitantes: 300,
    litrosHabitanteDia: 165   // dotación: lo que consume una persona al día
  },

  /* ---------- LA BOMBA (el clic principal) ----------
     Cada pulsación extrae agua del río y la mete en el sistema. Si hay
     depósito, se acumula; si no, solo cabe un chorrito (el propio tramo de
     tubería), así que hay que clicar sin parar. Ese contraste es lo que hace
     que el primer depósito se note tanto. */
  bomba: {
    litrosPorClic: 450,        // agua que entra por cada clic
    bufferSinDeposito: 900     // capacidad del sistema mientras no hay depósito (L)
  },

  /* ---------- EL DEPÓSITO (la primera automatización) ----------
     No produce agua: la GUARDA. Con él puedes bombear a ratos y dejar que la
     reserva abastezca mientras no clicas. */
  deposito: {
    coste: 300,
    capacidad: 20000           // litros de reserva
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    dineroInicial: 0,          // se empieza sin nada: el primer dinero sale de clicar
    tarifa: 3.60,              // €/m³ de agua servida (número de juego, no real)
    horasPorSegundo: 0.4       // 1 s real = 0,4 h de explotación. Marca el ritmo del reloj.
  },

  /* ---------- ASPECTO ----------
     El color codifica estado, no decora. Mismos tonos que la hoja de estilos. */
  color: {
    cielo:      ['#0a1a2b', '#123049', '#1c4a63'],  // degradado de arriba abajo
    tierra:     ['#243b2e', '#182a20'],
    agua:       '#38bdf8',
    aguaProfunda:'#0e5a86',
    aguaSeca:   '#475569',
    sol:        '#f5c451',
    estructura: '#94a3b8',
    deposito:   '#7dd3fc',
    casa:       '#facc15',
    casaSeca:   '#6f8aa1',
    ok:         '#4ade80',
    alarma:     '#f5a524',
    critico:    '#ef4444',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1'
  },

  /* ---------- GUARDADO ----------
     Clave nueva: el formato de la versión clicker no tiene nada que ver con
     el de la de estrategia, así que no deben pisarse en localStorage. */
  guardado: { clave: 'redHidraulica_clicker_v1', intervaloSegundos: 10 }
};
