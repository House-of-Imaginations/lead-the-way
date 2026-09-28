/* @ds-bundle: {"format":4,"namespace":"LeadTheWay","components":[{"name":"Button"},{"name":"Tag"},{"name":"TextInput"},{"name":"Select"},{"name":"Checkbox"},{"name":"Toggle"},{"name":"Tabs"},{"name":"ContentSwitcher"},{"name":"SelectableTile"},{"name":"InlineNotification"},{"name":"Toast"},{"name":"ProgressBar"},{"name":"ProgressSteps"},{"name":"StatTile"},{"name":"SideNav"},{"name":"Modal"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;
  var ICONS = {"checkmark--filled": "<path d=\"M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM14,21.5908l-5-5L10.5906,15,14,18.4092,21.41,11l1.5957,1.5859Z\"/><path fill=\"none\" d=\"M14 21.591 9 16.591 10.591 15 14 18.409 21.41 11 23.005 12.585 14 21.591z\" data-icon-path=\"inner-path\"/>", "checkmark": "<path d=\"M13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24z\"/>", "information": "<path d=\"M17 22 17 14 13 14 13 16 15 16 15 22 12 22 12 24 20 24 20 22 17 22z\"/><path d=\"M16,8a1.5,1.5,0,1,0,1.5,1.5A1.5,1.5,0,0,0,16,8Z\"/><path d=\"M16,30A14,14,0,1,1,30,16,14,14,0,0,1,16,30ZM16,4A12,12,0,1,0,28,16,12,12,0,0,0,16,4Z\"/>", "close": "<path d=\"M17.4141 16 24 9.4141 22.5859 8 16 14.5859 9.4143 8 8 9.4141 14.5859 16 8 22.5859 9.4143 24 16 17.4141 22.5859 24 24 22.5859 17.4141 16z\"/>", "chevron--down": "<path d=\"M16 22 6 12 7.4 10.6 16 19.2 24.6 10.6 26 12z\"/>", "chevron--left": "<path d=\"M10 16 20 6 21.4 7.4 12.8 16 21.4 24.6 20 26z\"/>", "chevron--sort": "<path d=\"M16 28 9 21 10.41 19.59 16 25.17 21.59 19.59 23 21 16 28z\"/><path d=\"M16 4 23 11 21.59 12.41 16 6.83 10.41 12.41 9 11 16 4z\"/>", "dashboard": "<path d=\"M24 21H26V26H24z\"/><path d=\"M20 16H22V26H20z\"/><path d=\"M11,26a5.0059,5.0059,0,0,1-5-5H8a3,3,0,1,0,3-3V16a5,5,0,0,1,0,10Z\"/><path d=\"M28,2H4A2.002,2.002,0,0,0,2,4V28a2.0023,2.0023,0,0,0,2,2H28a2.0027,2.0027,0,0,0,2-2V4A2.0023,2.0023,0,0,0,28,2Zm0,9H14V4H28ZM12,4v7H4V4ZM4,28V13H28.0007l.0013,15Z\"/>", "document--tasks": "<path d=\"M22 27.18 19.41 24.59 18 26 22 30 30 22 28.59 20.59 22 27.18z\"/><path d=\"M15,28H8V4h8v6a2.0058,2.0058,0,0,0,2,2h6v6h2V10a.9092.9092,0,0,0-.3-.7l-7-7A.9087.9087,0,0,0,18,2H8A2.0058,2.0058,0,0,0,6,4V28a2.0058,2.0058,0,0,0,2,2h7ZM18,4.4,23.6,10H18Z\"/>", "education": "<path d=\"M26,30H24V27a5.0059,5.0059,0,0,0-5-5H13a5.0059,5.0059,0,0,0-5,5v3H6V27a7.0082,7.0082,0,0,1,7-7h6a7.0082,7.0082,0,0,1,7,7Z\"/><path d=\"M5,6A1,1,0,0,0,4,7v9H6V7A1,1,0,0,0,5,6Z\"/><path d=\"M4,2V4H9v7a7,7,0,0,0,14,0V4h5V2Zm7,2H21V7H11Zm5,12a5,5,0,0,1-5-5V9H21v2A5,5,0,0,1,16,16Z\"/>", "calendar": "<path d=\"M26,4h-4V2h-2v2h-8V2h-2v2H6C4.9,4,4,4.9,4,6v20c0,1.1,0.9,2,2,2h20c1.1,0,2-0.9,2-2V6C28,4.9,27.1,4,26,4z M26,26H6V12h20\tV26z M26,10H6V6h4v2h2V6h8v2h2V6h4V10z\"/>", "settings": "<path d=\"M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z\"/><path d=\"M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z\"/>", "arrow--right": "<path d=\"M18 6 16.57 7.393 24.15 15 4 15 4 17 24.15 17 16.57 24.573 18 26 28 16 18 6z\"/>", "add": "<path d=\"M17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17 24 15z\"/>", "time": "<path d=\"M16,30A14,14,0,1,1,30,16,14,14,0,0,1,16,30ZM16,4A12,12,0,1,0,28,16,12,12,0,0,0,16,4Z\"/><path d=\"M20.59 22 15 16.41 15 7 17 7 17 15.58 22 20.59 20.59 22z\"/>", "catalog": "<path d=\"M26,2H8A2,2,0,0,0,6,4V8H4v2H6v5H4v2H6v5H4v2H6v4a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V4A2,2,0,0,0,26,2Zm0,26H8V24h2V22H8V17h2V15H8V10h2V8H8V4H26Z\"/><path d=\"M14 8H22V10H14z\"/><path d=\"M14 15H22V17H14z\"/><path d=\"M14 22H22V24H14z\"/>", "certificate": "<path d=\"M24 17 25.912 20.703 30 21.297 27 24 27.771 28 24 25.75 20.229 28 21 24 18 21.297 22.2 20.703 24 17z\"/><path d=\"M6 16H12V18H6z\"/><path d=\"M6 12H16V14H6z\"/><path d=\"M6 8H16V10H6z\"/><path d=\"M16,26H4V6H28V16h2V6a2,2,0,0,0-2-2H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H16Z\"/>", "chart--column": "<path d=\"M27,28V6H19V28H15V14H7V28H4V2H2V28a2,2,0,0,0,2,2H30V28ZM13,28H9V16h4Zm12,0H21V8h4Z\"/>", "portfolio": "<path d=\"M28,10H22V6a2,2,0,0,0-2-2H12a2,2,0,0,0-2,2v4H4a2,2,0,0,0-2,2V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V12A2,2,0,0,0,28,10ZM12,6h8v4H12ZM4,26V12H28V26Z\"/>", "help": "<path d=\"M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2Zm0,26A12,12,0,1,1,28,16,12,12,0,0,1,16,28Z\"/><circle cx=\"16\" cy=\"23.5\" r=\"1.5\"/><path d=\"M17,8H15.5A4.49,4.49,0,0,0,11,12.5V13h2v-.5A2.5,2.5,0,0,1,15.5,10H17a2.5,2.5,0,0,1,0,5H15v4.5h2V17a4.5,4.5,0,0,0,0-9Z\"/>", "logout": "<path d=\"M6,30H18a2.0023,2.0023,0,0,0,2-2V25H18v3H6V4H18V7h2V4a2.0023,2.0023,0,0,0-2-2H6A2.0023,2.0023,0,0,0,4,4V28A2.0023,2.0023,0,0,0,6,30Z\"/><path d=\"M20.586 20.586 24.172 17 10 17 10 15 24.172 15 20.586 11.414 22 10 28 16 22 22 20.586 20.586z\"/>", "warning--filled": "<path d=\"M16,2C8.3,2,2,8.3,2,16s6.3,14,14,14s14-6.3,14-14C30,8.3,23.7,2,16,2z M14.9,8h2.2v11h-2.2V8z M16,25\tc-0.8,0-1.5-0.7-1.5-1.5S15.2,22,16,22c0.8,0,1.5,0.7,1.5,1.5S16.8,25,16,25z\"/><path fill=\"none\" d=\"M17.5,23.5c0,0.8-0.7,1.5-1.5,1.5c-0.8,0-1.5-0.7-1.5-1.5S15.2,22,16,22\tC16.8,22,17.5,22.7,17.5,23.5z M17.1,8h-2.2v11h2.2V8z\" data-icon-path=\"inner-path\" opacity=\"0\"/>", "locked": "<path d=\"M24,14H22V8A6,6,0,0,0,10,8v6H8a2,2,0,0,0-2,2V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V16A2,2,0,0,0,24,14ZM12,8a4,4,0,0,1,8,0v6H12ZM24,28H8V16H24Z\"/>", "view--off": "<path d=\"M5.24,22.51l1.43-1.42A14.06,14.06,0,0,1,3.07,16C5.1,10.93,10.7,7,16,7a12.38,12.38,0,0,1,4,.72l1.55-1.56A14.72,14.72,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A16,16,0,0,0,5.24,22.51Z\"/><path d=\"M12,15.73a4,4,0,0,1,3.7-3.7l1.81-1.82a6,6,0,0,0-7.33,7.33Z\"/><path d=\"M30.94,15.66A16.4,16.4,0,0,0,25.2,8.22L30,3.41,28.59,2,2,28.59,3.41,30l5.1-5.1A15.29,15.29,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM20,16a4,4,0,0,1-6,3.44L19.44,14A4,4,0,0,1,20,16Zm-4,9a13.05,13.05,0,0,1-6-1.58l2.54-2.54a6,6,0,0,0,8.35-8.35l2.87-2.87A14.54,14.54,0,0,1,28.93,16C26.9,21.07,21.3,25,16,25Z\"/>", "enterprise": "<path d=\"M8 8H10V12H8z\"/><path d=\"M8 14H10V18H8z\"/><path d=\"M14 8H16V12H14z\"/><path d=\"M14 14H16V18H14z\"/><path d=\"M8 20H10V24H8z\"/><path d=\"M14 20H16V24H14z\"/><path d=\"M30,14a2,2,0,0,0-2-2H22V4a2,2,0,0,0-2-2H4A2,2,0,0,0,2,4V30H30ZM4,4H20V28H4ZM22,28V14h6V28Z\"/>", "edit": "<path d=\"M2 26H30V28H2z\"/><path d=\"M25.4,9c0.8-0.8,0.8-2,0-2.8c0,0,0,0,0,0l-3.6-3.6c-0.8-0.8-2-0.8-2.8,0c0,0,0,0,0,0l-15,15V24h6.4L25.4,9z M20.4,4L24,7.6\tl-3,3L17.4,7L20.4,4z M6,22v-3.6l10-10l3.6,3.6l-10,10H6z\"/>", "send": "<path d=\"M27.45,15.11l-22-11a1,1,0,0,0-1.08.12,1,1,0,0,0-.33,1L7,16,4,26.74A1,1,0,0,0,5,28a1,1,0,0,0,.45-.11l22-11a1,1,0,0,0,0-1.78Zm-20.9,10L8.76,17H18V15H8.76L6.55,6.89,24.76,16Z\"/>", "download": "<path d=\"M26,24v4H6V24H4v4H4a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2h0V24Z\"/><path d=\"M26 14 24.59 12.59 17 20.17 17 2 15 2 15 20.17 7.41 12.59 6 14 16 24 26 14z\"/>"};
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  function Icon(p) {
    return h('svg', { className: cx('ltw-i', p.className), viewBox: '0 0 32 32', width: p.size || 16, height: p.size || 16, 'aria-hidden': p.label ? undefined : true, role: p.label ? 'img' : undefined, 'aria-label': p.label, dangerouslySetInnerHTML: { __html: ICONS[p.name] || '' } });
  }

  function Button(p) {
    var kind = p.kind || 'primary';
    var cls = cx('ltw-btn', 'ltw-btn-' + kind, p.size && p.size !== 'lg' ? 'ltw-btn-' + p.size : null, p.className);
    var kids = [h('span', { key: 't' }, p.children)];
    if (p.icon) kids.push(h(Icon, { key: 'i', name: p.icon }));
    if (p.href) return h('a', { className: cls, href: p.href, onClick: p.onClick }, kids);
    return h('button', { type: p.type || 'button', className: cls, disabled: p.disabled, onClick: p.onClick, style: p.style }, kids);
  }

  function Tag(p) {
    return h('span', { className: cx('ltw-tag', p.color && p.color !== 'gray' ? 'ltw-tag-' + p.color : null) },
      p.icon ? h(Icon, { name: p.icon, size: 12, className: 'ltw-tag-ic' }) : null,
      p.children,
      p.onDismiss ? h('button', { type: 'button', 'aria-label': 'Remove ' + p.children, onClick: p.onDismiss }, h(Icon, { name: 'close', size: 12 })) : null);
  }

  function Field(p, control) {
    return h('div', { className: 'ltw-fld' },
      p.label ? h('label', { className: 'ltw-lbl', htmlFor: p.id }, p.label) : null,
      control,
      p.invalid && p.error ? h('span', { className: 'ltw-err' }, p.error) : (p.helper ? h('span', { className: 'ltw-help' }, p.helper) : null));
  }
  function TextInput(p) {
    return Field(p, h('input', { id: p.id, className: cx('ltw-field', p.invalid && 'ltw-field-invalid'), value: p.value, defaultValue: p.defaultValue, placeholder: p.placeholder, disabled: p.disabled, onChange: p.onChange, 'aria-invalid': p.invalid || undefined }));
  }
  function TextArea(p) {
    return Field(p, h('textarea', { id: p.id, className: cx('ltw-field', p.invalid && 'ltw-field-invalid'), value: p.value, defaultValue: p.defaultValue, placeholder: p.placeholder, rows: p.rows || 3, onChange: p.onChange }));
  }
  function Select(p) {
    return Field(p, h('div', { className: 'ltw-sel' },
      h('select', { id: p.id, className: 'ltw-field', value: p.value, defaultValue: p.defaultValue, onChange: p.onChange, disabled: p.disabled },
        (p.options || []).map(function (o) { var v = typeof o === 'string' ? o : o.value; return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label); })),
      h(Icon, { name: 'chevron--down' })));
  }

  function Checkbox(p) {
    return h('label', { className: 'ltw-cb' },
      h('input', { type: 'checkbox', checked: p.checked, defaultChecked: p.defaultChecked, onChange: p.onChange, disabled: p.disabled }),
      h('span', null, p.label, p.helper ? h('span', { className: 'ltw-help', style: { display: 'block' } }, p.helper) : null));
  }

  function Toggle(p) {
    var st = useState(!!p.defaultOn); var on = p.on !== undefined ? p.on : st[0];
    function flip() { if (p.on === undefined) st[1](!on); if (p.onChange) p.onChange(!on); }
    var sw = h('button', { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': p.label, className: 'ltw-toggle', onClick: flip });
    if (!p.description && !p.label) return sw;
    return h('div', { className: 'ltw-trow' },
      h('div', null, h('div', { style: { fontWeight: 600 } }, p.label), p.description ? h('div', { className: 'ltw-help', style: { marginTop: 2, color: 'var(--text-secondary)' } }, p.description) : null),
      sw);
  }

  function Tabs(p) {
    var st = useState(p.defaultIndex || 0); var cur = p.index !== undefined ? p.index : st[0];
    return h('div', { className: 'ltw-tabs', role: 'tablist' }, (p.tabs || []).map(function (t, i) {
      return h('button', { key: t, type: 'button', role: 'tab', className: 'ltw-tab', 'aria-selected': i === cur ? 'true' : 'false', onClick: function () { st[1](i); if (p.onChange) p.onChange(i); } }, t);
    }));
  }

  function ContentSwitcher(p) {
    var st = useState(p.defaultIndex || 0); var cur = p.index !== undefined ? p.index : st[0];
    return h('div', { className: 'ltw-cs', role: 'group', 'aria-label': p.label }, (p.options || []).map(function (o, i) {
      return h('button', { key: o, type: 'button', 'aria-pressed': i === cur ? 'true' : 'false', onClick: function () { st[1](i); if (p.onChange) p.onChange(i); } }, o);
    }));
  }

  function SelectableTile(p) {
    var st = useState(!!p.defaultSelected); var on = p.selected !== undefined ? p.selected : st[0];
    return h('button', { type: 'button', className: 'ltw-tile', 'aria-pressed': on ? 'true' : 'false', onClick: function () { if (p.selected === undefined) st[1](!on); if (p.onChange) p.onChange(!on); } },
      p.icon ? h(Icon, { name: p.icon, size: 20 }) : null,
      h('span', null, h('span', { className: 'ltw-tile-title', style: { display: 'block' } }, p.title), p.description ? h('span', { className: 'ltw-tile-desc', style: { display: 'block' } }, p.description) : null),
      on ? h(Icon, { name: 'checkmark--filled', className: 'ltw-tile-check' }) : null);
  }

  function InlineNotification(p) {
    var success = p.kind === 'success';
    return h('div', { className: cx('ltw-ntf', success && 'ltw-ntf-success'), role: 'status' },
      h(Icon, { name: success ? 'checkmark--filled' : (p.icon || 'information') }),
      h('div', null, p.title ? h('b', null, p.title + ' ') : null, p.children));
  }

  function Toast(p) {
    return h('div', { className: 'ltw-toast', role: 'status' },
      h(Icon, { name: 'checkmark--filled' }),
      h('div', null, h('div', { style: { fontWeight: 600 } }, p.title), p.children ? h('div', { style: { marginTop: 2 } }, p.children) : null),
      p.onClose ? h('button', { type: 'button', 'aria-label': 'Close', onClick: p.onClose }, h(Icon, { name: 'close' })) : null);
  }

  function ProgressBar(p) {
    var max = p.max || 100; var pct = Math.max(0, Math.min(1, (p.value || 0) / max));
    return h('div', { className: 'ltw-pb' },
      p.label ? h('div', { className: 'ltw-pb-head' }, h('span', null, p.label), h('span', { style: { color: 'var(--text-secondary)' } }, p.valueText || Math.round(pct * 100) + '%')) : null,
      h('div', { className: 'ltw-pb-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': p.value, 'aria-label': p.label },
        h('i', { className: 'ltw-pb-fill', style: { transform: 'scaleX(' + pct + ')', transformOrigin: 'left' } })),
      p.helper ? h('span', { className: 'ltw-help' }, p.helper) : null);
  }

  function ProgressSteps(p) {
    var cur = p.current || 0;
    return h('ol', { className: 'ltw-steps' }, (p.steps || []).map(function (s, i) {
      var state = i < cur ? 'done' : (i === cur ? 'current' : 'todo');
      return h('li', { key: s, className: cx('ltw-step', 'ltw-step-' + state), 'aria-current': state === 'current' ? 'step' : undefined },
        h(Icon, { name: state === 'done' ? 'checkmark--filled' : (state === 'current' ? 'time' : 'add'), className: state === 'done' || state === 'current' ? '' : '' }),
        h('span', { className: 'ltw-step-label' }, s));
    }));
  }

  function StatTile(p) {
    return h('div', { className: 'ltw-stat' },
      h('span', { className: 'ltw-stat-l' }, p.label),
      h('span', { className: 'ltw-stat-v' }, p.value),
      p.helper ? h('span', { className: 'ltw-help' }, p.helper) : null);
  }

  function Logo() {
    return h('span', { className: 'ltw-logo', 'aria-hidden': true }, h('svg', { width: 24, height: 24, viewBox: '0 0 24 24' }, h('path', { d: 'M5 18h4.5v-4.5H14V9h5' })));
  }

  function SideNav(p) {
    var st = useState(!!p.defaultCollapsed); var col = p.collapsed !== undefined ? p.collapsed : st[0];
    var w = col ? null : (p.width || null);
    var org = p.org || { initials: 'CL', name: 'Calder Lane', team: 'Client Services team' };
    var user = p.user || { initials: 'PR', name: 'Priya Raman', role: 'Team manager' };
    return h('nav', { className: cx('ltw-sn', col && 'ltw-sn-col'), 'aria-label': 'Main', style: w ? { width: w } : null },
      h('div', { className: 'ltw-sn-rs', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize navigation' }),
      h('a', { className: 'ltw-sn-brand', href: p.homeHref || '#', title: 'Lead the Way' }, h(Logo), h('span', { className: 'ltw-sn-t' }, 'Lead the Way')),
      h('div', { className: 'ltw-sn-org', title: org.name }, h('span', { className: 'ltw-av ltw-av-org' }, org.initials),
        h('span', { className: 'ltw-sn-x', style: { minWidth: 0, flex: 1 } }, h('span', { style: { display: 'block', fontWeight: 600 } }, org.name), h('span', { className: 'ltw-help', style: { display: 'block', color: 'var(--text-secondary)' } }, org.team)),
        h(Icon, { name: 'chevron--sort', className: 'ltw-sn-x' })),
      (p.sections || []).map(function (sec) {
        return h(React.Fragment, { key: sec.title },
          h('div', { className: 'ltw-sn-h' }, sec.title),
          sec.items.map(function (it) {
            return h('a', { key: it.label, className: 'ltw-sn-a', href: it.href || '#', title: it.label, 'aria-current': it.current ? 'page' : undefined }, h(Icon, { name: it.icon }), h('span', { className: 'ltw-sn-t' }, it.label));
          }));
      }),
      h('button', { type: 'button', className: 'ltw-sn-tg', 'aria-expanded': !col, onClick: function () { if (p.collapsed === undefined) st[1](!col); if (p.onToggle) p.onToggle(!col); } }, h(Icon, { name: 'chevron--left' }), h('span', { className: 'ltw-sn-t' }, 'Collapse')),
      h('div', { className: 'ltw-sn-acct', title: user.name }, h('span', { className: 'ltw-av' }, user.initials),
        h('span', { className: 'ltw-sn-x', style: { minWidth: 0, flex: 1 } }, h('span', { style: { display: 'block', fontWeight: 600 } }, user.name), h('span', { className: 'ltw-help', style: { display: 'block', color: 'var(--text-secondary)' } }, user.role)),
        h(Icon, { name: 'chevron--sort', className: 'ltw-sn-x' })),
      h('p', { className: 'ltw-sn-cap ltw-sn-x', style: { margin: 0 } }, 'Concept prototype. Not an official IBM product.'));
  }

  function Modal(p) {
    return h('div', { className: 'ltw-scrim', style: p.inline ? null : { position: 'fixed', inset: 0, zIndex: 100 } },
      h('div', { className: 'ltw-modal', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'ltw-modal-t' },
        h('div', { className: 'ltw-modal-h' }, h('div', null, p.label ? h('span', { className: 'ltw-lbl' }, p.label) : null, h('h2', { className: 'ltw-modal-t', id: 'ltw-modal-t' }, p.title)),
          h('button', { type: 'button', className: 'ltw-modal-x', 'aria-label': 'Close', onClick: p.onClose }, h(Icon, { name: 'close', size: 20 }))),
        h('div', { className: 'ltw-modal-b' }, p.children),
        h('div', { className: 'ltw-modal-f' },
          h(Button, { kind: 'secondary', onClick: p.onSecondary || p.onClose }, p.secondaryText || 'Cancel'),
          h(Button, { kind: 'primary', onClick: p.onPrimary, disabled: p.primaryDisabled }, p.primaryText || 'Save'))));
  }

  window.LeadTheWay = { Icon: Icon, Button: Button, Tag: Tag, TextInput: TextInput, TextArea: TextArea, Select: Select, Checkbox: Checkbox, Toggle: Toggle, Tabs: Tabs, ContentSwitcher: ContentSwitcher, SelectableTile: SelectableTile, InlineNotification: InlineNotification, Toast: Toast, ProgressBar: ProgressBar, ProgressSteps: ProgressSteps, StatTile: StatTile, SideNav: SideNav, Modal: Modal, Logo: Logo, icons: Object.keys(ICONS) };
})();
