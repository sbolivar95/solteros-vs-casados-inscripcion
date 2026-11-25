var CLAVE_SESION = "svs_clave";
var clave = "";
var gente = [];
var estado = null;

function ponerTexto(id, texto) {
  document.getElementById(id).textContent = texto || "";
}

function abrirPanel() {
  document.documentElement.className += document.documentElement.className.indexOf("hay-clave") === -1 ? " hay-clave" : "";
  document.getElementById("entrada").hidden = true;
  document.getElementById("panel").hidden = false;
}

function cerrarPanel() {
  clave = "";
  try { localStorage.removeItem(CLAVE_SESION); } catch (e) {}
  document.documentElement.className = document.documentElement.className.replace(/\bhay-clave\b/g, "");
  document.getElementById("panel").hidden = true;
  document.getElementById("entrada").hidden = false;
  document.getElementById("clave").value = "";
}

function delEquipo(equipo) {
  var lista = [];
  var i;
  for (i = 0; i < gente.length; i += 1) {
    if (gente[i].equipo === equipo) lista.push(gente[i]);
  }
  return lista;
}

function pintar() {
  mostrarCuotaFija("cuota-dia");
  mostrarRecaudado("recaudado", "recaudado-detalle", gente);
  pintarColumna("solteros", "lista-solteros", "resumen-solteros");
  pintarColumna("casados", "lista-casados", "resumen-casados");
}

function pintarColumna(equipo, idLista, idResumen) {
  var lista = delEquipo(equipo);
  var pagaron = 0;
  var i;
  for (i = 0; i < lista.length; i += 1) {
    if (lista[i].pagado) pagaron += 1;
  }
  document.getElementById(idResumen).textContent =
    lista.length + (lista.length === 1 ? " inscrito" : " inscritos") +
    " · " + pagaron + (pagaron === 1 ? " pagó" : " pagaron") +
    " · " + textoBs(pagaron * cuotaFija());

  var raiz = document.getElementById(idLista);
  raiz.innerHTML = "";
  if (!lista.length) {
    var vacio = document.createElement("p");
    vacio.className = "ayuda";
    vacio.textContent = "Nadie en este equipo.";
    raiz.appendChild(vacio);
    return;
  }
  for (i = 0; i < lista.length; i += 1) raiz.appendChild(filaPersona(lista[i]));
}

function filaPersona(persona) {
  var articulo = document.createElement("article");
  articulo.className = persona.pagado ? "fila-dia pagada" : "fila-dia";

  var nombre = document.createElement("h3");
  nombre.textContent = persona.nombre;
  articulo.appendChild(nombre);
  articulo.appendChild(marcaPago(persona));
  return articulo;
}

function marcaPago(persona) {
  var label = document.createElement("label");
  label.className = "marca";
  var caja = document.createElement("input");
  caja.type = "checkbox";
  caja.checked = !!persona.pagado;
  caja.addEventListener("change", function () {
    guardarPago(persona, caja.checked);
  });
  var texto = document.createElement("span");
  texto.textContent = "Pagó";
  label.appendChild(caja);
  label.appendChild(texto);
  return label;
}

function cargar() {
  return Promise.all([
    rpc("listar", { p_clave: clave }),
    rpc("resumen").catch(function () { return null; })
  ]).then(function (partes) {
    gente = ordenarPorInscripcion(Array.isArray(partes[0]) ? partes[0] : []);
    estado = leerEstado(partes[1]);
    ponerTexto("error-lista", "");
    pintar();
  });
}

function entrarCon(valor) {
  return rpc("entrar", { p_clave: valor }).then(function (respuesta) {
    if (!respuesta || !respuesta.ok) {
      throw new Error("La clave no es correcta.");
    }
    clave = valor;
    try { localStorage.setItem(CLAVE_SESION, valor); } catch (e) {}
    abrirPanel();
    return cargar();
  });
}

function guardarPago(persona, pagado) {
  rpc("marcar_pago", { p_clave: clave, p_id: persona.id, p_pagado: pagado }).then(function () {
    return cargar();
  }).catch(function (error) {
    ponerTexto("error-lista", error.message || "No se pudo guardar.");
    pintar();
  });
}

document.getElementById("entrada").addEventListener("submit", function (evento) {
  evento.preventDefault();
  var boton = document.getElementById("boton-entrar");
  boton.disabled = true;
  entrarCon(document.getElementById("clave").value).catch(function (error) {
    ponerTexto("error-entrada", error.message || "No se pudo entrar.");
  }).then(function () {
    boton.disabled = false;
  });
});

document.getElementById("salir").addEventListener("click", cerrarPanel);

var guardada = "";
try { guardada = localStorage.getItem(CLAVE_SESION) || ""; } catch (e) { guardada = ""; }
if (guardada) {
  clave = guardada;
  abrirPanel();
  cargar().catch(function () { cerrarPanel(); });
}
