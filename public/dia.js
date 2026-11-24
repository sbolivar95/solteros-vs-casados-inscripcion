var CLAVE_SESION = "svs_clave";
var clave = "";
var gente = [];

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
  pintarColumna("solteros", "lista-solteros", "resumen-solteros");
  pintarColumna("casados", "lista-casados", "resumen-casados");
}

function pintarColumna(equipo, idLista, idResumen) {
  var lista = delEquipo(equipo);
  var pagaron = 0;
  var juegan = 0;
  var i;
  for (i = 0; i < lista.length; i += 1) {
    if (lista[i].pagado) pagaron += 1;
    if (lista[i].juega) juegan += 1;
  }
  document.getElementById(idResumen).textContent =
    lista.length + (lista.length === 1 ? " inscrito" : " inscritos") +
    " · " + pagaron + (pagaron === 1 ? " pagó" : " pagaron") +
    " · " + juegan + (juegan === 1 ? " juega" : " juegan");

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
  articulo.className = "fila-dia";
  if (persona.juega) articulo.className += " jugando";
  else if (persona.pagado) articulo.className += " pagada";

  var nombre = document.createElement("h3");
  nombre.textContent = persona.nombre;
  articulo.appendChild(nombre);

  if (persona.origen === "dia") {
    var aviso = document.createElement("p");
    aviso.className = "meta";
    aviso.textContent = "Llegó sin inscribirse";
    articulo.appendChild(aviso);
  }

  articulo.appendChild(marca(persona, "pagado", "Pagó", !!persona.pagado));
  articulo.appendChild(marca(persona, "juega", "Juega", !!persona.juega));
  return articulo;
}

function marca(persona, campo, etiqueta, marcado) {
  var label = document.createElement("label");
  label.className = "marca";
  var caja = document.createElement("input");
  caja.type = "checkbox";
  caja.checked = marcado;
  caja.addEventListener("change", function () {
    var pagado = campo === "pagado" ? caja.checked : !!persona.pagado;
    var juega = campo === "juega" ? caja.checked : !!persona.juega;
    guardarDia(persona, pagado, juega);
  });
  var texto = document.createElement("span");
  texto.textContent = etiqueta;
  label.appendChild(caja);
  label.appendChild(texto);
  return label;
}

function cargar() {
  return rpc("listar", { p_clave: clave }).then(function (lista) {
    gente = Array.isArray(lista) ? lista : [];
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

function guardarDia(persona, pagado, juega) {
  rpc("marcar_pago", { p_clave: clave, p_id: persona.id, p_pagado: pagado }).then(function () {
    return rpc("marcar_dia", {
      p_clave: clave,
      p_id: persona.id,
      p_vino: juega,
      p_juega: juega
    });
  }).then(function () {
    return cargar();
  }).catch(function (error) {
    ponerTexto("error-lista", error.message || "No se pudo guardar.");
    pintar();
  });
}

function agregar(equipo, idCampo) {
  var nombre = limpiarNombre(document.getElementById(idCampo).value);
  if (nombre.length < 2) {
    ponerTexto("error-lista", "Escribe el nombre de quien llegó.");
    return;
  }
  ponerTexto("error-lista", "");
  rpc("llegar_sin_inscribir", {
    p_clave: clave,
    p_nombre: nombre,
    p_celular: "",
    p_equipo: equipo
  }).then(function () {
    document.getElementById(idCampo).value = "";
    return cargar();
  }).catch(function (error) {
    ponerTexto("error-lista", error.message || "No se pudo agregar.");
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

document.getElementById("alta-solteros").addEventListener("submit", function (evento) {
  evento.preventDefault();
  agregar("solteros", "nombre-solteros");
});

document.getElementById("alta-casados").addEventListener("submit", function (evento) {
  evento.preventDefault();
  agregar("casados", "nombre-casados");
});

document.getElementById("salir").addEventListener("click", cerrarPanel);

var guardada = "";
try { guardada = localStorage.getItem(CLAVE_SESION) || ""; } catch (e) { guardada = ""; }
if (guardada) {
  clave = guardada;
  abrirPanel();
  cargar().catch(function () { cerrarPanel(); });
}
