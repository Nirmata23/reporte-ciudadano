/* ==========================================================================
   Mapa público de reportes con filtros, lista sincronizada y ficha de detalle
   ========================================================================== */

// Glifos en texto SVG para los marcadores de Leaflet (que no renderizan React)
const GLIFOS = {
  bache: '<path d="M5 19c0-3 5-6 11-6s11 3 11 6-5 5-11 5-11-2-11-5Z"/><path d="M10 18.5c1.5-1.6 3.6-2.3 6-2.3s4.6.7 6 2.3"/>',
  fuga: '<path d="M16 4c4.5 6 7 9.7 7 13a7 7 0 0 1-14 0c0-3.3 2.5-7 7-13Z"/>',
  basura: '<path d="M12 9c-1-2 0-4 4-4s5 2 4 4"/><path d="M10 9h12l3 6c1.5 3 1 7-1.5 9.5S18 28 16 28s-5-.5-7.5-3.5S5.5 18 7 15Z"/>',
  otro: '<circle cx="16" cy="16" r="11"/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.6"/>',
};

function iconoMarcador(r) {
  const tam = 24 + r.gravedad * 4;
  const svg = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${GLIFOS[r.categoria]}</svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="marcador marcador--${r.categoria} ${r.estado === "resuelto" ? "marcador--resuelto" : ""} ${r.gravedad >= 5 && r.estado !== "resuelto" ? "marcador--critico" : ""}" style="--tam:${tam}px">${svg}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

function leerApoyados() {
  try { return new Set(JSON.parse(localStorage.getItem("banqueta-apoyos") || "[]")); } catch (_) { return new Set(); }
}
function guardarApoyado(id) {
  try {
    const s = leerApoyados(); s.add(id);
    localStorage.setItem("banqueta-apoyos", JSON.stringify([...s]));
  } catch (_) {}
}

function Mapa({ config, reportes, enfoque, setEnfoque, onActualizar }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const marcadores = useRef({});
  const [cats, setCats] = useState(new Set(["bache", "fuga", "basura", "otro"]));
  const [gravMin, setGravMin] = useState(1);
  const [vista, setVista] = useState("abiertos");
  const [apoyados, setApoyados] = useState(leerApoyados);

  const filtrados = useMemo(() => reportes.filter((r) =>
    cats.has(r.categoria) && r.gravedad >= gravMin &&
    (vista === "todos" || (vista === "abiertos" ? r.estado !== "resuelto" : r.estado === "resuelto"))
  ), [reportes, cats, gravMin, vista]);

  const conteo = useMemo(() => {
    const c = { bache: 0, fuga: 0, basura: 0, otro: 0 };
    reportes.forEach((r) => c[r.categoria]++);
    return c;
  }, [reportes]);

  const seleccionado = reportes.find((r) => r.id === enfoque) || null;

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!config || mapa.current) return;
    const m = L.map(caja.current, { zoomControl: false, scrollWheelZoom: false })
      .setView([config.ciudad.lat, config.ciudad.lng], config.ciudad.zoom);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    capaTeselas(config).addTo(m);
    // Rueda del mouse sólo después de hacer clic en el mapa: no secuestra el scroll de la página
    m.on("click", () => m.scrollWheelZoom.enable());
    m.on("mouseout", () => m.scrollWheelZoom.disable());
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
  }, [config]);

  // Redibujar marcadores al cambiar filtros o datos
  useEffect(() => {
    if (!capa.current) return;
    capa.current.clearLayers();
    marcadores.current = {};
    filtrados.forEach((r) => {
      const mk = L.marker([r.lat, r.lng], { icon: iconoMarcador(r), riseOnHover: true, title: r.titulo })
        .on("click", () => setEnfoque(r.id));
      mk.addTo(capa.current);
      marcadores.current[r.id] = mk;
    });
  }, [filtrados, config]);

  // Volar al reporte enfocado
  useEffect(() => {
    if (!seleccionado || !mapa.current) return;
    mapa.current.flyTo([seleccionado.lat, seleccionado.lng], Math.max(mapa.current.getZoom(), 16), { duration: movimientoReducido() ? 0 : 0.9 });
    Object.values(marcadores.current).forEach((mk) => mk.getElement()?.firstChild?.classList.remove("marcador--activo"));
    marcadores.current[seleccionado.id]?.getElement()?.firstChild?.classList.add("marcador--activo");
  }, [enfoque, filtrados]);

  const resaltar = (id, si) => marcadores.current[id]?.getElement()?.firstChild?.classList.toggle("marcador--resaltado", si);

  const alternarCat = (c) => setCats((prev) => {
    const s = new Set(prev);
    s.has(c) ? s.delete(c) : s.add(c);
    return s.size ? s : prev;
  });

  async function apoyar(id) {
    await api.apoyar(id);
    guardarApoyado(id);
    setApoyados(leerApoyados());
    onActualizar();
  }

  return (
    <section className="mapa" id="mapa">
      <div className="seccion__cabeza">
        <span className="seccion__num">03</span>
        <Aparece as="h2" variante="corte" className="seccion__titulo">La ciudad,<br />punto por punto.</Aparece>
        <Aparece as="p" retraso={120} className="seccion__intro">
          Cada marca es un reporte de un vecino. El tamaño indica la gravedad; las que laten son críticas.
        </Aparece>
      </div>

      <Aparece variante="sube" className="mapa__filtros">
        <div className="filtro">
          <span className="mini">Tipo</span>
          <div className="filtro__chips">
            {Object.keys(CATS).map((c) => (
              <button key={c} className={`chip chip--${c} ${cats.has(c) ? "chip--on" : "chip--off"}`}
                      aria-pressed={cats.has(c)} onClick={() => alternarCat(c)}>
                <Icono nombre={c} tam={16} /> {CATS[c].plural} <b>{conteo[c]}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="filtro">
          <span className="mini">Gravedad mínima: <b style={{ color: GRAVEDAD[gravMin].hex }}>{gravMin} · {GRAVEDAD[gravMin].nombre}</b></span>
          <input type="range" min="1" max="5" step="1" value={gravMin} className="rango"
                 style={{ "--p": `${((gravMin - 1) / 4) * 100}%`, "--c": GRAVEDAD[gravMin].hex }}
                 onChange={(e) => setGravMin(Number(e.target.value))} aria-label="Gravedad mínima" />
        </div>
        <div className="filtro">
          <span className="mini">Mostrar</span>
          <div className="segmentos segmentos--chicos">
            {[["abiertos", "Abiertos"], ["resueltos", "Resueltos"], ["todos", "Todos"]].map(([v, t]) => (
              <button key={v} className={vista === v ? "activo" : ""} onClick={() => setVista(v)}>{t}</button>
            ))}
          </div>
        </div>
      </Aparece>

      <div className="mapa__cuerpo">
        <aside className="mapa__lista" aria-label="Lista de reportes">
          <p className="mapa__total"><b>{filtrados.length}</b> reportes en vista</p>
          {filtrados.length === 0 && <p className="vacio">Nada con esos filtros. Bien por la ciudad… o afloja los filtros.</p>}
          {filtrados.map((r) => (
            <button key={r.id} className={`fila fila--${r.categoria} ${enfoque === r.id ? "fila--activa" : ""}`}
                    onMouseEnter={() => resaltar(r.id, true)} onMouseLeave={() => resaltar(r.id, false)}
                    onClick={() => setEnfoque(r.id)}>
              <span className="fila__icono"><Icono nombre={r.categoria} tam={20} /></span>
              <span className="fila__texto">
                <b>{r.titulo}</b>
                <small>{r.folio} · {haceCuanto(r.creado)}{r.referencia ? ` · ${r.referencia}` : ""}</small>
              </span>
              <span className="fila__meta">
                <PuntosGravedad valor={r.gravedad} />
                <em className={`estado estado--${r.estado}`}>{ESTADOS[r.estado]}</em>
              </span>
            </button>
          ))}
        </aside>

        <div className="mapa__lienzo">
          <div className="mapa__leaflet" ref={caja} />
          <div className="mapa__leyenda" aria-hidden="true">
            {[1, 3, 5].map((g) => <span key={g}><i style={{ width: 8 + g * 3, height: 8 + g * 3 }} />{g}</span>)}
            <em>gravedad</em>
          </div>

          {seleccionado && (
            <article className={`ficha ficha--${seleccionado.categoria}`} key={seleccionado.id}>
              <button className="ficha__cerrar" onClick={() => setEnfoque(null)} aria-label="Cerrar ficha">
                <Icono nombre="cerrar" tam={18} />
              </button>
              <div className="ficha__foto">
                {seleccionado.imagen_url ? <img src={seleccionado.imagen_url} alt={seleccionado.titulo} />
                                         : <SinFoto categoria={seleccionado.categoria} />}
                <span className={`chip chip--${seleccionado.categoria} chip--solido`}>
                  <Icono nombre={seleccionado.categoria} tam={14} /> {CATS[seleccionado.categoria].nombre}
                </span>
              </div>
              <div className="ficha__cuerpo">
                <span className="mini">{seleccionado.folio} · {haceCuanto(seleccionado.creado)}</span>
                <h3>{seleccionado.titulo}</h3>
                <div className="ficha__linea">
                  <PuntosGravedad valor={seleccionado.gravedad} />
                  <span>{GRAVEDAD[seleccionado.gravedad].nombre}</span>
                  <em className={`estado estado--${seleccionado.estado}`}>{ESTADOS[seleccionado.estado]}</em>
                </div>
                {seleccionado.descripcion && <p>{seleccionado.descripcion}</p>}
                {seleccionado.referencia && <p className="ficha__ref"><Icono nombre="pin" tam={14} /> {seleccionado.referencia}</p>}
                {seleccionado.comentario && <blockquote>“{seleccionado.comentario}”</blockquote>}
                <dl>
                  <div><dt>Atiende</dt><dd>{seleccionado.dependencia}</dd></div>
                  <div><dt>Plazo</dt><dd className={seleccionado.vencido ? "rojo" : ""}>
                    {seleccionado.estado === "resuelto" ? "Atendido" : plazo(seleccionado.vence)}
                  </dd></div>
                </dl>
                {seleccionado.estado !== "resuelto" && (
                  <button className="btn btn--tinta btn--ancho" disabled={apoyados.has(seleccionado.id)}
                          onClick={() => apoyar(seleccionado.id)}>
                    <Icono nombre="mano" tam={18} />
                    {apoyados.has(seleccionado.id) ? `Ya lo apoyaste · ${seleccionado.apoyos}` : `A mí también me afecta · ${seleccionado.apoyos}`}
                  </button>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
