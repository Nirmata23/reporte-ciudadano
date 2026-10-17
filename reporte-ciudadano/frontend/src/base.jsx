/* ==========================================================================
   Base: constantes, llamadas a la API, hooks de animación e íconos.
   Todo lo que se define aquí queda disponible para los demás archivos .jsx
   ========================================================================== */

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

const CATS = {
  // hex: sobre papel claro · claro: sobre fondos de asfalto
  bache:  { nombre: "Bache",  plural: "Baches",  hex: "#FF5A1F", claro: "#FF7A45" },
  fuga:   { nombre: "Fuga",   plural: "Fugas",   hex: "#2350C8", claro: "#8FB0FF" },
  basura: { nombre: "Basura", plural: "Basura",  hex: "#2C7A4B", claro: "#6FCF97" },
  otro:   { nombre: "Otro",   plural: "Otros",   hex: "#7A7163", claro: "#C9C0AE" },
};

const GRAVEDAD = [
  null,
  { nombre: "Menor",    hex: "#8DB56B" },
  { nombre: "Leve",     hex: "#E3BC2F" },
  { nombre: "Moderada", hex: "#F28A1E" },
  { nombre: "Alta",     hex: "#DD3F16" },
  { nombre: "Crítica",  hex: "#9E0F0B" },
];

const ESTADOS = {
  recibido:    "Recibido",
  en_revision: "En revisión",
  en_proceso:  "En proceso",
  resuelto:    "Resuelto",
};

/* ---------- API ---------- */

async function pedir(url, opciones = {}) {
  const r = await fetch(url, opciones);
  if (!r.ok) {
    let detalle = `Error ${r.status}`;
    try { detalle = (await r.json()).detail || detalle; } catch (_) {}
    throw new Error(typeof detalle === "string" ? detalle : "Datos inválidos");
  }
  return r.json();
}

