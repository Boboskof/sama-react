import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';

const SearchBar = ({ 
  category = null, 
  placeholder = "Rechercher...", 
  onResultSelect = null,
  showQuickResults = true,
  className = ""
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  const { 
    query, 
    setQuery, 
    results, 
    loading, 
    error, 
    quickSearch 
  } = useSearch(category, { limit: 10 });

  // Recherche rapide pour autocomplétion
  useEffect(() => {
    if (query && showQuickResults) {
      quickSearch(query);
    }
  }, [query, quickSearch, showQuickResults]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        // Scroll into view
        setTimeout(() => {
          const selectedElement = resultsRef.current?.querySelector(`[data-index="${selectedIndex + 1}"]`);
          selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        // Scroll into view
        setTimeout(() => {
          const selectedElement = resultsRef.current?.querySelector(`[data-index="${selectedIndex - 1}"]`);
          selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleResultSelect(results[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultSelect = (result) => {
    if (onResultSelect) {
      onResultSelect(result);
      setIsOpen(false);
      setQuery('');
      return;
    }

    // Navigation automatique selon le type de résultat
    switch (result.type) {
      case 'patient':
        if (result.id) {
          navigate(`/patients/${result.id}`);
        }
        break;
      case 'rendez_vous':
        if (result.id) {
          navigate(`/appointments`);
          // Optionnel: ouvrir le détail du RDV
        }
        break;
      case 'document':
        if (result.id) {
          navigate(`/documents`);
        }
        break;
      case 'communication':
        if (result.id) {
          navigate(`/communications`);
        }
        break;
      default:
        break;
    }
    
    setIsOpen(false);
    setQuery('');
  };

  const getResultLabel = (result) => {
    switch (result.type) {
      case 'patient':
        return `${result.metadata?.patient_name || 'Patient inconnu'}`;
      case 'rendez_vous':
        return `${result.metadata?.patient_name || 'Patient'} - ${result.metadata?.created_at || ''}`;
      case 'document':
        return `${result.metadata?.patient_name || 'Patient'} - ${result.title}`;
      case 'communication':
        return `${result.metadata?.patient_name || 'Patient'} - ${result.title}`;
      default:
        return result.title || result.subtitle || 'Résultat';
    }
  };

  const getResultIcon = (result) => {
    switch (result.type) {
      case 'patient': return 'person';
      case 'rendez_vous': return 'event';
      case 'document': return 'description';
      case 'communication': return 'chat';
      default: return 'search';
    }
  };

  const getResultTypeLabel = (type) => {
    switch (type) {
      case 'patient': return 'Patient';
      case 'rendez_vous': return 'Rendez-vous';
      case 'document': return 'Document';
      case 'communication': return 'Communication';
      default: return 'Résultat';
    }
  };

  // Grouper les résultats par type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        resultsRef.current && 
        !resultsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <span className="material-symbols-rounded text-gray-400 text-xl">search</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-rounded text-xl">close</span>
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2) && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto"
        >
          {error ? (
            <div className="p-4 text-red-600 text-sm flex items-center gap-2">
              <span className="material-symbols-rounded text-lg">error</span>
              {error}
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {(() => {
                let globalIndex = -1;
                return Object.entries(groupedResults).map(([type, typeResults]) => (
                  <div key={type}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {getResultTypeLabel(type)} ({typeResults.length})
                      </span>
                    </div>
                    {typeResults.map((result) => {
                      globalIndex++;
                      const currentIndex = globalIndex;
                      const isSelected = currentIndex === selectedIndex;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          data-index={currentIndex}
                          onClick={() => handleResultSelect(result)}
                          className={`w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors ${
                            isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          type === 'patient' ? 'bg-orange-100' :
                          type === 'rendez_vous' ? 'bg-pink-100' :
                          type === 'document' ? 'bg-green-100' :
                          type === 'communication' ? 'bg-purple-100' :
                          'bg-gray-100'
                        }`}>
                          <span className={`material-symbols-rounded text-lg ${
                            type === 'patient' ? 'text-orange-600' :
                            type === 'rendez_vous' ? 'text-pink-600' :
                            type === 'document' ? 'text-green-600' :
                            type === 'communication' ? 'text-purple-600' :
                            'text-gray-600'
                          }`}>
                            {getResultIcon(result)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {getResultLabel(result)}
                          </div>
                          {result.subtitle && (
                            <div className="text-sm text-gray-500 truncate mt-0.5">
                              {result.subtitle}
                            </div>
                          )}
                          {result.metadata?.statut && (
                            <div className="text-xs text-gray-400 mt-1">
                              Statut: {result.metadata.statut}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <span className="material-symbols-rounded text-gray-400 text-lg">chevron_right</span>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          ) : !loading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              <span className="material-symbols-rounded text-2xl text-gray-300 mb-2 block">search_off</span>
              Aucun résultat trouvé pour "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
