import { useState, useEffect, useCallback } from 'react';
import { searchService } from '../_services/search.service';

export const useSearch = (category = null, options = {}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const search = useCallback(async (searchQuery, searchOptions = {}) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (category) {
        response = await searchService.searchByCategory(category, searchQuery, {
          ...options,
          ...searchOptions
        });
      } else {
        response = await searchService.searchGlobal(searchQuery, {
          ...options,
          ...searchOptions
        });
      }

      const data = response.data || response;
      
      if (category) {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);
      } else {
        // Recherche globale - agréger tous les résultats
        const allResults = [];
        Object.values(data.categories || {}).forEach(cat => {
          allResults.push(...(cat.results || []));
        });
        setResults(allResults);
        setTotal(data.total_results || 0);
        setHasMore(Object.values(data.categories || {}).some(cat => cat.has_more));
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la recherche');
      setResults([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [category, options]);

  const quickSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    try {
      const response = await searchService.quickSearch(searchQuery);
      const data = response.data || response;
      setResults(data.results || []);
    } catch (err) {
      console.error('Erreur recherche rapide:', err);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotal(0);
    setHasMore(false);
    setError(null);
  }, []);

  // Recherche automatique avec debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        search(query);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    total,
    hasMore,
    search,
    quickSearch,
    clearSearch
  };
};
