/* ==========================================================================
   Navegación, portada, cinta de reportes recientes y "cómo funciona"
   ========================================================================== */

function Navegacion({ abiertos }) {
  const [compacta, setCompacta] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [activa, setActiva] = useState("");

  useEffect(() => {
    const alScroll = () => {
      const h = document.documentElement;
      setCompacta(h.scrollTop > 40);
      setProgreso(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  useEffect(() => {
    const ids = ["como", "reportar", "mapa", "municipio"];
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => e.isIntersecting && setActiva(e.target.id));
    }, { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); el && io.observe(el); });
    return () => io.disconnect();
  }, []);

  const enlaces = [["como", "Cómo funciona"], ["reportar", "Reportar"], ["mapa", "Mapa"], ["municipio", "Municipio"]];

  return (
    <header className={`nav ${compacta ? "nav--compacta" : ""}`}>
      <div className="nav__barra" style={{ transform: `scaleX(${progreso})` }} />
      <a className="marca" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        <Cono tam={28} />
        <span>banqueta<b>.</b></span>
      </a>
      <nav className="nav__enlaces" aria-label="Secciones">
        {enlaces.map(([id, texto]) => (
          <a key={id} href={`#${id}`} className={activa === id ? "activo" : ""}
             onClick={(e) => { e.preventDefault(); irA(id); }}>{texto}</a>
        ))}
      </nav>
      <div className="nav__vivo" title="Reportes sin resolver">
        <i /> {abiertos ?? "—"} abiertos
      </div>
      <button className="btn btn--cono btn--chico" onClick={() => irA("reportar")}>
        <Icono nombre="camara" tam={18} /> Reportar
      </button>
    </header>
  );
}

/* ---------- Portada ---------- */

