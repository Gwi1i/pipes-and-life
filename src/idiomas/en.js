/**
 * EL DICCIONARIO INGLÉS.
 *
 * El castellano es la FUENTE DE VERDAD y vive donde siempre (config.js,
 * comentarios.js, index.html). Esto es una CAPA que idioma.js mezcla encima
 * al arrancar. Dos reglas:
 *
 * - Aquí solo hay VALORES en inglés; claves y comentarios en castellano,
 *   como todo el código.
 * - Lo que falte aquí sale en castellano. Un texto sin traducir se enseña,
 *   nunca se esconde: por eso el diccionario puede crecer por tandas sin que
 *   ninguna versión intermedia parezca rota.
 *
 * Glosario fijado (mantenerlo, que el jugador aprende los términos):
 *   mancomunidad = district · comarca = county · pueblo = town
 *   captación = intake · bombeo = pumping station · depósito = tank
 *   potabilizadora = purification plant · depuradora = sewage plant
 *   cauce = the river · avería = breakdown · casilla = tile
 *   expediente = record · traslado = transfer · veteranía = seniority
 */
export const EN = {

  titulo: 'Pipes and Life — Run your water district',
  descripcion: 'Pipes and Life: a water management game. Capture, store, ' +
    'treat and deliver water to a district of 36 towns. The trade is real.',

  /* ============ CAPA SOBRE CONFIG ============
     Solo puede pisar claves que EXISTEN en CONFIG (lo garantiza mezclar()). */
  config: {

    textos: {
      sonidoSi: 'Sound: on', sonidoNo: 'Sound: off',
      musicaSi: 'Music: on', musicaNo: 'Music: off',
      vozSi: 'Voice: on', vozNo: 'Voice: off',
      confirmarReinicio: 'Start over? You will lose EVERYTHING: the game, ' +
        'your seniority and your record. To move to a new county and keep ' +
        'your experience, use TRANSFER, in the District tab.'
    },

    tutorial: [
      { titulo: 'Uncover the land',
        texto: 'Out there THIRTY-SIX towns are waiting for water, and this ' +
               'district starts with yours. Click the shaded tiles around ' +
               'your town until you can see the RIVER: the number on each ' +
               'one is the clicks it still needs.' },
      { titulo: 'Pump by clicking your town',
        texto: 'Click YOUR TOWN (or press the space bar): every click lifts ' +
               'water, and the water you serve gets billed. That is what ' +
               'pays for the works coming next.' },
      { titulo: 'Step 1 of the works: the intake',
        texto: 'In the MAP tab, under “Build on the map”, pick INTAKE and ' +
               'click a water tile on the river to place it. Green means it ' +
               'fits; red tells you why not.' },
      { titulo: 'Step 2: the pumping station, right by the water',
        texto: 'Water does not climb on its own. Pick PUMPING STATION and ' +
               'place it on flat ground TOUCHING the water, near your intake.' },
      { titulo: 'Step 3: the tank, up on high ground',
        texto: 'Find a HILL (a ridge works too) and place the TANK there. ' +
               'Water is stored UP HIGH so it flows down by gravity with ' +
               'pressure: that is why this piece asks for high ground, not flat.' },
      { titulo: 'Step 4: join it all with pipe',
        texto: 'Pick “Lay water pipe” and mark the route tile by tile FROM ' +
               'your town TO the intake, passing right next to the pumping ' +
               'station and the tank — touching a neighbouring tile is ' +
               'enough to connect them. Click the last tile to finish and ' +
               'pay. Whatever is not connected contributes NOTHING.' },
      { titulo: 'Your town is drinking!',
        texto: 'It is supplied now, and only water actually SERVED gets ' +
               'billed: a well-served town is what pays for the works. From ' +
               'here: explore towards the neighbouring towns, keep an eye ' +
               'on “The network” — a narrow pipe will not carry enough ' +
               'water forever — and when something breaks, find it on the ' +
               'map and repair it by clicking on it. As the town grows, ' +
               'sewerage, storm drains and waste collection will arrive, ' +
               'each with its OWN network.' }
    ],

    cierreGuia: {
      texto: 'Well done — this is a real network now! What you have built ' +
             'here is what I did my whole life, at another scale. Out there ' +
             'thirty-five towns are waiting: serve yours well, let it grow, ' +
             'and go get the next one. I will be around.'
    },

    servicios: {
      abastecimiento: { nombre: 'Water supply',
        desc: 'Bringing drinking water to the town. It is what the district lives on.' },
      saneamiento: { nombre: 'Sewerage',
        desc: 'Taking away what the town returns dirty, and treating it before the river.' },
      pluviales: { nombre: 'Storm drains',
        desc: 'Separating rain from the sewer so it does not burst the sewage plant.' },
      residuos: { nombre: 'Waste',
        desc: 'Collecting the rubbish and taking it away. What gets recycled is SOLD.' },
      explotacion: { nombre: 'Operations',
        desc: 'The crew that keeps everything else running. No network of its own.' }
    },

    mejoras: {
      bomba: { nombre: 'Pump power',
        desc: 'More water per click. Auto-pumping benefits too.' },
      deposito: { nombre: 'Reserve tank',
        desc: 'Stores water so you are not living click to click. Each level adds capacity.' },
      captacion: { nombre: 'Intake',
        desc: 'Draws water on its own, no clicking. Yields less in summer (low flow).' },
      depuradora: { nombre: 'Sewage works',
        desc: 'Treats wastewater before returning it to the river. Each level, cleaner.' },
      pluviales: { nombre: 'Storm drain network',
        desc: 'Separates rainwater from the sewer: relieves the sewage ' +
              'plant, and part of the rain tops up your tank.' },
      tanque: { nombre: 'Storm tank',
        desc: 'Holds the peak of a downpour so nothing overflows raw into ' +
              'the river, then treats it calmly later. Raises the town’s quality.' },
      reciclaje: { nombre: 'Recycling plant',
        desc: 'Each level opens a new fraction (packaging, organic, ' +
              'glass...) and its street container. What is sorted gets sold.' },
      mantenimiento: { nombre: 'Maintenance crew',
        desc: 'Repairs this town’s breakdowns on its own. Each level, faster.' }
    },

    premium: {
      autobomba: { nombre: 'Auto-pumping',
        desc: 'Pumps for you in this town, without rest.' }
    },

    construibles: {
      captacion: { nombre: 'Intake',
        desc: 'Takes water from the watercourse. Goes on the river or a lake.' },
      bomba: { nombre: 'Pumping station',
        desc: 'Pushes the water. On flat, open ground, right by the water.' },
      deposito: { nombre: 'Tank',
        desc: 'Stores water UP HIGH so it flows down by gravity: needs high ground, and a hill will do.' },
      potabilizadora: { nombre: 'Purification plant',
        desc: 'Treats raw water from the river and from squeezed wells. Serving it untreated slows growth.' },
      depuradora: { nombre: 'Sewage plant',
        desc: 'Treats wastewater before returning it to the river.' },
      tanque: { nombre: 'Storm tank',
        desc: 'Holds back the peak of a downpour. On flat land, or by clearing scrub.' },
      vertedero: { nombre: 'Landfill',
        desc: 'Where whatever is not recycled ends up. It fills, and it ' +
              'leaks: put it near water and you poison it — your own intake suffers.' },
      reciclaje: { nombre: 'Recycling plant',
        desc: 'Sorts and sells what can be recovered. The better it is, the ' +
              'more fractions it recovers and the more they pay for them.' },
      acuifero: { nombre: 'Production well',
        desc: 'Draws the water the borehole found. Can only go on a drilling that struck water.' }
    },

    redes: {
      abastecimiento: { nombre: 'Water supply', corto: 'water pipe',
        desc: 'Brings the water from the intake to the town.' },
      saneamiento: { nombre: 'Sewerage', corto: 'sewer',
        desc: 'Carries the town’s wastewater to the sewage plant.' },
      pluviales: { nombre: 'Storm drains', corto: 'storm drain',
        desc: 'Takes rainwater out of the sewer before it swamps the sewage plant.' },
      residuos: { nombre: 'Waste', corto: 'road',
        desc: 'Takes the rubbish from the town to the landfill and the recycling plant.' }
    }
  },

  /* ============ CAPA SOBRE EL HTML ESTÁTICO ============
     Selector CSS → innerHTML. Se aplica UNA vez al arrancar, antes de que la
     UI se construya. Los selectores con :has() se anclan a los ids de los
     huecos, no a la posición: reordenar el HUD no los rompe. */
  pagina: {
    '.marca-sub': 'Run your water district',

    '.hud-item:has(#hud-agua) .e': 'Water',
    '.hud-item:has(#hud-produccion) .e': 'Output',
    '.hud-item:has(#hud-dinero) .e': 'Funds',
    '.hud-item:has(#hud-poblacion) .e': 'Population',
    '.hud-item:has(#hud-servicio) .e': 'Service',
    '.hud-item:has(#hud-cauce) .e': 'River',
    '.hud-item:has(#hud-expansion) .e': 'Expansion',
    '.hud-item:has(#hud-reloj) .e': 'Time · month',

    '#btn-reiniciar': 'Reset',

    '.solapa[data-solapa="mapa"]': 'Map',
    '.solapa[data-solapa="pueblo"]': 'Town',
    '.solapa[data-solapa="comun"]': 'District',

    '#panel-averias > h2': 'Breakdowns',
    '#panel-obra > h2': 'Facility',
    '#panel-hallazgo > h2': 'Discovery',
    '#panel-almacen > h2': 'Storehouse',
    '#panel-ficha > h2': 'What you are about to build',
    '#panel-casilla > h2': 'This tile',
    'section:has(> #construir) > h2': 'Build on the map',
    '#panel-red > h2': 'The network',
    'section:has(> #diagnostico) > h2': 'Where the water comes from',
    'section:has(> #tienda) > h2': 'Town upgrades',
    'section:has(> #premium) > h2': 'Special feature',
    'section:has(> #detalle) > h2': 'Your people',
    '#panel-cauce > h2': 'River (shared)',
    'section:has(> #taller) > h2': 'Manuel’s workshop',
    'section:has(> #lugares) > h2': 'Towns near you',
    'section:has(> #expediente) > h2': 'Record and transfer',
    'section:has(> #respaldo) > h2': 'Backup',
    'section:has(> #registro) > h2': 'Log',
    'section:has(> .explica) > h2': 'How to play',

    '#guia-rotulo': 'First steps',
    '.guia-saltar': 'I know what I’m doing — skip the guide',

    '.cauce-multa': 'fine: <b id="cauce-multa">0</b> €/h',
    '.btn-limpiar': '<span>CLEAN THE RIVER</span>' +
      '<em>by hand, until the sewage plants take over</em>',

    '#taller > .m-desc': 'Practice with no reward and no penalty: it does ' +
      'not spend the one repair attempt, and shifts do not count here.',
    '[data-accion="practicarTuberias"]':
      '<span class="m-cab"><span class="m-nom">Repair by hand</span></span>' +
      '<span class="m-desc">The pipe board against the clock — a practice run.</span>',
    '[data-accion="practicarReciclaje"]':
      '<span class="m-cab"><span class="m-nom">The sorting line</span></span>' +
      '<span class="m-desc">Sorting waste on the belt — a practice run.</span>',

    '#respaldo > .m-desc': 'Your game lives in this browser. Copy it as ' +
      'text to keep a lifeline or move it to another device.',
    '[data-accion="exportarPartida"]':
      '<span class="m-cab"><span class="m-nom">Copy this game</span></span>' +
      '<span class="m-desc">To the clipboard, as text. Keep it anywhere you like.</span>',
    '[data-accion="importarPartida"]':
      '<span class="m-cab"><span class="m-nom">Load a copied game</span></span>' +
      '<span class="m-desc">Paste the text. It replaces the current game.</span>',

    '.explica':
      '<p><b>1. Click your town.</b> Every click on it lifts water from the ' +
      'river. Without a tank it goes straight to the taps: stop clicking ' +
      'and the town runs dry. And if you are broke, clicking the town is ' +
      'what gets you out of the hole.</p>' +
      '<p><b>2. Uncover land.</b> Click the shaded tiles next to yours. The ' +
      'better you serve the town, the fewer clicks each one takes.</p>' +
      '<p><b>3. Build the tank.</b> It needs high ground, and a hill will ' +
      'do. Water piles up, and the town drinks from the reserve while you ' +
      'rest.</p>' +
      '<p><b>4. Look before you dig.</b> Click any tile to see what terrain ' +
      'it is, what each network costs to cross it and what fits on top. ' +
      'There are nine terrains and the prices are nothing alike: sometimes ' +
      'going around a pine wood beats trenching through a boulder field.</p>' +
      '<p><b>5. Repair on site.</b> What breaks is one specific PIECE: it ' +
      'turns red and stops counting in the network. Go to it and click on ' +
      'it until it is fixed; every turn of the wrench costs money.</p>' +
      '<p><b>6. Grow the town.</b> Well served, without cuts, it grows and ' +
      'asks for more water. Poorly served, it empties out.</p>' +
      '<p><b>7. Widen the network.</b> A pipe carries what it carries, and ' +
      'the narrowest stretch rules. When the town stops growing or the ' +
      'intake chokes, renew the WHOLE line: half a new pipeline is worth ' +
      'nothing.</p>' +
      '<p><b>8. Treat before you dump.</b> As it grows, the town produces ' +
      'wastewater, and it needs its OWN network: a sewer down to a sewage ' +
      'plant by the water. The drinking pipe will not do.</p>' +
      '<p><b>9. Manage the rain.</b> With the third town, the STORM DRAIN ' +
      'network opens. Without it, rain and sewage run down together, and ' +
      'in autumn they burst the sewage plant.</p>' +
      '<p><b>10. Collect the rubbish, and sell it.</b> Its network is not a ' +
      'pipe: it is a ROAD to a landfill far from water. Burying only ' +
      'costs; with a recycling plant you start sorting fractions and ' +
      'selling them. It is the only income besides water.</p>' +
      '<p><b>11. Respect what turns up.</b> Digging can uncover ' +
      'archaeological remains. They cannot be removed or built over: you ' +
      'go around them. Excavating costs money, but then they pay rent ' +
      'forever.</p>',

    '#hito-eti-pasa': 'What just happened',
    '#hito-eti-hacer': 'What to do now',
    '#hito .hito-eti-porque': 'Why it matters',
    '[data-accion="cerrarHito"]': 'Got it',

    '#vuelta .hito-titulo': 'While you were away',
    '[data-accion="cerrarVuelta"]': 'Back to it',

    '[data-accion="cerrarDescubierto"]': 'Here we go',

    '#minijuego .mini-titulo': 'Repair by hand',
    '#mini-cancelar': 'Give up',
    '#minijuego .mini-desc': 'Tap the pieces to <b>turn</b> them, and link ' +
      'the <b>inlet</b> to the <b>outlet</b> before the water hits a ' +
      'mismatch. Water runs <b>straight</b> when it can; if not, it turns. ' +
      'Wet pieces no longer turn. And there is <b>always</b> a path: ' +
      'finding it in time is your job.',

    '#minijuego2 .mini-titulo': 'The sorting line',
    '#mini2-cancelar': 'Give up',
    '#minijuego2 .mini-desc': '<b>Grab</b> each item off the belt and ' +
      '<b>drop</b> it into its container. But not everything recycles: ' +
      'what has no container — the tied bag, the nappy, the plant pot, the ' +
      'sponge — <b>is left to ride on</b> to the landfill, and that scores ' +
      'too. The belt will not wait.',

    '.portada-lema': 'Bring the water to your district, town by town.',
    '.portada-desc': 'Capture the water, store it high, carry it far and ' +
      'return it clean. Thirty-six towns are waiting; the trade is real.',
    '#portada-jugar': 'Start'
  },

  /* Selector CSS → [atributo, valor]. Para lo que no es contenido. */
  atributos: [
    ['.hud-item:has(#hud-expansion)', 'title',
     'Good service makes clearing tiles cheaper']
  ]
};