const api = {
  config: () => pedir("/api/config"),
  reportes: () => pedir("/api/reportes"),
  estadisticas: () => pedir("/api/estadisticas"),
  analizar: (archivo) => {
    const fd = new FormData();
    fd.append("foto", archivo);
    return pedir("/api/analizar", { method: "POST", body: fd });
  },
  cercanos: (lat, lng, categoria) =>
    pedir(`/api/reportes/cercanos?lat=${lat}&lng=${lng}&categoria=${categoria}`),
  crear: (datos) =>
    pedir("/api/reportes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    }),
  estado: (id, estado) =>
    pedir(`/api/reportes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    }),
  apoyar: (id) => pedir(`/api/reportes/${id}/apoyar`, { method: "POST" }),
};

/* ---------- Utilidades ---------- */

const movimientoReducido = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function haceCuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

function plazo(iso) {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3600000);
  if (h >= 0) return h < 48 ? `vence en ${h} h` : `vence en ${Math.round(h / 24)} d`;
  const v = -h;
  return v < 48 ? `vencido hace ${v} h` : `vencido hace ${Math.round(v / 24)} d`;
}

function capaTeselas(config) {
  return L.tileLayer(config.teselas.url, { maxZoom: 19, attribution: config.teselas.atribucion });
}

function irA(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: movimientoReducido() ? "auto" : "smooth", block: "start" });
}

/* ---------- Hooks de animación ---------- */

// Aparece al entrar en pantalla. variante: "sube" | "izq" | "der" | "escala" | "corte"
function Aparece({ as: Etiqueta = "div", variante = "sube", retraso = 0, className = "", style, children, ...resto }) {
  const ref = useRef(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (movimientoReducido() || !("IntersectionObserver" in window)) { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); io.disconnect(); }
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Etiqueta
      ref={ref}
      className={`ap ap--${variante} ${visto ? "ap--visto" : ""} ${className}`}
      style={{ "--retraso": `${retraso}ms`, ...(style || {}) }}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}

// true cuando el elemento ya entró a pantalla (una sola vez)
function useVisto(umbral = 0.3) {
  const ref = useRef(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); io.disconnect(); }
    }, { threshold: umbral });
    io.observe(el);
    return () => io.disconnect();
  }, [umbral]);
  return [ref, visto];
}

// Cuenta de 0 al objetivo con aceleración suave
function useContador(objetivo, activo, duracion = 1300) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (!activo || objetivo == null) return;
    if (movimientoReducido()) { setValor(objetivo); return; }
    let raf, inicio;
    const paso = (t) => {
      if (!inicio) inicio = t;
      const p = Math.min(1, (t - inicio) / duracion);
      setValor(Math.round(objetivo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, activo, duracion]);
  return valor;
}

// Progreso 0..1 del scroll a lo largo de un elemento
function useProgresoScroll() {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = null;
    const medir = () => {
      raf = null;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh * 0.4;
      setP(Math.max(0, Math.min(1, (vh * 0.7 - r.top) / total)));
    };
    const alScroll = () => { if (raf == null) raf = requestAnimationFrame(medir); };
    medir();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return [ref, p];
}

/* ---------- Íconos (trazo propio, heredan currentColor) ---------- */

function Icono({ nombre, tam = 24, grosor = 2.2, ...resto }) {
  const comun = {
    width: tam, height: tam, viewBox: "0 0 32 32", fill: "none",
    stroke: "currentColor", strokeWidth: grosor, strokeLinecap: "round", strokeLinejoin: "round",
    "aria-hidden": true, ...resto,
  };
  switch (nombre) {
    case "bache":
      return (
        <svg {...comun}>
          <path d="M5 19c0-3 5-6 11-6s11 3 11 6-5 5-11 5-11-2-11-5Z" />
          <path d="M10 18.5c1.5-1.6 3.6-2.3 6-2.3s4.6.7 6 2.3" />
          <path d="M3 13l4 2M29 12l-4 3M16 8v4M12 9l1 3" />
        </svg>
      );
    case "fuga":
      return (
        <svg {...comun}>
          <path d="M16 4c4.5 6 7 9.7 7 13a7 7 0 0 1-14 0c0-3.3 2.5-7 7-13Z" />
          <path d="M13 18.5a3 3 0 0 0 3 3" />
          <path d="M5 27h4M23 27h4M12 29h8" />
        </svg>
      );
    case "basura":
      return (
        <svg {...comun}>
          <path d="M12 9c-1-2 0-4 4-4s5 2 4 4" />
          <path d="M10 9h12l3 6c1.5 3 1 7-1.5 9.5S18 28 16 28s-5-.5-7.5-3.5S5.5 18 7 15Z" />
          <path d="M13 9l-2 4M19 9l2 4" />
        </svg>
      );
    case "otro":
      return (
        <svg {...comun}>
          <circle cx="16" cy="16" r="11" />
          <path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.6" />
          <path d="M16 22.5v.2" />
        </svg>
      );
    case "camara":
      return (
        <svg {...comun}>
          <path d="M4 11h5l2-3h10l2 3h5v14H4Z" />
          <circle cx="16" cy="17.5" r="4.5" />
        </svg>
      );
    case "pin":
      return (
        <svg {...comun}>
          <path d="M16 29s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15Z" />
          <circle cx="16" cy="14" r="3.2" />
        </svg>
      );
    case "flecha":
      return (<svg {...comun}><path d="M5 16h21M19 9l7 7-7 7" /></svg>);
    case "mira":
      return (
        <svg {...comun}>
          <circle cx="16" cy="16" r="8" />
          <path d="M16 3v6M16 23v6M3 16h6M23 16h6" />
        </svg>
      );
    case "mano":
      return (
        <svg {...comun}>
          <path d="M11 15V7.5a2 2 0 0 1 4 0V14M15 13V6a2 2 0 0 1 4 0v8M19 13.5V8a2 2 0 0 1 4 0v9c0 6-3.5 10-9 10-3.5 0-5.5-2-7.5-5l-2.6-4.4a2 2 0 0 1 3.4-2.1L11 18" />
        </svg>
      );
    case "palomita":
      return (<svg {...comun}><path d="M6 17l6 6L26 9" /></svg>);
    case "cerrar":
      return (<svg {...comun}><path d="M8 8l16 16M24 8 8 24" /></svg>);
    case "alerta":
      return (
        <svg {...comun}>
          <path d="M16 4 29 27H3Z" />
          <path d="M16 12v7M16 23v.2" />
        </svg>
      );
    case "reloj":
      return (<svg {...comun}><circle cx="16" cy="16" r="12" /><path d="M16 9v7l5 3" /></svg>);
    default:
      return null;
  }
}

// Cono de tráfico: la marca de Banqueta
function Cono({ tam = 30 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 26.5 27h-21Z" fill="var(--cono)" />
      <path d="M11.3 14.5h9.4l1.5 3.6H9.8zM8.6 20.8h14.8l1.4 3.2H7.2z" fill="var(--papel)" />
      <rect x="3" y="26.5" width="26" height="3" rx="1" fill="var(--tinta)" />
    </svg>
  );
}

// Ilustración cuando un reporte no tiene foto (datos de ejemplo)
function SinFoto({ categoria }) {
  return (
    <div className={`sinfoto sinfoto--${categoria}`}>
      <Icono nombre={categoria} tam={64} grosor={1.6} />
      <span>sin foto · reporte de ejemplo</span>
    </div>
  );
}

function PuntosGravedad({ valor }) {
  return (
    <span className="puntos" aria-label={`Gravedad ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} style={{ background: i <= valor ? GRAVEDAD[valor].hex : "transparent" }} />
      ))}
    </span>
  );
}
