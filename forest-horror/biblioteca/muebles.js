/* Forest Horror — muebles procedurales 3D (Three.js r128).
 * Eje X = ancho, Y = altura, Z = fondo. Origen = centro de la huella, a nivel de suelo.
 * Coordenadas internas en pies, geometrías convertidas a metros (1 ft = 0.3048 m).
 * No agrega comportamientos al motor ni modifica los mapas existentes.
 */
(function (global) {
  'use strict';
  const FT = 0.3048;
  const CATALOG = {"schema":"forest-horror-furniture-catalog-v1","version":6,"units":{"length":"ft","metersPerFoot":0.3048,"defaultCanvasFt":{"width":3,"depth":3},"minWidthFt":0.25,"maxWidthFt":15,"sizeStepFt":0.25,"referenceMapFeetPerCell":5},"renderer":"Three.js r128","style":"low-poly / pixel art / terror doméstico","furniture":[{"id":"silla_madera","name":"Silla de madera","category":"Asientos","shortCode":"SI","widthFt":1.75,"depthFt":1.75,"heightFt":3.25,"blocksMovement":true,"description":"Asiento de madera desgastada, respaldo de travesaños y cuatro patas.","tags":["comedor","cocina","sala"],"glb":"modelos_glb/silla_madera.glb","thumbnail":"miniaturas/silla_madera.png","pack":"domestico_01"},{"id":"mesa_pequena","name":"Mesa pequeña","category":"Superficies","shortCode":"ME","widthFt":2.75,"depthFt":2.75,"heightFt":2.5,"blocksMovement":true,"description":"Mesa cuadrada de cuatro patas con tablones visibles en la superficie.","tags":["comedor","sala"],"glb":"modelos_glb/mesa_pequena.glb","thumbnail":"miniaturas/mesa_pequena.png","pack":"domestico_01"},{"id":"buro","name":"Buró de dos cajones","category":"Almacenamiento","shortCode":"BU","widthFt":1.75,"depthFt":1.5,"heightFt":2.0,"blocksMovement":true,"description":"Buró compacto con dos cajones, tiradores y madera oscurecida.","tags":["recámara"],"glb":"modelos_glb/buro.glb","thumbnail":"miniaturas/buro.png","pack":"domestico_01"},{"id":"estante_bajo","name":"Estante bajo","category":"Almacenamiento","shortCode":"ES","widthFt":2.75,"depthFt":1.25,"heightFt":3.5,"blocksMovement":true,"description":"Estante abierto de tres niveles con algunos objetos decorativos.","tags":["sala","pasillo"],"glb":"modelos_glb/estante_bajo.glb","thumbnail":"miniaturas/estante_bajo.png","pack":"domestico_01"},{"id":"cajonera","name":"Cajonera","category":"Almacenamiento","shortCode":"CA","widthFt":2.75,"depthFt":1.5,"heightFt":3.25,"blocksMovement":true,"description":"Cajonera de cuatro niveles con tiradores metálicos.","tags":["recámara","pasillo"],"glb":"modelos_glb/cajonera.glb","thumbnail":"miniaturas/cajonera.png","pack":"domestico_01"},{"id":"cama_individual","name":"Cama individual","category":"Descanso","shortCode":"CM","widthFt":3.25,"depthFt":6.5,"heightFt":2.75,"blocksMovement":true,"description":"Cama individual de cabecero alto, almohada y cobija envejecida.","tags":["recámara"],"glb":"modelos_glb/cama_individual.glb","thumbnail":"miniaturas/cama_individual.png","pack":"domestico_01"},{"id":"armario","name":"Armario de dos puertas","category":"Almacenamiento","shortCode":"AR","widthFt":4,"depthFt":2,"heightFt":6.75,"blocksMovement":true,"description":"Armario alto de dos puertas con paneles y herrajes.","tags":["recámara","pasillo"],"glb":"modelos_glb/armario.glb","thumbnail":"miniaturas/armario.png","pack":"domestico_01"},{"id":"sofa","name":"Sofá de tres plazas","category":"Asientos","shortCode":"SO","widthFt":6,"depthFt":2.75,"heightFt":3.0,"blocksMovement":true,"description":"Sofá viejo con cojines individuales, apoyabrazos y tela gastada.","tags":["sala"],"glb":"modelos_glb/sofa.glb","thumbnail":"miniaturas/sofa.png","pack":"domestico_01"},{"id":"mesa_cocina_cuadrada","name":"Mesa cuadrada de cocina","category":"Mesas y sillas","pack":"cocina_02","shortCode":"MC","widthFt":3,"depthFt":3,"heightFt":2.75,"blocksMovement":true,"description":"Mesa de madera envejecida con cuatro patas y uniones visibles.","tags":["cocina","comedor"],"glb":"modelos_glb/mesa_cocina_cuadrada.glb","thumbnail":"miniaturas/mesa_cocina_cuadrada.png"},{"id":"mesa_cocina_redonda","name":"Mesa redonda de comedor","category":"Mesas y sillas","pack":"cocina_02","shortCode":"MR","widthFt":3,"depthFt":3,"heightFt":2.75,"blocksMovement":true,"description":"Mesa circular de pedestal central y base radial de madera.","tags":["cocina","comedor"],"glb":"modelos_glb/mesa_cocina_redonda.glb","thumbnail":"miniaturas/mesa_cocina_redonda.png"},{"id":"mesa_cocina_rectangular","name":"Mesa rectangular de comedor","category":"Mesas y sillas","pack":"cocina_02","shortCode":"MT","widthFt":5.5,"depthFt":3,"heightFt":2.75,"blocksMovement":true,"description":"Mesa familiar de tablones y refuerzos de madera.","tags":["cocina","comedor"],"glb":"modelos_glb/mesa_cocina_rectangular.glb","thumbnail":"miniaturas/mesa_cocina_rectangular.png"},{"id":"silla_comedor","name":"Silla de comedor","category":"Mesas y sillas","pack":"cocina_02","shortCode":"SC","widthFt":1.75,"depthFt":1.75,"heightFt":3.25,"blocksMovement":true,"description":"Silla de travesaños con respaldo alto de madera.","tags":["cocina","comedor"],"glb":"modelos_glb/silla_comedor.glb","thumbnail":"miniaturas/silla_comedor.png"},{"id":"banco_cocina","name":"Banco de cocina","category":"Mesas y sillas","pack":"cocina_02","shortCode":"BC","widthFt":1.5,"depthFt":1.5,"heightFt":2.75,"blocksMovement":true,"description":"Banco redondo de cuatro patas y reposapiés.","tags":["cocina","barra"],"glb":"modelos_glb/banco_cocina.glb","thumbnail":"miniaturas/banco_cocina.png"},{"id":"silla_acolchada","name":"Silla acolchada retro","category":"Mesas y sillas","pack":"cocina_02","shortCode":"SA","widthFt":1.75,"depthFt":1.75,"heightFt":3.25,"blocksMovement":true,"description":"Silla de metal y vinilo gastado con asiento acolchado.","tags":["cocina","comedor"],"glb":"modelos_glb/silla_acolchada.glb","thumbnail":"miniaturas/silla_acolchada.png"},{"id":"gabinete_inferior","name":"Gabinete inferior doble","category":"Gabinetes","pack":"cocina_02","shortCode":"GI","widthFt":3,"depthFt":2.25,"heightFt":3,"blocksMovement":true,"description":"Módulo bajo de dos puertas con encimera y herrajes.","tags":["cocina","almacenamiento"],"glb":"modelos_glb/gabinete_inferior.glb","thumbnail":"miniaturas/gabinete_inferior.png"},{"id":"alacena_superior","name":"Alacena de pared","category":"Gabinetes","pack":"cocina_02","shortCode":"AL","widthFt":3,"depthFt":1.75,"heightFt":2.5,"blocksMovement":false,"description":"Gabinete alto para montaje en pared, con dos puertas.","tags":["cocina","almacenamiento","pared"],"glb":"modelos_glb/alacena_superior.glb","thumbnail":"miniaturas/alacena_superior.png","placement":"wall","mountHeightFt":4.25},{"id":"fregadero_mueble","name":"Fregadero con gabinete","category":"Gabinetes","pack":"cocina_02","shortCode":"FR","widthFt":3,"depthFt":2.5,"heightFt":3.75,"blocksMovement":true,"description":"Fregadero con cubeta metálica, grifo y puertas inferiores.","tags":["cocina","agua"],"glb":"modelos_glb/fregadero_mueble.glb","thumbnail":"miniaturas/fregadero_mueble.png"},{"id":"despensa_alta","name":"Despensa alta","category":"Gabinetes","pack":"cocina_02","shortCode":"DP","widthFt":3,"depthFt":2.25,"heightFt":7,"blocksMovement":true,"description":"Alacena de suelo a techo con paneles y doble hoja.","tags":["cocina","almacenamiento"],"glb":"modelos_glb/despensa_alta.glb","thumbnail":"miniaturas/despensa_alta.png"},{"id":"barra_cocina","name":"Barra desayunadora","category":"Gabinetes","pack":"cocina_02","shortCode":"BR","widthFt":5,"depthFt":2.5,"heightFt":3.75,"blocksMovement":true,"description":"Barra alargada con voladizo para bancos y cubierta mineral.","tags":["cocina","comedor"],"glb":"modelos_glb/barra_cocina.glb","thumbnail":"miniaturas/barra_cocina.png"},{"id":"encimera_simple","name":"Encimera modular","category":"Gabinetes","pack":"cocina_02","shortCode":"EN","widthFt":3,"depthFt":2.25,"heightFt":3,"blocksMovement":true,"description":"Módulo bajo de cocina con cubierta lisa para alinear con otros.","tags":["cocina","modular"],"glb":"modelos_glb/encimera_simple.glb","thumbnail":"miniaturas/encimera_simple.png"},{"id":"refrigerador","name":"Refrigerador retro","category":"Electrodomésticos","pack":"cocina_02","shortCode":"RF","widthFt":3,"depthFt":3.0,"heightFt":6.5,"blocksMovement":true,"description":"Refrigerador de dos puertas con agarraderas de metal.","tags":["cocina","eléctrico"],"glb":"modelos_glb/refrigerador.glb","thumbnail":"miniaturas/refrigerador.png"},{"id":"estufa_horno","name":"Estufa con horno","category":"Electrodomésticos","pack":"cocina_02","shortCode":"EH","widthFt":3,"depthFt":2.75,"heightFt":3.5,"blocksMovement":true,"description":"Estufa de cuatro quemadores, perillas y puerta de horno.","tags":["cocina","cocción"],"glb":"modelos_glb/estufa_horno.glb","thumbnail":"miniaturas/estufa_horno.png"},{"id":"microondas","name":"Microondas antiguo","category":"Electrodomésticos","pack":"cocina_02","shortCode":"MW","widthFt":2,"depthFt":1.75,"heightFt":1.25,"blocksMovement":false,"description":"Horno microondas con visor oscuro, botones y ventilación lateral.","tags":["cocina","eléctrico","encimera"],"glb":"modelos_glb/microondas.glb","thumbnail":"miniaturas/microondas.png","placement":"surface"},{"id":"campana_extractora","name":"Campana extractora","category":"Electrodomésticos","pack":"cocina_02","shortCode":"CE","widthFt":3,"depthFt":2,"heightFt":1.75,"blocksMovement":false,"description":"Extractor metálico de pared sobre estufa con filtro inferior.","tags":["cocina","eléctrico","pared"],"glb":"modelos_glb/campana_extractora.glb","thumbnail":"miniaturas/campana_extractora.png","placement":"wall","mountHeightFt":4.75},{"id":"cafetera","name":"Cafetera de filtro","category":"Utensilios","pack":"cocina_02","shortCode":"CF","widthFt":1,"depthFt":1,"heightFt":1.75,"blocksMovement":false,"description":"Cafetera de goteo retro con jarra y base calefactora.","tags":["cocina","encimera"],"glb":"modelos_glb/cafetera.glb","thumbnail":"miniaturas/cafetera.png","placement":"surface"},{"id":"tostadora","name":"Tostadora de dos ranuras","category":"Utensilios","pack":"cocina_02","shortCode":"TO","widthFt":1.5,"depthFt":0.75,"heightFt":1.0,"blocksMovement":false,"description":"Tostadora metálica compacta con dos ranuras y palanca.","tags":["cocina","encimera"],"glb":"modelos_glb/tostadora.glb","thumbnail":"miniaturas/tostadora.png","placement":"surface"},{"id":"olla","name":"Olla con tapa","category":"Utensilios","pack":"cocina_02","shortCode":"OL","widthFt":1.0,"depthFt":0.75,"heightFt":1.0,"blocksMovement":false,"description":"Olla metálica de dos asas y tapa.","tags":["cocina","encimera"],"glb":"modelos_glb/olla.glb","thumbnail":"miniaturas/olla.png","placement":"surface"},{"id":"sarten","name":"Sartén","category":"Utensilios","pack":"cocina_02","shortCode":"ST","widthFt":1.75,"depthFt":1,"heightFt":0.5,"blocksMovement":false,"description":"Sartén plana con mango de madera oscuro.","tags":["cocina","encimera"],"glb":"modelos_glb/sarten.glb","thumbnail":"miniaturas/sarten.png","placement":"surface"},{"id":"platos_apilados","name":"Platos apilados","category":"Utensilios","pack":"cocina_02","shortCode":"PL","widthFt":1,"depthFt":1,"heightFt":0.5,"blocksMovement":false,"description":"Cuatro platos de cerámica apilados con bordes visibles.","tags":["cocina","encimera"],"glb":"modelos_glb/platos_apilados.glb","thumbnail":"miniaturas/platos_apilados.png","placement":"surface"},{"id":"vasos","name":"Pareja de vasos","category":"Utensilios","pack":"cocina_02","shortCode":"VA","widthFt":0.75,"depthFt":0.5,"heightFt":0.75,"blocksMovement":false,"description":"Dos vasos pixelados con bordes y bases visibles.","tags":["cocina","encimera"],"glb":"modelos_glb/vasos.glb","thumbnail":"miniaturas/vasos.png","placement":"surface"},{"id":"tabla_cortar","name":"Tabla de cortar","category":"Utensilios","pack":"cocina_02","shortCode":"TC","widthFt":1.25,"depthFt":0.75,"heightFt":0.25,"blocksMovement":false,"description":"Tabla de madera con asa y marcas de uso.","tags":["cocina","encimera"],"glb":"modelos_glb/tabla_cortar.glb","thumbnail":"miniaturas/tabla_cortar.png","placement":"surface"},{"id":"cubiertos","name":"Juego de cubiertos","category":"Utensilios","pack":"cocina_02","shortCode":"CU","widthFt":0.75,"depthFt":0.5,"heightFt":0.25,"blocksMovement":false,"description":"Cubiertos de metal sobre servilleta de tela.","tags":["cocina","encimera"],"glb":"modelos_glb/cubiertos.glb","thumbnail":"miniaturas/cubiertos.png","placement":"surface"},{"id":"recipientes","name":"Recipientes de cocina","category":"Utensilios","pack":"cocina_02","shortCode":"RC","widthFt":1.5,"depthFt":1.25,"heightFt":1,"blocksMovement":false,"description":"Conjunto de recipientes cerámicos y caja de conservas.","tags":["cocina","encimera"],"glb":"modelos_glb/recipientes.glb","thumbnail":"miniaturas/recipientes.png","placement":"surface"},{"id":"caja_carton_pequena","name":"Caja de cartón pequeña","category":"Paquetería","pack":"delivery_03","shortCode":"P1","widthFt":2.5,"depthFt":2.5,"heightFt":2.5,"sizeTiles":{"width":0.5,"depth":0.5,"height":0.5},"parcelSize":"pequena","blocksMovement":true,"description":"Caja de cartón sellada con cinta y etiqueta impresas en textura pixel art. Geometría de 12 triángulos.","tags":["caja","delivery","paquete","envío","cartón"],"glb":"modelos_glb/caja_carton_pequena.glb","thumbnail":"miniaturas/caja_carton_pequena.png","texture":"texturas_carton/caja_carton_pequena.png","placement":"floor"},{"id":"caja_carton_mediana","name":"Caja de cartón mediana","category":"Paquetería","pack":"delivery_03","shortCode":"P2","widthFt":5,"depthFt":5,"heightFt":5,"sizeTiles":{"width":1,"depth":1,"height":1},"parcelSize":"mediana","blocksMovement":true,"description":"Caja de cartón sellada con cinta y etiqueta impresas en textura pixel art. Geometría de 12 triángulos.","tags":["caja","delivery","paquete","envío","cartón"],"glb":"modelos_glb/caja_carton_mediana.glb","thumbnail":"miniaturas/caja_carton_mediana.png","texture":"texturas_carton/caja_carton_mediana.png","placement":"floor"},{"id":"caja_carton_grande","name":"Caja de cartón grande (alta)","category":"Paquetería","pack":"delivery_03","shortCode":"P3","widthFt":5,"depthFt":5,"heightFt":10,"sizeTiles":{"width":1,"depth":1,"height":2},"parcelSize":"grande","blocksMovement":true,"description":"Caja de cartón sellada con cinta y etiqueta impresas en textura pixel art. Geometría de 12 triángulos.","tags":["caja","delivery","paquete","envío","cartón"],"glb":"modelos_glb/caja_carton_grande.glb","thumbnail":"miniaturas/caja_carton_grande.png","texture":"texturas_carton/caja_carton_grande.png","placement":"floor"},{"id":"escritorio_clasico","name":"Escritorio clásico","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"EC","widthFt":4.5,"depthFt":2.5,"heightFt":2.75,"blocksMovement":true,"description":"Escritorio de madera con cajones laterales y espacio para las piernas.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/escritorio_clasico.glb","thumbnail":"miniaturas/escritorio_clasico.png","placement":"floor"},{"id":"escritorio_pc","name":"Escritorio para computadora","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"EP","widthFt":4.25,"depthFt":2.5,"heightFt":3.75,"blocksMovement":true,"description":"Mesa de computadora de los años noventa con bandeja para teclado y repisa.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/escritorio_pc.glb","thumbnail":"miniaturas/escritorio_pc.png","placement":"floor"},{"id":"escritorio_l","name":"Escritorio en L","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"EL","widthFt":6.5,"depthFt":5,"heightFt":2.75,"blocksMovement":true,"description":"Escritorio de esquina con dos alas y patas de metal.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/escritorio_l.glb","thumbnail":"miniaturas/escritorio_l.png","placement":"floor"},{"id":"silla_oficina","name":"Silla de oficina giratoria","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"SG","widthFt":2.25,"depthFt":2.25,"heightFt":4,"blocksMovement":true,"description":"Silla acolchada de oficina con respaldo y base de cinco apoyos.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/silla_oficina.glb","thumbnail":"miniaturas/silla_oficina.png","placement":"floor"},{"id":"silla_plegable","name":"Silla plegable metálica","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"SP","widthFt":1.75,"depthFt":1.75,"heightFt":3.25,"blocksMovement":true,"description":"Silla de tubo pintado y asiento plegable.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/silla_plegable.glb","thumbnail":"miniaturas/silla_plegable.png","placement":"floor"},{"id":"archivero_metalico","name":"Archivero metálico","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"AM","widthFt":1.75,"depthFt":2,"heightFt":4,"blocksMovement":true,"description":"Archivero con tres cajones rotulados y tiradores.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/archivero_metalico.glb","thumbnail":"miniaturas/archivero_metalico.png","placement":"floor"},{"id":"lampara_escritorio","name":"Lámpara de escritorio","category":"Mobiliario","pack":"oficina_electronica_04","shortCode":"LE","widthFt":1.5,"depthFt":1.5,"heightFt":1.75,"blocksMovement":false,"description":"Lámpara metálica articulada con pantalla cónica simplificada.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/lampara_escritorio.glb","thumbnail":"miniaturas/lampara_escritorio.png","placement":"surface"},{"id":"monitor_crt","name":"Monitor CRT","category":"Computadoras","pack":"oficina_electronica_04","shortCode":"MC","widthFt":2,"depthFt":1.5,"heightFt":1.75,"blocksMovement":false,"description":"Monitor de tubo beige con pantalla oscura verdosa.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/monitor_crt.glb","thumbnail":"miniaturas/monitor_crt.png","placement":"surface"},{"id":"gabinete_pc","name":"Gabinete de PC","category":"Computadoras","pack":"oficina_electronica_04","shortCode":"GP","widthFt":0.75,"depthFt":1.75,"heightFt":2,"blocksMovement":false,"description":"Torre de computadora beige con disquetera, ranuras y testigos.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/gabinete_pc.glb","thumbnail":"miniaturas/gabinete_pc.png","placement":"floor"},{"id":"teclado_pc","name":"Teclado retro","category":"Computadoras","pack":"oficina_electronica_04","shortCode":"TP","widthFt":1.5,"depthFt":0.75,"heightFt":0.25,"blocksMovement":false,"description":"Teclado beige de perfil bajo con teclas pixeladas.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/teclado_pc.glb","thumbnail":"miniaturas/teclado_pc.png","placement":"surface"},{"id":"mouse_pc","name":"Ratón con cable","category":"Computadoras","pack":"oficina_electronica_04","shortCode":"MP","widthFt":0.5,"depthFt":0.75,"heightFt":0.25,"blocksMovement":false,"description":"Ratón de bola antiguo con botones diferenciados.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/mouse_pc.glb","thumbnail":"miniaturas/mouse_pc.png","placement":"surface"},{"id":"impresora_matricial","name":"Impresora matricial","category":"Computadoras","pack":"oficina_electronica_04","shortCode":"IM","widthFt":2.5,"depthFt":2,"heightFt":1.25,"blocksMovement":false,"description":"Impresora antigua con papel continuo y carcasa gris.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/impresora_matricial.glb","thumbnail":"miniaturas/impresora_matricial.png","placement":"surface"},{"id":"telefono_fijo","name":"Teléfono fijo","category":"Telefonía","pack":"oficina_electronica_04","shortCode":"TF","widthFt":1.5,"depthFt":1.25,"heightFt":0.75,"blocksMovement":false,"description":"Teléfono alámbrico de escritorio con auricular y teclado.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/telefono_fijo.glb","thumbnail":"miniaturas/telefono_fijo.png","placement":"surface"},{"id":"telefono_pared","name":"Teléfono de pared","category":"Telefonía","pack":"oficina_electronica_04","shortCode":"TW","widthFt":1,"depthFt":0.75,"heightFt":2,"blocksMovement":false,"description":"Teléfono de pared vertical con auricular al costado.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/telefono_pared.glb","thumbnail":"miniaturas/telefono_pared.png","placement":"wall","mountHeightFt":3.75},{"id":"contestadora","name":"Contestadora de casete","category":"Telefonía","pack":"oficina_electronica_04","shortCode":"CT","widthFt":1.5,"depthFt":1.25,"heightFt":0.75,"blocksMovement":false,"description":"Contestadora con pantalla, controles y tapa del casete.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/contestadora.glb","thumbnail":"miniaturas/contestadora.png","placement":"surface"},{"id":"fax","name":"Fax de oficina","category":"Telefonía","pack":"oficina_electronica_04","shortCode":"FX","widthFt":2.25,"depthFt":2,"heightFt":1.25,"blocksMovement":false,"description":"Fax con bandeja de papel, ranura de salida y teclado.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/fax.glb","thumbnail":"miniaturas/fax.png","placement":"surface"},{"id":"televisor_crt","name":"Televisor CRT","category":"Electrónica retro","pack":"oficina_electronica_04","shortCode":"TV","widthFt":3,"depthFt":2.5,"heightFt":2.75,"blocksMovement":true,"description":"Televisor de tubo con gabinete gris, pantalla y dial.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/televisor_crt.glb","thumbnail":"miniaturas/televisor_crt.png","placement":"floor"},{"id":"videocasetera_vhs","name":"Videocasetera VHS","category":"Electrónica retro","pack":"oficina_electronica_04","shortCode":"VH","widthFt":2,"depthFt":1.5,"heightFt":0.5,"blocksMovement":false,"description":"Reproductor VHS con ranura frontal y mandos.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/videocasetera_vhs.glb","thumbnail":"miniaturas/videocasetera_vhs.png","placement":"surface"},{"id":"radio_portatil","name":"Radio portátil","category":"Electrónica retro","pack":"oficina_electronica_04","shortCode":"RP","widthFt":1.5,"depthFt":0.75,"heightFt":1,"blocksMovement":false,"description":"Radio de transistores con rejilla y dial.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/radio_portatil.glb","thumbnail":"miniaturas/radio_portatil.png","placement":"surface"},{"id":"grabadora_boombox","name":"Grabadora de casetes","category":"Electrónica retro","pack":"oficina_electronica_04","shortCode":"GB","widthFt":2.5,"depthFt":1,"heightFt":1.25,"blocksMovement":false,"description":"Boombox con dos altavoces, casetera central y asa.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/grabadora_boombox.glb","thumbnail":"miniaturas/grabadora_boombox.png","placement":"surface"},{"id":"reloj_digital","name":"Reloj digital","category":"Electrónica retro","pack":"oficina_electronica_04","shortCode":"RD","widthFt":1.25,"depthFt":0.75,"heightFt":0.75,"blocksMovement":false,"description":"Reloj LED de mesa con números y carcasa oscura.","tags":["oficina","electrónica","retro","terror"],"glb":"modelos_glb/reloj_digital.glb","thumbnail":"miniaturas/reloj_digital.png","placement":"surface"},{"id":"inodoro_clasico","name":"Inodoro clásico","category":"Sanitarios","shortCode":"IC","widthFt":2.25,"depthFt":2.5,"heightFt":3.0,"blocksMovement":true,"description":"Inodoro de porcelana beige con cisterna baja y asiento oscuro.","tags":["baño","noventas","terror"],"glb":"modelos_glb/inodoro_clasico.glb","thumbnail":"miniaturas/inodoro_clasico.png","pack":"banos_05","placement":"floor"},{"id":"inodoro_antiguo","name":"Inodoro de cisterna alta","category":"Sanitarios","shortCode":"IA","widthFt":2.25,"depthFt":2.75,"heightFt":5.25,"blocksMovement":true,"description":"Sanitario con depósito alto, bajante metálico y palanca retro.","tags":["baño","noventas","terror"],"glb":"modelos_glb/inodoro_antiguo.glb","thumbnail":"miniaturas/inodoro_antiguo.png","pack":"banos_05","placement":"floor"},{"id":"lavabo_pedestal","name":"Lavabo con pedestal","category":"Sanitarios","shortCode":"LP","widthFt":2.25,"depthFt":1.75,"heightFt":3.25,"blocksMovement":true,"description":"Lavamanos de cerámica con pedestal, grifo y desagüe.","tags":["baño","noventas","terror"],"glb":"modelos_glb/lavabo_pedestal.glb","thumbnail":"miniaturas/lavabo_pedestal.png","pack":"banos_05","placement":"floor"},{"id":"lavabo_gabinete","name":"Lavabo con gabinete","category":"Sanitarios","shortCode":"LG","widthFt":3.0,"depthFt":2.25,"heightFt":3.25,"blocksMovement":true,"description":"Encimera con cubeta, dos puertas y herrajes.","tags":["baño","noventas","terror"],"glb":"modelos_glb/lavabo_gabinete.glb","thumbnail":"miniaturas/lavabo_gabinete.png","pack":"banos_05","placement":"floor"},{"id":"mingitorio_pared","name":"Mingitorio de pared","category":"Sanitarios","shortCode":"MI","widthFt":1.75,"depthFt":1.25,"heightFt":2.5,"blocksMovement":false,"description":"Mingitorio mural de porcelana con tubería superior.","tags":["baño","noventas","terror"],"glb":"modelos_glb/mingitorio_pared.glb","thumbnail":"miniaturas/mingitorio_pared.png","pack":"banos_05","placement":"wall","mountHeightFt":1.0},{"id":"banera_clasica","name":"Bañera clásica","category":"Baños y duchas","shortCode":"BA","widthFt":5.75,"depthFt":2.75,"heightFt":2.25,"blocksMovement":true,"description":"Bañera recta con borde esmaltado, desagüe y grifería.","tags":["baño","noventas","terror"],"glb":"modelos_glb/banera_clasica.glb","thumbnail":"miniaturas/banera_clasica.png","pack":"banos_05","placement":"floor"},{"id":"banera_patas","name":"Bañera antigua con patas","category":"Baños y duchas","shortCode":"BP","widthFt":5.75,"depthFt":2.75,"heightFt":2.5,"blocksMovement":true,"description":"Bañera retro elevada con patas de metal y borde grueso.","tags":["baño","noventas","terror"],"glb":"modelos_glb/banera_patas.glb","thumbnail":"miniaturas/banera_patas.png","pack":"banos_05","placement":"floor"},{"id":"plato_ducha","name":"Plato de ducha","category":"Baños y duchas","shortCode":"PD","widthFt":3.0,"depthFt":3.0,"heightFt":0.5,"blocksMovement":true,"description":"Base cuadrada de ducha con canaleta y desagüe.","tags":["baño","noventas","terror"],"glb":"modelos_glb/plato_ducha.glb","thumbnail":"miniaturas/plato_ducha.png","pack":"banos_05","placement":"floor"},{"id":"cabina_ducha","name":"Cabina de ducha","category":"Baños y duchas","shortCode":"CD","widthFt":3.25,"depthFt":3.25,"heightFt":7.25,"blocksMovement":true,"description":"Cabina de paneles de vidrio ahumado, marcos y grifería.","tags":["baño","noventas","terror"],"glb":"modelos_glb/cabina_ducha.glb","thumbnail":"miniaturas/cabina_ducha.png","pack":"banos_05","placement":"floor"},{"id":"regadera_pared","name":"Regadera de pared","category":"Baños y duchas","shortCode":"RP","widthFt":1.5,"depthFt":1.0,"heightFt":2.0,"blocksMovement":false,"description":"Cabezal, brazo de metal y controles de regadera de pared.","tags":["baño","noventas","terror"],"glb":"modelos_glb/regadera_pared.glb","thumbnail":"miniaturas/regadera_pared.png","pack":"banos_05","placement":"wall","mountHeightFt":5.0},{"id":"espejo_rectangular","name":"Espejo rectangular","category":"Mobiliario de baño","shortCode":"ER","widthFt":2.5,"depthFt":0.25,"heightFt":3.0,"blocksMovement":false,"description":"Espejo de pared con marco metálico oxidado.","tags":["baño","noventas","terror"],"glb":"modelos_glb/espejo_rectangular.glb","thumbnail":"miniaturas/espejo_rectangular.png","pack":"banos_05","placement":"wall","mountHeightFt":3.5},{"id":"espejo_redondo","name":"Espejo redondo","category":"Mobiliario de baño","shortCode":"EO","widthFt":2.25,"depthFt":0.25,"heightFt":2.25,"blocksMovement":false,"description":"Espejo circular biselado de doce lados con marco antiguo.","tags":["baño","noventas","terror"],"glb":"modelos_glb/espejo_redondo.glb","thumbnail":"miniaturas/espejo_redondo.png","pack":"banos_05","placement":"wall","mountHeightFt":4.0},{"id":"botiquin_pared","name":"Botiquín de pared","category":"Mobiliario de baño","shortCode":"BT","widthFt":2.5,"depthFt":1.0,"heightFt":2.25,"blocksMovement":false,"description":"Armario colgado con espejo frontal, bisagras y manija.","tags":["baño","noventas","terror"],"glb":"modelos_glb/botiquin_pared.glb","thumbnail":"miniaturas/botiquin_pared.png","pack":"banos_05","placement":"wall","mountHeightFt":3.5},{"id":"gabinete_bano","name":"Gabinete de baño","category":"Mobiliario de baño","shortCode":"GB","widthFt":2.75,"depthFt":1.75,"heightFt":4.5,"blocksMovement":true,"description":"Gabinete alto para toallas con dos puertas y repisa abierta.","tags":["baño","noventas","terror"],"glb":"modelos_glb/gabinete_bano.glb","thumbnail":"miniaturas/gabinete_bano.png","pack":"banos_05","placement":"floor"},{"id":"toallero","name":"Toallero de pared","category":"Mobiliario de baño","shortCode":"TO","widthFt":2.5,"depthFt":0.5,"heightFt":0.75,"blocksMovement":false,"description":"Barra metálica con una toalla colgada.","tags":["baño","noventas","terror"],"glb":"modelos_glb/toallero.glb","thumbnail":"miniaturas/toallero.png","pack":"banos_05","placement":"wall","mountHeightFt":3.25},{"id":"portarrollos","name":"Portarrollos","category":"Mobiliario de baño","shortCode":"PR","widthFt":1.0,"depthFt":0.75,"heightFt":0.75,"blocksMovement":false,"description":"Soporte metálico con papel enrollado.","tags":["baño","noventas","terror"],"glb":"modelos_glb/portarrollos.glb","thumbnail":"miniaturas/portarrollos.png","pack":"banos_05","placement":"wall","mountHeightFt":2.0},{"id":"cesto_basura","name":"Cesto de basura","category":"Mobiliario de baño","shortCode":"CB","widthFt":1.5,"depthFt":1.5,"heightFt":2.0,"blocksMovement":true,"description":"Papelera metálica octagonal con aro oscuro.","tags":["baño","noventas","terror"],"glb":"modelos_glb/cesto_basura.glb","thumbnail":"miniaturas/cesto_basura.png","pack":"banos_05","placement":"floor"},{"id":"dispensador_jabon","name":"Dispensador de jabón","category":"Accesorios de baño","shortCode":"DJ","widthFt":0.5,"depthFt":0.5,"heightFt":0.75,"blocksMovement":false,"description":"Frasco de jabón líquido con bomba metálica.","tags":["baño","noventas","terror"],"glb":"modelos_glb/dispensador_jabon.glb","thumbnail":"miniaturas/dispensador_jabon.png","pack":"banos_05","placement":"surface"},{"id":"papel_higienico","name":"Rollo de papel higiénico","category":"Accesorios de baño","shortCode":"PH","widthFt":0.5,"depthFt":0.5,"heightFt":0.5,"blocksMovement":false,"description":"Rollo compacto de papel de baño.","tags":["baño","noventas","terror"],"glb":"modelos_glb/papel_higienico.glb","thumbnail":"miniaturas/papel_higienico.png","pack":"banos_05","placement":"surface"},{"id":"toallas_dobladas","name":"Toallas dobladas","category":"Accesorios de baño","shortCode":"TD","widthFt":1.0,"depthFt":1.0,"heightFt":0.5,"blocksMovement":false,"description":"Conjunto de dos toallas plegadas de distinto tono.","tags":["baño","noventas","terror"],"glb":"modelos_glb/toallas_dobladas.glb","thumbnail":"miniaturas/toallas_dobladas.png","pack":"banos_05","placement":"surface"},{"id":"camara_seguridad","name":"Cámara de seguridad giratoria","category":"Cámaras de seguridad","shortCode":"CS","pack":"seguridad_06","widthFt":1.75,"depthFt":2.0,"heightFt":1.25,"blocksMovement":false,"placement":"wall","mountHeightFt":7.0,"description":"Cámara analógica de vigilancia con soporte fijo y cabezal que puede barrer horizontalmente.","tags":["seguridad","vigilancia","pared","cámara","animación","electrónica","noventas"],"glb":"modelos_glb/camara_seguridad.glb","thumbnail":"miniaturas/camara_seguridad.png","rig":{"type":"transform","pivot":"CAM_YAW","axis":"Y","minDegrees":-48,"maxDegrees":48,"defaultDegrees":0,"animation":"Barrido_Seguridad","loopSeconds":7.2},"animationOptional":true}]};
  const LIST = Object.freeze(CATALOG.furniture.map(item => Object.freeze(item)));
  const BY_ID = new Map(LIST.map(item => [item.id, item]));
  const materialSets = new WeakMap();

  function assertDimensions(item) {
    if (!item) throw new Error('Mueble no registrado.');
    for (const key of ['widthFt', 'depthFt', 'heightFt']) {
      const n = item[key];
      if (!Number.isFinite(n) || n < 0.25 || Math.abs(n * 4 - Math.round(n * 4)) > 1e-8) {
        throw new Error('Medida inválida: ' + item.id + ' / ' + key);
      }
    }
    if (item.widthFt > 15) throw new Error('El ancho excede 15 ft: ' + item.id);
    return item;
  }

  // Patrón procedural de píxel real: 32 × 32 px; no usa texturas externas.
  function texture(THREE, main, alternate, seed, grain) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d', {alpha: false});
    let state = seed >>> 0;
    function random() { state = ((state * 1664525 + 1013904223) >>> 0); return state / 4294967296; }
    ctx.fillStyle = main;
    ctx.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        if (random() > 0.63) {
          ctx.globalAlpha = 0.12 + random() * 0.21;
          ctx.fillStyle = alternate;
          ctx.fillRect(x, y, random() > .7 ? 4 : 2, 2);
        }
      }
    }
    if (grain) {
      for (let k = 0; k < 16; k++) {
        const y = Math.floor(random() * 32);
        ctx.globalAlpha = 0.16 + random() * 0.2;
        ctx.fillStyle = alternate;
        ctx.fillRect(Math.floor(random() * 24), y, 3 + Math.floor(random() * 8), 1);
      }
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function materialPalette(THREE) {
    if (materialSets.has(THREE)) return materialSets.get(THREE);
    const opts = [
      ['wood', '#68513f', '#2e251f', 31, true],
      ['woodDark', '#42362f', '#171615', 62, true],
      ['woodLight', '#9b8060', '#3b3026', 63, true],
      ['edge', '#2b2826', '#171716', 35, false],
      ['metal', '#737978', '#2f3838', 87, false],
      ['metalDark', '#343b3c', '#101618', 77, false],
      ['fabric', '#56615d', '#212b2b', 42, false],
      ['fabricLight', '#737b70', '#353d37', 44, false],
      ['linen', '#a69a80', '#685c4c', 24, false],
      ['pillow', '#c9bea5', '#837660', 112, false],
      ['blanket', '#69614f', '#302e29', 53, false],
      ['rust', '#815b44', '#332b25', 83, false],
      ['paper', '#a48c6d', '#504233', 71, false],
      ['counter', '#75776a', '#323934', 126, false],
      ['enamel', '#aaa89a', '#6c6e64', 131, false],
      ['enamelLight', '#d1c9b5', '#8f9283', 137, false],
      ['metalLight', '#adb4ac', '#687772', 142, false],
      ['vinyl', '#515c55', '#1e2a28', 147, false],
      ['vinylLight', '#747a68', '#37483d', 152, false],
      ['glass', '#364b4c', '#1b282b', 159, false],
      ['ceramic', '#c6b99e', '#8e7968', 163, false],
      ['plastic', '#b4a88f', '#756e60', 167, false],
      ['plasticHi', '#d1c5aa', '#9f9078', 173, false],
      ['plasticDark', '#60635d', '#303a39', 179, false],
      ['screenOff', '#182b2d', '#0a1216', 181, false],
      ['screenLit', '#477a70', '#193f37', 191, false],
      ['phosphor', '#a2ba8c', '#4a7565', 193, false],
      ['keycap', '#9d9b8c', '#63635b', 197, false],
      ['redLed', '#a5533e', '#4f2424', 199, false],
      ['orangeLed', '#bd8756', '#6b4a35', 211, false],
      ['speaker', '#272f31', '#141b1b', 223, false],
      ['porcelain', '#d5cfbc', '#85877b', 229, false],
      ['porcelainShade', '#aaa99c', '#676a60', 233, false],
      ['bowlDark', '#505e59', '#253332', 239, false],
      ['chrome', '#9ea8a5', '#3f5554', 241, false],
      ['mirror', '#687e7c', '#263b3c', 251, false],
      ['glassFrost', '#7d9992', '#4a6765', 257, false],
      ['towelBlue', '#608284', '#2d555c', 263, false],
      ['towelCream', '#b1a58f', '#6c6155', 269, false],
      ['soap', '#7e9e8c', '#3c5c51', 271, false]
    ];
    const all = {};
    for (const [id, color, specks, seed, grain] of opts) {
      all[id] = new THREE.MeshLambertMaterial({map: texture(THREE, color, specks, seed, grain), flatShading: true});
    }
    materialSets.set(THREE, all);
    return all;
  }

  function helpers(THREE, group, m) {
    function box(w, h, d, x, y, z, mat, rz) {
      if (w <= 0 || h <= 0 || d <= 0) throw new Error('Parte sin volumen.');
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * FT, h * FT, d * FT), m[mat]);
      mesh.position.set(x * FT, y * FT, z * FT);
      if (rz) mesh.rotation.z = rz;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }
    function cylinder(radius, height, x, y, z, mat, segments=12) {
      if (radius <= 0 || height <= 0) throw new Error('Parte circular sin volumen.');
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * FT, radius * FT, height * FT, segments), m[mat]);
      mesh.position.set(x * FT, y * FT, z * FT);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }
    function knob(x, y, z, radius, mat) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * FT, radius * FT, .055 * FT, 8), m[mat]);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x * FT, y * FT, z * FT);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    }
    function legs(width, depth, topY, mat, thick) {
      const x = width / 2 - thick / 2 - .12;
      const z = depth / 2 - thick / 2 - .12;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(thick, topY, thick, sx * x, topY / 2, sz * z, mat);
      }
    }
    function drawerFront(w, h, x, y, frontZ, mat, handleMat) {
      box(w, h, .055, x, y, frontZ, mat);
      box(w - .15, .025, .022, x, y + h / 2 - .08, frontZ + .035, 'edge');
      knob(x, y, frontZ + .053, .068, handleMat || 'metal');
    }
    return {box, cylinder, knob, legs, drawerFront};
  }

  const builders = {
    silla_madera(h) {
      const {box} = h;
      for (const x of [-.67, .67]) {
        box(.23, 1.47, .23, x, .735, .65, 'woodDark');
        box(.23, 3.25, .23, x, 1.625, -.65, 'woodDark');
      }
      box(1.72, .20, 1.70, 0, 1.55, 0, 'wood');
      for (let x = -.54; x <= .55; x += .35) box(.018, .018, 1.50, x, 1.659, 0, 'woodLight');
      box(1.22, .37, .16, 0, 2.77, -.68, 'woodLight');
      box(1.26, .2, .15, 0, 2.15, -.68, 'wood');
      box(1.32, .12, .13, 0, .49, -.64, 'wood');
      box(1.32, .12, .13, 0, .49, .64, 'wood');
    },
    mesa_pequena(h) {
      const {box, legs} = h;
      legs(2.75, 2.75, 2.34, 'woodDark', .22);
      box(2.75, .18, 2.75, 0, 2.41, 0, 'wood');
      for (const x of [-.76, 0, .76]) box(.036, .018, 2.56, x, 2.488, 0, 'woodDark');
      box(2.3, .29, .11, 0, 2.15, 1.16, 'woodDark');
      box(2.3, .29, .11, 0, 2.15, -1.16, 'woodDark');
      box(.11, .29, 2.30, 1.16, 2.15, 0, 'woodDark');
      box(.11, .29, 2.30, -1.16, 2.15, 0, 'woodDark');
    },
    buro(h) {
      const {box, drawerFront} = h;
      box(1.68, 1.73, 1.38, 0, 1.04, -.055, 'woodDark');
      box(1.75, .13, 1.5, 0, 1.935, 0, 'wood');
      for (const y of [.79, 1.45]) drawerFront(1.48, .55, 0, y, .645, 'wood', 'metal');
      box(1.58, .14, 1.31, 0, .13, -.05, 'woodDark');
      for (const x of [-.62, .62]) box(.18, .19, .18, x, .095, .48, 'woodDark');
    },
    estante_bajo(h) {
      const {box} = h;
      for (const x of [-1.285, 1.285]) box(.18, 3.5, 1.25, x, 1.75, 0, 'woodDark');
      box(2.48, 3.32, .09, 0, 1.73, -.565, 'woodDark');
      for (const y of [.20, 1.25, 2.31, 3.37]) box(2.72, .17, 1.25, 0, y, 0, 'wood');
      // Objetos austeros: libros viejos y una caja de lata.
      const books = [['rust', -.92, .61, .20], ['paper', -.64, .67, .26], ['fabric', -.32, .65, .18]];
      for (const [mat, x, y, w] of books) box(w, .64, .76, x, y, -.12, mat);
      box(.58, .58, .76, .60, 1.62, -.08, 'metalDark');
      box(.48, .05, .76, .60, 1.92, -.08, 'metal');
      box(.70, .40, .72, -.65, 2.60, -.08, 'woodLight');
    },
    cajonera(h) {
      const {box, drawerFront} = h;
      box(2.68, 2.85, 1.35, 0, 1.67, -.06, 'woodDark');
      box(2.75, .14, 1.5, 0, 3.18, 0, 'wood');
      for (const y of [.64, 1.33, 2.02, 2.71]) {
        drawerFront(2.46, .59, 0, y, .625, 'wood', 'metalDark');
      }
      box(2.60, .15, 1.3, 0, .18, -.08, 'woodDark');
      for (const x of [-1.13, 1.13]) box(.2, .2, .22, x, .1, .44, 'woodDark');
    },
    cama_individual(h) {
      const {box} = h;
      const W = 3.25, D = 6.5;
      box(W, .45, D, 0, .78, 0, 'woodDark');
      const mattress = box(2.88, .43, 5.95, 0, 1.22, .0, 'linen');
      mattress.name = 'cama_colchon';
      box(2.84, .10, 3.42, 0, 1.49, 1.28, 'blanket');
      for (const x of [-1.49, 1.49]) {
        box(.23, 1.06, .23, x, .53, 3.03, 'woodDark');
        box(.23, 2.75, .23, x, 1.375, -3.03, 'woodDark');
      }
      box(3.04, 1.18, .21, 0, 2.05, -3.03, 'wood');
      box(2.76, .10, .07, 0, 2.39, -2.89, 'woodLight');
      // La almohada descansa SOBRE el colchón (cara superior del colchón: 1.435 ft).
      // Su ribete inferior y el cuerpo contrastan para que no parezca enterrada.
      box(2.53, .065, 1.09, 0, 1.468, -2.14, 'linen');
      const pillow = box(2.47, .36, 1.02, 0, 1.675, -2.14, 'pillow');
      pillow.name = 'cama_almohada';
      box(2.29, .018, .028, 0, 1.863, -1.72, 'linen');
      box(2.95, .33, .12, 0, 1.06, 3.07, 'wood');
      box(2.44, .08, .08, 0, 1.55, .22, 'woodDark');
    },
    armario(h) {
      const {box, knob} = h;
      box(3.94, 6.41, 1.81, 0, 3.34, -.065, 'woodDark');
      box(4, .18, 2, 0, 6.66, 0, 'wood');
      box(3.96, .24, 1.98, 0, .19, 0, 'wood');
      for (const sx of [-1, 1]) {
        const x = sx * .99;
        box(1.88, 5.98, .075, x, 3.48, .875, 'wood');
        box(1.40, 4.10, .033, x, 3.54, .924, 'woodDark');
        box(1.25, 3.92, .038, x, 3.54, .949, 'wood');
        box(.06, 5.89, .07, sx * 1.86, 3.46, .921, 'woodDark');
        knob(sx * .20, 3.38, .970, .09, 'metal');
      }
      box(3.70, .09, .07, 0, 6.24, .921, 'woodLight');
    },
    sofa(h) {
      const {box} = h;
      box(5.92, .62, 2.50, 0, .75, -.035, 'woodDark');
      for (const x of [-2.73, 2.73]) {
        box(.51, 1.67, 2.75, x, 1.52, 0, 'fabric');
        box(.53, .13, 2.75, x, 2.37, 0, 'fabricLight');
        box(.32, .15, .52, x, .22, .78, 'woodDark');
        box(.32, .15, .52, x, .22, -.77, 'woodDark');
      }
      box(5.34, 1.95, .42, 0, 2.025, -1.16, 'fabric');
      // Tres almohadillas independientes, con 0.07 ft entre asientos.
      // Antes los cojines extremos invadían los brazos y uno quedaba oculto.
      for (const [index, x] of [-1.60, 0, 1.60].entries()) {
        const seat = box(1.53, .49, 1.83, x, 1.43, .27, 'fabricLight');
        seat.name = 'sofa_cojin_asiento_' + (index + 1);
        box(1.43, .032, 1.70, x, 1.688, .27, 'fabricLight');
        box(1.38, .055, .065, x, 1.53, 1.206, 'fabric');
        const back = box(1.53, 1.18, .40, x, 2.15, -.84, 'fabricLight');
        back.name = 'sofa_cojin_respaldo_' + (index + 1);
      }
      box(5.13, .14, .11, 0, .31, 1.23, 'woodDark');
    },
    // PACK 02: Cocina. Todos los ejes y medidas se expresan en pies.
    mesa_cocina_cuadrada(h) {
      const {box,legs}=h;
      legs(3,3,2.36,'woodDark',.22);
      box(3,.14,3,0,2.43,0,'woodLight');
      for (const x of [-.92,-.3,.32,.94]) box(.022,.012,2.84,x,2.507,0,'woodDark');
      for (const z of [-1.2,1.2]) box(2.65,.26,.12,0,2.19,z,'wood');
      for (const x of [-1.2,1.2]) box(.12,.26,2.65,x,2.19,0,'wood');
    },
    mesa_cocina_redonda(h) {
      const {box,cylinder}=h;
      // Tablero circular real (16 lados), pedestal octogonal y cuatro pies radiales.
      cylinder(1.5,.17,0,2.415,0,'woodLight',16);
      cylinder(1.37,.035,0,2.518,0,'wood',16);
      cylinder(.32,2.28,0,1.14,0,'woodDark',8);
      cylinder(.51,.20,0,.16,0,'wood',12);
      for (const s of [-1,1]) {
        box(1.12,.17,.32,s*.65,.115,0,'woodDark');
        box(.32,.17,1.12,0,.115,s*.65,'woodDark');
      }
    },
    mesa_cocina_rectangular(h) {
      const {box,legs}=h;
      legs(5.5,3,2.34,'woodDark',.25);
      box(5.5,.16,3,0,2.42,0,'wood');
      for (const z of [-.93,-.31,.31,.93]) box(5.24,.019,.025,0,2.507,z,'woodDark');
      for (const z of [-1.2,1.2]) box(4.92,.27,.13,0,2.18,z,'woodDark');
      for (const x of [-2.38,2.38]) box(.13,.27,2.36,x,2.18,0,'woodDark');
      for (const x of [-1.52,0,1.52]) box(.15,.13,2.2,x,2.15,0,'woodLight');
    },
    silla_comedor(h) {
      const {box}=h;
      for (const x of [-.73,.73]) {
        box(.19,1.4,.19,x,.7,.69,'woodDark');
        box(.20,3.25,.20,x,1.625,-.69,'woodDark');
      }
      box(1.74,.20,1.72,0,1.44,0,'wood');
      box(1.54,.045,1.48,0,1.566,.07,'woodLight');
      box(1.39,.24,.16,0,3.04,-.70,'woodLight');
      for (const y of [2.22,2.64]) box(1.29,.15,.13,0,y,-.70,'wood');
      box(1.43,.12,.12,0,.48,-.69,'woodDark');
    },
    banco_cocina(h) {
      const {box,cylinder}=h;
      cylinder(.72,.18,0,2.41,0,'woodLight',12);
      for (const x of [-.51,.51]) for (const z of [-.51,.51]) {
        box(.16,2.30,.16,x,1.15,z,'woodDark');
      }
      for (const z of [-.51,.51]) box(1.16,.12,.12,0,.67,z,'wood');
      for (const x of [-.51,.51]) box(.12,.12,1.16,x,.67,0,'wood');
      cylinder(.12,.05,0,2.50,0,'wood',12);
    },
    silla_acolchada(h) {
      const {box}=h;
      for (const x of [-.73,.73]) {
        box(.18,1.42,.18,x,.71,.68,'metalDark');
        box(.18,3.22,.18,x,1.61,-.68,'metalDark');
      }
      box(1.69,.16,1.63,0,1.41,0,'woodDark');
      box(1.57,.29,1.53,0,1.58,.025,'vinyl');
      box(1.48,.10,1.40,0,1.785,.03,'vinylLight');
      box(1.52,1.25,.18,0,2.46,-.70,'vinyl');
      box(1.40,1.02,.15,0,2.47,-.58,'vinylLight');
      box(1.43,.10,.11,0,.47,-.68,'metal');
    },
    gabinete_inferior(h) {
      const {box,knob}=h;
      box(2.96,2.72,1.94,0,1.46,-.025,'woodDark');
      box(3,.16,2,0,2.92,0,'counter');
      box(2.68,.13,.12,0,.23,.88,'edge');
      for (const sx of [-1,1]) {
        const x=sx*.70;
        box(1.28,2.16,.055,x,1.42,.965,'wood');
        box(1.06,1.88,.025,x,1.43,.998,'woodLight');
        box(.085,1.99,.035,x+sx*.52,1.43,1.024,'woodDark');
        knob(x-sx*.46,1.58,1.047,.07,'metal');
      }
      for (const x of [-1.4,1.4]) box(.13,2.58,.14,x,1.42,.91,'woodLight');
    },
    alacena_superior(h) {
      const {box,knob}=h;
      box(2.94,2.44,1.44,0,1.25,-.035,'woodDark');
      box(3,.13,1.5,0,2.435,0,'wood');
      for (const sx of [-1,1]) {
        const x=sx*.71;
        box(1.34,2.20,.06,x,1.25,.72,'wood');
        box(1.04,1.84,.03,x,1.24,.759,'woodLight');
        box(.07,2.00,.03,x+sx*.56,1.25,.778,'woodDark');
        knob(x-sx*.46,.63,.809,.07,'metal');
      }
      box(3,.10,1.5,0,.05,0,'wood');
    },
    fregadero_mueble(h) {
      const {box,knob,cylinder}=h;
      box(2.96,2.64,2.12,0,1.44,-.025,'woodDark');
      box(3,.18,2.25,0,2.91,0,'counter');
      // Cubeta rectangular con borde, esmalte oscuro y hueco visual.
      box(2.05,.025,1.30,-.20,3.008,.11,'metalDark');
      for(const z of [-.57,.78]) box(2.12,.09,.095,-.20,3.02,z,'metal');
      for(const x of [-1.29,.89]) box(.09,.09,1.32,x,3.02,.10,'metal');
      box(1.85,.018,1.12,-.20,2.986,.10,'metal');
      cylinder(.11,.20,.65,3.08,-.79,'metal',10);
      box(.14,.43,.14,.65,3.28,-.80,'metal');
      box(.46,.12,.15,.47,3.46,-.80,'metal');
      box(.12,.10,.23,.30,3.43,-.67,'metal');
      for(const x of [-.73,.73]) {
        box(1.35,2.12,.055,x,1.44,1.048,'wood');
        box(1.10,1.88,.027,x,1.44,1.084,'woodLight');
        knob(x>0?.21:-.21,1.48,1.113,.067,'metal');
      }
      box(2.74,.15,.10,0,.21,1.02,'edge');
    },
    despensa_alta(h) {
      const {box,knob}=h;
      box(2.94,6.82,1.90,0,3.49,-.035,'woodDark');
      box(3,.16,2,0,6.92,0,'wood');
      box(3,.16,2,0,.08,0,'wood');
      for(const sx of [-1,1]){
        const x=sx*.735;
        box(1.42,6.28,.065,x,3.50,.956,'wood');
        for (const y of [1.75,5.18]){
          box(1.14,2.60,.029,x,y,.993,'woodLight');
          box(.07,2.72,.038,x+sx*.60,y,1.016,'woodDark');
        }
        knob(x-sx*.46,3.45,1.028,.075,'metal');
      }
      box(2.83,.12,.05,0,3.48,1.04,'edge');
    },
    barra_cocina(h) {
      const {box}=h;
      // Barra para dos bancos: faldón ciego y espacio libre bajo el voladizo.
      box(4.72,3.28,.32,0,1.64,-.83,'woodDark');
      box(.26,3.24,2.15,-2.33,1.62,-.05,'woodDark');
      box(.26,3.24,2.15,2.33,1.62,-.05,'woodDark');
      box(5,.18,2.5,0,3.41,0,'counter');
      box(4.88,.04,.06,0,3.52,1.17,'metal');
      for(const x of [-1.65,0,1.65]) box(.28,.10,.36,x,.22,.96,'woodDark');
      box(4.60,.14,.08,0,1.09,-.86,'wood');
    },
    encimera_simple(h) {
      const {box}=h;
      // Bloque modular de 3 ft que puede tocar gabinetes colindantes sin huecos.
      box(2.94,2.71,1.91,0,1.45,-.045,'woodDark');
      box(3,.17,2,0,2.915,0,'counter');
      for(const x of [-.79,.79]){
        box(1.32,2.07,.06,x,1.48,.952,'wood');
        box(.06,1.89,.04,x+.47,1.49,1.004,'woodLight');
      }
      box(2.72,.14,.10,0,.23,.937,'edge');
    },
    refrigerador(h) {
      const {box}=h;
      box(2.87,6.21,2.62,0,3.26,-.04,'enamel');
      box(2.92,.14,2.69,0,6.43,-.025,'metal');
      box(2.88,2.12,.10,0,5.23,1.31,'enamelLight');
      box(2.88,3.78,.10,0,2.15,1.31,'enamelLight');
      box(2.72,.05,.12,0,4.13,1.38,'metalDark');
      box(.13,.90,.13,-1.08,5.23,1.41,'metal');
      box(.13,1.39,.13,-1.08,2.58,1.41,'metal');
      box(2.64,.10,.06,0,.31,1.35,'metalDark');
      for(const x of [-.97,.97]) box(.21,.12,.22,x,.06,.81,'metalDark');
      box(.54,.06,.027,.89,6.17,1.37,'rust');
    },
    estufa_horno(h) {
      const {box,knob,cylinder}=h;
      box(2.92,2.85,2.38,0,1.53,-.02,'enamel');
      box(3,.16,2.5,0,3.04,0,'metal');
      box(3,.42,.20,0,3.29,-1.14,'metalDark');
      box(2.53,1.54,.09,0,1.59,1.20,'metalDark');
      box(2.14,1.19,.023,0,1.60,1.257,'glass');
      box(2.24,.09,.12,0,2.31,1.31,'metal');
      box(2.46,.33,.07,0,2.72,1.23,'enamelLight');
      for(const x of [-1.05,-.36,.36,1.05]) knob(x,2.72,1.29,.095,'metalDark');
      for(const x of [-.80,.80]) for(const z of [-.67,.52]){
        cylinder(.37,.035,x,3.14,z,'metalDark',12);
        cylinder(.22,.038,x,3.166,z,'metal',12);
        box(.64,.04,.07,x,3.20,z,'edge');
        box(.07,.04,.64,x,3.20,z,'edge');
      }
      box(2.62,.12,.10,0,.28,1.20,'metalDark');
    },
    microondas(h) {
      const {box}=h;
      box(2,1.13,1.5,0,.635,0,'enamel');
      box(1.55,.84,.055,-.17,.64,.761,'metalDark');
      box(1.30,.65,.03,-.18,.65,.799,'glass');
      box(.22,.94,.052,.81,.64,.763,'metal');
      for(const y of [.83,.52]) box(.105,.105,.04,.81,y,.796,'metalDark');
      box(1.90,.08,.08,0,.12,.69,'enamelLight');
      for(const x of [-.70,.7]) box(.13,.08,.14,x,.04,.51,'metalDark');
      for(let z=-.46;z<=.47;z+=.18) box(.025,.32,.09,.95,.76,z,'metalDark');
    },
    campana_extractora(h) {
      const {box}=h;
      box(1.12,1.08,.73,0,1.20,-.40,'metal');
      box(3,.19,2,0,.25,0,'metal');
      box(2.72,.13,1.77,0,.39,.01,'enamel');
      box(2.24,.035,1.28,0,.131,.09,'metalDark');
      for(const x of [-.86,.86]) box(.42,.03,1.04,x,.106,.07,'edge');
      box(1.18,.24,.77,0,1.61,-.40,'metalDark');
      box(2.82,.09,.11,0,.10,.94,'enamelLight');
      for(const x of [.55,.79,1.03]) box(.07,.05,.07,x,.45,.84,'metalDark');
    },
    cafetera(h) {
      const {box,cylinder}=h;
      box(.89,.68,.86,0,1.13,-.05,'enamel');
      box(.97,.16,.94,0,.18,-.03,'metalDark');
      box(.64,.08,.45,0,1.46,-.19,'metalDark');
      cylinder(.29,.58,0,.62,.10,'glass',12);
      cylinder(.32,.08,0,.90,.10,'metalDark',12);
      box(.17,.34,.12,.37,.63,.11,'metal');
      box(.29,.09,.14,0,1.46,-.15,'rust');
      box(.29,.12,.12,0,.14,.37,'metal');
    },
    tostadora(h) {
      const {box}=h;
      box(1.20,.67,.72,0,.37,0,'enamel');
      box(1.25,.08,.75,0,.71,0,'enamelLight');
      for(const z of [-.18,.18]){
        box(.89,.018,.11,0,.760,z,'metalDark');
        box(.75,.009,.045,0,.772,z,'edge');
      }
      box(.09,.21,.10,.62,.40,.15,'metalDark');
      box(.21,.08,.14,.59,.50,.15,'metal');
      for(const x of [-.48,.48]) box(.15,.08,.13,x,.04,.21,'metalDark');
    },
    olla(h) {
      const {box,cylinder}=h;
      cylinder(.34,.51,0,.33,0,'metal',12);
      cylinder(.37,.07,0,.64,0,'metalDark',12);
      cylinder(.31,.035,0,.69,0,'metal',12);
      cylinder(.07,.07,0,.75,0,'woodDark',8);
      for(const x of [-.39,.39]) box(.14,.13,.19,x,.48,0,'metalDark');
    },
    sarten(h) {
      const {box,cylinder}=h;
      cylinder(.46,.16,-.28,.21,0,'metalDark',12);
      cylinder(.42,.025,-.28,.305,0,'metal',12);
      box(.69,.09,.15,.43,.24,0,'woodDark');
      box(.18,.14,.20,.08,.24,0,'metal');
      box(.14,.07,.08,.72,.24,0,'edge');
    },
    platos_apilados(h) {
      const {cylinder}=h;
      for(let i=0;i<4;i++){
        cylinder(.46,.045,0,.08+i*.09,0,'ceramic',16);
        cylinder(.39,.020,0,.116+i*.09,0,'enamelLight',16);
      }
    },
    vasos(h) {
      const {cylinder}=h;
      for(const x of [-.18,.18]){
        cylinder(.15,.51,x,.33,0,'glass',10);
        cylinder(.16,.04,x,.61,0,'metal',10);
        cylinder(.11,.015,x,.067,0,'metalDark',10);
      }
    },
    tabla_cortar(h) {
      const {box,cylinder}=h;
      box(1.19,.16,.70,-.025,.09,0,'woodLight');
      box(.18,.15,.30,.52,.09,0,'woodLight');
      cylinder(.055,.019,.55,.172,0,'woodDark',8);
      for(const x of [-.31,.02]) box(.012,.012,.52,x,.177,.02,'wood');
    },
    cubiertos(h) {
      const {box}=h;
      box(.73,.035,.46,0,.029,0,'linen');
      for(const x of [-.24,-.08,.10,.26]){
        box(.05,.022,.28,x,.068,.02,'metal');
        box(.095,.025,.13,x,.075,-.12,'metal');
        if (x<0) for(const t of [-.028,0,.028]) box(.014,.015,.09,x+t,.085,-.19,'metalLight');
      }
    },
    recipientes(h) {
      const {box,cylinder}=h;
      for(const [x,y,r] of [[-.43,.27,.30],[.35,.22,.25]]){
        cylinder(r,.43,x,y,0,'ceramic',10);
        cylinder(r+.02,.05,x,.49,0,'enamelLight',10);
      }
      box(.43,.46,.40,0,.24,.40,'rust');
      box(.48,.04,.44,0,.49,.40,'metalDark');
    },

    escritorio_clasico(h) {
      const {box,knob}=h;
      box(4.50,.19,2.50,0,2.65,0,'wood');
      for(const x of [-1.62,1.62]){
        box(1.20,2.35,2.18,x,1.18,-.06,'woodDark');
        for(const y of [.72,1.52,2.27]) {
          box(1.06,.60,.06,x,y,1.07,'wood');
          knob(x,y,1.123,.075,'metal');
        }
      }
      box(2.30,.36,.10,0,2.36,-1.10,'woodDark');
      box(2.11,.11,.10,0,.40,-1.13,'wood');
      box(4.24,.055,.065,0,2.70,1.22,'woodLight');
    },
    escritorio_pc(h) {
      const {box}=h;
      const w=4.25;
      for(const x of [-1.96,1.96]) for(const z of [-.99,.99]) box(.18,2.49,.18,x,1.245,z,'metalDark');
      box(w,.16,2.50,0,2.48,0,'woodLight');
      box(3.65,.085,1.10,0,2.08,.66,'plasticDark');
      box(3.65,.07,1.04,0,2.145,.66,'plastic');
      for(const x of [-1.83,1.83]) box(.14,1.10,.14,x,3.12,-.96,'metalDark');
      box(4.1,.17,.75,0,3.66,-.87,'woodLight');
      box(2.2,.12,.10,0,1.04,-1.05,'metalDark');
      box(.84,2.18,1.82,1.53,1.09,-.13,'woodDark');
      box(.74,.12,1.80,1.54,2.12,-.13,'wood');
    },
    escritorio_l(h) {
      const {box}=h;
      box(6.50,.16,2.50,0,2.67,-1.24,'wood');
      box(2.40,.16,4.95,-2.05,2.67,.025,'wood');
      for(const [x,z] of [[-3.1,-2.3],[3.10,-2.3],[3.1,-.12],[-3.1,2.32],[-.98,2.32]])
        box(.18,2.56,.18,x,1.28,z,'metalDark');
      box(5.9,.21,.07,0,2.45,-2.32,'metal');
      box(.07,.21,4.5,-3.12,2.45,.025,'metal');
      box(1.60,.55,1.65,-2.02,.48,1.01,'woodDark');
    },
    silla_oficina(h) {
      const {box,cylinder}=h;
      cylinder(.23,1.20,0,1.03,0,'metalDark',10);
      cylinder(.43,.12,0,.19,0,'metal',10);
      for(const [x,z,rot] of [[-.78,0,0],[.78,0,0],[0,-.78,1],[0,.78,1]]) {
        box(rot?.18:1.55,.12,rot?1.55:.18,x?0:0,.18,z?0:0,'metalDark');
        cylinder(.09,.12,x,.085,z,'edge',8);
      }
      box(1.95,.31,1.77,0,1.91,.04,'vinyl');
      box(1.76,.09,1.58,0,2.10,-.02,'vinylLight');
      box(1.86,1.75,.27,0,3.04,-.78,'vinyl');
      box(1.68,1.52,.075,0,3.08,-.62,'vinylLight');
      for(const x of [-.98,.98]){
        box(.11,.80,.12,x,2.30,-.16,'metalDark');
        box(.24,.12,1.10,x,2.68,-.24,'plasticDark');
      }
    },
    silla_plegable(h) {
      const {box}=h;
      for(const x of [-.76,.76]){
        box(.09,3.19,.09,x,1.60,-.62,'metal');
        box(.09,1.55,.09,x,.78,.61,'metal');
        box(.10,.09,1.30,x,1.35,0,'metalDark');
      }
      box(1.56,.15,1.35,0,1.54,0,'plasticDark');
      box(1.52,.13,.16,0,3.11,-.61,'plastic');
      box(1.49,.61,.13,0,2.73,-.61,'plastic');
      box(1.5,.09,.10,0,.13,.59,'metalDark');
    },
    archivero_metalico(h) {
      const {box}=h;
      box(1.75,3.80,1.94,0,2.05,-.03,'metalDark');
      box(1.69,.10,1.95,0,3.95,-.02,'metal');
      for(const y of [.75,1.86,2.97]){
        box(1.58,.93,.05,0,y,.963,'metal');
        box(.66,.10,.056,0,y+.25, .955,'metalLight');
        box(.45,.18,.042,0,y-.22,.954,'plastic');
        box(1.56,.035,.065,0,y-.48,.954,'edge');
      }
      for(const x of [-.74,.74]) box(.11,.15,.11,x,.075,.70,'metalDark');
    },
    lampara_escritorio(h) {
      const {box,cylinder}=h;
      cylinder(.55,.10,0,.10,0,'metalDark',12);
      cylinder(.10,.12,0,.21,0,'metal',8);
      const stem=box(.12,.83,.12,-.17,.72,-.05,'metal');stem.rotation.z=.34;
      const arm=box(.12,.67,.12,.04,1.36,-.05,'metal');arm.rotation.z=-.48;
      cylinder(.35,.32,.25,1.57,0,'plasticDark',10);
      cylinder(.27,.038,.25,1.38,0,'plasticHi',10);
      box(.16,.065,.12,.33,.25,.30,'redLed');
    },
    monitor_crt(h) {
      const {box}=h;
      box(1.93,1.29,1.41,0,1.045,-.025,'plastic');
      box(1.66,1.00,.065,0,1.13,.68,'plasticDark');
      box(1.44,.80,.032,0,1.17,.716,'screenOff');
      box(.44,.045,.025,-.32,1.32,.735,'screenLit');
      box(.63,.018,.025,-.23,1.18,.738,'phosphor');
      box(.40,.018,.025,-.33,1.08,.738,'screenLit');
      box(1.91,.13,.13,0,.43,.63,'plasticHi');
      box(.53,.35,.49,0,.235,-.17,'plasticDark');
      box(1.20,.09,.92,0,.045,-.11,'plastic');
      box(.065,.05,.035,.71,.45,.708,'redLed');
    },
    gabinete_pc(h) {
      const {box}=h;
      box(.73,1.94,1.70,0,1.00,0,'plastic');
      box(.68,1.84,.035,0,1.02,.815,'plasticHi');
      box(.46,.065,.036,0,1.67,.837,'plasticDark');
      box(.44,.035,.03,0,1.43,.837,'edge');
      box(.48,.29,.035,0,.85,.837,'plasticDark');
      for(const y of [.55,.63])box(.47,.02,.031,0,y,.837,'edge');
      box(.13,.13,.045,.19,1.13,.836,'metalDark');
      box(.06,.06,.04,-.22,1.14,.836,'screenLit');
      for(const z of [-.48,.48]) box(.58,.06,.16,0,.035,z,'plasticDark');
    },
    teclado_pc(h) {
      const {box}=h;
      box(1.50,.14,.72,0,.115,0,'plastic');
      const rows=[-.21,-.07,.07,.21];
      for(let r=0;r<4;r++) for(let c=0;c<11;c++) {
        if(r===3&&c>=3&&c<=7) continue;
        box(.095,.027,.075,-.64+c*.128,.205,rows[r],'keycap');
      }
      box(.55,.026,.075,-.11,.205,.21,'plasticHi');
    },
    mouse_pc(h) {
      const {box}=h;
      box(.40,.12,.56,0,.12,.045,'plastic');
      box(.37,.065,.22,0,.21,.21,'plasticHi');
      box(.035,.023,.16,0,.219,.23,'plasticDark');
      box(.085,.032,.06,0,.219,.115,'metalDark');
      box(.035,.025,.12,0,.065,-.31,'plasticDark');
    },
    impresora_matricial(h) {
      const {box}=h;
      box(2.47,.92,1.80,0,.53,0,'plastic');
      box(2.20,.35,.77,0,1.05,-.49,'plasticHi');
      box(2.0,.13,.57,0,1.18,-.46,'paper');
      box(2.32,.15,.63,0,.62,.68,'plasticDark');
      box(1.95,.03,.09,0,.705,.696,'edge');
      for(const x of [.85,.97,1.09])box(.075,.05,.052,x,.97,.13,'screenLit');
      for(const x of [-.86,.86]) box(.09,.08,1.55,x,.055,0,'plasticDark');
    },
    telefono_fijo(h) {
      const {box,knob}=h;
      box(1.41,.31,1.12,0,.20,0,'plastic');
      box(1.17,.14,.40,0,.42,-.35,'plasticDark');
      for(let r=0;r<3;r++)for(let c=0;c<3;c++)
        box(.14,.035,.11,-.31+c*.30,.391,-.04+r*.22,'keycap');
      box(1.20,.18,.31,0,.61,-.35,'plasticHi');
      box(.15,.17,.34,-.55,.53,-.35,'plasticDark');
      box(.15,.17,.34,.55,.53,-.35,'plasticDark');
    },
    telefono_pared(h) {
      const {box}=h;
      box(.83,1.96,.57,0,1.00,-.05,'plastic');
      box(.53,.26,.09,.12,1.66,.275,'plasticDark');
      for(let r=0;r<3;r++)for(let c=0;c<2;c++)
        box(.105,.10,.028,.02+c*.16,1.11-r*.19,.29,'keycap');
      box(.27,1.62,.35,-.35,1.05,.12,'plasticHi');
      box(.10,.19,.37,-.35,1.75,.12,'plasticDark');
      box(.10,.20,.37,-.35,.34,.12,'plasticDark');
      box(.09,.30,.12,-.40,1.84,-.01,'metalDark');
    },
    contestadora(h) {
      const {box}=h;
      box(1.46,.46,1.15,0,.25,0,'plasticDark');
      box(.72,.08,.29,-.25,.505,-.21,'screenOff');
      box(.44,.027,.014,-.25,.56,-.04,'screenLit');
      box(.66,.032,.38,.19,.50,.30,'plasticHi');
      box(.52,.026,.22,.19,.524,.30,'plasticDark');
      for(const x of [-.55,-.28,.01,.30,.57]) box(.12,.075,.12,x,.515,.46,'keycap');
      box(.08,.06,.06,.55,.51,-.38,'redLed');
    },
    fax(h) {
      const {box}=h;
      box(2.21,.75,1.89,0,.415,0,'plastic');
      box(1.40,.12,.80,0,.98,-.48,'plasticDark');
      box(1.26,.09,.72,0,1.09,-.55,'paper');
      box(.80,.06,.51,-.46,.843,.53,'plasticDark');
      for(let r=0;r<3;r++)for(let c=0;c<4;c++)
        box(.10,.035,.082,-.72+c*.17,.885,.32+r*.13,'keycap');
      box(.43,.085,.31,.62,.86,.43,'screenOff');
      box(.26,.02,.02,.62,.915,.572,'screenLit');
      box(1.20,.08,.11,0,.44,.93,'plasticDark');
    },
    televisor_crt(h) {
      const {box,cylinder}=h;
      box(2.94,2.40,2.36,0,1.43,-.02,'plasticDark');
      box(2.83,2.16,.09,0,1.48,1.115,'plastic');
      box(2.26,1.79,.055,-.24,1.55,1.16,'screenOff');
      box(1.74,.018,.024,-.29,1.29,1.20,'screenLit');
      box(2.0,.018,.024,-.29,1.45,1.20,'screenLit');
      box(.16,.17,.07,1.08,1.65,1.20,'metal');
      box(.15,.17,.07,1.08,1.31,1.20,'metal');
      for(let y=.76;y<1.15;y+=.12) box(.28,.035,.04,1.08,y,1.20,'speaker');
      for(const x of [-.97,.97]) box(.20,.12,.44,x,.11,-.66,'plasticDark');
    },
    videocasetera_vhs(h) {
      const {box}=h;
      box(1.98,.42,1.47,0,.255,0,'plasticDark');
      box(1.41,.11,.043,-.10,.275,.72,'speaker');
      box(.35,.08,.035,.70,.28,.73,'screenOff');
      box(.18,.035,.019,.70,.30,.731,'screenLit');
      for(const x of [-.72,-.48,-.24,.0]) box(.10,.06,.035,x,.14,.73,'keycap');
      box(1.89,.05,1.4,0,.47,0,'metalDark');
    },
    radio_portatil(h) {
      const {box}=h;
      box(1.44,.78,.68,0,.46,0,'woodDark');
      box(.80,.56,.045,-.26,.46,.32,'speaker');
      for(let y=.25;y<.70;y+=.09)box(.70,.019,.015,-.26,y,.34,'metalDark');
      box(.36,.23,.045,.47,.60,.32,'plastic');
      box(.27,.029,.017,.47,.61,.34,'screenLit');
      box(.13,.14,.055,.47,.32,.34,'metal');
      box(.97,.07,.09,0,.90,-.02,'metal');
      for(const x of [-.46,.46])box(.09,.15,.09,x,.85,-.02,'metal');
    },
    grabadora_boombox(h) {
      const {box,cylinder}=h;
      box(2.43,.95,.93,0,.58,0,'plasticDark');
      for(const x of [-.84,.84]) {
        cylinder(.34,.045,x,.57,.425,'speaker',10).rotation.x=Math.PI/2;
        cylinder(.19,.048,x,.57,.445,'metalDark',10).rotation.x=Math.PI/2;
      }
      box(.70,.49,.05,0,.59,.46,'plastic');
      box(.48,.30,.025,0,.60,.46,'screenOff');
      for(const x of [-.28,0,.28]) box(.11,.06,.10,x,1.11,.16,'keycap');
      for(const x of [-.80,.80]) box(.08,.32,.09,x,1.09,-.15,'metal');
      box(1.69,.08,.10,0,1.20,-.15,'metal');
    },
    reloj_digital(h) {
      const {box}=h;
      box(1.22,.61,.67,0,.36,0,'plasticDark');
      box(1.01,.40,.03,0,.39,.343,'screenOff');
      // Segmentos sobre la pantalla oscura, no detrás de ella.
      const glyph = { '1':'bc','2':'abdeg','4':'bcfg','7':'abc' };
      const places = [-.365,-.137,.154,.378];
      const digits = ['1','2','4','7'];
      for(let i=0;i<digits.length;i++){
        const x=places[i];
        for(const part of glyph[digits[i]]){
          let w=.105,h=.019,dx=0,dy=0;
          if(part==='a')dy=.104;
          if(part==='g')dy=0;
          if(part==='d')dy=-.104;
          if(part==='b'||part==='c'||part==='e'||part==='f'){
            w=.018; h=.085;
            dx=(part==='b'||part==='c')?.058:-.058;
            dy=(part==='b'||part==='f')?.053:-.053;
          }
          box(w,h,.012,x+dx,.39+dy,.367,'redLed');
        }
      }
      box(.022,.025,.012,.015,.443,.367,'orangeLed');
      box(.022,.025,.012,.015,.340,.367,'orangeLed');
      for(const x of [-.33,.33])box(.13,.04,.18,x,.69,-.05,'plastic');
      for(const x of [-.47,.47])box(.12,.07,.12,x,.045,.19,'edge');

    },

    inodoro_clasico(h) {
      const {box,cylinder,knob}=h;
      box(1.44,.23,1.57,0,.18,.23,'porcelainShade');
      box(.83,.76,.52,0,1.41,-.82,'porcelainShade');
      box(1.60,1.12,1.60,0,.76,.22,'porcelain');
      cylinder(.72,.16,0,1.35,.35,'porcelain',12);
      cylinder(.49,.014,0,1.445,.39,'bowlDark',12);
      cylinder(.72,.11,0,1.53,.35,'porcelainShade',12);
      box(2.03,1.29,.68,0,2.28,-.85,'porcelain');
      box(2.10,.14,.75,0,2.91,-.85,'porcelainShade');
      knob(.67,2.64,-.42,.105,'chrome');
      box(.15,.12,.28,.60,2.64,-.57,'chrome');
    },
    inodoro_antiguo(h) {
      const {box,cylinder}=h;
      box(1.53,1.18,1.65,0,.66,.20,'porcelain');
      cylinder(.76,.15,0,1.32,.24,'porcelainShade',12);
      cylinder(.54,.016,0,1.42,.27,'bowlDark',12);
      cylinder(.73,.13,0,1.53,.24,'porcelain',12);
      cylinder(.10,2.67,0,2.65,-.86,'chrome',8);
      box(1.89,1.34,.55,0,4.48,-.91,'porcelain');
      box(2.0,.15,.69,0,5.17,-.91,'porcelainShade');
      box(.76,.08,.09,.54,4.33,-.57,'chrome');
      box(.10,1.58,.11,.87,3.52,-.57,'chrome');
      box(.22,.20,.13,.87,2.76,-.57,'metalDark');
    },
    lavabo_pedestal(h) {
      const {box,cylinder}=h;
      cylinder(.27,2.55,0,1.28,-.06,'porcelainShade',10);
      cylinder(.55,.15,0,.11,-.06,'porcelain',10);
      box(2.13,.37,1.72,0,2.67,0,'porcelain');
      box(1.65,.018,1.18,0,2.86,.13,'bowlDark');
      box(1.96,.09,.15,0,2.95,-.77,'porcelainShade');
      cylinder(.085,.37,0,2.90,-.59,'chrome',8);
      box(.11,.07,.37,0,2.92,-.43,'chrome');
      for (const x of [-.43,.43]) cylinder(.11,.08,x,2.88,-.53,'chrome',8);
    },
    lavabo_gabinete(h) {
      const {box,cylinder,knob}=h;
      box(2.88,2.76,1.93,0,1.42,0,'woodDark');
      box(3,.18,2,0,2.85,0,'porcelain');
      box(2.10,.025,1.32,0,2.95,.10,'bowlDark');
      box(.90,2.18,.055,-.72,1.47,.995,'woodLight');
      box(.90,2.18,.055,.72,1.47,.995,'woodLight');
      for (const x of [-.37,.37])knob(x,1.49,1.052,.065,'chrome');
      box(.11,.45,.11,0,2.97,-.70,'chrome');
      box(.14,.08,.45,0,3.16,-.49,'chrome');
      for (const x of [-.42,.42])box(.21,.065,.15,x,3.055,-.68,'metal');
    },
    mingitorio_pared(h) {
      const {box,cylinder}=h;
      box(1.26,1.80,.43,0,1.16,-.35,'porcelain');
      box(1.63,1.23,.88,0,.76,.02,'porcelain');
      box(1.11,.95,.06,0,1.04,.49,'bowlDark');
      for(const x of [-.65,.65])box(.15,.95,.07,x,1.04,.52,'porcelainShade');
      box(1.39,.12,.075,0,1.53,.51,'porcelain');
      box(1.29,.12,.075,0,.56,.51,'porcelain');
      box(1.46,.18,.78,0,1.53,.01,'porcelainShade');
      box(.14,.41,.14,0,2.25,-.40,'chrome');
      box(.34,.13,.17,0,2.43,-.40,'chrome');
      box(.15,.10,.12,0,2.43,-.27,'metalDark');
    },
    banera_clasica(h) {
      const {box,cylinder}=h;
      box(5.64,1.83,2.67,0,.99,0,'porcelainShade');
      box(5.24,.025,2.16,0,1.95,0,'bowlDark');
      for (const z of [-1.23,1.23])box(5.71,.22,.21,0,1.96,z,'porcelain');
      for (const x of [-2.72,2.72])box(.21,.22,2.61,x,1.96,0,'porcelain');
      box(.12,.29,.12,-2.2,2.10,-.98,'chrome');
      box(.35,.07,.12,-2.0,2.18,-.98,'chrome');
      cylinder(.15,.05,2.13,1.98,.70,'metalDark',8);
    },
    banera_patas(h) {
      const {box,cylinder}=h;
      for (const x of [-2.19,2.19])for(const z of [-.93,.93]){
        cylinder(.17,.49,x,.25,z,'metalDark',8);
        box(.36,.13,.34,x,.065,z,'chrome');
      }
      box(5.55,1.54,2.56,0,1.32,0,'porcelain');
      box(5.1,.024,2.05,0,2.09,0,'bowlDark');
      for(const z of [-1.25,1.25])box(5.70,.21,.19,0,2.19,z,'porcelainShade');
      for(const x of [-2.74,2.74])box(.18,.21,2.56,x,2.19,0,'porcelainShade');
      box(.16,.37,.14,-2.10,2.21,-.95,'chrome');
      box(.54,.08,.12,-1.85,2.36,-.95,'chrome');
    },
    plato_ducha(h) {
      const {box,cylinder}=h;
      box(2.97,.26,2.97,0,.15,0,'porcelainShade');
      box(2.65,.016,2.65,0,.286,0,'porcelain');
      for(const z of [-1.36,1.36])box(2.97,.14,.17,0,.36,z,'porcelain');
      for(const x of [-1.36,1.36])box(.17,.14,2.97,x,.36,0,'porcelain');
      cylinder(.14,.018,.78,.30,.76,'metalDark',8);
    },
    cabina_ducha(h) {
      const {box,cylinder}=h;
      box(3.16,.30,3.15,0,.18,0,'porcelainShade');
      box(2.85,.015,2.87,0,.345,0,'porcelain');
      for(const x of [-1.51,1.51])for(const z of [-1.51,1.51])
        box(.10,6.80,.10,x,3.79,z,'chrome');
      for(const z of [-1.48,1.48])box(3.06,.10,.13,0,7.20,z,'chrome');
      for(const x of [-1.48,1.48])box(.13,.10,3.02,x,7.20,0,'chrome');
      box(2.96,6.66,.055,0,3.78,-1.45,'glassFrost');
      box(.055,6.67,2.97,-1.45,3.78,0,'glassFrost');
      box(1.36,6.53,.065,.76,3.78,1.44,'glassFrost');
      box(1.39,6.53,.06,-.76,3.78,1.44,'glassFrost');
      box(.10,.55,.13,.21,3.78,1.44,'chrome');
      box(.15,.92,.13,-.21,3.78,1.44,'chrome');
      cylinder(.12,.15,0,5.98,-1.28,'chrome',8);
      box(.08,.99,.12,0,5.38,-1.27,'chrome');
      cylinder(.33,.10,0,6.30,-1.24,'chrome',8);
    },
    regadera_pared(h) {
      const {box,cylinder}=h;
      box(.14,1.32,.12,0,.72,-.34,'chrome');
      box(.15,.12,.62,0,1.57,-.07,'chrome');
      cylinder(.46,.10,0,1.60,0,'chrome',10);
      box(.60,.09,.11,0,.19,-.28,'porcelainShade');
      for(const x of [-.26,.26])cylinder(.10,.12,x,.18,-.22,'chrome',8);
      box(.10,.29,.10,0,.35,-.30,'chrome');
    },
    espejo_rectangular(h) {
      const {box}=h;
      box(2.48,2.94,.14,0,1.50,0,'metalDark');
      box(2.27,2.72,.052,0,1.50,.092,'mirror');
      box(.80,.012,.013,-.52,2.43,.119,'chrome');
      box(.51,.010,.013,-.62,1.85,.119,'glassFrost');
    },
    espejo_redondo(h) {
      const {cylinder}=h;
      const frame=cylinder(1.12,.12,0,1.125,0,'metalDark',12);
      frame.rotation.x=Math.PI/2;
      const glass=cylinder(1.01,.125,0,1.125,.038,'mirror',12);
      glass.rotation.x=Math.PI/2;
      const shine=cylinder(.16,.132,-.55,1.53,.04,'glassFrost',8);
      shine.rotation.x=Math.PI/2;
    },
    botiquin_pared(h) {
      const {box,knob}=h;
      box(2.47,2.20,.71,0,1.125,0,'plastic');
      box(2.33,2.06,.085,0,1.125,.365,'metalDark');
      box(2.12,1.84,.016,0,1.125,.415,'mirror');
      box(.12,.68,.08,.95,1.11,.443,'chrome');
      box(2.46,.09,.74,0,2.18,0,'porcelainShade');
    },
    gabinete_bano(h) {
      const {box,knob}=h;
      box(2.66,4.28,1.45,0,2.20,-.025,'woodLight');
      box(1.18,2.40,.075,-.65,2.96,.72,'wood');
      box(1.18,2.40,.075,.65,2.96,.72,'wood');
      for(const x of [-.16,.16])knob(x,2.92,.775,.055,'chrome');
      box(2.53,.07,1.37,0,1.65,0,'woodDark');
      box(2.42,.45,.072,0,.94,.71,'bowlDark');
      box(1.84,.23,.09,0,.98,.758,'towelCream');
      for(const x of [-1.1,1.1])box(.12,.13,.14,x,.065,.50,'woodDark');
    },
    toallero(h) {
      const {box}=h;
      for(const x of [-1.03,1.03])box(.16,.18,.39,x,.49,-.04,'chrome');
      box(2.28,.10,.12,0,.52,.12,'chrome');
      box(1.47,.48,.10,.10,.31,.18,'towelBlue');
      box(1.49,.048,.11,.10,.52,.19,'towelCream');
    },
    portarrollos(h) {
      const {box,cylinder}=h;
      box(.64,.32,.13,0,.42,-.25,'chrome');
      box(.12,.25,.55,-.34,.39,.06,'metalDark');
      box(.12,.25,.55,.34,.39,.06,'metalDark');
      cylinder(.23,.61,0,.39,.11,'towelCream',10).rotation.z=Math.PI/2;
      cylinder(.065,.62,0,.39,.11,'bowlDark',8).rotation.z=Math.PI/2;
    },
    cesto_basura(h) {
      const {cylinder,box}=h;
      cylinder(.66,1.84,0,.99,0,'metalDark',8);
      cylinder(.68,.13,0,1.88,0,'chrome',8);
      cylinder(.53,.021,0,1.956,0,'bowlDark',8);
      for(const x of [-.38,.38])box(.035,.73,.028,x,1.06,.63,'metal');
    },
    dispensador_jabon(h) {
      const {box,cylinder}=h;
      box(.42,.49,.40,0,.28,0,'soap');
      box(.35,.10,.33,0,.56,0,'porcelain');
      cylinder(.07,.13,0,.67,0,'chrome',8);
      box(.25,.055,.11,.11,.715,0,'chrome');
      box(.27,.11,.025,0,.34,.213,'towelCream');
    },
    papel_higienico(h) {
      const {cylinder}=h;
      cylinder(.22,.47,0,.25,0,'towelCream',10).rotation.z=Math.PI/2;
      cylinder(.065,.48,0,.25,0,'paper',8).rotation.z=Math.PI/2;
    },
    toallas_dobladas(h) {
      const {box}=h;
      box(.94,.20,.93,0,.115,0,'towelCream');
      box(.97,.20,.96,0,.317,0,'towelBlue');
      box(.72,.045,.92,.06,.429,0,'towelCream');
    },
  };


  // Delivery 03: una caja = 24 vértices UV / 12 triángulos / 1 material.
  // Todos los detalles visuales están en la textura pixelada, sin caras extra.
  const DELIVERY_TEXTURES = {"caja_carton_pequena":"data:image/png;base64,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","caja_carton_mediana":"data:image/png;base64,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","caja_carton_grande":"data:image/png;base64,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"};
  const deliveryMaterials = new WeakMap();
  const atlasCells = {front:[0,0],right:[1,0],back:[2,0],left:[0,1],top:[1,1],bottom:[2,1]};
  function createParcelMesh(item, THREE) {
    let materials = deliveryMaterials.get(THREE);
    if (!materials) { materials = new Map(); deliveryMaterials.set(THREE,materials); }
    let material = materials.get(item.id);
    if (!material) {
      const tex = new THREE.TextureLoader().load(DELIVERY_TEXTURES[item.id], () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('fh:parcel-texture-ready'));
      });
      tex.magFilter=THREE.NearestFilter;
      tex.minFilter=THREE.NearestFilter;
      tex.generateMipmaps=false;
      tex.wrapS=THREE.ClampToEdgeWrapping;
      tex.wrapT=THREE.ClampToEdgeWrapping;
      material=new THREE.MeshLambertMaterial({map:tex,flatShading:true});
      materials.set(item.id,material);
    }
    const x=item.widthFt*FT/2, z=item.depthFt*FT/2, h=item.heightFt*FT;
    const quads = {
      front:[[-x,0,z],[x,0,z],[x,h,z],[-x,h,z]],
      right:[[x,0,z],[x,0,-z],[x,h,-z],[x,h,z]],
      back:[[x,0,-z],[-x,0,-z],[-x,h,-z],[x,h,-z]],
      left:[[-x,0,-z],[-x,0,z],[-x,h,z],[-x,h,-z]],
      top:[[-x,h,z],[x,h,z],[x,h,-z],[-x,h,-z]],
      bottom:[[-x,0,-z],[x,0,-z],[x,0,z],[-x,0,z]]
    };
    const positions=[], uvs=[], indices=[];
    for (const [side,quad] of Object.entries(quads)) {
      const n=positions.length/3;
      const [cx,cy]=atlasCells[side];
      const localUV=[[0,0],[1,0],[1,1],[0,1]];
      for (let j=0;j<4;j++) {
        positions.push(...quad[j]);
        const [lu,lv]=localUV[j];
        uvs.push((cx*64+.5+lu*63)/192, 1-(cy*64+.5+(1-lv)*63)/128);
      }
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=item.id;
    return mesh;
  }

  // Vista previa procedural ligera de la cámara. El GLB incluido es el asset definitivo.
  // El nombre CAM_YAW coincide con el nodo animable del archivo GLB.
  function createSecurityCamera(THREE, root) {
    const m = materialPalette(THREE);
    const fixed = helpers(THREE, root, m);
    fixed.box(.62,.65,.13,0,.65,-.80,'metalDark');  // placa de pared
    fixed.box(.23,.22,.70,0,.75,-.44,'metal');     // brazo fijo
    fixed.box(.35,.30,.18,0,.75,-.13,'metalDark');
    const pivot = new THREE.Group();
    pivot.name = 'CAM_YAW';
    pivot.position.set(0,.75*FT,-.08*FT);
    root.add(pivot);
    const moving = helpers(THREE, pivot, m);
    moving.box(.73,.48,1.02,0,.02,.20,'metal');     // caja de cámara
    moving.box(.75,.08,1.04,0,.29,.20,'metalDark'); // cubierta
    moving.box(.68,.36,.08,0,-.015,.74,'metalDark'); // frente
    const lens = moving.cylinder(.16,.09,0,-.01,.82,'screenOff',8);
    lens.rotation.x = Math.PI/2;
    const rim = moving.cylinder(.19,.04,0,-.01,.77,'metalDark',8);
    rim.rotation.x = Math.PI/2;
    moving.box(.065,.065,.03,.27,.07,.794,'redLed');
    root.userData.rig = {pivot:'CAM_YAW',axis:'Y',minDegrees:-48,maxDegrees:48};
  }

  function createFurniture(id, THREE) {
    const item = assertDimensions(BY_ID.get(id));
    if (!THREE || !THREE.Group || !THREE.Mesh) throw new Error('Se necesita Three.js.');
    const group = new THREE.Group();
    group.name = 'fh_furniture__' + item.id;
    group.userData = {
      furnitureId: item.id,
      dimensionsFt: {width: item.widthFt, depth: item.depthFt, height: item.heightFt},
      collisionFt: {width: item.widthFt, depth: item.depthFt},
      units: 'meters',
      collisionType: 'box',
      blocksMovement: item.blocksMovement
    };
    if (item.pack === 'delivery_03') group.add(createParcelMesh(item, THREE));
    else if (item.pack === 'seguridad_06') createSecurityCamera(THREE, group);
    else builders[id](helpers(THREE, group, materialPalette(THREE)));
    return group;
  }

  function makeMapItem(id, options) {
    const item = assertDimensions(BY_ID.get(id));
    const {x = 0, y = 0, rotation = 0, feetPerCell = 5, instanceId} = options || {};
    if (![x, y, rotation, feetPerCell].every(Number.isFinite) || feetPerCell <= 0) {
      throw new Error('Posición, rotación o escala inválidas.');
    }
    return {
      id: instanceId || ('mueble_' + item.id + '_0'),
      type: 'furniture',
      modelId: item.id,
      x, y,
      w: Number((item.widthFt / feetPerCell).toFixed(6)),
      h: Number((item.depthFt / feetPerCell).toFixed(6)),
      widthFt: item.widthFt,
      depthFt: item.depthFt,
      heightFt: item.heightFt,
      rotation,
      blocksMovement: item.blocksMovement,
      ...(item.placement === 'wall' ? {placement: 'wall', mountHeightFt: item.mountHeightFt || 0} : {}),
       ...(item.pack === 'delivery_03' ? {parcelSize: item.parcelSize, heightTiles: item.sizeTiles.height} : {}),
      ...(item.rig ? {rig: {...item.rig}} : {})
    };
  }

  function disposeFurniture(group) {
    // Geometrías por instancia; materiales/texturas son compartidos y se conservan.
    if (!group) return;
    group.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  }

  global.FH_MUEBLES = Object.freeze({
    catalog: CATALOG,
    list: LIST,
    get: (id) => BY_ID.get(id) || null,
    createFurniture,
    makeMapItem,
    disposeFurniture,
    ftToMeters: n => n * FT,
    validate: () => LIST.map(assertDimensions).length === LIST.length
  });
})(window);
