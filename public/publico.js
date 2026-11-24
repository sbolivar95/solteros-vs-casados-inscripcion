var MARCA = "svs_inscripcion";
var equipoElegido = "";

function leerMarca() {
  try {
    var crudo = localStorage.getItem(MARCA);
    if (!crudo) return null;
    var datos = JSON.parse(crudo);
    if (!datos || !datos.nombre || (datos.equipo !== "solteros" && datos.equipo !== "casados")) return null;
    return datos;
  } catch (e) {
    return null;
  }
}

function guardarMarca(nombre, equipo) {
  try {
    localStorage.setItem(MARCA, JSON.stringify({ nombre: nombre, equipo: equipo }));
  } catch (e) {}
}

function elegir(equipo) {
  equipoElegido = equipo;
  document.getElementById("elegir-solteros").setAttribute("aria-pressed", equipo === "solteros" ? "true" : "false");
  document.getElementById("elegir-casados").setAttribute("aria-pressed", equipo === "casados" ? "true" : "false");
}

function mostrarError(texto) {
  document.getElementById("error").textContent = texto || "";
}

function mostrarListo(nombre, equipo) {
  document.getElementById("form").hidden = true;
  document.getElementById("listo").hidden = false;
  document.getElementById("listo-titulo").textContent = "Listo, " + nombre;
  document.getElementById("listo-detalle").textContent = "Quedaste en " + (equipo === "solteros" ? "Solteros" : "Casados") + ".";
  document.getElementById("link-listo").value = urlPublica();
}

function validar() {
  var nombre = limpiarNombre(document.getElementById("nombre").value);
  var celular = soloDigitos(document.getElementById("celular").value);
  if (nombre.length < 2 || nombre.length > 80) return { error: "Escribe el nombre, entre 2 y 80 letras." };
  if (!/^[0-9]{8,15}$/.test(celular)) return { error: "Escribe un celular válido, de 8 a 15 números." };
  if (equipoElegido !== "solteros" && equipoElegido !== "casados") return { error: "Elige Solteros o Casados." };
  if (!document.getElementById("compromiso").checked) return { error: "Marca el compromiso de pago para inscribirte." };
  return { nombre: nombre, celular: celular, equipo: equipoElegido };
}

function compartir() {
  var url = urlPublica();
  var texto = "Inscripción al partido del 29 de noviembre";
  if (navigator.share) {
    return navigator.share({ title: "Solteros vs Casados", text: texto, url: url }).catch(function (err) {
      if (err && err.name === "AbortError") return;
      return copiarLink(url);
    });
  }
  return copiarLink(url);
}

function copiarLink(url) {
  var aviso = document.getElementById("copiado");
  return copiarTexto(url).then(function () {
    aviso.hidden = false;
    aviso.textContent = "Link copiado.";
  }).catch(function () {
    aviso.hidden = false;
    aviso.textContent = "Copia el link del recuadro.";
    document.getElementById("link-listo").value = url;
  });
}

document.getElementById("elegir-solteros").addEventListener("click", function () { elegir("solteros"); });
document.getElementById("elegir-casados").addEventListener("click", function () { elegir("casados"); });
document.getElementById("compartir-listo").addEventListener("click", compartir);

document.getElementById("form").addEventListener("submit", function (evento) {
  evento.preventDefault();
  if (leerMarca()) {
    var ya = leerMarca();
    mostrarListo(ya.nombre, ya.equipo);
    return;
  }
  var datos = validar();
  if (datos.error) {
    mostrarError(datos.error);
    return;
  }
  if (inscripcionCerrada()) {
    mostrarCerrado();
    return;
  }
  mostrarError("");
  var boton = document.getElementById("enviar");
  boton.disabled = true;
  boton.textContent = "Guardando…";
  inscribirPublico({
    nombre: datos.nombre,
    celular: datos.celular,
    equipo: datos.equipo,
    origen: "link"
  }).then(function () {
    guardarMarca(datos.nombre, datos.equipo);
    mostrarListo(datos.nombre, datos.equipo);
  }).catch(function (error) {
    mostrarError(error.message || "No se pudo inscribir.");
  }).then(function () {
    boton.disabled = false;
    boton.textContent = "Inscribirme";
  });
});

document.getElementById("link-listo").value = urlPublica();

function mostrarCerrado() {
  document.getElementById("form").hidden = true;
  document.getElementById("aviso-cierre").hidden = true;
  document.getElementById("cerrado").hidden = false;
}

var marca = leerMarca();
if (marca) mostrarListo(marca.nombre, marca.equipo);
else if (inscripcionCerrada()) mostrarCerrado();
