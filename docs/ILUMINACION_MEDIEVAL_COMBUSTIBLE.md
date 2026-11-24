# Combustible y fuego medieval

En el editor D&D, abre **Iluminación**. Además de las luminarias hay cuatro herramientas para colocar suministros recogibles: resina para antorcha, cera para vela, aceite de lámpara y leña. Cada colocación entrega una unidad y sólo se recoge una vez por partida. El estado se conserva al guardar y cargar.

| Fuente | Material |
| --- | --- |
| Antorcha de pared o de mano | Resina para antorcha |
| Vela o candelabro | Cera para vela |
| Farol de aceite | Aceite de lámpara |
| Brasero, fogata o chimenea | Leña |
| Cristal mágico | Ninguno |

Acércate a una fuente e interactúa para abrir su panel. Muestra si está encendida, los minutos de juego restantes, el material necesario y las unidades que llevas.

- **Recargar combustible** consume una unidad compatible y repone la carga. Conserva el estado de encendido; no enciende una fuente apagada. No permite desperdiciar material en una carga completa.
- **Encender** requiere combustible disponible dentro de la fuente. **Apagar** detiene su consumo.
- La antorcha de mano permite **Recoger antorcha** y **Soltar antorcha** sin confundir estas acciones con encenderla.
- Las fuentes de fuego tienen flamas de geometría 3D que siguen el encendido. Las lámparas eléctricas conservan su representación.

Los mapas siguen usando `forest-horror-map-v1`. Los suministros usan el tipo existente `misc`, un campo opcional `medievalFuel` y las interacciones declarativas de recogida única. Las definiciones legibles del combustible se completan al colocar suministros y al preparar el motor.

Esta entrega no cambia los techos, el reloj ni la duración nominal de las cargas. Los minutos mostrados corresponden al reloj actual del juego; el tiempo propio de D&D se trabajará por separado.
