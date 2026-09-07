/* ═══════════════════════════════════════════════════════════════════════════
 * KAMISUITE — AKIRA · Intérprete de capacidades (Wix Velo)
 * Archivo:  backend/akiraEjecutorLogic.web.js
 * VERSION:  3.7.0
 * FECHA:    6 Septiembre 2026
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CONSIGNA DE JAL
 * ───────────────────────────────────────────────────────────────────────────
 *
 *   "Quiero limitar meter en los códigos toda la emulación de los widgets
 *    para AKIRA. Usa AkiraCapabilities para que los códigos de AKIRA sepan
 *    desde ahí cómo usar los backends y toda la arquitectura para cualquier
 *    funcionalidad presente en KAMISUITE."
 *
 * ESTE ARCHIVO NO SABE RESERVAR. No sabe qué es una cita, ni un complemento,
 * ni un solape. Es un intérprete: ejecuta la secuencia de pasos que declara
 * la fila de AkiraCapabilities, sobre las funciones de producción.
 *
 * Emular un widget = declarar sus pasos en la columna `pasos`. Reservar,
 * cancelar, mover, bloquear, cobrar: todas son filas.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * QUÉ HAY EN CÓDIGO Y POR QUÉ NO PUEDE SALIR
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 1. VERBOS. Cinco operaciones genéricas: llamar, buscar, comprobar, elegir
 *    y calcular (v3.5.0: sumar y restar, para poder enseñar cómo queda una
 *    cita después de añadirle algo).
 *    Ninguna sabe nada de peluquería. Son el vocabulario con el que se
 *    escriben los pasos.
 * 2. LISTA BLANCA. Qué funciones de producción se pueden invocar. Abrir una
 *    nueva es escribir su nombre. Sin ella, una fila mal pegada sería una
 *    consola remota sobre el salón.
 *
 * Nada más. No hay ni una línea que sepa cómo se compone una cita.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * EL LENGUAJE DE `pasos` (JSON en la columna)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * {
 *   "preparar": [ <paso>, <paso>, ... ],
 *   "resumen":  { <etiqueta>: <ref>, ... },     // lo que ve la persona
 *   "payload":  { <campo>: <ref>, ... }         // lo que recibe el escritor
 * }
 *
 * El ESCRITOR es el par backend/funcion de la propia fila. `pasos` prepara;
 * backend/funcion escribe.
 *
 * REFERENCIAS (cualquier string que empiece por $):
 *   "$.campo"          parámetro de entrada
 *   "$paso"            resultado completo de un paso, por su id
 *   "$paso.a.b"        ruta dentro de ese resultado
 *   "$item"            dentro de `elige`, el candidato en curso
 *   "$$"               literal '$' (escape)
 *   { "o": [ <ref>, <ref>, ... ] }   el primero que no esté vacío
 *
 * PASO — campos comunes:
 *   "id"        nombre para referenciar su resultado
 *   "verbo"     llama | busca | comprueba | elige
 *   "omitirSi"  <condición>  — se salta el paso
 *   "parar"     [ { "cuando": <condición>, "estado": "...", "devuelve": {...},
 *                   "mensaje": "..." } ]
 *               Se evalúa DESPUÉS del paso. El primero que se cumple corta la
 *               secuencia y devuelve ese estado. Es lo que permite declarar
 *               "si hay varios candidatos, pregunta" o "si choca, avisa".
 *
 * VERBO llama:
 *   "llama": "backend.funcion",  "con": { param: <ref>, ... }
 *
 * VERBO busca:  busca en una lista por texto, teléfono o email.
 *   "en": <ref a array>, "valor": <ref>,
 *   "por": [ { "campo": "nombreCompleto", "modo": "texto" },
 *            { "campo": "telefono", "modo": "tel" },
 *            { "campo": "email", "modo": "email" } ]
 *   Resultado: { estado: 'ok'|'ambiguo'|'sin_resultados'|'vacio',
 *                item, candidatos, total }
 *
 * VERBO comprueba:
 *   "que": <ref>, y UNA de: "contiene": <ref> | "vale": <ref> | "existe": true
 *   Resultado: { cumple: bool }
 *
 * VERBO elige:  prueba candidatos hasta que uno cumple.
 *   "entre": <ref a array>, "orden": "azar"|"lista",
 *   "llama": "backend.funcion", "con": {...},   ($item = candidato)
 *   "cumple": <condición sobre "$r" = resultado de la llamada>
 *   Resultado: { estado:'ok'|'ninguno', item }
 *
 * CONDICIÓN:
 *   { "campo": <ref>, "es": <valor> }        igualdad
 *   { "campo": <ref>, "distinto": <valor> }
 *   { "campo": <ref>, "vacio": true }        null, '', [] o {}
 *   { "campo": <ref>, "contiene": <ref> }    array que contiene el valor
 *   { "campo": <ref>, "existe": true }
 *   { "todas": [ <cond>, ... ] }  { "alguna": [ <cond>, ... ] }  { "no": <cond> }
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DOS TIEMPOS
 * ───────────────────────────────────────────────────────────────────────────
 * PREPARAR ejecuta `pasos.preparar`. Solo lectura: los verbos solo alcanzan
 * lo que la lista blanca permite, y el escritor no se toca. Es lo que AKIRA
 * llama mientras conversa.
 *
 * EJECUTAR vuelve a preparar desde cero y, si sigue saliendo limpio, llama al
 * escritor con `pasos.payload`. Lo dispara el page code tras confirmación,
 * con sesión de miembro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS
 * ───────────────────────────────────────────────────────────────────────────
 *   backend/widgetPublicoLogic.web  ≥ 0.11.0
 *   backend/recepcionProLogic.web   ≥ 1.0.55
 *   backend/recepcionLogic.web
 *   CMS AkiraCapabilities con los campos añadidos el 6-sep-2026 (incl. pasos).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CHANGELOG
 * ───────────────────────────────────────────────────────────────────────────
 * v3.1.0 (7-Sep-2026) — Toda respuesta lleva `ejecutado`. En preparar es
 *   siempre false; solo ejecutarAccion devuelve true. Sin ese dato, una
 *   preparación incompleta se confundía con una gestión avanzada y se acababa
 *   afirmando que la cita existía cuando no existía.
 * v3.0.1 (6-Sep-2026) — Los campos JSON pueden venir ya como objeto desde el
 *   CMS. Se dejaba de parsear a ciegas: la capacidad se cargaba sin pasos y
 *   la reserva llegaba vacía al escritor.
 * v3.0.0 (6-Sep-2026) — Desaparecen los preparadores escritos en código. La
 *   secuencia de cada capacidad se declara en la columna `pasos`. El archivo
 *   pasa de tener una emulación de la pantalla de reservas a no saber qué es
 *   una reserva. Se deja de leer `reglas`: la conducta es de AkiraAlignment.
 * v2.0.0 — Capacidades desde AkiraCapabilities; preparadores aún en código.
 * v1.0.0 — Registro declarativo en código.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

import {
  getComposicionServicio,
  getHuecosDisponibles,
  resolverInstanteMadrid
} from 'backend/widgetPublicoLogic.web';

import {
  getCatalogoReserva,
  getStaffColumnas,
  getReservasPorFecha,
  crearPackReserva,
  crearReservaMedida,
  cancelarReserva,
  reprogramarReserva,
  marcarPagadoReserva,
  crearBloqueo,
  eliminarBloqueo,
  actualizarBloqueo,
  extenderReserva,
  quitarExtension,
  agregarComplementoReserva,
  agregarServicioReserva,
  agregarExtraReserva,
  quitarItemReserva
} from 'backend/recepcionProLogic.web';

import { cargarTodosContactos } from 'backend/recepcionLogic.web';

const VERSION = '3.7.0';
const TAG = `[AkiraEjecutor][${VERSION}]`;

const CMS_CAPABILITIES = 'AkiraCapabilities';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CANDIDATOS = 8;
const MAX_PASOS = 25;          // corta secuencias mal escritas

// ═══════════════════════════════════════════════════════════════════════════
// 1 · LISTA BLANCA
// ═══════════════════════════════════════════════════════════════════════════
// Abrir una función a AKIRA = añadir su nombre aquí. Nada más.
// Quedan fuera a propósito, hasta auditarlas una a una, las que manipulan la
// geometría interna de una cita (moverFase, extenderFase, redimensionarFase)
// y las de canje de productos.

const FUNCIONES = {
  recepcionProLogic: {
    getCatalogoReserva, getStaffColumnas, getReservasPorFecha,
    crearPackReserva, crearReservaMedida, cancelarReserva, reprogramarReserva,
    marcarPagadoReserva, crearBloqueo, eliminarBloqueo, actualizarBloqueo,
    extenderReserva, quitarExtension, agregarComplementoReserva,
    agregarServicioReserva, agregarExtraReserva, quitarItemReserva
  },
  // v3.2.0 — resolverInstanteMadrid: día + HH:mm de Madrid → instante UTC.
  // La necesita mover_cita: reprogramarReserva hace `new Date(cadena)`, y una
  // cadena sin huso se lee como hora del servidor (UTC), lo que desplazaría
  // la cita una o dos horas según el horario de verano. Ese desfase es un
  // cálculo: no puede quedar en manos del modelo.
  widgetPublicoLogic: { getComposicionServicio, getHuecosDisponibles, resolverInstanteMadrid },
  recepcionLogic: { cargarTodosContactos }
};

function _fn(ruta) {
  const [mod, nom] = String(ruta || '').split('.');
  const m = FUNCIONES[mod];
  if (!m) return { error: `El backend "${mod}" no está abierto a AKIRA.` };
  const f = m[nom];
  if (typeof f !== 'function') return { error: `"${ruta}" no está en la lista blanca.` };
  return { fn: f };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clave(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
// v3.4.0 — HORAS. La gente dice "a las 10"; la agenda escribe "10:00". La
// comparación era literal, así que "10" no casaba con "10:00" y un hueco
// libre salía como colisión, o una cita de las 12 no se encontraba diciendo
// "la de las 12". Solo actúa cuando el valor ES una hora; cualquier otro
// texto pasa intacto.
const RE_HORA = /^([01]?\d|2[0-3])(?::([0-5]\d))?$/;
function horaNorm(v) {
  const m = RE_HORA.exec(String(v == null ? '' : v).trim());
  if (!m) return null;
  return String(m[1]).padStart(2, '0') + ':' + (m[2] || '00');
}
// Igualdad tolerante: si los dos lados son horas, se comparan normalizadas.
function mismoValor(a, b) {
  const ha = horaNorm(a), hb = horaNorm(b);
  if (ha && hb) return ha === hb;
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function tel9(v) {
  const d = String(v || '').replace(/[^\d]/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}
function safeErr(e) { return { message: (e && e.message) ? e.message : String(e) }; }

// v3.0.1 — El campo puede venir ya como OBJETO (tipo Objeto en el CMS) o como
// texto (tipo Texto, como estaba `parametros` desde V1). Antes se hacía
// JSON.parse a ciegas: con un objeto, String(obj) da "[object Object]" y
// petaba en la posición 1, la capacidad se quedaba sin pasos y el escritor
// recibía los parámetros crudos.
function jsonDeTexto(valor, etiqueta) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'object') return valor;
  const s = String(valor).trim();
  if (!s) return null;
  try { return JSON.parse(s); }
  catch (e) { console.warn(`${TAG} ⚠️ ${etiqueta} no es JSON válido: ${e.message}`); return null; }
}
function listaDeTexto(txt, sep) {
  return String(txt || '').split(sep || ',').map(x => x.trim()).filter(Boolean);
}
function esVacio(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}
function porRuta(obj, ruta) {
  if (!ruta) return obj;
  let cur = obj;
  for (const k of ruta.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}
function barajar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · REFERENCIAS Y CONDICIONES
// ═══════════════════════════════════════════════════════════════════════════
// `ctx` = { params, pasos: {id: resultado}, item }

function resolver(valor, ctx) {
  if (typeof valor === 'string') {
    if (valor === '$$') return '$';
    if (valor.charAt(0) !== '$') return valor;
    const ref = valor.slice(1);
    if (ref.charAt(0) === '.') return porRuta(ctx.params || {}, ref.slice(1));
    const punto = ref.indexOf('.');
    const cabeza = punto < 0 ? ref : ref.slice(0, punto);
    const cola = punto < 0 ? '' : ref.slice(punto + 1);
    const base = (cabeza === 'item') ? ctx.item : (ctx.pasos || {})[cabeza];
    return porRuta(base, cola);
  }
  if (Array.isArray(valor)) return valor.map(v => resolver(v, ctx));
  // { "o": [ref1, ref2, "literal"] } → el primero que no esté vacío.
  // Sirve para "el profesional que dijeron, y si no, el que se eligió".
  if (valor && typeof valor === 'object' && Array.isArray(valor.o) && Object.keys(valor).length === 1) {
    for (const alt of valor.o) {
      const v = resolver(alt, ctx);
      if (!esVacio(v)) return v;
    }
    return undefined;
  }
  if (valor && typeof valor === 'object') {
    const out = {};
    for (const k of Object.keys(valor)) {
      const v = resolver(valor[k], ctx);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return valor;
}

function cumpleCondicion(cond, ctx) {
  if (!cond) return false;
  if (cond.no) return !cumpleCondicion(cond.no, ctx);
  if (Array.isArray(cond.todas)) return cond.todas.every(c => cumpleCondicion(c, ctx));
  if (Array.isArray(cond.alguna)) return cond.alguna.some(c => cumpleCondicion(c, ctx));

  const v = resolver(cond.campo, ctx);
  if (cond.vacio === true) return esVacio(v);
  if (cond.existe === true) return !esVacio(v);
  if (cond.contiene !== undefined) {
    const x = resolver(cond.contiene, ctx);
    if (Array.isArray(v)) return v.some(el => mismoValor(el, x));
    return Array.isArray(v) ? v.indexOf(x) >= 0 : String(v || '').indexOf(String(x)) >= 0;
  }
  if (cond.distinto !== undefined) return v !== resolver(cond.distinto, ctx);
  if (cond.es !== undefined) return v === resolver(cond.es, ctx);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · VERBOS
// ═══════════════════════════════════════════════════════════════════════════
// Genéricos. Ninguno sabe nada del negocio.

async function verboLlama(paso, ctx) {
  const d = _fn(paso.llama);
  if (d.error) throw new Error(d.error);
  return await d.fn(resolver(paso.con || {}, ctx) || {});
}

// Búsqueda determinista en una lista. Nunca elige por aproximación: si hay
// varios, devuelve candidatos para que se pregunte.
function verboBusca(paso, ctx) {
  let lista = resolver(paso.en, ctx);

  // v3.7.0 — `filtro`: condición que cada elemento debe cumplir para entrar en
  // la búsqueda. Se evalúa con `$item` apuntando al elemento, igual que en
  // `elige`. Sin esto, la agenda del día devolvía también las citas
  // CANCELADAS y se ofrecían para mover o cobrar: la fila no tenía forma de
  // decir "estas no". La condición la declara la fila; aquí no se sabe qué
  // es un estado ni cuál importa.
  if (paso.filtro && Array.isArray(lista)) {
    const anterior = ctx.item;
    lista = lista.filter(x => { ctx.item = x; return cumpleCondicion(paso.filtro, ctx); });
    ctx.item = anterior;
  }

  const valorBruto = resolver(paso.valor, ctx);
  const txt = String(valorBruto == null ? '' : valorBruto).trim();

  if (!Array.isArray(lista)) return { estado: 'vacio', candidatos: [], total: 0 };
  if (!txt) return { estado: 'vacio', candidatos: [], total: 0 };

  const criterios = Array.isArray(paso.por) ? paso.por : [];
  const k = clave(txt);
  const t9 = tel9(txt);
  const esEmail = txt.indexOf('@') > 0;

  let cand = [];
  for (const c of criterios) {
    const campo = c.campo;
    const modo = String(c.modo || 'texto');
    if (modo === 'email') {
      if (!esEmail) continue;
      cand = lista.filter(x => String(porRuta(x, campo) || '').toLowerCase() === txt.toLowerCase());
    } else if (modo === 'tel') {
      if (!t9) continue;
      cand = lista.filter(x => tel9(porRuta(x, campo)) === t9);
    } else if (modo === 'exacto') {
      // v3.4.0 — mismoValor: "12" encuentra "12:00".
      cand = lista.filter(x => mismoValor(porRuta(x, campo), txt));
    } else {
      if (esEmail || t9) continue;
      // v3.3.0 — TRES PASADAS. Exacta, subcadena y, si nada casó, todas las
      // palabras presentes en cualquier orden.
      //
      // Sin la tercera, "Tratamiento Hair Times" no encontraba "Tratamiento
      // HairTimes Selection_complemento" —por el espacio de Hair Times— y la
      // única salida era pedirle a la persona el nombre exacto del catálogo,
      // que es justo lo que no tiene por qué saberse. Es recall, no negocio:
      // solo entra cuando las dos primeras pasadas vuelven vacías, y si
      // encuentra varias devuelve `ambiguo` como siempre.
      const ex = lista.filter(x => clave(porRuta(x, campo)) === k);
      if (ex.length) {
        cand = ex;
      } else {
        const sub = lista.filter(x => clave(porRuta(x, campo)).indexOf(k) >= 0);
        if (sub.length) {
          cand = sub;
        } else {
          const palabras = k.split(' ').filter(t => t.length > 1);
          cand = palabras.length
            ? lista.filter(x => {
                const v = clave(porRuta(x, campo));
                return palabras.every(t => v.indexOf(t) >= 0);
              })
            : [];
        }
      }
    }
    if (cand.length) break;
  }

  if (!cand.length) return { estado: 'sin_resultados', candidatos: [], total: 0, buscado: txt };
  if (cand.length > 1) {
    return { estado: 'ambiguo', candidatos: cand.slice(0, MAX_CANDIDATOS), total: cand.length, buscado: txt };
  }
  return { estado: 'ok', item: cand[0], candidatos: cand, total: 1, buscado: txt };
}

/**
 * VERBO calcula (v3.5.0) — aritmética y nada más.
 *
 *   { "verbo":"calcula", "id":"total", "suma":[ <ref>, <ref>, ... ] }
 *   { "verbo":"calcula", "id":"resto", "resta":[ <ref>, <ref> ] }
 *
 * Resultado: { valor: <número> }.
 *
 * Existe porque una tarjeta de confirmación tiene que poder decir cómo queda
 * la cita ENTERA al añadirle algo —duración y precio resultantes—, y hasta
 * aquí el intérprete no sabía sumar: solo podía enseñar el antes o el añadido,
 * nunca el después. Sumar no es negocio: no sabe qué son esos números.
 *
 * Lo que no sea número cuenta como 0, para que un campo vacío no convierta el
 * total en NaN y acabe pintado en pantalla.
 */
