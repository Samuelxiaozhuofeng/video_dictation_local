import React, { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { SavedLine } from '../types';
import * as Storage from '../utils/storage';
import { Btn, Card, H, Stamp, inputCls } from './ui';

const SavedLibrary: React.FC = () => {
  const [savedLines, setSavedLines] = useState<SavedLine[]>(Storage.getSavedLines());
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = (text: string) => {
    setSavedLines(Storage.removeLineFromStorage(text));
  };

  const filteredLines = savedLines.filter((line) =>
    line.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.videoName && line.videoName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-4">
        <H className="mb-0">{'Saved lines'}</H>
        <Stamp>{savedLines.length}</Stamp>
      </div>

      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-3 flex items-center text-mute pointer-events-none">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="Search your saved lines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`${inputCls} font-mono pl-10`}
        />
      </div>

      {filteredLines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLines.map((line) => (
            <Card key={line.id} className="p-5 flex flex-col">
              <p className="font-serif text-lg leading-relaxed flex-1 mb-4">
                "{line.text}"
              </p>
              <div className="border-t border-line pt-3 flex items-center gap-2 flex-wrap">
                {line.videoName && <Stamp tone="shade">{line.videoName}</Stamp>}
                <Stamp className="font-mono">{line.timeDisplay}</Stamp>
                <span className="text-mute text-xs">{formatDate(line.dateSaved)}</span>
                <Btn
                  type="button"
                  square
                  size="sm"
                  flat
                  className="ml-auto"
                  onClick={() => handleDelete(line.text)}
                  title="Remove from collection"
                >
                  <Trash2 size={16} />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="paper" className="p-10 text-center max-w-lg mx-auto">
          <h3 className="font-serif text-2xl font-semibold">
            {searchTerm ? 'NO MATCH' : 'NOTHING SAVED YET'}
          </h3>
          <p className="mt-2 text-sm text-mute font-medium">
            {searchTerm
              ? 'Try a different sentence or video name.'
              : 'Go practice and save some interesting lines!'}
          </p>
        </Card>
      )}
    </div>
  );
};

export default SavedLibrary;
