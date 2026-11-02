/**
 * Client half of the DeepSeek Balance bundle: the floating wallet ball.
 *
 * It renders in `shell.overlay` (the frame-wide floating layer) and reads the
 * balance from the bundle's own Host route, so the credential stays on the
 * Host. Text goes through the Client locale service.
 */
window.__ModuleLoader__.load({
  id: 'dsh-deepseek-balance',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-deepseek-balance';
    const BALANCE_URL = '/dsh-deepseek-balance/balance';

    const TEXT = {
      en: {
        open: 'View DeepSeek balance',
        drag: 'Drag to move, click to open',
        title: 'DeepSeek balance',
        refresh: 'Refresh',
        loading: 'Reading…',
        toppedUp: 'Top-up',
        granted: 'Granted',
        accountSource: 'DeepSeek account',
        apiKeySource: 'API key',
        notConfigured: 'Not signed in, and no DeepSeek API key is configured for this harness.',
        failed: 'Could not read the balance. Try again.',
        empty: 'No wallet balance reported.',
        updated: 'Updated',
      },
      zh: {
        open: '查看 DeepSeek 余额',
        drag: '拖动可移动位置，点击查看余额',
        title: 'DeepSeek 余额',
        refresh: '刷新',
        loading: '读取中…',
        toppedUp: '充值余额',
        granted: '赠送余额',
        accountSource: 'DeepSeek 账号',
        apiKeySource: 'API Key',
        notConfigured: '尚未登录 DeepSeek 账号，也没有配置可用的 API Key。',
        failed: '读取余额失败，请稍后重试。',
        empty: '暂无钱包余额数据。',
        updated: '更新于',
      },
    };

    const CSS = [
      '.dsdb-root{position:fixed;right:24px;bottom:24px;z-index:40;pointer-events:auto;font-family:inherit;line-height:1.4;user-select:none;}',
      '.dsdb-ball{display:flex;align-items:center;justify-content:center;width:52px;height:52px;padding:0;border:0;border-radius:50%;',
      'background:var(--dsw-alias-brand-primary);color:#fff;cursor:grab;touch-action:none;box-shadow:0 6px 18px rgba(0,0,0,.24);',
      'transition:transform .16s ease,box-shadow .16s ease;}',
      '.dsdb-ball:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.3);}',
      '.dsdb-ball:active{cursor:grabbing;transform:translateY(0);}',
      '.dsdb-ball:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;}',
      '.dsdb-panel{position:absolute;right:0;bottom:64px;width:268px;box-sizing:border-box;padding:14px 14px 10px;',
      'border-radius:14px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);',
      'box-shadow:0 16px 40px rgba(0,0,0,.2);color:var(--dsw-alias-label-primary);animation:dsdb-pop .16s ease-out;}',
      '.dsdb-panel--below{top:64px;bottom:auto;}',
      '.dsdb-panel--left{left:0;right:auto;}',
      '@keyframes dsdb-pop{from{opacity:0;transform:translateY(6px) scale(.98);}to{opacity:1;transform:none;}}',
      '.dsdb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;}',
      '.dsdb-title{font-size:13px;font-weight:600;}',
      '.dsdb-icon{display:flex;align-items:center;padding:4px;border:0;border-radius:8px;background:transparent;',
      'color:var(--dsw-alias-label-secondary);cursor:pointer;}',
      '.dsdb-icon:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}',
      '.dsdb-icon:disabled{cursor:default;opacity:.5;}',
      '.dsdb-amount{margin:2px 0 8px;font-size:26px;font-weight:650;letter-spacing:-.5px;font-variant-numeric:tabular-nums;}',
      '.dsdb-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.dsdb-row b{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;}',
      '.dsdb-foot{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:8px;',
      'border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-secondary);}',
      '.dsdb-muted{padding:10px 0;font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.dsdb-error{padding:10px 0;font-size:12px;color:var(--dsw-alias-state-error-primary);}',
      '.dsdb-spin{display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-2px;border-radius:50%;',
      'border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:dsdb-spin .8s linear infinite;}',
      '@keyframes dsdb-spin{to{transform:rotate(360deg);}}',
    ].join('');

    /** The Host release version, when the boot payload carries it. */
    function readVersion() {
      try {
        const boot = window.__DSH_BOOT__;
        const release = boot && boot.release;
        if (release && typeof release.version === 'string') return release.version;
      } catch {
        /* A missing boot payload just leaves the version unknown. */
      }
      return '';
    }

    function round2(amount) {
      const value = Number(amount);
      return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    }

    function money(currency, amount) {
      const value = round2(amount);
      const text = value.toFixed(2);
      if (currency === 'CNY') return `¥${text}`;
      if (currency === 'USD') return `$${text}`;
      return `${text} ${currency}`;
    }

    const BALL_SIZE = 52;
    const BALL_MARGIN = 8;
    const PANEL_WIDTH = 268;
    const POSITION_KEY = 'dsh.deepseek-balance.position';

    /** Keep the ball fully inside the viewport. */
    function clampPosition(x, y) {
      const maxX = Math.max(BALL_MARGIN, window.innerWidth - BALL_SIZE - BALL_MARGIN);
      const maxY = Math.max(BALL_MARGIN, window.innerHeight - BALL_SIZE - BALL_MARGIN);
      return {
        x: Math.min(Math.max(BALL_MARGIN, x), maxX),
        y: Math.min(Math.max(BALL_MARGIN, y), maxY),
      };
    }

    /** A dragged position outlives page reloads; an absent or malformed one means the default corner. */
    function readStoredPosition() {
      try {
        const raw = window.localStorage.getItem(POSITION_KEY);
        if (!raw) return null;
        const stored = JSON.parse(raw);
        if (!stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y)) return null;
        return clampPosition(stored.x, stored.y);
      } catch {
        return null;
      }
    }

    function storePosition(position) {
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
      } catch {
        /* Blocked storage keeps the position for this page only. */
      }
    }

    function walletIcon() {
      return h('svg', {
        width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
      h('path', { d: 'M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.5Z' }),
      h('path', { d: 'M3 9h13.5' }),
      h('circle', { cx: 16.5, cy: 13.5, r: 1.2, fill: 'currentColor', stroke: 'none' }));
    }

    function refreshIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
      h('path', { d: 'M20 11a8 8 0 1 0-2.3 5.7' }),
      h('path', { d: 'M20 5v6h-6' }));
    }

    function createBalanceBall(ctx, t) {
      return function BalanceBall() {
        const [open, setOpen] = React.useState(false);
        const [state, setState] = React.useState({ phase: 'idle', data: null, message: '' });
        const [, bump] = React.useState(0);
        const rootRef = React.useRef(null);
        const [position, setPosition] = React.useState(readStoredPosition);
        const positionRef = React.useRef(position);
        const dragRef = React.useRef(null);
        const draggedRef = React.useRef(false);

        React.useEffect(() => ctx.locale.subscribe(() => bump((n) => n + 1)), []);

        const load = React.useCallback(async () => {
          setState({ phase: 'loading', data: null, message: '' });
          try {
            const params = new URLSearchParams();
            const active = ctx.locale.getLocale().active;
            if (active) params.set('locale', active);
            const version = readVersion();
            if (version) params.set('version', version);
            const response = await fetch(`${BALANCE_URL}?${params.toString()}`, {
              headers: { accept: 'application/json' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setState({ phase: 'ready', data, message: '' });
          } catch (error) {
            setState({ phase: 'error', data: null, message: String((error && error.message) || error) });
          }
        }, []);

        React.useEffect(() => {
          if (open) load();
        }, [open, load]);

        React.useEffect(() => {
          if (!open) return undefined;
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
          };
          const onPointerDown = (event) => {
            const root = rootRef.current;
            if (root && !root.contains(event.target)) setOpen(false);
          };
          document.addEventListener('keydown', onKeyDown);
          document.addEventListener('mousedown', onPointerDown, true);
          return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown, true);
          };
        }, [open]);

        React.useEffect(() => {
          const onResize = () => {
            const current = positionRef.current;
            if (!current) return;
            const next = clampPosition(current.x, current.y);
            positionRef.current = next;
            setPosition(next);
            storePosition(next);
          };
          window.addEventListener('resize', onResize);
          return () => window.removeEventListener('resize', onResize);
        }, []);

        function beginDrag(event) {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          draggedRef.current = false;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: rect.left,
            originY: rect.top,
            moved: false,
          };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* Pointer capture is best effort. */
          }
        }

        function moveDrag(event) {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.startX;
          const dy = event.clientY - drag.startY;
          if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          drag.moved = true;
          draggedRef.current = true;
          const next = clampPosition(drag.originX + dx, drag.originY + dy);
          positionRef.current = next;
          setPosition(next);
        }

        function endDrag(event) {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          dragRef.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* The capture may already be gone. */
          }
          if (drag.moved && positionRef.current) storePosition(positionRef.current);
        }

        /** A click after a real drag must not also toggle the panel. */
        function toggle() {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          setOpen((value) => !value);
        }

        const data = state.data;
        const locale = ctx.locale.getLocale().active;
        const updated = data && data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString(locale || undefined) : '';
        const source = data && data.source === 'account' ? t('accountSource')
          : data && data.source === 'api-key' ? t('apiKeySource') : '';

        function walletBlock(entry, index) {
          const toppedUp = round2(entry.toppedUp);
          const granted = round2(entry.granted);
          const total = round2(toppedUp + granted);
          return h('div', { key: `${entry.currency}-${index}` },
            index === 0
              ? h('div', { className: 'dsdb-amount' }, money(entry.currency, total))
              : h('div', { className: 'dsdb-row' }, h('span', null, entry.currency), h('b', null, money(entry.currency, total))),
            h('div', { className: 'dsdb-row' }, h('span', null, t('toppedUp')), h('b', null, money(entry.currency, toppedUp))),
            h('div', { className: 'dsdb-row' }, h('span', null, t('granted')), h('b', null, money(entry.currency, granted))));
        }

        let body;
        if (state.phase === 'loading' || state.phase === 'idle') {
          body = h('div', { className: 'dsdb-muted' },
            h('span', { className: 'dsdb-spin', 'aria-hidden': true }), t('loading'));
        } else if (state.phase === 'error') {
          body = h('div', { className: 'dsdb-error' }, t('failed'));
        } else if (!data || data.ok !== true) {
          const unconfigured = data && data.reason === 'not-configured';
          body = h('div', { className: unconfigured ? 'dsdb-muted' : 'dsdb-error' },
            unconfigured ? t('notConfigured') : t('failed'));
        } else if (!Array.isArray(data.wallets) || data.wallets.length === 0) {
          body = h('div', { className: 'dsdb-muted' }, t('empty'));
        } else {
          body = data.wallets.map(walletBlock);
        }

        const rootStyle = position
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : undefined;
        const panelClass = ['dsdb-panel',
          position && position.y < 320 ? 'dsdb-panel--below' : '',
          position && position.x + BALL_SIZE - PANEL_WIDTH < BALL_MARGIN ? 'dsdb-panel--left' : '',
        ].filter(Boolean).join(' ');

        const panel = open ? h('div', {
          className: panelClass,
          role: 'dialog',
          'aria-label': t('title'),
        },
        h('div', { className: 'dsdb-head' },
          h('span', { className: 'dsdb-title' }, t('title')),
          h('button', {
            type: 'button',
            className: 'dsdb-icon',
            title: t('refresh'),
            'aria-label': t('refresh'),
            disabled: state.phase === 'loading',
            onClick: load,
          }, refreshIcon())),
        body,
        h('div', { className: 'dsdb-foot' },
          h('span', null, source),
          h('span', null, updated ? `${t('updated')} ${updated}` : ''))) : null;

        return h('div', { className: 'dsdb-root', ref: rootRef, style: rootStyle },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          panel,
          h('button', {
            type: 'button',
            className: 'dsdb-ball',
            title: t('drag'),
            'aria-label': t('open'),
            'aria-expanded': open ? 'true' : 'false',
            onPointerDown: beginDrag,
            onPointerMove: moveDrag,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onClick: toggle,
          }, walletIcon()));
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', TEXT.en));
        ctx.effect(() => ctx.locale.register(NS, 'zh', TEXT.zh));
        ctx.effect(() => ctx.locale.register(NS, 'zh-CN', TEXT.zh));

        const t = ctx.locale.bind(NS);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'deepseek-balance',
          order: 40,
          label: () => t('title'),
        }, createBalanceBall(ctx, t)));
      },
    };
  },
});
