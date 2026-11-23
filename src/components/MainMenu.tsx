import { GraduationCap, Play, School, User } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { StorageSystem } from '../game/systems/StorageSystem';

interface MainMenuProps {
  ready: boolean;
  onPlay: () => void;
  onOpenTeacherMode: () => void;
}

type FieldKey = 'name' | 'school';

export function MainMenu({ ready, onPlay, onOpenTeacherMode }: MainMenuProps) {
  const initialProfile = StorageSystem.loadPlayerProfile();
  const [name, setName] = useState(initialProfile.name);
  const [school, setSchool] = useState(initialProfile.school);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<FieldKey | 'both' | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const schoolInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;

    const trimmedName = name.trim();
    const trimmedSchool = school.trim();

    if (!trimmedName && !trimmedSchool) {
      setInvalidField('both');
      setErrorMessage('Harap isi Nama dan Nama Sekolah terlebih dahulu.');
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedName) {
      setInvalidField('name');
      setErrorMessage('Harap isi Nama terlebih dahulu.');
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedSchool) {
      setInvalidField('school');
      setErrorMessage('Harap isi Nama Sekolah terlebih dahulu.');
      schoolInputRef.current?.focus();
      return;
    }

    setInvalidField(null);
    setErrorMessage(null);
    StorageSystem.savePlayerProfile({
      name: trimmedName,
      school: trimmedSchool,
    });
    onPlay();
  };

  const nameInvalid = invalidField === 'name' || invalidField === 'both';
  const schoolInvalid = invalidField === 'school' || invalidField === 'both';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-start p-2.5 sm:p-4 md:p-5">
      <button
        type="button"
        onClick={onOpenTeacherMode}
        aria-label="Mode Guru"
        title="Mode Guru"
        className="pointer-events-auto absolute top-2.5 right-2.5 sm:top-4 sm:right-4 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center bg-[#0b1322]/90 hover:bg-[#172845] text-amber-300 hover:text-amber-200 border-2 border-slate-200/80 shadow-[0_3px_0_#060b14] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        <GraduationCap aria-hidden="true" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </button>

      <section
        aria-label="Halaman Awal EXAM EDUVERSE"
        className="pointer-events-auto w-[212px] sm:w-[252px] md:w-[280px] max-w-[calc(100%-52px)] bg-[#0b1322]/82 backdrop-blur-[2px] border-2 border-slate-100/95 p-2.5 sm:p-3.5 shadow-[0_4px_0_#060b14,inset_0_0_0_2px_#1d3557]"
      >
        {/* A. Judul & Subjudul ringkas */}
        <header className="mb-2 sm:mb-2.5">
          <h1 className="font-pixel-display text-[11px] sm:text-sm md:text-[15px] leading-tight tracking-wide text-amber-300 [text-shadow:0_2px_0_#060b14]">
            EXAM <span className="text-emerald-300">EDUVERSE</span>
          </h1>
          <p className="mt-0.5 font-pixel-ui text-[8px] sm:text-[10px] tracking-wide text-sky-200">
            Educational Adventure Game
          </p>
          <div
            aria-hidden="true"
            className="mt-1.5 h-[2px] w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400/30"
          />
        </header>

        {/* B, C, D. Form Nama, Sekolah, & Tombol PLAY */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1.5 sm:gap-2">
          <div>
            <label htmlFor="player-name-input" className="sr-only">
              Nama
            </label>
            <div className="relative flex items-center">
              <User
                aria-hidden="true"
                className="pointer-events-none absolute left-2 sm:left-2.5 h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400"
              />
              <input
                ref={nameInputRef}
                id="player-name-input"
                type="text"
                value={name}
                maxLength={60}
                autoComplete="name"
                placeholder="Masukkan Nama"
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) {
                    setErrorMessage(null);
                    setInvalidField(null);
                  }
                }}
                aria-invalid={nameInvalid}
                className={`w-full bg-[#0f1d36]/95 border-2 pl-7 sm:pl-8 pr-2 py-1 sm:py-1.5 text-[10px] sm:text-xs text-slate-50 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                  nameInvalid
                    ? 'border-rose-400 focus:border-rose-300 focus:ring-rose-400/30'
                    : 'border-slate-500/80 hover:border-slate-300 focus:border-amber-300 focus:ring-amber-300/25'
                }`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="player-school-input" className="sr-only">
              Sekolah
            </label>
            <div className="relative flex items-center">
              <School
                aria-hidden="true"
                className="pointer-events-none absolute left-2 sm:left-2.5 h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400"
              />
              <input
                ref={schoolInputRef}
                id="player-school-input"
                type="text"
                value={school}
                maxLength={80}
                autoComplete="organization"
                placeholder="Masukkan Nama Sekolah"
                onChange={(e) => {
                  setSchool(e.target.value);
                  if (errorMessage) {
                    setErrorMessage(null);
                    setInvalidField(null);
                  }
                }}
                aria-invalid={schoolInvalid}
                className={`w-full bg-[#0f1d36]/95 border-2 pl-7 sm:pl-8 pr-2 py-1 sm:py-1.5 text-[10px] sm:text-xs text-slate-50 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                  schoolInvalid
                    ? 'border-rose-400 focus:border-rose-300 focus:ring-rose-400/30'
                    : 'border-slate-500/80 hover:border-slate-300 focus:border-amber-300 focus:ring-amber-300/25'
                }`}
              />
            </div>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="bg-rose-950/90 border border-rose-400 px-2 py-1 text-[9px] sm:text-[11px] font-medium text-rose-200 leading-tight"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready}
            className="pixel-btn mt-0.5 flex w-full items-center justify-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 hover:-translate-y-0.5 active:translate-y-0.5 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-wait text-slate-950 font-pixel-display tracking-wider border-2 border-white px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs shadow-[0_3px_0_#065f46] hover:shadow-[0_4px_0_#065f46] focus-visible:outline-2 focus-visible:outline-amber-300 cursor-pointer"
          >
            <Play aria-hidden="true" className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current" />
            <span>PLAY</span>
          </button>
        </form>
      </section>
    </div>
  );
}
