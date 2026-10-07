// Cotos y parques micológicos regulados (permiso de pago).
// Coordenadas ORIENTATIVAS al municipio de acceso: el coto abarca varios montes.
// Fuentes: micocyl.es / micologiacyl.es (CyL), micoaragon.es (Aragón),
// Gobierno de Navarra (Ultzama, Erro, Aezkoa, Roncal, Salazar),
// Ayuntamiento Soto del Real MUP-141 (Madrid), PN Poblet (Cataluña).
// Geocodificado con Nominatim (verificado uno a uno, oct-2026).
// En Cataluña casi todo el monte es libre (3 kg): aquí solo el piloto de Poblet.
const COTOS=[
{n:"Pinares de Urbión (Soria)",la:41.9347,lo:-2.8832,ccaa:"Castilla y León"},
{n:"Montes de Soria",la:41.9118,lo:-2.7631,ccaa:"Castilla y León"},
{n:"Montes CyL Soria (SO-50003)",la:41.9478,lo:-2.4693,ccaa:"Castilla y León"},
{n:"Demanda-San Millán (Burgos)",la:42.3241,lo:-3.2012,ccaa:"Castilla y León"},
{n:"Montes de Oca (Burgos)",la:42.3884,lo:-3.3086,ccaa:"Castilla y León"},
{n:"Fresneda Sierra Tirón (Burgos)",la:42.3153,lo:-3.136,ccaa:"Castilla y León"},
{n:"Valle de Mena (Burgos)",la:43.1005,lo:-3.283,ccaa:"Castilla y León"},
{n:"San Zadornil (Burgos)",la:42.8414,lo:-3.1582,ccaa:"Castilla y León"},
{n:"Gredos (Ávila)",la:40.3619,lo:-5.1331,ccaa:"Castilla y León"},
{n:"Montes CyL Ávila (AV-50006)",la:40.2868,lo:-4.9957,ccaa:"Castilla y León"},
{n:"Montes de Segovia (SG-50002)",la:40.7171,lo:-4.246,ccaa:"Castilla y León"},
{n:"Montes CyL Segovia (SG-50005)",la:41.2973,lo:-3.7487,ccaa:"Castilla y León"},
{n:"Río Cea (León)",la:42.3719,lo:-5.0313,ccaa:"Castilla y León"},
{n:"Torozos-Mayorga-Valladolid",la:41.4788,lo:-4.5888,ccaa:"Castilla y León"},
{n:"Noroeste Zamorano (Zamora)",la:42.0202,lo:-6.6012,ccaa:"Castilla y León"},
{n:"Camarzana-Rabanales (Zamora)",la:41.9946,lo:-6.0264,ccaa:"Castilla y León"},
{n:"Velilla del Río Carrión (Palencia)",la:42.826,lo:-4.8474,ccaa:"Castilla y León"},
{n:"Triollo (Palencia)",la:42.9243,lo:-4.6811,ccaa:"Castilla y León"},
{n:"Sierras Francia-Béjar (Salamanca)",la:40.4889,lo:-6.1105,ccaa:"Castilla y León"},
{n:"Ribera de Cañedo (Salamanca)",la:41.176,lo:-5.7834,ccaa:"Castilla y León"},
{n:"Aguilar de Campoo (Palencia)",la:42.7956,lo:-4.3036,ccaa:"Castilla y León"},
{n:"Barbadillo del Mercado (Burgos)",la:42.0389,lo:-3.3582,ccaa:"Castilla y León"},
{n:"Comunidad de Albarracín (Teruel)",la:40.4073,lo:-1.4443,ccaa:"Aragón"},
{n:"Moncayo (Zaragoza)",la:41.7786,lo:-1.7211,ccaa:"Aragón"},
{n:"Maestrazgo (Teruel)",la:40.5253,lo:-0.4062,ccaa:"Aragón"},
{n:"Ultzama (Navarra)",la:42.9778,lo:-1.6953,ccaa:"Navarra"},
{n:"Erro-Roncesvalles (Navarra)",la:42.989,lo:-1.335,ccaa:"Navarra"},
{n:"Aezkoa-Irati (Navarra)",la:42.9035,lo:-1.2089,ccaa:"Navarra"},
{n:"Roncal (Navarra)",la:42.8074,lo:-0.9556,ccaa:"Navarra"},
{n:"Salazar (Navarra)",la:42.8872,lo:-1.0973,ccaa:"Navarra"},
{n:"Soto del Real MUP-141 (Madrid)",la:40.7534,lo:-3.7868,ccaa:"Comunidad de Madrid"},
{n:"Poblet (Tarragona, piloto)",la:41.4005,lo:1.1033,ccaa:"Cataluña"}
];