function Portada({ total }) {
  const tarjeta = useRef(null);

  // Inclinación sutil de la tarjeta siguiendo el puntero
  const mover = (e) => {
    if (movimientoReducido() || !tarjeta.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tarjeta.current.style.transform = `rotate(-3deg) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
  };
  const soltar = () => { if (tarjeta.current) tarjeta.current.style.transform = ""; };

  const lineas = [["La", "calle"], ["te", <mark key="m">habla.</mark>]];

  return (
    <section className="portada" onPointerMove={mover} onPointerLeave={soltar}>
      <div className="portada__texto">
        <p className="etiqueta etiqueta--entra">Reporte ciudadano · con inteligencia artificial</p>
        <h1 className="titular">
          {lineas.map((palabras, i) => (
            <span className="titular__linea" key={i}>
              {palabras.map((p, j) => (
                <span className="titular__palabra" key={j} style={{ "--i": i * 2 + j }}>{p}</span>
              ))}
            </span>
          ))}
        </h1>
        <p className="portada__bajada">
          Tómale foto al <b className="sub sub--cono">bache</b>, a la <b className="sub sub--agua">fuga</b> o a
          la <b className="sub sub--hoja">basura</b>. La IA lo clasifica, mide qué tan grave es y lo pone en el
          mapa del municipio. Tú sólo apuntas.
        </p>
        <div className="portada__acciones">
          <button className="btn btn--cono" onClick={() => irA("reportar")}>
            Reportar ahora <Icono nombre="flecha" tam={20} />
          </button>
          <button className="btn btn--linea" onClick={() => irA("mapa")}>
            Ver el mapa {total ? <span className="btn__cuenta">{total}</span> : null}
          </button>
        </div>
      </div>

      <div className="portada__escena" aria-hidden="true">
        <div className="polaroid" ref={tarjeta}>
          <div className="polaroid__foto">
            <EscenaBache />
            <div className="escaneo" />
            <span className="esquina esquina--1" /><span className="esquina esquina--2" />
            <span className="esquina esquina--3" /><span className="esquina esquina--4" />
            <div className="hallazgo hallazgo--1"><Icono nombre="bache" tam={16} /> bache · 91%</div>
            <div className="hallazgo hallazgo--2">gravedad <b>4</b>/5</div>
            <div className="hallazgo hallazgo--3"><Icono nombre="pin" tam={14} /> 6a. Avenida, Zona 1</div>
          </div>
          <p className="polaroid__pie">Folio BQ-1035 · enviado a Obras Públicas</p>
        </div>
        <div className="senal-rombo senal-rombo--flota"><Icono nombre="alerta" tam={34} /></div>
      </div>

      <div className="portada__asfalto" aria-hidden="true">
        <div className="carril" />
      </div>
    </section>
  );
}

function EscenaBache() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="grano">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <radialGradient id="hoyo" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#121110" />
          <stop offset=".7" stopColor="#262420" />
          <stop offset="1" stopColor="#3b3934" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="#57544e" />
      <rect width="400" height="300" fill="#000" filter="url(#grano)" opacity=".7" />
      <path d="M232 0 252 0 300 300 262 300Z" fill="#e9b923" opacity=".85" />
      <path d="M232 0 252 0 300 300 262 300Z" fill="#000" filter="url(#grano)" opacity=".35" />
      <path d="M78 168c6-30 52-50 104-46 47 4 82 22 80 50-3 30-52 46-100 44-52-2-91-18-84-48Z" fill="#6b675f" />
      <path d="M92 170c6-22 44-38 88-35 40 3 68 18 66 38-2 24-44 36-86 34-44-2-74-14-68-37Z" fill="url(#hoyo)" />
      <path d="M118 186c10 6 30 9 52 8M150 150c14-3 32-2 46 3" stroke="#4a4740" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 150l-26-14M54 196l-34 18M262 160l40-22M300 138l20-4M258 196l46 26" stroke="#2e2c28" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="212" r="5" fill="#77736a" /><circle cx="286" cy="120" r="4" fill="#77736a" />
      <circle cx="250" cy="226" r="6" fill="#6e6a62" />
    </svg>
  );
}

/* ---------- Cinta con los últimos reportes ---------- */

function Cinta({ reportes }) {
  const recientes = reportes.slice(0, 12);
  if (!recientes.length) return null;
  const items = recientes.map((r) => (
    <span className="cinta__item" key={r.id}>
      <b>{r.folio}</b>
      <span style={{ color: CATS[r.categoria].claro }}>
        {CATS[r.categoria].nombre.toUpperCase()}
      </span>
      gravedad {r.gravedad}/5 · {r.titulo.toLowerCase()} · {haceCuanto(r.creado)}
      <i className="cinta__sep">◆</i>
    </span>
  ));
  return (
    <div className="cinta" aria-label="Reportes recientes">
      <div className="cinta__pista">
        <div className="cinta__grupo">{items}</div>
        <div className="cinta__grupo" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}

/* ---------- Cómo funciona: la carretera que se pinta con el scroll ---------- */

const PASOS = [
  {
    icono: "camara",
    titulo: "Tómale foto",
    texto: "Desde el celular, ahí en la calle. Si tu cámara guarda la ubicación la usamos; si no, marcas el punto en el mapa con un toque.",
    dato: "≈ 20 segundos",
  },
  {
    icono: "mira",
    titulo: "La IA la lee",
    texto: "Distingue si es bache, fuga o basura, estima la gravedad del 1 al 5 y te dice qué evidencia vio. Si se equivoca, la corriges.",
    dato: "categoría · gravedad · riesgos",
  },
  {
    icono: "pin",
    titulo: "Llega al municipio",
    texto: "El reporte cae en el mapa público y en la cola de la dependencia responsable, con un plazo de atención según qué tan grave es.",
    dato: "folio + seguimiento",
  },
];

function ComoFunciona() {
  const [ref, p] = useProgresoScroll();
  return (
    <section className="como" id="como" ref={ref}>
      <div className="seccion__cabeza seccion__cabeza--claro">
        <span className="seccion__num">01</span>
        <Aparece as="h2" variante="corte" className="seccion__titulo">Tres pasos.<br />Cero filas.</Aparece>
      </div>

      <div className="carretera">
        <div className="carretera__via" aria-hidden="true">
          <div className="carretera__pintura" style={{ height: `${p * 100}%` }} />
          <div className="carretera__cono" style={{ top: `${p * 100}%` }}><Cono tam={34} /></div>
        </div>

        {PASOS.map((paso, i) => (
          <Aparece key={i} variante={i % 2 ? "der" : "izq"} className={`paso paso--${i % 2 ? "der" : "izq"}`}>
            <div className="paso__num" aria-hidden="true">0{i + 1}</div>
            <div className="senal-rombo"><Icono nombre={paso.icono} tam={34} /></div>
            <h3>{paso.titulo}</h3>
            <p>{paso.texto}</p>
            <span className="paso__dato">{paso.dato}</span>
          </Aparece>
        ))}
      </div>
    </section>
  );
}
