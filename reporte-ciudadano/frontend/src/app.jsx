/* ==========================================================================
   Raíz de la aplicación: carga datos y conecta las secciones
   ========================================================================== */

function App() {
  const [config, setConfig] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [stats, setStats] = useState(null);
  const [enfoque, setEnfoque] = useState(null);
  const [falla, setFalla] = useState(null);

  const actualizar = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.reportes(), api.estadisticas()]);
      setReportes(r);
      setStats(s);
      setFalla(null);
    } catch (e) {
      setFalla("No hay conexión con el servidor. ¿Está corriendo el backend de Python?");
    }
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setFalla("No hay conexión con el servidor."));
    actualizar();
  }, [actualizar]);

  const verEnMapa = (id) => {
    setEnfoque(id);
    irA("mapa");
  };

  return (
    <>
      <Navegacion abiertos={stats?.abiertos} />
      {falla && <div className="falla" role="alert"><Icono nombre="alerta" tam={18} /> {falla}</div>}
      <main>
        <Portada total={stats?.total} />
        <Cinta reportes={reportes} />
        <ComoFunciona />
        <Reportar config={config} onCreado={actualizar} onVerEnMapa={verEnMapa} />
        <Mapa config={config} reportes={reportes} enfoque={enfoque} setEnfoque={setEnfoque} onActualizar={actualizar} />
        <Panel stats={stats} reportes={reportes} onActualizar={actualizar} onVerEnMapa={verEnMapa} />
      </main>
      <Pie config={config} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("raiz")).render(<App />);
