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
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">My Saved Collection</h1>
          <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full border border-slate-700">
            {savedLines.length}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6">
        
        {/* Search */}
        <div className="mb-8 relative">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search className="w-5 h-5 text-slate-500" />
           </div>
           <input 
              type="text"
              placeholder="Search your saved lines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
           />
        </div>

        {/* Grid */}
        {filteredLines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLines.map((line) => (
              <div key={line.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors group flex flex-col relative">
                 <div className="flex-1 mb-4">
                    <p className="text-lg md:text-xl font-medium text-slate-100 leading-relaxed font-serif">
                      "{line.text}"
                    </p>
                 </div>
                 
                 <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-800/50">
                    <div className="flex flex-col gap-1">
                       {line.videoName && (
                         <div className="flex items-center gap-1.5 text-brand-400">
                            <Film className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{line.videoName}</span>
                            <span className="text-slate-600">•</span>
                            <span>{line.timeDisplay}</span>
                         </div>
                       )}
                       <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>Saved on {formatDate(line.dateSaved)}</span>
                       </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(line.text)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
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
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
               <Search className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-1">No lines found</h3>
            <p className="text-slate-500">
              {searchTerm ? "Try adjusting your search terms." : "Go practice and save some interesting lines!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedLibrary;