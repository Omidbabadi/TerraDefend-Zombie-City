import React, { useState } from 'react';
import { FLUTTER_CLEAN_ARCH_FILES, FlutterArchFile } from '../game/flutterSource';

interface FlutterCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LAYERS: FlutterArchFile['layer'][] = [
  'Root & DI',
  'Core',
  'Domain',
  'Data',
  'Presentation',
];

export const FlutterCodeModal: React.FC<FlutterCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>(
    FLUTTER_CLEAN_ARCH_FILES[0].path
  );
  const [layerFilter, setLayerFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeFile =
    FLUTTER_CLEAN_ARCH_FILES.find((f) => f.path === selectedPath) ||
    FLUTTER_CLEAN_ARCH_FILES[0];

  const visibleFiles =
    layerFilter === 'ALL'
      ? FLUTTER_CLEAN_ARCH_FILES
      : FLUTTER_CLEAN_ARCH_FILES.filter((f) => f.layer === layerFilter);

  const handleCopyFile = () => {
    navigator.clipboard?.writeText(activeFile.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.90)', pointerEvents: 'auto' }}
      role="dialog"
      aria-label="Flutter Clean Architecture Source Code Explorer"
    >
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[86vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-slate-100 uppercase">
              Flutter Clean Architecture Source Code (`flutter_project/lib/`)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              20 modular Dart & YAML files structured across Core, Domain (Entities, Repositories, UseCases), Data (Models, Hive DataSources, Repositories), and Presentation (BLoC/Cubit, GoogleMap + CustomPaint).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Flutter SDK Modal"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Close Explorer
          </button>
        </div>

        {/* Layer Filter Bar */}
        <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setLayerFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                layerFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Layers ({FLUTTER_CLEAN_ARCH_FILES.length})
            </button>
            {LAYERS.map((layer) => {
              const count = FLUTTER_CLEAN_ARCH_FILES.filter(
                (f) => f.layer === layer
              ).length;
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setLayerFilter(layer)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    layerFilter === layer
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {layer} ({count})
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopyFile}
            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? 'Copied File to Clipboard' : 'Copy Current File'}
          </button>
        </div>

        {/* Split Tree & Code Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Left File Tree */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 overflow-y-auto p-3 space-y-1">
            {visibleFiles.map((file) => {
              const isSelected = file.path === activeFile.path;
              const shortPath = file.path.replace('flutter_project/', '');
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-slate-800 border border-amber-500/80 text-slate-100'
                      : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-bold truncate">
                      {shortPath}
                    </span>
                    <span className="text-[10px] font-mono-tabular text-amber-400 shrink-0">
                      {file.layer}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 line-clamp-1">
                    {file.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Code Panel */}
          <div className="lg:col-span-8 flex flex-col bg-slate-950 min-h-0 overflow-hidden">
            <div className="px-5 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="font-mono-tabular text-xs font-bold text-amber-400">
                  {activeFile.path}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {activeFile.description}
                </div>
              </div>
              <span className="text-xs font-mono-tabular text-slate-400 shrink-0">
                Layer: {activeFile.layer}
              </span>
            </div>

            <pre className="p-5 text-slate-200 font-mono-tabular text-xs overflow-auto flex-1 leading-relaxed select-text">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
