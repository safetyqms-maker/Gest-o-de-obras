import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from './supabase.js';
import { C, fmtDate } from './theme.js';

const LEVEL = {
  critico: { color: C.red, bg: C.redBg },
  atencao: { color: C.amber, bg: C.amberBg },
  info: { color: C.cyan, bg: C.cyanBg },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  async function refresh({ process = false } = {}) {
    setLoading(true);

    if (process) {
      await supabase.rpc('processar_alertas');
    }

    const { data, error } = await supabase
      .from('alertas')
      .select('*')
      .eq('lido', false)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error) setAlerts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh({ process: true });

    const interval = window.setInterval(
      () => refresh({ process: true }),
      5 * 60 * 1000,
    );

    const channel = supabase
      .channel('alertas-layout')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alertas' },
        () => refresh(),
      )
      .subscribe();

    function closeOnOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, []);

  async function markRead(id) {
    await supabase.from('alertas').update({ lido: true }).eq('id', id);
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  }

  async function markAllRead() {
    const ids = alerts.map((item) => item.id);
    if (!ids.length) return;

    await supabase.from('alertas').update({ lido: true }).in('id', ids);
    setAlerts([]);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Abrir notificações"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          color: C.light,
          cursor: 'pointer',
          padding: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={19} />
        {alerts.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: C.red,
              color: C.white,
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {alerts.length > 99 ? '99+' : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 40,
            width: 'min(390px, calc(100vw - 28px))',
            maxHeight: 520,
            overflow: 'hidden',
            background: C.panel,
            border: `1px solid ${C.card}`,
            borderRadius: 10,
            boxShadow: '0 18px 45px rgba(0,0,0,.35)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>
                Notificações
              </div>
              <div style={{ color: C.gray, fontSize: 10, marginTop: 2 }}>
                {loading ? 'Atualizando…' : `${alerts.length} pendência(s)`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {alerts.length > 0 && (
                <button
                  type="button"
                  title="Marcar todas como lidas"
                  onClick={markAllRead}
                  style={iconButton()}
                >
                  <Check size={15} />
                </button>
              )}
              <button
                type="button"
                title="Fechar"
                onClick={() => setOpen(false)}
                style={iconButton()}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 430, overflowY: 'auto' }}>
            {alerts.map((alert) => {
              const level = LEVEL[alert.nivel] || LEVEL.info;

              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '8px 1fr auto',
                    gap: 10,
                    padding: '11px 12px',
                    borderBottom: `1px solid ${C.border}`,
                    background: C.card2,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: level.color,
                      marginTop: 5,
                    }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: C.white,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {alert.titulo || alert.tipo}
                    </div>
                    <div
                      style={{
                        color: C.light,
                        fontSize: 10,
                        lineHeight: 1.4,
                        marginTop: 3,
                      }}
                    >
                      {alert.mensagem}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginTop: 6,
                        color: C.gray,
                        fontSize: 9,
                      }}
                    >
                      <span>{fmtDate(alert.data_referencia)}</span>
                      {alert.link && (
                        <Link
                          to={alert.link}
                          onClick={() => setOpen(false)}
                          style={{
                            color: C.cyan,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          Abrir <ExternalLink size={9} />
                        </Link>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Marcar como lida"
                    onClick={() => markRead(alert.id)}
                    style={iconButton()}
                  >
                    <Check size={14} />
                  </button>
                </div>
              );
            })}

            {!loading && alerts.length === 0 && (
              <div
                style={{
                  padding: 34,
                  color: C.gray,
                  textAlign: 'center',
                  fontSize: 11,
                }}
              >
                Nenhuma pendência nova.
              </div>
            )}
          </div>

          <div
            style={{
              padding: 10,
              borderTop: `1px solid ${C.border}`,
              textAlign: 'center',
            }}
          >
            <Link
              to="/administracao"
              onClick={() => setOpen(false)}
              style={{ color: C.cyan, fontSize: 10, textDecoration: 'none' }}
            >
              Configurar alertas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function iconButton() {
  return {
    background: 'none',
    border: 'none',
    color: C.gray,
    cursor: 'pointer',
    padding: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
