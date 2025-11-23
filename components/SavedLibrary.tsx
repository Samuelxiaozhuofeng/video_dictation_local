import React, { useState } from 'react';
import { ArrowLeft, Trash2, Search, Calendar, Film } from 'lucide-react';
import { SavedLine } from '../types';
import * as Storage from '../utils/storage';

interface SavedLibraryProps {
  onBack: () => void;
}

const SavedLibrary: React.FC<SavedLibraryProps> = ({ onBack }) => {
  const [savedLines, setSavedLines] = useState<SavedLine[]>(Storage.getSavedLines());
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = (text: string) => {
    const updated = Storage.removeLineFromStorage(text);
    setSavedLines(updated);
  };

  const filteredLines = savedLines.filter(line => 
    line.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.videoName && line.videoName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-neutral-950 to-neutral-900 border-b border-neutral-800/50 px-6 py-5 flex items-center justify-between shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-xl transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">My Saved Collection</h1>
          <span className="bg-brand-500/10 text-brand-400 text-xs font-semibold px-3 py-1.5 rounded-xl border border-brand-500/20">
            {savedLines.length}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6">

        {/* Search */}
        <div className="mb-8 relative">
           <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
             <Search className="w-5 h-5 text-neutral-500" />
           </div>
           <input
              type="text"
              placeholder="Search your saved lines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-5 py-4 bg-neutral-900/50 border border-neutral-800/50 rounded-2xl text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all shadow-soft"
           />
        </div>

        {/* Grid */}
        {filteredLines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredLines.map((line) => (
              <div key={line.id} className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-6 hover:border-neutral-700 hover:shadow-soft transition-all group flex flex-col relative">
                 <div className="flex-1 mb-5">
                    <p className="text-lg md:text-xl font-medium text-neutral-100 leading-relaxed">
                      "{line.text}"
                    </p>
                 </div>

                 <div className="flex items-center justify-between text-xs text-neutral-400 mt-auto pt-4 border-t border-neutral-800/50">
                    <div className="flex flex-col gap-2">
                       {line.videoName && (
                         <div className="flex items-center gap-2 text-brand-400">
                            <Film className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[200px] font-medium">{line.videoName}</span>
                            <span className="text-neutral-600">•</span>
                            <span>{line.timeDisplay}</span>
                         </div>
                       )}
                       <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Saved on {formatDate(line.dateSaved)}</span>
                       </div>
                    </div>

                    <button
                      onClick={() => handleDelete(line.text)}
                      className="p-2.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 border border-transparent hover:border-red-400/20"
                      title="Remove from collection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-neutral-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-neutral-800/50">
               <Search className="w-10 h-10 text-neutral-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-300 mb-2">No lines found</h3>
            <p className="text-neutral-500 text-sm">
              {searchTerm ? "Try adjusting your search terms." : "Go practice and save some interesting lines!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedLibrary;