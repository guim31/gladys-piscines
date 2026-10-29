# Piscines en temps réel

La **afluencia y la apertura de las piscinas municipales** de ciudades francesas, leídas en
directo en sus portales de datos abiertos: las piscinas de la Eurométropole de Strasbourg y las de
la ciudad de Burdeos. **Sin cuenta ni clave.**

Integración no oficial, sin relación con las ciudades, las métropoles ni los operadores de las
piscinas. Desarrollada sin acceso a las instalaciones: las fuentes se comprobaron en directo el
29/10/2026 (de noche, piscinas cerradas). Sus comentarios son bienvenidos.

## Qué obtiene

- Un **dispositivo por piscina** que añada: abierta o cerrada, personas presentes, capacidad y
  ocupación, nivel de afluencia, horario de hoy y antigüedad del dato (según la ciudad).
- Un **widget** «Piscinas»: sus piscinas en una línea cada una, con la afluencia y la hora de
  cierre, en verde, naranja o rojo según la ocupación.
- Cuatro **disparadores de escena**: la piscina abre, la piscina cierra, la afluencia supera un
  umbral, la afluencia baja de un umbral.
- Una **acción de escena**: el estado de sus piscinas en una frase lista para enviar.

## Requisitos

- Gladys Assistant **5.3.0** o posterior.
- Acceso a Internet desde Gladys: los datos vienen de los portales de datos abiertos de las
  ciudades.
- Ninguna cuenta, ninguna clave de API.

## Instalación

1. En Gladys, abra **Integraciones → Instalar desde GitHub**.
2. Pegue `https://github.com/guim31/gladys-piscines` y confirme.
3. Abra la integración una vez instalada: aparece la pestaña **Configuración**.

## Configuración

### Ajustes

| Ajuste                       | Efecto                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| Ciudades                     | las ciudades cuyas piscinas se proponen en la pestaña Descubrir        |
| Actualización                | cada 3, 5 (por defecto) o 10 minutos                                   |
| Idioma de nombres y mensajes | idioma de los nombres de funciones, los textos, el widget y las frases |

Los nombres de las funciones se fijan al añadir el dispositivo: elija el idioma antes.

### Añadir piscinas

1. Marque una o varias ciudades y guarde.
2. Abra la pestaña **Descubrir**: las piscinas de esas ciudades aparecen allí, como «Ciudad ·
   Piscina».
3. Añada a Gladys las que le interesen. Sus valores llegan enseguida.

Las piscinas añadidas son las **piscinas vigiladas**: el widget, los disparadores y la acción de
escena las proponen. Una piscina añadida se sigue leyendo aunque luego desmarque su ciudad.

### Comprobar

La acción **Estado** de la pestaña Configuración lista las ciudades leídas, el número de piscinas
encontradas, la hora de la última lectura, el último error si lo hay y el número de piscinas
añadidas.

## Dispositivos

Cada piscina añadida es un dispositivo de solo lectura. Sus funciones dependen de lo que publica la
ciudad:

| Función             | Tipo Gladys        | Valor                                                      | Estrasburgo | Burdeos |
| ------------------- | ------------------ | ---------------------------------------------------------- | ----------- | ------- |
| Abierta             | binario            | 1 abierta, 0 cerrada                                       | sí          | no      |
| Personas presentes  | contador           | personas en la piscina                                     | sí          | sí      |
| Capacidad           | contador           | personas admitidas a la vez                                | no          | sí      |
| Ocupación           | nivel (%)          | personas presentes / capacidad                             | no          | sí      |
| Afluencia           | texto              | tranquila, concurrida, muy concurrida, completa, «cerrada» | sí          | no      |
| Horario de hoy      | texto              | por ejemplo «07:00–14:30, 16:00–20:00»                     | sí          | no      |
| Antigüedad del dato | duración (minutos) | antigüedad del recuento, según la hora de la ciudad        | sí          | sí      |

**Ningún valor se inventa**: Estrasburgo no publica recuento mientras una piscina está cerrada
(sobre todo de noche). El número de personas no se actualiza entonces (el último valor sigue visible), y **Afluencia** indica
«cerrada». La afluencia es el nivel publicado por el operador (verde, naranja, rojo, negro), que
tiene en cuenta los vasos abiertos.

Burdeos cuenta por zona: la integración suma las zonas de una misma piscina, sin las gradas
(espectadores). Burdeos no publica ni el estado abierta/cerrada ni el horario.

Pasados **45 minutos** sin actualización de la ciudad, el dato se considera **caducado**.

## Widget del panel

Añada el widget **Piscinas** a un panel. Muestra una línea por piscina vigilada (diez como
máximo), con el nombre que le dio en Gladys, por ejemplo «85 pers. · tranquila · hasta 20:00», o
«cerrada · abre a las 07:00». En sus ajustes: las piscinas mostradas (vacío: todas) y si se
muestra el horario.

Colores: el nivel del operador en Estrasburgo (**verde** tranquila, **naranja** concurrida,
**rojo** muy concurrida o completa); la ocupación en Burdeos (**naranja** desde el 70 %, **rojo**
desde el 90 %); **gris** cuando la piscina está cerrada, sin recuento o con el dato caducado.

## Disparadores de escena

| Disparador                        | Se produce cuando                                                                |
| --------------------------------- | -------------------------------------------------------------------------------- |
| La piscina abre                   | la piscina pasa de cerrada a abierta (Estrasburgo)                               |
| La piscina cierra                 | la piscina pasa de abierta a cerrada (Estrasburgo)                               |
| Afluencia por encima de un umbral | el número de personas supera el umbral elegido (20, 50, 100, 150, 200, 300)      |
| Afluencia por debajo de un umbral | el número de personas de una piscina abierta baja al umbral elegido o por debajo |

El campo **Piscinas** filtra las piscinas afectadas; vacío, cualquier piscina vigilada. Variables
disponibles en las acciones siguientes: piscina, ciudad, personas presentes, ocupación (0 si se
desconoce).

Los disparadores comparan dos lecturas sucesivas: nada se dispara al volver un portal tras una
avería, ni con un dato caducado. Al reabrir, el recuento parte de cero. En Burdeos, que no publica el estado abierta/cerrada, la caída a 0 al cierre no dispara «Afluencia por debajo de un umbral». Un número que oscila alrededor de un umbral dispara en cada paso.

## Acción de escena

**Obtener la afluencia de las piscinas**: sus piscinas vigiladas (o las elegidas) en una frase.
Resultados:

- `sentence`: «Piscine du Wacken: 85 personas (tranquila), abierta hasta las 20:00. Piscine de
  Hautepierre: cerrada.»;
- `open_count`: número de piscinas abiertas (ciudades que publican el estado);
- `people`: total de personas presentes.

La frase sigue el idioma elegido en la configuración.

## Ejemplos de escenas

- **Antes de ir a nadar**: un botón o una hora fija, acción «Obtener la afluencia de las
  piscinas», luego «Enviar un mensaje» con `sentence`.
- **Franja tranquila**: disparador «Afluencia por debajo de un umbral» (su piscina, umbral 50),
  luego una notificación «Es buen momento para ir».
- **Piscina abierta**: disparador «La piscina abre» el sábado por la mañana, luego un mensaje.

## Datos y actualización

| Ciudad      | Portal                                        | Conjunto de datos                             | Licencia        |
| ----------- | --------------------------------------------- | --------------------------------------------- | --------------- |
| Estrasburgo | data.strasbourg.eu (Opendatasoft)             | Fréquentation en temps réel des piscines      | Licence Ouverte |
| Burdeos     | opendata.bordeaux-metropole.fr (Opendatasoft) | Fréquentation temps réel des piscines (ville) | Licence Ouverte |

Una petición por ciudad y por lectura, unos pocos kilobytes. Las ciudades actualizan sus datos cada
5 a 10 minutos; a 5 minutos, son 288 peticiones al día por ciudad, muy por debajo de las cuotas de
los portales para un uso anónimo. Solo se leen las ciudades marcadas y las de las piscinas
añadidas.

## Solución de problemas

- **Ninguna piscina en Descubrir**: compruebe que una ciudad está marcada y guardada, y lance la
  acción **Estado**. Un error «HTTP 503» o «timeout» viene del portal de la ciudad: inténtelo más
  tarde.
- **«dato caducado» en el widget**: la ciudad no ha actualizado esta piscina desde hace más de 45
  minutos.
- **Sin número de personas**: la piscina está cerrada, o la ciudad no publica recuento en este
  momento. No se inventa nada.
- **Sin función «Abierta» ni horario**: la ciudad no los publica (Burdeos).
- Para más detalles, ponga `LOG_LEVEL=debug`: cada lectura queda registrada.

## Limitaciones

- Hoy solo Estrasburgo y Burdeos publican en directo la afluencia de sus piscinas. Nantes,
  Toulouse, París, Rennes o Montpellier solo publican datos estáticos (direcciones, equipamiento):
  podrán añadirse si aparece un flujo en directo.
- Las cifras son las de los operadores (recuento de entradas y salidas): pueden diferir de la
  realidad, sobre todo al final del día.
- Estrasburgo no da capacidad, por lo tanto tampoco ocupación.
- Solo lectura: ni reserva ni pago.

## Créditos

- Datos: Eurométropole de Strasbourg y Bordeaux Métropole, bajo la Licence Ouverte (Etalab).
- Construida a partir de la
  [plantilla oficial de integración](https://github.com/GladysAssistant/integration-template-js).