function verboCalcula(paso, ctx) {
  const num = (v) => {
    const n = Number(resolver(v, ctx));
    return Number.isFinite(n) ? n : 0;
  };
  if (Array.isArray(paso.suma)) {
    const valor = paso.suma.reduce((a, v) => a + num(v), 0);
    return { valor: Math.round(valor * 100) / 100 };
  }
  if (Array.isArray(paso.resta) && paso.resta.length) {
    const [primero, ...resto] = paso.resta;
    const valor = resto.reduce((a, v) => a - num(v), num(primero));
    return { valor: Math.round(valor * 100) / 100 };
  }
  return { valor: 0 };
}

function verboComprueba(paso, ctx) {
  const v = resolver(paso.que, ctx);
  if (paso.contiene !== undefined) {
    const x = resolver(paso.contiene, ctx);
    // v3.4.0 — Contra una lista de horas, "10" tiene que encontrar "10:00".
    // Era la comparación que devolvía colisión sobre un hueco libre.
    const cumple = Array.isArray(v)
      ? v.some(el => mismoValor(el, x))
      : String(v || '').indexOf(String(x)) >= 0;
    return { cumple, valor: v };
  }
  if (paso.vale !== undefined) return { cumple: mismoValor(v, resolver(paso.vale, ctx)), valor: v };
  if (paso.existe === true) return { cumple: !esVacio(v), valor: v };
  return { cumple: false, valor: v };
}

