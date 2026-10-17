/* ==========================================================================
   Flujo de reporte: foto → análisis IA → ubicación → folio
   ========================================================================== */

const MENSAJES_ESCANER = [
  "leyendo la foto…",
  "buscando bordes y texturas…",
  "¿asfalto, agua o residuos?",
  "midiendo qué tan grave se ve…",
  "pensando a quién le toca…",
];

/* ---------- Fotos de prueba dibujadas en canvas (para probar sin salir a la calle) ---------- */

function dibujarMuestra(tipo) {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 480;
  const g = c.getContext("2d");
  const azar = (() => { let s = tipo.length * 9301; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();

  const asfalto = (base) => {
    g.fillStyle = base; g.fillRect(0, 0, 640, 480);
    for (let i = 0; i < 9000; i++) {
      const v = 60 + azar() * 70;
      g.fillStyle = `rgb(${v},${v},${v - 4})`;
      g.fillRect(azar() * 640, azar() * 480, 2, 2);
    }
  };

  if (tipo === "bache") {
    asfalto("#5a5853");
    g.fillStyle = "#77736b";
    g.beginPath(); g.ellipse(330, 260, 190, 120, -0.1, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(330, 250, 10, 330, 260, 170);
    gr.addColorStop(0, "#0d0c0b"); gr.addColorStop(0.75, "#1f1d1a"); gr.addColorStop(1, "#33312c");
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(330, 262, 165, 100, -0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a2825"; g.lineWidth = 4;
    [[150, 230, 40, 190], [510, 240, 600, 200], [480, 330, 590, 400], [180, 320, 90, 380]].forEach(([a, b, x, y]) => {
      g.beginPath(); g.moveTo(a, b); g.lineTo(x, y); g.stroke();
    });
  } else if (tipo === "fuga") {
    asfalto("#6b6964");
    const gr = g.createRadialGradient(320, 300, 20, 320, 300, 300);
    gr.addColorStop(0, "#5f8fe8"); gr.addColorStop(0.6, "#2f62c9"); gr.addColorStop(1, "rgba(40,80,170,0)");
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(320, 300, 300, 170, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 40; i++) {
      g.beginPath(); g.ellipse(120 + azar() * 400, 210 + azar() * 170, 6 + azar() * 26, 2 + azar() * 4, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#9fc0ff";
    g.beginPath(); g.moveTo(320, 60); g.quadraticCurveTo(300, 200, 320, 300); g.quadraticCurveTo(340, 200, 320, 60); g.fill();
  } else {
    asfalto("#7a7770");
    const colores = ["#111", "#1b1b1b", "#d33", "#2a8f3a", "#f2c200", "#1e5fd8", "#ff7a00", "#eee", "#8a3fd0", "#0aa"];
    for (let i = 0; i < 70; i++) {
      g.fillStyle = colores[Math.floor(azar() * colores.length)];
      const x = 80 + azar() * 480, y = 120 + azar() * 300, w = 20 + azar() * 90, h = 14 + azar() * 70;
      g.save(); g.translate(x, y); g.rotate(azar() * 3);
      azar() > 0.5 ? g.fillRect(-w / 2, -h / 2, w, h) : (g.beginPath(), g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2), g.fill());
      g.restore();
    }
  }
  return new Promise((ok) => c.toBlob((b) => ok(new File([b], `muestra-${tipo}.jpg`, { type: "image/jpeg" })), "image/jpeg", 0.9));
}

/* ---------- Medidor de gravedad ---------- */

function Medidor({ valor }) {
  const [listo, setListo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setListo(true), 250); return () => clearTimeout(t); }, [valor]);
  const angulo = listo ? -90 + ((valor - 0.5) / 5) * 180 : -90;
  const arco = (i) => {
    const a0 = Math.PI + (i / 5) * Math.PI + 0.025, a1 = Math.PI + ((i + 1) / 5) * Math.PI - 0.025;
    const r = 80, R = 100, cx = 110, cy = 110;
    const p = (a, rr) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
    return `M${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 0 0 ${p(a0, r)}Z`;
  };
  return (
    <div className="medidor">
      <svg viewBox="0 0 220 124" role="img" aria-label={`Gravedad ${valor} de 5`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={arco(i)} fill={GRAVEDAD[i + 1].hex} opacity={i + 1 <= valor ? 1 : 0.22} />
        ))}
        <g className="medidor__aguja" style={{ transform: `rotate(${angulo}deg)` }}>
          <path d="M110 110 L106 106 L110 26 L114 106Z" fill="var(--tinta)" />
        </g>
        <circle cx="110" cy="110" r="9" fill="var(--tinta)" />
        <circle cx="110" cy="110" r="3.5" fill="var(--papel)" />
      </svg>
      <div className="medidor__lectura">
        <b>{valor}</b><span>/5</span>
        <em style={{ color: GRAVEDAD[valor].hex }}>{GRAVEDAD[valor].nombre}</em>
      </div>
    </div>
  );
}

/* ---------- Mapa para elegir ubicación ---------- */

function MapaSelector({ config, valor, onCambio }) {
  const centro = config.ciudad;
  const caja = useRef(null);
  const mapa = useRef(null);
  const marca = useRef(null);

  useEffect(() => {
    const m = L.map(caja.current, { zoomControl: true, attributionControl: true })
      .setView([centro.lat, centro.lng], centro.zoom + 1);
    capaTeselas(config).addTo(m);
    m.on("click", (e) => onCambio({ lat: e.latlng.lat, lng: e.latlng.lng }, "mapa"));
    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !valor) return;
    if (!marca.current) {
      marca.current = L.marker([valor.lat, valor.lng], {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="pin-elegido"><span></span></div>', iconSize: [36, 48], iconAnchor: [18, 46] }),
      }).addTo(m);
      marca.current.on("dragend", () => {
        const p = marca.current.getLatLng();
        onCambio({ lat: p.lat, lng: p.lng }, "mapa");
      });
    } else {
      marca.current.setLatLng([valor.lat, valor.lng]);
    }
    if (!m.getBounds().pad(-0.2).contains([valor.lat, valor.lng])) m.flyTo([valor.lat, valor.lng], 17, { duration: 0.8 });
  }, [valor]);

  return <div className="mapa-selector" ref={caja} />;
}

