import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { ASSET_KEYS, ASSET_MANIFEST, DENI_ANIMATIONS } from '../game/config/assetManifest';
import { AssetLoadEntry } from '../game/types/gameTypes';

interface AssetInspectorModalProps {
  report: AssetLoadEntry[];
  onClose: () => void;
}

export function AssetInspectorModal({ report, onClose }: AssetInspectorModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(ASSET_MANIFEST[0].key);

  const selectedSheet =
    ASSET_MANIFEST.find((s) => s.key === selectedKey) ?? ASSET_MANIFEST[0];
  const selectedStatus = report.find((r) => r.key === selectedSheet.key);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Asset Manifest Inspector"
    >
      <div className="pixel-panel flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b-2 border-slate-700 pb-4 mb-4">
          <div>
            <h2 className="font-pixel-display text-sm sm:text-base text-amber-300">
              ASSET MANIFEST &amp; SPRITE INSPECTOR
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Verified original PNG sprite sheets with exact non-destructive frame coordinates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn flex items-center gap-1.5 bg-[#16233d] hover:bg-[#1e3054] border-2 border-slate-300 px-3 py-2 text-xs text-slate-100 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>CLOSE</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 overflow-y-auto pr-1">
          {/* Sheet List */}
          <div className="md:col-span-5 space-y-2">
            {ASSET_MANIFEST.map((sheet) => {
              const status = report.find((r) => r.key === sheet.key);
              const isSelected = sheet.key === selectedSheet.key;
              return (
                <button
                  key={sheet.key}
                  type="button"
                  onClick={() => setSelectedKey(sheet.key)}
                  className={`w-full text-left border-2 p-3 transition-colors ${
                    isSelected
                      ? 'bg-[#172847] border-amber-300'
                      : 'bg-[#091120] border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-pixel-ui text-[11px] uppercase text-sky-300">
                      {sheet.category}
                    </span>
                    {status?.loaded ? (
                      <span className="flex items-center gap-1 font-pixel-ui text-[11px] text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        LOADED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-pixel-ui text-[11px] text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {status ? 'ERROR' : 'PENDING'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-100">{sheet.label}</p>
                  <p className="mt-1 font-mono-num text-[11px] text-slate-400">
                    {status?.naturalWidth || sheet.expectedWidth} x{' '}
                    {status?.naturalHeight || sheet.expectedHeight} px · {sheet.frames.length} frames
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Sheet Preview & Frame Coordinates */}
          <div className="md:col-span-7 flex flex-col gap-3 bg-[#091120] border-2 border-slate-700 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-pixel-ui text-xs text-amber-300">{selectedSheet.label}</h3>
              <span className="font-mono-num text-[11px] text-slate-400">
                {selectedSheet.path}
              </span>
            </div>

            {selectedStatus?.error ? (
              <div className="border-2 border-rose-500 bg-rose-950/60 p-3 text-xs text-rose-200">
                {selectedStatus.error}
              </div>
            ) : (
              <div className="border-2 border-slate-700 bg-[repeating-conic-gradient(#162033_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px] p-2">
                <img
                  src={selectedSheet.path}
                  alt={selectedSheet.label}
                  referrerPolicy="no-referrer"
                  className="pixelated mx-auto max-h-56 w-auto object-contain"
                />
              </div>
            )}

            <div>
              <p className="font-pixel-ui text-[11px] text-slate-300 mb-2">
                SLICED ATLAS FRAMES ({selectedSheet.frames.length})
              </p>
              <div className="max-h-36 overflow-y-auto border border-slate-700 bg-[#060b16] p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {selectedSheet.frames.map((frame) => (
                  <div
                    key={frame.name}
                    className="flex items-center justify-between border border-slate-800 bg-[#0d1729] px-2 py-1 text-[11px]"
                  >
                    <span className="font-mono text-emerald-300 truncate">{frame.name}</span>
                    <span className="font-mono-num text-slate-400 shrink-0 ml-2">
                      {frame.x},{frame.y} · {frame.w}x{frame.h}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedSheet.key === ASSET_KEYS.DENI && (
              <div>
                <p className="font-pixel-ui text-[11px] text-amber-300 mb-2">
                  REGISTERED ANIMATION STATES ({DENI_ANIMATIONS.length})
                </p>
                <div className="max-h-32 overflow-y-auto border border-slate-700 bg-[#060b16] p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {DENI_ANIMATIONS.map((anim) => (
                    <div
                      key={anim.key}
                      className="flex items-center justify-between border border-slate-800 bg-[#0d1729] px-2 py-1 text-[11px]"
                    >
                      <span className="font-mono text-sky-300 truncate">{anim.key}</span>
                      <span className="font-mono-num text-slate-400 shrink-0 ml-2">
                        {anim.frames.length}f · {anim.frameRate}fps
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
