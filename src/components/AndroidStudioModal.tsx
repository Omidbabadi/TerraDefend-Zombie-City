import React, { useMemo, useState } from 'react';
import {
  ANDROID_STUDIO_PROJECT_FILES,
  AndroidArchitectureLayer,
} from '../game/androidSource';

interface AndroidStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LAYERS: ('All' | AndroidArchitectureLayer)[] = [
  'All',
  'Gradle & Manifest',
  'App & DI',
  'Domain',
  'Data',
  'Jetpack Compose UI',
];

export const AndroidStudioModal: React.FC<AndroidStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [layerFilter, setLayerFilter] = useState<
    'All' | AndroidArchitectureLayer
  >('All');
  const [selectedPath, setSelectedPath] = useState<string>(
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/AndroidGameScreen.kt'
  );
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    if (layerFilter === 'All') return ANDROID_STUDIO_PROJECT_FILES;
    return ANDROID_STUDIO_PROJECT_FILES.filter((f) => f.layer === layerFilter);
  }, [layerFilter]);

  const activeFile = useMemo(() => {
    return (
      ANDROID_STUDIO_PROJECT_FILES.find((f) => f.path === selectedPath) ||
      filteredFiles[0] ||
      ANDROID_STUDIO_PROJECT_FILES[0]
    );
  }, [selectedPath, filteredFiles]);

  if (!isOpen) return null;

  const handleCopyFile = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedNotice(`Copied ${activeFile.path.split('/').pop()}`);
      window.setTimeout(() => setCopiedNotice(null), 2200);
    } catch {
      setCopiedNotice('Clipboard unavailable in preview');
    }
  };

  const handleDownloadProjectBundle = () => {
    const payload = {
      project: 'Sector Zero: City Map Defense (Native Android Studio Game)',
      packageName: 'com.sectorzero.citydefense',
      stack: [
        'Kotlin 2.0',
        'Jetpack Compose Material 3',
        'Android Hardware Canvas',
        'OsmDroid Esri World Imagery Satellite Maps',
        'OSRM Real-Road Pathfinding',
        'Jetpack DataStore Offline Persistence',
      ],
      totalFiles: ANDROID_STUDIO_PROJECT_FILES.length,
      files: ANDROID_STUDIO_PROJECT_FILES,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sector-zero-android-game-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopiedNotice('Downloaded Android Studio Project Bundle');
    window.setTimeout(() => setCopiedNotice(null), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.92)', pointerEvents: 'auto' }}
      role="dialog"
      aria-label="Native Android Studio Kotlin Game Project"
    >
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[86vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-tabular font-bold uppercase tracking-wider text-emerald-400">
                Native Android Game · Kotlin + Jetpack Compose
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                ({ANDROID_STUDIO_PROJECT_FILES.length} files in /android_game)
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-100 uppercase truncate">
              Android Studio Project Explorer (com.sectorzero.citydefense)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {copiedNotice && (
              <span className="text-xs font-mono-tabular text-emerald-400 font-semibold">
                {copiedNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleDownloadProjectBundle}
              className="min-h-[44px] px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Export Android Bundle (.json)
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Android Studio Code Explorer"
              className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Done
            </button>
          </div>
        </div>

        {/* Layer Filter Chips */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {LAYERS.map((layer) => {
            const active = layerFilter === layer;
            return (
              <button
                key={layer}
                type="button"
                onClick={() => {
                  setLayerFilter(layer);
                  const nextFiles =
                    layer === 'All'
                      ? ANDROID_STUDIO_PROJECT_FILES
                      : ANDROID_STUDIO_PROJECT_FILES.filter(
                          (f) => f.layer === layer
                        );
                  if (
                    nextFiles.length > 0 &&
                    !nextFiles.some((f) => f.path === selectedPath)
                  ) {
                    setSelectedPath(nextFiles[0].path);
                  }
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                  active
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {layer}
              </button>
            );
          })}
        </div>

        {/* Mobile File Dropdown (visible on narrow screens) */}
        <div className="lg:hidden px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <label
            htmlFor="android-file-select"
            className="block text-[11px] font-mono-tabular text-slate-400 mb-1"
          >
            Select Android Source File ({filteredFiles.length})
          </label>
          <select
            id="android-file-select"
            value={activeFile.path}
            onChange={(e) => setSelectedPath(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono-tabular text-slate-100"
          >
            {filteredFiles.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path.replace('android_game/', '')}
              </option>
            ))}
          </select>
        </div>

        {/* Main Split Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Desktop Left File Tree */}
          <div className="hidden lg:block lg:col-span-4 border-r border-slate-800 bg-slate-950 overflow-y-auto p-3 space-y-1.5">
            {filteredFiles.map((file) => {
              const isSelected = file.path === activeFile.path;
              const shortName = file.path.split('/').pop() || file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-slate-800/95 border-emerald-500/80 text-slate-100'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-tabular font-bold text-emerald-300 truncate">
                      {shortName}
                    </span>
                    <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                      {file.layer}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {file.path}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 line-clamp-1">
                    {file.summary}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-slate-950">
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono-tabular text-emerald-300 font-bold truncate">
                  {activeFile.path}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeFile.summary}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyFile}
                className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 shrink-0"
              >
                Copy Source
              </button>
            </div>

            <pre className="flex-1 p-4 overflow-auto text-xs font-mono-tabular text-slate-200 leading-relaxed">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
