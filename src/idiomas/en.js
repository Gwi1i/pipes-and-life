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
      meses: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
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
    },

    terrenos: {
      prado:    { nombre: 'Meadow' },
      pastizal: { nombre: 'Grassland' },
      pedregal: { nombre: 'Boulder field' },
      matorral: { nombre: 'Scrubland' },
      pinar:    { nombre: 'Pine wood' },
      bosque:   { nombre: 'Dense forest' },
      colina:   { nombre: 'Hill' },
      sierra:   { nombre: 'Ridge' },
      roca:     { nombre: 'Bare rock' },
      agua:     { nombre: 'River' },
      lago:     { nombre: 'Lake' }
    },

    estaciones: [
      { nombre: 'Spring' }, { nombre: 'Summer' },
      { nombre: 'Autumn' }, { nombre: 'Winter' }
    ],

    tuberia: {
      // Los DN son nomenclatura internacional: se quedan. El material sí habla.
      diametros: [
        { material: 'asbestos cement' },
        { material: 'polyethylene' },
        { material: 'ductile iron' }
      ],
      nombreObra: {
        prado: 'trench', pastizal: 'trench', pedregal: 'rock breaking',
        matorral: 'clearing', pinar: 'felling', bosque: 'felling and stump removal',
        colina: 'excavation', sierra: 'rock excavation', roca: 'blasting',
        agua: 'river crossing', lago: 'lake crossing'
      }
    },

    viales: {
      clases: [
        { nombre: 'Dirt track', material: 'compacted earth' },
        { nombre: 'Paved road', material: 'asphalt' },
        { nombre: 'Dual carriageway', material: 'concrete' }
      ]
    },

    arqueologia: {
      tipos: [
        { nombre: 'Ancient settlement',
          desc: 'Walls of a settlement from centuries ago: streets, hearths and pottery.' },
        { nombre: 'Hoard',
          desc: 'Coins, tools and bronze pieces hidden long ago and never recovered.' },
        { nombre: 'Necropolis',
          desc: 'An ancient cemetery. The graves tell how people lived better than any book.' },
        { nombre: 'Hominid remains',
          desc: 'Bones and tools of the first humans. Extremely rare: half the province will come to see it.' },
        { nombre: 'Dinosaur fossils',
          desc: 'Bones from millions of years ago. The jackpot of any construction site: a museum in your town.' }
      ]
    },

    acuiferos: {
      clases: {
        karst: { nombre: 'Mountain aquifer',
          desc: 'Water held in the cracks of the rock. Costly to drill and it ' +
                'yields less, but the level barely moves all year.' },
        aluvial: { nombre: 'Alluvial aquifer',
          desc: 'Water in the gravels of an old floodplain. Cheap to drill and ' +
                'generous, but it feels the summer: it recharges from the river and the rain.' }
      }
    },

    comarcas: {
      ventajas: {
        cartografia: { nombre: 'Cartography',
          desc: 'You arrive with the maps: +2 uncovered tiles around your starting town, per level.' },
        manosCurtidas: { nombre: 'Seasoned hands',
          desc: 'One less click per tile when uncovering land, per level. The crew already knows where to dig.' },
        ojoClinico: { nombre: 'Trained eye',
          desc: 'Hydrogeological surveys 15% cheaper per level: you can read the land before paying for it.' },
        fama: { nombre: 'Reputation',
          desc: 'Your name precedes you: the FIRST joining fee of each county, ' +
                '25% cheaper per level. The rest at market price.' }
      },
      regiones: [
        { nombre: 'the home county' },
        { nombre: 'the wetlands' },
        { nombre: 'the high plains' },
        { nombre: 'the eastern lands' }
      ]
    },

    /* Solo `titulo` y `ficha`: el `nombre` es la clave de las imágenes
       (f_aldea.jpg) y NO se traduce. */
    caserio: {
      escalones: [
        { titulo: 'hamlet',
          ficha: 'Under 400 people. For water supply these are the most ' +
                 'thankless places: the works cost almost as much as in a big ' +
                 'town, but there are very few bills to pay for them. That is ' +
                 'why districts exist — by joining together, the small ones ' +
                 'can afford what they never could alone.' },
        { titulo: 'village',
          ficha: 'Up to 1,600 people. The demand peak appears here: at eight ' +
                 'in the morning everyone opens the tap at once, and the ' +
                 'network has to take that peak, not the daily average. That ' +
                 'is exactly what the tank is for.' },
        { titulo: 'town',
          ficha: 'Up to 6,000 people. At this size sewerage weighs as much as ' +
                 'supply: you have to bring the water AND take it away. And a ' +
                 'leak stops being a drip and becomes a percentage of the budget.' },
        { titulo: 'city',
          ficha: 'Over 6,000 people. One pipeline is no longer enough: you ' +
                 'need several, meshed so they back each other up, and tanks ' +
                 'spread around. A cut here is not a nuisance, it is news.' }
      ]
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
  ],

  /* ============ LAS FRASES DE LA ETIQUETA t ============
     Clave = esqueleto exacto de la plantilla (partes fijas con {0},{1} en los
     huecos, espacios plegados). Las saca assets/extraer_frases.py, para que
     casen por construcción; una clave que no case no rompe nada — la frase
     sale en castellano y queda apuntada en juego.sinTraducir.

     OJO: la clave llega RECORTADA, pero el valor se usa TAL CUAL — si la
     frase original empezaba con espacio (t` · estiaje`), el valor inglés
     debe traerlo también. */
  frases: {

    /* --- Paleta de obra y panel de red --- */
    'Colocar {0}': 'Lay {0}',
    'Marca el recorrido casilla a casilla. Clic en la última para rematar, en la anterior para deshacer.':
      'Mark the route tile by tile. Click the last one to finish, the previous one to undo.',
    '{0} · {1} % fugas': '{0} · {1} % leaks',
    'Todavía no hay colector. El pueblo se apaña con la red unitaria vieja: {0} de {1}, y todo lo que no le cabe acaba en el río.':
      'There is no sewer yet. The town gets by on the old combined network: {0} in {1}, and whatever does not fit ends up in the river.',
    'Todavía no hay ninguna línea que llegue al pueblo. Mientras tanto bebe de la red vieja: {0} de {1}.':
      'No line reaches the town yet. Meanwhile it drinks from the old network: {0} in {1}.',
    '{0} casillas · {1}': '{0} tiles · {1}',
    '{0} años': '{0} years',
    'Renovar a {0} de {1}.': 'Renew to {0} in {1}.',
    'Pasada de vida útil ({0} años del {1}): fuga cada vez más. Renovarla la deja nueva.':
      'Past its service life ({0} years for {1}): it leaks more every year. Renewing it makes it new again.',
    'Ya está a la altura del diámetro elegido.': 'Already up to the chosen diameter.',
    'Manda el tramo más estrecho: <b>{0}</b> de {1}':
      'The narrowest stretch rules: <b>{0}</b> in {1}',
    '({0} líneas así)': '({0} lines like this)',
    'Clase de vía con que se tiende y a la que se renueva:':
      'Road class for laying and renewing:',
    'Diámetro con que se tiende y a la que se renueva:':
      'Diameter for laying and renewing:',
    'hasta {0} hab': 'up to {0} people',

    /* --- Pueblos de tu zona --- */
    'Los pueblos por descubrir llevan nombres de tu comarca ({0}): <b>{1}</b>… Los ya incorporados conservan el suyo.':
      'Undiscovered towns carry names from your area ({0}): <b>{1}</b>… The ones already joined keep theirs.',
    'Volver a los inventados': 'Back to the invented names',
    'La lista de nombres se borra de este navegador.': 'The list of names is deleted from this browser.',
    'Los pueblos del mapa pueden llamarse como los de tu comarca: encontrar tu zona en el juego tiene su gracia. Tu ubicación se usa UNA sola vez para preguntar a OpenStreetMap por los municipios cercanos, no se guarda, y aquí solo queda la lista de nombres.':
      'The towns on the map can take the names of the ones near you: finding your own area in the game is half the fun. Your location is used ONCE to ask OpenStreetMap for nearby municipalities, it is never stored, and only the list of names stays here.',
    'Usar pueblos de mi zona': 'Use towns from my area',
    'El navegador te pedirá permiso de ubicación.': 'Your browser will ask for location permission.',

    /* --- De dónde sale el agua --- */
    'estiaje: el río viene bajo, −{0}': 'low flow: the river is running low, −{0}',
    'deshielo: viene crecido, +{0}': 'snowmelt: it is running high, +{0}',
    'Del río': 'From the river',
    'acuífero bajo: dan menos': 'aquifer low: they yield less',
    'De los pozos': 'From the wells',
    'Sin captación conectada: toda el agua sale de tus clics. Una captación en el río —o un pozo— produce sola.':
      'No intake connected: all the water comes from your clicks. An intake on the river — or a well — produces on its own.',
    'No cabe por {0}': 'Does not fit through {0}',
    'renovar la línea lo libera': 'renewing the line frees it',
    'Fugas del {0}': 'Leaks from the {0}',
    'hay una línea vieja: renovarla lo corta': 'there is an old line: renewing it stops this',
    'Agua insalubre': 'Tainted water',
    'lixiviados sobre tu toma': 'leachate over your intake',
    'Una pieza parada por avería': 'One piece stopped by a breakdown',
    '{0} piezas paradas por avería': '{0} pieces stopped by breakdowns',
    'repárala sobre el mapa': 'repair it on the map',
    'parada': 'stopped',
    'Produce': 'Produces',
    'El pueblo pide de media': 'The town asks on average',
    'La captación cubre la demanda media; el depósito absorbe las puntas y tus clics son propina.':
      'The intake covers average demand; the tank absorbs the peaks and your clicks are a tip.',
    'La captación NO cubre la demanda: lo que falte sale de tus clics, o el pueblo pasa sed.':
      'The intake does NOT cover demand: whatever is missing comes from your clicks, or the town goes thirsty.',

    /* --- Avisos de red --- */
    'Una línea de {0} años ({1}, vida útil {2}): fuga un {3} % y cada año irá a más. Renovarla —aunque sea al mismo calibre— la deja nueva.':
      'A {0}-year-old line ({1}, service life {2}): it leaks {3} % and it will get worse every year. Renewing it — even at the same diameter — makes it new again.',
    'Tu captación da más agua de la que cabe por {0}: se está perdiendo lo que sobra. Comprar más captación no servirá de nada hasta que ensanches la línea.':
      'Your intake yields more water than fits through {0}: the surplus is being lost. Buying more intake will do nothing until you widen the line.',
    'El pueblo ha tocado techo: por {0} no cabe agua para más de {1} habitantes. Hasta que no renueves la línea entera, no crece.':
      'The town has hit its ceiling: {0} cannot carry water for more than {1} people. Until you renew the whole line, it will not grow.',
    'Estás sirviendo {0} L/h de agua BRUTA sin potabilizar (del río, o de pozos exprimidos), y eso frena el crecimiento: nadie se fía de un grifo sin garantía. Una POTABILIZADORA conectada lo resuelve.':
      'You are serving {0} L/h of RAW, untreated water (from the river, or from squeezed wells), and that slows growth: nobody trusts a tap without a guarantee. A connected PURIFICATION PLANT solves it.',
    'No hay red de pluviales: la lluvia y las aguas fecales van juntas por el mismo colector, y en tormenta eso es lo que revienta a la depuradora. Tender una línea aparte saca del colector todo lo que le quepa.':
      'There is no storm drain network: rain and sewage run down the same sewer, and in a storm that is what bursts the sewage plant. Laying a separate line takes out of the sewer as much as it can carry.',
    'Ahora mismo caen {0} L/h sobre el pueblo y tu red se lleva {1} L/h. El resto baja por el colector.':
      'Right now {0} L/h are falling on the town and your network takes {1} L/h. The rest goes down the sewer.',
    'No hay carretera: el camión no tiene por dónde salir y la basura se queda en el pueblo. Aquí no hay ninguna vía vieja que valga, hay que tenderla.':
      'There is no road: the truck has no way out and the rubbish stays in town. There is no old road to fall back on here — you have to build it.',
    'Recoges la basura pero no tienes dónde dejarla: hace falta un VERTEDERO enganchado a la carretera, y lejos del agua.':
      'You collect the rubbish but have nowhere to leave it: you need a LANDFILL connected to the road, and far from water.',
    'Se genera más basura de la que puede sacar la vía: {0} t/h contra {1}. Lo que no sale se pudre en la calle —ya va por el {2} %— y frena el crecimiento.':
      'More rubbish is produced than the road can carry: {0} t/h against {1}. What stays behind rots in the street — already at {2} % — and slows growth.',
    'Todo va al vertedero, y enterrar solo cuesta dinero. Con una PLANTA DE RECICLAJE conectada empiezas a separar fracciones y a venderlas: es la única parte del juego que ingresa aparte del agua.':
      'Everything goes to the landfill, and burying only costs money. With a connected RECYCLING PLANT you start sorting fractions and selling them: it is the only income in the game besides water.',
    'El pueblo ya genera aguas residuales y no hay ninguna depuradora enganchada al colector. Todo lo que sale va crudo al cauce: constrúyela junto al agua y llévale una línea de saneamiento.':
      'The town already produces wastewater and no sewage plant is connected to the sewer. Everything goes raw into the river: build one by the water and lay a sewer line to it.',
    'El colector está REBOSANDO: entra más agua de la que cabe por {0} y se sale antes de llegar a la depuradora. Eso va al río sin tratar. Ensancha el colector o separa las pluviales.':
      'The sewer is OVERFLOWING: more water comes in than fits through {0} and it spills before reaching the sewage plant. That goes to the river untreated. Widen the sewer or separate the storm water.',
    'El colector da de sí, pero la depuradora no: le llegan {0} L/h y solo trata {1} L/h. Lo que sobra se alivia crudo. Ahora el problema no es la tubería: hace falta más depuración, o un tanque de tormentas que corte la punta.':
      'The sewer copes, but the sewage plant does not: {0} L/h arrive and it only treats {1} L/h. The excess spills raw. The pipe is not the problem now: you need more treatment, or a storm tank to cut the peak.',

    /* --- Tarjetas y guía --- */
    'Lo has conseguido': 'You did it',
    'Qué ha pasado': 'What just happened',
    'Qué viene ahora': 'What comes next',
    'Qué tienes que hacer': 'What to do now',
    'Primeros pasos': 'First steps',
    'dice': 'says',

    /* --- Hallazgos: yacimiento, señal, ruina --- */
    'en valor': 'on display',
    'Renta <b>{0} €/h</b> y seguirá haciéndolo. La casilla queda para siempre fuera de obra.':
      'It earns <b>{0} €/h</b> and will keep doing so. The tile stays off-limits to construction forever.',
    'Ha salido al picar. No se puede quitar ni construir encima: hay que rodearlo. Excavarlo cuesta, pero lo pone en valor y pasa a rentar todos los meses.':
      'It turned up while digging. It cannot be removed or built over: you go around it. Excavating costs money, but it puts the site on display and it starts earning every month.',
    'Excavar y poner en valor': 'Excavate and put on display',
    '+{0} €/h para siempre.': '+{0} €/h forever.',
    'Señal de camino': 'Waymark',
    '«{0} · a {1} casillas»': '“{0} · {1} tiles away”',
    'Los camineros las plantaban donde el viajero dudaba. Apunta siempre al pueblo por descubrir más cercano: cuando lo incorpores, señalará al siguiente.':
      'Road keepers planted these where travellers hesitated. It always points to the nearest undiscovered town: once you bring it in, it will point to the next one.',
    'Ya no señala a nadie: no queda ningún pueblo por descubrir en la comarca. Buen trabajo.':
      'It points to no one anymore: there are no towns left to discover in the county. Good work.',
    'abandonada': 'abandoned',
    'Quien la levantó ya no está; la instalación, sí. Recuperarla siempre sale más barato que hacerla nueva.':
      'Whoever built it is long gone; the facility is still here. Restoring it is always cheaper than building new.',
    'Poner en marcha aquí': 'Restore it here',
    'Se queda donde está, si el terreno le sirve.': 'It stays where it is, if the terrain suits it.',
    'Desmontar y guardar': 'Dismantle and store',
    'Va al almacén para levantarla donde te convenga.': 'It goes to the storehouse, to rebuild wherever suits you.',

    /* --- Ficha del pueblo --- */
    'Un núcleo de este tamaño': 'A place this size',
    'Habitantes': 'Population',
    'Distancia': 'Distance',
    'anillo {0}': 'ring {0}',
    'Demasiado lejos para la mancomunidad de hoy: incorpora {0} núcleos más cercanos y se abrirá este anillo.':
      'Too far for today’s district: bring in {0} closer towns and this ring will open.',
    'Abastecer este pueblo': 'Supply this town',
    'Hay que haberle llevado antes una tubería. Al hacerlo entra en la mancomunidad.':
      'You must have brought a pipe to it first. Doing so brings it into the district.',
    'canon: {0} €': 'joining fee: {0} €',
    'Pide de media': 'Asks on average',
    'Servicio': 'Service',
    'Es el pueblo que estás mirando. Cada clic encima es una bombada.':
      'This is the town you are looking at. Every click on it is a pump stroke.',
    'Clícalo en el mapa para ponerlo al frente y bombear aquí.':
      'Click it on the map to bring it forward and pump here.',

    /* --- Expediente --- */
    'al máximo': 'maxed out',
    '{0} veteranía': '{0} seniority',
    '<b>Comarca {0}</b> · {1} · veteranía disponible: <b>{2}</b>':
      '<b>County {0}</b> · {1} · seniority available: <b>{2}</b>',
    'Trasladarse a otra comarca': 'Transfer to another county',
    'La red, la caja y los pueblos se quedan; tú te llevas la experiencia. Territorio nuevo de verdad: otro río, otros acuíferos.':
      'The network, the funds and the towns stay behind; you take the experience. Genuinely new land: another river, other aquifers.',
    '+{0} veteranía': '+{0} seniority',
    'El traslado se ofrecerá al alcanzar la fase {0}: las comarcas grandes solo llaman a quien ya ha demostrado lo que sabe.':
      'The transfer will be offered at phase {0}: the big counties only call on those who have proven themselves.',

    /* --- Instalación seleccionada --- */
    'AVERIADA: no cuenta en la red hasta que la repares clicándola en el mapa.':
      'BROKEN DOWN: it does not count in the network until you repair it by clicking it on the map.',
    'SIN CONECTAR: no aporta nada hasta que le llegue su red.':
      'NOT CONNECTED: it contributes nothing until its network reaches it.',
    'Turno echado: la venta va al <b>+{0} %</b> todavía {1} horas más.':
      'Shift worked: sales are at <b>+{0} %</b> for {1} more hours.',
    'Echar un turno en la línea': 'Work a shift on the line',
    'Separa bien en la cinta y la venta de reciclado sube hasta un {0} % una temporada.':
      'Sort well on the belt and recycling sales rise up to {0} % for a while.',
    'jugar': 'play',
    'nivel {0}': 'level {0}',
    'Ampliada al máximo: si hace falta más, toca construir otra.':
      'Expanded to the maximum: if you need more, build another one.',
    'Ampliar a nivel {0}': 'Expand to level {0}',
    'Pasará a aportar como {0} piezas iguales.': 'It will contribute like {0} identical pieces.',
    'vaso nivel {0}': 'cell level {0}',
    '{0} de {1} t ({2} %).': '{0} of {1} t ({2} %).',
    'LLENO: ya no admite nada.': 'FULL: it takes nothing more.',
    'Gotea sobre el agua que tiene alrededor, y cuanto más lleno, más. Un agua insalubre da menos caudal.':
      'It leaks into the water around it, and the fuller it is, the more. Tainted water yields less flow.',
    'No se puede ampliar más: abre otro vertedero en otra parte.':
      'It cannot be expanded further: open another landfill elsewhere.',
    'Ampliar el vaso': 'Expand the cell',
    '+{0} t de capacidad.': '+{0} t of capacity.',
    'Por aquí pasa <b>{0}</b>: {1} de {2} casillas.': 'Through here runs <b>{0}</b>: {1}, {2} tiles long.',
    'Levantarla (+{0} €)': 'Take it up (+{0} €)',
    'Derribar': 'Demolish',
    'La casilla queda libre y del derribo se recuperan {0} €.':
      'The tile is freed and the demolition recovers {0} €.',

    /* --- Qué aporta cada pieza --- */
    'Aporta <b>{0} L/s</b> de producción continua al pueblo, sin clicar.':
      'It contributes <b>{0} L/s</b> of continuous production, no clicking.',
    'Suma <b>{0} L</b> a cada clic de bombeo.': 'It adds <b>{0} L</b> to every pump click.',
    'Añade <b>{0} L</b> de capacidad de reserva.': 'It adds <b>{0} L</b> of reserve capacity.',
    'Potabiliza <b>{0} L/h</b> de agua bruta del río o de pozos exprimidos. Sin tratar, esa agua frena el crecimiento.':
      'It purifies <b>{0} L/h</b> of raw water from the river or from squeezed wells. Untreated, that water slows growth.',
    'Trata <b>{0} L/h</b> de aguas residuales y mejora la limpieza un <b>{1} %</b>.':
      'It treats <b>{0} L/h</b> of wastewater and improves cleanliness by <b>{1} %</b>.',
    'Retiene <b>{0} L</b> de punta de tormenta para tratarlos cuando la depuradora respire.':
      'It holds <b>{0} L</b> of storm peak, to be treated when the sewage plant can breathe.',

    /* --- Ficha divulgativa --- */
    '¿Qué es?': 'What is it?',
    '¿Para qué sirve?': 'What is it for?',
    'Del oficio': 'From the trade',

    /* --- Ficha de casilla --- */
    'Zona de especial conservación': 'Special conservation area',
    'hábitat de fauna': 'wildlife habitat',
    'flora protegida': 'protected flora',
    'Entorno protegido por el Estado. No se puede construir ni tender redes: hay que rodearla. Y si tus lixiviados la alcanzan, multa de {0} €/h por casilla dañada mientras dure el daño.':
      'Protected by the State. No building, no networks: you go around it. And if your leachate reaches it, a fine of {0} €/h per damaged tile for as long as the damage lasts.',
    'Terreno llano': 'Flat land',
    'Arbolado': 'Woodland',
    'Relieve': 'High ground',
    'Masa de agua': 'Body of water',
    'obra': 'works',
    'Destapar': 'Uncover',
    'Aquí cabe: <b>{0}</b>.': 'Fits here: <b>{0}</b>.',
    'Aquí no cabe ninguna instalación.': 'No facility fits here.',

    /* --- Subsuelo --- */
    'Sondeo con agua · {0}': 'Borehole with water · {0}',
    'Caudal sostenible': 'Sustainable yield',
    'Pide el pozo': 'The well asks for',
    'Piden los pozos': 'The wells ask for',
    'Está dando': 'It is giving',
    'Construye aquí el pozo y engánchalo a la red para que cuente.':
      'Build the well here and hook it to the network so it counts.',
    'Sacas más de lo que entra: el nivel baja y el pozo da cada vez menos. Y no lo arregla otro pozo — el acuífero acaba entregando lo que le devuelve la lluvia y nada más; lo único que consigues perforando otra vez es tener el nivel por los suelos.':
      'You draw more than comes in: the level drops and the well yields less and less. Another well will not fix it — the aquifer ends up delivering what the rain returns and nothing more; all you get by drilling again is a level through the floor.',
    'Extracción sostenible: entra tanto como sale y el nivel aguanta.':
      'Sustainable extraction: as much comes in as goes out, and the level holds.',
    'Sondeo seco': 'Dry borehole',
    'Aquí se perforó y no había nada. Un punto descartado también es información: el acuífero, si lo hay, está en otro sitio.':
      'Someone drilled here and found nothing. A ruled-out spot is information too: the aquifer, if there is one, is somewhere else.',
    'Perforar un sondeo': 'Drill a borehole',
    'Con indicios favorables: aquí es donde hay que probar.':
      'With favourable signs: this is where to try.',
    'Sin indicios, es una apuesta cara: casi siempre sale seco.':
      'Without signs it is an expensive bet: it almost always comes up dry.',
    'Subsuelo sin estudiar': 'Unsurveyed ground',
    'Nadie ha mirado qué hay debajo. El estudio cubre {0}×{1} casillas y dice dónde hay indicios de agua — que no es lo mismo que encontrarla.':
      'Nobody has looked underneath. The survey covers {0}×{1} tiles and says where there are signs of water — which is not the same as finding it.',
    'Estudio hidrogeológico': 'Hydrogeological survey',
    'Cartografía y geofísica de la zona.': 'Mapping and geophysics of the area.',
    'Indicios de agua': 'Signs of water',
    'La geología promete: formación permeable y estructura favorable. No garantiza nada — hay que perforar para saberlo.':
      'The geology is promising: permeable formation, favourable structure. It guarantees nothing — you have to drill to know.',
    'Estudiado · sin indicios': 'Surveyed · no signs',
    'Terreno impermeable. Perforar aquí sería tirar el dinero.':
      'Impermeable ground. Drilling here would be throwing money away.',

    /* --- Almacén y pestañas --- */
    'Rescatada. Colócala donde quieras.': 'Salvaged. Place it wherever you like.',
    'gratis': 'free',
    'Incorpora {0} núcleos más para abrir el siguiente anillo':
      'Bring in {0} more towns to open the next ring',
    'fase {0} · faltan {1}': 'phase {0} · {1} to go',

    /* --- Tienda --- */
    'Otras mejoras': 'Other upgrades',
    'de serie': 'built in',
    'en marcha': 'running',
    'con el tercer pueblo': 'with the third town',
    'desde {0} hab': 'from {0} people',
    'cerrado': 'closed',
    'Nv {0}': 'Lv {0}',
    'AL MÁXIMO': 'MAXED OUT',

    /* --- Auto-bombeo --- */
    'ACTIVO': 'ACTIVE',
    'La bomba trabaja sola ✓': 'The pump works on its own ✓',
    'DISPONIBLE': 'AVAILABLE',
    'BLOQUEADO': 'LOCKED',
    'Activar · {0} €': 'Activate · {0} €',
    'Cumple los requisitos para activarlo': 'Meet the requirements to activate it',
    'Potencia de bomba Nv {0}': 'Pump power Lv {0}',
    'Captación Nv {0}': 'Intake Lv {0}',
    '{0} habitantes': '{0} people',

    /* --- Averías --- */
    '{0} · fuera de servicio': '{0} · out of service',
    'Instalación': 'Facility',
    'Está fuera de servicio y no cuenta en la red. Ve hasta ella y clica encima: {0}, a {1} € cada uno.':
      'It is out of service and does not count in the network. Go to it and click on it: {0}, at {1} € each.',
    'le falta <b>1</b> golpe de llave': 'it needs <b>1</b> more turn of the wrench',
    'le faltan <b>{0}</b> golpes de llave': 'it needs <b>{0}</b> more turns of the wrench',
    'ir ahí →': 'go there →',
    'Repararla a mano': 'Repair it by hand',
    'Monta el tramo antes de que llegue el agua y queda arreglada GRATIS. Un solo intento: si se derrama, a golpe de llave.':
      'Assemble the stretch before the water arrives and it is fixed for FREE. One attempt only: if it spills, back to the wrench.',

    /* --- Cauce y HUD --- */
    '{0}% sucio': '{0}% dirty',
    '{0} hab': '{0} people',

    /* --- Panel del pueblo --- */
    'Avería sin reparar': 'Unrepaired breakdown',
    'Creciendo ▲': 'Growing ▲',
    'Ganándose la confianza…': 'Earning their trust…',
    'Despoblándose ▼': 'Emptying out ▼',
    'Estable': 'Stable',
    '· estiaje': ' · low flow',
    '· deshielo': ' · snowmelt',
    'Sin depósito': 'No tank',
    'Nivel {0} · {1} L': 'Level {0} · {1} L',
    'Depuradora Nv {0}': 'Sewage works Lv {0}',
    'SIN depurar ⚠': 'NOT treated ⚠',
    'Aún no genera': 'None produced yet',
    'Lluvia': 'Rain',
    'Pluviales': 'Storm drains',
    'Nivel {0}': 'Level {0}',
    'Sin separar ⚠': 'Not separated ⚠',
    'Tanque tormentas': 'Storm tank',
    '{0} % lleno': '{0} % full',
    '· ALIVIANDO': ' · OVERFLOWING',
    'Calidad': 'Quality',
    'Basura': 'Rubbish',
    'Se recicla': 'Recycled',
    'Venta de material': 'Material sales',
    'Sin recoger': 'Uncollected',
    'Pueblo': 'Town',
    'Tendencia': 'Trend',
    'Consumo ahora': 'Consumption now',
    'Captación': 'Intake',
    'Estación': 'Season',
    'Reserva': 'Reserve',
    'Saneamiento': 'Sewerage',

    /* --- Registro --- */
    'Sin novedades.': 'Nothing to report.',
    '{0} h': '{0} h'
  }
};