/* ---------- Componente principal ---------- */

function Reportar({ config, onCreado, onVerEnMapa }) {
  const [etapa, setEtapa] = useState("foto");
  const [vista, setVista] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [corregida, setCorregida] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [origen, setOrigen] = useState(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [comentario, setComentario] = useState("");
  const [cercanos, setCercanos] = useState([]);
  const [descartados, setDescartados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [final, setFinal] = useState(null);
  const entrada = useRef(null);
  const tarjeta = useRef(null);

  const categoria = corregida || analisis?.categoria;

  // Mensajes rotando mientras la IA trabaja
  useEffect(() => {
    if (etapa !== "analizando") return;
    const t = setInterval(() => setMensaje((m) => (m + 1) % MENSAJES_ESCANER.length), 1100);
    return () => clearInterval(t);
  }, [etapa]);

  // Buscar reportes parecidos cerca del punto elegido
  useEffect(() => {
    if (!ubicacion || !categoria) return;
    const t = setTimeout(() => {
      api.cercanos(ubicacion.lat, ubicacion.lng, categoria).then(setCercanos).catch(() => setCercanos([]));
    }, 350);
    return () => clearTimeout(t);
  }, [ubicacion, categoria]);

  const llevarArriba = () => tarjeta.current?.scrollIntoView({ behavior: movimientoReducido() ? "auto" : "smooth", block: "start" });

  async function procesar(archivo) {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) { setError("Ese archivo no es una imagen."); return; }
    setError(null);
    setVista(URL.createObjectURL(archivo));
    setEtapa("analizando");
    setMensaje(0);
    const inicio = Date.now();
    try {
      const r = await api.analizar(archivo);
      // Un mínimo de tiempo en pantalla para que el escaneo se entienda
      await new Promise((ok) => setTimeout(ok, Math.max(0, 2200 - (Date.now() - inicio))));
      setAnalisis(r);
      setCorregida(null);
      if (r.gps) { setUbicacion(r.gps); setOrigen("foto"); }
      setEtapa("resultado");
    } catch (e) {
      setError(e.message);
      setEtapa("foto");
    }
  }

  function usarGps() {
    if (!navigator.geolocation) { setError("Tu navegador no comparte ubicación. Marca el punto en el mapa."); return; }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setUbicacion({ lat: p.coords.latitude, lng: p.coords.longitude }); setOrigen("gps"); setBuscandoGps(false); },
      () => { setBuscandoGps(false); setError("No pudimos obtener tu ubicación. Marca el punto en el mapa."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function enviar() {
    setEnviando(true); setError(null);
    try {
      const r = await api.crear({
        borrador_id: analisis.borrador_id, lat: ubicacion.lat, lng: ubicacion.lng,
        referencia, comentario,
        categoria_corregida: corregida && corregida !== analisis.categoria ? corregida : null,
      });
      setFinal({ ...r, modo: "nuevo" });
      setEtapa("enviado");
      onCreado(r);
      llevarArriba();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function apoyarExistente(rep) {
    setEnviando(true);
    try {
      const r = await api.apoyar(rep.id);
      guardarApoyado(rep.id);
      setFinal({ ...r, modo: "apoyo" });
      setEtapa("enviado");
      onCreado(r);
      llevarArriba();
    } catch (e) { setError(e.message); } finally { setEnviando(false); }
  }

  function reiniciar() {
    setEtapa("foto"); setVista(null); setAnalisis(null); setCorregida(null); setUbicacion(null);
    setOrigen(null); setReferencia(""); setComentario(""); setCercanos([]); setDescartados(false);
    setFinal(null); setError(null);
    llevarArriba();
  }

  const numEtapa = { foto: 0, analizando: 1, resultado: 1, ubicar: 2, enviado: 3 }[etapa];
  const pasos = ["Foto", "Análisis", "Ubicación", "Folio"];

  return (
    <section className="reportar" id="reportar">
      <div className="seccion__cabeza">
        <span className="seccion__num">02</span>
        <Aparece as="h2" variante="corte" className="seccion__titulo">Reporta en<br />un minuto.</Aparece>
        <Aparece as="p" retraso={120} className="seccion__intro">
          La IA hace el papeleo: tú pones la foto y el punto. Motor activo:{" "}
          <span className={`motor motor--${config?.motor || "local"}`}>
            {config?.motor === "claude" ? "visión de Claude" : "análisis local (sin llave de API)"}
          </span>
        </Aparece>
      </div>

      <Aparece variante="escala" className="tablero">
        <div ref={tarjeta} className="tablero__ancla" />
        <ol className="pasitos" aria-label="Progreso del reporte">
          {pasos.map((p, i) => (
            <li key={p} className={i < numEtapa ? "hecho" : i === numEtapa ? "actual" : ""}>
              <span>{i < numEtapa ? <Icono nombre="palomita" tam={16} grosor={3} /> : i + 1}</span>{p}
            </li>
          ))}
        </ol>

        {error && (
          <div className="aviso aviso--error" role="alert">
            <Icono nombre="alerta" tam={20} /> {error}
            <button onClick={() => setError(null)} aria-label="Cerrar aviso"><Icono nombre="cerrar" tam={16} /></button>
          </div>
        )}

        {/* ---------- 1. FOTO ---------- */}
        {etapa === "foto" && (
          <div className="etapa etapa--foto" key="foto">
            <label
              className={`zona ${arrastrando ? "zona--encima" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesar(e.dataTransfer.files[0]); }}
            >
              <input ref={entrada} type="file" accept="image/*" capture="environment"
                     onChange={(e) => procesar(e.target.files[0])} />
              <div className="zona__icono"><Icono nombre="camara" tam={46} grosor={1.8} /></div>
              <strong>Suelta aquí tu foto</strong>
              <span>o toca para abrir la cámara · JPG, PNG o WEBP hasta 10 MB</span>
            </label>
            <div className="muestras">
              <span>¿Sin foto a la mano? Prueba con una de muestra:</span>
              {["bache", "fuga", "basura"].map((t) => (
                <button key={t} className={`chip chip--${t}`} onClick={async () => procesar(await dibujarMuestra(t))}>
                  <Icono nombre={t} tam={18} /> {CATS[t].nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- 2. ANÁLISIS ---------- */}
        {(etapa === "analizando" || etapa === "resultado") && (
          <div className="etapa etapa--analisis" key="analisis">
            <div className={`visor ${etapa === "analizando" ? "visor--escaneando" : "visor--listo"}`}>
              <img src={vista} alt="Tu foto" />
              <div className="visor__rejilla" />
              <div className="escaneo" />
              <span className="esquina esquina--1" /><span className="esquina esquina--2" />
              <span className="esquina esquina--3" /><span className="esquina esquina--4" />
              {etapa === "analizando" && <div className="visor__mensaje" key={mensaje}>{MENSAJES_ESCANER[mensaje]}</div>}
            </div>

            {etapa === "analizando" ? (
              <div className="resultado resultado--esperando">
                <div className="esqueleto esqueleto--sello" />
                <div className="esqueleto" /><div className="esqueleto esqueleto--corto" />
                <div className="esqueleto esqueleto--medidor" />
              </div>
            ) : (
              <div className="resultado">
                <div className={`sello sello--${categoria}`}>
                  <Icono nombre={categoria} tam={34} />
                  <span>{CATS[categoria].nombre}</span>
                </div>
                <h3 className="resultado__titulo">{analisis.titulo}</h3>
                <p className="resultado__desc">{analisis.descripcion}</p>

                <div className="resultado__fila">
                  <Medidor valor={analisis.gravedad} />
                  <div className="confianza">
                    <span className="mini">Confianza de la IA</span>
                    <b>{analisis.confianza}%</b>
                    <div className="confianza__barra"><i style={{ "--v": `${analisis.confianza}%` }} /></div>
                    <span className="mini">
                      {analisis.motor === "claude" ? `Visión de Claude` : "Heurística local"}
                    </span>
                  </div>
                </div>

                {analisis.factores.length > 0 && (
                  <div className="lista-ia">
                    <span className="mini">Lo que vio</span>
                    <ul>{analisis.factores.map((f, i) => <li key={i} style={{ "--i": i }}>{f}</li>)}</ul>
                  </div>
                )}
                {analisis.riesgos.length > 0 && (
                  <div className="riesgos">
                    {analisis.riesgos.map((r, i) => <span key={i} style={{ "--i": i }}>{r}</span>)}
                  </div>
                )}

                <div className="destino">
                  <Icono nombre="reloj" tam={22} />
                  <div>
                    <span className="mini">Lo atiende</span>
                    <b>{corregida && corregida !== analisis.categoria ? "Se reasigna al enviar" : analisis.dependencia}</b>
                    <span>Meta de atención: {analisis.sla_horas} h</span>
                  </div>
                </div>

                {analisis.aviso && <p className="aviso aviso--suave">{analisis.aviso}</p>}

                <div className="corregir">
                  <span className="mini">¿La IA se equivocó? Corrige la categoría</span>
                  <div className="segmentos" role="radiogroup">
                    {Object.keys(CATS).map((c) => (
                      <button key={c} role="radio" aria-checked={categoria === c}
                              className={categoria === c ? "activo" : ""} onClick={() => setCorregida(c)}>
                        <Icono nombre={c} tam={16} /> {CATS[c].nombre}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="acciones">
                  <button className="btn btn--fantasma" onClick={reiniciar}>Otra foto</button>
                  <button className="btn btn--cono" onClick={() => setEtapa("ubicar")}>
                    Ubicar en el mapa <Icono nombre="flecha" tam={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- 3. UBICACIÓN ---------- */}
        {etapa === "ubicar" && config && (
          <div className="etapa etapa--ubicar" key="ubicar">
            <div className="ubicar__mapa">
              <MapaSelector config={config} valor={ubicacion}
                            onCambio={(p, o) => { setUbicacion(p); setOrigen(o); setDescartados(false); }} />
              {!ubicacion && <div className="ubicar__pista"><Icono nombre="pin" tam={18} /> Toca el mapa donde está el problema</div>}
            </div>
            <div className="ubicar__datos">
              <div className="ubicar__resumen">
                <span className={`chip chip--${categoria}`}><Icono nombre={categoria} tam={16} /> {CATS[categoria].nombre}</span>
                <PuntosGravedad valor={analisis.gravedad} />
                <span className="mini">{analisis.titulo}</span>
              </div>

              <button className="btn btn--linea btn--ancho" onClick={usarGps} disabled={buscandoGps}>
                <Icono nombre="mira" tam={20} /> {buscandoGps ? "Buscando señal…" : "Usar mi ubicación actual"}
              </button>
              {ubicacion && (
                <p className="coordenadas">
                  {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                  <em>{{ foto: "tomada de la foto", gps: "de tu GPS", mapa: "marcada a mano" }[origen]} · puedes arrastrar el pin</em>
                </p>
              )}

              {cercanos.length > 0 && !descartados && (
                <div className="duplicado">
                  <div className="franja" />
                  <p>
                    <b>Ya hay un reporte de {CATS[categoria].nombre.toLowerCase()} a {cercanos[0].distancia_m} m</b>
                    {" "}({cercanos[0].folio} · {ESTADOS[cercanos[0].estado].toLowerCase()} · {cercanos[0].apoyos} apoyos).
                    ¿Es el mismo?
                  </p>
                  <div className="acciones">
                    <button className="btn btn--tinta btn--chico" disabled={enviando} onClick={() => apoyarExistente(cercanos[0])}>
                      <Icono nombre="mano" tam={18} /> Sí, sumar mi apoyo
                    </button>
                    <button className="btn btn--fantasma btn--chico" onClick={() => setDescartados(true)}>No, es otro</button>
                  </div>
                </div>
              )}

              <label className="campo">
                <span>Referencia <em>(opcional)</em></span>
                <input value={referencia} maxLength={140} onChange={(e) => setReferencia(e.target.value)}
                       placeholder="Ej. frente a la panadería, carril derecho" />
              </label>
              <label className="campo">
                <span>Comentario para el municipio <em>(opcional)</em></span>
                <textarea value={comentario} maxLength={600} rows={3} onChange={(e) => setComentario(e.target.value)}
                          placeholder="¿Desde cuándo está? ¿Ha causado accidentes?" />
              </label>

              <div className="acciones">
                <button className="btn btn--fantasma" onClick={() => setEtapa("resultado")}>Atrás</button>
                <button className="btn btn--cono" disabled={!ubicacion || enviando} onClick={enviar}>
                  {enviando ? "Enviando…" : "Enviar al municipio"} <Icono nombre="flecha" tam={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- 4. FOLIO ---------- */}
        {etapa === "enviado" && final && (
          <div className="etapa etapa--enviado" key="enviado">
            <div className="boleto">
              <div className="boleto__sello">{final.modo === "apoyo" ? "Apoyo sumado" : "Recibido"}</div>
              <span className="mini">{final.modo === "apoyo" ? "Te sumaste al reporte" : "Tu folio"}</span>
              <div className="boleto__folio">{final.folio}</div>
              <dl>
                <div><dt>Categoría</dt><dd>{CATS[final.categoria].nombre}</dd></div>
                <div><dt>Gravedad</dt><dd>{final.gravedad}/5 · {GRAVEDAD[final.gravedad].nombre}</dd></div>
                <div><dt>Atiende</dt><dd>{final.dependencia}</dd></div>
                <div><dt>Plazo</dt><dd>{final.sla_horas} h · {plazo(final.vence)}</dd></div>
                <div><dt>Apoyos</dt><dd>{final.apoyos}</dd></div>
              </dl>
              <div className="boleto__corte" />
              <p>Guarda tu folio para dar seguimiento. Gracias por cuidar la calle.</p>
            </div>
            <div className="acciones acciones--centro">
              <button className="btn btn--linea" onClick={() => onVerEnMapa(final.id)}>
                <Icono nombre="pin" tam={20} /> Verlo en el mapa
              </button>
              <button className="btn btn--cono" onClick={reiniciar}>
                <Icono nombre="camara" tam={20} /> Reportar otro
              </button>
            </div>
          </div>
        )}
      </Aparece>
    </section>
  );
}
