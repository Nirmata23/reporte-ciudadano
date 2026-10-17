/* ==========================================================================
   Panel para el municipio: indicadores, distribución y cola de atención
   ========================================================================== */

function Indicador({ etiqueta, valor, sufijo = "", nota, tono, activo, retraso }) {
  const n = useContador(valor ?? 0, activo);
  return (
    <Aparece variante="sube" retraso={retraso} className={`indicador ${tono ? `indicador--${tono}` : ""}`}>
      <span className="mini">{etiqueta}</span>
      <b>{valor == null ? "—" : n}<small>{valor == null ? "" : sufijo}</small></b>
      {nota && <em>{nota}</em>}
    </Aparece>
  );
}

function Panel({ stats, reportes, onActualizar, onVerEnMapa }) {
  const [ref, visto] = useVisto(0.15);
  const [todos, setTodos] = useState(false);
  const [guardando, setGuardando] = useState(null);

  const cola = useMemo(() => reportes
    .filter((r) => r.estado !== "resuelto")
    .sort((a, b) => b.prioridad - a.prioridad), [reportes]);

  // Mismo <section> antes y después de cargar: así el observador de visibilidad sigue enganchado
  if (!stats) return <section className="panel" id="municipio" ref={ref} />;

  const maxCat = Math.max(1, ...Object.values(stats.por_categoria));
  const maxGrav = Math.max(1, ...Object.values(stats.por_gravedad));
  const pctResuelto = stats.total ? Math.round((stats.resueltos / stats.total) * 100) : 0;

  async function cambiar(id, estado) {
    setGuardando(id);
    try { await api.estado(id, estado); await onActualizar(); } finally { setGuardando(null); }
  }

  return (
    <section className="panel" id="municipio" ref={ref}>
      <div className="seccion__cabeza seccion__cabeza--claro">
        <span className="seccion__num">04</span>
        <Aparece as="h2" variante="corte" className="seccion__titulo">Para quien<br />arregla la calle.</Aparece>
        <Aparece as="p" retraso={120} className="seccion__intro">
          La misma información, ordenada para decidir: qué es más urgente, qué ya se pasó de plazo y a quién le toca.
        </Aparece>
      </div>

      <div className="indicadores">
        <Indicador etiqueta="Abiertos" valor={stats.abiertos} nota={`${stats.ultima_semana} nuevos esta semana`} activo={visto} retraso={0} />
        <Indicador etiqueta="Gravedad 4–5 sin atender" valor={stats.criticos_abiertos} tono="rojo" nota="prioridad inmediata" activo={visto} retraso={80} />
        <Indicador etiqueta="Fuera de plazo" valor={stats.vencidos} tono="linea" nota="superaron su meta de atención" activo={visto} retraso={160} />
        <Indicador etiqueta="Tiempo medio de solución" valor={stats.horas_promedio_resolucion} sufijo=" h" nota={`${pctResuelto}% del total ya resuelto`} activo={visto} retraso={240} />
        <Indicador etiqueta="Apoyos vecinales" valor={stats.apoyos} nota={`${stats.correcciones_ia} correcciones hechas a la IA`} activo={visto} retraso={320} />
      </div>

      <div className="graficas">
        <Aparece variante="izq" className="grafica">
          <h3>Reportes por tipo <span className="mini">total histórico</span></h3>
          <ul className="barras">
            {Object.keys(CATS).filter((c) => stats.por_categoria[c]).map((c, i) => (
              <li key={c} title={`${CATS[c].plural}: ${stats.por_categoria[c]} reportes`}>
                <span className="barras__nombre"><Icono nombre={c} tam={18} /> {CATS[c].plural}</span>
                <span className="barras__pista">
                  <i style={{
                    width: visto ? `${(stats.por_categoria[c] / maxCat) * 100}%` : 0,
                    background: CATS[c].claro, transitionDelay: `${200 + i * 120}ms`,
                  }} />
                </span>
                <b>{stats.por_categoria[c]}</b>
              </li>
            ))}
          </ul>
        </Aparece>

        <Aparece variante="sube" retraso={100} className="grafica">
          <h3>Gravedad de lo abierto <span className="mini">reportes por nivel</span></h3>
          <div className="columnas">
            {[1, 2, 3, 4, 5].map((g) => {
              const v = stats.por_gravedad[String(g)];
              return (
                <div key={g} className="columnas__col" title={`Gravedad ${g} (${GRAVEDAD[g].nombre}): ${v} abiertos`}>
                  <b>{v}</b>
                  <span className="columnas__pista">
                    <i style={{ height: visto ? `${(v / maxGrav) * 100}%` : 0, background: GRAVEDAD[g].hex, transitionDelay: `${250 + g * 90}ms` }} />
                  </span>
                  <small>{g}<em>{GRAVEDAD[g].nombre}</em></small>
                </div>
              );
            })}
          </div>
        </Aparece>

        <Aparece variante="der" retraso={200} className="grafica">
          <h3>Dónde está cada reporte <span className="mini">flujo de atención</span></h3>
          <div className="tubo">
            {Object.keys(ESTADOS).map((e, i) => (
              <div key={e} className={`tubo__tramo tubo__tramo--${e}`}
                   style={{ flexGrow: Math.max(stats.por_estado[e], 0.4), transitionDelay: `${300 + i * 120}ms` }}
                   title={`${ESTADOS[e]}: ${stats.por_estado[e]}`}>
                <b>{stats.por_estado[e]}</b>
              </div>
            ))}
          </div>
          <ul className="tubo__leyenda">
            {Object.keys(ESTADOS).map((e) => (
              <li key={e}><i className={`tubo__punto tubo__tramo--${e}`} />{ESTADOS[e]} · {stats.por_estado[e]}</li>
            ))}
          </ul>
        </Aparece>
      </div>

      <Aparece variante="sube" className="cola">
        <div className="cola__cabeza">
          <h3>Cola de atención</h3>
          <span className="mini">Ordenada por prioridad = gravedad + apoyos + antigüedad</span>
        </div>
        <div className="cola__tabla" role="table" aria-label="Cola de atención">
          <div className="cola__fila cola__fila--cabeza" role="row">
            <span role="columnheader">Folio</span><span role="columnheader">Reporte</span>
            <span role="columnheader">Gravedad</span><span role="columnheader">Prioridad</span>
            <span role="columnheader">Plazo</span><span role="columnheader">Estado</span>
          </div>
          {(todos ? cola : cola.slice(0, 10)).map((r, i) => (
            <div className={`cola__fila ${guardando === r.id ? "cola__fila--guardando" : ""}`} role="row" key={r.id}
                 style={{ "--i": i }}>
              <span role="cell" className="cola__folio">
                <button className="enlace" onClick={() => onVerEnMapa(r.id)} title="Ver en el mapa">{r.folio}</button>
              </span>
              <span role="cell" className="cola__reporte">
                <i style={{ color: CATS[r.categoria].claro }}><Icono nombre={r.categoria} tam={18} /></i>
                <span><b>{r.titulo}</b><small>{r.dependencia}</small></span>
              </span>
              <span role="cell"><PuntosGravedad valor={r.gravedad} /></span>
              <span role="cell" className="cola__prioridad">
                <span className="cola__medida"><i style={{ width: `${r.prioridad}%` }} /></span>
                <b>{r.prioridad}</b>
              </span>
              <span role="cell" className={r.vencido ? "rojo" : ""}>
                {r.vencido && <Icono nombre="alerta" tam={14} />} {plazo(r.vence)}
              </span>
              <span role="cell">
                <select value={r.estado} onChange={(e) => cambiar(r.id, e.target.value)} disabled={guardando === r.id}
                        aria-label={`Estado de ${r.folio}`}>
                  {Object.entries(ESTADOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </span>
            </div>
          ))}
        </div>
        {cola.length > 10 && (
          <button className="btn btn--linea btn--chico cola__mas" onClick={() => setTodos(!todos)}>
            {todos ? "Mostrar sólo los 10 más urgentes" : `Ver los ${cola.length} abiertos`}
          </button>
        )}
      </Aparece>
    </section>
  );
}

function Pie({ config }) {
  return (
    <footer className="pie">
      <div className="franja" />
      <div className="pie__cuerpo">
        <p className="pie__marca">banqueta<b>.</b></p>
        <div className="pie__datos">
          <p>Reporte ciudadano inteligente para {config?.ciudad?.nombre || "tu municipio"}.</p>
          <p className="mini">
            Clasificación con {config?.motor === "claude" ? `Claude (${config.modelo})` : "heurística local"} · Mapa {config?.teselas?.atribucion}
          </p>
        </div>
      </div>
    </footer>
  );
}
