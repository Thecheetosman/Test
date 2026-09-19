import React, { useRef } from 'react';
import { PlanetData } from '../types';
import { Printer, Download, Copy, Check, X, FileText, Globe, Sparkles } from 'lucide-react';

interface ReportExportModalProps {
  planet: PlanetData;
  onClose: () => void;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({ planet, onClose }) => {
  const [copied, setCopied] = React.useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const handlePrintPDF = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(planet, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${planet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_scientific_dossier.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyMarkdown = () => {
    const md = `# PLANETARY RESEARCH DOSSIER: ${planet.name.toUpperCase()}
**Survey Classification:** ${planet.archetype.replace('_', ' ').toUpperCase()}
**Parent Host Star:** ${planet.star.name} (${planet.star.spectralType}-Type Main Sequence, Luminosity: ${planet.star.luminositySolar} L☉)

## 1. Physical & Geodynamical Characteristics
- **Radius:** ${planet.radiusEarth} R⊕ (${Math.round(planet.radiusEarth * 6371).toLocaleString()} km)
- **Mass:** ${planet.massEarth} M⊕
- **Surface Gravity:** ${planet.surfaceGravityG} g (${(planet.surfaceGravityG * 9.80665).toFixed(2)} m/s²)
- **Mean Bulk Density:** ${planet.densityGcm3} g/cm³
- **Escape Velocity:** ${planet.escapeVelocityKms} km/s
- **Hydrosphere Coverage:** ${planet.seaLevelPercent}% (Sea level threshold)
- **Magnetic Dipole Dynamo:** ${planet.magneticFieldGauss} Gauss

## 2. Orbital Mechanics & Calendar
- **Semi-Major Axis:** ${planet.semiMajorAxisAU} AU
- **Eccentricity:** ${planet.eccentricity}
- **Orbital Period (Year):** ${planet.orbitalPeriodDays.toFixed(1)} Earth Days (${planet.calendar.daysPerYear} local sols)
- **Day Length (Rotation):** ${planet.rotationPeriodHours.toFixed(1)} Hours
- **Axial Tilt:** ${planet.axialTiltDeg}°

## 3. Atmospheric Envelope
- **Surface Pressure:** ${planet.atmosphere.surfacePressureAtm} atm (${Math.round(planet.atmosphere.surfacePressureAtm * 1013.25)} hPa)
- **Atmospheric Habitability:** ${planet.atmosphere.breathableHuman ? 'Breathable Terran Spec' : 'Hazardous / Unbreathable'}
- **Major Constituents:**
${planet.atmosphere.gases.map((g) => `  - ${g.name} (${g.symbol}): ${g.percentage}%`).join('\n')}

## 4. Strategic Mineral & Ore Wealth
${planet.minerals.map((m) => `- **${m.name} (${m.symbol})**: ${m.crustalAbundancePpm} ppm [Tier: ${m.economicValueTier.toUpperCase()}] - ${m.geologicalOrigin}`).join('\n')}

## 5. Civilization Historical Annals
${planet.chronicle.map((c) => `- **Year ${c.year}**: ${c.title} - ${c.description}`).join('\n')}
`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono text-xs">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-slate-100 text-sm">
              PLANETARY SCIENTIFIC DOSSIER & REPORT EXPORT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors shadow-md"
              title="Print to PDF or Paper"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              title="Download Full Raw Project JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Project JSON</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              title="Copy Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Container */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-300 bg-slate-950 print:bg-white print:text-black">
          {/* Header Banner */}
          <div className="border-b-2 border-cyan-500 pb-4">
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest print:text-cyan-800">
              Astrobiological & Geophysical Survey Registry
            </div>
            <h1 className="text-3xl font-bold font-sans text-slate-100 mt-1 print:text-black">
              {planet.name.toUpperCase()}
            </h1>
            <div className="text-slate-400 text-xs mt-1 print:text-gray-600">
              Archetype: <strong className="text-slate-200 capitalize print:text-black">{planet.archetype.replace('_', ' ')}</strong> | Host Star: {planet.star.name} ({planet.star.spectralType}-Class)
            </div>
          </div>

          {/* Core Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 print:border-gray-300 print:bg-gray-50">
            <div>
              <div className="text-slate-500 text-[10px]">EQUATORIAL RADIUS</div>
              <div className="text-sm font-bold text-slate-200 print:text-black">{planet.radiusEarth} R⊕</div>
              <div className="text-[10px] text-slate-400">({Math.round(planet.radiusEarth * 6371).toLocaleString()} km)</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">SURFACE GRAVITY</div>
              <div className="text-sm font-bold text-slate-200 print:text-black">{planet.surfaceGravityG} g</div>
              <div className="text-[10px] text-slate-400">{(planet.surfaceGravityG * 9.81).toFixed(1)} m/s²</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">ORBITAL PERIOD</div>
              <div className="text-sm font-bold text-slate-200 print:text-black">{planet.orbitalPeriodDays.toFixed(1)} Days</div>
              <div className="text-[10px] text-slate-400">{planet.semiMajorAxisAU} AU</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">ATMOSPHERIC PRESSURE</div>
              <div className="text-sm font-bold text-slate-200 print:text-black">{planet.atmosphere.surfacePressureAtm} atm</div>
              <div className="text-[10px] text-slate-400">{planet.atmosphere.breathableHuman ? 'Breathable' : 'IVA Required'}</div>
            </div>
          </div>

          {/* Atmospheric Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-1 print:text-black print:border-gray-300">
              ATMOSPHERIC CHROMATOGRAPHY & VOLATILES
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {planet.atmosphere.gases.map((g) => (
                <div key={g.symbol} className="bg-slate-900 p-2 rounded-lg border border-slate-800 print:border-gray-300 print:bg-gray-100">
                  <span className="text-slate-400 print:text-gray-700">{g.name} ({g.symbol}): </span>
                  <strong className="text-cyan-400 print:text-black">{g.percentage}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Mineralogical Prospectus */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-1 print:text-black print:border-gray-300">
              STRATEGIC MINERAL RESERVES & CRUSTAL ORES
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              {planet.minerals.map((m) => (
                <div key={m.id} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 print:border-gray-300 print:bg-gray-50">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-200 print:text-black">{m.name} ({m.symbol})</span>
                    <span className="text-cyan-400 uppercase text-[10px] print:text-blue-700">{m.economicValueTier}</span>
                  </div>
                  <div className="text-slate-400 mt-0.5 print:text-gray-600">
                    Abundance: {m.crustalAbundancePpm} ppm | {m.geologicalOrigin}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Chronicle */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-1 print:text-black print:border-gray-300">
              CIVILIZATION HISTORICAL CHRONICLE
            </h3>
            <div className="space-y-2">
              {planet.chronicle.map((c) => (
                <div key={c.id} className="border-l-2 border-cyan-500 pl-3 py-1">
                  <div className="font-bold text-slate-200 print:text-black">
                    Year {c.year}: {c.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 print:text-gray-700">{c.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
