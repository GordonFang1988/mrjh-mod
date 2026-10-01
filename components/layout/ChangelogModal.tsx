import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ChangelogModal.css';
import { releaseNotes } from '../../release/releaseNotes';
import { APP_VERSION_LABEL } from '../../release/version';

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  const [entryIndex, setEntryIndex] = useState(0);
  const entry = releaseNotes[entryIndex];
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const listener = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const nodes = Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', listener, true);
    return () => { window.removeEventListener('keydown', listener, true); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [onClose]);

  if (!entry) return null;

  const hasNewer = entryIndex > 0;
  const hasOlder = entryIndex < releaseNotes.length - 1;
  const hasMultipleEntries = releaseNotes.length > 1;

  return createPortal(
    <div ref={modalRef} className="changelog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className={`changelog-modal${hasMultipleEntries ? '' : ' changelog-modal--single'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
      >
        <header className="changelog-header">
          <div>
            <p>RELEASE NOTES</p>
            <h2 id="changelog-title">更新日志与版权声明</h2>
          </div>
          <button type="button" aria-label="关闭更新日志" onClick={onClose}>
            ×
          </button>
        </header>

        <article className="changelog-entry" aria-live="polite">
          <section className="changelog-copyright" aria-labelledby="changelog-copyright-title">
            <h3 id="changelog-copyright-title">版权声明</h3>
            <p>
              本站基于开源项目 MikuLXK/MoRanJiangHu 修改制作，原项目版权与开源协议归原作者及贡献者所有。
              本修改版用于个人学习、体验与二次开发研究，请尊重原作者劳动成果。
            </p>
          </section>
          <div className="changelog-entry-heading">
            <time>{entry.date}</time>
            <span>{hasMultipleEntries ? `${entryIndex + 1} / ${releaseNotes.length}` : APP_VERSION_LABEL}</span>
          </div>
          <div className="changelog-update-list">
            {entry.updates.map((update) => (
              <section className="changelog-update" key={update.id} aria-labelledby={`${update.id}-title`}>
                <div className="changelog-update-heading">
                  <time dateTime={`${entry.id}T${update.time}:00+08:00`}>{update.time}</time>
                  <span>{update.version}</span>
                </div>
                <h3 id={`${update.id}-title`}>{update.title}</h3>
                <p>{update.summary}</p>
                <ul>
                  {update.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </article>

        <footer className="changelog-footer">
          {hasMultipleEntries ? (
            <>
            <button type="button" disabled={!hasNewer} onClick={() => setEntryIndex((value) => value - 1)}>
              ← 较新一条
            </button>
            <div className="changelog-dots" aria-label="更新日志页码">
              {releaseNotes.map((note, index) => (
                <button
                  key={note.id}
                  type="button"
                  className={index === entryIndex ? 'active' : ''}
                  aria-label={`查看${note.date}更新，共${note.updates.length}项`}
                  aria-current={index === entryIndex ? 'page' : undefined}
                  onClick={() => setEntryIndex(index)}
                />
              ))}
            </div>
            <button type="button" disabled={!hasOlder} onClick={() => setEntryIndex((value) => value + 1)}>
              较早一条 →
            </button>
            </>
          ) : null}
          <button type="button" className="changelog-dismiss" onClick={onClose}>我知道了</button>
        </footer>
      </section>
    </div>, document.fullscreenElement || document.body
  );
}