async function verboElige(paso, ctx) {
  const lista = resolver(paso.entre, ctx);
  if (!Array.isArray(lista) || !lista.length) return { estado: 'ninguno', item: null };
  const orden = (String(paso.orden || 'lista') === 'azar') ? barajar(lista) : lista;

  const d = _fn(paso.llama);
  if (d.error) throw new Error(d.error);

  for (const item of orden) {
    const sub = { params: ctx.params, pasos: ctx.pasos, item };
    const r = await d.fn(resolver(paso.con || {}, sub) || {});
    const ctxR = { params: ctx.params, pasos: { ...ctx.pasos, r }, item };
    if (cumpleCondicion(paso.cumple, ctxR)) return { estado: 'ok', item, resultado: r };
  }
  return { estado: 'ninguno', item: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · INTÉRPRETE
// ═══════════════════════════════════════════════════════════════════════════

async function ejecutarSecuencia(pasos, params) {
  const ctx = { params: params || {}, pasos: {}, item: null };
  const lista = Array.isArray(pasos) ? pasos : [];

  if (lista.length > MAX_PASOS) {
    return { estado: 'error', mensaje: `La secuencia tiene ${lista.length} pasos; el máximo es ${MAX_PASOS}.` };
  }

  for (const paso of lista) {
    if (paso.omitirSi && cumpleCondicion(paso.omitirSi, ctx)) continue;

    let res;
    const verbo = String(paso.verbo || 'llama');
    if (verbo === 'llama')          res = await verboLlama(paso, ctx);
    else if (verbo === 'busca')     res = verboBusca(paso, ctx);
    else if (verbo === 'comprueba') res = verboComprueba(paso, ctx);
    else if (verbo === 'elige')     res = await verboElige(paso, ctx);
    else if (verbo === 'calcula')   res = verboCalcula(paso, ctx);
    else return { estado: 'error', mensaje: `Verbo desconocido en la secuencia: "${verbo}".` };

    if (paso.id) ctx.pasos[paso.id] = res;

    for (const corte of (paso.parar || [])) {
      if (!cumpleCondicion(corte.cuando, ctx)) continue;
      const salida = {
        estado: corte.estado || 'faltan_datos',
        ...(resolver(corte.devuelve || {}, ctx) || {})
      };
      if (corte.mensaje) salida.mensaje = resolver(corte.mensaje, ctx);
      return salida;
    }
  }

  return { estado: 'completo', ctx };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · LECTURA DE AkiraCapabilities
// ═══════════════════════════════════════════════════════════════════════════

let _cacheCaps = null;
let _cacheAt = 0;

async function _leerCapabilities() {
  const ahora = Date.now();
  if (_cacheCaps && (ahora - _cacheAt) < CACHE_TTL_MS) return _cacheCaps;

  const r = await wixData.query(CMS_CAPABILITIES).limit(200).find({ suppressAuth: true });

  // Filtrado EN CÓDIGO, no en la query: una fila con `activo` vacío se perdía
  // sin rastro con .eq(true). Misma lección que v0.9.4 del motor público.
  const filas = (r.items || [])
    .filter(it => it.activo !== false)
    .filter(it => String(it.categoria || '').trim())
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  _cacheCaps = filas.map(it => {
    const pasos = jsonDeTexto(it.pasos, `pasos de "${it.categoria}"`) || {};
    return {
      accion:       String(it.categoria || '').trim(),
      plano:        String(it.plano || '').trim().toLowerCase() || 'asistente',
      titulo:       String(it.titulo || it.categoria || '').trim(),
      modulo:       String(it.modulo || '').trim(),
      descripcion:  String(it.descripcion || '').trim(),
      parametros:   jsonDeTexto(it.parametros, `parametros de "${it.categoria}"`) || {},
      requeridos:   listaDeTexto(it.requeridos, ','),
      ejemplos:     listaDeTexto(it.ejemplosPreguntas, '|'),
      backend:      String(it.backend || '').trim(),
      funcion:      String(it.funcion || '').trim(),
      // v3.6.0 — Frase que se dice cuando la acción ya está hecha. "Queda
      // guardada" servía para reservar y chirriaba al cancelar o al cobrar.
      // Vive en la fila, como el resto de lo que se lee en pantalla.
      textoHecho:   String(it.textoHecho || '').trim(),
      confirmacion: it.requiereConfirmacion !== false,
      forzable:     it.forzable === true,
      preparar:     Array.isArray(pasos.preparar) ? pasos.preparar : [],
      resumen:      pasos.resumen || null,
      payload:      pasos.payload || null,
      orden:        Number(it.orden) || 0
    };
  });

  _cacheAt = ahora;
  console.log(`${TAG} ${_cacheCaps.length} capacidades cargadas desde ${CMS_CAPABILITIES}`);
  return _cacheCaps;
}

export const akiraRefrescarCapacidades = webMethod(
  Permissions.SiteMember,
  async () => {
    _cacheCaps = null; _cacheAt = 0;
    const caps = await _leerCapabilities();
    return { ok: true, version: VERSION, total: caps.length };
  }
);

function faltanRequeridos(cap, params) {
  const p = params || {};
  return (cap.requeridos || []).filter(k => esVacio(p[k]));
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Capacidades de un plano, para construir el esquema de las herramientas.
 * Función PURA: la llama akiraLogic, que corre sin sesión de miembro.
 */
export async function listarAccionesCore(plano) {
  const caps = await _leerCapabilities();
  const filtro = String(plano || '').trim().toLowerCase();
  return caps.filter(c => !filtro || c.plano === filtro).map(c => ({
    accion: c.accion, modulo: c.modulo, titulo: c.titulo,
    descripcion: c.descripcion, parametros: c.parametros,
    requeridos: c.requeridos, ejemplos: c.ejemplos,
    confirmacion: c.confirmacion, forzable: c.forzable
  }));
}

/** PREPARAR — solo lectura. Es lo que AKIRA llama como herramienta. */
export async function prepararAccionCore({ accion, params } = {}) {
  const t0 = Date.now();
  try {
    const caps = await _leerCapabilities();
    const cap = caps.find(c => c.accion === String(accion || ''));
    if (!cap) return { ok: false, version: VERSION, error: { message: `Acción desconocida: ${accion}` } };

    const faltan = faltanRequeridos(cap, params);
    if (faltan.length) {
      return {
        ok: true, version: VERSION, accion, estado: 'faltan_datos',
        pendiente: faltan.map(k => ({
          id: k, tipo: 'texto',
          label: (cap.parametros[k] && cap.parametros[k].description) || k
        }))
      };
    }

    // Capacidad sin secuencia: es una consulta directa contra su función.
    if (!cap.preparar.length) {
      const d = _fn(`${cap.backend}.${cap.funcion}`);
      if (d.error) return { ok: false, version: VERSION, error: { message: d.error } };
      if (cap.confirmacion) {
        return {
          ok: true, version: VERSION, accion, ejecutado: false, estado: 'listo',
          requiereConfirmacion: true, aviso: null,
          resumen: { accion: cap.titulo, ...(params || {}) }, payload: params || {}
        };
      }
      const res = await d.fn(params || {});
      return { ok: true, version: VERSION, accion, ejecutado: false, estado: 'resultado', resultado: res };
    }

    const r = await ejecutarSecuencia(cap.preparar, params);

    if (r.estado !== 'completo') {
      console.log(`${TAG} preparar ${accion} → ${r.estado} (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
      // v3.1.0 — `ejecutado` viaja SIEMPRE y SIEMPRE es false aquí: preparar
      // es solo lectura. Sin este dato, una preparación incompleta se leía
      // como si la gestión hubiera avanzado y se acababa afirmando que la
      // cita existía. Lo único que pone `ejecutado: true` es ejecutarAccion.
      return { ok: true, version: VERSION, accion, ejecutado: false, ...r };
    }

    const salida = {
      ok: true, version: VERSION, accion, ejecutado: false,
      estado: 'listo',
      requiereConfirmacion: cap.confirmacion,
      aviso: null,
      resumen: cap.resumen ? resolver(cap.resumen, r.ctx) : { accion: cap.titulo },
      payload: cap.payload ? resolver(cap.payload, r.ctx) : (params || {})
    };
    console.log(`${TAG} preparar ${accion} → listo (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
    return salida;

  } catch (e) {
    console.error(`${TAG} ❌ prepararAccionCore ${accion}:`, e.message);
    return { ok: false, version: VERSION, error: safeErr(e) };
  }
}

/**
 * EJECUTAR — escribe. NO se llama desde el bucle de la IA: lo llama el page
 * code cuando una persona confirma. SiteMember: el endpoint público no llega.
 */
export const ejecutarAccion = webMethod(
  Permissions.SiteMember,
  async ({ accion, params } = {}) => {
    const t0 = Date.now();
    try {
      const caps = await _leerCapabilities();
      const cap = caps.find(c => c.accion === String(accion || ''));
      if (!cap) return { ok: false, version: VERSION, error: { message: `Acción desconocida: ${accion}` } };

      const d = _fn(`${cap.backend}.${cap.funcion}`);
      if (d.error) return { ok: false, version: VERSION, error: { message: d.error } };

      // Se vuelve a preparar desde cero: se escribe sobre lo que el salón
      // dice AHORA, no sobre lo que se propuso hace unos minutos.
      let payload = params || {};
      let resumen = null;
      if (cap.preparar.length) {
        const prep = await prepararAccionCore({ accion, params });
        if (!prep.ok || prep.estado !== 'listo') {
          console.warn(`${TAG} ⛔ ${accion} abortada al confirmar: estado=${prep.estado || 'ko'}`);
          return { ok: false, version: VERSION, estado: prep.estado, preparacion: prep };
        }
        payload = prep.payload;
        resumen = prep.resumen;
      }

      const res = await d.fn(payload);
      if (res && res.ok === false) {
        console.error(`${TAG} ❌ ${cap.backend}.${cap.funcion} ko:`, JSON.stringify(res.error || res));
        return { ok: false, version: VERSION, error: res.error || { message: 'La operación no se ha completado.' } };
      }

      console.log(`${TAG} ✅ ${accion} ejecutada (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
      // v3.4.0 — `referencia`: el identificador de lo que se acaba de escribir.
      // Sin él, "añade un secado a la cita que acabas de crear" no tiene a qué
      // agarrarse: la nota del hilo contaba lo ocurrido pero sin ningún id.
      const referencia = (res && (res.reservaId || res._id || res.id)) ||
                         (payload && payload.reservaId) || null;
      return { ok: true, version: VERSION, ejecutado: true, resumen, referencia,
               textoHecho: cap.textoHecho || '', resultado: res };

    } catch (e) {
      console.error(`${TAG} ❌ ejecutarAccion ${accion}:`, e.message);
      return { ok: false, version: VERSION, error: safeErr(e) };
    }
  }
);

/** Diagnóstico: qué ve AKIRA y qué filas apuntan a sitios inexistentes. */
export const akiraListarAcciones = webMethod(
  Permissions.SiteMember,
  async ({ plano } = {}) => {
    const caps = await _leerCapabilities();
    const filtro = String(plano || '').trim().toLowerCase();
    const lista = caps.filter(c => !filtro || c.plano === filtro).map(c => {
      const problemas = [];
      const esc = _fn(`${c.backend}.${c.funcion}`);
      if (esc.error) problemas.push(esc.error);
      for (const p of c.preparar) {
        if (p.llama) {
          const d = _fn(p.llama);
          if (d.error) problemas.push(`paso "${p.id || p.verbo}": ${d.error}`);
        }
      }
      if (c.preparar.length && !c.payload) problemas.push('tiene pasos pero no declara payload.');
      return {
        accion: c.accion, plano: c.plano, modulo: c.modulo, titulo: c.titulo,
        escritor: `${c.backend}.${c.funcion}`,
        pasos: c.preparar.length,
        confirmacion: c.confirmacion, forzable: c.forzable,
        parametros: Object.keys(c.parametros || {}).length,
        estado: problemas.length ? 'ROTA' : 'OK',
        problemas
      };
    });
    return { ok: true, version: VERSION, total: lista.length, acciones: lista };
  }
);

export const akiraPrepararAccion = webMethod(
  Permissions.SiteMember,
  async (params) => prepararAccionCore(params)
);
