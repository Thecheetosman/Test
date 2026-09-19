import React, { useState } from 'react';
import { PlanetData, ChronicleEvent, ChronicleEra } from '../types';
import { BookOpen, Plus, Sparkles, Calendar, Moon, Sun, Flame, Award, Trash2 } from 'lucide-react';

interface CivilizationChronicleProps {
  planet: PlanetData;
  onAddEvent: (event: ChronicleEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onRequestAILore?: () => void;
  isGeneratingLore?: boolean;
}

export const CivilizationChronicle: React.FC<CivilizationChronicleProps> = ({
  planet,
  onAddEvent,
  onDeleteEvent,
  onRequestAILore,
  isGeneratingLore,
}) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newYear, setNewYear] = useState<number>(planet.calendar.currentYear);
  const [newCategory, setNewCategory] = useState<ChronicleEvent['category']>('sociopolitical');
  const [newDesc, setNewDesc] = useState<string>('');
  const [isEclipse, setIsEclipse] = useState<boolean>(false);
  const [eclipseType, setEclipseType] = useState<ChronicleEvent['eclipseType']>('solar_total');

  const cal = planet.calendar;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const event: ChronicleEvent = {
      id: `ev-${Date.now()}`,
      year: newYear,
      planetDay: Math.floor(Math.random() * cal.daysPerYear) + 1,
      eraId: planet.eras[0]?.id || 'era-default',
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim() || 'No detailed records survived in archive.',
      isEclipse,
      eclipseType: isEclipse ? eclipseType : undefined,
    };

    onAddEvent(event);
    setNewTitle('');
    setNewDesc('');
    setShowAddForm(false);
  };

  const getCategoryIcon = (category: ChronicleEvent['category'], isEclipseEvent?: boolean) => {
    if (isEclipseEvent) return <Moon className="w-4 h-4 text-amber-400" />;
    switch (category) {
      case 'astronomical':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'technological':
        return <Award className="w-4 h-4 text-cyan-400" />;
      case 'ecological':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'cataclysm':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'sociopolitical':
      default:
        return <BookOpen className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 font-mono text-xs text-slate-300">
      {/* 1. Calendar System Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>PLANETARY CALENDAR ENGINE: {cal.yearName.toUpperCase()}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Standard Sol: {cal.hoursPerDay.toFixed(1)} hours • Year: {cal.daysPerYear} sols ({cal.months.length} Months)
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg text-[11px]">
            <span className="text-slate-400">Current Epoch Date: </span>
            <strong className="text-cyan-300">
              Year {cal.currentYear}, {cal.months[cal.currentMonth]?.name || 'Primus'} {cal.currentDay}
            </strong>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-md active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Historical Event</span>
          </button>

          {onRequestAILore && (
            <button
              onClick={onRequestAILore}
              disabled={isGeneratingLore}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGeneratingLore ? 'Synthesizing...' : 'AI Astrobiology Lore'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. New Event Creation Form Modal / Card */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-cyan-500/40 p-4 rounded-xl space-y-3 animate-in fade-in">
          <div className="font-bold text-slate-100 text-sm flex justify-between items-center border-b border-slate-800 pb-2">
            <span>RECORD CIVILIZATION CHRONICLE ENTRY</span>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-200">
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">EVENT TITLE</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Great Hydro-Tunnel Opening"
                className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">PLANETARY YEAR</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">CATEGORY</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200"
              >
                <option value="sociopolitical">Sociopolitical</option>
                <option value="technological">Technological</option>
                <option value="ecological">Ecological</option>
                <option value="astronomical">Astronomical (Eclipse/Conjunction)</option>
                <option value="cataclysm">Cataclysmic / Disruption</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEclipse}
                onChange={(e) => setIsEclipse(e.target.checked)}
                className="accent-cyan-400"
              />
              <span className="text-slate-300">Astronomical Eclipse Occurrence?</span>
            </label>

            {isEclipse && (
              <select
                value={eclipseType}
                onChange={(e) => setEclipseType(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs text-amber-300"
              >
                <option value="solar_total">Total Solar Eclipse</option>
                <option value="solar_annular">Annular Solar Eclipse</option>
                <option value="lunar_total">Total Lunar Eclipse</option>
                <option value="transit">Planetary Transit</option>
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">CHRONICLE RECORD & CULTURAL SIGNIFICANCE</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Detail the planetary conditions, political factions, or ecological ramifications..."
              className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg"
            >
              Commit to Annals
            </button>
          </div>
        </form>
      )}

      {/* 3. Chronicle Timeline View */}
      <div className="space-y-3">
        {planet.chronicle.length === 0 ? (
          <div className="bg-slate-900/60 p-8 rounded-xl border border-slate-800 text-center text-slate-500">
            No historical records logged yet for {planet.name}. Click &quot;Log Historical Event&quot; or synthesize lore with AI.
          </div>
        ) : (
          planet.chronicle
            .sort((a, b) => a.year - b.year)
            .map((ev) => (
              <div
                key={ev.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl transition-all flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 mt-0.5">
                    {getCategoryIcon(ev.category, ev.isEclipse)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{ev.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 text-[10px] font-bold">
                        Year {ev.year} {ev.planetDay ? `(Sol ${ev.planetDay})` : ''}
                      </span>
                      {ev.isEclipse && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                          {ev.eclipseType?.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteEvent(ev.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  title="Delete Entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
